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
    score,
    reason = null,
    onSelect,
    onLike,
    onWatchlist,
    onIgnore,
    onDislike
  }: {
    item: TmdbItem;
    score: number;
    /** Taste-cluster label this pick matched best, e.g. "Comedy, Drama" —
     * shown so the hero explains itself instead of just asserting "top pick". */
    reason?: string | null;
    onSelect?: (item: TmdbItem) => void;
    onLike?: (item: TmdbItem) => void;
    onWatchlist?: (item: TmdbItem) => void;
    onIgnore?: (item: TmdbItem) => void;
    onDislike?: (item: TmdbItem) => void;
  } = $props();

  const poster = $derived(posterUrl(item.posterPath, "w500"));
</script>

<article class="hero">
  <button
    type="button"
    class="poster-btn"
    onclick={() => onSelect?.(item)}
    aria-label={`See details for ${item.title}`}
    disabled={!onSelect}
  >
    {#if poster}
      <img class="poster" src={poster} alt="" />
    {:else}
      <div class="poster poster-empty" aria-hidden="true"></div>
    {/if}
  </button>

  <div class="info">
    <span class="eyebrow">
      Top pick for you{#if reason}<span class="eyebrow-reason"> · because you like {reason}</span>{/if}
    </span>
    <h2 class="title">{item.title}</h2>
    <p class="meta">
      {#if item.year}<span>{item.year}</span>{/if}
      {#if item.genres.length > 0}<span class="dot">·</span><span>{item.genres.slice(0, 3).join(", ")}</span>{/if}
    </p>
    {#if item.overview}
      <p class="overview">{item.overview}</p>
    {/if}

    <div class="actions">
      {#if onLike}
        <button class="action-btn like" onclick={() => onLike?.(item)} aria-label="Like" title="Like">
          <IconThumbsUpFill class="icon-16" />
        </button>
      {/if}
      {#if onDislike}
        <button class="action-btn dislike" onclick={() => onDislike?.(item)} aria-label="Dislike" title="Dislike">
          <IconThumbsDownFill class="icon-16" />
        </button>
      {/if}
      {#if onWatchlist}
        <button class="action-btn watchlist" onclick={() => onWatchlist?.(item)} aria-label="Add to watchlist" title="Add to watchlist">
          <IconBookmarkSimpleFill class="icon-16" />
        </button>
      {/if}
      {#if onIgnore}
        <button class="action-btn ignore" onclick={() => onIgnore?.(item)} aria-label="Not interested" title="Not interested">
          <IconProhibitRegular class="icon-16" />
        </button>
      {/if}
    </div>
  </div>

  <div class="ring-wrap">
    <MatchRing value={score * 100} size={64} />
  </div>
</article>

<style>
  .hero {
    display: grid;
    grid-template-columns: minmax(140px, 200px) 1fr auto;
    gap: var(--space-5);
    align-items: center;
    background: var(--base-secondary);
    border-radius: var(--radius-lg);
    padding: var(--space-4);
    box-shadow: var(--shadow-md, 0 4px 16px rgba(0, 0, 0, 0.1));
  }
  .poster-btn {
    padding: 0;
    border: 0;
    background: var(--base-tertiary);
    cursor: pointer;
    display: block;
    border-radius: var(--radius-md);
    overflow: hidden;
  }
  .poster-btn:disabled { cursor: default; }
  .poster {
    width: 100%;
    aspect-ratio: 2 / 3;
    object-fit: cover;
    display: block;
  }
  .poster-empty { background: linear-gradient(135deg, var(--base-tertiary), var(--base-secondary)); }

  .info { min-width: 0; display: flex; flex-direction: column; gap: var(--space-1); }
  .eyebrow {
    color: var(--accent);
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .eyebrow-reason {
    color: var(--text-tertiary);
    font-weight: 600;
    text-transform: none;
    letter-spacing: normal;
  }
  .title {
    font-family: var(--font-display);
    font-size: 1.4rem;
    color: var(--text-primary);
    margin: 0;
  }
  .meta { color: var(--text-secondary); font-size: 0.85rem; margin: 0; display: flex; gap: var(--space-1); }
  .dot { color: var(--text-tertiary); }
  .overview {
    color: var(--text-secondary);
    font-size: 0.85rem;
    line-height: 1.5;
    margin: var(--space-1) 0 0;
    max-width: 60ch;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
  }
  .actions {
    display: flex;
    gap: var(--space-2);
    margin-top: var(--space-3);
  }
  .action-btn {
    width: 38px;
    height: 38px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    border: 1px solid var(--border-subtle);
    background: var(--base-tertiary);
    color: var(--text-primary);
    cursor: pointer;
    transition: background var(--duration-standard) var(--ease-out),
                transform var(--duration-quick) var(--ease-out);
  }
  .action-btn:hover { transform: translateY(-1px) scale(1.04); }
  .action-btn.like:hover { background: color-mix(in srgb, var(--success, #2ea043) 20%, var(--base-tertiary)); color: var(--success, #2ea043); }
  .action-btn.dislike:hover { background: color-mix(in srgb, var(--danger, #f85149) 20%, var(--base-tertiary)); color: var(--danger, #f85149); }
  .action-btn.watchlist:hover { background: color-mix(in srgb, var(--accent) 20%, var(--base-tertiary)); color: var(--accent); }
  .action-btn.ignore:hover { background: color-mix(in srgb, var(--text-secondary) 20%, var(--base-tertiary)); }

  .ring-wrap { flex: none; padding-right: var(--space-2); }

  @media (max-width: 720px) {
    .hero { grid-template-columns: 100px 1fr; }
    .ring-wrap { display: none; }
  }
</style>
