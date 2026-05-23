/** Pure functions for weight derivation, recommendation ranking, and
 * the rating queue's serve order. No I/O — the caller passes in the
 * loaded catalogue index and the user's preference payload. */
import type {
  CatalogueIndex,
  FeatureVector,
  FilmIndexEntry,
  PairwiseChoice,
  Rating
} from "$lib/types";
import { clusterKey } from "$lib/catalogue";

const AXIS_KEYS = [
  "pacing",
  "tone_register",
  "ending_warmth",
  "emotional_intensity",
  "complexity",
  "scope",
  "realism",
  "darkness",
  "thematic_weight",
  "character_focus",
  "moral_clarity",
  "structure"
] as const satisfies readonly (keyof FeatureVector)[];

function zeroVector(): FeatureVector {
  return Object.fromEntries(AXIS_KEYS.map((k) => [k, 0])) as FeatureVector;
}

function scale(v: FeatureVector, k: number): FeatureVector {
  const out = zeroVector();
  for (const key of AXIS_KEYS) out[key] = v[key] * k;
  return out;
}

function add(a: FeatureVector, b: FeatureVector): FeatureVector {
  const out = zeroVector();
  for (const key of AXIS_KEYS) out[key] = a[key] + b[key];
  return out;
}

function magnitude(v: FeatureVector): number {
  let s = 0;
  for (const key of AXIS_KEYS) s += v[key] * v[key];
  return Math.sqrt(s);
}

function dot(a: FeatureVector, b: FeatureVector): number {
  let s = 0;
  for (const key of AXIS_KEYS) s += a[key] * b[key];
  return s;
}

export function cosineSimilarity(a: FeatureVector, b: FeatureVector): number {
  const ma = magnitude(a);
  const mb = magnitude(b);
  if (ma === 0 || mb === 0) return 0;
  return dot(a, b) / (ma * mb);
}

/** Weighted average of feature vectors weighted by user rating. Skips
 * absent films and entries with zero feature vectors. The result is the
 * "ideal film" centroid in feature space — what we then cosine against. */
export function computeUserWeights(
  index: CatalogueIndex,
  ratings: Record<string, Rating>,
  pairwise: PairwiseChoice[]
): FeatureVector {
  const filmsById = new Map(index.films.map((f) => [f.id, f]));
  let sum = zeroVector();
  let total = 0;

  for (const [idStr, rating] of Object.entries(ratings)) {
    const film = filmsById.get(Number(idStr));
    if (!film) continue;
    sum = add(sum, scale(film.features, rating));
    total += Math.abs(rating);
  }

  // Pairwise refinement: a "winner > loser" choice nudges the centroid
  // toward (winner - loser) with a small weight relative to a full
  // rating. Capped so pairwise can never dominate explicit ratings.
  const PAIR_WEIGHT = 0.25;
  for (const choice of pairwise) {
    const w = filmsById.get(choice.winnerId);
    const l = filmsById.get(choice.loserId);
    if (!w || !l) continue;
    const diff = zeroVector();
    for (const key of AXIS_KEYS) diff[key] = w.features[key] - l.features[key];
    sum = add(sum, scale(diff, PAIR_WEIGHT));
    total += PAIR_WEIGHT;
  }

  if (total === 0) return zeroVector();
  return scale(sum, 1 / total);
}

export type Recommendation = {
  film: FilmIndexEntry;
  score: number;
};

/** Top-N recommendations: unrated films ranked by cosine similarity to
 * the user weight vector. Films with empty feature vectors are skipped
 * (cosine is undefined). */
export function rankRecommendations(
  index: CatalogueIndex,
  weights: FeatureVector,
  excludeIds: Set<number>,
  limit: number
): Recommendation[] {
  if (magnitude(weights) === 0) return [];
  const scored: Recommendation[] = [];
  for (const film of index.films) {
    if (excludeIds.has(film.id)) continue;
    if (magnitude(film.features) === 0) continue;
    scored.push({ film, score: cosineSimilarity(weights, film.features) });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

/** Rating queue serve order. Plan: "serve films the user is likely to
 * have seen first — sort by popularity within recognisable era/genre
 * clusters". We round-robin clusters so the first 30 films span eras
 * and genres instead of being all 2020s blockbusters. */
export function buildRatingQueue(
  index: CatalogueIndex,
  excludeIds: Set<number>
): FilmIndexEntry[] {
  const clusters = new Map<string, FilmIndexEntry[]>();
  for (const film of index.films) {
    if (excludeIds.has(film.id)) continue;
    if (magnitude(film.features) === 0) continue;
    const key = clusterKey(film);
    const bucket = clusters.get(key);
    if (bucket) {
      bucket.push(film);
    } else {
      clusters.set(key, [film]);
    }
  }
  // Within each cluster, popular first.
  for (const bucket of clusters.values()) {
    bucket.sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
  }
  // Round-robin across clusters, ordered by their most-popular member
  // so the absolute biggest films still surface in the first dozen.
  const ordered = [...clusters.values()].sort(
    (a, b) => (b[0].popularity ?? 0) - (a[0].popularity ?? 0)
  );
  const out: FilmIndexEntry[] = [];
  let depth = 0;
  while (out.length < index.films.length) {
    let added = 0;
    for (const bucket of ordered) {
      if (bucket[depth]) {
        out.push(bucket[depth]);
        added++;
      }
    }
    if (added === 0) break;
    depth++;
  }
  return out;
}

/** Pair candidates for the refinement view: films of similar rating
 * (both liked or both disliked) where the user clearly hasn't said
 * which they prefer. Trivial pairs (liked vs disliked) are excluded —
 * the user has already implicitly answered those. */
export function buildPairwiseCandidates(
  index: CatalogueIndex,
  ratings: Record<string, Rating>,
  pairwise: PairwiseChoice[],
  limit: number
): Array<[FilmIndexEntry, FilmIndexEntry]> {
  const filmsById = new Map(index.films.map((f) => [f.id, f]));
  const seen = new Set(
    pairwise.map((p) => [p.winnerId, p.loserId].sort().join("|"))
  );

  const liked: FilmIndexEntry[] = [];
  const disliked: FilmIndexEntry[] = [];
  for (const [idStr, rating] of Object.entries(ratings)) {
    const f = filmsById.get(Number(idStr));
    if (!f) continue;
    (rating === 1 ? liked : disliked).push(f);
  }

  const out: Array<[FilmIndexEntry, FilmIndexEntry]> = [];
  const pickPairs = (pool: FilmIndexEntry[]): void => {
    for (let i = 0; i < pool.length && out.length < limit; i++) {
      for (let j = i + 1; j < pool.length && out.length < limit; j++) {
        const key = [pool[i].id, pool[j].id].sort().join("|");
        if (seen.has(key)) continue;
        out.push([pool[i], pool[j]]);
      }
    }
  };
  pickPairs(liked);
  pickPairs(disliked);
  return out;
}
