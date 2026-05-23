<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { loadCatalogueIndex } from "$lib/catalogue";
  import { computeUserWeights, rankRecommendations, type Recommendation } from "$lib/recommender";
  import { preferences } from "$lib/state/preferences.svelte";
  import FilmCard from "$lib/components/FilmCard.svelte";
  import IconArrowsClockwiseRegular from "phosphor-icons-svelte/IconArrowsClockwiseRegular.svelte";
  import type { CatalogueIndex } from "$lib/types";

  let catalogue = $state<CatalogueIndex | null>(null);
  let limit = $state(24);

  const recommendations = $derived<Recommendation[]>(
    catalogue
      ? rankRecommendations(
          catalogue,
          computeUserWeights(catalogue, preferences.ratings, preferences.pairwise),
          preferences.excludedIds(),
          limit
        )
      : []
  );

  const ratingCount = $derived(preferences.ratingCount());
  const hasEnough = $derived(ratingCount >= 5);

  onMount(() => {
    void preferences.hydrate();
    void loadCatalogueIndex().then((c) => { catalogue = c; });
  });
</script>

<section class="screen">
  <header class="header">
    <div>
      <h1>Recommendations</h1>
      <p class="sub">
        {#if ratingCount === 0}
          Rate some films to get started.
        {:else}
          Based on {ratingCount} rating{ratingCount === 1 ? "" : "s"}.
        {/if}
      </p>
    </div>
    {#if hasEnough}
      <button class="reroll" onclick={() => { limit = limit === 24 ? 48 : 24; }} aria-label="Refresh">
        <IconArrowsClockwiseRegular class="icon-20" />
        <span>{limit === 24 ? "Show more" : "Show fewer"}</span>
      </button>
    {/if}
  </header>

  {#if preferences.error}
    <div class="error" role="alert">
      <strong>Preferences backend unavailable.</strong>
      <span>{preferences.error}</span>
    </div>
  {/if}

  {#if !catalogue || !preferences.loaded}
    <p class="muted">Loading…</p>
  {:else if !hasEnough}
    <div class="onboard">
      <h2>Tell Dossier what you like.</h2>
      <p>Rate at least 5 films and you'll get recommendations ranked by similarity to your taste.</p>
      <button class="cta" onclick={() => goto("/rate")}>Start rating</button>
    </div>
  {:else if recommendations.length === 0}
    <p class="muted">No recommendations yet.</p>
  {:else}
    <div class="grid">
      {#each recommendations as rec (rec.film.id)}
        <FilmCard film={rec.film} score={rec.score} />
      {/each}
    </div>
  {/if}
</section>

<style>
  .screen { padding: var(--space-6); display: flex; flex-direction: column; gap: var(--space-5); }
  .header { display: flex; justify-content: space-between; align-items: flex-end; gap: var(--space-4); }
  .header h1 { font-family: var(--font-display); font-size: 1.75rem; color: var(--text-primary); margin: 0; }
  .sub { color: var(--text-secondary); margin: var(--space-1) 0 0; font-size: 0.9rem; }
  .reroll {
    display: inline-flex; align-items: center; gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-md);
    border: 1px solid var(--border-subtle);
    background: var(--base-secondary);
    color: var(--text-primary);
    font-size: 0.85rem;
    cursor: pointer;
    transition: background var(--duration-standard) var(--ease-out);
  }
  .reroll:hover { background: var(--base-tertiary); }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: var(--space-4);
  }
  .onboard {
    text-align: center;
    max-width: 480px;
    margin: var(--space-7) auto 0;
    display: flex; flex-direction: column; gap: var(--space-3); align-items: center;
  }
  .onboard h2 { font-family: var(--font-display); color: var(--text-primary); margin: 0; }
  .onboard p { color: var(--text-secondary); margin: 0; }
  .cta {
    background: var(--accent);
    color: var(--accent-contrast, white);
    border: none;
    padding: var(--space-3) var(--space-5);
    border-radius: var(--radius-md);
    cursor: pointer;
    font-size: 0.95rem;
    transition: filter var(--duration-quick) var(--ease-out);
  }
  .cta:hover { filter: brightness(1.05); }
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
  }
  .error strong { color: var(--danger, #f85149); }
</style>
