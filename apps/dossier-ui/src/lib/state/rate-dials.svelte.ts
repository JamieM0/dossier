/** Rate screen dials + "adjust your dials?" prompt.
 *
 * Two dial surfaces:
 *   1. Genre dials — one per known TMDB genre (a closed ~20-item list,
 *      sourced from tmdb.genres()). The original Rate-screen dial system.
 *   2. Tag dials — one per TMDB keyword tag the user has actually
 *      encountered on a rated item (open-ended, grows with the library:
 *      swordplay / donghua / based on web novel etc.). Far more
 *      discriminative than genres for "what am I tired of?" — a film
 *      tagged "Animation + Action & Adventure" can't be distinguished
 *      from any other Animation film at the genre level, but its keyword
 *      tags are a real taste cluster.
 *
 * Both use the same 1-100 slider, 50 = neutral, and bias which items
 * surface in the Rate queue via discovery.ts's applyGenreDials (which
 * despite the name reads both genre and tag dial values). A dial left at
 * neutral has *no* effect; only a moved dial does.
 *
 * The "adjust your dials?" prompt:
 *   Watches the don't-care *rate* per tag — not a raw count, because
 *   raw counts don't account for what the user has liked. (10 don't-cares
 *   + 8 likes of "Comedy" looks identical to 10 don't-cares + 0 likes
 *   under a raw counter; the rate fix is what makes the liked-comedy case
 *   stop prompting.) Only tags whose don't-care share of all *seen*
 *   tagged titles clears RATE_THRESHOLD (and whose sample size has grown
 *   past the per-tag seen-count threshold) prompt. Accepting turns the
 *   tag dial down; declining raises that tag's re-prompt threshold
 *   (doubles, capped) so the user isn't nagged.
 *
 * Defaults are identical for every user (every dial at 50) and persist
 * across sessions via the desktop settings bag, same mechanism as
 * recommendationDials. */
import { RATING_NOT_INTERESTED, type RatingEntry, type TagPatternState } from "$lib/types";

export const RATE_DIAL_MIN = 1;
export const RATE_DIAL_MAX = 100;
export const RATE_DIAL_DEFAULT = 50;

/** Initial sample size a tag must accumulate before first prompt, AND
 *  the increment that must accrue after a prompt before re-asking. Same
 *  starting value as the legacy count-based prompt so existing user
 *  expectations about prompt frequency carry over. */
const PATTERN_BASE_THRESHOLD = 10;
/** Cap on the doubling of a declined tag's re-prompt threshold so a
 *  single "No" doesn't permanently silence a tag the user later changes
 *  their mind about. */
const PATTERN_MAX_THRESHOLD = 200;
/** Don't-care share of all seen titles with a tag that qualifies it as
 *  "user seems tired of this." 0.75 = 3 out of 4, 6 out of 8, 9 out of
 *  12. Tuned so a user who has liked even ~25% of titles with a tag
 *  won't be prompted to turn it down — they clearly still enjoy the
 *  cluster. */
const RATE_THRESHOLD = 0.75;

function defaultPatternState(): TagPatternState {
  return { baseline: 0, threshold: PATTERN_BASE_THRESHOLD };
}

function clampDial(v: number): number {
  return Math.max(RATE_DIAL_MIN, Math.min(RATE_DIAL_MAX, Math.round(v)));
}

/** Per-tag tallies across the user's rated library — the raw signal the
 *  pattern prompt watches. `seen` counts every non-skip rating (any of
 *  like/dislike/neutral/watchlist/not_interested); `dontCare` is the
 *  not_interested subset. Skips ("haven't seen") are excluded from
 *  both — they carry no taste information. */
export type TagTally = { tag: string; seen: number; dontCare: number };

export function tagTallies(entries: RatingEntry[]): Map<string, TagTally> {
  const tallies = new Map<string, TagTally>();
  const bump = (tag: string, field: "seen" | "dontCare") => {
    const t = tallies.get(tag) ?? { tag, seen: 0, dontCare: 0 };
    t[field]++;
    tallies.set(tag, t);
  };
  for (const e of entries) {
    // Skip "haven't seen" — no taste signal. Every other rating (incl.
    // watchlist, neutral, and the 7-point scale) counts as a "seen"
    // datapoint for tag-tally purposes.
    if (!e.item.keywords || e.item.keywords.length === 0) continue;
    const isSeen = e.rating !== undefined; // every persisted rating counts
    if (!isSeen) continue;
    for (const tag of e.item.keywords) {
      bump(tag, "seen");
      if (e.rating === RATING_NOT_INTERESTED) bump(tag, "dontCare");
    }
  }
  return tallies;
}

class RateDialsStore {
  /** Genre dial values: a closed, name-keyed map. */
  values = $state<Record<string, number>>({});
  /** The known genre set (pinned to the top of the panel). */
  genres = $state<string[]>([]);

  /** Tag dial values: open-ended, keyed by TMDB keyword name. */
  tagValues = $state<Record<string, number>>({});
  /** Known tag set — every keyword on every rated item. Sorted alpha. */
  tags = $state<string[]>([]);

  /** Per-tag prompt bookkeeping. Keyed by tag name. */
  patternState = $state<Record<string, TagPatternState>>({});

  readonly isDefault: boolean = $derived(
    Object.values(this.values).every((v) => v === RATE_DIAL_DEFAULT) &&
    Object.values(this.tagValues).every((v) => v === RATE_DIAL_DEFAULT)
  );

  valueFor(genre: string): number {
    return this.values[genre] ?? RATE_DIAL_DEFAULT;
  }

  set(genre: string, value: number): void {
    this.values = { ...this.values, [genre]: clampDial(value) };
  }

  tagValueFor(tag: string): number {
    return this.tagValues[tag] ?? RATE_DIAL_DEFAULT;
  }

  setTag(tag: string, value: number): void {
    this.tagValues = { ...this.tagValues, [tag]: clampDial(value) };
  }

  reset(): void {
    const nextGenres: Record<string, number> = {};
    for (const g of this.genres) nextGenres[g] = RATE_DIAL_DEFAULT;
    const nextTags: Record<string, number> = {};
    for (const t of this.tags) nextTags[t] = RATE_DIAL_DEFAULT;
    this.values = nextGenres;
    this.tagValues = nextTags;
  }

  /** Union movie + tv genre names into the dial set. Safe to call
   *  repeatedly (e.g. once per medium switch) — only ever fills in
   *  genres missing from `values`/`genres`, never overwrites an
   *  existing dial position. */
  async ensureGenres(): Promise<void> {
    const api = window.dossier?.tmdb;
    if (!api) return;
    const [movieGenres, tvGenres] = await Promise.all([api.genres("movie"), api.genres("tv")]);
    const names = new Set<string>([...Object.values(movieGenres.genres), ...Object.values(tvGenres.genres)]);
    this.genres = [...names].sort((a, b) => a.localeCompare(b));

    const nextValues = { ...this.values };
    let changed = false;
    for (const g of this.genres) {
      if (!(g in nextValues)) {
        nextValues[g] = RATE_DIAL_DEFAULT;
        changed = true;
      }
    }
    if (changed) this.values = nextValues;
  }

  /** Rebuild the known tag set from the user's rated items. Open-ended —
   *  the set grows as the user rates more titles (and as enrich-ratings
   *  backfills keywords onto old snapshots). Only fills in new tag
   *  defaults; never overwrites a tag dial the user has moved. */
  ensureTags(entries: RatingEntry[]): void {
    const set = new Set<string>();
    for (const e of entries) {
      if (!e.item.keywords) continue;
      for (const k of e.item.keywords) if (k) set.add(k);
    }
    this.tags = [...set].sort((a, b) => a.localeCompare(b));

    const next = { ...this.tagValues };
    let changed = false;
    for (const t of this.tags) {
      if (!(t in next)) {
        next[t] = RATE_DIAL_DEFAULT;
        changed = true;
      }
    }
    if (changed) this.tagValues = next;
  }

  async hydrateFromDesktop(): Promise<void> {
    const desktopSettings = await window.dossier?.settings.get();

    const storedValues = desktopSettings?.rateGenreDials as Record<string, number> | undefined;
    if (storedValues) {
      const next = { ...this.values };
      for (const [g, v] of Object.entries(storedValues)) {
        if (typeof v === "number" && Number.isFinite(v)) next[g] = clampDial(v);
      }
      this.values = next;
    }

    const storedTagValues = desktopSettings?.rateTagDials as Record<string, number> | undefined;
    if (storedTagValues) {
      const next = { ...this.tagValues };
      for (const [t, v] of Object.entries(storedTagValues)) {
        if (typeof v === "number" && Number.isFinite(v)) next[t] = clampDial(v);
      }
      this.tagValues = next;
    }

    const storedPatterns = desktopSettings?.rateTagPatternState as Record<string, TagPatternState> | undefined;
    if (storedPatterns) this.patternState = { ...this.patternState, ...storedPatterns };
  }

  async persist(): Promise<void> {
    await window.dossier?.settings.set({
      rateGenreDials: this.values,
      rateTagDials: this.tagValues,
      rateTagPatternState: this.patternState
    });
  }

  /** Call after every "not interested" rating with the full (post-rating)
   *  entry list. Returns the tag whose don't-care rate (over all seen
   *  titles with that tag) just cleared RATE_THRESHOLD, *and* whose
   *  sample size has grown past its re-prompt threshold since the last
   *  prompt — the strongest one past both gates when several qualify at
   *  once — so the caller can show the confirmation popup. Returns null
   *  when nothing qualifies.
   *
   *  Rate gating is what makes this sentiment-aware: a tag the user has
   *  liked a healthy share of will never clear RATE_THRESHOLD no matter
   *  how many of its titles they've also don't-cared, which kills the
   *  original "liked comedies + don't-cares → still prompted for
   *  comedy" bug. */
  checkForPattern(entries: RatingEntry[]): TagTally | null {
    const tallies = tagTallies(entries);
    let best: { tally: TagTally; over: number } | null = null;
    for (const tally of tallies.values()) {
      if (tally.seen <= 0) continue;
      const rate = tally.dontCare / tally.seen;
      if (rate < RATE_THRESHOLD) continue;
      const state = this.patternState[tally.tag] ?? defaultPatternState();
      const newSincePrompt = tally.seen - state.baseline;
      if (newSincePrompt < state.threshold) continue;
      // "Strongest" = most don't-cares past the gate. Ties resolve to
      // whichever Map iteration visited first (insertion order, which
      // mirrors rating order).
      if (!best || tally.dontCare > best.tally.dontCare) best = { tally, over: newSincePrompt };
    }
    return best?.tally ?? null;
  }

  /** Apply the user's answer to a pattern popup for `tag`, given the
   *  seen-count for it at the time the popup was raised. Accepting
   *  turns the tag's dial down by a quarter of its current value and
   *  resets the pattern window back to its base sensitivity. Declining
   *  leaves the dial untouched and doubles (capped) how many more seen
   *  items of that tag are needed before asking again. */
  async resolvePattern(tag: string, seenAtPrompt: number, accepted: boolean): Promise<void> {
    const state = this.patternState[tag] ?? defaultPatternState();
    if (accepted) {
      const current = this.tagValueFor(tag);
      this.tagValues = { ...this.tagValues, [tag]: clampDial(current - current / 4) };
      this.patternState = {
        ...this.patternState,
        [tag]: { baseline: seenAtPrompt, threshold: PATTERN_BASE_THRESHOLD }
      };
    } else {
      this.patternState = {
        ...this.patternState,
        [tag]: { baseline: seenAtPrompt, threshold: Math.min(PATTERN_MAX_THRESHOLD, state.threshold * 2) }
      };
    }
    await this.persist();
  }
}

export const rateDials = new RateDialsStore();
