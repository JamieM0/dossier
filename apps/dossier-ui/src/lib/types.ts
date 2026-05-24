export type DossierSettings = {
  theme: string;
  dyslexiaMode: boolean;
  startOnLogin: boolean;
  autoUpdatesEnabled: boolean;
  skippedUpdateVersion: string | null;
  sidebarCollapsed: boolean;
  showingWelcome: boolean;
  [key: string]: unknown;
};

/** A film's rating value, stored as a signed sentinel:
 *    +1   = like            (full positive weight)
 *    -1   = dislike         (full negative weight)
 *    +0.5 = watchlist       (interested, 50% positive weight)
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
 * stays at half strength (+0.5). Backwards-compatible: old -0.5 values
 * automatically get the full weight without data migration. */
export function ratingWeight(r: Rating): number {
  if (r === -0.5) return -1;
  return r;
}

export type PairwiseChoice = {
  winnerId: number;
  loserId: number;
  ts: number;
};

export type PreferencesPayload = {
  ratings: Record<string, Rating>;
  pairwise: PairwiseChoice[];
  skipped: number[];
};

/** Feature vector keys match `AXES` in
 * tools/catalogue-builder/feature_schema.py. */
export type FeatureVector = {
  pacing: number;
  tone_register: number;
  ending_warmth: number;
  emotional_intensity: number;
  complexity: number;
  scope: number;
  realism: number;
  darkness: number;
  thematic_weight: number;
  character_focus: number;
  moral_clarity: number;
  structure: number;
};

export type AxisDescriptor = {
  key: keyof FeatureVector;
  label: string;
  pos: string;
  neg: string;
};

export type FilmIndexEntry = {
  id: number;
  title: string;
  year: number | null;
  popularity: number;
  rating: number | null;
  poster_url: string | null;
  genres: string[];
  features: FeatureVector;
};

export type CatalogueIndex = {
  version: number;
  axes: AxisDescriptor[];
  films: FilmIndexEntry[];
};

export type FilmDetail = FilmIndexEntry & {
  slug: string;
  duration_min: number | null;
  country: string[];
  story: string;
  themes: string[];
  similar_ids: number[];
};
