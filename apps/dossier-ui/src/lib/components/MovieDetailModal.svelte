<script lang="ts">
  import { onMount } from "svelte";
  import { loadFilmDetail } from "$lib/catalogue";
  import type { FilmDetail, FilmIndexEntry } from "$lib/types";
  import IconXBold from "phosphor-icons-svelte/IconXBold.svelte";
  import IconBookmarkSimpleFill from "phosphor-icons-svelte/IconBookmarkSimpleFill.svelte";
  import IconProhibitRegular from "phosphor-icons-svelte/IconProhibitRegular.svelte";
  import IconThumbsUpFill from "phosphor-icons-svelte/IconThumbsUpFill.svelte";
  import IconThumbsDownFill from "phosphor-icons-svelte/IconThumbsDownFill.svelte";
  import IconEyeSlashRegular from "phosphor-icons-svelte/IconEyeSlashRegular.svelte";

  export type ModalActionKind =
    | "like"
    | "watchlist"
    | "skip"
    | "not_interested"
    | "dislike";

  let {
    film,
    onClose,
    onLike,
    onWatchlist,
    onSkip,
    onIgnore,
    onDislike,
    excludeActions = []
  }: {
    film: FilmIndexEntry;
    onClose: () => void;
    onLike?: (film: FilmIndexEntry) => void | Promise<void>;
    onWatchlist?: (film: FilmIndexEntry) => void | Promise<void>;
    onSkip?: (film: FilmIndexEntry) => void | Promise<void>;
    onIgnore?: (film: FilmIndexEntry) => void | Promise<void>;
    onDislike?: (film: FilmIndexEntry) => void | Promise<void>;
    excludeActions?: ModalActionKind[];
  } = $props();

  let detail = $state<FilmDetail | null>(null);
  let loadError = $state<string | null>(null);

  function run(handler: ((f: FilmIndexEntry) => void | Promise<void>) | undefined): void {
    if (!handler) return;
    void handler(film);
    onClose();
  }

  const showLike = $derived(!!onLike && !excludeActions.includes("like"));
  const showWatchlist = $derived(!!onWatchlist && !excludeActions.includes("watchlist"));
  const showSkip = $derived(!!onSkip && !excludeActions.includes("skip"));
  const showIgnore = $derived(!!onIgnore && !excludeActions.includes("not_interested"));
  const showDislike = $derived(!!onDislike && !excludeActions.includes("dislike"));

  onMount(() => {
    void loadFilmDetail(film.id)
      .then((d) => { detail = d; })
      .catch((err) => {
        loadError = err instanceof Error ? err.message : String(err);
      });

    function handleKey(e: KeyboardEvent): void {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  });
</script>

<div
  class="backdrop"
  role="presentation"
  onclick={onClose}
  onkeydown={(e) => { if (e.key === "Escape") onClose(); }}
>
  <div
    class="modal"
    role="dialog"
    tabindex="-1"
    aria-modal="true"
    aria-labelledby="movie-modal-title"
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.stopPropagation()}
  >
    <button class="close" aria-label="Close" onclick={onClose}>
      <IconXBold class="icon-16" />
    </button>

    <div class="layout">
      <div class="poster-col">
        {#if film.poster_url}
          <img class="poster" src={film.poster_url} alt="" />
        {:else}
          <div class="poster poster-empty"></div>
        {/if}
      </div>

      <div class="info">
        <h2 class="title" id="movie-modal-title">{film.title}</h2>
        <p class="meta">
          {#if film.year}<span>{film.year}</span>{/if}
          {#if film.rating}<span class="dot">·</span><span>★ {film.rating}</span>{/if}
          {#if detail?.duration_min}<span class="dot">·</span><span>{detail.duration_min} min</span>{/if}
        </p>

        {#if film.genres.length > 0}
          <p class="genres">{film.genres.join(" · ")}</p>
        {/if}

        {#if detail?.country?.length}
          <p class="kv"><span class="k">Country</span><span>{detail.country.join(", ")}</span></p>
        {/if}

        {#if loadError}
          <p class="error">Couldn't load full details: {loadError}</p>
        {:else if !detail}
          <p class="muted">Loading details…</p>
        {:else}
          {#if detail.story}
            <p class="story">{detail.story}</p>
          {/if}

          {#if detail.themes && detail.themes.length > 0}
            <div class="chips">
              {#each detail.themes as theme}
                <span class="chip">{theme}</span>
              {/each}
            </div>
          {/if}
        {/if}

        <div class="actions">
          {#if showLike}
            <button class="action like" onclick={() => run(onLike)} aria-label="Like">
              <IconThumbsUpFill class="icon-16" />
              <span>Like</span>
            </button>
          {/if}
          {#if showWatchlist}
            <button class="action watchlist" onclick={() => run(onWatchlist)} aria-label="Add to watchlist">
              <IconBookmarkSimpleFill class="icon-16" />
              <span>Add to watchlist</span>
            </button>
          {/if}
          {#if showSkip}
            <button class="action skip" onclick={() => run(onSkip)} aria-label="Haven't seen">
              <IconEyeSlashRegular class="icon-16" />
              <span>Haven't seen</span>
            </button>
          {/if}
          {#if showIgnore}
            <button class="action ignore" onclick={() => run(onIgnore)} aria-label="Not interested">
              <IconProhibitRegular class="icon-16" />
              <span>Not interested</span>
            </button>
          {/if}
          {#if showDislike}
            <button class="action dislike" onclick={() => run(onDislike)} aria-label="Dislike">
              <IconThumbsDownFill class="icon-16" />
              <span>Dislike</span>
            </button>
          {/if}
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-5);
    z-index: 100;
    animation: backdrop-in 180ms var(--ease-out);
  }
  @keyframes backdrop-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  .modal {
    position: relative;
    background: var(--base-secondary);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    max-width: 880px;
    width: 100%;
    max-height: 90vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    animation: modal-in 200ms var(--ease-out);
  }
  @keyframes modal-in {
    from { opacity: 0; transform: translateY(8px) scale(0.98); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
  .close {
    position: absolute;
    top: var(--space-3);
    right: var(--space-3);
    width: 32px;
    height: 32px;
    border-radius: var(--radius-sm);
    background: var(--base-tertiary);
    border: 1px solid var(--border-subtle);
    color: var(--text-secondary);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    z-index: 1;
  }
  .close:hover { background: var(--base); color: var(--text-primary); }
  .layout {
    display: grid;
    grid-template-columns: 260px 1fr;
    gap: var(--space-5);
    padding: var(--space-5);
    overflow-y: auto;
  }
  @media (max-width: 640px) {
    .layout { grid-template-columns: 1fr; }
  }
  .poster-col { display: flex; flex-direction: column; gap: var(--space-3); }
  .poster {
    width: 100%;
    aspect-ratio: 2 / 3;
    object-fit: cover;
    border-radius: var(--radius-md);
    background: var(--base-tertiary);
    display: block;
  }
  .poster-empty { background: linear-gradient(135deg, var(--base-tertiary), var(--base-secondary)); }
  .info { display: flex; flex-direction: column; gap: var(--space-3); }
  .title {
    font-family: var(--font-display);
    font-size: 1.5rem;
    color: var(--text-primary);
    margin: 0;
  }
  .meta { color: var(--text-secondary); margin: 0; font-size: 0.95rem; display: flex; gap: var(--space-2); align-items: center; flex-wrap: wrap; }
  .dot { color: var(--text-tertiary); }
  .genres { color: var(--text-tertiary); margin: 0; font-size: 0.9rem; }
  .kv { display: flex; gap: var(--space-3); margin: 0; font-size: 0.9rem; color: var(--text-secondary); }
  .kv .k { color: var(--text-tertiary); min-width: 80px; }
  .story {
    color: var(--text-primary);
    line-height: 1.6;
    margin: var(--space-2) 0 0;
    font-size: 0.95rem;
    white-space: pre-wrap;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-top: var(--space-3);
  }
  .chip {
    background: var(--base-tertiary);
    border: 1px solid var(--border-subtle);
    border-radius: 999px;
    padding: 2px 10px;
    font-size: 0.75rem;
    color: var(--text-secondary);
  }
  .muted { color: var(--text-tertiary); }
  .error { color: var(--danger, #f85149); font-size: 0.85rem; }

  .actions {
    margin-top: auto;
    padding-top: var(--space-4);
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .action {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-md);
    border: 1px solid var(--border-subtle);
    background: var(--base);
    color: var(--text-primary);
    font-size: 0.85rem;
    cursor: pointer;
    transition: background var(--duration-standard) var(--ease-out),
                border-color var(--duration-standard) var(--ease-out),
                transform var(--duration-quick) var(--ease-out);
  }
  .action:hover { background: var(--base-tertiary); transform: translateY(-1px); }
  .action.like { color: var(--success, #2ea043); border-color: color-mix(in srgb, var(--success, #2ea043) 35%, var(--border-subtle)); }
  .action.dislike { color: var(--danger, #f85149); border-color: color-mix(in srgb, var(--danger, #f85149) 35%, var(--border-subtle)); }
  .action.watchlist { color: var(--accent); border-color: color-mix(in srgb, var(--accent) 40%, var(--border-subtle)); }
  .action.skip { color: var(--text-secondary); }
  .action.ignore { color: var(--text-primary); }
</style>
