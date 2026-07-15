/** The persisted library data model — shared by the desktop app's
 * keychain-encrypted store and the web build's passphrase-encrypted store,
 * and the payload of the portable `.dossier` export/import file. Pure data:
 * no Node or browser APIs here. */

export const SCHEMA_VERSION = 1;

/** A single film rating, encoded as a signed sentinel. The Rate screen's
 *  main action is a 7-point scale (-3..3); watchlist/not_interested are
 *  two further sentinels outside that scale, carried over unchanged from
 *  before it existed.
 *
 *  -3   = extremely negative
 *  -2   = fairly negative
 *  -1   = slightly negative (the original "dislike" sentinel, full
 *                             negative weight)
 *   0   = neutral           (no recommender weight either way)
 *  +1   = slightly positive (the original "like" sentinel, full
 *                             positive weight)
 *  +2   = fairly positive
 *  +3   = extremely positive
 *  +0.5 = watchlist      ("Add to watchlist" — mapped to 15% positive weight
 *                          by ratingWeight(), since it signals interest
 *                          rather than confirmed taste)
 *  -0.5 = not_interested ("Don't show again" — stored as -0.5 but the
 *                          recommender maps this to -1 via ratingWeight(),
 *                          giving it the same effectiveness as dislike)
 *
 *  The stored value is a stable identity; ratingWeight() in the UI layer
 *  translates these sentinels to the recommender's actual weights. This
 *  means existing records (all -1/-0.5/0.5/1 under the old binary scheme)
 *  automatically get the current weighting without data migration; 0/±2/±3
 *  are new sentinels introduced alongside the 7-point scale. */
export type Rating = -3 | -2 | -1 | -0.5 | 0 | 0.5 | 1 | 2 | 3;

export const RATING_LIKE: Rating = 1;
export const RATING_DISLIKE: Rating = -1;
export const RATING_WATCHLIST: Rating = 0.5;
export const RATING_NOT_INTERESTED: Rating = -0.5;

const VALID_RATINGS = new Set<number>([-3, -2, -1, -0.5, 0, 0.5, 1, 2, 3]);

export function isValidRating(value: unknown): value is Rating {
  return typeof value === "number" && VALID_RATINGS.has(value);
}

/** A compact snapshot of a rated item, stored alongside its rating so
 * the taste profile and Library work fully offline — no TMDB re-fetch
 * needed to recompute the user's profile or render rated items. */
export type RatedItem = {
  /** "movie:27205" | "tv:1396" — medium-qualified to avoid TMDB's
   * movie/tv id-space collision. */
  key: string;
  medium: string;
  id: number;
  title: string;
  year: number | null;
  posterPath: string | null;
  voteAverage: number | null;
  genres: string[];
  /** TMDB keyword tags at rating time (e.g. "swordplay", "donghua").
   *  Empty for snapshots written before this field existed —
   *  enrich-ratings backfills them on first launch. Used by the Rate
   *  screen's tag dials + "adjust your dials?" pattern prompt. */
  keywords: string[];
  /** Entertainment lens vector at rating time. */
  features: Record<string, number>;
};

export type RatingEntry = {
  rating: Rating;
  item: RatedItem;
  ts: number;
};

/** key -> rating entry. */
export type RatingsMap = Record<string, RatingEntry>;

export type PairwiseChoice = {
  /** item key of the preferred item */
  winnerKey: string;
  /** item key of the less-preferred item */
  loserKey: string;
  /** unix-ms timestamp */
  ts: number;
};

export type PersistedState = {
  schemaVersion: number;
  settings: Record<string, unknown>;
  /** itemKey -> rating entry. */
  ratings: RatingsMap;
  /** Append-only log of pairwise refinement choices. */
  pairwise: PairwiseChoice[];
  /** Item keys the user has explicitly skipped ("haven't seen"). Kept so
   * the rating queue doesn't re-show them next session. */
  skipped: string[];
};

export function createDefaultState(): PersistedState {
  return {
    schemaVersion: SCHEMA_VERSION,
    settings: {},
    ratings: {},
    pairwise: [],
    skipped: []
  };
}

/** Merge missing top-level fields onto loaded state so older on-disk
 * files (written before ratings/pairwise/skipped existed) get filled in
 * with empty defaults instead of crashing on read. Also fills
 * per-RatedItem `keywords` (added later than the snapshot format) so
 * downstream readers can assume the field is always present. */
export function withDefaults(state: PersistedState): PersistedState {
  const ratings: RatingsMap = {};
  for (const [k, entry] of Object.entries(state.ratings ?? {})) {
    if (!entry?.item) {
      ratings[k] = entry;
      continue;
    }
    ratings[k] = {
      ...entry,
      item: { ...entry.item, keywords: entry.item.keywords ?? [] }
    };
  }
  return {
    schemaVersion: state.schemaVersion ?? SCHEMA_VERSION,
    settings: state.settings ?? {},
    ratings,
    pairwise: state.pairwise ?? [],
    skipped: state.skipped ?? []
  };
}
