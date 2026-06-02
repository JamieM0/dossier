<script lang="ts">
  import IconArrowSquareOutRegular from "phosphor-icons-svelte/IconArrowSquareOutRegular.svelte";

  let { direction, onClose } = $props<{
    /** "to-app": shown in the web build (move web → desktop app).
     *  "from-web": shown on the app's setup screen (bring a web export in). */
    direction: "to-app" | "from-web";
    onClose: () => void;
  }>();

  const RELEASES_URL = "https://github.com/JamieM0/dossier/releases/latest";
  const DEQUARANTINE_CMD = "xattr -dr com.apple.quarantine /Applications/Dossier.app";

  let copied = $state(false);
  async function copyCmd(): Promise<void> {
    try {
      await navigator.clipboard.writeText(DEQUARANTINE_CMD);
      copied = true;
      setTimeout(() => (copied = false), 2000);
    } catch {
      copied = false;
    }
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  }

  function handleBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) onClose();
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="backdrop" onclick={handleBackdrop} role="presentation">
  <div class="modal" role="dialog" aria-modal="true" aria-labelledby="migrate-title">
    <h2 id="migrate-title" class="title">
      {direction === "to-app" ? "Move to the desktop app" : "Bring in a web library"}
    </h2>
    <p class="lead">
      {#if direction === "to-app"}
        The desktop app stores your encryption key in the macOS Keychain instead of
        a passphrase, and runs without a browser. Your web and app libraries are
        separate — move yours across with an encrypted export file.
      {:else}
        Already used Dossier in the browser? Bring that library across. The two
        libraries are separate; this imports a one-off encrypted export of your
        web data.
      {/if}
    </p>

    <ol class="steps">
      {#if direction === "to-app"}
        <li>
          <a href={RELEASES_URL} target="_blank" rel="noreferrer">
            Download Dossier for macOS <IconArrowSquareOutRegular class="icon-12" />
          </a>
          and drag it to your Applications folder.
        </li>
        <li>
          Because the app isn't notarized yet, clear the quarantine flag once in
          Terminal:
          <div class="cmd">
            <code>{DEQUARANTINE_CMD}</code>
            <button class="copy" onclick={() => void copyCmd()}>{copied ? "Copied" : "Copy"}</button>
          </div>
        </li>
        <li>Back here, choose <strong>Export library</strong> and set a passphrase.</li>
        <li>Open the app and choose <strong>Import library</strong> (or “Migrate from web app” on first launch), then pick that file and enter the same passphrase.</li>
      {:else}
        <li>In the web app, open <strong>Settings → Library</strong> and choose <strong>Export library</strong>, setting a passphrase.</li>
        <li>Save the <code>.dossier</code> file somewhere you can reach it from this Mac.</li>
        <li>Choose <strong>Import library</strong> below and pick that file.</li>
        <li>Enter the same passphrase you set during export.</li>
      {/if}
    </ol>

    {#if direction === "to-app"}
      <p class="note">
        Don't have the web build yet? It ships as a zip alongside each release on the
        <a href={RELEASES_URL} target="_blank" rel="noreferrer">releases page</a>.
      </p>
    {/if}

    <div class="actions">
      <button class="btn-primary" onclick={onClose}>Got it</button>
    </div>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    display: grid;
    place-items: center;
    background: color-mix(in srgb, var(--text-primary) 30%, transparent);
    backdrop-filter: var(--blur-backdrop);
    -webkit-backdrop-filter: var(--blur-backdrop);
    z-index: 100;
    animation: backdrop-enter var(--duration-spring) var(--ease-out);
  }
  @keyframes backdrop-enter { from { opacity: 0; } to { opacity: 1; } }
  .modal {
    max-width: 540px;
    width: calc(100% - var(--space-8));
    max-height: calc(100vh - var(--space-8));
    overflow-y: auto;
    background: var(--base);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: var(--space-8);
    box-shadow: var(--shadow-xl);
    animation: modal-enter var(--duration-spring) var(--ease-spring);
  }
  @keyframes modal-enter { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
  .title { font-family: var(--font-display); font-size: 1.25rem; font-weight: 600; color: var(--text-primary); margin-bottom: var(--space-3); }
  .lead { font-family: var(--font-body); font-size: 0.9375rem; line-height: 1.6; color: var(--text-secondary); margin-bottom: var(--space-5); }
  .steps { margin: 0 0 var(--space-5); padding-left: var(--space-5); list-style: decimal; color: var(--text-secondary); font-size: 0.9rem; line-height: 1.6; }
  .steps li { margin-bottom: var(--space-3); padding-left: var(--space-1); }
  .steps li::marker { color: var(--text-tertiary); font-weight: 600; }
  .steps li:last-child { margin-bottom: 0; }
  .steps a { color: var(--primary-accent); text-decoration: none; display: inline-flex; align-items: center; gap: 4px; }
  .steps a:hover { text-decoration: underline; }
  .cmd { display: flex; align-items: center; gap: var(--space-2); margin-top: var(--space-2); background: var(--base-tertiary); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: var(--space-2) var(--space-3); }
  .cmd code { font-family: var(--font-mono, monospace); font-size: 0.78rem; color: var(--text-primary); overflow-x: auto; white-space: nowrap; flex: 1; }
  .copy { flex-shrink: 0; background: var(--base); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 2px 8px; font-size: 0.75rem; color: var(--text-secondary); cursor: pointer; }
  .copy:hover { color: var(--text-primary); }
  .note { font-size: 0.82rem; line-height: 1.5; color: var(--text-tertiary); margin: 0 0 var(--space-5); }
  .note a { color: var(--primary-accent); text-decoration: none; }
  .actions { display: flex; justify-content: flex-end; }
  .btn-primary { min-height: 40px; min-width: 80px; padding: var(--space-2) var(--space-4); border-radius: var(--radius-sm); border: 0; background: var(--primary-accent); color: var(--primary-accent-text, #fff); font-size: 0.9375rem; font-weight: 600; cursor: pointer; }
  .btn-primary:hover { background: var(--primary-accent-hover, var(--primary-accent)); }
</style>
