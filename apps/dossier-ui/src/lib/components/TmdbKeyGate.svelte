<script lang="ts">
  import { tmdbState } from "$lib/state/tmdb.svelte";
  import { preferences } from "$lib/state/preferences.svelte";
  import IconKeyRegular from "phosphor-icons-svelte/IconKeyRegular.svelte";
  import IconArrowSquareOutRegular from "phosphor-icons-svelte/IconArrowSquareOutRegular.svelte";
  import PromptDialog from "$lib/components/PromptDialog.svelte";
  import MigrationStepsModal from "$lib/components/MigrationStepsModal.svelte";
  import { pickTextFile } from "$lib/desktop/file-transfer";

  let token = $state("");

  // Only the installed desktop app offers "migrate from the web app".
  const isApp = typeof window !== "undefined" && window.dossier?.platform === "app";

  let migrateModalOpen = $state(false);
  let importPromptOpen = $state(false);
  let pendingImportContent = $state<string | null>(null);
  let migrateStatus = $state("");
  let migrateError = $state("");
  let migrateBusy = $state(false);

  async function submit(e: Event): Promise<void> {
    e.preventDefault();
    if (!token.trim() || tmdbState.busy) return;
    await tmdbState.setToken(token);
    if (tmdbState.configured) token = "";
  }

  async function startMigrationImport(): Promise<void> {
    migrateError = "";
    migrateStatus = "";
    const picked = await pickTextFile();
    if (!picked) return;
    pendingImportContent = picked.content;
    importPromptOpen = true;
  }

  async function runMigrationImport(passphrase: string): Promise<void> {
    importPromptOpen = false;
    if (pendingImportContent === null) return;
    migrateBusy = true;
    try {
      await window.dossier!.library.import(pendingImportContent, passphrase);
      await preferences.hydrate();
      migrateStatus = "Library imported. Add your TMDB token above to start browsing.";
    } catch (error) {
      migrateError = error instanceof Error ? error.message : String(error);
    } finally {
      pendingImportContent = null;
      migrateBusy = false;
    }
  }
</script>

<div class="gate">
  <div class="card">
    <div class="icon"><IconKeyRegular class="icon-24" /></div>
    <h1>Connect your TMDB account</h1>
    <p class="lead">
      Dossier streams its film &amp; TV catalogue from
      <strong>The Movie Database</strong>. It's free — create an account, then
      paste your <strong>API Read Access Token (v4)</strong> below. Your token is
      stored only in your OS keychain and never leaves this device except to call
      TMDB.
    </p>

    <ol class="steps">
      <li>
        Open
        <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noreferrer">
          TMDB → Settings → API <IconArrowSquareOutRegular class="icon-12" />
        </a>
      </li>
      <li>Copy the <em>API Read Access Token</em> (the long one, not the short API key)</li>
      <li>Paste it here</li>
    </ol>

    <form onsubmit={submit}>
      <textarea
        bind:value={token}
        placeholder="eyJhbGciOiJIUzI1NiJ9…"
        rows="3"
        spellcheck="false"
        autocomplete="off"
        disabled={tmdbState.busy}
      ></textarea>
      {#if tmdbState.error}
        <p class="error">{tmdbState.error}</p>
      {/if}
      <button type="submit" disabled={!token.trim() || tmdbState.busy}>
        {tmdbState.busy ? "Validating…" : "Connect"}
      </button>
    </form>

    {#if isApp}
      <div class="migrate">
        <span class="migrate-q">Already use Dossier in your browser?</span>
        <div class="migrate-actions">
          <button class="migrate-import" onclick={() => void startMigrationImport()} disabled={migrateBusy}>
            {migrateBusy ? "Importing…" : "Migrate from web app"}
          </button>
          <button class="migrate-how" onclick={() => (migrateModalOpen = true)}>How?</button>
        </div>
        {#if migrateError}<p class="error">{migrateError}</p>{/if}
        {#if migrateStatus}<p class="ok">{migrateStatus}</p>{/if}
      </div>
    {/if}
  </div>
</div>

{#if importPromptOpen}
  <PromptDialog
    title="Enter the export passphrase"
    message="The passphrase you set when exporting your library from the web app."
    placeholder="Passphrase"
    confirmLabel="Import"
    onConfirm={(value) => void runMigrationImport(value)}
    onCancel={() => { importPromptOpen = false; pendingImportContent = null; }}
  />
{/if}

{#if migrateModalOpen}
  <MigrationStepsModal direction="from-web" onClose={() => (migrateModalOpen = false)} />
{/if}

<style>
  .gate {
    height: 100vh;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-6);
    background: var(--base);
  }
  .card {
    max-width: 520px;
    width: 100%;
    background: var(--base-secondary);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-lg);
    padding: var(--space-6);
    box-shadow: var(--shadow-lg);
  }
  .icon {
    width: 48px;
    height: 48px;
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--accent) 16%, var(--base-tertiary));
    color: var(--accent);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: var(--space-4);
  }
  h1 {
    font-family: var(--font-display);
    font-size: 1.5rem;
    margin: 0 0 var(--space-3);
    color: var(--text-primary);
  }
  .lead {
    color: var(--text-secondary);
    line-height: 1.6;
    margin: 0 0 var(--space-4);
    font-size: 0.95rem;
  }
  .steps {
    margin: 0 0 var(--space-4);
    padding-left: var(--space-5);
    color: var(--text-secondary);
    font-size: 0.9rem;
    line-height: 1.8;
  }
  .steps a {
    color: var(--accent);
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .steps a:hover { text-decoration: underline; }
  form { display: flex; flex-direction: column; gap: var(--space-3); }
  textarea {
    width: 100%;
    resize: vertical;
    font-family: var(--font-mono, monospace);
    font-size: 0.8rem;
    padding: var(--space-3);
    border-radius: var(--radius-md);
    border: 1px solid var(--border-subtle);
    background: var(--base);
    color: var(--text-primary);
    box-sizing: border-box;
  }
  textarea:focus { outline: none; border-color: var(--accent); }
  button {
    align-self: flex-start;
    padding: var(--space-2) var(--space-5);
    border-radius: var(--radius-md);
    border: 0;
    background: var(--accent);
    color: var(--accent-contrast, #fff);
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
  }
  button:disabled { opacity: 0.5; cursor: default; }
  .error { color: var(--danger, #f85149); font-size: 0.85rem; margin: var(--space-2) 0 0; }
  .ok { color: var(--success, #2ea043); font-size: 0.85rem; margin: var(--space-2) 0 0; }
  .migrate {
    margin-top: var(--space-5);
    padding-top: var(--space-4);
    border-top: 1px solid var(--border-subtle);
  }
  .migrate-q { display: block; font-size: 0.85rem; color: var(--text-tertiary); margin-bottom: var(--space-2); }
  .migrate-actions { display: flex; align-items: center; gap: var(--space-3); }
  .migrate-import {
    align-self: auto;
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius-md);
    border: 1px solid var(--border-subtle);
    background: var(--base-tertiary);
    color: var(--text-primary);
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
  }
  .migrate-import:hover { background: var(--base); }
  .migrate-how {
    background: none;
    border: none;
    color: var(--accent);
    font-size: 0.85rem;
    cursor: pointer;
    padding: 0;
  }
  .migrate-how:hover { text-decoration: underline; }
</style>
