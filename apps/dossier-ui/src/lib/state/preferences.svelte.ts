/** Preferences store — ratings, pairwise refinement choices, and skip
 * list. Hydrates from the backend on startup; mutations call through to
 * the backend immediately and update local state on success, so the UI
 * reflects what's persisted, not what's optimistic. */
import type { PairwiseChoice, Rating, RatingKind } from "$lib/types";
import { ratingKind, ratingWeight } from "$lib/types";

class PreferencesState {
  ratings = $state<Record<string, Rating>>({});
  pairwise = $state<PairwiseChoice[]>([]);
  skipped = $state<number[]>([]);
  loaded = $state(false);
  /** Last error from hydrate/mutate. Surfaced in the UI so a missing
   * backend looks like a missing backend, not a frozen page. */
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

  ratingFor(filmId: number): Rating | undefined {
    return this.ratings[String(filmId)];
  }

  /** Set / replace a rating. Pass null to clear. Throws so the caller
   * can show feedback — we deliberately do not silently swallow. */
  async setRating(filmId: number, rating: Rating | null): Promise<void> {
    if (!window.dossier?.preferences) {
      throw new Error("preferences bridge unavailable");
    }
    const { ratings } = await window.dossier.preferences.setRating(filmId, rating);
    this.ratings = ratings;
  }

  async addPairwise(winnerId: number, loserId: number): Promise<void> {
    if (!window.dossier?.preferences) {
      throw new Error("preferences bridge unavailable");
    }
    const { pairwise } = await window.dossier.preferences.addPairwise(winnerId, loserId);
    this.pairwise = pairwise;
  }

  async skip(filmId: number): Promise<void> {
    if (!window.dossier?.preferences) {
      throw new Error("preferences bridge unavailable");
    }
    const { skipped } = await window.dossier.preferences.skip(filmId);
    this.skipped = skipped;
  }

  async unskip(filmId: number): Promise<void> {
    if (!window.dossier?.preferences) {
      throw new Error("preferences bridge unavailable");
    }
    const { skipped } = await window.dossier.preferences.unskip(filmId);
    this.skipped = skipped;
  }

  async reset(): Promise<void> {
    if (!window.dossier?.preferences) {
      throw new Error("preferences bridge unavailable");
    }
    await window.dossier.preferences.reset();
    this.ratings = {};
    this.pairwise = [];
    this.skipped = [];
  }

  /** Set of film IDs the user has interacted with (rated or skipped) —
   * used as the exclusion set for the rating queue and recommender. */
  excludedIds(): Set<number> {
    const out = new Set<number>();
    for (const k of Object.keys(this.ratings)) out.add(Number(k));
    for (const id of this.skipped) out.add(id);
    return out;
  }

  ratingCount(): number {
    return Object.keys(this.ratings).length;
  }

  /** Film IDs grouped by rating kind. Used by the Library tab carousels. */
  idsByKind(kind: RatingKind): number[] {
    const out: number[] = [];
    for (const [k, v] of Object.entries(this.ratings)) {
      if (ratingKind(v) === kind) out.push(Number(k));
    }
    return out;
  }

  /** Count of ratings used as the "trained data" signal for gating
   *  recommendations. Uses ratingWeight so not_interested counts at full
   *  strength (same as dislike); watchlist counts at half strength. */
  trainingSignal(): number {
    let s = 0;
    for (const v of Object.values(this.ratings)) s += Math.abs(ratingWeight(v));
    return s;
  }
}

export const preferences = new PreferencesState();
