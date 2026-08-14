<script lang="ts">
  import type { TmdbItem } from "$lib/types";
  import { posterUrl } from "$lib/poster";
  import IconBookmarkSimpleFill from "phosphor-icons-svelte/IconBookmarkSimpleFill.svelte";
  import IconProhibitRegular from "phosphor-icons-svelte/IconProhibitRegular.svelte";
  import IconThumbsUpFill from "phosphor-icons-svelte/IconThumbsUpFill.svelte";
  import IconThumbsDownFill from "phosphor-icons-svelte/IconThumbsDownFill.svelte";
  import { motionHoverLift } from "$lib/design/motion";

  let {
    item,
    score = null,
    reason = null,
    onSelect,
    onLike,
    onWatchlist,
    onIgnore,
    onDislike
  }: {
    item: TmdbItem;
    score?: number | null;
    reason?: string | null;
    /** Called when the user clicks the poster — opens the detail modal. */
    onSelect?: (item: TmdbItem) => void;
    onLike?: (item: TmdbItem) => void;
    onWatchlist?: (item: TmdbItem) => void;
    onIgnore?: (item: TmdbItem) => void;
    onDislike?: (item: TmdbItem) => void;
  } = $props();

  const poster = $derived(posterUrl(item.posterPath, "w342"));
</script>

<article class="card" title={reason ?? undefined} use:motionHoverLift>
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
    <div class="identity" aria-hidden="true">
      <strong>{item.title}</strong>
      {#if item.year}<span>{item.year}</span>{/if}
    </div>
  </div>
</article>

<style>
  .card {
    position: relative;
    background: var(--base-tertiary);
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 1px 2px color-mix(in srgb,var(--text-primary) 10%,transparent), 0 8px 24px color-mix(in srgb,var(--text-primary) 6%,transparent);
    transition: box-shadow var(--duration-standard) var(--ease-out),
                transform var(--duration-standard) var(--ease-out);
  }
  .card:hover {
    box-shadow: var(--shadow-md, 0 4px 16px rgba(0, 0, 0, 0.14));
    transform: translateY(-2px);
  }
  .poster-wrap {
    position: relative;
    aspect-ratio: 2 / 3;
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
  .identity {
    position:absolute;
    inset:auto 0 0;
    z-index:1;
    display:flex;
    flex-direction:column;
    gap:2px;
    padding:34px 12px 11px;
    color:white;
    background:linear-gradient(180deg,transparent,rgba(9,10,12,.78) 54%,rgba(9,10,12,.9));
    text-shadow:0 1px 8px rgba(0,0,0,.5);
    pointer-events:none;
  }
  .identity strong {
    font-family:var(--font-display);
    font-size:.84rem;
    line-height:1.22;
    display:-webkit-box;
    -webkit-line-clamp:2;
    line-clamp:2;
    -webkit-box-orient:vertical;
    overflow:hidden;
  }
  .identity span { font-size:.68rem; color:rgba(255,255,255,.72); }
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
  @media (hover:none), (pointer:coarse) {
    .overlay-actions {
      top:8px;
      right:8px;
      opacity:1;
      pointer-events:auto;
      gap:6px;
    }
    .overlay-btn { width:32px; height:32px; }
  }
</style>
