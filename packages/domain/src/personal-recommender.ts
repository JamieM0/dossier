import { scoreRecentTaste } from './recent-taste.js';
import { DEFAULT_SCORING_PARAMS, scoreCandidates, type ScoringParams } from './recommender.js';
import type { PairwiseChoice, RatedItem, RatingEntry, TasteClaim } from './store/model.js';
import type { TmdbItem } from './tmdb/types.js';

export const BASE_TASTE_POLICY = 'adaptive_comparisons' as const;

export function scorePersonalCandidates(candidates: TmdbItem[], entries: RatingEntry[], params: ScoringParams = DEFAULT_SCORING_PARAMS,
  claims: readonly TasteClaim[] = [], choices: readonly PairwiseChoice[] = []) {
  // Explicit temporal dials retain the validated cluster decay policy.
  if (params.ratingRecencyStrength > 0) return scoreCandidates(candidates, entries, params, claims);
  return scoreRecentTaste(candidates, entries, claims, choices, params);
}

export function predictPersonalPreference(item: TmdbItem | RatedItem, entries: RatingEntry[], params: ScoringParams = DEFAULT_SCORING_PARAMS,
  claims: readonly TasteClaim[] = [], choices: readonly PairwiseChoice[] = []): number {
  const candidate: TmdbItem = { voteCount: null, popularity: null, genreIds: [], overview: '', runtime: null,
    collection: null, directorIds: [], creatorIds: [], ...item };
  const raw = scorePersonalCandidates([candidate], entries, { ...params, serendipity: 0 }, claims, choices)[0]?.score ?? 0;
  if (!entries.some(e => e.rating > 0)) return 0;
  return Number.isFinite(raw) ? Math.max(0, Math.min(100, (raw + 1) * 50)) : 0;
}
