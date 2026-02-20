<script lang="ts">
  import { THEMES } from "$lib/design/themes";
  import type { ThemeName } from "$lib/design/themes";
  import { uiSettings } from "$lib/state/ui-settings.svelte";

  let exportStatus = $state("");

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

  async function toggleHighFidelity(): Promise<void> {
    uiSettings.highFidelityEnabled = !uiSettings.highFidelityEnabled;
    await uiSettings.persist();
  }

  async function toggleStartup(): Promise<void> {
    uiSettings.startOnLogin = !uiSettings.startOnLogin;
    await uiSettings.persist();
  }

  async function exportEncrypted(): Promise<void> {
    const passphrase = window.prompt("Enter an export passphrase");
    if (!passphrase) return;
    const artifact = await window.dossier?.data.exportEncrypted(passphrase);
    exportStatus = artifact
      ? "Encrypted export created in memory for this session."
      : "Export unavailable.";
  }

  async function importEncrypted(): Promise<void> {
    const passphrase = window.prompt("Enter the import passphrase");
    const raw = window.prompt("Paste the encrypted artifact JSON");
    if (!passphrase || !raw) return;
    await window.dossier?.data.importEncrypted(JSON.parse(raw) as unknown, passphrase);
    exportStatus = "Encrypted import applied.";
  }
</script>

<section class="settings-view">
  <div class="settings-content">
    <h1 class="page-heading">Settings</h1>

    <div class="settings-sections">
      <!-- Appearance -->
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
                <div class="sw-bar">
                  <span class="sw-dots"><i></i><i></i><i></i></span>
                  <span class="sw-mode">
                    {#if theme.mode === 'light'}
                      <svg viewBox="0 0 12 12" fill="none" aria-hidden="true">
                        <circle cx="6" cy="6" r="2.2" fill="currentColor"/>
                        <line x1="6" y1="0.5" x2="6" y2="2.2" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>
                        <line x1="6" y1="9.8" x2="6" y2="11.5" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>
                        <line x1="0.5" y1="6" x2="2.2" y2="6" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>
                        <line x1="9.8" y1="6" x2="11.5" y2="6" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>
                        <line x1="2.05" y1="2.05" x2="3.27" y2="3.27" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>
                        <line x1="8.73" y1="8.73" x2="9.95" y2="9.95" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>
                        <line x1="9.95" y1="2.05" x2="8.73" y2="3.27" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>
                        <line x1="3.27" y1="8.73" x2="2.05" y2="9.95" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>
                      </svg>
                    {:else}
                      <svg viewBox="0 0 12 12" fill="none" aria-hidden="true">
                        <path d="M10.2 7C9.3 8.1 8 8.8 6.5 8.8C4 8.8 2 6.8 2 4.3C2 2.9 2.6 1.6 3.6 0.8C1.6 1.6 0.2 3.6 0.2 5.9C0.2 9 2.7 11.5 5.8 11.5C8.2 11.5 10.2 10 11 7.9C10.8 7.6 10.5 7.3 10.2 7Z" fill="currentColor"/>
                      </svg>
                    {/if}
                  </span>
                </div>
                <div class="sw-content">
                  <span class="sw-line l1"></span>
                  <span class="sw-line l2"></span>
                </div>
                <div class="sw-footer"></div>
                {#if uiSettings.theme === theme.name}
                  <div class="sw-check-badge">
                    <svg viewBox="0 0 10 10" fill="none" aria-hidden="true">
                      <path d="M2 5.2L4.2 7.5L8.2 2.8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </div>
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

      <!-- Privacy & Security -->
      <section class="settings-section">
        <h2 class="section-heading">Privacy & Security</h2>

        <div class="setting-group">
          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-label" id="hifi-label">High-fidelity mode</span>
              <span class="setting-desc">Retain raw artifacts for richer analysis</span>
            </div>
            <button
              class="toggle"
              class:active={uiSettings.highFidelityEnabled}
              onclick={() => void toggleHighFidelity()}
              role="switch"
              aria-checked={uiSettings.highFidelityEnabled}
              aria-labelledby="hifi-label"
            >
              <span class="toggle-thumb"></span>
            </button>
          </div>
        </div>

        <div class="setting-group">
          <div class="action-buttons">
            <button class="btn-secondary" onclick={() => void exportEncrypted()}>
              Export profile (encrypted)
            </button>
            <button class="btn-secondary" onclick={() => void importEncrypted()}>
              Import encrypted profile
            </button>
            <button class="btn-danger">Delete profile data</button>
          </div>
          {#if exportStatus}
            <p class="status-text">{exportStatus}</p>
          {/if}
        </div>
      </section>

      <!-- System -->
      <section class="settings-section">
        <h2 class="section-heading">System</h2>

        <div class="setting-group">
          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-label" id="startup-label">Start on login</span>
              <span class="setting-desc">Launch Dossier when you log in to your computer</span>
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
      </section>
    </div>
  </div>
</section>

<style>
  .settings-view {
    min-height: 100vh;
    background: var(--base);
  }

  .settings-content {
    max-width: var(--content-max-width);
    margin: 0 auto;
    padding: var(--space-10) var(--space-8) var(--space-16);
  }

  .page-heading {
    font-family: var(--font-display);
    font-size: 1.5rem;
    font-weight: 600;
    line-height: 1.3;
    letter-spacing: -0.01em;
    color: var(--text-primary);
    margin-bottom: var(--space-8);
  }

  .settings-sections {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .settings-section {
    padding: var(--space-8) 0;
    border-bottom: 1px solid var(--border-subtle);
  }

  .settings-section:first-child {
    padding-top: 0;
  }

  .settings-section:last-child {
    border-bottom: none;
  }

  .section-heading {
    font-family: var(--font-display);
    font-size: 1.25rem;
    font-weight: 600;
    line-height: 1.3;
    color: var(--text-primary);
    margin-bottom: var(--space-6);
  }

  .setting-group {
    margin-bottom: var(--space-5);
  }

  .setting-group:last-child {
    margin-bottom: 0;
  }

  .setting-label {
    display: block;
    font-family: var(--font-body);
    font-size: 0.9375rem;
    font-weight: 500;
    line-height: 1.5;
    color: var(--text-primary);
    margin-bottom: var(--space-3);
  }

  .setting-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
  }

  .setting-row .setting-label {
    margin-bottom: 0;
  }

  .setting-info {
    display: flex;
    flex-direction: column;
  }

  .setting-desc {
    font-family: var(--font-body);
    font-size: 0.8125rem;
    line-height: 1.4;
    color: var(--text-tertiary);
    margin-top: var(--space-1);
  }

  .theme-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(56px, 1fr));
    gap: var(--space-2);
  }

  .theme-swatch {
    aspect-ratio: 6 / 5;
    border-radius: 8px;
    background: var(--sw-base);
    border: 1px solid var(--sw-border-color);
    overflow: visible;
    position: relative;
    display: flex;
    flex-direction: column;
    padding: 0;
    cursor: pointer;
    transition:
      transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1),
      box-shadow 0.2s ease;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
  }

  .theme-swatch:hover {
    transform: translateY(-2px) scale(1.07);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.13), 0 2px 4px rgba(0, 0, 0, 0.07);
    z-index: 1;
  }

  .theme-swatch.active {
    outline: 2.5px solid var(--sw-primary);
    outline-offset: 3px;
  }

  /* Swatch header bar */
  .sw-bar {
    background: var(--sw-base2);
    height: 28%;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 5px;
    border-bottom: 1px solid color-mix(in srgb, var(--sw-border-color) 70%, transparent);
    border-radius: 7px 7px 0 0;
  }

  .sw-dots {
    display: flex;
    gap: 2px;
    align-items: center;
  }

  .sw-dots i {
    display: block;
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background: var(--sw-primary);
    opacity: 0.45;
  }

  .sw-mode {
    width: 10px;
    height: 10px;
    color: var(--sw-primary);
    opacity: 0.55;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .sw-mode svg {
    width: 10px;
    height: 10px;
  }

  /* Swatch content area */
  .sw-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 0 6px;
    gap: 3px;
    background: var(--sw-base);
  }

  .sw-line {
    display: block;
    height: 2px;
    border-radius: 2px;
    background: var(--sw-primary);
  }

  .sw-line.l1 {
    width: 72%;
    opacity: 0.3;
  }

  .sw-line.l2 {
    width: 50%;
    opacity: 0.2;
  }

  /* Swatch footer accent strip */
  .sw-footer {
    height: 22%;
    flex-shrink: 0;
    background: var(--sw-secondary);
    border-radius: 0 0 7px 7px;
  }

  /* Active checkmark badge */
  .sw-check-badge {
    position: absolute;
    top: -6px;
    right: -6px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--sw-primary);
    color: var(--sw-base);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
    z-index: 2;
  }

  .sw-check-badge svg {
    width: 10px;
    height: 10px;
  }

  /* Toggle switch */
  .toggle {
    width: 44px;
    height: 24px;
    border-radius: var(--radius-full);
    background: var(--border);
    position: relative;
    flex-shrink: 0;
    padding: 2px;
    transition: background-color var(--duration-standard) var(--ease-out);
  }

  .toggle.active {
    background: var(--primary-accent);
  }

  .toggle-thumb {
    display: block;
    width: 20px;
    height: 20px;
    border-radius: var(--radius-full);
    background: white;
    box-shadow: var(--shadow-sm);
    transition: transform var(--duration-standard) var(--ease-out);
  }

  .toggle.active .toggle-thumb {
    transform: translateX(20px);
  }

  .action-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
  }

  .btn-secondary {
    min-height: 40px;
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text-primary);
    font-family: var(--font-body);
    font-size: 0.9375rem;
    font-weight: 500;
    border: 1px solid var(--border);
    transition: background-color var(--duration-standard) var(--ease-out);
  }

  .btn-secondary:hover {
    background: var(--base-tertiary);
  }

  .btn-danger {
    min-height: 40px;
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius-sm);
    background: var(--error);
    color: #ffffff;
    font-family: var(--font-body);
    font-size: 0.9375rem;
    font-weight: 600;
    transition: background-color var(--duration-standard) var(--ease-out);
  }

  .btn-danger:hover {
    background: color-mix(in srgb, var(--error) 85%, #000);
  }

  .status-text {
    margin-top: var(--space-3);
    font-family: var(--font-body);
    font-size: 0.8125rem;
    line-height: 1.4;
    color: var(--text-secondary);
  }
</style>
