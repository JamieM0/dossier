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
import { ratingWeight } from "$lib/types";
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

/** A TV series carries 5x the weight of a film when shaping the user's
 * profile — by deliberate choice, one rated series is treated as a
 * stronger taste signal than one rated film. */
export const TV_RATING_MULTIPLIER = 5;

/** Weighted average of feature vectors weighted by user rating. Skips
 * absent films and entries with zero feature vectors. The result is the
 * "ideal film" centroid in feature space — what we then cosine against.
 *
 * `tvIndex` is optional; when supplied, ratings on items present in the
 * TV catalogue are weighted TV_RATING_MULTIPLIER× heavier than movie
 * ratings, and TV items are merged into the feature lookup so a rating
 * isn't silently dropped just because the active mode is "movies". */
export function computeUserWeights(
  index: CatalogueIndex,
  ratings: Record<string, Rating>,
  pairwise: PairwiseChoice[],
  tvIndex?: CatalogueIndex | null
): FeatureVector {
  const filmsById = new Map<number, FilmIndexEntry>(
    index.films.map((f) => [f.id, f])
  );
  const tvIds = new Set<number>();
  if (tvIndex) {
    for (const f of tvIndex.films) {
      tvIds.add(f.id);
      if (!filmsById.has(f.id)) filmsById.set(f.id, f);
    }
  }

  let sum = zeroVector();
  let total = 0;

  for (const [idStr, rating] of Object.entries(ratings)) {
    const id = Number(idStr);
    const film = filmsById.get(id);
    if (!film) continue;
    const mult = tvIds.has(id) ? TV_RATING_MULTIPLIER : 1;
    const w = ratingWeight(rating) * mult;
    sum = add(sum, scale(film.features, w));
    total += Math.abs(w);
  }

  // Pairwise refinement: a "winner > loser" choice nudges the centroid
  // toward (winner - loser) with a small weight relative to a full
  // rating. Capped so pairwise can never dominate explicit ratings.
  // Pairs are always within the same medium (built per-mode), so they
  // inherit the same TV multiplier when both sides are TV.
  const PAIR_WEIGHT = 0.25;
  for (const choice of pairwise) {
    const w = filmsById.get(choice.winnerId);
    const l = filmsById.get(choice.loserId);
    if (!w || !l) continue;
    const mult =
      tvIds.has(choice.winnerId) && tvIds.has(choice.loserId)
        ? TV_RATING_MULTIPLIER
        : 1;
    const diff = zeroVector();
    for (const key of AXIS_KEYS) diff[key] = w.features[key] - l.features[key];
    sum = add(sum, scale(diff, PAIR_WEIGHT * mult));
    total += PAIR_WEIGHT * mult;
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

/** Rating queue serve order: popularity-first with ~12.5% diversity.
 * Pattern [P, P, P, P, P, P, P, D] — seven popular films per one
 * cluster-diverse pick. Surfaces films the user is likely to have
 * seen first, while the diverse slot prevents long runs of
 * same-era/same-genre titles without dragging in too many obscurities.
 *
 * Popular = sorted by popularity desc. Diverse = round-robin across
 * (decade, primary-genre) clusters, popular-first within each cluster
 * so the diverse slot still emits recognisable titles. */
export function buildRatingQueue(
  index: CatalogueIndex,
  excludeIds: Set<number>
): FilmIndexEntry[] {
  const eligible: FilmIndexEntry[] = [];
  for (const film of index.films) {
    if (excludeIds.has(film.id)) continue;
    if (magnitude(film.features) === 0) continue;
    eligible.push(film);
  }
  if (eligible.length === 0) return [];

  const popList = [...eligible].sort(
    (a, b) => (b.popularity ?? 0) - (a.popularity ?? 0)
  );

  const clusters = new Map<string, FilmIndexEntry[]>();
  for (const film of eligible) {
    const key = clusterKey(film);
    const bucket = clusters.get(key);
    if (bucket) bucket.push(film);
    else clusters.set(key, [film]);
  }
  for (const bucket of clusters.values()) {
    bucket.sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
  }
  const orderedClusters = [...clusters.values()].sort(
    (a, b) => (b[0].popularity ?? 0) - (a[0].popularity ?? 0)
  );
  const diverseList: FilmIndexEntry[] = [];
  let depth = 0;
  while (diverseList.length < eligible.length) {
    let added = 0;
    for (const bucket of orderedClusters) {
      if (bucket[depth]) {
        diverseList.push(bucket[depth]);
        added++;
      }
    }
    if (added === 0) break;
    depth++;
  }

  const pattern: Array<"P" | "D"> = ["P", "P", "P", "P", "P", "P", "P", "D"];
  const lists: Record<"P" | "D", FilmIndexEntry[]> = {
    P: popList,
    D: diverseList
  };
  const cursors: Record<"P" | "D", number> = { P: 0, D: 0 };
  const seen = new Set<number>();
  const out: FilmIndexEntry[] = [];

  while (out.length < eligible.length) {
    let progressed = false;
    for (const slot of pattern) {
      const list = lists[slot];
      while (cursors[slot] < list.length && seen.has(list[cursors[slot]].id)) {
        cursors[slot]++;
      }
      if (cursors[slot] < list.length) {
        const film = list[cursors[slot]];
        cursors[slot]++;
        seen.add(film.id);
        out.push(film);
        progressed = true;
        if (out.length >= eligible.length) break;
      }
    }
    if (!progressed) break;
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
