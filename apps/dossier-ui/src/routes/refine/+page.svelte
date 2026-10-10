<script lang="ts">
  import { onMount } from "svelte";
  import { buildPairwiseCandidates, buildRankingGroup, predictPreference } from "$lib/recommender";
  import { preferences } from "$lib/state/preferences.svelte";
  import { uiSettings } from "$lib/state/ui-settings.svelte";
  import { posterUrl } from "$lib/poster";
  import { ratingKind, type RatedItem, type RatingEntry } from "$lib/types";
  import IconCaretLeftBold from "phosphor-icons-svelte/IconCaretLeftBold.svelte";
  import IconCaretRightBold from "phosphor-icons-svelte/IconCaretRightBold.svelte";

  let busy = $state(false);

  // Rated items across the person's intrinsically blended library, and the effective group size for
  // this screen: the user's setting, clamped to [2, rated count] so it
  // never asks for more items than exist. At 2 this is the original
  // pairwise duel; above 2 it's a drag-to-reorder ranking list.
  const entries = $derived(preferences.entries());
  const ratedCount = $derived(entries.length);
  const likedCount = $derived(entries.filter(e=>ratingKind(e.rating)==="like").length);
  const dislikedCount = $derived(entries.filter(e=>ratingKind(e.rating)==="dislike").length);
  const effectiveGroupSize = $derived(
    ratedCount < 2 ? 2 : Math.max(2, Math.min(uiSettings.refineGroupSize, ratedCount))
  );

  /** Predicted preference 0–100 for a rated item, from the live profile. */
  function predict(item: RatedItem): number {
    return predictPreference(item, preferences.entries(), undefined, preferences.activeClaims(), preferences.pairwise);
  }

  let actionError = $state<string | null>(null);
  let learningResult = $state<string | null>(null);

  onMount(() => {
    void preferences.hydrate();
  });

  // --- Duel (effective group size 2) — unchanged from the original
  // pairwise-only screen. Pooled by polarity, scoped to the active
  // medium, operating entirely on stored snapshots (no catalogue fetch).
  const pairs = $derived<Array<[RatingEntry, RatingEntry]>>(
    preferences.loaded && effectiveGroupSize === 2
      ? buildPairwiseCandidates(entries, preferences.pairwise, 40)
      : []
  );
  const current = $derived(pairs[0] ?? null);

  async function choose(winnerIdx: 0 | 1): Promise<void> {
    if (!current || busy) return;
    busy = true;
    const winner = current[winnerIdx];
    const loser = current[1 - winnerIdx];
    actionError = null;
    try {
      await preferences.addPairwise(winner.item.key, loser.item.key);
      const expected = predict(winner.item) >= predict(loser.item);
      learningResult = expected
        ? `This confirmed Dossier's current ordering of ${winner.item.title} above ${loser.item.title}.`
        : `Choosing ${winner.item.title} corrected Dossier's assumption that ${loser.item.title} was the stronger fit.`;
    } catch (err) {
      actionError = err instanceof Error ? err.message : String(err);
    } finally {
      busy = false;
    }
  }

  function handleKey(event: KeyboardEvent): void {
    if (event.repeat || effectiveGroupSize !== 2 || !current) return;
    if (event.key === "ArrowLeft") { event.preventDefault(); void choose(0); }
    else if (event.key === "ArrowRight") { event.preventDefault(); void choose(1); }
  }

  // --- Ranking list (effective group size > 2) ----------------------------
  // Candidate group: up to effectiveGroupSize items from one polarity pool
  // that still has at least one undecided pair among them.
  const rankingPool = $derived<RatingEntry[]>(
    preferences.loaded && effectiveGroupSize > 2
      ? buildRankingGroup(entries, preferences.pairwise, effectiveGroupSize)
      : []
  );

  // Local, user-editable copy of the pool — reset whenever the pool's
  // membership actually changes (a fresh group loaded, e.g. after Save
  // commits the previous round's pairs). Not reset on every re-render,
  // so mid-drag reordering survives unrelated reactivity.
  let order = $state<RatingEntry[]>([]);
  let savingOrder = $state(false);

  function moveRow(index: number, delta: -1 | 1): void {
    if (order.length === 0) order = [...rankingPool];
    const target = index + delta;
    if (target < 0 || target >= order.length) return;
    const tmp = order[index];
    order[index] = order[target];
    order[target] = tmp;
  }

  // Strictly-vertical drag-to-reorder: only the pointer's Y delta is ever
  // read or applied (no translateX, ever). Rows swap with a neighbor the
  // moment the drag crosses that neighbor's midpoint, Trello-style — the
  // dragged row's index updates immediately so the swap threshold is
  // always relative to the *current* neighbor, not the original one.
  let dragIndex = $state<number | null>(null);
  let dragY = $state(0);
  let dragPointerId: number | null = null;
  let dragStartClientY = 0;
  let dragRowHeight = 0;
  let dragVertical = $state(false);

  function onGripPointerDown(event: PointerEvent, index: number): void {
    if (savingOrder) return;
    if (order.length === 0) order = [...rankingPool];
    const grip = event.currentTarget as HTMLElement;
    const row = grip.closest(".rank-row") as HTMLElement | null;
    const list = grip.closest(".ranking-list") as HTMLElement | null;
    // The swap unit must be the full row-to-row pitch (the row's own
    // height *plus* the list's flex gap between rows), not just the row's
    // own height — using height alone under-measures the real on-screen
    // distance to the next row's midpoint.
    dragVertical = window.matchMedia("(max-width:760px)").matches;
    const listStyle = list ? getComputedStyle(list) : null;
    const gapPx = listStyle
      ? parseFloat(dragVertical ? listStyle.rowGap : listStyle.columnGap) || 0
      : 0;
    const rect = row?.getBoundingClientRect();
    dragRowHeight = (dragVertical ? rect?.height : rect?.width) ?? 0;
    dragRowHeight += gapPx;
    if (dragRowHeight <= 0) return;
    dragIndex = index;
    dragPointerId = event.pointerId;
    dragStartClientY = dragVertical ? event.clientY : event.clientX;
    dragY = 0;
    grip.setPointerCapture(event.pointerId);
  }

  function onGripPointerMove(event: PointerEvent): void {
    if (dragIndex === null || event.pointerId !== dragPointerId) return;
    const pointerPosition = dragVertical ? event.clientY : event.clientX;
    dragY = pointerPosition - dragStartClientY;

    // dragStartClientY shifts by a full row-pitch on every swap so the
    // *next* event's fresh (event.clientY - dragStartClientY) reflects
    // only the remaining offset from the row's new slot — without this,
    // a later pointermove recomputes dragY from the original reference
    // point (still past the threshold) and re-triggers a second swap for
    // the same physical drag distance, overshooting past more than one
    // neighbor on a single fast/coalesced drag.
    while (dragY > dragRowHeight / 2 && dragIndex < order.length - 1) {
      const next = order[dragIndex + 1];
      order[dragIndex + 1] = order[dragIndex];
      order[dragIndex] = next;
      dragIndex += 1;
      dragStartClientY += dragRowHeight;
      dragY -= dragRowHeight;
    }
    while (dragY < -dragRowHeight / 2 && dragIndex > 0) {
      const prev = order[dragIndex - 1];
      order[dragIndex - 1] = order[dragIndex];
      order[dragIndex] = prev;
      dragIndex -= 1;
      dragStartClientY -= dragRowHeight;
      dragY += dragRowHeight;
    }
  }

  function onGripPointerUp(event: PointerEvent): void {
    if (dragIndex === null || event.pointerId !== dragPointerId) return;
    dragPointerId = null;
    dragIndex = null;
    dragY = 0;
  }

  // Translate the final top-to-bottom order into pairwise data: every
  // pair implied by the ranking (higher position = winner), skipping any
  // pair already recorded. Once these land, preferences.pairwise updates
  // and rankingPool naturally excludes this fully-decided set, so the
  // effect above loads the next group.
  async function saveOrder(): Promise<void> {
    if (order.length === 0) order = [...rankingPool];
    if (order.length < 2 || savingOrder) return;
    savingOrder = true;
    actionError = null;
    const seen = new Set(preferences.pairwise.map((p) => [p.winnerKey, p.loserKey].sort().join("|")));
    const toAdd: Array<[string, string]> = [];
    for (let i = 0; i < order.length; i++) {
      for (let j = i + 1; j < order.length; j++) {
        // The track reads worst → best, so the item further right wins.
        const winnerKey = order[j].item.key;
        const loserKey = order[i].item.key;
        const key = [winnerKey, loserKey].sort().join("|");
        if (seen.has(key)) continue;
        seen.add(key);
        toAdd.push([winnerKey, loserKey]);
      }
    }
    try {
      for (const [winnerKey, loserKey] of toAdd) {
        await preferences.addPairwise(winnerKey, loserKey);
      }
      const predicted = rankingPool.map(e=>e.item.key).join("|");
      const actual = order.map(e=>e.item.key).join("|");
      learningResult = predicted === actual ? "This confirmed Dossier's current ordering." : `Your reorder corrected ${toAdd.length} unresolved relationship${toAdd.length === 1 ? "" : "s"}. The new order now overrides the prior guess.`;
      order = [];
    } catch (err) {
      actionError = err instanceof Error ? err.message : String(err);
    } finally {
      savingOrder = false;
    }
  }
</script>

<svelte:window on:keydown={handleKey} />

<section class="screen">
  {#if !preferences.loaded || ratedCount >= 2}
    <header class="header">
      <span class="screen-kicker">Teach Dossier · refinement</span>
      {#if effectiveGroupSize > 2}
        <h1>Put close feelings in order</h1>
        <p class="hint">Arrange from least preferred to most preferred · drag or use the arrows</p>
      {:else}
        <h1>Which feels more like you?</h1>
        <p class="hint">
          <kbd>←</kbd> left · <kbd>→</kbd> right · pairwise refinement sharpens your weights
        </p>
      {/if}
    </header>
  {/if}
  {#if learningResult}<p class="learning-note" aria-live="polite"><strong>What Dossier learned:</strong> {learningResult}</p>{/if}

  {#if preferences.error}
    <div class="error" role="alert">
      <strong>Preferences backend unavailable.</strong>
      <span>{preferences.error}</span>
    </div>
  {/if}
  {#if actionError}
    <div class="error" role="alert">{actionError}</div>
  {/if}

  {#if !preferences.loaded}
    <p class="muted center">Loading…</p>
  {:else if ratedCount < 2}
    <div class="empty center">
      <h2>Rate a few titles first.</h2>
      <p>Refinement compares titles you've already rated similarly. Rate at least 2, then come back.</p>
    </div>
  {:else if effectiveGroupSize === 2}
    {#if !current}
      <div class="empty center">
        <h2>No new comparisons.</h2>
        <p>You've answered every pair from your current ratings. Rate more titles to unlock more comparisons.</p>
      </div>
    {:else}
      <div class="duel">
        {#each [0, 1] as side (current[side].item.key)}
          {@const entry = current[side]}
          {@const guess = predict(entry.item)}
          <button class="pick" disabled={busy} onclick={() => choose(side as 0 | 1)}>
            <div class="poster-wrap">
              {#if posterUrl(entry.item.posterPath, "w500")}
                <img class="poster" src={posterUrl(entry.item.posterPath, "w500")} alt="" />
              {:else}
                <div class="poster poster-empty"></div>
              {/if}
            </div>
            <div class="caption">
              <h3>{entry.item.title}</h3>
              <p class="meta">{entry.item.year ?? ""}{entry.item.genres[0] ? ` · ${entry.item.genres[0]}` : ""}</p>
              <span class="evidence">Dossier currently reads this as {guess >= 58 ? "positive" : guess <= 25 ? "negative" : "mixed"} evidence</span>
            </div>
          </button>
        {/each}
      </div>
      <p class="counter center">{preferences.pairwise.length + 1} answered · {pairs.length} more queued</p>
    {/if}
  {:else if rankingPool.length < 2}
    <div class="empty center">
      <h2>No new comparisons.</h2>
      <p>No unresolved group remains within one category ({likedCount} liked · {dislikedCount} disliked). Rate more titles to unlock more rounds.</p>
    </div>
  {:else}
    <div class="ranking">
      <ol class="ranking-list">
        {#each (order.length > 0 ? order : rankingPool) as entry, i (entry.item.key)}
          <li
            class="rank-row"
            class:dragging={dragIndex === i}
            style={dragIndex === i ? (dragVertical ? `transform:translateY(${dragY}px);` : `transform:translateX(${dragY}px) rotate(${dragY / 80}deg);`) : ""}
          >
            <span class="rank-num">{i + 1}</span>
            <div class="rank-poster-wrap">
              {#if posterUrl(entry.item.posterPath, "w154")}
                <img class="rank-poster" src={posterUrl(entry.item.posterPath, "w154")} alt="" draggable="false" />
              {:else}
                <div class="rank-poster rank-poster-empty"></div>
              {/if}
            </div>
            <div class="rank-caption">
              <h3>{entry.item.title}</h3>
              <p class="meta">{entry.item.year ?? ""}{entry.item.genres[0] ? ` · ${entry.item.genres[0]}` : ""}</p>
            </div>
            <div class="rank-controls">
              <button
                class="rank-move-btn"
                disabled={i === 0 || savingOrder}
                aria-label={`Move ${entry.item.title} earlier`}
                onclick={() => moveRow(i, -1)}
              >
                <IconCaretLeftBold class="icon-14" />
              </button>
              <button
                class="rank-move-btn"
                disabled={i === (order.length > 0 ? order.length : rankingPool.length) - 1 || savingOrder}
                aria-label={`Move ${entry.item.title} later`}
                onclick={() => moveRow(i, 1)}
              >
                <IconCaretRightBold class="icon-14" />
              </button>
            </div>
            <span
              class="grip"
              role="button"
              tabindex="0"
              aria-label={`Drag to reorder ${entry.item.title}`}
              onpointerdown={(e) => onGripPointerDown(e, i)}
              onpointermove={onGripPointerMove}
              onpointerup={onGripPointerUp}
              onpointercancel={onGripPointerUp}
            >
              <span aria-hidden="true">⠿</span>
            </span>
          </li>
        {/each}
      </ol>
      <div class="ranking-actions">
        <p class="counter">{preferences.pairwise.length} answered so far</p>
        <button class="save-btn" disabled={savingOrder} onclick={() => void saveOrder()}>
          {savingOrder ? "Saving…" : (order.length > 0 ? order : rankingPool).map(e=>e.item.key).join("|") === rankingPool.map(e=>e.item.key).join("|") ? "Looks right" : "Save corrected order"}
        </button>
      </div>
    </div>
  {/if}
</section>

<style>
  .screen { min-height:100%; display:flex; flex-direction:column; padding:clamp(24px,3.5vw,54px); gap:clamp(20px,3vw,36px); }
  .header { width:100%; max-width:1180px; margin:0 auto; display:flex; flex-direction:column; align-items:flex-start; gap:4px; }
  .header h1 { font-family:var(--font-display); font-size:clamp(1.5rem,2.4vw,2rem); color:var(--text-primary); margin:0; }
  .hint { color:var(--text-tertiary); font-size:.8rem; margin:0; display:flex; align-items:center; gap:4px; flex-wrap:wrap; }
  :global(.inline-icon) { vertical-align: -2px; color: var(--text-secondary); }
  kbd { background: var(--base-tertiary); border: 1px solid var(--border-subtle); border-radius: 4px; padding: 0 6px; font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-secondary); }
  .center { text-align: center; }
  .duel { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-5); flex: 1; align-items: center; max-width: 920px; width: 100%; margin: 0 auto; }
  .pick {
    background: var(--base-secondary);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-lg);
    overflow: hidden;
    padding: 0;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    transition: border-color var(--duration-standard) var(--ease-out), transform var(--duration-quick) var(--ease-out);
    color: inherit;
  }
  .pick:hover:not(:disabled) { border-color: var(--accent); transform: translateY(-2px); }
  .pick:disabled { opacity: 0.5; }
  .poster-wrap { position: relative; }
  .poster { width: 100%; aspect-ratio: 2 / 3; object-fit: cover; display: block; background: var(--base-tertiary); }
  .poster-empty { background: linear-gradient(135deg, var(--base-tertiary), var(--base-secondary)); }
  .caption { padding: var(--space-3); text-align: left; }
  .caption h3 { font-family: var(--font-display); font-size: 1.05rem; margin: 0; color: var(--text-primary); }
  .meta { color: var(--text-secondary); font-size: 0.85rem; margin: var(--space-1) 0 0; }
  .evidence{display:block;margin-top:7px;color:var(--text-tertiary);font-size:.68rem;line-height:1.35}
  .counter { color: var(--text-tertiary); font-size: 0.8rem; }
  .muted { color: var(--text-tertiary); }
  .empty h2 { font-family: var(--font-display); color: var(--text-primary); }
  .empty p { color: var(--text-secondary); max-width: 420px; margin: 0 auto; }
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

  /* --- Ranking list (group size > 2) ------------------------------------ */
  .ranking {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    max-width: 1180px;
    width: 100%;
    margin: 0 auto;
    min-height:0;
    padding: var(--space-1) 0;
  }
  .ranking-list { list-style:none; margin:0; padding:var(--space-2) var(--space-1) var(--space-4); display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:14px; overflow-x:auto; align-items:end; }
  .rank-row {
    position: relative;
    display:block;
    background:var(--base-tertiary);
    border:1px solid color-mix(in srgb,var(--border) 54%,transparent);
    border-radius:16px;
    padding:0;
    overflow:hidden;
    transition: border-color var(--duration-standard) var(--ease-out), box-shadow var(--duration-standard) var(--ease-out);
  }
  .rank-row.dragging {
    border-color: var(--primary-accent);
    box-shadow: var(--shadow-lg, 0 8px 24px rgba(0, 0, 0, 0.2));
    z-index: 5;
    transition: none;
  }
  .rank-num {
    position:absolute;
    z-index:2;
    top:9px;
    left:9px;
    width:30px;
    height:30px;
    display:grid;
    place-items:center;
    text-align: center;
    font-variant-numeric: tabular-nums;
    font-size: 0.85rem;
    color:white;
    background:rgba(15,16,19,.48);
    border:1px solid rgba(255,255,255,.22);
    border-radius:999px;
    backdrop-filter:blur(14px);
  }
  .rank-poster-wrap { width:100%; overflow:hidden; }
  .rank-poster { width: 100%; aspect-ratio: 2 / 3; object-fit: cover; display: block; background: var(--base-tertiary); pointer-events: none; }
  .rank-poster-empty { background: linear-gradient(135deg, var(--base-tertiary), var(--base-secondary)); }
  .rank-caption { position:absolute;z-index:1;inset:auto 0 0;min-width:0;text-align:left;padding:42px 70px 12px 12px;color:white;background:linear-gradient(180deg,transparent,rgba(8,9,12,.86) 58%,rgba(8,9,12,.94));pointer-events:none; }
  .rank-caption h3 {
    font-family: var(--font-display);
    font-size: 0.92rem;
    margin: 0;
    color:white;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .rank-caption .meta { color:rgba(255,255,255,.65); font-size:.72rem; margin:2px 0 0; }
  .rank-controls { position:absolute;z-index:2;right:9px;bottom:9px;display:flex;gap:5px; }
  .rank-move-btn {
    width:32px;
    height:26px;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    border:1px solid rgba(255,255,255,.2);
    background:rgba(15,16,19,.48);
    color:white;
    backdrop-filter:blur(12px);
    cursor: pointer;
    transition: background var(--duration-standard) var(--ease-out), color var(--duration-standard) var(--ease-out);
  }
  .rank-move-btn:hover:not(:disabled) { background: var(--base); color: var(--text-primary); }
  .rank-move-btn:disabled { opacity: 0.3; cursor: not-allowed; }
  .grip {
    position:absolute;
    right:9px;
    top:9px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width:30px;
    height:30px;
    color:white;
    background:rgba(15,16,19,.48);
    border:1px solid rgba(255,255,255,.22);
    backdrop-filter:blur(12px);
    border-radius:999px;
    cursor: grab;
    touch-action: none;
  }
  .grip:active { cursor: grabbing; }
  .grip:hover { color: var(--text-primary); }
  .ranking-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    flex-shrink: 0;
    padding-top: var(--space-1);
  }
  .save-btn {
    padding: var(--space-2) var(--space-5);
    border-radius: var(--radius-md);
    border: 1px solid var(--primary-accent);
    background: var(--primary-accent);
    color: var(--primary-accent-text, #fff);
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    transition: background var(--duration-standard) var(--ease-out), transform var(--duration-quick) var(--ease-out);
  }
  .save-btn:hover:not(:disabled) { background: var(--primary-accent-hover, var(--primary-accent)); transform: translateY(-1px); }
  .save-btn:disabled { opacity: 0.6; cursor: default; transform: none; }
  .learning-note { align-self:center; max-width:720px; padding:var(--space-2) var(--space-3); border-left:2px solid var(--accent); color:var(--text-secondary); font-size:.82rem; line-height:1.4; }
  @media (max-width:760px) {
    .screen{padding:18px 14px calc(148px + env(safe-area-inset-bottom));gap:16px}
    .header h1{font-size:1.45rem}.hint{font-size:.72rem}.empty{padding-top:clamp(40px,15dvh,120px)}
    .duel{gap:10px;align-items:start}.caption{padding:10px}.caption h3{font-size:.9rem}.meta{font-size:.72rem}
    .ranking{gap:12px}
    .ranking-list{display:flex;flex-direction:column;overflow:visible;padding:0;gap:9px}
    .rank-row{height:112px;display:grid;grid-template-columns:74px minmax(0,1fr) auto;align-items:center;border-radius:14px;background:color-mix(in srgb,var(--base-secondary) 82%,transparent);overflow:hidden}
    .rank-poster-wrap{width:74px;height:112px}
    .rank-poster{width:100%;height:100%;aspect-ratio:auto}
    .rank-num{top:7px;left:7px;width:26px;height:26px;font-size:.72rem}
    .rank-caption{position:static;padding:12px;background:none;color:var(--text-primary)}
    .rank-caption h3{color:var(--text-primary);white-space:normal;display:-webkit-box;-webkit-line-clamp:2;line-clamp:2;-webkit-box-orient:vertical}
    .rank-caption .meta{color:var(--text-tertiary)}
    .rank-controls{position:static;display:flex;flex-direction:column;padding-right:10px}
    .rank-move-btn{width:38px;height:38px;background:var(--base-tertiary);color:var(--text-secondary);border-color:var(--border-subtle);backdrop-filter:none}
    .rank-move-btn:first-child :global(svg),.rank-move-btn:last-child :global(svg){transform:rotate(90deg)}
    .grip{display:none}
    .ranking-actions{position:sticky;z-index:12;bottom:calc(64px + env(safe-area-inset-bottom));align-items:stretch;flex-direction:column;padding:9px 0 0;background:linear-gradient(180deg,transparent,var(--base) 30%)}.save-btn{width:100%;min-height:48px}
  }
</style>
