<script lang="ts">
  import type { TmdbItem } from "$lib/types";
  import { posterUrl } from "$lib/poster";
  import MatchRing from "$lib/components/MatchRing.svelte";
  import IconBookmarkSimpleFill from "phosphor-icons-svelte/IconBookmarkSimpleFill.svelte";
  import IconProhibitRegular from "phosphor-icons-svelte/IconProhibitRegular.svelte";
  import IconThumbsUpFill from "phosphor-icons-svelte/IconThumbsUpFill.svelte";
  import IconThumbsDownFill from "phosphor-icons-svelte/IconThumbsDownFill.svelte";

  let {
    item,
    score = null,
    onSelect,
    onLike,
    onWatchlist,
    onIgnore,
    onDislike
  }: {
    item: TmdbItem;
    score?: number | null;
    /** Called when the user clicks the poster — opens the detail modal. */
    onSelect?: (item: TmdbItem) => void;
    onLike?: (item: TmdbItem) => void;
    onWatchlist?: (item: TmdbItem) => void;
    onIgnore?: (item: TmdbItem) => void;
    onDislike?: (item: TmdbItem) => void;
  } = $props();

  const poster = $derived(posterUrl(item.posterPath, "w342"));
</script>

<article class="card">
  <div class="poster-wrap">
    <button
      class="poster-btn"
      onclick={() => onSelect?.(item)}
      aria-label={`See details for ${item.title}`}
      disabled={!onSelect}
    >
      {#if poster}
        <img class="poster" src={poster} alt="" loading="lazy" />
      {:else}
        <div class="poster poster-empty" aria-hidden="true"></div>
      {/if}
    </button>
    {#if score !== null}
      <div class="match-ring" title={`${Math.round(score * 100)}% match`}>
        <MatchRing value={score * 100} size={34} />
      </div>
    {/if}
    {#if onLike || onWatchlist || onIgnore || onDislike}
      <div class="overlay-actions">
        {#if onLike}
          <button
            class="overlay-btn like"
            title="Like"
            aria-label="Like"
            onclick={(e) => { e.stopPropagation(); onLike?.(item); }}
          >
            <IconThumbsUpFill class="icon-16" />
          </button>
        {/if}
        {#if onDislike}
          <button
            class="overlay-btn dislike"
            title="Dislike"
            aria-label="Dislike"
            onclick={(e) => { e.stopPropagation(); onDislike?.(item); }}
          >
            <IconThumbsDownFill class="icon-16" />
          </button>
        {/if}
        {#if onWatchlist}
          <button
            class="overlay-btn watchlist"
            title="Add to watchlist"
            aria-label="Add to watchlist"
            onclick={(e) => { e.stopPropagation(); onWatchlist?.(item); }}
          >
            <IconBookmarkSimpleFill class="icon-16" />
          </button>
        {/if}
        {#if onIgnore}
          <button
            class="overlay-btn ignore"
            title="Not interested"
            aria-label="Not interested"
            onclick={(e) => { e.stopPropagation(); onIgnore?.(item); }}
          >
            <IconProhibitRegular class="icon-16" />
          </button>
        {/if}
      </div>
    {/if}
  </div>
  <button
    type="button"
    class="body"
    onclick={() => onSelect?.(item)}
    aria-label={`See details for ${item.title}`}
    disabled={!onSelect}
  >
    <span class="meta">
      {#if item.year}<span class="year">{item.year}</span>{/if}
      {#if item.genres.length > 0}<span class="genres">{item.genres.slice(0, 2).join(", ")}</span>{/if}
    </span>
  </button>
</article>

<style>
  .card {
    display: flex;
    flex-direction: column;
    background: var(--base-secondary);
    border-radius: var(--radius-md);
    overflow: hidden;
    box-shadow: var(--shadow-sm, 0 1px 2px rgba(0, 0, 0, 0.06));
    transition: box-shadow var(--duration-standard) var(--ease-out),
                transform var(--duration-standard) var(--ease-out);
  }
  .card:hover {
    box-shadow: var(--shadow-md, 0 4px 16px rgba(0, 0, 0, 0.14));
    transform: translateY(-2px);
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
    height: 100%;
    aspect-ratio: 2 / 3;
    object-fit: cover;
    display: block;
  }
  .poster-empty {
    background: linear-gradient(135deg, var(--base-tertiary), var(--base-secondary));
  }
  .match-ring {
    position: absolute;
    top: var(--space-2);
    left: var(--space-2);
    filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.4));
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
    border: 1px solid rgba(255, 255, 255, 0.25);
    background: rgba(20, 22, 28, 0.4);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
    color: white;
    cursor: pointer;
    backdrop-filter: blur(14px) saturate(180%);
    -webkit-backdrop-filter: blur(14px) saturate(180%);
    transition: background var(--duration-standard) var(--ease-out),
                transform var(--duration-quick) var(--ease-out);
  }
  .overlay-btn:hover {
    background: rgba(20, 22, 28, 0.65);
    transform: scale(1.05);
  }
  .body {
    width: 100%;
    padding: var(--space-2) var(--space-3);
    display: flex;
    align-items: center;
    gap: var(--space-2);
    border: 0;
    background: none;
    text-align: left;
    font: inherit;
    color: inherit;
    cursor: pointer;
    transition: background var(--duration-standard) var(--ease-out);
  }
  .body:hover:not(:disabled) { background: var(--base-tertiary); }
  .body:disabled { cursor: default; }
  .meta {
    min-width: 0;
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
    overflow: hidden;
  }
  .year {
    flex: none;
    color: var(--text-primary);
    font-size: 0.8rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .genres {
    min-width: 0;
    color: var(--text-tertiary);
    font-size: 0.75rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
