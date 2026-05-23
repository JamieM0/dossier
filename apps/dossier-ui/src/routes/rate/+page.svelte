<script lang="ts">
  import { onMount } from "svelte";
  import { loadCatalogueIndex } from "$lib/catalogue";
  import { buildRatingQueue } from "$lib/recommender";
  import { preferences } from "$lib/state/preferences.svelte";
  import type { CatalogueIndex, FilmIndexEntry } from "$lib/types";
  import IconThumbsUpFill from "phosphor-icons-svelte/IconThumbsUpFill.svelte";
  import IconThumbsDownFill from "phosphor-icons-svelte/IconThumbsDownFill.svelte";
  import IconEyeSlashRegular from "phosphor-icons-svelte/IconEyeSlashRegular.svelte";

  let catalogue = $state<CatalogueIndex | null>(null);
  let busy = $state(false);
  /** Last action — drives the swipe animation. Cleared after the next render. */
  let lastAction = $state<"like" | "dislike" | "skip" | null>(null);

  // The queue is purely derived from catalogue + preferences. A rated
  // film falls out of the exclusion set, so the next call surfaces the
  // next-best film at index 0 — we don't need a cursor.
  const queue = $derived<FilmIndexEntry[]>(
    catalogue ? buildRatingQueue(catalogue, preferences.excludedIds()) : []
  );
  const current = $derived(queue[0] ?? null);

  let actionError = $state<string | null>(null);

  onMount(() => {
    // Catalogue and preferences load independently — a backend failure
    // on prefs should not hide the catalogue (or vice versa).
    void preferences.hydrate();
    void loadCatalogueIndex()
      .then((c) => { catalogue = c; })
      .catch((err) => {
        actionError = `Catalogue failed to load: ${err instanceof Error ? err.message : String(err)}`;
      });
  });

  async function decide(action: "like" | "dislike" | "skip"): Promise<void> {
    if (!current || busy) return;
    busy = true;
    actionError = null;
    lastAction = action;
    const film = current;
    try {
      if (action === "like") await preferences.setRating(film.id, 1);
      else if (action === "dislike") await preferences.setRating(film.id, -1);
      else await preferences.skip(film.id);
      // The $effect above rebuilds the queue from the exclusion set,
      // which removes `film` and shifts subsequent cards forward — so
      // we don't increment cursor.
    } catch (err) {
      actionError = err instanceof Error ? err.message : String(err);
      lastAction = null;
    } finally {
      busy = false;
      // Clear the swipe animation marker on the next tick.
      setTimeout(() => { lastAction = null; }, 320);
    }
  }

  function handleKey(event: KeyboardEvent): void {
    if (event.repeat) return;
    if (event.key === "ArrowRight") { event.preventDefault(); void decide("like"); }
    else if (event.key === "ArrowLeft") { event.preventDefault(); void decide("dislike"); }
    else if (event.key === " " || event.code === "Space") {
      event.preventDefault();
      void decide("skip");
    }
  }
</script>

<svelte:window on:keydown={handleKey} />

<section class="screen">
  <header class="header">
    <h1>Rate films</h1>
    <p class="hint">
      <kbd>←</kbd> dislike · <kbd>→</kbd> like · <kbd>Space</kbd> haven't seen
    </p>
    <p class="count">{preferences.ratingCount()} rated</p>
  </header>

  {#if preferences.error}
    <div class="error" role="alert">
      <strong>Preferences backend unavailable.</strong>
      <span>{preferences.error}</span>
    </div>
  {/if}
  {#if actionError}
    <div class="error" role="alert">{actionError}</div>
  {/if}

  <div class="stage">
    {#if !catalogue}
      <p class="muted">Loading catalogue…</p>
    {:else if !preferences.loaded}
      <p class="muted">Hydrating preferences…</p>
    {:else if !current}
      <div class="empty">
        <h2>That's everything.</h2>
        <p>You've gone through the catalogue. Try the recommendations or refine your taste with pairwise picks.</p>
      </div>
    {:else}
      {#key current.id}
        <article class="card" class:swipe-right={lastAction === "like"} class:swipe-left={lastAction === "dislike"} class:fade-up={lastAction === "skip"}>
          {#if current.poster_url}
            <img class="poster" src={current.poster_url} alt="" />
          {:else}
            <div class="poster poster-empty"></div>
          {/if}
          <div class="card-body">
            <h2 class="title">{current.title}</h2>
            <p class="meta">
              {#if current.year}<span>{current.year}</span>{/if}
              {#if current.rating}<span class="dot">·</span><span>★ {current.rating}</span>{/if}
            </p>
            {#if current.genres.length > 0}
              <p class="genres">{current.genres.join(" · ")}</p>
            {/if}
          </div>
        </article>
      {/key}
    {/if}
  </div>

  <div class="actions">
    <button class="btn btn-dislike" disabled={!current || busy} onclick={() => decide("dislike")} aria-label="Dislike">
      <IconThumbsDownFill class="icon-20" />
      <span>Dislike</span>
    </button>
    <button class="btn btn-skip" disabled={!current || busy} onclick={() => decide("skip")} aria-label="Haven't seen">
      <IconEyeSlashRegular class="icon-20" />
      <span>Haven't seen</span>
    </button>
    <button class="btn btn-like" disabled={!current || busy} onclick={() => decide("like")} aria-label="Like">
      <IconThumbsUpFill class="icon-20" />
      <span>Like</span>
    </button>
  </div>
</section>

<style>
  .screen {
    height: 100%;
    display: flex;
    flex-direction: column;
    padding: var(--space-6);
    gap: var(--space-5);
  }
  .header {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-1);
  }
  .header h1 {
    font-family: var(--font-display);
    font-size: 1.5rem;
    color: var(--text-primary);
    margin: 0;
  }
  .hint {
    color: var(--text-tertiary);
    font-size: 0.85rem;
    margin: 0;
  }
  kbd {
    background: var(--base-tertiary);
    border: 1px solid var(--border-subtle);
    border-radius: 4px;
    padding: 0 6px;
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--text-secondary);
  }
  .count { color: var(--text-tertiary); font-size: 0.8rem; margin: 0; }
  .stage {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 0;
  }
  .card {
    width: min(420px, 90vw);
    background: var(--base-secondary);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-lg);
    overflow: hidden;
    box-shadow: var(--shadow-lg);
    display: flex;
    flex-direction: column;
    animation: enter 240ms var(--ease-out);
  }
  @keyframes enter {
    from { opacity: 0; transform: translateY(8px) scale(0.98); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
  .card.swipe-right { animation: swipeRight 300ms var(--ease-in-out) forwards; }
  .card.swipe-left { animation: swipeLeft 300ms var(--ease-in-out) forwards; }
  .card.fade-up { animation: fadeUp 300ms var(--ease-in-out) forwards; }
  @keyframes swipeRight {
    to { transform: translateX(110%) rotate(8deg); opacity: 0; }
  }
  @keyframes swipeLeft {
    to { transform: translateX(-110%) rotate(-8deg); opacity: 0; }
  }
  @keyframes fadeUp {
    to { transform: translateY(-20px); opacity: 0; }
  }
  .poster {
    width: 100%;
    aspect-ratio: 2 / 3;
    object-fit: cover;
    background: var(--base-tertiary);
    display: block;
  }
  .poster-empty { background: linear-gradient(135deg, var(--base-tertiary), var(--base-secondary)); }
  .card-body {
    padding: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  .title {
    margin: 0;
    font-family: var(--font-display);
    font-size: 1.25rem;
    color: var(--text-primary);
  }
  .meta { color: var(--text-secondary); margin: 0; font-size: 0.9rem; display: flex; gap: var(--space-1); }
  .dot { color: var(--text-tertiary); }
  .genres { color: var(--text-tertiary); font-size: 0.85rem; margin: 0; }
  .actions {
    display: flex;
    justify-content: center;
    gap: var(--space-3);
  }
  .btn {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius-md);
    border: 1px solid var(--border-subtle);
    background: var(--base-secondary);
    color: var(--text-primary);
    font-family: var(--font-body);
    font-size: 0.9rem;
    cursor: pointer;
    transition: background var(--duration-standard) var(--ease-out),
                border-color var(--duration-standard) var(--ease-out),
                transform var(--duration-quick) var(--ease-out);
  }
  .btn:hover:not(:disabled) { background: var(--base-tertiary); transform: translateY(-1px); }
  .btn:active:not(:disabled) { transform: translateY(0); }
  .btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .btn-like { color: var(--success, #2ea043); }
  .btn-dislike { color: var(--danger, #f85149); }
  .empty { text-align: center; max-width: 360px; }
  .empty h2 { font-family: var(--font-display); color: var(--text-primary); }
  .empty p { color: var(--text-secondary); }
  .muted { color: var(--text-tertiary); }
  .error {
    background: color-mix(in srgb, var(--danger, #f85149) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--danger, #f85149) 40%, transparent);
    color: var(--text-primary);
    padding: var(--space-3);
    border-radius: var(--radius-md);
    font-size: 0.85rem;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    max-width: 640px;
    margin: 0 auto;
  }
  .error strong { color: var(--danger, #f85149); }
</style>
