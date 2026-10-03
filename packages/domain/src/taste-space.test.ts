import { describe, expect, it } from "vitest";
import { AXIS_KEYS, type FeatureVector } from "./lens.js";
import { buildTasteSpace } from "./taste-space.js";
import type { Rating, RatingEntry } from "./store/model.js";
import type { TmdbItem } from "./tmdb/types.js";

function vector(values: Partial<FeatureVector>): FeatureVector {
  return Object.fromEntries(AXIS_KEYS.map((axis) => [axis, values[axis] ?? 0])) as FeatureVector;
}

function entry(
  id: number,
  features: FeatureVector,
  rating: Rating,
  metadata: { genres?: string[]; keywords?: string[]; directorIds?: number[] } = {}
): RatingEntry {
  return {
    rating,
    ts: id * 1000,
    item: {
      key: `movie:${id}`,
      medium: "movie",
      id,
      title: `Rated ${id}`,
      year: 2020,
      posterPath: null,
      voteAverage: 7,
      genres: metadata.genres ?? [],
      keywords: metadata.keywords ?? [],
      collection: null,
      directorIds: metadata.directorIds ?? [],
      creatorIds: [],
      features
    }
  };
}

function candidate(id: number, features: FeatureVector, genres: string[] = []): TmdbItem {
  return {
    id,
    medium: "movie",
    title: `Candidate ${id}`,
    year: 2024,
    voteAverage: 7,
    voteCount: 100,
    popularity: 10,
    genreIds: [],
    genres,
    posterPath: null,
    overview: "",
    runtime: 100,
    keywords: [],
    collection: null,
    directorIds: [],
    creatorIds: [],
    features
  };
}

const LIGHT = vector({ tone: 0.9, pacing: 0.7 });
const LIGHT_NEAR = vector({ tone: 0.8, pacing: 0.65 });
const REALIST = vector({ realism: 0.9, scope: 0.7 });

describe("buildTasteSpace", () => {
  it("produces repeatable clusters whose anchored IDs survive reinforcement", () => {
    const initial = [entry(1, LIGHT, 1), entry(2, REALIST, 1)];
    const first = buildTasteSpace(initial);
    const again = buildTasteSpace(initial);

    expect(again.clusters).toEqual(first.clusters);
    const lightId = first.clusters.find((cluster) => cluster.supportingRatings[0].itemKey === "movie:1")?.id;
    const reinforced = buildTasteSpace([...initial, entry(3, LIGHT_NEAR, 2)]);
    const reinforcedLight = reinforced.clusters.find((cluster) =>
      cluster.supportingRatings.some((rating) => rating.itemKey === "movie:1")
    );
    expect(reinforcedLight?.id).toBe(lightId);
    expect(reinforcedLight?.supportingRatings).toHaveLength(2);
  });

  it("exposes confidence, support, opposing evidence, and common signals", () => {
    const space = buildTasteSpace([
      entry(1, LIGHT, 1, { genres: ["Comedy"], keywords: ["satire"], directorIds: [42] }),
      entry(2, LIGHT_NEAR, 1, { genres: ["Comedy"], keywords: ["satire", "friendship"], directorIds: [42] }),
      entry(3, LIGHT, -1, { genres: ["Comedy"], keywords: ["satire"] })
    ]);
    const liked = space.clusters.find((cluster) => cluster.polarity === "liked")!;

    expect(liked.confidence).toBeCloseTo(2 / 3);
    expect(liked.supportingRatings.map((rating) => rating.itemKey).sort()).toEqual(["movie:1", "movie:2"]);
    expect(liked.opposingEvidence[0].itemKey).toBe("movie:3");
    expect(liked.commonGenres[0]).toMatchObject({ name: "Comedy", count: 2, weight: 2 });
    expect(liked.commonTags[0]).toMatchObject({ name: "satire", count: 2, weight: 2 });
    expect(liked.directorIds[0]).toMatchObject({ id: 42, count: 2, weight: 2 });
  });

  it("links each cluster to its nearest other clusters", () => {
    const space = buildTasteSpace([
      entry(1, LIGHT, 1),
      entry(2, REALIST, 1),
      entry(3, LIGHT_NEAR, -1)
    ]);
    const likedLight = space.clusters.find((cluster) =>
      cluster.supportingRatings.some((rating) => rating.itemKey === "movie:1")
    )!;
    const dislikedLight = space.clusters.find((cluster) => cluster.polarity === "disliked")!;

    expect(likedLight.nearbyClusters[0].clusterId).toBe(dislikedLight.id);
    expect(likedLight.nearbyClusters[0].similarity).toBeGreaterThan(0.99);
    expect(dislikedLight.nearbyClusters.some((nearby) => nearby.clusterId === likedLight.id)).toBe(true);
  });

  it("describes rated/unrated relationships and finds sparse and uncertain regions", () => {
    const sparse = candidate(10, vector({ complexity: 1 }), ["Mystery"]);
    const uncertain = candidate(11, LIGHT_NEAR, ["Comedy"]);
    const space = buildTasteSpace(
      [entry(1, LIGHT, 1), entry(2, LIGHT, -1)],
      { items: [sparse, uncertain] }
    );

    expect(space.ratedItems[0].assignedClusterId).not.toBeNull();
    expect(space.unratedItems).toHaveLength(2);
    expect(space.unratedItems.find((item) => item.key === "movie:11")?.relationships).toHaveLength(2);
    expect(space.weakRegions.some((region) => region.kind === "sparse" && region.targetItemKeys.includes("movie:10"))).toBe(true);
    expect(space.weakRegions.some((region) => region.kind === "uncertain" && region.targetItemKeys.includes("movie:11"))).toBe(true);
  });

  it.each(["canonical_greedy", "canonical_complete_link"] as const)(
    "%s produces identical clusters for every evidence order",
    (clusterStrategy) => {
      const ratings = [
        entry(4, vector({ tone: 0.75, pacing: 0.5 }), 2),
        entry(1, LIGHT, 1),
        entry(3, LIGHT_NEAR, -1),
        entry(2, REALIST, 3),
        entry(5, vector({ realism: 0.8, scope: 0.6 }), -2)
      ];
      const expected = buildTasteSpace(ratings, { clusterStrategy });
      const reversed = buildTasteSpace([...ratings].reverse(), { clusterStrategy });
      const rotated = buildTasteSpace([...ratings.slice(2), ...ratings.slice(0, 2)], { clusterStrategy });

      expect(reversed.clusters).toEqual(expected.clusters);
      expect(rotated.clusters).toEqual(expected.clusters);
    }
  );

  it("canonical complete-link keeps a similarity chain in separate clusters", () => {
    const first = vector({ pacing: 1 });
    const bridge = vector({ pacing: 0.8, tone: 0.6 });
    const last = vector({ pacing: 0.28, tone: 0.96 });
    const space = buildTasteSpace(
      [entry(1, first, 1), entry(2, bridge, 1), entry(3, last, 1)],
      { clusterStrategy: "canonical_complete_link" }
    );

    expect(space.clusters).toHaveLength(2);
    expect(
      space.clusters.map((cluster) =>
        cluster.supportingRatings.map((rating) => rating.itemKey).sort()
      )
    ).toEqual([["movie:1", "movie:2"], ["movie:3"]]);
  });
});
