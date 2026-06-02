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
use serde::Deserialize;
use serde::Serialize;
use serde_json::{json, Value};
use tauri::{
    http::Response as HttpResponse,
    menu::{MenuBuilder, MenuItemBuilder},
    path::BaseDirectory,
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, RunEvent, State, UriSchemeContext, WindowEvent,
};
use tauri_plugin_updater::UpdaterExt;

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
        let url = format!("{}{}", self.base_url, path);
        let request = self
            .http
            .request(method, url)
            .header(CONTROL_HEADER, self.token.as_str())
            .timeout(Duration::from_secs(30));

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
        .stdout(Stdio::piped());

    let stderr_log_path = app_data_dir.join("backend-stderr.log");
    match std::fs::File::create(&stderr_log_path) {
        Ok(log_file) => {
            command.stderr(Stdio::from(log_file));
        }
        Err(_) => {
            command.stderr(Stdio::null());
        }
    }

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

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

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
        .unwrap_or("0.0.0")
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
async fn preferences_get(state: State<'_, RuntimeState>) -> Result<Value, String> {
    state
        .client
        .request(Method::GET, "/control/preferences", None)
        .await
}

#[tauri::command]
async fn preferences_set_rating(
    key: String,
    rating: Option<f64>,
    item: Option<Value>,
    state: State<'_, RuntimeState>,
) -> Result<Value, String> {
    state
        .client
        .request(
            Method::PUT,
            "/control/preferences/rating",
            Some(json!({ "key": key, "rating": rating, "item": item })),
        )
        .await
}

#[tauri::command]
async fn preferences_add_pairwise(
    winner_key: String,
    loser_key: String,
    state: State<'_, RuntimeState>,
) -> Result<Value, String> {
    state
        .client
        .request(
            Method::POST,
            "/control/preferences/pairwise",
            Some(json!({ "winnerKey": winner_key, "loserKey": loser_key })),
        )
        .await
}

#[tauri::command]
async fn preferences_skip(key: String, state: State<'_, RuntimeState>) -> Result<Value, String> {
    state
        .client
        .request(
            Method::POST,
            "/control/preferences/skip",
            Some(json!({ "key": key })),
        )
        .await
}

#[tauri::command]
async fn preferences_unskip(key: String, state: State<'_, RuntimeState>) -> Result<Value, String> {
    state
        .client
        .request(
            Method::POST,
            "/control/preferences/unskip",
            Some(json!({ "key": key })),
        )
        .await
}

#[tauri::command]
async fn preferences_reset(state: State<'_, RuntimeState>) -> Result<Value, String> {
    state
        .client
        .request(Method::POST, "/control/preferences/reset", Some(json!({})))
        .await
}

// --- Library export / import --------------------------------------------
// Forward to the Node backend, which serializes/encrypts the library with the
// isomorphic @dossier/domain codec. The portable `.dossier` file is the only
// bridge to/from the no-backend web build.

#[tauri::command]
async fn library_export(passphrase: String, state: State<'_, RuntimeState>) -> Result<String, String> {
    let resp = state
        .client
        .request(
            Method::POST,
            "/control/library/export",
            Some(json!({ "passphrase": passphrase })),
        )
        .await?;
    resp.get("file")
        .and_then(|v| v.as_str())
        .map(String::from)
        .ok_or_else(|| "backend did not return an export file".to_string())
}

#[tauri::command]
async fn library_import(
    file_content: String,
    passphrase: String,
    state: State<'_, RuntimeState>,
) -> Result<Value, String> {
    state
        .client
        .request(
            Method::POST,
            "/control/library/import",
            Some(json!({ "fileContent": file_content, "passphrase": passphrase })),
        )
        .await
}

// --- TMDB proxy commands -------------------------------------------------
// These forward to the Node backend's control server, which owns the TMDB
// token (OS keychain) and the metadata disk cache. Poster *images* do not
// go through here — they are served by the `tmdbimg` URI scheme below.

/// Percent-encode a query-string value (RFC 3986 unreserved set kept as-is).
fn pct(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    for byte in value.as_bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(*byte as char)
            }
            other => out.push_str(&format!("%{:02X}", other)),
        }
    }
    out
}

#[tauri::command]
async fn tmdb_status(state: State<'_, RuntimeState>) -> Result<Value, String> {
    state
        .client
        .request(Method::GET, "/control/tmdb/status", None)
        .await
}

#[tauri::command]
async fn tmdb_set_token(token: String, state: State<'_, RuntimeState>) -> Result<Value, String> {
    state
        .client
        .request(
            Method::PUT,
            "/control/tmdb/token",
            Some(json!({ "token": token })),
        )
        .await
}

#[tauri::command]
async fn tmdb_clear_token(state: State<'_, RuntimeState>) -> Result<Value, String> {
    state
        .client
        .request(Method::POST, "/control/tmdb/token/clear", Some(json!({})))
        .await
}

#[tauri::command]
async fn tmdb_genres(medium: String, state: State<'_, RuntimeState>) -> Result<Value, String> {
    state
        .client
        .request(
            Method::GET,
            &format!("/control/tmdb/genres?medium={}", pct(&medium)),
            None,
        )
        .await
}

#[tauri::command]
async fn tmdb_trending(
    medium: String,
    page: Option<i64>,
    state: State<'_, RuntimeState>,
) -> Result<Value, String> {
    state
        .client
        .request(
            Method::GET,
            &format!(
                "/control/tmdb/trending?medium={}&page={}",
                pct(&medium),
                page.unwrap_or(1)
            ),
            None,
        )
        .await
}

#[tauri::command]
async fn tmdb_discover(
    medium: String,
    sort_by: Option<String>,
    with_genres: Option<String>,
    min_votes: Option<i64>,
    page: Option<i64>,
    state: State<'_, RuntimeState>,
) -> Result<Value, String> {
    let mut path = format!("/control/tmdb/discover?medium={}", pct(&medium));
    if let Some(s) = sort_by {
        path.push_str(&format!("&sortBy={}", pct(&s)));
    }
    if let Some(g) = with_genres {
        path.push_str(&format!("&withGenres={}", pct(&g)));
    }
    if let Some(v) = min_votes {
        path.push_str(&format!("&minVotes={v}"));
    }
    if let Some(p) = page {
        path.push_str(&format!("&page={p}"));
    }
    state.client.request(Method::GET, &path, None).await
}

#[tauri::command]
async fn tmdb_search(
    medium: String,
    query: String,
    year: Option<i64>,
    state: State<'_, RuntimeState>,
) -> Result<Value, String> {
    let mut path = format!(
        "/control/tmdb/search?medium={}&query={}",
        pct(&medium),
        pct(&query)
    );
    if let Some(y) = year {
        path.push_str(&format!("&year={y}"));
    }
    state.client.request(Method::GET, &path, None).await
}

#[tauri::command]
async fn tmdb_detail(
    medium: String,
    id: i64,
    state: State<'_, RuntimeState>,
) -> Result<Value, String> {
    state
        .client
        .request(
            Method::GET,
            &format!("/control/tmdb/detail?medium={}&id={}", pct(&medium), id),
            None,
        )
        .await
}

/// Resolve, cache, and read a poster image. Hits TMDB only on a cache
/// miss or when the cached copy is older than `POSTER_TTL`. Returns the
/// image bytes and a content type.
async fn serve_poster(app: &AppHandle, uri_path: &str) -> Result<(Vec<u8>, String), String> {
    const POSTER_TTL: Duration = Duration::from_secs(90 * 24 * 60 * 60); // 90 days
    const ALLOWED_SIZES: &[&str] = &[
        "w92", "w154", "w185", "w342", "w500", "w780", "original",
    ];

    // uri_path looks like "/w780/abc123.jpg" → size="w780", file="abc123.jpg"
    let trimmed = uri_path.trim_start_matches('/');
    let mut parts = trimmed.splitn(2, '/');
    let size = parts.next().unwrap_or("");
    let file = parts.next().unwrap_or("");

    if !ALLOWED_SIZES.contains(&size) {
        return Err(format!("bad poster size: {size}"));
    }
    // Guard against path traversal — the file must be a bare TMDB filename.
    if file.is_empty()
        || file.contains('/')
        || file.contains("..")
        || !file
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '_' || c == '-')
    {
        return Err(format!("bad poster file: {file}"));
    }

    let content_type = if file.ends_with(".png") {
        "image/png"
    } else {
        "image/jpeg"
    };

    let cache_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("no app data dir: {e}"))?
        .join("dossier")
        .join("tmdb-cache")
        .join("posters")
        .join(size);
    let cache_path = cache_dir.join(file);

    // Serve from disk if present and fresh.
    if let Ok(meta) = std::fs::metadata(&cache_path) {
        let fresh = meta
            .modified()
            .ok()
            .and_then(|m| m.elapsed().ok())
            .map(|age| age < POSTER_TTL)
            .unwrap_or(false);
        if fresh {
            if let Ok(bytes) = std::fs::read(&cache_path) {
                return Ok((bytes, content_type.to_string()));
            }
        }
    }

    // Last resort: fetch from TMDB's public image CDN (no auth needed).
    let url = format!("https://image.tmdb.org/t/p/{size}/{file}");
    let response = Client::new()
        .get(&url)
        .timeout(Duration::from_secs(30))
        .send()
        .await
        .map_err(|e| format!("poster fetch failed: {e}"))?;
    if !response.status().is_success() {
        return Err(format!("poster fetch HTTP {}", response.status()));
    }
    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("poster body failed: {e}"))?
        .to_vec();

    create_dir_all(&cache_dir).map_err(|e| format!("poster cache mkdir failed: {e}"))?;
    write(&cache_path, &bytes).map_err(|e| format!("poster cache write failed: {e}"))?;
    Ok((bytes, content_type.to_string()))
}

#[tauri::command]
fn settings_get_start_on_login() -> Result<bool, String> {
    is_start_on_login_enabled()
}

#[tauri::command]
fn settings_set_start_on_login(enabled: bool) -> Result<bool, String> {
    set_start_on_login(enabled)
}

fn main() {
    let app = match tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .register_asynchronous_uri_scheme_protocol(
            "tmdbimg",
            |ctx: UriSchemeContext<'_, tauri::Wry>, request, responder| {
                let app = ctx.app_handle().clone();
                let path = request.uri().path().to_string();
                tauri::async_runtime::spawn(async move {
                    match serve_poster(&app, &path).await {
                        Ok((bytes, content_type)) => responder.respond(
                            HttpResponse::builder()
                                .status(200)
                                .header("Content-Type", content_type)
                                .header("Cache-Control", "public, max-age=31536000, immutable")
                                .header("Access-Control-Allow-Origin", "*")
                                .body(bytes)
                                .unwrap(),
                        ),
                        Err(error) => {
                            eprintln!("tmdbimg: {error}");
                            responder.respond(
                                HttpResponse::builder()
                                    .status(404)
                                    .body(Vec::new())
                                    .unwrap(),
                            )
                        }
                    }
                });
            },
        )
        .setup(|app| {
            let app_handle = app.handle().clone();
            let backend_client = match spawn_backend(&app_handle) {
                Ok(client) => client,
                Err(error) => {
                    eprintln!("Failed to start Dossier backend daemon: {error}");
                    let log_hint = app_handle
                        .path()
                        .app_data_dir()
                        .map(|d| d.join("backend-stderr.log").display().to_string())
                        .unwrap_or_else(|_| "the Dossier app data directory".to_string());
                    let _ = rfd::MessageDialog::new()
                        .set_title("Dossier failed to start")
                        .set_description(&format!(
                            "The Dossier backend failed to start:\n\n{error}\n\nFor details, check:\n{log_hint}"
                        ))
                        .set_level(rfd::MessageLevel::Error)
                        .show();
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
            preferences_get,
            preferences_set_rating,
            preferences_add_pairwise,
            preferences_skip,
            preferences_unskip,
            preferences_reset,
            tmdb_status,
            tmdb_set_token,
            tmdb_clear_token,
            tmdb_genres,
            tmdb_trending,
            tmdb_discover,
            tmdb_search,
            tmdb_detail,
            library_export,
            library_import,
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
