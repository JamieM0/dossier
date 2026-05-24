<script lang="ts">
  import type { FilmIndexEntry } from "$lib/types";
  import IconCaretLeftBold from "phosphor-icons-svelte/IconCaretLeftBold.svelte";
  import IconCaretRightBold from "phosphor-icons-svelte/IconCaretRightBold.svelte";

  let {
    title,
    films,
    emptyHint = "",
    onSelect
  }: {
    title: string;
    films: FilmIndexEntry[];
    emptyHint?: string;
    onSelect?: (film: FilmIndexEntry) => void;
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
      {#each films as film (film.id)}
        <button
          class="tile"
          title={film.title}
          type="button"
          onclick={() => onSelect?.(film)}
          disabled={!onSelect}
        >
          {#if film.poster_url}
            <img class="poster" src={film.poster_url} alt="" loading="lazy" />
          {:else}
            <div class="poster poster-empty" aria-hidden="true"></div>
          {/if}
          <div class="caption">
            <p class="title">{film.title}</p>
            {#if film.year}
              <p class="year">{film.year}</p>
            {/if}
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
    background: var(--base-secondary);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
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
    border-color: var(--border-strong);
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
    padding: var(--space-2) var(--space-3);
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .title {
    font-family: var(--font-display);
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
    line-height: 1.3;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
  }
  .year {
    color: var(--text-tertiary);
    font-size: 0.75rem;
    margin: 0;
  }
</style>
