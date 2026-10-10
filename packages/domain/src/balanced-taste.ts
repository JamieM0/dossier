import { AXIS_KEYS } from './lens.js';
import { learnTasteDistinctions, learnedTasteEvidence } from './learned-taste.js';
import { scoreCandidate, DEFAULT_SCORING_PARAMS, type ScoringParams } from './recommender.js';
import { buildTasteSpace } from './taste-space.js';
import { tasteClaimScoreAdjustment } from './taste-claims.js';
import { ratingWeight, type PairwiseChoice, type RatingEntry, type TasteClaim } from './store/model.js';
import type { TmdbItem } from './tmdb/types.js';

export const BALANCED_TASTE_CONFIG = { evidencePrior: 10 } as const;
export type BalancedTasteMode = 'balanced_descriptive' | 'balanced_comparisons';

export function balancedTasteInfluence(entries: readonly RatingEntry[]): number {
  let liked = 0, disliked = 0;
  for (const entry of entries) {
    const weight = ratingWeight(entry.rating);
    if (weight > 0) liked += weight;
    else disliked -= weight;
  }
  const balanced = Math.min(liked, disliked);
  return balanced / (balanced + BALANCED_TASTE_CONFIG.evidencePrior);
}

/** Retain distinct taste clusters while personal distinctions acquire
 * influence from balanced evidence, rather than total action count. */
export function scoreBalancedTaste(candidates: TmdbItem[], entries: readonly RatingEntry[], claims: readonly TasteClaim[], choices: readonly PairwiseChoice[], mode: BalancedTasteMode,
  params: ScoringParams = DEFAULT_SCORING_PARAMS, referenceTime = Date.now()) {
  const space = buildTasteSpace(entries, { clusterMergeThreshold: params.clusterMergeThreshold,
    ratingRecencyStrength: params.ratingRecencyStrength, referenceTime });
  const liked = space.clusters.filter(c => c.polarity === 'liked');
  if (!liked.length) return [];
  const disliked = space.clusters.filter(c => c.polarity === 'disliked');
  const taste = learnTasteDistinctions(entries, choices, mode === 'balanced_comparisons' ? 'comparisons' : 'descriptive');
  const influence = balancedTasteInfluence(entries);
  const baseParams = { ...params, popularityBias: 0, recencyBias: 0, runtimeBias: 0 };
  return candidates.filter(item => AXIS_KEYS.some(axis => item.features[axis] !== 0)).map(item => {
    const evidence = learnedTasteEvidence(item, taste);
    // Axis dials retain their existing neutral value of one.
    const personal = evidence.score - taste.intercept + evidence.contributions.filter(d => d.kind === 'axis')
      .reduce((sum, d) => sum + d.contribution * ((params.axisWeights[d.value as keyof typeof params.axisWeights] ?? 1) - 1), 0);
    const quality = item.voteAverage == null ? 0 : (item.voteAverage / 10 - .5) * 2;
    const cluster = scoreCandidate(item, liked, disliked, baseParams);
    const discovery = scoreCandidate(item, liked, disliked, params) - cluster;
    let score = influence * (personal + params.qualityWeight * quality) + (1 - influence) * cluster
      + discovery + tasteClaimScoreAdjustment(item, claims);
    if (params.serendipity > 0) score += (Math.random() - .5) * 4 * params.serendipity;
    return { item, score };
  }).sort((a,b) => b.score - a.score);
}
