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
  [key: string]: unknown;
};

/** A film's rating value, stored as a signed sentinel:
 *    +1   = like            (full positive weight)
 *    -1   = dislike         (full negative weight)
 *    +0.5 = watchlist       (interested; recommender weight is 15% of a like via ratingWeight())
 *    -0.5 = not_interested  ("Don't show again", full negative weight via ratingWeight())
 *  All four statuses exclude the film from the rating queue and
 *  recommendation list. Use ratingWeight() to get the recommender weight. */
export type Rating = -1 | -0.5 | 0.5 | 1;

export const RATING_LIKE: Rating = 1;
export const RATING_DISLIKE: Rating = -1;
export const RATING_WATCHLIST: Rating = 0.5;
export const RATING_NOT_INTERESTED: Rating = -0.5;

/** Human-readable category for a stored rating value. Useful for
 *  switching on view buckets (Library carousels, action labels). */
export type RatingKind = "like" | "dislike" | "watchlist" | "not_interested";

export function ratingKind(r: Rating): RatingKind {
  if (r === 1) return "like";
  if (r === -1) return "dislike";
  if (r === 0.5) return "watchlist";
  return "not_interested";
}

/** Recommender weight for a rating. not_interested (-0.5 stored) is treated
 * as full negative weight (-1) to match dislike effectiveness. watchlist
 * (0.5 stored) is scaled down to 15% of a like's weight, since it signals
 * interest rather than confirmed taste. Backwards-compatible: no data
 * migration needed, the stored sentinel values are unchanged. */
export function ratingWeight(r: Rating): number {
  if (r === -0.5) return -1;
  if (r === 0.5) return 0.15;
  return r;
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
