/** A deterministic, inspectable representation of a rating library in the
 * entertainment lens's authoritative high-dimensional feature space. */
import { AXIS_KEYS, type FeatureVector } from "./lens.js";
import { ratingWeight, type RatedItem, type Rating, type RatingEntry } from "./store/model.js";
import type { TmdbItem } from "./tmdb/types.js";

export const DEFAULT_TASTE_CLUSTER_MERGE_THRESHOLD = 0.75;
export const TASTE_CLUSTER_CONFIDENCE_SMOOTHING = 1;

export type TastePolarity = "liked" | "disliked";

export type TasteSignal = {
  name: string;
  count: number;
  weight: number;
};

export type TasteIdSignal = {
  id: number;
  count: number;
  weight: number;
};

export type TasteEvidence = {
  itemKey: string;
  rating: Rating;
  weight: number;
  similarity: number;
  item: RatedItem;
};

export type NearbyTasteCluster = {
  clusterId: string;
  polarity: TastePolarity;
  similarity: number;
};

export type TasteCluster = {
  id: string;
  polarity: TastePolarity;
  centroid: FeatureVector;
  /** Exact confidence used by the recommender: weight / (weight + 1). */
  confidence: number;
  weight: number;
  supportingRatings: TasteEvidence[];
  opposingEvidence: TasteEvidence[];
  commonGenres: TasteSignal[];
  commonTags: TasteSignal[];
  collections: Array<TasteIdSignal & { name: string }>;
  directorIds: TasteIdSignal[];
  creatorIds: TasteIdSignal[];
  nearbyClusters: NearbyTasteCluster[];
};

export type ClusterStructuralLinks = {
  collectionIds: number[];
  directorIds: number[];
  creatorIds: number[];
};

export type TasteClusterRelationship = {
  clusterId: string;
  polarity: TastePolarity;
  similarity: number;
  /** Similarity signed by polarity and scaled by cluster confidence. */
  affinity: number;
  structuralLinks: ClusterStructuralLinks;
};

export type TasteSpaceRatedItem = {
  key: string;
  rated: true;
  rating: Rating;
  item: RatedItem;
  relationships: TasteClusterRelationship[];
  assignedClusterId: string | null;
};

export type TasteSpaceUnratedItem = {
  key: string;
  rated: false;
  item: TmdbItem;
  relationships: TasteClusterRelationship[];
  nearestLikedClusterId: string | null;
  nearestDislikedClusterId: string | null;
};

export type TasteCoverageRegion = {
  id: string;
  kind: "sparse" | "uncertain";
  centroid: FeatureVector;
  /** Low means this is a useful calibration target. */
  confidence: number;
  targetItemKeys: string[];
  nearbyClusterIds: string[];
  commonGenres: TasteSignal[];
  commonTags: TasteSignal[];
};

export type TasteSpace = {
  dimensions: readonly (keyof FeatureVector)[];
  clusters: TasteCluster[];
  ratedItems: TasteSpaceRatedItem[];
  unratedItems: TasteSpaceUnratedItem[];
  weakRegions: TasteCoverageRegion[];
};

export type BuildTasteSpaceOptions = {
  /** Optional unrated pool to inspect and identify calibration targets in. */
  items?: readonly TmdbItem[];
  clusterMergeThreshold?: number;
  /** Mirrors the existing recommender dial. Zero is timeless and deterministic. */
  ratingRecencyStrength?: number;
  /** Required for time-relative reproducibility when ratingRecencyStrength > 0. */
  referenceTime?: number;
  nearbyClusterLimit?: number;
};

type WeightedRating = {
  entry: RatingEntry;
  weight: number;
};

type MutableCluster = {
  polarity: TastePolarity;
  centroid: FeatureVector;
  weight: number;
  ratings: WeightedRating[];
};

function magnitude(vector: FeatureVector): number {
  let total = 0;
  for (const axis of AXIS_KEYS) total += vector[axis] * vector[axis];
  return Math.sqrt(total);
}

export function cosineSimilarity(a: FeatureVector, b: FeatureVector): number {
  const ma = magnitude(a);
  const mb = magnitude(b);
  if (ma === 0 || mb === 0) return 0;
  let product = 0;
  for (const axis of AXIS_KEYS) product += a[axis] * b[axis];
  return product / (ma * mb);
}

function recencyWeight(ts: number, strength: number, referenceTime: number): number {
  if (strength <= 0) return 1;
  const ageDays = (referenceTime - ts) / 86_400_000;
  const halfLifeDays = 3650 - strength * 3636;
  return Math.pow(0.5, ageDays / halfLifeDays);
}

function stableHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36).padStart(7, "0");
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function clusterId(polarity: TastePolarity, anchorKey: string): string {
  return `${polarity}:${anchorKey}`;
}

/** Exact greedy merge used by the original UI recommender. Input order is
 * deliberately retained: persisted ratings accumulate in that order, and
 * preserving it keeps current recommendation behaviour unchanged. */
function buildPolarityClusters(
  ratings: WeightedRating[],
  polarity: TastePolarity,
  mergeThreshold: number
): MutableCluster[] {
  const clusters: MutableCluster[] = [];
  for (const rating of ratings) {
    let best: MutableCluster | null = null;
    let bestSimilarity = -Infinity;
    for (const cluster of clusters) {
      const similarity = cosineSimilarity(rating.entry.item.features, cluster.centroid);
      if (similarity > bestSimilarity) {
        best = cluster;
        bestSimilarity = similarity;
      }
    }
    if (best && bestSimilarity >= mergeThreshold) {
      const nextWeight = best.weight + rating.weight;
      for (const axis of AXIS_KEYS) {
        best.centroid[axis] =
          (best.centroid[axis] * best.weight + rating.entry.item.features[axis] * rating.weight) /
          nextWeight;
      }
      best.weight = nextWeight;
      best.ratings.push(rating);
    } else {
      clusters.push({
        polarity,
        centroid: { ...rating.entry.item.features },
        weight: rating.weight,
        ratings: [rating]
      });
    }
  }
  return clusters;
}

function textSignals(
  ratings: WeightedRating[],
  select: (item: RatedItem) => readonly string[]
): TasteSignal[] {
  const values = new Map<string, { count: number; weight: number }>();
  for (const rating of ratings) {
    for (const name of new Set(select(rating.entry.item))) {
      const current = values.get(name) ?? { count: 0, weight: 0 };
      current.count += 1;
      current.weight += rating.weight;
      values.set(name, current);
    }
  }
  return [...values.entries()]
    .map(([name, value]) => ({ name, ...value }))
    .sort((a, b) => b.weight - a.weight || b.count - a.count || compareText(a.name, b.name));
}

function idSignals(
  ratings: WeightedRating[],
  select: (item: RatedItem) => readonly number[]
): TasteIdSignal[] {
  const values = new Map<number, { count: number; weight: number }>();
  for (const rating of ratings) {
    for (const id of new Set(select(rating.entry.item))) {
      const current = values.get(id) ?? { count: 0, weight: 0 };
      current.count += 1;
      current.weight += rating.weight;
      values.set(id, current);
    }
  }
  return [...values.entries()]
    .map(([id, value]) => ({ id, ...value }))
    .sort((a, b) => b.weight - a.weight || b.count - a.count || a.id - b.id);
}

function collections(ratings: WeightedRating[]): TasteCluster["collections"] {
  const byId = new Map<number, { name: string; count: number; weight: number }>();
  for (const rating of ratings) {
    const collection = rating.entry.item.collection;
    if (!collection) continue;
    const current = byId.get(collection.id) ?? { name: collection.name, count: 0, weight: 0 };
    current.count += 1;
    current.weight += rating.weight;
    byId.set(collection.id, current);
  }
  return [...byId.entries()]
    .map(([id, value]) => ({ id, ...value }))
    .sort((a, b) => b.weight - a.weight || b.count - a.count || a.id - b.id);
}

function evidence(
  ratings: WeightedRating[],
  centroid: FeatureVector
): TasteEvidence[] {
  return ratings
    .map(({ entry, weight }) => ({
      itemKey: entry.item.key,
      rating: entry.rating,
      weight,
      similarity: cosineSimilarity(entry.item.features, centroid),
      item: entry.item
    }))
    .sort((a, b) => b.weight - a.weight || b.similarity - a.similarity || compareText(a.itemKey, b.itemKey));
}

function structuralLinks(item: RatedItem | TmdbItem, cluster: TasteCluster): ClusterStructuralLinks {
  const collectionId = item.collection?.id;
  return {
    collectionIds: collectionId != null && cluster.collections.some((value) => value.id === collectionId)
      ? [collectionId]
      : [],
    directorIds: (item.directorIds ?? []).filter((id) => cluster.directorIds.some((value) => value.id === id)),
    creatorIds: (item.creatorIds ?? []).filter((id) => cluster.creatorIds.some((value) => value.id === id))
  };
}

function relationships(
  item: RatedItem | TmdbItem,
  clusters: TasteCluster[]
): TasteClusterRelationship[] {
  return clusters
    .map((cluster) => {
      const similarity = cosineSimilarity(item.features, cluster.centroid);
      return {
        clusterId: cluster.id,
        polarity: cluster.polarity,
        similarity,
        affinity: similarity * cluster.confidence * (cluster.polarity === "liked" ? 1 : -1),
        structuralLinks: structuralLinks(item, cluster)
      };
    })
    .sort((a, b) => Math.abs(b.affinity) - Math.abs(a.affinity) || compareText(a.clusterId, b.clusterId));
}

function itemKey(item: TmdbItem): string {
  return `${item.medium}:${item.id}`;
}

type WeakTarget = {
  kind: TasteCoverageRegion["kind"];
  item: TasteSpaceUnratedItem;
};

function weakRegions(targets: WeakTarget[], mergeThreshold: number): TasteCoverageRegion[] {
  type MutableRegion = { kind: WeakTarget["kind"]; centroid: FeatureVector; targets: WeakTarget[] };
  const regions: MutableRegion[] = [];
  for (const target of [...targets].sort((a, b) => compareText(a.item.key, b.item.key))) {
    let best: MutableRegion | null = null;
    let bestSimilarity = -Infinity;
    for (const region of regions) {
      if (region.kind !== target.kind) continue;
      const similarity = cosineSimilarity(target.item.item.features, region.centroid);
      if (similarity > bestSimilarity) {
        best = region;
        bestSimilarity = similarity;
      }
    }
    if (best && bestSimilarity >= mergeThreshold) {
      const count = best.targets.length;
      for (const axis of AXIS_KEYS) {
        best.centroid[axis] =
          (best.centroid[axis] * count + target.item.item.features[axis]) / (count + 1);
      }
      best.targets.push(target);
    } else {
      regions.push({ kind: target.kind, centroid: { ...target.item.item.features }, targets: [target] });
    }
  }

  return regions.map((region) => {
    const targetItemKeys = region.targets.map((target) => target.item.key).sort();
    const allRelationships = region.targets.flatMap((target) => target.item.relationships);
    const targetConfidences = region.targets.map((target) => {
      const likedFit = Math.max(0, ...target.item.relationships
        .filter((relationship) => relationship.polarity === "liked")
        .map((relationship) => relationship.affinity));
      const dislikedFit = Math.max(0, ...target.item.relationships
        .filter((relationship) => relationship.polarity === "disliked")
        .map((relationship) => -relationship.affinity));
      return region.kind === "uncertain"
        ? Math.abs(likedFit - dislikedFit)
        : Math.max(likedFit, dislikedFit);
    });
    const confidence = targetConfidences.length
      ? targetConfidences.reduce((sum, value) => sum + value, 0) / targetConfidences.length
      : 0;
    const nearbyClusterIds = [...new Set(
      allRelationships
        .filter((relationship) => relationship.similarity > 0)
        .sort((a, b) => b.similarity - a.similarity || compareText(a.clusterId, b.clusterId))
        .map((relationship) => relationship.clusterId)
    )].slice(0, 3);
    const pseudoRatings: WeightedRating[] = region.targets.map((target) => ({
      entry: { rating: 0, ts: 0, item: {
        key: target.item.key,
        medium: target.item.item.medium,
        id: target.item.item.id,
        title: target.item.item.title,
        year: target.item.item.year,
        posterPath: target.item.item.posterPath,
        voteAverage: target.item.item.voteAverage,
        genres: target.item.item.genres,
        keywords: target.item.item.keywords,
        collection: target.item.item.collection,
        directorIds: target.item.item.directorIds,
        creatorIds: target.item.item.creatorIds,
        features: target.item.item.features
      } },
      weight: 1
    }));
    return {
      id: `${region.kind}-${stableHash(targetItemKeys.join("\u001f"))}`,
      kind: region.kind,
      centroid: region.centroid,
      confidence,
      targetItemKeys,
      nearbyClusterIds,
      commonGenres: textSignals(pseudoRatings, (item) => item.genres),
      commonTags: textSignals(pseudoRatings, (item) => item.keywords)
    };
  }).sort((a, b) => compareText(a.kind, b.kind) || compareText(a.id, b.id));
}

export function buildTasteSpace(
  entries: readonly RatingEntry[],
  options: BuildTasteSpaceOptions = {}
): TasteSpace {
  const mergeThreshold = options.clusterMergeThreshold ?? DEFAULT_TASTE_CLUSTER_MERGE_THRESHOLD;
  const recencyStrength = options.ratingRecencyStrength ?? 0;
  const referenceTime = options.referenceTime ?? Math.max(0, ...entries.map((entry) => entry.ts));
  const positive: WeightedRating[] = [];
  const negative: WeightedRating[] = [];
  for (const entry of entries) {
    const signedWeight = ratingWeight(entry.rating) * recencyWeight(entry.ts, recencyStrength, referenceTime);
    const weighted = { entry, weight: Math.abs(signedWeight) };
    if (signedWeight > 0) positive.push(weighted);
    else if (signedWeight < 0) negative.push(weighted);
  }

  const mutable = [
    ...buildPolarityClusters(positive, "liked", mergeThreshold),
    ...buildPolarityClusters(negative, "disliked", mergeThreshold)
  ];
  const clusters: TasteCluster[] = mutable.map((cluster) => ({
    // The first supporting rating is the cluster's stable anchor. Adding
    // reinforcement changes confidence/centroid without changing identity.
    id: clusterId(cluster.polarity, cluster.ratings[0]!.entry.item.key),
    polarity: cluster.polarity,
    centroid: cluster.centroid,
    confidence: cluster.weight / (cluster.weight + TASTE_CLUSTER_CONFIDENCE_SMOOTHING),
    weight: cluster.weight,
    supportingRatings: evidence(cluster.ratings, cluster.centroid),
    opposingEvidence: [],
    commonGenres: textSignals(cluster.ratings, (item) => item.genres),
    commonTags: textSignals(cluster.ratings, (item) => item.keywords),
    collections: collections(cluster.ratings),
    directorIds: idSignals(cluster.ratings, (item) => item.directorIds ?? []),
    creatorIds: idSignals(cluster.ratings, (item) => item.creatorIds ?? []),
    nearbyClusters: []
  }));

  const nearbyLimit = Math.max(0, options.nearbyClusterLimit ?? 3);
  for (const cluster of clusters) {
    const opposite = cluster.polarity === "liked" ? negative : positive;
    cluster.opposingEvidence = evidence(
      opposite.filter((rating) => cosineSimilarity(rating.entry.item.features, cluster.centroid) > 0),
      cluster.centroid
    );
    cluster.nearbyClusters = clusters
      .filter((candidate) => candidate.id !== cluster.id)
      .map((candidate) => ({
        clusterId: candidate.id,
        polarity: candidate.polarity,
        similarity: cosineSimilarity(cluster.centroid, candidate.centroid)
      }))
      .sort((a, b) => b.similarity - a.similarity || compareText(a.clusterId, b.clusterId))
      .slice(0, nearbyLimit);
  }

  const assignedByKey = new Map<string, string>();
  for (const cluster of clusters) {
    for (const support of cluster.supportingRatings) assignedByKey.set(support.itemKey, cluster.id);
  }
  const ratedItems = entries.map<TasteSpaceRatedItem>((entry) => ({
    key: entry.item.key,
    rated: true,
    rating: entry.rating,
    item: entry.item,
    relationships: relationships(entry.item, clusters),
    assignedClusterId: assignedByKey.get(entry.item.key) ?? null
  }));

  const ratedKeys = new Set(entries.map((entry) => entry.item.key));
  const unratedItems = (options.items ?? [])
    .filter((item) => !ratedKeys.has(itemKey(item)))
    .map<TasteSpaceUnratedItem>((item) => {
      const itemRelationships = relationships(item, clusters);
      return {
        key: itemKey(item),
        rated: false,
        item,
        relationships: itemRelationships,
        nearestLikedClusterId: itemRelationships.find((relationship) => relationship.polarity === "liked")?.clusterId ?? null,
        nearestDislikedClusterId: itemRelationships.find((relationship) => relationship.polarity === "disliked")?.clusterId ?? null
      };
    });

  const targets: WeakTarget[] = [];
  for (const item of unratedItems) {
    const likedFit = Math.max(0, ...item.relationships
      .filter((relationship) => relationship.polarity === "liked")
      .map((relationship) => relationship.affinity));
    const dislikedFit = Math.max(0, ...item.relationships
      .filter((relationship) => relationship.polarity === "disliked")
      .map((relationship) => -relationship.affinity));
    if (likedFit >= 0.2 && dislikedFit >= 0.2 && Math.abs(likedFit - dislikedFit) <= 0.2) {
      targets.push({ kind: "uncertain", item });
    } else if (Math.max(likedFit, dislikedFit) < 0.35) {
      targets.push({ kind: "sparse", item });
    }
  }

  return {
    dimensions: AXIS_KEYS,
    clusters,
    ratedItems,
    unratedItems,
    weakRegions: weakRegions(targets, mergeThreshold)
  };
}
