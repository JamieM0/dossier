<script lang="ts">
  import type { FilmIndexEntry } from "$lib/types";

  let { film, score = null }: { film: FilmIndexEntry; score?: number | null } = $props();

  function decadeLabel(year: number | null): string {
    if (!year) return "";
    return `${Math.floor(year / 10) * 10}s`;
  }
</script>

<article class="card">
  {#if film.poster_url}
    <div class="poster">
      <img src={film.poster_url} alt="" loading="lazy" />
    </div>
  {:else}
    <div class="poster poster-empty" aria-hidden="true"></div>
  {/if}
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
  .poster {
    width: 100%;
    aspect-ratio: 2 / 3;
    background: var(--base-tertiary);
    overflow: hidden;
  }
  .poster img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .poster-empty {
    background: linear-gradient(135deg, var(--base-tertiary), var(--base-secondary));
  }
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
