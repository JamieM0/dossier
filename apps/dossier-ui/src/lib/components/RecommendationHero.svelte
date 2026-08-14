<script lang="ts">
  import type { TmdbItem } from "$lib/types";
  import { posterUrl } from "$lib/poster";
  import IconBookmarkSimpleFill from "phosphor-icons-svelte/IconBookmarkSimpleFill.svelte";
  import IconProhibitRegular from "phosphor-icons-svelte/IconProhibitRegular.svelte";
  import IconThumbsUpFill from "phosphor-icons-svelte/IconThumbsUpFill.svelte";
  import IconThumbsDownFill from "phosphor-icons-svelte/IconThumbsDownFill.svelte";
  import { motionReveal } from "$lib/design/motion";

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

<article class="hero" style={poster ? `--hero-art:url("${poster}")` : ""} use:motionReveal>
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
      Recommended{#if reason}<span class="eyebrow-reason"> · {reason}</span>{/if}
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

</article>

<style>
  .hero {
    position:relative;
    isolation:isolate;
    overflow:hidden;
    min-height:clamp(300px,32vw,440px);
    border-radius:20px;
    background:#17191d;
    box-shadow:0 18px 54px color-mix(in srgb,var(--text-primary) 14%,transparent);
  }
  .hero::before{content:"";position:absolute;inset:-40px;z-index:-2;background-image:var(--hero-art);background-size:cover;background-position:center 30%;filter:blur(34px) saturate(1.18);opacity:.78;transform:scale(1.1)}
  .hero::after{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(90deg,rgba(8,9,12,.86),rgba(8,9,12,.42) 52%,rgba(8,9,12,.08)),linear-gradient(0deg,rgba(8,9,12,.65),transparent 55%);pointer-events:none}
  .poster-btn {
    position:absolute;
    inset:0 auto 0 0;
    width:min(31%,280px);
    padding: 0;
    border: 0;
    background: transparent;
    cursor: pointer;
    display: block;
  }
  .poster-btn:disabled { cursor: default; }
  .poster {
    width: 100%;
    height:100%;
    object-fit: cover;
    display: block;
    -webkit-mask-image:linear-gradient(90deg,#000 72%,transparent);
    mask-image:linear-gradient(90deg,#000 72%,transparent);
  }
  .poster-empty { background: linear-gradient(135deg, var(--base-tertiary), var(--base-secondary)); }

  .info { position:absolute; z-index:2; left:clamp(180px,25%,320px); bottom:clamp(24px,4vw,54px); max-width:min(570px,58%); min-width:0; display:flex; flex-direction:column; gap:6px; color:white; }
  .eyebrow {
    color: color-mix(in srgb,var(--accent) 72%,white);
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .eyebrow-reason {
    color: rgba(255,255,255,.65);
    font-weight: 600;
    text-transform: none;
    letter-spacing: normal;
  }
  .title {
    font-family: var(--font-display);
    font-size: 1.4rem;
    color: white;
    margin: 0;
  }
  .meta { color: rgba(255,255,255,.72); font-size: 0.85rem; margin: 0; display: flex; gap: var(--space-1); }
  .dot { color: rgba(255,255,255,.4); }
  .overview {
    color: rgba(255,255,255,.76);
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
    border: 1px solid rgba(255,255,255,.22);
    background: rgba(20,22,26,.34);
    color: white;
    backdrop-filter:blur(16px) saturate(1.35);
    -webkit-backdrop-filter:blur(16px) saturate(1.35);
    cursor: pointer;
    transition: background var(--duration-standard) var(--ease-out),
                transform var(--duration-quick) var(--ease-out);
  }
  .action-btn:hover { transform: translateY(-1px) scale(1.04); }
  .action-btn.like:hover { background: color-mix(in srgb, var(--success, #2ea043) 20%, var(--base-tertiary)); color: var(--success, #2ea043); }
  .action-btn.dislike:hover { background: color-mix(in srgb, var(--danger, #f85149) 20%, var(--base-tertiary)); color: var(--danger, #f85149); }
  .action-btn.watchlist:hover { background: color-mix(in srgb, var(--accent) 20%, var(--base-tertiary)); color: var(--accent); }
  .action-btn.ignore:hover { background: color-mix(in srgb, var(--text-secondary) 20%, var(--base-tertiary)); }

  @media (max-width: 720px) {
    .hero { min-height:min(58dvh,510px); border-radius:18px; }
    .hero::after{background:linear-gradient(0deg,rgba(8,9,12,.94),rgba(8,9,12,.18) 67%,rgba(8,9,12,.06))}
    .poster-btn{inset:0;width:100%}
    .poster{-webkit-mask-image:none;mask-image:none;object-position:center 22%}
    .info{left:16px;right:16px;bottom:15px;max-width:none}
    .title{font-size:1.28rem}
    .eyebrow{font-size:.63rem}
    .eyebrow-reason{display:none}
    .overview{display:none}
    .actions{margin-top:8px}
    .action-btn{width:40px;height:40px;background:rgba(16,17,20,.48)}
  }
</style>
