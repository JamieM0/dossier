<script lang="ts">
  import { onMount } from "svelte";
  import { THEMES } from "$lib/design/themes";
  import type { ThemeName } from "$lib/design/themes";
  import { uiSettings } from "$lib/state/ui-settings.svelte";
  import { tmdbState } from "$lib/state/tmdb.svelte";
  import { preferences } from "$lib/state/preferences.svelte";
  import PromptDialog from "$lib/components/PromptDialog.svelte";
  import MigrationStepsModal from "$lib/components/MigrationStepsModal.svelte";
  import { downloadTextFile, pickTextFile, defaultExportFilename } from "$lib/desktop/file-transfer";

  let tmdbToken = $state("");
  let tmdbStatus = $state("");

  const isWeb = typeof window !== "undefined" && window.dossier?.platform === "web";

  // --- Library export / import -------------------------------------------
  let libraryStatus = $state("");
  let libraryError = $state("");
  let libraryBusy = $state(false);
  let exportPromptOpen = $state(false);
  let importPromptOpen = $state(false);
  let pendingImportContent = $state<string | null>(null);
  let migrateModalOpen = $state(false);

  function setLibraryStatus(msg: string): void {
    libraryStatus = msg;
    libraryError = "";
    setTimeout(() => { if (libraryStatus === msg) libraryStatus = ""; }, 6000);
  }

  async function runExport(passphrase: string): Promise<void> {
    exportPromptOpen = false;
    libraryError = "";
    libraryBusy = true;
    try {
      const file = await window.dossier!.library.export(passphrase);
      downloadTextFile(defaultExportFilename(), file);
      setLibraryStatus("Library exported. Keep the file and passphrase safe — you'll need both to import.");
    } catch (error) {
      libraryError = errorToMessage(error);
    } finally {
      libraryBusy = false;
    }
  }

  async function startImport(): Promise<void> {
    libraryError = "";
    const picked = await pickTextFile();
    if (!picked) return;
    pendingImportContent = picked.content;
    importPromptOpen = true;
  }

  async function runImport(passphrase: string): Promise<void> {
    importPromptOpen = false;
    if (pendingImportContent === null) return;
    libraryBusy = true;
    try {
      await window.dossier!.library.import(pendingImportContent, passphrase);
      // Rehydrate everything the imported library may have changed.
      await Promise.all([
        preferences.hydrate(),
        tmdbState.refresh(),
        uiSettings.hydrateFromDesktop()
      ]);
      setLibraryStatus("Library imported. Your ratings and watchlist are now in place.");
    } catch (error) {
      libraryError = errorToMessage(error);
    } finally {
      pendingImportContent = null;
      libraryBusy = false;
    }
  }

  onMount(() => {
    void tmdbState.refresh();
  });

  async function saveTmdbToken(): Promise<void> {
    if (!tmdbToken.trim()) return;
    const ok = await tmdbState.setToken(tmdbToken);
    if (ok) {
      tmdbToken = "";
      tmdbStatus = "TMDB token updated.";
      setTimeout(() => { tmdbStatus = ""; }, 4000);
    }
  }

  async function disconnectTmdb(): Promise<void> {
    await tmdbState.clearToken();
    tmdbStatus = "Disconnected. Restart-free — you'll be asked for a token next.";
  }

  let lifecycleStatus = $state("");
  let lifecycleStatusTimer = $state<ReturnType<typeof setTimeout> | null>(null);

  function setLifecycleStatus(msg: string): void {
    lifecycleStatus = msg;
    if (lifecycleStatusTimer) clearTimeout(lifecycleStatusTimer);
    lifecycleStatusTimer = setTimeout(() => { lifecycleStatus = ""; }, 5000);
  }

  function errorToMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    return String(error);
  }

  async function setTheme(name: ThemeName): Promise<void> {
    uiSettings.theme = name;
    uiSettings.applyTheme();
    await uiSettings.persist();
  }

  async function toggleDyslexia(): Promise<void> {
    uiSettings.dyslexiaMode = !uiSettings.dyslexiaMode;
    uiSettings.applyBodyMode();
    await uiSettings.persist();
  }

  async function toggleStartup(): Promise<void> {
    const target = !uiSettings.startOnLogin;
    try {
      const enabled = await window.dossier?.settings.setStartOnLogin(target);
      uiSettings.startOnLogin = Boolean(enabled);
      await uiSettings.persist();
      setLifecycleStatus(enabled
        ? "Start on login is enabled at the OS level."
        : "Start on login is disabled at the OS level.");
    } catch (error) {
      setLifecycleStatus(errorToMessage(error));
    }
  }

  async function toggleAutoUpdates(): Promise<void> {
    uiSettings.autoUpdatesEnabled = !uiSettings.autoUpdatesEnabled;
    try {
      await uiSettings.persist();
      setLifecycleStatus(uiSettings.autoUpdatesEnabled
        ? "Automatic updates enabled. Dossier will check GitHub Releases on launch."
        : "Automatic updates disabled. Dossier will not check for updates on launch.");
    } catch (error) {
      setLifecycleStatus(errorToMessage(error));
    }
  }
</script>

<section class="settings-view">
  <div class="settings-content">
    <h1 class="page-heading">Settings</h1>

    {#if lifecycleStatus}
      <p class="lifecycle-status" aria-live="polite">{lifecycleStatus}</p>
    {/if}

    <div class="settings-sections">
      <section class="settings-section">
        <h2 class="section-heading">Appearance</h2>

        <div class="setting-group">
          <span class="setting-label">Theme</span>
          <div class="theme-grid">
            {#each THEMES as theme}
              <button
                class="theme-swatch"
                class:active={uiSettings.theme === theme.name}
                onclick={() => void setTheme(theme.name)}
                aria-label="Use {theme.name} theme"
                title={theme.name}
                style="
                  --sw-base: {theme.base};
                  --sw-base2: {theme['base-secondary']};
                  --sw-primary: {theme['primary-accent']};
                  --sw-secondary: {theme['secondary-accent']};
                  --sw-border-color: {theme.border};
                "
              >
                <div class="sw-bar"><span class="sw-dots"><i></i><i></i><i></i></span></div>
                <div class="sw-content">
                  <span class="sw-line l1"></span>
                  <span class="sw-line l2"></span>
                </div>
                <div class="sw-footer"></div>
                {#if uiSettings.theme === theme.name}
                  <div class="sw-check-badge"></div>
                {/if}
              </button>
            {/each}
          </div>
        </div>

        <div class="setting-group">
          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-label" id="dyslexia-label">Dyslexia-friendly font</span>
              <span class="setting-desc">Replace default fonts with OpenDyslexic</span>
            </div>
            <button
              class="toggle"
              class:active={uiSettings.dyslexiaMode}
              onclick={() => void toggleDyslexia()}
              role="switch"
              aria-checked={uiSettings.dyslexiaMode}
              aria-labelledby="dyslexia-label"
            >
              <span class="toggle-thumb"></span>
            </button>
          </div>
        </div>
      </section>

      <section class="settings-section">
        <h2 class="section-heading">System</h2>

        <div class="setting-group">
          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-label" id="startup-label">Start on login</span>
              <span class="setting-desc">Launch Dossier automatically after OS sign-in</span>
            </div>
            <button
              class="toggle"
              class:active={uiSettings.startOnLogin}
              onclick={() => void toggleStartup()}
              role="switch"
              aria-checked={uiSettings.startOnLogin}
              aria-labelledby="startup-label"
            >
              <span class="toggle-thumb"></span>
            </button>
          </div>
        </div>

        <div class="setting-group">
          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-label" id="updates-label">Automatic updates</span>
              <span class="setting-desc">Check GitHub Releases and self-update on launch</span>
            </div>
            <button
              class="toggle"
              class:active={uiSettings.autoUpdatesEnabled}
              onclick={() => void toggleAutoUpdates()}
              role="switch"
              aria-checked={uiSettings.autoUpdatesEnabled}
              aria-labelledby="updates-label"
            >
              <span class="toggle-thumb"></span>
            </button>
          </div>
        </div>
      </section>

      <section class="settings-section">
        <h2 class="section-heading">TMDB</h2>
        <div class="setting-group">
          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-label">Connection</span>
              <span class="setting-desc">
                {#if tmdbState.configured}
                  Connected — your catalogue streams from The Movie Database.
                {:else}
                  Not connected. Add your API Read Access Token to use Dossier.
                {/if}
              </span>
            </div>
            {#if tmdbState.configured}
              <button class="text-btn danger" onclick={() => void disconnectTmdb()}>Disconnect</button>
            {/if}
          </div>
        </div>
        <div class="setting-group">
          <label class="setting-label" for="tmdb-token-input">
            {tmdbState.configured ? "Replace token" : "API Read Access Token (v4)"}
          </label>
          <textarea
            id="tmdb-token-input"
            class="token-input"
            bind:value={tmdbToken}
            rows="2"
            spellcheck="false"
            autocomplete="off"
            placeholder="eyJhbGciOiJIUzI1NiJ9…"
            disabled={tmdbState.busy}
          ></textarea>
          {#if tmdbState.error}<p class="field-error">{tmdbState.error}</p>{/if}
          {#if tmdbStatus}<p class="field-ok">{tmdbStatus}</p>{/if}
          <button
            class="primary-btn"
            disabled={!tmdbToken.trim() || tmdbState.busy}
            onclick={() => void saveTmdbToken()}
          >
            {tmdbState.busy ? "Validating…" : "Save token"}
          </button>
        </div>
      </section>

      <section class="settings-section">
        <h2 class="section-heading">Library</h2>
        <div class="setting-group">
          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-label">Export &amp; import</span>
              <span class="setting-desc">
                Move your ratings, watchlist, and refinement history between the web
                version and the desktop app with an encrypted <code>.dossier</code> file.
                You set a passphrase on export and re-enter it to import.
              </span>
            </div>
          </div>
          {#if libraryError}<p class="field-error">{libraryError}</p>{/if}
          {#if libraryStatus}<p class="field-ok">{libraryStatus}</p>{/if}
          <div class="button-row">
            <button class="primary-btn" disabled={libraryBusy} onclick={() => (exportPromptOpen = true)}>
              {libraryBusy ? "Working…" : "Export library"}
            </button>
            <button class="text-btn" disabled={libraryBusy} onclick={() => void startImport()}>
              Import library
            </button>
          </div>
        </div>

        {#if isWeb}
          <div class="setting-group">
            <div class="setting-row">
              <div class="setting-info">
                <span class="setting-label">Move to the desktop app</span>
                <span class="setting-desc">
                  Prefer OS-secured credentials and no browser? See how to move your
                  library to the installed app.
                </span>
              </div>
              <button class="text-btn" onclick={() => (migrateModalOpen = true)}>Migrate to app</button>
            </div>
          </div>
        {/if}
      </section>
    </div>
  </div>
</section>

{#if exportPromptOpen}
  <PromptDialog
    title="Set an export passphrase"
    message="This passphrase encrypts the exported file. You'll need it to import — there's no recovery if you lose it."
    placeholder="Passphrase"
    confirmLabel="Export"
    onConfirm={(value) => void runExport(value)}
    onCancel={() => (exportPromptOpen = false)}
  />
{/if}

{#if importPromptOpen}
  <PromptDialog
    title="Enter the import passphrase"
    message="The passphrase that was set when this file was exported."
    placeholder="Passphrase"
    confirmLabel="Import"
    onConfirm={(value) => void runImport(value)}
    onCancel={() => { importPromptOpen = false; pendingImportContent = null; }}
  />
{/if}

{#if migrateModalOpen}
  <MigrationStepsModal direction="to-app" onClose={() => (migrateModalOpen = false)} />
{/if}

<style>
  .settings-view { min-height: 100vh; background: var(--base); }
  .settings-content { max-width: var(--content-max-width); margin: 0 auto; padding: var(--space-10) var(--space-8) var(--space-16); }
  .page-heading { font-family: var(--font-display); font-size: 1.5rem; font-weight: 600; line-height: 1.3; letter-spacing: -0.01em; color: var(--text-primary); margin-bottom: var(--space-8); }
  .lifecycle-status { font-family: var(--font-body); font-size: 0.9rem; line-height: 1.5; padding: var(--space-3) var(--space-4); border-radius: var(--radius-sm); background: var(--info-subtle); color: var(--info); margin-bottom: var(--space-6); }
  .settings-sections { display: flex; flex-direction: column; }
  .settings-section { padding: var(--space-8) 0; border-bottom: 1px solid var(--border-subtle); }
  .settings-section:last-child { border-bottom: none; }
  .section-heading { font-family: var(--font-display); font-size: 1.25rem; font-weight: 600; line-height: 1.3; color: var(--text-primary); margin-bottom: var(--space-6); }
  .setting-group { margin-bottom: var(--space-5); }
  .setting-label { display: block; font-family: var(--font-body); font-size: 0.9375rem; font-weight: 500; line-height: 1.5; color: var(--text-primary); margin-bottom: var(--space-3); }
  .setting-row { display: flex; align-items: center; justify-content: space-between; gap: var(--space-4); }
  .setting-row .setting-label { margin-bottom: 0; }
  .setting-info { display: flex; flex-direction: column; }
  .setting-desc { font-family: var(--font-body); font-size: 0.8125rem; line-height: 1.4; color: var(--text-tertiary); margin-top: var(--space-1); }
  .theme-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(56px, 1fr)); gap: var(--space-2); }
  .theme-swatch { aspect-ratio: 6 / 5; border-radius: 8px; background: var(--sw-base); border: 1px solid var(--sw-border-color); position: relative; display: flex; flex-direction: column; padding: 0; cursor: pointer; }
  .theme-swatch.active { outline: 2px solid var(--sw-primary); outline-offset: 3px; }
  .sw-bar { background: var(--sw-base2); height: 28%; border-bottom: 1px solid color-mix(in srgb, var(--sw-border-color) 70%, transparent); border-radius: 7px 7px 0 0; padding: 0 5px; display: flex; align-items: center; }
  .sw-dots { display: flex; gap: 2px; }
  .sw-dots i { display: block; width: 3px; height: 3px; border-radius: 50%; background: var(--sw-primary); opacity: 0.45; }
  .sw-content { flex: 1; padding: 0 6px; display: flex; flex-direction: column; justify-content: center; gap: 3px; }
  .sw-line { display: block; height: 2px; border-radius: 2px; background: var(--sw-primary); }
  .sw-line.l1 { width: 72%; opacity: 0.3; }
  .sw-line.l2 { width: 50%; opacity: 0.2; }
  .sw-footer { height: 22%; background: var(--sw-secondary); border-radius: 0 0 7px 7px; }
  .sw-check-badge { position: absolute; top: -6px; right: -6px; width: 16px; height: 16px; border-radius: 50%; background: var(--sw-primary); }
  .token-input { width: 100%; box-sizing: border-box; resize: vertical; font-family: var(--font-mono, monospace); font-size: 0.8rem; padding: var(--space-3); border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); background: var(--base-tertiary); color: var(--text-primary); margin-bottom: var(--space-3); }
  .token-input:focus { outline: none; border-color: var(--primary-accent); background: var(--base); }
  .primary-btn { padding: var(--space-2) var(--space-4); border-radius: var(--radius-sm); border: 0; background: var(--primary-accent); color: #fff; font-size: 0.875rem; font-weight: 600; cursor: pointer; }
  .primary-btn:disabled { opacity: 0.5; cursor: default; }
  .button-row { display: flex; gap: var(--space-3); align-items: center; flex-wrap: wrap; }
  .setting-desc code { font-family: var(--font-mono, monospace); font-size: 0.78rem; background: var(--base-tertiary); padding: 0 4px; border-radius: 3px; }
  .text-btn { background: none; border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: var(--space-2) var(--space-3); font-size: 0.85rem; color: var(--text-secondary); cursor: pointer; }
  .text-btn:disabled { opacity: 0.5; cursor: default; }
  .text-btn.danger:hover { color: var(--danger, #f85149); border-color: color-mix(in srgb, var(--danger, #f85149) 40%, var(--border-subtle)); }
  .field-error { color: var(--danger, #f85149); font-size: 0.8rem; margin: 0 0 var(--space-2); }
  .field-ok { color: var(--success, #2ea043); font-size: 0.8rem; margin: 0 0 var(--space-2); }
  .toggle { width: 44px; height: 24px; border-radius: var(--radius-full); background: var(--border); position: relative; padding: 2px; flex-shrink: 0; }
  .toggle.active { background: var(--primary-accent); }
  .toggle-thumb { display: block; width: 20px; height: 20px; border-radius: var(--radius-full); background: #fff; box-shadow: var(--shadow-sm); transition: transform var(--duration-standard) var(--ease-out); }
  .toggle.active .toggle-thumb { transform: translateX(20px); }
</style>
