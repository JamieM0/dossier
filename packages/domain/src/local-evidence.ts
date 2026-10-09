import { cosineSimilarity } from "./taste-space.js";
import { ratingWeight, type RatingEntry, type TasteClaim } from "./store/model.js";
import { tasteClaimScoreAdjustment } from "./taste-claims.js";
import type { TmdbItem } from "./tmdb/types.js";

export const LOCAL_EVIDENCE_CONFIG = { power: 4, prior: 2, halfLifeDays: 30 } as const;
export type LocalEvidenceMode = "timeless" | "recent";

/** Experimental local evidence avoids moving centroids and changing top-K denominators. */
export function scoreLocalEvidence(
  candidates: readonly TmdbItem[], entries: readonly RatingEntry[],
  claims: readonly TasteClaim[], mode: LocalEvidenceMode, qualityWeight: number,
  referenceTime: number
): Array<{ item: TmdbItem; score: number }> {
  const ordered = [...entries].sort((a, b) => a.item.key.localeCompare(b.item.key));
  if (!ordered.some(entry => ratingWeight(entry.rating) > 0)) return [];
  const result: Array<{ item: TmdbItem; score: number }> = [];
  for (const item of candidates) {
    if (Object.values(item.features).every(value => value === 0)) continue;
    let numerator = 0, denominator = LOCAL_EVIDENCE_CONFIG.prior;
    for (const entry of ordered) {
      const rating = ratingWeight(entry.rating);
      if (rating === 0) continue;
      const similarity = Math.max(0, cosineSimilarity(item.features, entry.item.features));
      const age = Math.max(0, referenceTime - entry.ts) / 86_400_000;
      const decay = mode === "recent" ? 2 ** (-age / LOCAL_EVIDENCE_CONFIG.halfLifeDays) : 1;
      const weight = similarity ** LOCAL_EVIDENCE_CONFIG.power * Math.abs(rating) * decay;
      numerator += weight * Math.sign(rating);
      denominator += weight;
    }
    const quality = item.voteAverage == null ? 0 : (item.voteAverage / 10 - .5) * 2;
    result.push({ item, score: numerator / denominator + qualityWeight * quality + tasteClaimScoreAdjustment(item, claims) });
  }
  return result.sort((a, b) => b.score - a.score);
}
