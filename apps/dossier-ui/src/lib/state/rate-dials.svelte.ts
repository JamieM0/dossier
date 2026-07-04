/** Rate screen genre dials — a lighter sibling of the Recommendations
 * screen's dials (see recommendation-dials.svelte.ts). Each dial is a
 * single genre, 1-100, 50 = neutral. They don't re-rank a taste profile;
 * they bias which genres are more/less likely to surface in the Rate
 * queue at all (see discovery.ts's applyGenreDials). A dial left at its
 * neutral default has *no* effect on anything — only a moved dial does.
 *
 * Defaults are identical for every user (all genres at 50) and persist
 * across sessions via the desktop settings bag, same mechanism as
 * recommendationDials. */
import { RATING_NOT_INTERESTED, type GenrePatternState, type RatingEntry } from "$lib/types";

export const RATE_DIAL_MIN = 1;
export const RATE_DIAL_MAX = 100;
export const RATE_DIAL_DEFAULT = 50;

const PATTERN_BASE_THRESHOLD = 10;
const PATTERN_MAX_THRESHOLD = 200;

function defaultPatternState(): GenrePatternState {
  return { baseline: 0, threshold: PATTERN_BASE_THRESHOLD };
}

function clampDial(v: number): number {
  return Math.max(RATE_DIAL_MIN, Math.min(RATE_DIAL_MAX, Math.round(v)));
}

/** Tally how many "don't care about it" (not_interested) rated items
 * contain each genre — the raw signal the pattern prompt watches. */
export function notInterestedGenreCounts(entries: RatingEntry[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const e of entries) {
    if (e.rating !== RATING_NOT_INTERESTED) continue;
    for (const g of e.item.genres) counts.set(g, (counts.get(g) ?? 0) + 1);
  }
  return counts;
}

class RateDialsStore {
  values = $state<Record<string, number>>({});
  genres = $state<string[]>([]);
  patternState = $state<Record<string, GenrePatternState>>({});

  readonly isDefault: boolean = $derived(
    Object.values(this.values).every((v) => v === RATE_DIAL_DEFAULT)
  );

  valueFor(genre: string): number {
    return this.values[genre] ?? RATE_DIAL_DEFAULT;
  }

  set(genre: string, value: number): void {
    this.values = { ...this.values, [genre]: clampDial(value) };
  }

  reset(): void {
    const next: Record<string, number> = {};
    for (const g of this.genres) next[g] = RATE_DIAL_DEFAULT;
    this.values = next;
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

    const storedPatterns = desktopSettings?.rateGenrePatternState as Record<string, GenrePatternState> | undefined;
    if (storedPatterns) this.patternState = { ...this.patternState, ...storedPatterns };
  }

  async persist(): Promise<void> {
    await window.dossier?.settings.set({
      rateGenreDials: this.values,
      rateGenrePatternState: this.patternState
    });
  }

  /** Call after every "not interested" rating with the full (post-rating)
   *  entry list. Returns the genre whose not-interested count just
   *  crossed its threshold, if any — the strongest one past its
   *  threshold when several qualify at once — so the caller can show the
   *  confirmation popup. Returns null when nothing has crossed. */
  checkForPattern(entries: RatingEntry[]): string | null {
    const counts = notInterestedGenreCounts(entries);
    let best: { genre: string; over: number } | null = null;
    for (const [genre, count] of counts) {
      const state = this.patternState[genre] ?? defaultPatternState();
      const over = count - state.baseline;
      if (over >= state.threshold && (!best || over > best.over)) best = { genre, over };
    }
    return best?.genre ?? null;
  }

  /** Apply the user's answer to a pattern popup for `genre`, given the
   *  not-interested count for it at the time the popup was raised.
   *  Accepting turns the genre's dial down by a quarter of its current
   *  value and resets the pattern window back to its base sensitivity.
   *  Declining leaves the dial untouched and doubles (capped at 200) how
   *  many more not-interested items of that genre are needed before
   *  asking again. */
  async resolvePattern(genre: string, countAtPrompt: number, accepted: boolean): Promise<void> {
    const state = this.patternState[genre] ?? defaultPatternState();
    if (accepted) {
      const current = this.valueFor(genre);
      this.values = { ...this.values, [genre]: clampDial(current - current / 4) };
      this.patternState = {
        ...this.patternState,
        [genre]: { baseline: countAtPrompt, threshold: PATTERN_BASE_THRESHOLD }
      };
    } else {
      this.patternState = {
        ...this.patternState,
        [genre]: { baseline: countAtPrompt, threshold: Math.min(PATTERN_MAX_THRESHOLD, state.threshold * 2) }
      };
    }
    await this.persist();
  }
}

export const rateDials = new RateDialsStore();
