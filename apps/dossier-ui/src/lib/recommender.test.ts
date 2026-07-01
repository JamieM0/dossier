import { describe, expect, it } from "vitest";
import { predictPreference, scoreCandidates } from "./recommender";
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
