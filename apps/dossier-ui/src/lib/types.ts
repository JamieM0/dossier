export type DossierSettings = {
  theme: string;
  dyslexiaMode: boolean;
  startOnLogin: boolean;
  autoUpdatesEnabled: boolean;
  skippedUpdateVersion: string | null;
  sidebarCollapsed: boolean;
  showingWelcome: boolean;
  groupedRecommendations: boolean;
  recommendationDials: Record<string, number>;
  /** How many rated items appear at once on the Refine screen (2–10,
   *  clamped further at render time to the number of items rated in the
   *  active medium). 2 keeps the original pairwise duel; more switches
   *  to a drag-to-reorder ranking list. */
  refineGroupSize: number;
  [key: string]: unknown;
};

/** A film's rating value, stored as a signed sentinel. The Rate screen's
 *  main action is a 7-point scale from -3 (extremely negative) to +3
 *  (extremely positive); watchlist/not_interested are two further
 *  sentinels that live outside that scale, carried over unchanged from
 *  before it existed:
 *
 *    -3   = extremely negative
 *    -2   = fairly negative
 *    -1   = slightly negative  (the original "dislike" sentinel — still
 *                                what FilmCard/MovieDetailModal/Library's
 *                                plain "I didn't like it" button writes)
 *     0   = neutral            (no pull on the recommender either way)
 *    +1   = slightly positive  (the original "like" sentinel — still
 *                                what FilmCard/MovieDetailModal/Library's
 *                                plain "I liked it" button writes)
 *    +2   = fairly positive
 *    +3   = extremely positive
 *    +0.5 = watchlist          (interested; recommender weight is 15% of
 *                                a like via ratingWeight())
 *    -0.5 = not_interested     ("Don't show again", full negative weight
 *                                via ratingWeight())
 *
 *  -1, +1, +0.5 and -0.5 are the original four sentinels, unchanged in
 *  meaning and weight from before the 7-point scale existed — existing
 *  persisted libraries need no migration. 0, +2, -2, +3, -3 are new. All
 *  nine statuses exclude the film from the rating queue and
 *  recommendation list. Use ratingWeight() to get the recommender weight
 *  for a stored rating. */
export type Rating = -3 | -2 | -1 | -0.5 | 0 | 0.5 | 1 | 2 | 3;

export const RATING_LIKE: Rating = 1;
export const RATING_DISLIKE: Rating = -1;
export const RATING_WATCHLIST: Rating = 0.5;
export const RATING_NOT_INTERESTED: Rating = -0.5;

/** Human-readable category for a stored rating value. Useful for
 *  switching on view buckets (Library carousels, action labels).
 *
 *  The 7-point scale collapses to just "like"/"dislike" here rather than
 *  getting its own finer-grained kinds: Library's carousels are a fixed
 *  four sections (Watchlist/Liked/Disliked/Not interested), and a mildly-
 *  vs-extremely positive rating both clearly belong under "Liked". The
 *  one genuine edge case is 0 (neutral) — it doesn't obviously belong
 *  under either bucket, so it gets its own "neutral" kind and simply
 *  doesn't surface in any Library carousel today (the rating is still
 *  recorded, still excluded from the rating queue, and still contributes
 *  its zero weight to the recommender — it's just not filed under Liked
 *  or Disliked). */
export type RatingKind = "like" | "dislike" | "watchlist" | "not_interested" | "neutral";

export function ratingKind(r: Rating): RatingKind {
  if (r === 0.5) return "watchlist";
  if (r === -0.5) return "not_interested";
  if (r === 0) return "neutral";
  return r > 0 ? "like" : "dislike";
}

/** Recommender weight for a rating. not_interested (-0.5 stored) is treated
 * as full negative weight (-1) to match dislike effectiveness. watchlist
 * (0.5 stored) is scaled down to 15% of a like's weight, since it signals
 * interest rather than confirmed taste. The 7-point scale (-3..3) maps to
 * a weight whose magnitude grows the more extreme the rating is: the
 * legacy blanket like/dislike (±1) sits at the low end (weight ±1,
 * unchanged from before this scale existed), each step out adds another
 * 0.5 of magnitude, so extremely positive/negative (±3) pulls twice as
 * hard as a plain like/dislike. Backwards-compatible: no data migration
 * needed, the four original sentinel values keep their original weight. */
export function ratingWeight(r: Rating): number {
  if (r === -0.5) return -1;
  if (r === 0.5) return 0.15;
  if (r === -3) return -2;
  if (r === -2) return -1.5;
  if (r === 2) return 1.5;
  if (r === 3) return 2;
  return r; // -1, 0, 1 all map to their own value (no scaling needed)
}

export type PairwiseChoice = {
  winnerKey: string;
  loserKey: string;
  ts: number;
};

/** Compact snapshot of a rated item, persisted with its rating so the
 * profile and Library are self-contained (no TMDB re-fetch). */
export type RatedItem = {
  key: string;
  medium: TmdbMedium;
  id: number;
  title: string;
  year: number | null;
  posterPath: string | null;
  voteAverage: number | null;
  genres: string[];
  features: FeatureVector;
};

export type RatingEntry = {
  rating: Rating;
  item: RatedItem;
  ts: number;
};

export type PreferencesPayload = {
  ratings: Record<string, RatingEntry>;
  pairwise: PairwiseChoice[];
  skipped: string[];
};

/** Medium-qualified key for a TMDB item, e.g. "movie:27205". The single
 * identity used across ratings, pairwise, and the skip list. */
export function itemKey(medium: TmdbMedium, id: number): string {
  return `${medium}:${id}`;
}

export function parseItemKey(key: string): { medium: TmdbMedium; id: number } | null {
  const [m, idStr] = key.split(":");
  const id = Number(idStr);
  if ((m !== "movie" && m !== "tv") || !Number.isFinite(id)) return null;
  return { medium: m, id };
}

/** Inflate a stored snapshot back into a TmdbItem for display (the
 * Library renders from snapshots; missing detail fields are filled with
 * empty defaults and enriched if the detail modal is opened). */
export function ratedToTmdbItem(r: RatedItem): TmdbItem {
  return {
    id: r.id,
    medium: r.medium,
    title: r.title,
    year: r.year,
    voteAverage: r.voteAverage,
    voteCount: null,
    popularity: null,
    genreIds: [],
    genres: r.genres,
    posterPath: r.posterPath,
    overview: "",
    runtime: null,
    keywords: [],
    features: r.features
  };
}

/** Snapshot the fields we persist with a rating from any TMDB item. */
export function toRatedItem(item: TmdbItem): RatedItem {
  return {
    key: itemKey(item.medium, item.id),
    medium: item.medium,
    id: item.id,
    title: item.title,
    year: item.year,
    posterPath: item.posterPath,
    voteAverage: item.voteAverage,
    genres: item.genres,
    features: item.features
  };
}

/** Medium-agnostic entertainment feature vector — 10 axes, each in
 * [-1, 1]. Computed by the backend lens (apps/dossier-desktop/src/lens.ts)
 * from TMDB genres + keywords + overview. The three former mood axes
 * (tone_register / darkness / ending_warmth) are merged into one `tone`
 * axis (+1 light/playful/uplifting … -1 dark/serious/bleak). Keys here
 * MUST stay in sync with AXIS_KEYS in recommender.ts and the backend
 * lens. */
export type FeatureVector = {
  pacing: number;
  tone: number;
  emotional_intensity: number;
  complexity: number;
  scope: number;
  realism: number;
  thematic_weight: number;
  character_focus: number;
  moral_clarity: number;
  structure: number;
};

// --- TMDB --------------------------------------------------------------
/** The two media the entertainment lens currently covers. TMDB keys
 * movie ids and tv ids in separate number spaces, so a medium tag is
 * required to disambiguate a stored rating. */
export type TmdbMedium = "movie" | "tv";

/** A normalized TMDB record as returned by the backend. List results
 * carry no keywords/runtime (those only come from the detail fetch). */
export type TmdbItem = {
  id: number;
  medium: TmdbMedium;
  title: string;
  year: number | null;
  voteAverage: number | null;
  voteCount: number | null;
  popularity: number | null;
  genreIds: number[];
  genres: string[];
  posterPath: string | null;
  overview: string;
  runtime: number | null;
  keywords: string[];
  /** Entertainment lens vector. List items get a coarse vector (from
   * genres + overview only); detail fetches get the full vector
   * (genres + keywords + overview). */
  features: FeatureVector;
};

export type TmdbListResult = {
  page: number;
  totalPages: number;
  items: TmdbItem[];
};
