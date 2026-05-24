<script lang="ts">
  import { onMount } from "svelte";
  import { loadCatalogueIndex } from "$lib/catalogue";
  import { preferences } from "$lib/state/preferences.svelte";
  import { toasts } from "$lib/state/toast.svelte";
  import {
    RATING_DISLIKE,
    RATING_LIKE,
    RATING_NOT_INTERESTED,
    RATING_WATCHLIST,
    type CatalogueIndex,
    type FilmIndexEntry,
    type Rating
  } from "$lib/types";
  import Carousel from "$lib/components/Carousel.svelte";
  import MovieDetailModal, { type ModalActionKind } from "$lib/components/MovieDetailModal.svelte";

  let catalogue = $state<CatalogueIndex | null>(null);
  let modalFilm = $state<FilmIndexEntry | null>(null);
  let modalExclude = $state<ModalActionKind[]>([]);

  const filmsById = $derived(
    catalogue ? new Map(catalogue.films.map((f) => [f.id, f])) : new Map<number, FilmIndexEntry>()
  );

  function lookup(ids: number[]): FilmIndexEntry[] {
    const out: FilmIndexEntry[] = [];
    for (const id of ids) {
      const f = filmsById.get(id);
      if (f) out.push(f);
    }
    return out;
  }

  // section.exclude maps to the modal action kind that should be hidden
  // when opening a film already filed under this section (it's already
  // there — re-applying would be a no-op).
  const sections = $derived(
    catalogue
      ? [
          { id: "watchlist",       title: "Watchlist",       exclude: "watchlist" as ModalActionKind, films: lookup(preferences.idsByKind("watchlist")),
            empty: "Films you flag from the rate screen or recommendations appear here." },
          { id: "liked",           title: "Liked",           exclude: "like" as ModalActionKind,      films: lookup(preferences.idsByKind("like")),
            empty: "Like a film and it'll land here." },
          { id: "disliked",        title: "Disliked",        exclude: "dislike" as ModalActionKind,   films: lookup(preferences.idsByKind("dislike")),
            empty: "Films you've thumbs-downed will appear here." },
          { id: "skipped",         title: "Haven't seen",    exclude: "skip" as ModalActionKind,      films: lookup(preferences.skipped),
            empty: "Films you've skipped on the rate screen appear here." },
          { id: "not-interested",  title: "Not interested",  exclude: "not_interested" as ModalActionKind, films: lookup(preferences.idsByKind("not_interested")),
            empty: "Films you've hidden with \"Don't show again\" appear here." }
        ]
      : []
  );

  onMount(() => {
    void preferences.hydrate();
    void loadCatalogueIndex().then((c) => { catalogue = c; });
  });

  function openModal(film: FilmIndexEntry, exclude: ModalActionKind): void {
    modalFilm = film;
    modalExclude = [exclude];
  }

  async function applyRating(film: FilmIndexEntry, rating: Rating, verb: string): Promise<void> {
    const priorRating = preferences.ratingFor(film.id) ?? null;
    const priorSkipped = preferences.skipped.includes(film.id);
    try {
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

  function handleLike(film: FilmIndexEntry): void { void applyRating(film, RATING_LIKE, "Liked"); }
  function handleDislike(film: FilmIndexEntry): void { void applyRating(film, RATING_DISLIKE, "Disliked"); }
  function handleWatchlist(film: FilmIndexEntry): void { void applyRating(film, RATING_WATCHLIST, "Added to watchlist"); }
  function handleIgnore(film: FilmIndexEntry): void { void applyRating(film, RATING_NOT_INTERESTED, "Won't show"); }

  async function handleSkip(film: FilmIndexEntry): Promise<void> {
    const priorRating = preferences.ratingFor(film.id) ?? null;
    const priorSkipped = preferences.skipped.includes(film.id);
    try {
      if (priorRating !== null) await preferences.setRating(film.id, null);
      if (!priorSkipped) await preferences.skip(film.id);
      toasts.show(`Marked "${film.title}" as haven't seen.`, {
        action: {
          label: "Undo",
          run: async () => {
            if (priorRating !== null) await preferences.setRating(film.id, priorRating);
            if (!priorSkipped) await preferences.unskip(film.id);
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
</script>

<section class="screen">
  <header class="header">
    <h1>Library</h1>
    <p class="sub">Everything you've told Dossier about, grouped.</p>
  </header>

  {#if preferences.error}
    <div class="error" role="alert">
      <strong>Preferences backend unavailable.</strong>
      <span>{preferences.error}</span>
    </div>
  {/if}

  {#if !catalogue || !preferences.loaded}
    <p class="muted">Loading…</p>
  {:else}
    {#each sections as section (section.id)}
      <Carousel
        title={section.title}
        films={section.films}
        emptyHint={section.empty}
        onSelect={(f) => openModal(f, section.exclude)}
      />
    {/each}
  {/if}
</section>

{#if modalFilm}
  <MovieDetailModal
    film={modalFilm}
    onClose={() => (modalFilm = null)}
    onLike={handleLike}
    onWatchlist={handleWatchlist}
    onSkip={handleSkip}
    onIgnore={handleIgnore}
    onDislike={handleDislike}
    excludeActions={modalExclude}
  />
{/if}

<style>
  .screen { padding: var(--space-6); display: flex; flex-direction: column; gap: var(--space-6); }
  .header h1 { font-family: var(--font-display); font-size: 1.75rem; color: var(--text-primary); margin: 0; }
  .sub { color: var(--text-secondary); margin: var(--space-1) 0 0; font-size: 0.9rem; }
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
