/** Preferences store — ratings, pairwise refinement choices, and skip
 * list, all keyed by medium-qualified item key ("movie:27205"). Each
 * rating carries a compact snapshot of the item (title, poster, lens
 * vector) so the taste profile and Library work offline without any
 * TMDB re-fetch. Hydrates from the backend; mutations call through and
 * update local state on success. */
import type {
  PairwiseChoice,
  RatedItem,
  Rating,
  RatingEntry,
  RatingKind,
  TmdbItem,
  TmdbMedium
} from "$lib/types";
import { itemKey, parseItemKey, ratingKind, ratingWeight, toRatedItem } from "$lib/types";
import { enrichItem } from "$lib/discovery";

class PreferencesState {
  ratings = $state<Record<string, RatingEntry>>({});
  pairwise = $state<PairwiseChoice[]>([]);
  skipped = $state<string[]>([]);
  loaded = $state(false);
  error = $state<string | null>(null);

  async hydrate(): Promise<void> {
    this.error = null;
    if (!window.dossier?.preferences) {
      this.error =
        "Backend bridge unavailable. The app needs to be running inside the Tauri shell with the preferences commands compiled.";
      this.loaded = true;
      return;
    }
    try {
      const payload = await window.dossier.preferences.get();
      this.ratings = payload.ratings ?? {};
      this.pairwise = payload.pairwise ?? [];
      this.skipped = payload.skipped ?? [];
    } catch (err) {
      this.error = `Backend call failed: ${err instanceof Error ? err.message : String(err)}. Restart the desktop app so the new preferences endpoints are loaded.`;
    } finally {
      this.loaded = true;
    }
  }

  ratingForKey(key: string): Rating | undefined {
    return this.ratings[key]?.rating;
  }

  ratingFor(medium: TmdbMedium, id: number): Rating | undefined {
    return this.ratingForKey(itemKey(medium, id));
  }

  /** Set / replace a rating from a full TMDB item (snapshot stored).
   *  Pass null to clear. Throws so the caller can show feedback.
   *
   *  Ratings are a taste *reference point* for the recommender, so we
   *  always snapshot the fully-enriched item (real TMDB keyword tags,
   *  not just the coarse genre+overview vector list results carry) —
   *  see discovery.ts:enrichItem. Every rating path (Rate, Recommendations,
   *  Library) goes through here, so this is the single place that needs
   *  to know about enrichment. */
  async setRating(item: TmdbItem, rating: Rating | null): Promise<void> {
    if (!window.dossier?.preferences) throw new Error("preferences bridge unavailable");
    const key = itemKey(item.medium, item.id);
    // Rate already loads the full detail record for the visible title.
    // Reusing it avoids a second bridge/TMDB round-trip on every click,
    // which otherwise leaves the outgoing text hanging after the poster
    // animation and causes a large main-thread/network spike before the
    // next card can appear.
    const alreadyDetailed = item.runtime != null || item.keywords.length > 0;
    const snapshot: RatedItem | undefined =
      rating === null ? undefined : toRatedItem(alreadyDetailed ? item : await enrichItem(item));
    const { ratings } = await window.dossier.preferences.setRating(key, rating, snapshot);
    this.ratings = ratings;
  }

  /** Clear a rating by key (used by the Library where we may only hold
   *  the key, not a fresh TMDB item). */
  async clearRating(key: string): Promise<void> {
    if (!window.dossier?.preferences) throw new Error("preferences bridge unavailable");
    const { ratings } = await window.dossier.preferences.setRating(key, null);
    this.ratings = ratings;
  }

  async addPairwise(winnerKey: string, loserKey: string): Promise<void> {
    if (!window.dossier?.preferences) throw new Error("preferences bridge unavailable");
    const { pairwise } = await window.dossier.preferences.addPairwise(winnerKey, loserKey);
    this.pairwise = pairwise;
  }

  async skip(medium: TmdbMedium, id: number): Promise<void> {
    if (!window.dossier?.preferences) throw new Error("preferences bridge unavailable");
    const { skipped } = await window.dossier.preferences.skip(itemKey(medium, id));
    this.skipped = skipped;
  }

  async unskip(key: string): Promise<void> {
    if (!window.dossier?.preferences) throw new Error("preferences bridge unavailable");
    const { skipped } = await window.dossier.preferences.unskip(key);
    this.skipped = skipped;
  }

  async reset(): Promise<void> {
    if (!window.dossier?.preferences) throw new Error("preferences bridge unavailable");
    await window.dossier.preferences.reset();
    this.ratings = {};
    this.pairwise = [];
    this.skipped = [];
  }

  /** Item keys the user has interacted with (rated or skipped) — the
   *  exclusion set for the rating queue and recommender. */
  excludedKeys(): Set<string> {
    const out = new Set<string>(Object.keys(this.ratings));
    for (const key of this.skipped) out.add(key);
    return out;
  }

  /** All rating entries, optionally filtered to a medium. */
  entries(medium?: TmdbMedium): RatingEntry[] {
    const all = Object.values(this.ratings);
    return medium ? all.filter((e) => e.item.medium === medium) : all;
  }

  ratingCount(medium?: TmdbMedium): number {
    return this.entries(medium).length;
  }

  /** Rating entries of a given kind (for the Library carousels). */
  entriesByKind(kind: RatingKind, medium?: TmdbMedium): RatingEntry[] {
    return this.entries(medium).filter((e) => ratingKind(e.rating) === kind);
  }

  /** Weighted training signal used to gate recommendations. */
  trainingSignal(medium?: TmdbMedium): number {
    let s = 0;
    for (const e of this.entries(medium)) s += Math.abs(ratingWeight(e.rating));
    return s;
  }

  /** Look up a rated entry by key (Library row helpers). */
  entryFor(key: string): RatingEntry | undefined {
    return this.ratings[key];
  }
}

export { itemKey, parseItemKey };
export const preferences = new PreferencesState();
