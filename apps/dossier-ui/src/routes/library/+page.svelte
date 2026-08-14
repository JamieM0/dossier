<script lang="ts">
  import { onMount } from "svelte";
  import { preferences } from "$lib/state/preferences.svelte";
  import { toasts } from "$lib/state/toast.svelte";
  import {
    ratedToTmdbItem,
    RATING_DISLIKE,
    RATING_LIKE,
    RATING_NOT_INTERESTED,
    RATING_WATCHLIST,
    type Rating,
    type RatingKind,
    type TmdbItem
  } from "$lib/types";
  import Carousel from "$lib/components/Carousel.svelte";
  import MovieDetailModal, { type ModalActionKind } from "$lib/components/MovieDetailModal.svelte";
  import IconXBold from "phosphor-icons-svelte/IconXBold.svelte";
  import LibraryReRate from "$lib/components/LibraryReRate.svelte";
  import { motionReveal, motionStaggerChildren } from "$lib/design/motion";

  let modalItem = $state<TmdbItem | null>(null);
  let modalExclude = $state<ModalActionKind[]>([]);
  let rerate = $state<{ title:string; items:TmdbItem[] } | null>(null);

  let search = $state("");
  let mediumView = $state<"movie" | "tv">("movie");

  const searchTerms = $derived(
    search.trim().toLowerCase().split(/\s+/).filter(Boolean)
  );
  const isSearching = $derived(searchTerms.length > 0);

  function itemsOf(kind: RatingKind): TmdbItem[] {
    return preferences
      .entriesByKind(kind)
      .sort((a, b) => b.ts - a.ts)
      .map((e) => ratedToTmdbItem(e.item));
  }

  function matchesSearch(film: TmdbItem, terms: string[]): boolean {
    if (terms.length === 0) return true;
    const haystack = `${film.title} ${film.year ?? ""} ${film.genres.join(" ")}`.toLowerCase();
    return terms.every((t) => haystack.includes(t));
  }

  // section.exclude maps to the modal action kind hidden when opening an
  // item already filed under this section.
  const sections = $derived([
    { id: "watchlist", title: "Watchlist", exclude: "watchlist" as ModalActionKind, films: itemsOf("watchlist"),
      empty: "Titles you flag from the rate screen or recommendations appear here." },
    { id: "liked", title: "Liked", exclude: "like" as ModalActionKind, films: itemsOf("like"),
      empty: "Like a title and it'll land here." },
    { id: "disliked", title: "Disliked", exclude: "dislike" as ModalActionKind, films: itemsOf("dislike"),
      empty: "Titles you've thumbs-downed will appear here." },
    { id: "not-interested", title: "Not interested", exclude: "not_interested" as ModalActionKind, films: itemsOf("not_interested"),
      empty: "Titles you've hidden with \"Don't show again\" appear here." }
  ]);

  const mediumSections = $derived(
    sections.map((section) => ({
      ...section,
      films: section.films.filter((film) => film.medium === mediumView)
    }))
  );
  const filteredSections = $derived(
    !isSearching
      ? mediumSections
      : mediumSections
          .map((s) => ({ ...s, films: s.films.filter((f) => matchesSearch(f, searchTerms)) }))
          .filter((s) => s.films.length > 0)
  );

  onMount(() => {
    void preferences.hydrate();
  });

  function openModal(film: TmdbItem, exclude: ModalActionKind): void {
    modalItem = film;
    modalExclude = [exclude];
  }

  async function applyRating(film: TmdbItem, rating: Rating, verb: string): Promise<void> {
    const priorRating = preferences.ratingFor(film.medium, film.id) ?? null;
    try {
      await preferences.setRating(film, rating);
      toasts.show(`${verb} "${film.title}".`, {
        action: {
          label: "Undo",
          run: async () => {
            await preferences.setRating(film, priorRating);
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

  function handleLike(film: TmdbItem): void { void applyRating(film, RATING_LIKE, "Liked"); }
  function handleDislike(film: TmdbItem): void { void applyRating(film, RATING_DISLIKE, "Disliked"); }
  function handleWatchlist(film: TmdbItem): void { void applyRating(film, RATING_WATCHLIST, "Added to watchlist"); }
  function handleIgnore(film: TmdbItem): void { void applyRating(film, RATING_NOT_INTERESTED, "Won't show"); }
</script>

<section class="screen">
  <header class="header" use:motionReveal>
    <div class="header-left">
      <span class="screen-kicker">Evidence ledger</span>
      <h1 class="editorial-title">Your Library</h1>
      <p class="sub">Everything you have told Dossier, kept as source material—not rewritten into a hidden profile.</p>
    </div>

    <div class="header-right">
      <div class="medium-tabs" role="tablist" aria-label="Library type">
        <button role="tab" aria-selected={mediumView === "movie"} class:active={mediumView === "movie"} onclick={() => (mediumView = "movie")}>Films</button>
        <button role="tab" aria-selected={mediumView === "tv"} class:active={mediumView === "tv"} onclick={() => (mediumView = "tv")}>Series</button>
      </div>
      <div class="search" role="search">
        <input
          class="search-input"
          type="search"
          autocomplete="off"
          spellcheck="false"
          placeholder="Search library…"
          aria-label="Search library"
          bind:value={search}
        />
        {#if search.trim().length > 0}
          <button
            class="clear-btn"
            type="button"
            aria-label="Clear search"
            title="Clear"
            onclick={() => (search = "")}
          >
            <IconXBold class="icon-16" />
          </button>
        {/if}
      </div>
    </div>
  </header>

  {#if preferences.error}
    <div class="error" role="alert">
      <strong>Preferences backend unavailable.</strong>
      <span>{preferences.error}</span>
    </div>
  {/if}

  {#if !preferences.loaded}
    <p class="muted">Loading…</p>
  {:else if isSearching && filteredSections.length === 0}
    <p class="muted">No matches for "{search.trim()}".</p>
  {:else}
    <div class="library-sections" use:motionStaggerChildren>
    {#each filteredSections as section (section.id)}
      <Carousel
        title={section.title}
        films={section.films}
        emptyHint={section.empty}
        onSelect={(f) => openModal(f, section.exclude)}
        onFullscreen={() => (rerate = { title:section.title, items:[...section.films] })}
      />
    {/each}
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
    excludeActions={modalExclude}
  />
{/if}
{#if rerate}<LibraryReRate title={rerate.title} items={rerate.items} onClose={() => rerate=null} />{/if}

<style>
  .screen { padding:clamp(24px,3.5vw,56px); display: flex; flex-direction: column; gap: clamp(28px,4vw,52px);max-width:1500px;margin:auto; }

  .header {
    display: grid;
    grid-template-columns: 1fr minmax(220px, 340px);
    gap: var(--space-4);
    align-items: start;
  }

  .header-left h1 { margin:7px 0 0; }
  .sub { color: var(--text-secondary); margin: var(--space-1) 0 0; font-size: 0.9rem; }

  .header-right {
    display: flex;
    flex-direction:column;
    align-items:flex-end;
    gap:10px;
    justify-content: flex-end;
  }

  .medium-tabs{display:inline-flex;padding:3px;border:1px solid var(--border-subtle);border-radius:12px;background:color-mix(in srgb,var(--base-secondary) 66%,transparent)}
  .medium-tabs button{min-height:32px;padding:0 13px;border:0;border-radius:9px;background:transparent;color:var(--text-tertiary);font:inherit;font-size:.78rem;cursor:pointer}
  .medium-tabs button.active{background:var(--text-primary);color:var(--base);box-shadow:var(--shadow-sm)}

  .search {
    position: relative;
    width: 100%;
  }

  .search-input {
    width: 100%;
    min-height: 40px;
    padding: var(--space-2) var(--space-3);
    padding-right: 40px;
    font-family: var(--font-body);
    font-size: 0.9rem;
    line-height: 1.3;
    color: var(--text-primary);
    background: var(--glass-fill);
    backdrop-filter:blur(var(--glass-blur));
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    transition: border-color var(--duration-standard) var(--ease-out),
                background-color var(--duration-standard) var(--ease-out);
  }

  .search-input::placeholder { color: var(--text-tertiary); }

  .search-input:focus {
    outline: none;
    border-color: var(--primary-accent);
    background: var(--base);
  }

  .clear-btn {
    position: absolute;
    top: 50%;
    right: var(--space-2);
    transform: translateY(-50%);
    width: 28px;
    height: 28px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 999px;
    color: var(--text-tertiary);
    cursor: pointer;
    transition: background var(--duration-standard) var(--ease-out),
                color var(--duration-standard) var(--ease-out);
  }

  .clear-btn:hover {
    background: var(--base-secondary);
    color: var(--text-secondary);
  }
  .library-sections{display:flex;flex-direction:column;gap:46px}

  @media (max-width: 720px) {
    .header {
      grid-template-columns: 1fr;
    }
    .header-right {
      justify-content: flex-start;
      align-items:stretch;
    }
  }

  .muted { color: var(--text-tertiary); }
  .error {
    background: color-mix(in srgb, var(--danger, #f85149) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--danger, #f85149) 40%, transparent);
    color: var(--text-primary);
    padding: var(--space-3);
    border-radius: var(--radius-md);
    font-size: 0.85rem;
  }
  .error strong { color: var(--danger, #f85149); }
</style>
