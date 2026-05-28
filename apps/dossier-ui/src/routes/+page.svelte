<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { goto } from "$app/navigation";
  import { buildCandidatePool } from "$lib/discovery";
  import { rankRecommendations, type Recommendation } from "$lib/recommender";
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
    itemKey,
    RATING_DISLIKE,
    RATING_LIKE,
    RATING_NOT_INTERESTED,
    RATING_WATCHLIST,
    type Rating,
    type TmdbItem
  } from "$lib/types";

  /** Accumulated candidate pool from TMDB, grown by infinite scroll. */
  let pool = $state<TmdbItem[]>([]);
  let poolPage = 1;
  let hasMorePages = $state(true);
  let loadingPool = $state(false);
  let poolError = $state<string | null>(null);
  let limit = $state(24);
  const PAGE = 24;
  let sentinel: HTMLDivElement | null = $state(null);
  let modalItem = $state<TmdbItem | null>(null);
  let filterOpen = $state(false);
  let filters = $state<RecommendationFilters>({ decadeRange: null });

  const decadeOptions = $derived.by<number[]>(() => {
    const set = new Set<number>();
    for (const it of pool) if (it.year != null) set.add(Math.floor(it.year / 10) * 10);
    return Array.from(set).sort((a, b) => a - b);
  });

  function passesFilters(item: TmdbItem): boolean {
    const range = filters.decadeRange;
    if (range) {
      if (item.year == null) return false;
      const decade = Math.floor(item.year / 10) * 10;
      if (decade < range[0] || decade > range[1]) return false;
    }
    return true;
  }

  const filteredPool = $derived(filters.decadeRange ? pool.filter(passesFilters) : pool);

  // Profile spans ALL rated items (taste transfers across mediums); the
  // candidate pool is the active medium only.
  const recommendations = $derived<Recommendation[]>(
    preferences.loaded
      ? rankRecommendations(
          filteredPool,
          preferences.entries(),
          preferences.excludedKeys(),
          limit
        )
      : []
  );

  const ratingCount = $derived(preferences.ratingCount());
  const hasEnough = $derived(ratingCount >= 5);
  const filterActive = $derived(filters.decadeRange !== null);
  const hasMore = $derived(hasMorePages || recommendations.length >= limit);

  async function fetchPool(): Promise<void> {
    if (loadingPool || !hasMorePages) return;
    loadingPool = true;
    poolError = null;
    try {
      const page = await buildCandidatePool(
        catalogueMode.medium,
        preferences.entries(),
        preferences.excludedKeys(),
        poolPage
      );
      poolPage += 1;
      if (page.length === 0) {
        hasMorePages = false;
      } else {
        const have = new Set(pool.map((i) => itemKey(i.medium, i.id)));
        pool = [...pool, ...page.filter((i) => !have.has(itemKey(i.medium, i.id)))];
      }
    } catch (err) {
      poolError = err instanceof Error ? err.message : String(err);
    } finally {
      loadingPool = false;
    }
  }

  onMount(() => {
    void preferences.hydrate();
  });

  // Rebuild the pool when the medium changes or once enough ratings
  // exist. Track only mode + readiness; the reset/fetch run untracked so
  // fetchPool's internal reads (loadingPool/hasMorePages) don't loop.
  $effect(() => {
    catalogueMode.mode; // track
    const ready = preferences.loaded && hasEnough;
    untrack(() => {
      pool = [];
      poolPage = 1;
      hasMorePages = true;
      limit = 24;
      if (ready) void fetchPool();
    });
  });

  // Infinite scroll: grow the pool / reveal more as the sentinel nears.
  $effect(() => {
    if (!sentinel) return;
    const target = sentinel;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          // If we're showing most of the ranked pool, fetch more first.
          if (limit + PAGE > filteredPool.length && hasMorePages) void fetchPool();
          if (recommendations.length >= limit && hasMorePages) limit += PAGE;
          else if (limit < filteredPool.length) limit += PAGE;
          queueMicrotask(() => {
            obs.unobserve(target);
            obs.observe(target);
          });
        }
      },
      { rootMargin: "400px" }
    );
    obs.observe(target);
    return () => obs.disconnect();
  });

  async function applyRatingWithUndo(item: TmdbItem, rating: Rating, verb: string): Promise<void> {
    const key = itemKey(item.medium, item.id);
    const priorRating = preferences.ratingForKey(key) ?? null;
    try {
      await preferences.setRating(item, rating);
      toasts.show(`${verb} "${item.title}".`, {
        action: {
          label: "Undo",
          run: async () => {
            await preferences.setRating(item, priorRating);
          }
        }
      });
    } catch (err) {
      toasts.show(
        `Couldn't update "${item.title}": ${err instanceof Error ? err.message : String(err)}`,
        { durationMs: 6000 }
      );
    }
  }

  const handleIgnore = (i: TmdbItem) => void applyRatingWithUndo(i, RATING_NOT_INTERESTED, "Won't show");
  const handleWatchlist = (i: TmdbItem) => void applyRatingWithUndo(i, RATING_WATCHLIST, "Added to watchlist");
  const handleLike = (i: TmdbItem) => void applyRatingWithUndo(i, RATING_LIKE, "Liked");
  const handleDislike = (i: TmdbItem) => void applyRatingWithUndo(i, RATING_DISLIKE, "Disliked");
</script>

<section class="screen">
  <header class="header">
    <div>
      <h1>Recommendations</h1>
      <p class="sub">
        {#if ratingCount === 0}
          Rate some titles to get started.
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
  {#if poolError}
    <div class="error" role="alert">Couldn't load candidates from TMDB: {poolError}</div>
  {/if}

  {#if !preferences.loaded}
    <p class="muted">Loading…</p>
  {:else if !hasEnough}
    <div class="onboard">
      <h2>Tell Dossier what you like.</h2>
      <p>Rate at least 5 titles and you'll get recommendations ranked by your taste.</p>
      <button class="cta" onclick={() => goto("/rate")}>Start rating</button>
    </div>
  {:else if recommendations.length === 0 && loadingPool}
    <p class="muted">Finding titles you'll like…</p>
  {:else if recommendations.length === 0}
    <p class="muted">No recommendations yet — rate a few more titles.</p>
  {:else}
    <div class="grid">
      {#each recommendations as rec (itemKey(rec.item.medium, rec.item.id))}
        <FilmCard
          item={rec.item}
          score={rec.score}
          onSelect={(f) => (modalItem = f)}
          onLike={handleLike}
          onWatchlist={handleWatchlist}
          onIgnore={handleIgnore}
          onDislike={handleDislike}
        />
      {/each}
    </div>
    <div bind:this={sentinel} class="sentinel" aria-hidden="true">
      {#if loadingPool}
        <span class="muted">Loading more…</span>
      {:else if hasMore}
        <span class="muted">Scroll for more…</span>
      {:else}
        <span class="muted">You've reached the end.</span>
      {/if}
    </div>
  {/if}
</section>

{#if modalItem}
  <MovieDetailModal
    item={modalItem}
    onClose={() => (modalItem = null)}
    onLike={handleLike}
    onWatchlist={handleWatchlist}
    onIgnore={handleIgnore}
    onDislike={handleDislike}
  />
{/if}

{#if filterOpen}
  <RecommendationsFilterModal
    {filters}
    decadeOptions={decadeOptions}
    onApply={(next) => { filters = next; limit = 24; }}
    onClose={() => (filterOpen = false)}
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
