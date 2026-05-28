<script lang="ts">
  import { tmdbState } from "$lib/state/tmdb.svelte";
  import IconKeyRegular from "phosphor-icons-svelte/IconKeyRegular.svelte";
  import IconArrowSquareOutRegular from "phosphor-icons-svelte/IconArrowSquareOutRegular.svelte";

  let token = $state("");

  async function submit(e: Event): Promise<void> {
    e.preventDefault();
    if (!token.trim() || tmdbState.busy) return;
    await tmdbState.setToken(token);
    if (tmdbState.configured) token = "";
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
  .error { color: var(--danger, #f85149); font-size: 0.85rem; margin: 0; }
</style>
