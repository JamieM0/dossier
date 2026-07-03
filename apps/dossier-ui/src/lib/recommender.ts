/** Pure scoring functions for the entertainment recommender. No I/O —
 * candidate fetching lives in discovery.ts. The model is intentionally
 * medium-agnostic: it operates only on lens feature vectors, so the same
 * code will serve books/etc. once those mediums exist.
 *
 * Why not a single "ideal item" centroid (the old approach): averaging
 * every rated item collapses split tastes (e.g. bleak dramas *and*
 * breezy comedies) into a mushy mid-point that matches neither.
 *
 * Why not raw top-K nearest *items* either (the previous approach here):
 * it doesn't scale. With only a handful of ratings, "nearest liked item"
 * is a meaningful filter. But once a user has rated hundreds of titles,
 * almost any reasonably mainstream candidate ends up close to *something*
 * in their history purely by volume — scores for very different
 * candidates converge toward the same narrow high band, and the ranking
 * degenerates into whatever tie-break signal is left (vote average,
 * insertion order). Measured directly: the spread between candidate
 * scores shrinks roughly 4x going from 5 rated items to 500+.
 *
 * Instead, liked/disliked items are first collapsed into *taste clusters*
 * (buildClusters): ratings with a similar fingerprint get merged into one
 * cluster with a running-average centroid, rather than staying as separate
 * points. A candidate is scored against its nearest few *clusters*, not
 * its nearest few *raw items*. This keeps the original fix (distinct
 * tastes — horror vs. rom-com — never get blended into one mushy
 * average), while fixing the new problem: the number of clusters reflects
 * how many genuinely distinct things you like, not how many ratings
 * you've made, so it doesn't saturate as your history grows. A cluster's
 * confidence (and thus its influence) grows with how many ratings
 * reinforce it, so recommendations keep sharpening — never degrading —
 * the more you rate. */
import type { FeatureVector, RatingEntry, TmdbItem } from "$lib/types";
import { ratingWeight } from "$lib/types";

/** The minimum an item needs to be scored: a lens vector and a quality
 * signal. Both TmdbItem and the stored RatedItem snapshot satisfy it.
 * The remaining fields are optional TMDB signals the base scorer never
 * reads — only the Discovery-dial post-adjustments in ScoringParams
 * touch them, and they no-op when absent (e.g. a RatedItem snapshot). */
type Scorable = {
  features: FeatureVector;
  voteAverage: number | null;
  popularity?: number | null;
  year?: number | null;
  runtime?: number | null;
};

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

export type AxisKey = (typeof AXIS_KEYS)[number];

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

/** Same as cosineSimilarity, but each axis's contribution is scaled by an
 * optional per-axis weight (default 1) before the dot product/magnitude —
 * i.e. each coordinate is effectively stretched by sqrt(weight). With no
 * weights (or all 1s) this is bit-identical to cosineSimilarity, which is
 * what keeps the Feature-Axis dials a no-op at their default position.
 * Only used for candidate-vs-cluster matching, never for cluster merging
 * (buildClusters) — axis emphasis should sharpen *matching*, not silently
 * change what counts as "the same taste". */
function weightedCosineSimilarity(
  a: FeatureVector,
  b: FeatureVector,
  weights: Partial<Record<AxisKey, number>>
): number {
  let dotP = 0;
  let ma = 0;
  let mb = 0;
  for (const k of AXIS_KEYS) {
    const w = weights[k] ?? 1;
    dotP += a[k] * b[k] * w;
    ma += a[k] * a[k] * w;
    mb += b[k] * b[k] * w;
  }
  if (ma === 0 || mb === 0) return 0;
  return dotP / Math.sqrt(ma * mb);
}

/** How many nearest taste clusters contribute to a candidate's score.
 * Small enough to keep distinct tastes (horror vs. rom-com) separable —
 * a candidate only has to resemble a *few* of your taste clusters, not
 * a blend of all of them. */
const TOP_K_CLUSTERS = 3;
/** How hard proximity to a disliked cluster drags a candidate down. */
const DISLIKE_PENALTY = 0.6;
/** Tiny quality nudge so near-ties resolve toward better-reviewed items;
 * kept small so taste dominates. */
const QUALITY_WEIGHT = 0.05;
/** Cosine similarity above which two ratings are considered "the same
 * taste" and merged into one cluster rather than kept as separate points.
 * High enough that only genuinely similar fingerprints merge (so distinct
 * tastes stay distinct); the exact value matters less than having *some*
 * merging, since that's what keeps cluster count from growing linearly
 * with rating count. */
const CLUSTER_MERGE_THRESHOLD = 0.75;
/** Smooths a cluster's influence by how many ratings reinforce it: a
 * cluster built from a single rating counts at half strength (1/(1+1));
 * one reinforced by 9 more ratings counts at 10/11 ≈ 0.91. This is what
 * makes the recommender sharpen (not saturate) as you rate more — a
 * cluster's centroid *and* its confidence both improve with more data. */
const CLUSTER_CONFIDENCE_SMOOTHING = 1;

/** Tunable inputs to the scorer, surfaced to users as the Recommendations
 * "Dials" panel (RecommendationsDialsPanel.svelte). Every field defaults
 * to the constant above it already used, so DEFAULT_SCORING_PARAMS
 * reproduces today's ranking exactly — dials only diverge from that once
 * a user actually moves them. The three *Bias fields and serendipity are
 * genuinely new terms (not existing constants), but they're additive and
 * zero at rest, so they're no-ops until touched too; see popularityTerm/
 * recencyTerm/runtimeTerm below. */
export type ScoringParams = {
  qualityWeight: number;
  dislikePenalty: number;
  clusterMergeThreshold: number;
  topKClusters: number;
  axisWeights: Partial<Record<AxisKey, number>>;
  /** -1 (favor obscure) .. 0 (off) .. 1 (favor mainstream). */
  popularityBias: number;
  /** -1 (favor older) .. 0 (off) .. 1 (favor newer). */
  recencyBias: number;
  /** -1 (favor shorter) .. 0 (off) .. 1 (favor longer). */
  runtimeBias: number;
  /** 0 (off, all ratings count equally regardless of age) .. 1 (only
   * recent ratings meaningfully shape the taste profile). */
  ratingRecencyStrength: number;
  /** 0 (off, deterministic ranking) .. 1 (near-random ordering). */
  serendipity: number;
};

export const DEFAULT_SCORING_PARAMS: ScoringParams = {
  qualityWeight: QUALITY_WEIGHT,
  dislikePenalty: DISLIKE_PENALTY,
  clusterMergeThreshold: CLUSTER_MERGE_THRESHOLD,
  topKClusters: TOP_K_CLUSTERS,
  axisWeights: {},
  popularityBias: 0,
  recencyBias: 0,
  runtimeBias: 0,
  ratingRecencyStrength: 0,
  serendipity: 0
};

/** Score is roughly additive in [-1.6, 1.05] (see scoreCandidate's doc);
 * this caps how far a maxed-out Discovery dial can swing it — enough to
 * meaningfully reorder the list without one dial alone drowning out taste
 * entirely. */
const POST_ADJUST_WEIGHT = 0.4;

/** TMDB's popularity metric is unbounded (roughly 0-2000+ for mainstream
 * hits) and heavily right-skewed, so it's log-compressed to 0..1 before
 * use — otherwise a handful of blockbusters would swamp the scale. */
function popularityTerm(candidate: Scorable, bias: number): number {
  if (bias === 0 || candidate.popularity == null) return 0;
  const normalized = Math.max(0, Math.min(1, Math.log10(candidate.popularity + 1) / 3.3));
  return bias * (normalized - 0.5) * 2 * POST_ADJUST_WEIGHT;
}

/** Normalizes release year against a 60-year trailing window so both
 * classics and brand-new releases land near the two ends. */
function recencyTerm(candidate: Scorable, bias: number): number {
  if (bias === 0 || candidate.year == null) return 0;
  const currentYear = new Date().getFullYear();
  const normalized = Math.max(0, Math.min(1, (candidate.year - (currentYear - 60)) / 60));
  return bias * (normalized - 0.5) * 2 * POST_ADJUST_WEIGHT;
}

/** Normalizes runtime (minutes) against a 0-210 window, which comfortably
 * covers everything from a sitcom episode to an epic. */
function runtimeTerm(candidate: Scorable, bias: number): number {
  if (bias === 0 || candidate.runtime == null) return 0;
  const normalized = Math.max(0, Math.min(1, candidate.runtime / 210));
  return bias * (normalized - 0.5) * 2 * POST_ADJUST_WEIGHT;
}

/** How far a maxed-out Rating Recency dial lets old ratings fade — the
 * half-life shrinks from "no real decay" toward two weeks as the dial
 * increases. strength <= 0 always returns exactly 1 (no floating-point
 * drift), which is what keeps the dial's default bit-identical to today's
 * unweighted behavior. */
function ratingRecencyWeight(ts: number, strength: number): number {
  if (strength <= 0) return 1;
  const ageDays = (Date.now() - ts) / 86_400_000;
  const halfLifeDays = 3650 - strength * 3636; // strength 1 -> ~14 days
  return Math.pow(0.5, ageDays / halfLifeDays);
}

type Pole = { features: FeatureVector; weight: number };

/** A merged taste cluster: a running-average centroid over one or more
 * ratings with a similar fingerprint, plus the accumulated rating weight
 * behind it (used for confidence). */
type Cluster = { centroid: FeatureVector; weight: number; count: number };

function splitPoles(
  entries: RatingEntry[],
  recencyStrength = 0
): { liked: Pole[]; disliked: Pole[] } {
  const liked: Pole[] = [];
  const disliked: Pole[] = [];
  for (const e of entries) {
    const w = ratingWeight(e.rating) * ratingRecencyWeight(e.ts, recencyStrength); // like 1, watchlist .15, dislike/not_interested -1
    const pole = { features: e.item.features, weight: Math.abs(w) };
    if (w > 0) liked.push(pole);
    else if (w < 0) disliked.push(pole);
  }
  return { liked, disliked };
}

/** Greedily merge poles into taste clusters: each pole joins its nearest
 * existing cluster if they're similar enough (mergeThreshold, defaults to
 * CLUSTER_MERGE_THRESHOLD — the Taste Granularity dial), updating that
 * cluster's centroid as a weighted running average; otherwise it starts a
 * new cluster. Order-dependent in principle, but ratings arrive
 * incrementally in practice so this matches how a user's taste profile
 * actually accumulates. */
function buildClusters(poles: Pole[], mergeThreshold: number = CLUSTER_MERGE_THRESHOLD): Cluster[] {
  const clusters: Cluster[] = [];
  for (const pole of poles) {
    let best: Cluster | null = null;
    let bestSim = -Infinity;
    for (const c of clusters) {
      const sim = cosineSimilarity(pole.features, c.centroid);
      if (sim > bestSim) {
        bestSim = sim;
        best = c;
      }
    }
    if (best && bestSim >= mergeThreshold) {
      const newWeight = best.weight + pole.weight;
      for (const k of AXIS_KEYS) {
        best.centroid[k] = (best.centroid[k] * best.weight + pole.features[k] * pole.weight) / newWeight;
      }
      best.weight = newWeight;
      best.count += 1;
    } else {
      clusters.push({ centroid: { ...pole.features }, weight: pole.weight, count: 1 });
    }
  }
  return clusters;
}

function clusterConfidence(c: Cluster): number {
  return c.weight / (c.weight + CLUSTER_CONFIDENCE_SMOOTHING);
}

/** Score a single candidate against the liked/disliked taste clusters.
 * Returns a value roughly in [-1.6, 1.05] at default params (Discovery
 * dial post-adjustments can widen that range further); only the ordering
 * matters. */
export function scoreCandidate(
  candidate: Scorable,
  likedClusters: Cluster[],
  dislikedClusters: Cluster[],
  params: ScoringParams = DEFAULT_SCORING_PARAMS
): number {
  if (magnitude(candidate.features) === 0) return -Infinity;

  // Best matches among taste clusters (confidence-weighted), top-K
  // averaged. Clamped to >= 0: a candidate is credited for resembling
  // *some* of your taste clusters, never penalized here for not
  // resembling an unrelated one — that penalty-by-averaging is exactly
  // what melds distinct tastes into a mushy blend (see module doc). A
  // candidate only has to be close to a few of your clusters, not all
  // (Safe vs. Adventurous dial: topKClusters).
  const likedSims = likedClusters
    .map(
      (c) =>
        Math.max(0, weightedCosineSimilarity(candidate.features, c.centroid, params.axisWeights)) *
        clusterConfidence(c)
    )
    .sort((a, b) => b - a);
  const k = Math.min(Math.max(1, Math.round(params.topKClusters)), likedSims.length);
  let likedScore = 0;
  if (k > 0) {
    let sum = 0;
    for (let i = 0; i < k; i++) sum += likedSims[i];
    likedScore = sum / k;
  }

  // Closest disliked cluster (only positive similarity hurts).
  let dislikeMax = 0;
  for (const c of dislikedClusters) {
    const sim = weightedCosineSimilarity(candidate.features, c.centroid, params.axisWeights) * clusterConfidence(c);
    if (sim > dislikeMax) dislikeMax = sim;
  }

  const quality =
    candidate.voteAverage != null ? (candidate.voteAverage / 10 - 0.5) * 2 : 0;

  const base = likedScore - params.dislikePenalty * dislikeMax + params.qualityWeight * quality;
  return (
    base +
    popularityTerm(candidate, params.popularityBias) +
    recencyTerm(candidate, params.recencyBias) +
    runtimeTerm(candidate, params.runtimeBias)
  );
}

export type Recommendation = { item: TmdbItem; score: number };

/** How far the Exploration/Serendipity dial can jitter a score — large
 * enough at full strength to override taste-based ordering almost
 * entirely, since that dial is explicitly about breaking out of a rut
 * rather than about ranking accuracy. */
const SERENDIPITY_WEIGHT = 2;

/** Score and sort one batch of candidates by taste. Callers doing
 * infinite-scroll should score each newly-fetched page as its own batch
 * and append the (already internally-sorted) result to a stable list,
 * rather than re-ranking the whole accumulated pool on every page — that
 * would let a later page's high scorers jump ahead of items the user has
 * already scrolled past. Exclusion (rated/skipped) is left to the caller
 * since it can change independently of the pool (e.g. rating an item
 * that's already on screen). Callers that want a Dials-panel change to
 * reshuffle already-shown cards should instead re-run this over the
 * *whole* accumulated pool as one batch — see +page.svelte's dial effect. */
export function scoreCandidates(
  candidates: TmdbItem[],
  entries: RatingEntry[],
  params: ScoringParams = DEFAULT_SCORING_PARAMS
): Recommendation[] {
  const { liked, disliked } = splitPoles(entries, params.ratingRecencyStrength);
  if (liked.length === 0) return [];
  const likedClusters = buildClusters(liked, params.clusterMergeThreshold);
  const dislikedClusters = buildClusters(disliked, params.clusterMergeThreshold);

  const scored: Recommendation[] = [];
  for (const item of candidates) {
    let score = scoreCandidate(item, likedClusters, dislikedClusters, params);
    if (score === -Infinity) continue;
    if (params.serendipity > 0) {
      score += (Math.random() - 0.5) * 2 * params.serendipity * SERENDIPITY_WEIGHT;
    }
    scored.push({ item, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored;
}

/** Predicted preference for a single item, 0–100. Used by the refine
 * badges. Clamps negative similarity to 0 (no meaningful "anti-match"
 * to surface). */
export function predictPreference(
  item: Scorable,
  entries: RatingEntry[],
  params: ScoringParams = DEFAULT_SCORING_PARAMS
): number {
  const { liked, disliked } = splitPoles(entries, params.ratingRecencyStrength);
  if (liked.length === 0) return 0;
  const raw = scoreCandidate(
    item,
    buildClusters(liked, params.clusterMergeThreshold),
    buildClusters(disliked, params.clusterMergeThreshold),
    params
  );
  if (!Number.isFinite(raw)) return 0;
  return Math.round(Math.max(0, Math.min(1, raw)) * 100);
}

/** A liked taste cluster surfaced for display (e.g. Recommendations'
 * "Because you like X" rows) — same clustering as the scorer, plus a
 * human label derived from the genres of the ratings that formed it. */
export type TasteGroup = { label: string; centroid: FeatureVector; weight: number };

/** Same greedy merge as buildClusters, but also accumulates weighted
 * genre counts per cluster so the UI can label each group with the
 * genres that actually built it (e.g. "Action, Thriller"), and sorts by
 * weight so the strongest taste comes first. Liked ratings only — there's
 * no "because you disliked X" row. */
export function buildTasteGroups(entries: RatingEntry[]): TasteGroup[] {
  type LabeledCluster = Cluster & { genreWeight: Map<string, number> };
  const clusters: LabeledCluster[] = [];
  for (const e of entries) {
    const w = ratingWeight(e.rating);
    if (w <= 0) continue;
    const features = e.item.features;
    let best: LabeledCluster | null = null;
    let bestSim = -Infinity;
    for (const c of clusters) {
      const sim = cosineSimilarity(features, c.centroid);
      if (sim > bestSim) {
        bestSim = sim;
        best = c;
      }
    }
    const target =
      best && bestSim >= CLUSTER_MERGE_THRESHOLD
        ? best
        : (() => {
            const fresh: LabeledCluster = {
              centroid: { ...features },
              weight: 0,
              count: 0,
              genreWeight: new Map()
            };
            clusters.push(fresh);
            return fresh;
          })();
    const newWeight = target.weight + w;
    for (const k of AXIS_KEYS) {
      target.centroid[k] = (target.centroid[k] * target.weight + features[k] * w) / newWeight;
    }
    target.weight = newWeight;
    target.count += 1;
    for (const g of e.item.genres) {
      target.genreWeight.set(g, (target.genreWeight.get(g) ?? 0) + w);
    }
  }

  return clusters
    .map((c) => {
      const topGenres = [...c.genreWeight.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([name]) => name);
      return {
        label: topGenres.length > 0 ? topGenres.join(" & ") : "Your taste",
        centroid: c.centroid,
        weight: c.weight
      };
    })
    .sort((a, b) => b.weight - a.weight);
}

/** Which taste group a candidate resembles most (by raw cosine similarity
 * to each group's centroid) — used to sort recommendations into
 * "Because you like X" rows. Returns -1 if there are no groups. */
export function nearestGroupIndex(candidate: Scorable, groups: TasteGroup[]): number {
  let best = -1;
  let bestSim = -Infinity;
  for (let i = 0; i < groups.length; i++) {
    const sim = cosineSimilarity(candidate.features, groups[i].centroid);
    if (sim > bestSim) {
      bestSim = sim;
      best = i;
    }
  }
  return best;
}

export type TasteRow = { label: string; items: Recommendation[] };

/** Sort recommendations into "Because you like X" rows. Multiple taste
 * clusters can land on the same genre-derived label (e.g. two clusters
 * both dominated by "Comedy & Drama" but with different centroids) —
 * those are merged into a single row by label, so a row title is never
 * repeated and never collides as a UI list key. Rows are sorted by
 * total cluster weight (strongest taste first); recommendations within
 * a row keep the stable order they arrived in. */
export function groupRecommendationsByTaste(
  recommendations: Recommendation[],
  groups: TasteGroup[]
): TasteRow[] {
  const byLabel = new Map<string, { label: string; weight: number; items: Recommendation[] }>();
  for (const rec of recommendations) {
    const idx = nearestGroupIndex(rec.item, groups);
    if (idx < 0) continue;
    const group = groups[idx];
    const bucket = byLabel.get(group.label) ?? { label: group.label, weight: 0, items: [] };
    bucket.weight += group.weight;
    bucket.items.push(rec);
    byLabel.set(group.label, bucket);
  }
  return [...byLabel.values()]
    .filter((b) => b.items.length > 0)
    .sort((a, b) => b.weight - a.weight)
    .map(({ label, items }) => ({ label, items }));
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
