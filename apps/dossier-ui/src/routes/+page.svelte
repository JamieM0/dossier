<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { goto } from "$app/navigation";
  import { buildCandidatePool, enrichItems } from "$lib/discovery";
  import {
    buildTasteGroups,
    groupRecommendationsByTaste,
    nearestGroupIndex,
    scoreCandidates,
    type Recommendation
  } from "$lib/recommender";
  import { preferences } from "$lib/state/preferences.svelte";
  import { catalogueMode } from "$lib/state/catalogue-mode.svelte";
  import { uiSettings } from "$lib/state/ui-settings.svelte";
  import { recommendationDials } from "$lib/state/recommendation-dials.svelte";
  import { toasts } from "$lib/state/toast.svelte";
  import FilmCard from "$lib/components/FilmCard.svelte";
  import RecommendationHero from "$lib/components/RecommendationHero.svelte";
  import MovieDetailModal from "$lib/components/MovieDetailModal.svelte";
  import RecommendationsFilterModal, {
    type RecommendationFilters
  } from "$lib/components/RecommendationsFilterModal.svelte";
  import RecommendationsDialsPanel from "$lib/components/RecommendationsDialsPanel.svelte";
  import IconFunnelRegular from "phosphor-icons-svelte/IconFunnelRegular.svelte";
  import IconFadersRegular from "phosphor-icons-svelte/IconFadersRegular.svelte";
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
  /** Consecutive fetched pages that added no new items — either every
   * result was already rated/skipped (heavy raters can easily exhaust a
   * whole page of "most popular in your favorite genres" before hitting
   * anything new) or TMDB pages overlapped near the tail of a filtered
   * discover query. A handful of empty pages in a row doesn't mean the
   * candidates are exhausted, just that this stretch of the sort order
   * is — so we page well past that before giving up for real, rather
   * than stopping the whole pool dead on the first empty page. */
  let staleFetchStreak = 0;
  const MAX_STALE_STREAK = 20;
  /** Scored candidates in stable, append-only order: each newly-fetched
   * page is scored and sorted as its own batch, then appended. This is
   * what keeps already-shown cards from reshuffling as more pages load —
   * see scoreCandidates() in recommender.ts. */
  let allRecs = $state<Recommendation[]>([]);
  let visibleCount = $state(24);
  const PAGE = 24;
  /** True while the sentinel is within the observer's root margin, i.e.
   * the user is close enough to the bottom that we should keep filling. */
  let nearBottom = $state(false);
  let sentinel: HTMLDivElement | null = $state(null);
  let modalItem = $state<TmdbItem | null>(null);
  let filterOpen = $state(false);
  let filters = $state<RecommendationFilters>({ decadeRange: null });
  let dialsOpen = $state(false);

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

  // Exclusion and decade filtering are applied for display only, over the
  // stable scored order — neither should reshuffle previously-shown cards.
  const displayRecs = $derived.by<Recommendation[]>(() => {
    const excluded = preferences.excludedKeys();
    return allRecs.filter(
      (r) => !excluded.has(itemKey(r.item.medium, r.item.id)) && passesFilters(r.item)
    );
  });
  // Bounded slice — only the flat-grid fallback (single taste cluster)
  // needs page-at-a-time vertical pagination.
  const recommendations = $derived(displayRecs.slice(0, visibleCount));

  // Opt-in (Settings → Recommendations → "Group by taste"; off by default,
  // matching the original flat-list behavior). When on, the single best
  // match gets the hero treatment and everything else is either grouped
  // into "Because you like X" rows (when the profile has 2+ distinct
  // taste clusters) or shown as a flat grid. The grouped/hero view draws
  // on the FULL loaded pool (not the visibleCount slice) — each row
  // scrolls (and loads more) horizontally on its own, so there's no
  // shared vertical page budget to divide between rows.
  const hero = $derived(uiSettings.groupedRecommendations ? displayRecs[0] ?? null : null);
  const rest = $derived(hero ? displayRecs.slice(1) : displayRecs);
  const tasteGroups = $derived(
    uiSettings.groupedRecommendations && preferences.loaded
      ? buildTasteGroups(preferences.entries())
      : []
  );
  const heroReason = $derived.by(() => {
    if (!hero || tasteGroups.length === 0) return null;
    const idx = nearestGroupIndex(hero.item, tasteGroups);
    return idx >= 0 ? tasteGroups[idx].label : null;
  });
  const groupedRows = $derived(
    tasteGroups.length < 2 ? null : groupRecommendationsByTaste(rest, tasteGroups)
  );

  const ratingCount = $derived(preferences.ratingCount());
  const hasEnough = $derived(ratingCount >= 5);
  const filterActive = $derived(filters.decadeRange !== null);
  const hasMore = $derived(hasMorePages || displayRecs.length > visibleCount);

  async function fetchPool(): Promise<void> {
    if (loadingPool || !hasMorePages) return;
    loadingPool = true;
    poolError = null;
    try {
      // Loop past empty/all-excluded pages instead of stopping at the
      // first one — see staleFetchStreak's comment above for why a run
      // of empty pages doesn't mean the pool is actually exhausted.
      for (;;) {
        const page = await buildCandidatePool(
          catalogueMode.medium,
          preferences.entries(),
          preferences.excludedKeys(),
          poolPage
        );
        poolPage += 1;
        const have = new Set(pool.map((i) => itemKey(i.medium, i.id)));
        const newItems = page.filter((i) => !have.has(itemKey(i.medium, i.id)));
        if (newItems.length === 0) {
          staleFetchStreak += 1;
          if (staleFetchStreak >= MAX_STALE_STREAK) {
            hasMorePages = false;
            return;
          }
          continue;
        }
        staleFetchStreak = 0;
        // Score against the full per-item lens vector (real TMDB keyword
        // tags), not the coarse genre-only vector list results carry — see
        // discovery.ts:enrichItem. Disk-cached, so this is only a real
        // network cost the first time each title is ever seen.
        const enriched = await enrichItems(newItems);
        pool = [...pool, ...enriched];
        allRecs = [...allRecs, ...scoreCandidates(enriched, preferences.entries(), recommendationDials.params)];
        return;
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
      allRecs = [];
      poolPage = 1;
      hasMorePages = true;
      staleFetchStreak = 0;
      visibleCount = PAGE;
      if (ready) void fetchPool();
    });
  });

  // The Dials panel (Settings → "Group by taste" off) intentionally
  // reshuffles the list — unlike fetchPool's incremental per-page append
  // (which exists specifically to *avoid* reshuffling already-shown
  // cards), a dial change should immediately reorder everything, since
  // "does this reorder the list a lot" is the whole point of the panel.
  // Only params is tracked; pool/entries are read untracked so ordinary
  // pool growth doesn't re-trigger this.
  $effect(() => {
    recommendationDials.params;
    untrack(() => {
      if (pool.length === 0) return;
      allRecs = scoreCandidates(pool, preferences.entries(), recommendationDials.params);
    });
  });

  // Watch the sentinel with a generous root margin so loading starts
  // well before the user hits the bottom (fixes "new entries don't
  // appear on time").
  $effect(() => {
    if (!sentinel) return;
    const target = sentinel;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) nearBottom = e.isIntersecting;
      },
      { rootMargin: "800px" }
    );
    obs.observe(target);
    return () => obs.disconnect();
  });

  // While near the bottom, keep revealing already-scored cards and/or
  // fetching more, re-running as those values change. This reruns on its
  // own (via the displayRecs/visibleCount/hasMorePages dependencies) for
  // as long as nearBottom stays true, so tall viewports that reveal a
  // whole page without the sentinel leaving the margin still keep filling.
  $effect(() => {
    if (!nearBottom) return;
    if (displayRecs.length > visibleCount) {
      visibleCount += PAGE;
    } else if (hasMorePages && !loadingPool) {
      void fetchPool();
    }
  });

  /** Action for the sentinel at the end of each row's horizontal track:
   * fetches more of the shared pool once the sentinel nears the track's
   * own right edge — this is what makes each row scroll infinitely
   * left-to-right, independent of the other rows and independent of the
   * page's vertical scroll position. */
  function rowEndSentinel(node: HTMLElement): { destroy(): void } {
    const root = node.closest(".row-track");
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && hasMorePages && !loadingPool) void fetchPool();
        }
      },
      { root: root as Element | null, rootMargin: "0px 400px 0px 0px" }
    );
    obs.observe(node);
    return { destroy: () => obs.disconnect() };
  }

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
    <div class="header-actions">
      {#if !uiSettings.groupedRecommendations}
        <button
          class="filter-btn"
          class:active={!recommendationDials.isDefault}
          onclick={() => (dialsOpen = true)}
          aria-label="Tune recommendation dials"
          title="Dials"
        >
          <IconFadersRegular class="icon-16" />
          <span>Dials{recommendationDials.isDefault ? "" : " · on"}</span>
        </button>
      {/if}
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
    </div>
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
    {#if hero}
      <RecommendationHero
        item={hero.item}
        score={hero.score}
        reason={heroReason}
        onSelect={(f) => (modalItem = f)}
        onLike={handleLike}
        onWatchlist={handleWatchlist}
        onIgnore={handleIgnore}
        onDislike={handleDislike}
      />
    {/if}

    {#if groupedRows}
      {#each groupedRows as row (row.label)}
        <section class="row">
          <h2 class="row-title">Because you like {row.label}</h2>
          <div class="row-track">
            {#each row.items as rec (itemKey(rec.item.medium, rec.item.id))}
              <div class="row-tile">
                <FilmCard
                  item={rec.item}
                  score={rec.score}
                  onSelect={(f) => (modalItem = f)}
                  onLike={handleLike}
                  onWatchlist={handleWatchlist}
                  onIgnore={handleIgnore}
                  onDislike={handleDislike}
                />
              </div>
            {/each}
            <div class="row-sentinel" aria-hidden="true" use:rowEndSentinel></div>
          </div>
        </section>
      {/each}
    {:else}
      <div class="grid">
        {#each (uiSettings.groupedRecommendations ? rest : recommendations) as rec (itemKey(rec.item.medium, rec.item.id))}
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
    {/if}
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
    onApply={(next) => { filters = next; visibleCount = PAGE; }}
    onClose={() => (filterOpen = false)}
  />
{/if}

{#if dialsOpen}
  <RecommendationsDialsPanel onClose={() => (dialsOpen = false)} />
{/if}

<style>
  .screen { padding: var(--space-6); display: flex; flex-direction: column; gap: var(--space-5); }
  .header { display: flex; justify-content: space-between; align-items: flex-end; gap: var(--space-4); }
  .header-actions { display: flex; align-items: center; gap: var(--space-2); }
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
  .row { display: flex; flex-direction: column; gap: var(--space-3); }
  .row-title {
    font-family: var(--font-display);
    font-size: 1.05rem;
    color: var(--text-primary);
    margin: 0;
    text-transform: capitalize;
  }
  .row-track {
    display: flex;
    align-items: flex-start;
    gap: var(--space-4);
    overflow-x: auto;
    overflow-y: hidden;
    padding-bottom: var(--space-2);
    scroll-snap-type: x proximity;
    scrollbar-width: thin;
    overscroll-behavior-x: contain;
  }
  .row-tile { flex: 0 0 180px; width: 180px; scroll-snap-align: start; }
  .row-sentinel { flex: 0 0 1px; align-self: stretch; }
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
