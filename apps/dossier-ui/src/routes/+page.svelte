<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { loadCatalogueIndex } from "$lib/catalogue";
  import { computeUserWeights, rankRecommendations, type Recommendation } from "$lib/recommender";
  import { preferences } from "$lib/state/preferences.svelte";
  import { catalogueMode } from "$lib/state/catalogue-mode.svelte";
  import { toasts } from "$lib/state/toast.svelte";
  import FilmCard from "$lib/components/FilmCard.svelte";
  import MovieDetailModal from "$lib/components/MovieDetailModal.svelte";
  import RecommendationsFilterModal, {
    type RecommendationFilters
  } from "$lib/components/RecommendationsFilterModal.svelte";
  import IconFunnelRegular from "phosphor-icons-svelte/IconFunnelRegular.svelte";
  import {
    RATING_DISLIKE,
    RATING_LIKE,
    RATING_NOT_INTERESTED,
    RATING_WATCHLIST,
    type CatalogueIndex,
    type FilmIndexEntry,
    type Rating
  } from "$lib/types";

  let catalogue = $state<CatalogueIndex | null>(null);
  let tvCatalogue = $state<CatalogueIndex | null>(null);
  let moviesCatalogue = $state<CatalogueIndex | null>(null);
  /** Window into the ranked list. Bumped by the IntersectionObserver
   *  when the sentinel at the end of the grid becomes visible. */
  let limit = $state(48);
  const PAGE = 24;
  let sentinel: HTMLDivElement | null = $state(null);
  let modalFilm = $state<FilmIndexEntry | null>(null);
  let filterOpen = $state(false);
  let filters = $state<RecommendationFilters>({ decadeRange: null });

  /** All decades present in the catalogue, sorted ascending. Films
   *  without a year are silently omitted from the option list — they'll
   *  still appear when no filter is applied. */
  const decadeOptions = $derived.by<number[]>(() => {
    if (!catalogue) return [];
    const set = new Set<number>();
    for (const f of catalogue.films) {
      if (f.year != null) set.add(Math.floor(f.year / 10) * 10);
    }
    return Array.from(set).sort((a, b) => a - b);
  });

  function filmPassesFilters(film: FilmIndexEntry): boolean {
    const range = filters.decadeRange;
    if (range) {
      if (film.year == null) return false;
      const decade = Math.floor(film.year / 10) * 10;
      if (decade < range[0] || decade > range[1]) return false;
    }
    return true;
  }

  /** Catalogue narrowed to films that pass the active filters. Recreated
   *  only when filters or the catalogue itself change. */
  const filteredCatalogue = $derived<CatalogueIndex | null>(
    catalogue
      ? filters.decadeRange
        ? { ...catalogue, films: catalogue.films.filter(filmPassesFilters) }
        : catalogue
      : null
  );

  const recommendations = $derived<Recommendation[]>(
    filteredCatalogue && catalogue && moviesCatalogue && tvCatalogue
      ? rankRecommendations(
          filteredCatalogue,
          computeUserWeights(moviesCatalogue, preferences.ratings, preferences.pairwise, tvCatalogue),
          preferences.excludedIds(),
          limit
        )
      : []
  );

  const ratingCount = $derived(preferences.ratingCount());
  const hasEnough = $derived(ratingCount >= 5);
  /** Total catalogue size after excluding already-rated/skipped films —
   *  the ceiling we infinite-scroll toward. */
  const totalAvailable = $derived(
    filteredCatalogue ? filteredCatalogue.films.length - preferences.excludedIds().size : 0
  );
  const hasMore = $derived(recommendations.length < totalAvailable);
  const filterActive = $derived(filters.decadeRange !== null);

  onMount(() => {
    void preferences.hydrate();
    void loadCatalogueIndex("movies").then((c) => { moviesCatalogue = c; });
    void loadCatalogueIndex("tv").then((c) => { tvCatalogue = c; });
  });

  // Swap the active catalogue when the user toggles modes. We always
  // keep both indexes hydrated so the user-profile centroid can include
  // ratings from the inactive medium (and reload is instant on toggle).
  $effect(() => {
    const next = catalogueMode.mode === "tv" ? tvCatalogue : moviesCatalogue;
    if (next && next !== catalogue) {
      catalogue = next;
      limit = 48;
    }
  });

  // Hook up the IntersectionObserver after the sentinel mounts. We
  // re-create it whenever the sentinel binding changes (e.g. when the
  // onboarding view swaps out for the grid).
  $effect(() => {
    if (!sentinel) return;
    const target = sentinel;
    // IntersectionObserver only fires when intersection state changes.
    // Adding a page of items often leaves the sentinel inside the root
    // margin, so we unobserve/re-observe after each bump to force a
    // fresh check — otherwise scrolling stalls after the first page.
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && hasMore) {
            limit += PAGE;
            queueMicrotask(() => {
              obs.unobserve(target);
              obs.observe(target);
            });
          }
        }
      },
      { rootMargin: "400px" }
    );
    obs.observe(target);
    return () => obs.disconnect();
  });

  async function applyRatingWithUndo(
    film: FilmIndexEntry,
    rating: Rating,
    verb: string
  ): Promise<void> {
    const priorRating = preferences.ratingFor(film.id) ?? null;
    const priorSkipped = preferences.skipped.includes(film.id);
    try {
      // Recs come from the catalogue and have never been skipped, but
      // be defensive — the user might have gotten here via a stale
      // state and we don't want both flags set.
      if (priorSkipped) await preferences.unskip(film.id);
      await preferences.setRating(film.id, rating);
      toasts.show(`${verb} "${film.title}".`, {
        action: {
          label: "Undo",
          run: async () => {
            await preferences.setRating(film.id, priorRating);
            if (priorSkipped) await preferences.skip(film.id);
          }
        }
      });
    } catch (err) {
      toasts.show(
        `Couldn't update "${film.title}": ${err instanceof Error ? err.message : String(err)}`,
        { durationMs: 6000 }
      );
    }
  }

  function handleIgnore(film: FilmIndexEntry): void {
    void applyRatingWithUndo(film, RATING_NOT_INTERESTED, "Won't show");
  }

  function handleWatchlist(film: FilmIndexEntry): void {
    void applyRatingWithUndo(film, RATING_WATCHLIST, "Added to watchlist");
  }

  function handleLike(film: FilmIndexEntry): void {
    void applyRatingWithUndo(film, RATING_LIKE, "Liked");
  }

  function handleDislike(film: FilmIndexEntry): void {
    void applyRatingWithUndo(film, RATING_DISLIKE, "Disliked");
  }
</script>

<section class="screen">
  <header class="header">
    <div>
      <h1>Recommendations</h1>
      <p class="sub">
        {#if ratingCount === 0}
          Rate some films to get started.
        {:else}
          Based on {ratingCount} rating{ratingCount === 1 ? "" : "s"}{filterActive ? " · filtered" : ""}.
        {/if}
      </p>
    </div>
    <button
      class="filter-btn"
      class:active={filterActive}
      onclick={() => (filterOpen = true)}
      aria-label="Filter recommendations"
      title="Filter"
    >
      <IconFunnelRegular class="icon-16" />
      <span>Filter{filterActive ? " · 1" : ""}</span>
    </button>
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
        <FilmCard
          film={rec.film}
          score={rec.score}
          onSelect={(f) => (modalFilm = f)}
          onLike={handleLike}
          onWatchlist={handleWatchlist}
          onIgnore={handleIgnore}
          onDislike={handleDislike}
        />
      {/each}
    </div>
    <div bind:this={sentinel} class="sentinel" aria-hidden="true">
      {#if hasMore}
        <span class="muted">Loading more…</span>
      {:else}
        <span class="muted">You've reached the end.</span>
      {/if}
    </div>
  {/if}
</section>

{#if filterOpen}
  <RecommendationsFilterModal
    {filters}
    decadeOptions={decadeOptions}
    onApply={(next) => { filters = next; limit = 48; }}
    onClose={() => (filterOpen = false)}
  />
{/if}

{#if modalFilm}
  <MovieDetailModal
    film={modalFilm}
    onClose={() => (modalFilm = null)}
    onLike={handleLike}
    onWatchlist={handleWatchlist}
    onIgnore={handleIgnore}
    onDislike={handleDislike}
  />
{/if}

<style>
  .screen { padding: var(--space-6); display: flex; flex-direction: column; gap: var(--space-5); }
  .header { display: flex; justify-content: space-between; align-items: flex-end; gap: var(--space-4); }
  .filter-btn {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-md);
    border: 1px solid var(--border-subtle);
    background: var(--base-secondary);
    color: var(--text-primary);
    font-size: 0.85rem;
    cursor: pointer;
    transition: background var(--duration-standard) var(--ease-out),
                border-color var(--duration-standard) var(--ease-out),
                transform var(--duration-quick) var(--ease-out);
  }
  .filter-btn:hover { background: var(--base-tertiary); transform: translateY(-1px); }
  .filter-btn.active {
    border-color: var(--accent);
    color: var(--accent);
    background: color-mix(in srgb, var(--accent) 8%, var(--base-secondary));
  }
  .header h1 { font-family: var(--font-display); font-size: 1.75rem; color: var(--text-primary); margin: 0; }
  .sub { color: var(--text-secondary); margin: var(--space-1) 0 0; font-size: 0.9rem; }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: var(--space-4);
  }
  .sentinel {
    padding: var(--space-5) 0;
    text-align: center;
    font-size: 0.85rem;
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
