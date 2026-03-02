#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{
    fs::{create_dir_all, remove_file, write},
    io::{BufRead, BufReader},
    path::PathBuf,
    process::{Child, Command, Stdio},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    time::Duration,
};

use reqwest::{Client, Method};
use rfd::FileDialog;
use serde::Deserialize;
use serde::Serialize;
use serde_json::{json, Value};
use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    path::BaseDirectory,
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, RunEvent, State, WindowEvent,
};
use tauri_plugin_updater::UpdaterExt;
use tokio::time::sleep;

#[derive(Serialize, Clone)]
struct UpdateAvailablePayload {
    version: String,
    current_version: String,
}

const CONTROL_HEADER: &str = "x-dossier-control-token";

#[derive(Clone)]
struct RuntimeState {
    client: BackendControlClient,
    is_quitting: Arc<AtomicBool>,
}

#[derive(Clone)]
struct BackendControlClient {
    http: Client,
    base_url: String,
    token: String,
    child: Arc<Mutex<Option<Child>>>,
}

#[derive(Deserialize)]
struct BackendReady {
    #[allow(dead_code)]
    r#type: String,
    #[serde(rename = "controlPort")]
    control_port: u16,
    #[serde(rename = "controlToken")]
    control_token: String,
}

impl BackendControlClient {
    async fn request(
        &self,
        method: Method,
        path: &str,
        body: Option<Value>,
    ) -> Result<Value, String> {
        self.request_with_timeout(method, path, body, Duration::from_secs(300))
            .await
    }

    async fn request_with_timeout(
        &self,
        method: Method,
        path: &str,
        body: Option<Value>,
        timeout: Duration,
    ) -> Result<Value, String> {
        let url = format!("{}{}", self.base_url, path);
        let request = self
            .http
            .request(method, url)
            .header(CONTROL_HEADER, self.token.as_str())
            .timeout(timeout);

        let request = if let Some(payload) = body {
            request.json(&payload)
        } else {
            request
        };

        let response = request
            .send()
            .await
            .map_err(|error| format!("control request failed: {error}"))?;
        let status = response.status();
        let payload = response
            .json::<Value>()
            .await
            .map_err(|error| format!("failed to parse control response: {error}"))?;

        if !status.is_success() {
            return Err(format!("control request failed ({status}): {payload}"));
        }

        Ok(payload)
    }

    async fn shutdown(&self) {
        let _ = self
            .request(Method::POST, "/control/shutdown", Some(json!({})))
            .await;

        if let Some(mut child) = self.child.lock().ok().and_then(|mut guard| guard.take()) {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}

fn xml_escape(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

#[cfg(target_os = "macos")]
fn macos_launch_agent_path() -> Result<PathBuf, String> {
    let home_dir = std::env::var("HOME")
        .map(PathBuf::from)
        .map_err(|error| format!("failed to resolve HOME for start-on-login: {error}"))?;
    Ok(home_dir
        .join("Library")
        .join("LaunchAgents")
        .join("com.dossier.desktop.plist"))
}

#[cfg(target_os = "macos")]
fn set_start_on_login(enabled: bool) -> Result<bool, String> {
    let launch_agent = macos_launch_agent_path()?;
    if enabled {
        if let Some(parent) = launch_agent.parent() {
            create_dir_all(parent)
                .map_err(|error| format!("failed to create LaunchAgents directory: {error}"))?;
        }

        let executable = std::env::current_exe()
            .map_err(|error| format!("failed to resolve executable path: {error}"))?;
        let escaped_path = xml_escape(&executable.to_string_lossy());
        let plist = format!(
            r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.dossier.desktop</string>
  <key>ProgramArguments</key>
  <array>
    <string>{escaped_path}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <false/>
</dict>
</plist>
"#
        );
        write(&launch_agent, plist)
            .map_err(|error| format!("failed to write LaunchAgent file: {error}"))?;
        return Ok(true);
    }

    if launch_agent.exists() {
        remove_file(&launch_agent)
            .map_err(|error| format!("failed to remove LaunchAgent file: {error}"))?;
    }
    Ok(false)
}

#[cfg(target_os = "macos")]
fn is_start_on_login_enabled() -> Result<bool, String> {
    Ok(macos_launch_agent_path()?.is_file())
}

#[cfg(not(target_os = "macos"))]
fn set_start_on_login(_enabled: bool) -> Result<bool, String> {
    Err("start-on-login OS wiring is only implemented for macOS builds".to_string())
}

#[cfg(not(target_os = "macos"))]
fn is_start_on_login_enabled() -> Result<bool, String> {
    Ok(false)
}

fn resolve_backend_script_path(app: &AppHandle) -> Result<PathBuf, String> {
    if let Ok(from_env) = std::env::var("DOSSIER_BACKEND_SCRIPT") {
        let candidate = PathBuf::from(from_env);
        let resolved = if candidate.is_absolute() {
            candidate
        } else {
            PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("..")
                .join(candidate)
        };

        if resolved.is_file() {
            return Ok(resolved);
        }

        return Err(format!(
            "DOSSIER_BACKEND_SCRIPT does not point to a file: '{}'",
            resolved.display()
        ));
    }

    let packaged_candidates = [
        "backend.js",
        "dist/backend.js",
        "_up_/dist/backend.js",
        "_up_/_up_/dist/backend.js",
    ];
    for candidate in packaged_candidates {
        if let Ok(resolved) = app.path().resolve(candidate, BaseDirectory::Resource) {
            if resolved.is_file() {
                return Ok(resolved);
            }
        }
    }

    if cfg!(debug_assertions) {
        let tauri_manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        let workspace_dist = tauri_manifest_dir.join("../dist/backend.js");
        if workspace_dist.is_file() {
            return Ok(workspace_dist);
        }
    }

    Err("failed to locate backend script in app resources or debug fallback from CARGO_MANIFEST_DIR. Build it with `pnpm --filter @dossier/dossier-desktop run build`.".to_string())
}

fn resolve_packaged_packages_root(app: &AppHandle) -> PathBuf {
    let candidates = [
        "packages",
        "_up_/packages",
        "_up_/_up_/packages",
        "_up_/_up_/_up_/packages",
    ];

    for candidate in candidates {
        if let Ok(resolved) = app.path().resolve(candidate, BaseDirectory::Resource) {
            if resolved.is_dir() {
                return resolved;
            }
        }
    }

    PathBuf::from("packages")
}

fn resolve_node_binary() -> Result<String, String> {
    if let Ok(explicit) = std::env::var("DOSSIER_NODE_BIN") {
        return Ok(explicit);
    }

    if Command::new("node")
        .arg("--version")
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .is_ok()
    {
        return Ok("node".to_string());
    }

    let common_node_paths = ["/opt/homebrew/bin/node", "/usr/local/bin/node", "/usr/bin/node"];
    for candidate in common_node_paths {
        if PathBuf::from(candidate).is_file() {
            return Ok(candidate.to_string());
        }
    }

    Err("node runtime not found. Install Node.js or set DOSSIER_NODE_BIN to an absolute node executable path.".to_string())
}

fn spawn_backend(app: &AppHandle) -> Result<BackendControlClient, String> {
    let script_path = resolve_backend_script_path(app)?;

    let node_bin = resolve_node_binary()?;

    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("failed to resolve app data directory: {error}"))?;
    create_dir_all(&app_data_dir)
        .map_err(|error| format!("failed to create app data directory: {error}"))?;

    let mut command = Command::new(node_bin);
    let inferred_packages_root =
        if let Ok(explicit_packages_root) = std::env::var("DOSSIER_PACKAGES_ROOT") {
            PathBuf::from(explicit_packages_root)
        } else if cfg!(debug_assertions) {
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../../packages")
        } else {
            resolve_packaged_packages_root(app)
        };

    command
        .env(
            "DOSSIER_APP_VERSION",
            app.package_info().version.to_string(),
        )
        .env("DOSSIER_PACKAGES_ROOT", inferred_packages_root.as_os_str())
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::inherit());

    if let Some(parent) = script_path.parent() {
        command.current_dir(parent);
        if let Some(file_name) = script_path.file_name() {
            command.arg(file_name);
        } else {
            command.arg(script_path.as_os_str());
        }
    } else {
        command.arg(script_path.as_os_str());
    }
    command.arg(app_data_dir.as_os_str());

    let mut child = command
        .spawn()
        .map_err(|error| format!("failed to spawn backend daemon: {error}"))?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "backend daemon did not expose stdout".to_string())?;
    let mut reader = BufReader::new(stdout);
    let mut line = String::new();
    reader
        .read_line(&mut line)
        .map_err(|error| format!("failed to read backend ready payload: {error}"))?;

    if line.trim().is_empty() {
        return Err("backend daemon exited before sending ready payload".to_string());
    }

    let ready = serde_json::from_str::<BackendReady>(line.trim())
        .map_err(|error| format!("invalid backend ready payload: {error}"))?;

    let client = Client::builder()
        .build()
        .map_err(|error| format!("failed to initialize HTTP client: {error}"))?;

    Ok(BackendControlClient {
        http: client,
        base_url: format!("http://127.0.0.1:{}", ready.control_port),
        token: ready.control_token,
        child: Arc::new(Mutex::new(Some(child))),
    })
}

fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn force_stop_backend_if_running(app: &AppHandle) {
    if let Some(state) = app.try_state::<RuntimeState>() {
        state.is_quitting.store(true, Ordering::SeqCst);
        if let Some(mut child) = state
            .client
            .child
            .lock()
            .ok()
            .and_then(|mut guard| guard.take())
        {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}

async fn poll_consent_requests(app: AppHandle, state: RuntimeState) {
    while !state.is_quitting.load(Ordering::SeqCst) {
        match state
            .client
            .request(Method::GET, "/control/events/next?timeout_ms=25000", None)
            .await
        {
            Ok(payload) => {
                let next_event = payload.get("event").cloned();
                if let Some(event) = next_event {
                    if !event.is_null() {
                        let _ = app.emit("consent:request", event);
                        show_main_window(&app);
                    }
                }
            }
            Err(error) => {
                eprintln!("Consent polling failed: {error}");
                sleep(Duration::from_millis(800)).await;
            }
        }
    }
}

async fn run_auto_update(app: AppHandle) {
    if cfg!(debug_assertions) {
        return;
    }
    if std::env::var("DOSSIER_DISABLE_AUTO_UPDATE").is_ok() {
        return;
    }

    let (updates_enabled, skipped_version) = if let Some(state) = app.try_state::<RuntimeState>() {
        let client = state.client.clone();
        drop(state);
        match client.request(Method::GET, "/control/settings", None).await {
            Ok(payload) => (
                payload
                    .get("autoUpdatesEnabled")
                    .and_then(Value::as_bool)
                    .unwrap_or(true),
                payload
                    .get("skippedUpdateVersion")
                    .and_then(Value::as_str)
                    .map(|v| v.to_string()),
            ),
            Err(error) => {
                eprintln!("Failed to read settings for update check: {error}");
                (true, None)
            }
        }
    } else {
        (true, None)
    };

    if !updates_enabled {
        return;
    }
    if let Some(state) = app.try_state::<RuntimeState>() {
        if state.is_quitting.load(Ordering::SeqCst) {
            return;
        }
    }

    let updater = match app.updater() {
        Ok(updater) => updater,
        Err(error) => {
            eprintln!("Updater not available: {error}");
            return;
        }
    };

    let update = match updater.check().await {
        Ok(update) => update,
        Err(error) => {
            eprintln!("Update check failed: {error}");
            return;
        }
    };

    let Some(update) = update else {
        return;
    };

    if let Some(skipped) = skipped_version {
        if skipped == update.version {
            return;
        }
    }

    let _ = app.emit(
        "update:available",
        UpdateAvailablePayload {
            version: update.version.clone(),
            current_version: update.current_version.clone(),
        },
    );
}

#[tauri::command]
async fn update_install_and_restart(app: AppHandle) -> Result<(), String> {
    if cfg!(debug_assertions) {
        return Err("updater is disabled in debug builds".to_string());
    }
    if std::env::var("DOSSIER_DISABLE_AUTO_UPDATE").is_ok() {
        return Err("auto-update is disabled by environment".to_string());
    }

    let updater = app.updater().map_err(|error| format!("Updater not available: {error}"))?;
    let update = updater.check().await.map_err(|error| format!("Update check failed: {error}"))?;
    let Some(update) = update else {
        return Ok(());
    };

    update
        .download_and_install(
            |_chunk_length, _content_length| {},
            || {
                eprintln!("Update download finished");
            },
        )
        .await
        .map_err(|error| format!("Update install failed: {error}"))?;

    if let Some(state) = app.try_state::<RuntimeState>() {
        state.is_quitting.store(true, Ordering::SeqCst);
        let client = state.client.clone();
        drop(state);
        client.shutdown().await;
    }

    app.restart();
}

fn create_tray(app: &AppHandle) -> Result<(), String> {
    let open_item = MenuItemBuilder::with_id("open", "Open Dossier")
        .build(app)
        .map_err(|error| format!("failed to create tray open menu item: {error}"))?;
    let quit_item = MenuItemBuilder::with_id("quit", "Quit Dossier")
        .build(app)
        .map_err(|error| format!("failed to create tray quit menu item: {error}"))?;
    let menu = MenuBuilder::new(app)
        .items(&[&open_item, &quit_item])
        .build()
        .map_err(|error| format!("failed to create tray menu: {error}"))?;

    let Some(icon) = app.default_window_icon().cloned() else {
        return Err("default window icon is not available for tray setup".to_string());
    };

    let _tray = TrayIconBuilder::with_id("main-tray")
        .icon(icon)
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "open" => {
                show_main_window(app);
            }
            "quit" => {
                let app = app.clone();
                tauri::async_runtime::spawn(async move {
                    if let Some(state) = app.try_state::<RuntimeState>() {
                        state.is_quitting.store(true, Ordering::SeqCst);
                        state.client.shutdown().await;
                    }
                    app.exit(0);
                });
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main_window(&tray.app_handle());
            }
        })
        .build(app)
        .map_err(|error| format!("failed to build tray icon: {error}"))?;

    Ok(())
}

#[tauri::command]
async fn app_get_version(state: State<'_, RuntimeState>) -> Result<String, String> {
    let payload = state
        .client
        .request(Method::GET, "/control/app/version", None)
        .await?;
    Ok(payload
        .get("version")
        .and_then(Value::as_str)
        .unwrap_or("0.1.0")
        .to_string())
}

#[tauri::command]
fn window_show(app: AppHandle) {
    show_main_window(&app);
}

#[tauri::command]
fn window_hide(app: AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }
}

#[tauri::command]
async fn window_quit(app: AppHandle, state: State<'_, RuntimeState>) -> Result<(), String> {
    state.is_quitting.store(true, Ordering::SeqCst);
    state.client.shutdown().await;
    app.exit(0);
    Ok(())
}

#[tauri::command]
async fn settings_get(state: State<'_, RuntimeState>) -> Result<Value, String> {
    state
        .client
        .request(Method::GET, "/control/settings", None)
        .await
}

#[tauri::command]
async fn settings_set(next: Value, state: State<'_, RuntimeState>) -> Result<Value, String> {
    state
        .client
        .request(
            Method::PUT,
            "/control/settings",
            Some(json!({ "next": next })),
        )
        .await
}

#[tauri::command]
fn settings_get_start_on_login() -> Result<bool, String> {
    is_start_on_login_enabled()
}

#[tauri::command]
fn settings_set_start_on_login(enabled: bool) -> Result<bool, String> {
    set_start_on_login(enabled)
}

#[tauri::command]
async fn profile_list_items(state: State<'_, RuntimeState>) -> Result<Value, String> {
    state
        .client
        .request(Method::GET, "/control/profile/items", None)
        .await
}

#[tauri::command]
async fn profile_create_manual_item(
    payload: Value,
    state: State<'_, RuntimeState>,
) -> Result<Value, String> {
    state
        .client
        .request(Method::POST, "/control/profile/items", Some(payload))
        .await
}

#[tauri::command]
async fn profile_update_item(
    item_id: String,
    payload: Value,
    state: State<'_, RuntimeState>,
) -> Result<Value, String> {
    state
        .client
        .request(
            Method::PATCH,
            format!("/control/profile/items/{item_id}").as_str(),
            Some(payload),
        )
        .await
}

#[tauri::command]
async fn profile_delete_item(
    item_id: String,
    state: State<'_, RuntimeState>,
) -> Result<Value, String> {
    state
        .client
        .request(
            Method::DELETE,
            format!("/control/profile/items/{item_id}").as_str(),
            None,
        )
        .await
}

#[tauri::command]
async fn inference_confirm(
    item_id: String,
    state: State<'_, RuntimeState>,
) -> Result<Value, String> {
    state
        .client
        .request(
            Method::POST,
            format!("/control/profile/inferences/{item_id}/confirm").as_str(),
            Some(json!({})),
        )
        .await
}

#[tauri::command]
async fn inference_edit_confirm(
    item_id: String,
    edited_text: String,
    state: State<'_, RuntimeState>,
) -> Result<Value, String> {
    state
        .client
        .request(
            Method::POST,
            format!("/control/profile/inferences/{item_id}/edit-confirm").as_str(),
            Some(json!({ "editedText": edited_text })),
        )
        .await
}

#[tauri::command]
async fn inference_dismiss(
    item_id: String,
    dismiss_reason: Option<String>,
    state: State<'_, RuntimeState>,
) -> Result<Value, String> {
    state
        .client
        .request(
            Method::POST,
            format!("/control/profile/inferences/{item_id}/dismiss").as_str(),
            Some(json!({ "dismissReason": dismiss_reason })),
        )
        .await
}

#[tauri::command]
async fn profile_propose_inference(
    payload: Value,
    state: State<'_, RuntimeState>,
) -> Result<Value, String> {
    state
        .client
        .request(Method::POST, "/control/profile/inferences", Some(payload))
        .await
}

#[tauri::command]
async fn topic_rules_list(state: State<'_, RuntimeState>) -> Result<Value, String> {
    state
        .client
        .request(Method::GET, "/control/topic-rules", None)
        .await
}

#[tauri::command]
async fn topic_rules_create(
    payload: Value,
    state: State<'_, RuntimeState>,
) -> Result<Value, String> {
    state
        .client
        .request(Method::POST, "/control/topic-rules", Some(payload))
        .await
}

#[tauri::command]
async fn topic_rules_update(
    rule_id: String,
    payload: Value,
    state: State<'_, RuntimeState>,
) -> Result<Value, String> {
    state
        .client
        .request(
            Method::PATCH,
            format!("/control/topic-rules/{rule_id}").as_str(),
            Some(payload),
        )
        .await
}

#[tauri::command]
async fn topic_rules_delete(
    rule_id: String,
    state: State<'_, RuntimeState>,
) -> Result<Value, String> {
    state
        .client
        .request(
            Method::DELETE,
            format!("/control/topic-rules/{rule_id}").as_str(),
            None,
        )
        .await
}

#[tauri::command]
async fn categories_list(state: State<'_, RuntimeState>) -> Result<Value, String> {
    state
        .client
        .request(Method::GET, "/control/categories", None)
        .await
}

#[tauri::command]
async fn categories_create(
    payload: Value,
    state: State<'_, RuntimeState>,
) -> Result<Value, String> {
    state
        .client
        .request(Method::POST, "/control/categories", Some(payload))
        .await
}

#[tauri::command]
async fn categories_update(
    category_id: String,
    payload: Value,
    state: State<'_, RuntimeState>,
) -> Result<Value, String> {
    state
        .client
        .request(
            Method::PATCH,
            format!("/control/categories/{category_id}").as_str(),
            Some(payload),
        )
        .await
}

#[tauri::command]
async fn categories_delete(
    category_id: String,
    state: State<'_, RuntimeState>,
) -> Result<Value, String> {
    state
        .client
        .request(
            Method::DELETE,
            format!("/control/categories/{category_id}").as_str(),
            None,
        )
        .await
}

#[tauri::command]
async fn compartments_list(state: State<'_, RuntimeState>) -> Result<Value, String> {
    state
        .client
        .request(Method::GET, "/control/compartments", None)
        .await
}

#[tauri::command]
async fn compartments_create(
    payload: Value,
    state: State<'_, RuntimeState>,
) -> Result<Value, String> {
    state
        .client
        .request(Method::POST, "/control/compartments", Some(payload))
        .await
}

#[tauri::command]
async fn compartments_update(
    compartment_id: String,
    payload: Value,
    state: State<'_, RuntimeState>,
) -> Result<Value, String> {
    state
        .client
        .request(
            Method::PATCH,
            format!("/control/compartments/{compartment_id}").as_str(),
            Some(payload),
        )
        .await
}

#[tauri::command]
async fn compartments_delete(
    compartment_id: String,
    state: State<'_, RuntimeState>,
) -> Result<Value, String> {
    state
        .client
        .request(
            Method::DELETE,
            format!("/control/compartments/{compartment_id}").as_str(),
            None,
        )
        .await
}

#[tauri::command]
async fn item_compartments_get(
    item_id: String,
    state: State<'_, RuntimeState>,
) -> Result<Value, String> {
    state
        .client
        .request(
            Method::GET,
            format!("/control/profile/items/{item_id}/compartments").as_str(),
            None,
        )
        .await
}

#[tauri::command]
async fn item_compartments_set(
    item_id: String,
    compartment_ids: Vec<String>,
    state: State<'_, RuntimeState>,
) -> Result<Value, String> {
    state
        .client
        .request(
            Method::PUT,
            format!("/control/profile/items/{item_id}/compartments").as_str(),
            Some(json!({ "compartmentIds": compartment_ids })),
        )
        .await
}

#[tauri::command]
async fn consent_get(
    request_id: String,
    state: State<'_, RuntimeState>,
) -> Result<Value, String> {
    state
        .client
        .request(
            Method::GET,
            format!("/control/consent/{request_id}").as_str(),
            None,
        )
        .await
}

#[tauri::command]
async fn consent_decide(
    request_id: String,
    payload: Value,
    state: State<'_, RuntimeState>,
) -> Result<Value, String> {
    state
        .client
        .request(
            Method::POST,
            format!("/control/consent/{request_id}/decision").as_str(),
            Some(payload),
        )
        .await
}

#[tauri::command]
async fn services_list(state: State<'_, RuntimeState>) -> Result<Value, String> {
    state
        .client
        .request(Method::GET, "/control/services", None)
        .await
}

#[tauri::command]
async fn services_revoke(
    service_id: String,
    state: State<'_, RuntimeState>,
) -> Result<Value, String> {
    state
        .client
        .request(
            Method::POST,
            format!("/control/services/{service_id}/revoke").as_str(),
            Some(json!({})),
        )
        .await
}

#[tauri::command]
async fn audit_list(
    service: Option<String>,
    item: Option<String>,
    event_type: Option<String>,
    date_from: Option<String>,
    date_to: Option<String>,
    state: State<'_, RuntimeState>,
) -> Result<Value, String> {
    let mut query = Vec::<String>::new();
    if let Some(service_id) = service {
        query.push(format!("service={service_id}"));
    }
    if let Some(item_id) = item {
        query.push(format!("item={item_id}"));
    }
    if let Some(event_type) = event_type {
        query.push(format!("type={event_type}"));
    }
    if let Some(date_from) = date_from {
        query.push(format!("date_from={date_from}"));
    }
    if let Some(date_to) = date_to {
        query.push(format!("date_to={date_to}"));
    }
    let path = if query.is_empty() {
        "/control/audit".to_string()
    } else {
        format!("/control/audit?{}", query.join("&"))
    };

    state
        .client
        .request(Method::GET, path.as_str(), None)
        .await
}

#[tauri::command]
async fn data_export_encrypted(
    passphrase: String,
    state: State<'_, RuntimeState>,
) -> Result<Value, String> {
    state
        .client
        .request(
            Method::POST,
            "/control/data/export",
            Some(json!({ "passphrase": passphrase })),
        )
        .await
}

#[tauri::command]
async fn data_import_encrypted(
    artifact: Value,
    passphrase: String,
    state: State<'_, RuntimeState>,
) -> Result<(), String> {
    state
        .client
        .request(
            Method::POST,
            "/control/data/import",
            Some(json!({ "artifact": artifact, "passphrase": passphrase })),
        )
        .await
        .map(|_| ())
}

#[tauri::command]
async fn data_backups_list(state: State<'_, RuntimeState>) -> Result<Value, String> {
    state
        .client
        .request(Method::GET, "/control/data/backups", None)
        .await
}

#[tauri::command]
async fn data_backup_create(
    passphrase: String,
    state: State<'_, RuntimeState>,
) -> Result<Value, String> {
    state
        .client
        .request(
            Method::POST,
            "/control/data/backups",
            Some(json!({ "passphrase": passphrase })),
        )
        .await
}

#[tauri::command]
async fn data_backup_verify(
    backup_id: String,
    state: State<'_, RuntimeState>,
) -> Result<Value, String> {
    state
        .client
        .request(
            Method::POST,
            format!("/control/data/backups/{backup_id}/verify").as_str(),
            Some(json!({})),
        )
        .await
}

#[tauri::command]
async fn data_backup_restore(
    backup_id: String,
    passphrase: String,
    state: State<'_, RuntimeState>,
) -> Result<Value, String> {
    state
        .client
        .request(
            Method::POST,
            format!("/control/data/backups/{backup_id}/restore").as_str(),
            Some(json!({ "passphrase": passphrase })),
        )
        .await
}

#[tauri::command]
async fn profile_delete_irreversible(
    confirmation_text: String,
    state: State<'_, RuntimeState>,
) -> Result<Value, String> {
    state
        .client
        .request(
            Method::POST,
            "/control/profile/delete-irreversible",
            Some(json!({ "confirmationText": confirmation_text })),
        )
        .await
}

#[tauri::command]
async fn data_run_takeout_import(
    path: String,
    state: State<'_, RuntimeState>,
) -> Result<Value, String> {
    state
        .client
        .request(
            Method::POST,
            "/control/data/takeout-import",
            Some(json!({ "importPath": path })),
        )
        .await
}

#[tauri::command]
fn data_browse_takeout_source() -> Result<Option<String>, String> {
    if let Some(folder) = FileDialog::new()
        .set_title("Select Google Takeout folder")
        .pick_folder()
    {
        return Ok(Some(folder.display().to_string()));
    }

    if let Some(file) = FileDialog::new()
        .set_title("Or select Google Takeout zip")
        .add_filter("Zip archive", &["zip"])
        .pick_file()
    {
        return Ok(Some(file.display().to_string()));
    }

    Ok(None)
}

#[tauri::command]
async fn data_takeout_plan(
    path: String,
    scope: Option<Value>,
    state: State<'_, RuntimeState>,
) -> Result<Value, String> {
    state
        .client
        .request(
            Method::POST,
            "/control/data/takeout/plan",
            Some(json!({ "importPath": path, "scope": scope })),
        )
        .await
}

#[tauri::command]
async fn data_takeout_start_job(
    path: String,
    workspace_id: Option<String>,
    scope: Option<Value>,
    state: State<'_, RuntimeState>,
) -> Result<Value, String> {
    state
        .client
        .request(
            Method::POST,
            "/control/data/takeout/jobs",
            Some(json!({
                "importPath": path,
                "workspaceId": workspace_id,
                "scope": scope
            })),
        )
        .await
}

#[tauri::command]
async fn data_takeout_job_status(
    job_id: String,
    state: State<'_, RuntimeState>,
) -> Result<Value, String> {
    state
        .client
        .request(
            Method::GET,
            format!("/control/data/takeout/jobs/{job_id}").as_str(),
            None,
        )
        .await
}

#[tauri::command]
async fn server_health(state: State<'_, RuntimeState>) -> Result<Value, String> {
    state
        .client
        .request(Method::GET, "/control/server/health", None)
        .await
}

#[tauri::command]
async fn llm_test(
    payload: Value,
    state: State<'_, RuntimeState>,
) -> Result<Value, String> {
    state
        .client
        .request(
            Method::POST,
            "/control/llm/test",
            Some(payload),
        )
        .await
}

#[tauri::command]
async fn llm_detect_ollama_models(
    endpoint: String,
    state: State<'_, RuntimeState>,
) -> Result<Value, String> {
    state
        .client
        .request(
            Method::POST,
            "/control/llm/ollama-models",
            Some(json!({ "endpoint": endpoint })),
        )
        .await
}

#[tauri::command]
async fn llm_chat(
    messages: Value,
    user_message: String,
    state: State<'_, RuntimeState>,
) -> Result<Value, String> {
    state
        .client
        .request_with_timeout(
            Method::POST,
            "/control/llm/chat",
            Some(json!({ "messages": messages, "userMessage": user_message })),
            Duration::from_secs(300),
        )
        .await
}

#[tauri::command]
async fn llm_alternatives(
    text: String,
    item_type: Option<String>,
    why: Option<String>,
    state: State<'_, RuntimeState>,
) -> Result<Value, String> {
    state
        .client
        .request(
            Method::POST,
            "/control/llm/alternatives",
            Some(json!({ "text": text, "itemType": item_type, "why": why })),
        )
        .await
}

#[tauri::command]
async fn profile_item_detail(
    item_id: String,
    state: State<'_, RuntimeState>,
) -> Result<Value, String> {
    state
        .client
        .request(
            Method::GET,
            format!("/control/profile/items/{item_id}/detail").as_str(),
            None,
        )
        .await
}

fn main() {
    let app = match tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let app_handle = app.handle().clone();
            let backend_client = match spawn_backend(&app_handle) {
                Ok(client) => client,
                Err(error) => {
                    eprintln!("Failed to start Dossier backend daemon: {error}");
                    app_handle.exit(1);
                    return Ok(());
                }
            };
            let state = RuntimeState {
                client: backend_client,
                is_quitting: Arc::new(AtomicBool::new(false)),
            };

            app.manage(state.clone());
            if let Err(error) = create_tray(&app_handle) {
                eprintln!("Tray initialization disabled: {error}");
            }

            tauri::async_runtime::spawn(poll_consent_requests(app_handle.clone(), state));
            tauri::async_runtime::spawn(run_auto_update(app_handle.clone()));
            show_main_window(&app_handle);

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let state = window.state::<RuntimeState>();
                if !state.is_quitting.load(Ordering::SeqCst) {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            app_get_version,
            window_show,
            window_hide,
            window_quit,
            settings_get,
            settings_set,
            settings_get_start_on_login,
            settings_set_start_on_login,
            profile_list_items,
            profile_create_manual_item,
            profile_update_item,
            profile_delete_item,
            inference_confirm,
            inference_edit_confirm,
            inference_dismiss,
            profile_propose_inference,
            topic_rules_list,
            topic_rules_create,
            topic_rules_update,
            topic_rules_delete,
            categories_list,
            categories_create,
            categories_update,
            categories_delete,
            compartments_list,
            compartments_create,
            compartments_update,
            compartments_delete,
            item_compartments_get,
            item_compartments_set,
            consent_get,
            consent_decide,
            services_list,
            services_revoke,
            audit_list,
            data_export_encrypted,
            data_import_encrypted,
            data_backups_list,
            data_backup_create,
            data_backup_verify,
            data_backup_restore,
            profile_delete_irreversible,
            data_run_takeout_import,
            data_browse_takeout_source,
            data_takeout_plan,
            data_takeout_start_job,
            data_takeout_job_status,
            server_health,
            llm_test,
            llm_detect_ollama_models,
            llm_chat,
            llm_alternatives,
            profile_item_detail
            ,
            update_install_and_restart
        ])
        .build(tauri::generate_context!())
    {
        Ok(app) => app,
        Err(error) => {
            eprintln!("error while building dossier desktop app: {error}");
            std::process::exit(1);
        }
    };

    app.run(|app, event| {
        if matches!(event, RunEvent::Exit | RunEvent::ExitRequested { .. }) {
            force_stop_backend_if_running(app);
        }
    });
}
