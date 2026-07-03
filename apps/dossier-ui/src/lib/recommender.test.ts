import { describe, expect, it } from "vitest";
import {
  buildTasteGroups,
  DEFAULT_SCORING_PARAMS,
  groupRecommendationsByTaste,
  predictPreference,
  scoreCandidates,
  type ScoringParams
} from "./recommender";
import type { FeatureVector, RatingEntry, TmdbItem } from "./types";

const AXES: (keyof FeatureVector)[] = [
  "pacing", "tone", "emotional_intensity", "complexity", "scope",
  "realism", "thematic_weight", "character_focus", "moral_clarity", "structure"
];

function vec(over: Partial<FeatureVector>): FeatureVector {
  const v: any = {};
  for (const k of AXES) v[k] = over[k] ?? 0;
  return v as FeatureVector;
}

let nextId = 1;
function item(features: FeatureVector, voteAverage = 7): TmdbItem {
  const id = nextId++;
  return {
    id, medium: "movie", title: `Item ${id}`, year: 2015, voteAverage, voteCount: 1000,
    popularity: 500, genreIds: [], genres: [], posterPath: null, overview: "",
    runtime: 100, keywords: [], features
  };
}

function seededRng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function ratingEntry(features: FeatureVector, rating: RatingEntry["rating"]): RatingEntry {
  const id = nextId++;
  return {
    rating,
    ts: Date.now(),
    item: {
      key: `movie:${id}`, medium: "movie", id, title: `Rated ${id}`, year: 2015,
      posterPath: null, voteAverage: 7, genres: [], features
    }
  };
}

// Two clearly distinct "taste modes": grim/serious/slow (like a bleak
// drama) and light/fast/silly (like a broad comedy) — deliberately near-
// opposite on tone and pacing, the scenario the old single-centroid
// design broke on.
const GRIM = vec({ tone: -0.9, pacing: -0.6, emotional_intensity: 0.7 });
const LIGHT = vec({ tone: 0.9, pacing: 0.6, emotional_intensity: -0.2 });

describe("scoreCandidates / clustering", () => {
  it("does not blend two distinct liked tastes into a mushy average", () => {
    // User has liked several grim dramas AND several light comedies.
    const entries: RatingEntry[] = [
      ratingEntry(vec({ tone: -0.85, pacing: -0.55, emotional_intensity: 0.65 }), 1),
      ratingEntry(vec({ tone: -0.95, pacing: -0.65, emotional_intensity: 0.75 }), 1),
      ratingEntry(vec({ tone: 0.85, pacing: 0.55, emotional_intensity: -0.15 }), 1),
      ratingEntry(vec({ tone: 0.95, pacing: 0.65, emotional_intensity: -0.25 }), 1)
    ];

    // A candidate that matches EITHER real cluster well...
    const matchesGrim = item(GRIM);
    const matchesLight = item(LIGHT);
    // ...and a candidate that matches the *average* of the two (mushy
    // middle: roughly neutral tone/pacing) — nobody actually likes this.
    const matchesMush = item(vec({ tone: 0, pacing: 0, emotional_intensity: 0.25 }));

    const recs = scoreCandidates([matchesGrim, matchesLight, matchesMush], entries);
    const scoreOf = (it: TmdbItem) => recs.find((r) => r.item.id === it.id)!.score;

    expect(scoreOf(matchesGrim)).toBeGreaterThan(scoreOf(matchesMush));
    expect(scoreOf(matchesLight)).toBeGreaterThan(scoreOf(matchesMush));
  });

  it("keeps discriminating (does not collapse to near-ties) as the liked corpus grows large", () => {
    // Simulate a heavy rater: many likes clustered around a handful of
    // real taste modes (not one per movie — that's the point of
    // clustering), built up over hundreds of ratings.
    const modes = [GRIM, LIGHT, vec({ realism: 0.8, scope: 0.7, complexity: 0.3 }), vec({ complexity: 0.8, structure: 0.6 })];
    const rng = seededRng(42);
    const entries: RatingEntry[] = [];
    for (let i = 0; i < 400; i++) {
      const base = modes[i % modes.length];
      const jitter = vec(Object.fromEntries(AXES.map((k) => [k, base[k] + (rng() - 0.5) * 0.1])));
      entries.push(ratingEntry(jitter, 1));
    }

    // Candidates: some near a real mode, some in between modes (should
    // score clearly lower).
    const near = item(vec(Object.fromEntries(AXES.map((k) => [k, modes[0][k] * 0.9]))));
    const between = item(
      vec(Object.fromEntries(AXES.map((k) => [k, (modes[0][k] + modes[1][k]) / 2])))
    );

    const recs = scoreCandidates([near, between], entries);
    const nearScore = recs.find((r) => r.item.id === near.id)!.score;
    const betweenScore = recs.find((r) => r.item.id === between.id)!.score;

    // With 400 ratings behind it, a genuine match to one taste mode
    // should still clearly outscore an in-between candidate — this is
    // exactly the property that collapsed under flat top-K-nearest-item
    // scoring (see recommender.ts's module doc).
    expect(nearScore - betweenScore).toBeGreaterThan(0.1);
  });

  it("predictPreference returns 0 with no liked entries", () => {
    expect(predictPreference(item(GRIM), [])).toBe(0);
  });
});

describe("ScoringParams dials", () => {
  const entries: RatingEntry[] = [
    ratingEntry(vec({ tone: -0.9, pacing: -0.6, emotional_intensity: 0.7 }), 1),
    ratingEntry(vec({ tone: -0.85, pacing: -0.55, emotional_intensity: 0.65 }), 1),
    ratingEntry(vec({ tone: 0.9, pacing: 0.6 }), -1)
  ];

  it("an omitted params argument scores identically to explicit DEFAULT_SCORING_PARAMS", () => {
    const candidate = item(GRIM);
    const [a] = scoreCandidates([candidate], entries);
    const [b] = scoreCandidates([candidate], entries, DEFAULT_SCORING_PARAMS);
    expect(a.score).toBe(b.score);
  });

  it("zeroing dislikePenalty stops disliked-cluster proximity from hurting a candidate", () => {
    // This candidate sits right on the disliked cluster's fingerprint.
    const candidate = item(vec({ tone: 0.9, pacing: 0.6 }));
    const off: ScoringParams = { ...DEFAULT_SCORING_PARAMS, dislikePenalty: 0 };
    const [withPenalty] = scoreCandidates([candidate], entries);
    const [withoutPenalty] = scoreCandidates([candidate], entries, off);
    expect(withoutPenalty.score).toBeGreaterThan(withPenalty.score);
  });

  it("zeroing an axis weight makes that axis stop discriminating between candidates", () => {
    // Two candidates identical except on pacing — with pacing weighted to
    // ~0, they should score identically; at full weight they should not.
    const a = item(vec({ tone: -0.9, pacing: -0.6, emotional_intensity: 0.7 }));
    const b = item(vec({ tone: -0.9, pacing: 0.6, emotional_intensity: 0.7 }));
    const zeroed: ScoringParams = { ...DEFAULT_SCORING_PARAMS, axisWeights: { pacing: 0.001 } };

    const defaultScores = scoreCandidates([a, b], entries);
    const zeroedScores = scoreCandidates([a, b], entries, zeroed);

    const defaultDiff = Math.abs(
      defaultScores.find((r) => r.item.id === a.id)!.score -
        defaultScores.find((r) => r.item.id === b.id)!.score
    );
    const zeroedDiff = Math.abs(
      zeroedScores.find((r) => r.item.id === a.id)!.score -
        zeroedScores.find((r) => r.item.id === b.id)!.score
    );
    expect(defaultDiff).toBeGreaterThan(0.01);
    expect(zeroedDiff).toBeLessThan(0.001);
  });

  it("popularityBias reorders candidates by popularity independent of taste fit", () => {
    const obscure = item(GRIM);
    obscure.popularity = 1;
    const mainstream = item(GRIM);
    mainstream.popularity = 2000;
    const favorMainstream: ScoringParams = { ...DEFAULT_SCORING_PARAMS, popularityBias: 1 };

    const [first] = scoreCandidates([obscure, mainstream], entries, favorMainstream);
    expect(first.item.id).toBe(mainstream.id);
  });
});

describe("groupRecommendationsByTaste", () => {
  function ratingEntryWithGenres(features: FeatureVector, genres: string[]): RatingEntry {
    const id = nextId++;
    return {
      rating: 1,
      ts: Date.now(),
      item: { key: `movie:${id}`, medium: "movie", id, title: `Rated ${id}`, year: 2015, posterPath: null, voteAverage: 7, genres, features }
    };
  }

  it("merges distinct clusters that share the same genre-derived label into one row", () => {
    // Two clearly distinct taste clusters (opposite tone/pacing) that
    // both happen to be tagged with the same two genres — this is the
    // scenario that used to produce two rows both titled "Comedy & Drama",
    // which crashed Svelte's keyed each block (duplicate key) and blanked
    // the whole Recommendations screen.
    const entries: RatingEntry[] = [
      ratingEntryWithGenres(vec({ tone: -0.9, pacing: -0.6 }), ["Comedy", "Drama"]),
      ratingEntryWithGenres(vec({ tone: -0.95, pacing: -0.65 }), ["Comedy", "Drama"]),
      ratingEntryWithGenres(vec({ tone: 0.9, pacing: 0.6 }), ["Comedy", "Drama"]),
      ratingEntryWithGenres(vec({ tone: 0.95, pacing: 0.65 }), ["Comedy", "Drama"])
    ];
    const groups = buildTasteGroups(entries);
    expect(groups.length).toBeGreaterThanOrEqual(2);
    expect(new Set(groups.map((g) => g.label)).size).toBeLessThan(groups.length);

    const candidates = [item(vec({ tone: -0.85, pacing: -0.55 })), item(vec({ tone: 0.85, pacing: 0.55 }))];
    const recs = candidates.map((c) => ({ item: c, score: 0 }));
    const rows = groupRecommendationsByTaste(recs, groups);

    const labels = rows.map((r) => r.label);
    expect(new Set(labels).size).toBe(labels.length);
  });
});
