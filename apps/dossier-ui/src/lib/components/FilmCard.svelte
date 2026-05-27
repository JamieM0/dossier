<script lang="ts">
  import type { FilmIndexEntry } from "$lib/types";
  import IconBookmarkSimpleFill from "phosphor-icons-svelte/IconBookmarkSimpleFill.svelte";
  import IconProhibitRegular from "phosphor-icons-svelte/IconProhibitRegular.svelte";
  import IconThumbsUpFill from "phosphor-icons-svelte/IconThumbsUpFill.svelte";
  import IconThumbsDownFill from "phosphor-icons-svelte/IconThumbsDownFill.svelte";

  let {
    film,
    score = null,
    onSelect,
    onLike,
    onWatchlist,
    onIgnore,
    onDislike
  }: {
    film: FilmIndexEntry;
    score?: number | null;
    /** Called when the user clicks the poster — opens the detail modal. */
    onSelect?: (film: FilmIndexEntry) => void;
    /** Called when the user clicks the "Like" overlay button. */
    onLike?: (film: FilmIndexEntry) => void;
    /** Called when the user clicks the "Add to watchlist" overlay button. */
    onWatchlist?: (film: FilmIndexEntry) => void;
    /** Called when the user clicks the "Don't show again" overlay button. */
    onIgnore?: (film: FilmIndexEntry) => void;
    /** Called when the user clicks the "Dislike" overlay button. */
    onDislike?: (film: FilmIndexEntry) => void;
  } = $props();

  function decadeLabel(year: number | null): string {
    if (!year) return "";
    return `${Math.floor(year / 10) * 10}s`;
  }
</script>

<article class="card">
  <div class="poster-wrap">
    <button
      class="poster-btn"
      onclick={() => onSelect?.(film)}
      aria-label={`See details for ${film.title}`}
      disabled={!onSelect}
    >
      {#if film.poster_url}
        <img class="poster" src={film.poster_url} alt="" loading="lazy" />
      {:else}
        <div class="poster poster-empty" aria-hidden="true"></div>
      {/if}
    </button>
    {#if onLike || onWatchlist || onIgnore || onDislike}
      <div class="overlay-actions">
        {#if onLike}
          <button
            class="overlay-btn like"
            title="Like"
            aria-label="Like"
            onclick={(e) => { e.stopPropagation(); onLike?.(film); }}
          >
            <IconThumbsUpFill class="icon-16" />
          </button>
        {/if}
        {#if onWatchlist}
          <button
            class="overlay-btn watchlist"
            title="Add to watchlist"
            aria-label="Add to watchlist"
            onclick={(e) => { e.stopPropagation(); onWatchlist?.(film); }}
          >
            <IconBookmarkSimpleFill class="icon-16" />
          </button>
        {/if}
        {#if onIgnore}
          <button
            class="overlay-btn ignore"
            title="Not interested"
            aria-label="Not interested"
            onclick={(e) => { e.stopPropagation(); onIgnore?.(film); }}
          >
            <IconProhibitRegular class="icon-16" />
          </button>
        {/if}
        {#if onDislike}
          <button
            class="overlay-btn dislike"
            title="Dislike"
            aria-label="Dislike"
            onclick={(e) => { e.stopPropagation(); onDislike?.(film); }}
          >
            <IconThumbsDownFill class="icon-16" />
          </button>
        {/if}
      </div>
    {/if}
  </div>
  <div class="body">
    <h3 class="title">{film.title}</h3>
    <p class="meta">
      {#if film.year}<span>{film.year}</span>{/if}
      {#if film.year}<span class="dot">·</span><span class="muted">{decadeLabel(film.year)}</span>{/if}
      {#if film.rating}<span class="dot">·</span><span class="rating">★ {film.rating}</span>{/if}
    </p>
    {#if film.genres.length > 0}
      <p class="genres">{film.genres.slice(0, 3).join(" · ")}</p>
    {/if}
    {#if score !== null}
      <p class="score">match {(score * 100).toFixed(0)}%</p>
    {/if}
  </div>
</article>

<style>
  .card {
    display: flex;
    flex-direction: column;
    background: var(--base-secondary);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    overflow: hidden;
    transition: border-color var(--duration-standard) var(--ease-out),
                transform var(--duration-standard) var(--ease-out);
  }
  .card:hover {
    border-color: var(--border-strong);
    transform: translateY(-1px);
  }
  .poster-wrap {
    position: relative;
  }
  .poster-btn {
    width: 100%;
    padding: 0;
    border: 0;
    background: var(--base-tertiary);
    cursor: pointer;
    display: block;
  }
  .poster-btn:disabled { cursor: default; }
  .poster {
    width: 100%;
    aspect-ratio: 2 / 3;
    object-fit: cover;
    display: block;
  }
  .poster-empty {
    background: linear-gradient(135deg, var(--base-tertiary), var(--base-secondary));
  }
  .overlay-actions {
    position: absolute;
    top: var(--space-2);
    right: var(--space-2);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    opacity: 0;
    transition: opacity var(--duration-standard) var(--ease-out);
    pointer-events: none;
  }
  .card:hover .overlay-actions,
  .card:focus-within .overlay-actions {
    opacity: 1;
    pointer-events: auto;
  }
  .overlay-btn {
    width: 30px;
    height: 30px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.18);
    background: rgba(20, 22, 28, 0.78);
    color: white;
    cursor: pointer;
    backdrop-filter: blur(6px);
    transition: background var(--duration-standard) var(--ease-out),
                transform var(--duration-quick) var(--ease-out);
  }
  .overlay-btn:hover {
    transform: scale(1.05);
  }
  .overlay-btn.like:hover { background: color-mix(in srgb, var(--success, #2ea043) 60%, rgba(20,22,28,0.78)); }
  .overlay-btn.watchlist:hover { background: color-mix(in srgb, var(--accent) 60%, rgba(20,22,28,0.78)); }
  .overlay-btn.ignore:hover { background: color-mix(in srgb, var(--text-secondary) 40%, rgba(20,22,28,0.78)); }
  .overlay-btn.dislike:hover { background: color-mix(in srgb, var(--danger, #f85149) 60%, rgba(20,22,28,0.78)); }
  .body {
    padding: var(--space-3);
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  .title {
    font-family: var(--font-display);
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
    line-height: 1.3;
  }
  .meta {
    color: var(--text-secondary);
    font-size: 0.8rem;
    display: flex;
    gap: var(--space-1);
    margin: 0;
  }
  .dot { color: var(--text-tertiary); }
  .muted { color: var(--text-tertiary); }
  .rating { color: var(--accent); font-variant-numeric: tabular-nums; }
  .genres {
    color: var(--text-tertiary);
    font-size: 0.75rem;
    margin: 0;
  }
  .score {
    margin: var(--space-1) 0 0;
    font-size: 0.75rem;
    color: var(--accent);
    font-variant-numeric: tabular-nums;
  }
</style>
