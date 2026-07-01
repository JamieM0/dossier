<script lang="ts">
  import { onMount } from "svelte";
  import { posterUrl } from "$lib/poster";
  import type { TmdbItem } from "$lib/types";
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
    item,
    onClose,
    onLike,
    onWatchlist,
    onSkip,
    onIgnore,
    onDislike,
    excludeActions = []
  }: {
    item: TmdbItem;
    onClose: () => void;
    onLike?: (item: TmdbItem) => void | Promise<void>;
    onWatchlist?: (item: TmdbItem) => void | Promise<void>;
    onSkip?: (item: TmdbItem) => void | Promise<void>;
    onIgnore?: (item: TmdbItem) => void | Promise<void>;
    onDislike?: (item: TmdbItem) => void | Promise<void>;
    excludeActions?: ModalActionKind[];
  } = $props();

  // Start from the (possibly coarse) list item, enrich with the full
  // detail fetch (keywords, runtime, full overview) when it arrives.
  let detail = $state<TmdbItem>(item);
  let loadError = $state<string | null>(null);

  const poster = $derived(posterUrl(detail.posterPath, "w500"));
  const rating = $derived(detail.voteAverage ? detail.voteAverage.toFixed(1) : null);
  const decade = $derived(detail.year ? `${Math.floor(detail.year / 10) * 10}s` : null);

  function run(handler: ((i: TmdbItem) => void | Promise<void>) | undefined): void {
    if (!handler) return;
    void handler(detail);
    onClose();
  }

  const showLike = $derived(!!onLike && !excludeActions.includes("like"));
  const showWatchlist = $derived(!!onWatchlist && !excludeActions.includes("watchlist"));
  const showSkip = $derived(!!onSkip && !excludeActions.includes("skip"));
  const showIgnore = $derived(!!onIgnore && !excludeActions.includes("not_interested"));
  const showDislike = $derived(!!onDislike && !excludeActions.includes("dislike"));

  onMount(() => {
    void window.dossier?.tmdb
      ?.detail(item.medium, item.id)
      .then((d) => { detail = d; })
      .catch((err) => {
        loadError = err instanceof Error ? err.message : String(err);
      });

    function handleKey(e: KeyboardEvent): void {
      if (e.repeat) return;
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); run(onLike); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); run(onDislike); }
      else if (e.key === "ArrowUp") { e.preventDefault(); run(onWatchlist); }
      else if (e.key === "ArrowDown") { e.preventDefault(); run(onIgnore); }
      else if (e.key === " " || e.code === "Space") { e.preventDefault(); run(onSkip); }
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
        {#if poster}
          <img class="poster" src={poster} alt="" />
        {:else}
          <div class="poster poster-empty"></div>
        {/if}
      </div>

      <div class="info">
        <h2 class="title" id="movie-modal-title">{detail.title}</h2>
        <p class="meta">
          {#if detail.year}<span>{detail.year}</span>{/if}
          {#if decade}<span class="dot">·</span><span>{decade}</span>{/if}
          {#if rating}<span class="dot">·</span><span>★ {rating}</span>{/if}
          {#if detail.runtime}<span class="dot">·</span><span>{detail.runtime} min</span>{/if}
        </p>

        {#if detail.genres.length > 0}
          <p class="genres">{detail.genres.join(" · ")}</p>
        {/if}

        {#if loadError}
          <p class="error">Couldn't load full details: {loadError}</p>
        {/if}
        {#if detail.overview}
          <p class="story">{detail.overview}</p>
        {/if}
        {#if detail.keywords && detail.keywords.length > 0}
          <div class="chips">
            {#each detail.keywords.slice(0, 12) as theme}
              <span class="chip">{theme}</span>
            {/each}
          </div>
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
