<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { buildRatingQueue } from "$lib/discovery";
  import { preferences } from "$lib/state/preferences.svelte";
  import { catalogueMode } from "$lib/state/catalogue-mode.svelte";
  import { posterUrl } from "$lib/poster";
  import {
    itemKey,
    RATING_DISLIKE,
    RATING_LIKE,
    RATING_NOT_INTERESTED,
    RATING_WATCHLIST,
    type Rating,
    type TmdbItem
  } from "$lib/types";
  import MovieDetailModal from "$lib/components/MovieDetailModal.svelte";
  import IconThumbsUpFill from "phosphor-icons-svelte/IconThumbsUpFill.svelte";
  import IconThumbsDownFill from "phosphor-icons-svelte/IconThumbsDownFill.svelte";
  import IconEyeSlashRegular from "phosphor-icons-svelte/IconEyeSlashRegular.svelte";
  import IconBookmarkSimpleFill from "phosphor-icons-svelte/IconBookmarkSimpleFill.svelte";
  import IconProhibitRegular from "phosphor-icons-svelte/IconProhibitRegular.svelte";
  import IconArrowUUpLeftRegular from "phosphor-icons-svelte/IconArrowUUpLeftRegular.svelte";

  type Action = "like" | "dislike" | "skip" | "watchlist" | "not_interested";

  type HistoryEntry = {
    item: TmdbItem;
    action: Action;
    priorRating: Rating | null;
    priorSkipped: boolean;
  };

  let queue = $state<TmdbItem[]>([]);
  let queuePage = 1;
  let loadingQueue = $state(false);
  let queueError = $state<string | null>(null);
  let busy = $state(false);
  let lastAction = $state<Action | null>(null);
  let history = $state<HistoryEntry[]>([]);
  let pinned = $state<TmdbItem | null>(null);
  let modalItem = $state<TmdbItem | null>(null);
  // Lags behind `current` while an exit animation is in progress so the
  // {#key} block keeps the card mounted for the full animation duration.
  let displayedItem = $state<TmdbItem | null>(null);
  let animating = $state(false);

  // The visible queue excludes anything already rated/skipped this session.
  const visibleQueue = $derived(
    queue.filter((i) => !preferences.excludedKeys().has(itemKey(i.medium, i.id)))
  );
  const current = $derived<TmdbItem | null>(pinned ?? visibleQueue[0] ?? null);
  const nextItem = $derived<TmdbItem | null>(pinned ? (visibleQueue[0] ?? null) : (visibleQueue[1] ?? null));

  // Keep displayedItem in sync with current, but freeze it during animations.
  $effect(() => {
    const c = current;
    if (!animating) displayedItem = c;
  });

  // Preload the next poster so it's in cache when the card appears.
  $effect(() => {
    const next = nextItem;
    if (!next?.posterPath) return;
    const url = posterUrl(next.posterPath, "w500");
    if (url) {
      const img = new Image();
      img.src = url;
    }
  });

  let actionError = $state<string | null>(null);

  async function fetchMore(): Promise<void> {
    if (loadingQueue) return;
    loadingQueue = true;
    queueError = null;
    try {
      const page = await buildRatingQueue(
        catalogueMode.medium,
        preferences.excludedKeys(),
        queuePage
      );
      queuePage += 1;
      // Dedupe against what we already hold.
      const have = new Set(queue.map((i) => itemKey(i.medium, i.id)));
      queue = [...queue, ...page.filter((i) => !have.has(itemKey(i.medium, i.id)))];
    } catch (err) {
      queueError = err instanceof Error ? err.message : String(err);
    } finally {
      loadingQueue = false;
    }
  }

  onMount(() => {
    void preferences.hydrate();
  });

  // Reset and refill the queue whenever the medium changes. Only the
  // mode is a dependency — the reset/fetch must not re-trigger this
  // effect (fetchMore touches loadingQueue/queue), so it runs untracked.
  $effect(() => {
    catalogueMode.mode; // track
    untrack(() => {
      queue = [];
      queuePage = 1;
      pinned = null;
      void fetchMore();
    });
  });

  // Keep the queue topped up as the user rates through it. Tracks the
  // visible-queue length; the fetch itself is untracked.
  $effect(() => {
    const low = preferences.loaded && visibleQueue.length < 5;
    untrack(() => {
      if (low && !loadingQueue) void fetchMore();
    });
  });

  function ratingFor(action: Action): Rating | null {
    if (action === "like") return RATING_LIKE;
    if (action === "dislike") return RATING_DISLIKE;
    if (action === "watchlist") return RATING_WATCHLIST;
    if (action === "not_interested") return RATING_NOT_INTERESTED;
    return null;
  }

  async function decide(action: Action, item: TmdbItem | null = current): Promise<void> {
    if (!item || busy) return;
    busy = true;
    actionError = null;
    const key = itemKey(item.medium, item.id);
    const isDisplayed = displayedItem !== null && itemKey(displayedItem.medium, displayedItem.id) === key;

    if (isDisplayed) {
      lastAction = action;
      animating = true;
    }

    const entry: HistoryEntry = {
      item,
      action,
      priorRating: preferences.ratingForKey(key) ?? null,
      priorSkipped: preferences.skipped.includes(key)
    };

    try {
      if (action === "skip") {
        if (entry.priorRating !== null) await preferences.setRating(item, null);
        if (!entry.priorSkipped) await preferences.skip(item.medium, item.id);
      } else {
        if (entry.priorSkipped) await preferences.unskip(key);
        await preferences.setRating(item, ratingFor(action));
      }
      history = [...history, entry];
      pinned = null;

      if (isDisplayed) {
        await new Promise<void>(r => setTimeout(r, 320));
      }
    } catch (err) {
      actionError = err instanceof Error ? err.message : String(err);
      lastAction = null;
      animating = false;
    } finally {
      lastAction = null;
      animating = false;
      busy = false;
    }
  }

  async function undo(): Promise<void> {
    if (busy || history.length === 0) return;
    const entry = history[history.length - 1];
    const key = itemKey(entry.item.medium, entry.item.id);
    busy = true;
    actionError = null;
    try {
      if (entry.action === "skip") {
        if (!entry.priorSkipped) await preferences.unskip(key);
      } else {
        await preferences.setRating(entry.item, entry.priorRating);
        if (entry.priorSkipped && !preferences.skipped.includes(key)) {
          await preferences.skip(entry.item.medium, entry.item.id);
        }
      }
      history = history.slice(0, -1);
      pinned = entry.item;
    } catch (err) {
      actionError = err instanceof Error ? err.message : String(err);
    } finally {
      busy = false;
    }
  }

  function handleKey(event: KeyboardEvent): void {
    if (event.repeat) return;
    if (modalItem) return;
    if (event.key === "ArrowRight") { event.preventDefault(); void decide("like"); }
    else if (event.key === "ArrowLeft") { event.preventDefault(); void decide("dislike"); }
    else if (event.key === "ArrowUp") { event.preventDefault(); void decide("watchlist"); }
    else if (event.key === "ArrowDown") { event.preventDefault(); void decide("not_interested"); }
    else if (event.key === " " || event.code === "Space") {
      event.preventDefault();
      void decide("skip");
    } else if (event.key === "Backspace") {
      event.preventDefault();
      void undo();
    }
  }
</script>

<svelte:window on:keydown={handleKey} />

<section class="screen">
  <header class="header">
    <div class="header-row">
      <div></div>
      <h1>Rate films</h1>
      <button
        class="undo-top"
        disabled={busy || history.length === 0}
        onclick={() => void undo()}
        aria-label="Undo last rating"
        title="Undo (Backspace)"
      >
        <IconArrowUUpLeftRegular class="icon-20" />
      </button>
    </div>
    <p class="hint">
      <kbd>←</kbd> dislike · <kbd>→</kbd> like · <kbd>↓</kbd> don't show again · <kbd>↑</kbd> watchlist · <kbd>Space</kbd> haven't seen · <kbd>⌫</kbd> undo
    </p>
    <p class="count">{preferences.ratingCount()} rated</p>
  </header>

  {#if preferences.error}
    <div class="error" role="alert">
      <strong>Preferences backend unavailable.</strong>
      <span>{preferences.error}</span>
    </div>
  {/if}
  {#if actionError}
    <div class="error" role="alert">{actionError}</div>
  {/if}
  {#if queueError}
    <div class="error" role="alert">Couldn't load titles from TMDB: {queueError}</div>
  {/if}

  <div class="stage">
    {#if !preferences.loaded || (visibleQueue.length === 0 && loadingQueue)}
      <p class="muted">Loading titles…</p>
    {:else if !displayedItem}
      <div class="empty">
        <h2>That's everything for now.</h2>
        <p>You've rated the titles we pulled in. Check your recommendations, or come back later for fresh picks.</p>
      </div>
    {:else}
      {#key itemKey(displayedItem.medium, displayedItem.id)}
        <div class="card-row">
          <article
            class="card"
            class:swipe-right={lastAction === "like"}
            class:swipe-left={lastAction === "dislike"}
            class:fade-up={lastAction === "skip"}
            class:fade-watchlist={lastAction === "watchlist"}
            class:fade-not-interested={lastAction === "not_interested"}
          >
            <button
              type="button"
              class="poster-btn"
              onclick={() => (modalItem = displayedItem)}
              aria-label={`See details for ${displayedItem.title}`}
            >
              {#if posterUrl(displayedItem.posterPath, "w500")}
                <img class="poster" src={posterUrl(displayedItem.posterPath, "w500")} alt="" />
              {:else}
                <div class="poster poster-empty"></div>
              {/if}
            </button>

            <div class="card-body">
              <h2 class="title">{displayedItem.title}</h2>
              <p class="meta">
                {#if displayedItem.year}<span>{displayedItem.year}</span>{/if}
                {#if displayedItem.voteAverage}<span class="dot">·</span><span>★ {displayedItem.voteAverage.toFixed(1)}</span>{/if}
              </p>
              {#if displayedItem.genres.length > 0}
                <p class="genres">{displayedItem.genres.join(" · ")}</p>
              {/if}
            </div>
          </article>

          <div class="rail">
            <button
              class="rail-btn ignore"
              disabled={busy}
              onclick={() => decide("not_interested")}
              aria-label="Don't show again"
              title="Don't show again (↓)"
            >
              <IconProhibitRegular class="icon-24" />
            </button>
            <button
              class="rail-btn watchlist"
              disabled={busy}
              onclick={() => decide("watchlist")}
              aria-label="Add to watchlist"
              title="Add to watchlist (↑)"
            >
              <IconBookmarkSimpleFill class="icon-24" />
            </button>
          </div>
        </div>
      {/key}
    {/if}
  </div>

  <div class="actions">
    <button class="btn btn-dislike" disabled={!current || busy} onclick={() => decide("dislike")} aria-label="Dislike">
      <IconThumbsDownFill class="icon-20" />
      <span>Dislike</span>
    </button>
    <button class="btn btn-skip" disabled={!current || busy} onclick={() => decide("skip")} aria-label="Haven't seen">
      <IconEyeSlashRegular class="icon-20" />
      <span>Haven't seen</span>
    </button>
    <button class="btn btn-like" disabled={!current || busy} onclick={() => decide("like")} aria-label="Like">
      <IconThumbsUpFill class="icon-20" />
      <span>Like</span>
    </button>
  </div>
</section>

{#if modalItem}
  <MovieDetailModal
    item={modalItem}
    onClose={() => (modalItem = null)}
    onLike={(f) => void decide("like", f)}
    onWatchlist={(f) => void decide("watchlist", f)}
    onSkip={(f) => void decide("skip", f)}
    onIgnore={(f) => void decide("not_interested", f)}
    onDislike={(f) => void decide("dislike", f)}
  />
{/if}

<style>
  .screen {
    height: 100%;
    display: flex;
    flex-direction: column;
    padding: var(--space-6);
    gap: var(--space-4);
    min-height: 0;
  }
  .header {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-1);
  }
  .header-row {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    width: 100%;
    gap: var(--space-3);
  }
  .header h1 {
    font-family: var(--font-display);
    font-size: 1.5rem;
    color: var(--text-primary);
    margin: 0;
    text-align: center;
  }
  .undo-top {
    justify-self: end;
    width: 38px;
    height: 38px;
    border-radius: var(--radius-md);
    background: var(--base-secondary);
    border: 1px solid var(--border-subtle);
    color: var(--text-secondary);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: background var(--duration-standard) var(--ease-out),
                color var(--duration-standard) var(--ease-out),
                transform var(--duration-quick) var(--ease-out);
  }
  .undo-top:hover:not(:disabled) { background: var(--base-tertiary); color: var(--text-primary); transform: translateY(-1px); }
  .undo-top:disabled { opacity: 0.4; cursor: not-allowed; }

  .hint {
    color: var(--text-tertiary);
    font-size: 0.8rem;
    margin: 0;
    text-align: center;
    max-width: 720px;
    line-height: 1.6;
  }
  kbd {
    background: var(--base-tertiary);
    border: 1px solid var(--border-subtle);
    border-radius: 4px;
    padding: 0 6px;
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--text-secondary);
  }
  .count { color: var(--text-tertiary); font-size: 0.8rem; margin: 0; }

  .stage {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 0;
    overflow: hidden;
  }
  .card {
    /* Sized so the poster never crowds the title row or the action bar:
       compute against viewport height after deducting header + action row. */
    width: min(320px, 80vw);
    background: var(--base-secondary);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-lg);
    overflow: hidden;
    box-shadow: var(--shadow-lg);
    display: flex;
    flex-direction: column;
    animation: enter 240ms var(--ease-out);
    max-height: 100%;
  }
  @keyframes enter {
    from { opacity: 0; transform: translateY(8px) scale(0.98); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
  .card.swipe-right { animation: swipeRight 300ms var(--ease-in-out) forwards; }
  .card.swipe-left { animation: swipeLeft 300ms var(--ease-in-out) forwards; }
  .card.fade-up { animation: fadeUp 300ms var(--ease-in-out) forwards; }
  .card.fade-watchlist { animation: fadeWatchlist 300ms var(--ease-in-out) forwards; }
  .card.fade-not-interested { animation: fadeNotInterested 300ms var(--ease-in-out) forwards; }
  @keyframes swipeRight { to { transform: translateX(110%) rotate(8deg); opacity: 0; } }
  @keyframes swipeLeft { to { transform: translateX(-110%) rotate(-8deg); opacity: 0; } }
  @keyframes fadeUp { to { transform: translateY(-20px); opacity: 0; } }
  @keyframes fadeWatchlist { to { transform: translateY(-30px) scale(1.02); opacity: 0; } }
  @keyframes fadeNotInterested { to { transform: translateY(20px) scale(0.96); opacity: 0; } }

  .card-row {
    display: flex;
    align-items: flex-end;
    gap: var(--space-3);
    max-height: 100%;
  }
  .poster-btn {
    width: 100%;
    padding: 0;
    border: 0;
    background: var(--base-tertiary);
    cursor: pointer;
    display: block;
  }
  .poster {
    width: 100%;
    aspect-ratio: 2 / 3;
    object-fit: cover;
    background: var(--base-tertiary);
    display: block;
  }
  .poster-empty { background: linear-gradient(135deg, var(--base-tertiary), var(--base-secondary)); }

  /* Reels-style action rail sitting alongside the poster, bottom-aligned. */
  .rail {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding-bottom: var(--space-3);
  }
  .rail-btn {
    width: 48px;
    height: 48px;
    border-radius: 999px;
    border: 1px solid var(--border-subtle);
    background: var(--base-secondary);
    color: var(--text-primary);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.08));
    transition: background var(--duration-standard) var(--ease-out),
                border-color var(--duration-standard) var(--ease-out),
                color var(--duration-standard) var(--ease-out),
                transform var(--duration-quick) var(--ease-out);
  }
  .rail-btn:hover:not(:disabled) { transform: translateY(-1px) scale(1.04); background: var(--base-tertiary); }
  .rail-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .rail-btn.watchlist { color: var(--accent); border-color: color-mix(in srgb, var(--accent) 40%, var(--border-subtle)); }
  .rail-btn.watchlist:hover { background: color-mix(in srgb, var(--accent) 12%, var(--base-secondary)); }
  .rail-btn.ignore { color: var(--text-primary); }
  .rail-btn.ignore:hover { background: color-mix(in srgb, var(--danger, #f85149) 12%, var(--base-secondary)); color: var(--danger, #f85149); }

  .card-body {
    padding: var(--space-3) var(--space-4) var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  .title {
    margin: 0;
    font-family: var(--font-display);
    font-size: 1.1rem;
    color: var(--text-primary);
  }
  .meta { color: var(--text-secondary); margin: 0; font-size: 0.85rem; display: flex; gap: var(--space-1); }
  .dot { color: var(--text-tertiary); }
  .genres { color: var(--text-tertiary); font-size: 0.8rem; margin: 0; }

  .actions {
    display: flex;
    justify-content: center;
    gap: var(--space-3);
    flex-wrap: wrap;
  }
  .btn {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius-md);
    border: 1px solid var(--border-subtle);
    background: var(--base-secondary);
    color: var(--text-primary);
    font-family: var(--font-body);
    font-size: 0.9rem;
    cursor: pointer;
    transition: background var(--duration-standard) var(--ease-out),
                border-color var(--duration-standard) var(--ease-out),
                transform var(--duration-quick) var(--ease-out);
  }
  .btn:hover:not(:disabled) { background: var(--base-tertiary); transform: translateY(-1px); }
  .btn:active:not(:disabled) { transform: translateY(0); }
  .btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .btn-like { color: var(--success, #2ea043); }
  .btn-dislike { color: var(--danger, #f85149); }
  .btn-skip { color: var(--text-primary); }

  .empty { text-align: center; max-width: 360px; }
  .empty h2 { font-family: var(--font-display); color: var(--text-primary); }
  .empty p { color: var(--text-secondary); }
  .muted { color: var(--text-tertiary); }
  .error {
    background: color-mix(in srgb, var(--danger, #f85149) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--danger, #f85149) 40%, transparent);
    color: var(--text-primary);
    padding: var(--space-3);
    border-radius: var(--radius-md);
    font-size: 0.85rem;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    max-width: 640px;
    margin: 0 auto;
  }
  .error strong { color: var(--danger, #f85149); }
</style>
