/** Pure scoring functions for the entertainment recommender. No I/O —
 * candidate fetching lives in discovery.ts. The model is intentionally
 * medium-agnostic: it operates only on lens feature vectors, so the same
 * code will serve books/etc. once those mediums exist.
 *
 * Why not a single "ideal item" centroid (the old approach): averaging
 * every rated item collapses split tastes (e.g. bleak dramas *and*
 * breezy comedies) into a mushy mid-point that matches neither. Instead
 * we score a candidate by how well it matches its *nearest* liked items
 * (weighted kNN), which preserves multiple taste clusters, and penalise
 * proximity to disliked items. */
import type { FeatureVector, RatingEntry, TmdbItem } from "$lib/types";
import { ratingWeight } from "$lib/types";

/** The minimum an item needs to be scored: a lens vector and a quality
 * signal. Both TmdbItem and the stored RatedItem snapshot satisfy it. */
type Scorable = { features: FeatureVector; voteAverage: number | null };

export const AXIS_KEYS = [
  "pacing",
  "tone",
  "emotional_intensity",
  "complexity",
  "scope",
  "realism",
  "thematic_weight",
  "character_focus",
  "moral_clarity",
  "structure"
] as const satisfies readonly (keyof FeatureVector)[];

function magnitude(v: FeatureVector): number {
  let s = 0;
  for (const k of AXIS_KEYS) s += v[k] * v[k];
  return Math.sqrt(s);
}

function dot(a: FeatureVector, b: FeatureVector): number {
  let s = 0;
  for (const k of AXIS_KEYS) s += a[k] * b[k];
  return s;
}

export function cosineSimilarity(a: FeatureVector, b: FeatureVector): number {
  const ma = magnitude(a);
  const mb = magnitude(b);
  if (ma === 0 || mb === 0) return 0;
  return dot(a, b) / (ma * mb);
}

/** How many nearest liked items contribute to a candidate's score. Small
 * enough to keep distinct taste clusters separable. */
const TOP_K = 3;
/** How hard proximity to a disliked item drags a candidate down. */
const DISLIKE_PENALTY = 0.6;
/** Tiny quality nudge so near-ties resolve toward better-reviewed items;
 * kept small so taste dominates. */
const QUALITY_WEIGHT = 0.05;

type Pole = { features: FeatureVector; weight: number };

function splitPoles(entries: RatingEntry[]): { liked: Pole[]; disliked: Pole[] } {
  const liked: Pole[] = [];
  const disliked: Pole[] = [];
  for (const e of entries) {
    const w = ratingWeight(e.rating); // like 1, watchlist .5, dislike/not_interested -1
    const pole = { features: e.item.features, weight: Math.abs(w) };
    if (w > 0) liked.push(pole);
    else if (w < 0) disliked.push(pole);
  }
  return { liked, disliked };
}

/** Score a single candidate against the liked/disliked poles. Returns a
 * value roughly in [-1.6, 1.05]; only the ordering matters. */
export function scoreCandidate(
  candidate: Scorable,
  liked: Pole[],
  disliked: Pole[]
): number {
  if (magnitude(candidate.features) === 0) return -Infinity;

  // Best matches among liked items (weighted), top-K averaged.
  const likedSims = liked
    .map((p) => cosineSimilarity(candidate.features, p.features) * p.weight)
    .sort((a, b) => b - a);
  const k = Math.min(TOP_K, likedSims.length);
  let likedScore = 0;
  if (k > 0) {
    let sum = 0;
    for (let i = 0; i < k; i++) sum += likedSims[i];
    likedScore = sum / k;
  }

  // Closest disliked item (only positive similarity hurts).
  let dislikeMax = 0;
  for (const p of disliked) {
    const sim = cosineSimilarity(candidate.features, p.features);
    if (sim > dislikeMax) dislikeMax = sim;
  }

  const quality =
    candidate.voteAverage != null ? (candidate.voteAverage / 10 - 0.5) * 2 : 0;

  return likedScore - DISLIKE_PENALTY * dislikeMax + QUALITY_WEIGHT * quality;
}

export type Recommendation = { item: TmdbItem; score: number };

/** Rank a pre-fetched candidate pool by taste. `excludeKeys` removes
 * already-rated/skipped items. Returns the top `limit`. */
export function rankRecommendations(
  candidates: TmdbItem[],
  entries: RatingEntry[],
  excludeKeys: Set<string>,
  limit: number
): Recommendation[] {
  const { liked, disliked } = splitPoles(entries);
  if (liked.length === 0) return [];

  const seen = new Set<string>();
  const scored: Recommendation[] = [];
  for (const item of candidates) {
    const key = `${item.medium}:${item.id}`;
    if (excludeKeys.has(key) || seen.has(key)) continue;
    seen.add(key);
    const score = scoreCandidate(item, liked, disliked);
    if (score === -Infinity) continue;
    scored.push({ item, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

/** Predicted preference for a single item, 0–100. Used by the refine
 * badges. Clamps negative similarity to 0 (no meaningful "anti-match"
 * to surface). */
export function predictPreference(item: Scorable, entries: RatingEntry[]): number {
  const { liked, disliked } = splitPoles(entries);
  if (liked.length === 0) return 0;
  const raw = scoreCandidate(item, liked, disliked);
  if (!Number.isFinite(raw)) return 0;
  return Math.round(Math.max(0, Math.min(1, raw)) * 100);
}

/** Pair candidates for refinement: items the user rated similarly (both
 * liked, or both disliked) where they haven't yet said which they
 * prefer. Operates entirely on stored snapshots — no fetch. */
export function buildPairwiseCandidates(
  entries: RatingEntry[],
  pairwise: { winnerKey: string; loserKey: string }[],
  limit: number
): Array<[RatingEntry, RatingEntry]> {
  const seen = new Set(pairwise.map((p) => [p.winnerKey, p.loserKey].sort().join("|")));
  const liked: RatingEntry[] = [];
  const disliked: RatingEntry[] = [];
  for (const e of entries) {
    const w = ratingWeight(e.rating);
    if (w > 0) liked.push(e);
    else if (w < 0) disliked.push(e);
  }

  const out: Array<[RatingEntry, RatingEntry]> = [];
  const pickPairs = (pool: RatingEntry[]): void => {
    for (let i = 0; i < pool.length && out.length < limit; i++) {
      for (let j = i + 1; j < pool.length && out.length < limit; j++) {
        const key = [pool[i].item.key, pool[j].item.key].sort().join("|");
        if (seen.has(key)) continue;
        out.push([pool[i], pool[j]]);
      }
    }
  };
  pickPairs(liked);
  pickPairs(disliked);
  return out;
}
