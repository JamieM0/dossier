<script lang="ts">
  import type { TmdbItem } from "$lib/types";
  import { posterUrl } from "$lib/poster";
  import IconCaretLeftBold from "phosphor-icons-svelte/IconCaretLeftBold.svelte";
  import IconCaretRightBold from "phosphor-icons-svelte/IconCaretRightBold.svelte";
  import IconArrowsOutRegular from "phosphor-icons-svelte/IconArrowsOutRegular.svelte";
  import { motionHoverLift, motionPress } from "$lib/design/motion";

  let {
    title,
    films,
    emptyHint = "",
    onSelect,
    onFullscreen
  }: {
    title: string;
    films: TmdbItem[];
    emptyHint?: string;
    onSelect?: (film: TmdbItem) => void;
    onFullscreen?: () => void;
  } = $props();

  let track: HTMLDivElement | null = $state(null);

  function scrollBy(amount: number): void {
    if (track) {
      track.scrollBy({ left: amount, behavior: "smooth" });
    }
  }
</script>

<section class="carousel">
  <header class="row-header">
    <h2 class="row-title">{title}</h2>
    <span class="row-count">{films.length}</span>
    {#if films.length > 0}
      <div class="nav">
        {#if onFullscreen}
          <button class="nav-btn" aria-label={`Re-rate ${title} in fullscreen`} title="Re-rate fullscreen" onclick={onFullscreen}>
            <IconArrowsOutRegular class="icon-16" />
          </button>
        {/if}
        <button class="nav-btn" aria-label="Scroll left" onclick={() => scrollBy(-600)}>
          <IconCaretLeftBold class="icon-16" />
        </button>
        <button class="nav-btn" aria-label="Scroll right" onclick={() => scrollBy(600)}>
          <IconCaretRightBold class="icon-16" />
        </button>
      </div>
    {/if}
  </header>

  {#if films.length === 0}
    <p class="empty">{emptyHint}</p>
  {:else}
    <div class="track" bind:this={track}>
      {#each films as film (`${film.medium}:${film.id}`)}
        <button
          class="tile"
          use:motionHoverLift={{ y: -4, scale: 1.01 }}
          use:motionPress
          title={film.title}
          type="button"
          onclick={() => onSelect?.(film)}
          disabled={!onSelect}
        >
          {#if posterUrl(film.posterPath, "w342")}
            <img class="poster" src={posterUrl(film.posterPath, "w342")} alt="" loading="lazy" />
          {:else}
            <div class="poster poster-empty" aria-hidden="true"></div>
          {/if}
          <div class="caption">
            <strong>{film.title}</strong>
            {#if film.year}<p class="year">{film.year}</p>{/if}
          </div>
        </button>
      {/each}
    </div>
  {/if}
</section>

<style>
  .carousel { display: flex; flex-direction: column; gap: var(--space-3); }
  .row-header {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }
  .row-title {
    font-family: var(--font-display);
    font-size: 1.05rem;
    color: var(--text-primary);
    margin: 0;
  }
  .row-count {
    color: var(--text-tertiary);
    font-size: 0.8rem;
    font-variant-numeric: tabular-nums;
  }
  .nav {
    margin-left: auto;
    display: flex;
    gap: var(--space-1);
  }
  .nav-btn {
    width: 28px;
    height: 28px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--base-secondary);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    color: var(--text-secondary);
    cursor: pointer;
    transition: background var(--duration-standard) var(--ease-out),
                color var(--duration-standard) var(--ease-out);
  }
  .nav-btn:hover { background: var(--base-tertiary); color: var(--text-primary); }
  .empty {
    color: var(--text-tertiary);
    font-size: 0.85rem;
    margin: 0;
    padding: var(--space-3) 0;
  }
  .track {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: 160px;
    gap: var(--space-3);
    overflow-x: auto;
    overflow-y: hidden;
    padding-bottom: var(--space-2);
    scroll-snap-type: x proximity;
    scrollbar-width: thin;
    overscroll-behavior-x: contain;
  }
  .tile {
    display: flex;
    flex-direction: column;
    background:transparent;
    border:0;
    border-radius:14px;
    overflow: hidden;
    scroll-snap-align: start;
    padding: 0;
    text-align: left;
    color: inherit;
    font: inherit;
    cursor: pointer;
    transition: border-color var(--duration-standard) var(--ease-out),
                transform var(--duration-standard) var(--ease-out);
  }
  .tile:disabled { cursor: default; }
  .tile:hover:not(:disabled) {
    transform: translateY(-1px);
  }
  .poster {
    width: 100%;
    aspect-ratio: 2 / 3;
    object-fit: cover;
    display: block;
    background: var(--base-tertiary);
  }
  .poster-empty { background: linear-gradient(135deg, var(--base-tertiary), var(--base-secondary)); }
  .caption {
    padding:8px 2px 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .caption strong{font-size:.78rem;line-height:1.25;color:var(--text-primary);display:-webkit-box;-webkit-line-clamp:2;line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:2.5em}
  .year {
    color: var(--text-tertiary);
    font-size: 0.75rem;
    margin: 0;
  }
</style>
