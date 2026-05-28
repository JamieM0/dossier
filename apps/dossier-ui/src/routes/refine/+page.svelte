<script lang="ts">
  import { onMount } from "svelte";
  import { buildPairwiseCandidates, predictPreference } from "$lib/recommender";
  import { preferences } from "$lib/state/preferences.svelte";
  import { catalogueMode } from "$lib/state/catalogue-mode.svelte";
  import { posterUrl } from "$lib/poster";
  import type { RatedItem, RatingEntry } from "$lib/types";

  let busy = $state(false);

  // Pairwise compares items the user has already rated similarly. Scoped
  // to the active medium so a movie is never paired against a TV show.
  // Operates entirely on stored snapshots — no catalogue fetch.
  const pairs = $derived<Array<[RatingEntry, RatingEntry]>>(
    preferences.loaded
      ? buildPairwiseCandidates(
          preferences.entries(catalogueMode.medium),
          preferences.pairwise,
          40
        )
      : []
  );
  const current = $derived(pairs[0] ?? null);

  /** Predicted preference 0–100 for a rated item, from the live profile. */
  function predict(item: RatedItem): number {
    return predictPreference(item, preferences.entries());
  }

  let actionError = $state<string | null>(null);

  onMount(() => {
    void preferences.hydrate();
  });

  async function choose(winnerIdx: 0 | 1): Promise<void> {
    if (!current || busy) return;
    busy = true;
    const winner = current[winnerIdx];
    const loser = current[1 - winnerIdx];
    actionError = null;
    try {
      await preferences.addPairwise(winner.item.key, loser.item.key);
    } catch (err) {
      actionError = err instanceof Error ? err.message : String(err);
    } finally {
      busy = false;
    }
  }

  function handleKey(event: KeyboardEvent): void {
    if (event.repeat || !current) return;
    if (event.key === "ArrowLeft") { event.preventDefault(); void choose(0); }
    else if (event.key === "ArrowRight") { event.preventDefault(); void choose(1); }
  }
</script>

<svelte:window on:keydown={handleKey} />

<section class="screen">
  <header class="header">
    <h1>Which do you prefer?</h1>
    <p class="hint">
      <kbd>←</kbd> left · <kbd>→</kbd> right · pairwise refinement sharpens your weights
    </p>
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

  {#if !preferences.loaded}
    <p class="muted center">Loading…</p>
  {:else if preferences.ratingCount(catalogueMode.medium) < 4}
    <div class="empty center">
      <h2>Rate a few titles first.</h2>
      <p>Pairwise refinement compares titles you've already rated similarly. Rate at least 4, then come back.</p>
    </div>
  {:else if !current}
    <div class="empty center">
      <h2>No new comparisons.</h2>
      <p>You've answered every pair from your current ratings. Rate more titles to unlock more comparisons.</p>
    </div>
  {:else}
    <div class="duel">
      {#each [0, 1] as side (current[side].item.key)}
        {@const entry = current[side]}
        {@const matchPct = predict(entry.item)}
        <button class="pick" disabled={busy} onclick={() => choose(side as 0 | 1)}>
          <div class="poster-wrap">
            {#if posterUrl(entry.item.posterPath, "w500")}
              <img class="poster" src={posterUrl(entry.item.posterPath, "w500")} alt="" />
            {:else}
              <div class="poster poster-empty"></div>
            {/if}
            <span class="match-badge" title="Predicted preference based on your ratings so far">
              <strong>{matchPct}%</strong> match
            </span>
          </div>
          <div class="caption">
            <h3>{entry.item.title}</h3>
            <p class="meta">{entry.item.year ?? ""}{entry.item.genres[0] ? ` · ${entry.item.genres[0]}` : ""}</p>
          </div>
        </button>
      {/each}
    </div>
    <p class="counter center">{preferences.pairwise.length + 1} answered · {pairs.length} more queued</p>
  {/if}
</section>

<style>
  .screen { height: 100%; display: flex; flex-direction: column; padding: var(--space-6); gap: var(--space-5); }
  .header { display: flex; flex-direction: column; align-items: center; gap: var(--space-1); }
  .header h1 { font-family: var(--font-display); font-size: 1.5rem; color: var(--text-primary); margin: 0; }
  .hint { color: var(--text-tertiary); font-size: 0.85rem; margin: 0; }
  kbd { background: var(--base-tertiary); border: 1px solid var(--border-subtle); border-radius: 4px; padding: 0 6px; font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-secondary); }
  .center { text-align: center; }
  .duel { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-5); flex: 1; align-items: center; max-width: 920px; width: 100%; margin: 0 auto; }
  .pick {
    background: var(--base-secondary);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-lg);
    overflow: hidden;
    padding: 0;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    transition: border-color var(--duration-standard) var(--ease-out), transform var(--duration-quick) var(--ease-out);
    color: inherit;
  }
  .pick:hover:not(:disabled) { border-color: var(--accent); transform: translateY(-2px); }
  .pick:disabled { opacity: 0.5; }
  .poster-wrap { position: relative; }
  .poster { width: 100%; aspect-ratio: 2 / 3; object-fit: cover; display: block; background: var(--base-tertiary); }
  .poster-empty { background: linear-gradient(135deg, var(--base-tertiary), var(--base-secondary)); }
  .match-badge {
    position: absolute;
    top: var(--space-3);
    left: 50%;
    transform: translateX(-50%);
    background: #ffffff;
    color: #111111;
    border: 1px solid rgba(0, 0, 0, 0.12);
    border-radius: 999px;
    padding: 6px 14px;
    font-size: 0.8rem;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.01em;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
    display: inline-flex;
    align-items: baseline;
    gap: 4px;
    white-space: nowrap;
  }
  .match-badge strong { color: var(--accent); font-weight: 700; font-size: 0.9rem; }
  .caption { padding: var(--space-3); text-align: left; }
  .caption h3 { font-family: var(--font-display); font-size: 1.05rem; margin: 0; color: var(--text-primary); }
  .meta { color: var(--text-secondary); font-size: 0.85rem; margin: var(--space-1) 0 0; }
  .counter { color: var(--text-tertiary); font-size: 0.8rem; }
  .muted { color: var(--text-tertiary); }
  .empty h2 { font-family: var(--font-display); color: var(--text-primary); }
  .empty p { color: var(--text-secondary); max-width: 420px; margin: 0 auto; }
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
