<script lang="ts">
  import { onMount } from "svelte";
  import IconLockKeyRegular from "phosphor-icons-svelte/IconLockKeyRegular.svelte";
  import IconArrowSquareOutRegular from "phosphor-icons-svelte/IconArrowSquareOutRegular.svelte";
  import { isFileSystemAccessSupported, getSavedDirectory } from "$lib/desktop/web/fs-access";
  import { webLibrary } from "$lib/desktop/web/library";

  let { onUnlocked } = $props<{ onUnlocked: () => void }>();

  const RELEASES_URL = "https://github.com/JamieM0/dossier/releases/latest";

  let supported = $state(true);
  let returning = $state(false);
  let checked = $state(false);

  let passphrase = $state("");
  let confirm = $state("");
  let busy = $state(false);
  let error = $state<string | null>(null);

  onMount(async () => {
    supported = isFileSystemAccessSupported();
    if (supported) {
      returning = (await getSavedDirectory()) !== null;
    }
    checked = true;
  });

  async function submit(event: Event): Promise<void> {
    event.preventDefault();
    if (busy) return;
    error = null;

    if (!passphrase) {
      error = "Enter a passphrase.";
      return;
    }
    if (!returning && passphrase !== confirm) {
      error = "Passphrases don't match.";
      return;
    }

    busy = true;
    try {
      if (returning) {
        await webLibrary.unlock(passphrase);
      } else {
        // pickDirectory() + folder permission run inside this click gesture.
        await webLibrary.setup(passphrase);
      }
      onUnlocked();
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      busy = false;
      passphrase = "";
      confirm = "";
    }
  }
</script>

<div class="gate">
  <div class="card">
    {#if !checked}
      <div class="spinner" aria-hidden="true"></div>
    {:else if !supported}
      <div class="icon"><IconLockKeyRegular class="icon-24" /></div>
      <h1>This browser can't store a Dossier library</h1>
      <p class="lead">
        The web version keeps your encrypted library in a folder on your device using
        the File System Access API, which only Chromium browsers
        (<strong>Chrome</strong>, <strong>Edge</strong>, <strong>Brave</strong>, <strong>Arc</strong>)
        support. Open Dossier in one of those — or install the desktop app for the full,
        OS-secured experience.
      </p>
      <a class="install-link" href={RELEASES_URL} target="_blank" rel="noreferrer">
        Download Dossier for macOS <IconArrowSquareOutRegular class="icon-12" />
      </a>
    {:else}
      <div class="icon"><IconLockKeyRegular class="icon-24" /></div>
      <h1>{returning ? "Unlock your library" : "Set up your library"}</h1>
      <p class="lead">
        {#if returning}
          Enter your passphrase to decrypt your library. You'll re-confirm access to
          your library folder.
        {:else}
          The web version encrypts your library with a passphrase and saves it to a
          folder you choose. Pick something memorable — <strong>there's no recovery if
          you forget it</strong>.
        {/if}
      </p>

      <form onsubmit={submit}>
        <input
          class="field"
          type="password"
          bind:value={passphrase}
          placeholder="Passphrase"
          autocomplete={returning ? "current-password" : "new-password"}
          disabled={busy}
        />
        {#if !returning}
          <input
            class="field"
            type="password"
            bind:value={confirm}
            placeholder="Confirm passphrase"
            autocomplete="new-password"
            disabled={busy}
          />
        {/if}
        {#if error}<p class="error">{error}</p>{/if}
        <button type="submit" disabled={busy || !passphrase}>
          {#if busy}
            Working…
          {:else if returning}
            Unlock
          {:else}
            Choose folder & create
          {/if}
        </button>
      </form>

      <p class="footnote">
        Want OS-backed credentials and no passphrase to remember?
        <a href={RELEASES_URL} target="_blank" rel="noreferrer">
          Install the desktop app <IconArrowSquareOutRegular class="icon-12" />
        </a>
      </p>
    {/if}
  </div>
</div>

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
    background: color-mix(in srgb, var(--accent, var(--primary-accent)) 16%, var(--base-tertiary));
    color: var(--accent, var(--primary-accent));
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
  form { display: flex; flex-direction: column; gap: var(--space-3); }
  .field {
    width: 100%;
    box-sizing: border-box;
    font-size: 0.95rem;
    padding: var(--space-3);
    border-radius: var(--radius-md);
    border: 1px solid var(--border-subtle);
    background: var(--base);
    color: var(--text-primary);
  }
  .field:focus { outline: none; border-color: var(--accent, var(--primary-accent)); }
  button[type="submit"] {
    align-self: flex-start;
    padding: var(--space-2) var(--space-5);
    border-radius: var(--radius-md);
    border: 0;
    background: var(--accent, var(--primary-accent));
    color: var(--accent-contrast, #fff);
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
  }
  button[type="submit"]:disabled { opacity: 0.5; cursor: default; }
  .error { color: var(--danger, #f85149); font-size: 0.85rem; margin: 0; }
  .install-link, .footnote a {
    color: var(--accent, var(--primary-accent));
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .install-link { font-weight: 600; }
  .install-link:hover, .footnote a:hover { text-decoration: underline; }
  .footnote { margin: var(--space-5) 0 0; font-size: 0.82rem; color: var(--text-tertiary); line-height: 1.5; }
  .spinner {
    width: 28px; height: 28px; border-radius: 50%;
    border: 3px solid var(--border-subtle); border-top-color: var(--accent, var(--primary-accent));
    animation: spin 0.8s linear infinite; margin: var(--space-6) auto;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
