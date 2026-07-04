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
  import IconEyeSlashRegular from "phosphor-icons-svelte/IconEyeSlashRegular.svelte";
  import IconBookmarkSimpleFill from "phosphor-icons-svelte/IconBookmarkSimpleFill.svelte";
  import IconProhibitRegular from "phosphor-icons-svelte/IconProhibitRegular.svelte";
  import IconArrowUUpLeftRegular from "phosphor-icons-svelte/IconArrowUUpLeftRegular.svelte";
  import IconQuestionRegular from "phosphor-icons-svelte/IconQuestionRegular.svelte";

  /** The 7-point scale replacing the old binary like/dislike buttons. -1
   *  and +1 are deliberately the same sentinels the old "dislike"/"like"
   *  buttons always wrote (see ratingFor below and types.ts's Rating doc
   *  comment) — only 0/±2/±3 are new. */
  type RankValue = -3 | -2 | -1 | 0 | 1 | 2 | 3;
  type Action = `rank_${RankValue}` | "skip" | "watchlist" | "not_interested";

  function rankAction(v: RankValue): Action {
    return `rank_${v}`;
  }
  function rankValueOf(action: Action): RankValue | null {
    if (action === "skip" || action === "watchlist" || action === "not_interested") return null;
    return Number(action.slice(5)) as RankValue;
  }

  const RANK_STOPS: Array<{ value: RankValue; symbol: string; caption: string; full: string; shortcut: string }> = [
    { value: -3, symbol: "−−−", caption: "Extreme", full: "Extremely negative", shortcut: "1" },
    { value: -2, symbol: "−−", caption: "Fairly", full: "Fairly negative", shortcut: "2" },
    { value: -1, symbol: "−", caption: "Slightly", full: "Slightly negative", shortcut: "3" },
    { value: 0, symbol: "•", caption: "Neutral", full: "Neutral", shortcut: "4" },
    { value: 1, symbol: "+", caption: "Slightly", full: "Slightly positive", shortcut: "5" },
    { value: 2, symbol: "++", caption: "Fairly", full: "Fairly positive", shortcut: "6" },
    { value: 3, symbol: "+++", caption: "Extreme", full: "Extremely positive", shortcut: "7" }
  ];
  function stopFor(v: RankValue) {
    return RANK_STOPS.find((s) => s.value === v)!;
  }

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
  // Lags behind `current` while an exit animation is in progress so the
  // {#key} block keeps the card mounted for the full animation duration.
  let displayedItem = $state<TmdbItem | null>(null);
  let animating = $state(false);

  // The queue only carries list-shaped items (no runtime/keywords — see
  // TmdbItem's doc comment). Now that the detail modal is gone and this
  // is the only place that information is shown, fetch the full detail
  // record for whichever title is displayed (disk-cached, so repeat
  // visits are free). Falls back to the coarse item while it loads.
  let detailCache = $state<TmdbItem | null>(null);
  $effect(() => {
    const item = displayedItem;
    detailCache = null;
    if (!item) return;
    const key = itemKey(item.medium, item.id);
    void window.dossier?.tmdb
      ?.detail(item.medium, item.id)
      .then((d) => {
        if (displayedItem && itemKey(displayedItem.medium, displayedItem.id) === key) detailCache = d;
      })
      .catch(() => undefined);
  });
  const detail = $derived(detailCache ?? displayedItem);

  // Ambient per-button backgrounds (Apple Music/Spotify style): each
  // action button gets a different blurred crop of the current poster,
  // revealed on hover. BG_FOCUS picks a distinct focal point per button
  // so the backgrounds don't look identical; the same focal points are
  // used to sample average luminance from the source image so the
  // label/icon colour can flip between light and dark for contrast.
  // Indices 0-6 are the rank scale (-3..3, swept diagonally across the
  // poster negative-to-positive, echoing the old left=dislike/
  // right=like drag gesture); 7-9 are watchlist/skip/not_interested,
  // unchanged from before this scale existed.
  const BG_FOCUS = [
    { x: 6, y: 14 },   // rank -3
    { x: 20, y: 26 },  // rank -2
    { x: 34, y: 38 },  // rank -1
    { x: 50, y: 50 },  // rank 0
    { x: 66, y: 62 },  // rank +1
    { x: 80, y: 74 },  // rank +2
    { x: 94, y: 86 },  // rank +3
    { x: 55, y: 45 },  // watchlist
    { x: 25, y: 70 },  // skip
    { x: 75, y: 88 }   // not interested
  ] as const;
  const bgPoster = $derived(detail ? posterUrl(detail.posterPath, "w500") : null);
  const btnFgDefault = (): Array<"light" | "dark"> => Array(BG_FOCUS.length).fill("light");
  let btnFg = $state<Array<"light" | "dark">>(btnFgDefault());
  $effect(() => {
    const url = bgPoster;
    if (!url) {
      btnFg = btnFgDefault();
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (cancelled) return;
      try {
        const cw = 60;
        const ch = 90;
        const canvas = document.createElement("canvas");
        canvas.width = cw;
        canvas.height = ch;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, cw, ch);
        btnFg = BG_FOCUS.map(({ x, y }) => {
          const boxW = Math.round(cw * 0.4);
          const boxH = Math.round(ch * 0.25);
          const sx = Math.max(0, Math.min(cw - boxW, Math.round((x / 100) * cw - boxW / 2)));
          const sy = Math.max(0, Math.min(ch - boxH, Math.round((y / 100) * ch - boxH / 2)));
          const { data } = ctx.getImageData(sx, sy, boxW, boxH);
          let total = 0;
          let count = 0;
          for (let i = 0; i < data.length; i += 4) {
            total += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
            count += 1;
          }
          return total / count > 150 ? "dark" : "light";
        });
      } catch {
        btnFg = btnFgDefault();
      }
    };
    img.onerror = () => {
      if (!cancelled) btnFg = btnFgDefault();
    };
    img.src = url;
    return () => {
      cancelled = true;
    };
  });

  // Real drag-to-rate: the poster follows the pointer 1:1 while dragging
  // (see class:dragging disabling the transition). Horizontal distance
  // snaps into one of three bands per side (dragMagnitude), so a firm
  // flick commits ±1 ("slightly") while a longer drag reaches ±2/±3
  // ("fairly"/"extremely") — the further you drag, the stronger the
  // rating, same spirit as the old single-strength swipe but now with
  // headroom for how strongly you feel. Releasing inside the first band
  // (dead zone) springs back without committing, as before. On commit
  // the exit keyframe (swipeOut) picks up seamlessly from the live drag
  // position via the --drag-x/--drag-rot custom properties, with
  // --exit-x/--exit-rot scaled by how extreme the committed rank is.
  const DRAG_THRESHOLDS = [70, 140, 220] as const;
  function dragMagnitude(absX: number): 0 | 1 | 2 | 3 {
    if (absX < DRAG_THRESHOLDS[0]) return 0;
    if (absX < DRAG_THRESHOLDS[1]) return 1;
    if (absX < DRAG_THRESHOLDS[2]) return 2;
    return 3;
  }
  let dragging = $state(false);
  let dragX = $state(0);
  let dragXAtCommit = $state(0);
  let dragRotAtCommit = $state(0);
  let dragPointerId: number | null = null;
  let dragStartClientX = 0;
  // Live preview of the rank a release would commit right now — drives
  // the floating "stamp" label so the drag stays legible with 7 possible
  // outcomes instead of 2.
  const dragRank = $derived<RankValue>(
    dragging ? ((Math.sign(dragX) * dragMagnitude(Math.abs(dragX))) as RankValue) : 0
  );

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

  // Mirrors the hover-lit look when the same action is triggered via its
  // keyboard shortcut, so the button gives feedback without requiring the
  // mouse. Cleared the moment the next item is shown (see the displayedItem
  // effect below), never while it's still on screen.
  let keyLit = $state<Action | null>(null);
  $effect(() => {
    displayedItem;
    keyLit = null;
  });

  // Exit-throw distance/rotation for the swipeOut animation, scaled by
  // how extreme the committed rank is (magnitude 1 = a gentle toss,
  // magnitude 3 = a much harder throw) so the exit itself communicates
  // intensity, not just the stamp shown mid-drag.
  const lastRank = $derived(lastAction ? rankValueOf(lastAction) : null);
  const exitMag = $derived(lastRank !== null ? Math.abs(lastRank) : 0);
  const exitSign = $derived(lastRank !== null ? Math.sign(lastRank) : 0);
  const exitX = $derived(exitMag > 0 ? exitSign * (70 + exitMag * 20) : 0);
  const exitRot = $derived(exitMag > 0 ? exitSign * (4 + exitMag * 3) : 0);

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
    const rv = rankValueOf(action);
    if (rv !== null) {
      // -1/+1 are the original "dislike"/"like" sentinels — route through
      // the named constants so it's obvious at a glance that this rank
      // tier writes exactly what the old binary buttons always wrote.
      if (rv === 1) return RATING_LIKE;
      if (rv === -1) return RATING_DISLIKE;
      return rv;
    }
    if (action === "watchlist") return RATING_WATCHLIST;
    if (action === "not_interested") return RATING_NOT_INTERESTED;
    return null; // skip
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

  function onPosterPointerDown(event: PointerEvent): void {
    if (busy || animating || !current) return;
    dragging = true;
    dragPointerId = event.pointerId;
    dragStartClientX = event.clientX;
    dragX = 0;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  function onPosterPointerMove(event: PointerEvent): void {
    if (!dragging || event.pointerId !== dragPointerId) return;
    dragX = event.clientX - dragStartClientX;
  }

  function onPosterPointerUp(event: PointerEvent): void {
    if (!dragging || event.pointerId !== dragPointerId) return;
    // Computed from the live dragX before resetting `dragging`, since
    // dragRank (the $derived preview) goes to 0 the instant dragging
    // flips false.
    const rank = (Math.sign(dragX) * dragMagnitude(Math.abs(dragX))) as RankValue;
    dragging = false;
    dragPointerId = null;

    if (rank !== 0) {
      dragXAtCommit = dragX;
      dragRotAtCommit = dragX / 24;
      dragX = 0;
      void decide(rankAction(rank));
    } else {
      dragX = 0;
    }
  }

  function decideViaShortcut(action: Action): void {
    if (busy || !current) return;
    keyLit = action;
    void decide(action);
  }

  function handleKey(event: KeyboardEvent): void {
    if (event.repeat) return;
    if (event.key === "ArrowRight") { event.preventDefault(); decideViaShortcut(rankAction(1)); }
    else if (event.key === "ArrowLeft") { event.preventDefault(); decideViaShortcut(rankAction(-1)); }
    else if (event.key === "ArrowUp") { event.preventDefault(); decideViaShortcut("watchlist"); }
    else if (event.key === "ArrowDown") { event.preventDefault(); decideViaShortcut("not_interested"); }
    else if (event.key >= "1" && event.key <= "7") {
      event.preventDefault();
      decideViaShortcut(rankAction(RANK_STOPS[Number(event.key) - 1].value));
    } else if (event.key === " " || event.code === "Space") {
      event.preventDefault();
      decideViaShortcut("skip");
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
      <span class="hint-anchor">
        <button class="hint-btn" type="button" aria-label="Keyboard shortcuts" tabindex="0">
          <IconQuestionRegular class="icon-16" />
        </button>
        <div class="hint-popover" role="tooltip">
          <kbd>1</kbd>–<kbd>7</kbd> rate (1 extremely negative … 7 extremely positive) · <kbd>←</kbd> slightly negative · <kbd>→</kbd> slightly positive · <kbd>↓</kbd> don't show again · <kbd>↑</kbd> watchlist · <kbd>Space</kbd> haven't seen · <kbd>⌫</kbd> undo
        </div>
      </span>
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
        <div class="layout">
          <div
            class="poster-wrap"
            class:dragging
            class:swipe-out={lastRank !== null && lastRank !== 0}
            class:fade-neutral={lastRank === 0}
            class:fade-up={lastAction === "skip"}
            class:fade-watchlist={lastAction === "watchlist"}
            class:fade-not-interested={lastAction === "not_interested"}
            style={`--drag-x: ${(dragging ? dragX : dragXAtCommit)}px; --drag-rot: ${(dragging ? dragX / 24 : dragRotAtCommit)}deg; --exit-x: ${exitX}%; --exit-rot: ${exitRot}deg;`
              + (dragging ? ` transform: translateX(${dragX}px) rotate(${dragX / 24}deg);` : "")}
            role="img"
            aria-label={`Poster for ${detail.title}`}
            onpointerdown={onPosterPointerDown}
            onpointermove={onPosterPointerMove}
            onpointerup={onPosterPointerUp}
            onpointercancel={onPosterPointerUp}
          >
            {#if posterUrl(detail.posterPath, "w500")}
              <img class="poster" src={posterUrl(detail.posterPath, "w500")} alt="" draggable="false" />
            {:else}
              <div class="poster poster-empty"></div>
            {/if}
            {#if dragging && dragRank !== 0}
              <div
                class="drag-stamp"
                class:positive={dragRank > 0}
                class:negative={dragRank < 0}
                style={`--stamp-mag: ${Math.abs(dragRank)};`}
                aria-hidden="true"
              >
                <span class="stamp-symbol">{stopFor(dragRank).symbol}</span>
                <span class="stamp-label">{stopFor(dragRank).full}</span>
              </div>
            {/if}
          </div>

          <div class="info">
            <h2 class="title">{detail.title}</h2>
            <p class="meta">
              {#if detail.year}<span>{detail.year}</span>{/if}
              {#if detail.voteAverage}<span class="dot">·</span><span>★ {detail.voteAverage.toFixed(1)}</span>{/if}
              {#if detail.runtime}<span class="dot">·</span><span>{detail.runtime} min</span>{/if}
            </p>
            {#if detail.genres.length > 0}
              <p class="genres">{detail.genres.join(" · ")}</p>
            {/if}
            {#if detail.overview}
              <p class="overview">{detail.overview}</p>
            {/if}
            {#if detail.keywords && detail.keywords.length > 0}
              <div class="chips">
                {#each detail.keywords.slice(0, 12) as theme}
                  <span class="chip">{theme}</span>
                {/each}
              </div>
            {/if}

            <div class="actions">
              <div class="rank-scale" role="group" aria-label="Rate this title from extremely negative to extremely positive">
                {#each RANK_STOPS as stop (stop.value)}
                  <button
                    class="action-btn rank-btn"
                    class:fg-dark={btnFg[stop.value + 3] === "dark"}
                    class:key-lit={keyLit === rankAction(stop.value)}
                    disabled={busy}
                    onclick={() => decide(rankAction(stop.value))}
                    aria-label={stop.full}
                    title={`${stop.full} (${stop.shortcut})`}
                    style={bgPoster ? `--btn-bg-image: url("${bgPoster}"); --btn-bg-pos: ${BG_FOCUS[stop.value + 3].x}% ${BG_FOCUS[stop.value + 3].y}%;` : ""}
                  >
                    <span class="btn-surface" aria-hidden="true"></span>
                    <span class="rank-symbol" aria-hidden="true">{stop.symbol}</span>
                    <span class="rank-caption">{stop.caption}</span>
                  </button>
                {/each}
              </div>
              <button
                class="action-btn"
                class:fg-dark={btnFg[7] === "dark"}
                class:key-lit={keyLit === "watchlist"}
                disabled={busy}
                onclick={() => decide("watchlist")}
                aria-label="Add to my Watchlist"
                title="Add to my Watchlist (↑)"
                style={bgPoster ? `--btn-bg-image: url("${bgPoster}"); --btn-bg-pos: ${BG_FOCUS[7].x}% ${BG_FOCUS[7].y}%;` : ""}
              >
                <span class="btn-surface" aria-hidden="true"></span>
                <IconBookmarkSimpleFill class="icon-20" />
                <span>Add to my Watchlist</span>
              </button>
              <button
                class="action-btn"
                class:fg-dark={btnFg[8] === "dark"}
                class:key-lit={keyLit === "skip"}
                disabled={busy}
                onclick={() => decide("skip")}
                aria-label="I haven't seen it"
                title="I haven't seen it (Space)"
                style={bgPoster ? `--btn-bg-image: url("${bgPoster}"); --btn-bg-pos: ${BG_FOCUS[8].x}% ${BG_FOCUS[8].y}%;` : ""}
              >
                <span class="btn-surface" aria-hidden="true"></span>
                <IconEyeSlashRegular class="icon-20" />
                <span>I haven't seen it</span>
              </button>
              <button
                class="action-btn"
                class:fg-dark={btnFg[9] === "dark"}
                class:key-lit={keyLit === "not_interested"}
                disabled={busy}
                onclick={() => decide("not_interested")}
                aria-label="I don't care about it"
                title="I don't care about it (↓)"
                style={bgPoster ? `--btn-bg-image: url("${bgPoster}"); --btn-bg-pos: ${BG_FOCUS[9].x}% ${BG_FOCUS[9].y}%;` : ""}
              >
                <span class="btn-surface" aria-hidden="true"></span>
                <IconProhibitRegular class="icon-20" />
                <span>I don't care about it</span>
              </button>
            </div>
          </div>
        </div>
      {/key}
    {/if}
  </div>
</section>

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
    gap: var(--space-2);
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

  .hint-anchor {
    position: relative;
    justify-self: start;
    display: inline-flex;
  }
  .hint-btn {
    width: 30px;
    height: 30px;
    border-radius: 999px;
    border: 1px solid var(--border-subtle);
    background: var(--base-secondary);
    color: var(--text-tertiary);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: background var(--duration-standard) var(--ease-out), color var(--duration-standard) var(--ease-out);
  }
  .hint-btn:hover { background: var(--base-tertiary); color: var(--text-primary); }
  .hint-popover {
    position: absolute;
    top: calc(100% + var(--space-2));
    left: 0;
    width: max-content;
    max-width: 320px;
    background: var(--base-secondary);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-md, 0 4px 16px rgba(0,0,0,0.14));
    color: var(--text-secondary);
    font-size: 0.78rem;
    line-height: 1.7;
    padding: var(--space-2) var(--space-3);
    opacity: 0;
    pointer-events: none;
    transform: translateY(-4px);
    transition: opacity var(--duration-standard) var(--ease-out), transform var(--duration-standard) var(--ease-out);
    z-index: 5;
  }
  .hint-anchor:hover .hint-popover,
  .hint-anchor:focus-within .hint-popover {
    opacity: 1;
    transform: translateY(0);
    pointer-events: auto;
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
    align-items: flex-start;
    justify-content: center;
    min-height: 0;
    overflow-y: auto;
    padding: var(--space-2) 0;
  }
  .layout {
    display: grid;
    grid-template-columns: minmax(260px, 420px) 1fr;
    gap: var(--space-6);
    width: 100%;
    max-width: 1100px;
    margin: 0 auto;
    animation: enter 240ms var(--ease-out);
  }
  @keyframes enter {
    from { opacity: 0; transform: translateY(8px) scale(0.98); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
  @media (max-width: 760px) {
    .layout { grid-template-columns: 1fr; }
  }

  .poster-wrap {
    position: relative;
    border-radius: var(--radius-lg);
    overflow: hidden;
    box-shadow: var(--shadow-lg);
    cursor: grab;
    touch-action: pan-y;
    transition: transform 220ms var(--ease-out);
  }
  .poster-wrap:active { cursor: grabbing; }
  .poster-wrap.dragging { transition: none; }
  .poster-wrap.swipe-out { animation: swipeOut 300ms var(--ease-in-out) forwards; }
  .poster-wrap.fade-up { animation: fadeUp 300ms var(--ease-in-out) forwards; }
  .poster-wrap.fade-neutral { animation: fadeUp 300ms var(--ease-in-out) forwards; }
  .poster-wrap.fade-watchlist { animation: fadeWatchlist 300ms var(--ease-in-out) forwards; }
  .poster-wrap.fade-not-interested { animation: fadeNotInterested 300ms var(--ease-in-out) forwards; }
  /* The "from" reads the live drag position (0 for button-triggered
     actions) so a committed drag flies off seamlessly instead of
     snapping back to center first. --exit-x/--exit-rot scale with how
     extreme the committed rank is (set in the script from lastRank),
     so a "slightly positive" toss is gentle and an "extremely positive"
     one flies further and spins harder. */
  @keyframes swipeOut {
    from { transform: translateX(var(--drag-x, 0px)) rotate(var(--drag-rot, 0deg)); }
    to { transform: translateX(var(--exit-x, 110%)) rotate(var(--exit-rot, 8deg)); opacity: 0; }
  }
  @keyframes fadeUp { to { transform: translateY(-20px); opacity: 0; } }
  @keyframes fadeWatchlist { to { transform: translateY(-30px) scale(1.02); opacity: 0; } }
  @keyframes fadeNotInterested { to { transform: translateY(20px) scale(0.96); opacity: 0; } }

  .poster {
    width: 100%;
    aspect-ratio: 2 / 3;
    object-fit: cover;
    background: var(--base-tertiary);
    display: block;
    pointer-events: none;
  }
  .poster-empty { background: linear-gradient(135deg, var(--base-tertiary), var(--base-secondary)); }

  /* Tinder-style live preview of the rank a release would commit right
     now, so a 7-level drag stays legible mid-gesture instead of just
     "left vs right". Sits on whichever side matches the drag direction;
     scale/opacity grow with magnitude (--stamp-mag, 1..3) so reaching a
     more extreme tier feels like it's registering more strongly. */
  .drag-stamp {
    position: absolute;
    top: var(--space-4);
    padding: 6px 12px;
    border: 2px solid;
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--base) 65%, transparent);
    backdrop-filter: blur(6px);
    text-align: center;
    pointer-events: none;
    font-family: var(--font-display);
  }
  .drag-stamp.positive {
    right: var(--space-4);
    border-color: var(--accent, var(--primary-accent));
    color: var(--accent, var(--primary-accent));
    transform: rotate(calc(6deg + var(--stamp-mag, 1) * 2deg)) scale(calc(0.85 + var(--stamp-mag, 1) * 0.12));
  }
  .drag-stamp.negative {
    left: var(--space-4);
    border-color: var(--danger, #f85149);
    color: var(--danger, #f85149);
    transform: rotate(calc(-6deg - var(--stamp-mag, 1) * 2deg)) scale(calc(0.85 + var(--stamp-mag, 1) * 0.12));
  }
  .stamp-symbol { display: block; font-size: 1.1rem; font-weight: 700; letter-spacing: 0.04em; }
  .stamp-label { display: block; font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.05em; white-space: nowrap; }

  .info { display: flex; flex-direction: column; gap: var(--space-1); min-width: 0; }
  .title {
    margin: 0;
    font-family: var(--font-display);
    font-size: 1.6rem;
    color: var(--text-primary);
  }
  .meta { color: var(--text-secondary); margin: var(--space-1) 0 0; font-size: 0.95rem; display: flex; gap: var(--space-2); flex-wrap: wrap; }
  .dot { color: var(--text-tertiary); }
  .genres { color: var(--text-tertiary); font-size: 0.85rem; margin: var(--space-1) 0 0; }
  .overview {
    color: var(--text-primary);
    line-height: 1.6;
    margin: var(--space-3) 0 0;
    font-size: 0.95rem;
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

  /* Stacked rectangular actions, macOS-window corner radius. Each
     button reveals a blurred crop of the poster on hover — same
     frosted-glass reveal technique as the Recommendations screen's
     poster overlay buttons (FilmCard's .overlay-btn), just applied to
     a bigger surface with a poster-derived background instead of a
     flat tint. Label/icon colour flips light/dark per button based on
     the sampled brightness of its crop (see btnFg in the script).

     The blurred layer's clip (.btn-surface, overflow:hidden +
     border-radius) deliberately lives on a separate, never-transformed
     element from the one animating `transform` on hover: Chromium/
     WebKit will silently drop border-radius clipping on an element
     once it starts compositing a `transform` while a blurred/filtered
     descendant is present, letting the background bleed past the
     rounded corners after the hover transition settles. */
  .actions {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin-top: var(--space-4);
  }
  .action-btn {
    position: relative;
    display: flex;
    align-items: center;
    gap: var(--space-3);
    width: 100%;
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-md);
    border: 1px solid var(--border-subtle);
    background: var(--base-secondary);
    color: var(--text-primary);
    font-family: var(--font-body);
    font-size: 0.9rem;
    text-align: left;
    cursor: pointer;
    box-shadow: var(--shadow-sm, 0 1px 2px rgba(0, 0, 0, 0.08));
    transition: border-color var(--duration-standard) var(--ease-out),
                color var(--duration-standard) var(--ease-out),
                transform var(--duration-quick) var(--ease-out);
  }
  .btn-surface {
    position: absolute;
    inset: 0;
    z-index: 0;
    overflow: hidden;
    border-radius: inherit;
    pointer-events: none;
    /* Belt-and-suspenders clip: overflow:hidden + border-radius on a
       box with a blurred descendant can render un-clipped for the
       first frame or two (seen right after a hard refresh with the
       cursor already resting on the button, before Chromium/WebKit
       promotes this box to its own compositing layer). clip-path is
       applied independently of layer promotion, so it clips correctly
       from the very first paint; transform forces the layer to exist
       immediately rather than being created lazily on hover. */
    clip-path: inset(0 round var(--radius-md));
    transform: translateZ(0);
  }
  .btn-surface::before {
    content: "";
    position: absolute;
    inset: -25%;
    background-image: var(--btn-bg-image, none);
    background-size: cover;
    background-position: var(--btn-bg-pos, center);
    filter: blur(22px) saturate(160%);
    opacity: 0;
    transition: opacity var(--duration-standard) var(--ease-out);
  }
  .action-btn > :global(svg),
  .action-btn > span:not(.btn-surface) {
    position: relative;
    z-index: 1;
  }
  .action-btn:hover:not(:disabled),
  .action-btn:focus-visible:not(:disabled),
  .action-btn.key-lit {
    border-color: var(--border-strong);
    transform: translateY(-1px);
    color: white;
  }
  .action-btn.fg-dark:hover:not(:disabled),
  .action-btn.fg-dark:focus-visible:not(:disabled),
  .action-btn.fg-dark.key-lit {
    color: #14161c;
  }
  .action-btn:hover:not(:disabled) .btn-surface::before,
  .action-btn:focus-visible:not(:disabled) .btn-surface::before,
  .action-btn.key-lit .btn-surface::before {
    opacity: 1;
  }
  .action-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  /* The 7-point rank scale: same frosted action-btn surface as the
     buttons below it, just reflowed into a row of narrower, centered
     segments (symbol above a short intensity caption) instead of a
     wide icon+label row. Kept as full independently-rounded buttons
     rather than a single joined segmented-control shell, deliberately
     — see the .btn-surface comment above on why a shared clipped
     container fights the blur/transform compositing bug; per-button
     surfaces are the pattern already proven safe on this screen. */
  .rank-scale {
    display: flex;
    gap: var(--space-1);
  }
  .action-btn.rank-btn {
    flex: 1 1 0;
    flex-direction: column;
    justify-content: center;
    gap: 2px;
    padding: var(--space-2) 2px;
    min-width: 0;
    text-align: center;
  }
  .rank-symbol {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 0.95rem;
    letter-spacing: 0.02em;
    line-height: 1;
  }
  .rank-caption {
    font-size: 0.6rem;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    opacity: 0.75;
    line-height: 1;
  }

  .empty { text-align: center; max-width: 360px; margin: var(--space-7) auto 0; }
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
