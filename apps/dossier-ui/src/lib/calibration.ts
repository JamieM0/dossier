import { AXIS_KEYS, predictPreference, type AxisKey } from "$lib/recommender";
import { ratingKind, ratingWeight, type Rating, type RatingEntry, type TmdbItem } from "$lib/types";
import { buildTasteSpace, cosineSimilarity, type TasteCluster, type TasteClusterRelationship } from "@dossier/domain";

export type EvidenceLevel = "strong" | "some" | "mixed" | "sparse";
export type ProbeKind =
  | "cold_start"
  | "sparse_region"
  | "boundary"
  | "conflict_resolution"
  | "collection_completion"
  | "confirmation"
  | "fallback"
  | "dissonance";
export type ProbeEvidence = {
  clusterIds: string[];
  itemKeys: string[];
  weakRegionIds: string[];
  collection: {
    id: number;
    name: string;
    ratedItemKeys: string[];
  } | null;
  focus?: string;
};
export type ProbeResult<T> = {
  item: T;
  probeKind: ProbeKind;
  learningValue: number;
  reason: string;
  evidence: ProbeEvidence;
};

const AXIS_LABELS: Record<AxisKey, [string, string]> = {
  pacing: ["slower pacing", "faster pacing"], tone: ["darker tone", "lighter tone"],
  emotional_intensity: ["restraint", "emotional intensity"], complexity: ["straightforward storytelling", "complexity"],
  scope: ["intimate scope", "broader scope"], realism: ["fantastical elements", "realism"],
  thematic_weight: ["lighter themes", "thematic weight"], character_focus: ["plot focus", "character focus"],
  moral_clarity: ["moral ambiguity", "clear moral stakes"], structure: ["conventional structure", "unusual structure"]
};
const AXIS_NEUTRAL_LABELS: Record<AxisKey, string> = {
  pacing: "moderate pacing", tone: "balanced tone",
  emotional_intensity: "moderate emotional intensity", complexity: "moderate complexity",
  scope: "mid-scale scope", realism: "a blend of realism and fantasy",
  thematic_weight: "moderate thematic weight", character_focus: "a balance of plot and character",
  moral_clarity: "mixed moral clarity", structure: "moderately conventional structure"
};

function topAxisDifference(a: TmdbItem["features"], b: TmdbItem["features"]): AxisKey {
  return AXIS_KEYS.reduce((best, k) => Math.abs(a[k] - b[k]) > Math.abs(a[best] - b[best]) ? k : best);
}
function axisPhrase(axis: AxisKey, value: number): string {
  if (Math.abs(value) < 0.15) return AXIS_NEUTRAL_LABELS[axis];
  return AXIS_LABELS[axis][value > 0 ? 1 : 0];
}
function naturalList(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? "overall feature pattern";
  return `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
}
function familiarity(item: TmdbItem): number {
  return Math.min(1, Math.log10((item.popularity ?? 0) + 1) / 3) + Math.min(0.25, (item.voteAverage ?? 0) / 40);
}

function tmdbKey(item: TmdbItem): string {
  return `${item.medium}:${item.id}`;
}

function strongest(
  relationships: TasteClusterRelationship[],
  polarity: "liked" | "disliked"
): TasteClusterRelationship | null {
  return relationships
    .filter((relationship) =>
      relationship.polarity === polarity &&
      (polarity === "liked" ? relationship.affinity > 0 : relationship.affinity < 0)
    )
    .sort((a, b) => Math.abs(b.affinity) - Math.abs(a.affinity) || a.clusterId.localeCompare(b.clusterId))[0] ?? null;
}

function clusterTitle(cluster: TasteCluster | undefined): string {
  return cluster?.supportingRatings[0]?.item.title ?? "an earlier rating";
}

function emptyEvidence(focus?: string): ProbeEvidence {
  return { clusterIds: [], itemKeys: [], weakRegionIds: [], collection: null, ...(focus ? { focus } : {}) };
}

/** Rank a whole Rate candidate pool in one deterministic TasteSpace pass.
 * Weak-region membership and signed liked/disliked affinities are the sole
 * source of sparse/boundary decisions; no parallel genre-count taste model
 * is maintained here. Familiarity only breaks ties within a probe class. */
export function rankRateProbes(
  candidates: TmdbItem[],
  entries: RatingEntry[],
  focus?: string
): Array<ProbeResult<TmdbItem>> {
  if (!candidates.length) return [];
  if (entries.length < 5) {
    return [...candidates]
      .sort((a, b) => familiarity(b) - familiarity(a) || tmdbKey(a).localeCompare(tmdbKey(b)))
      .map((item) => ({
        item,
        probeKind: "cold_start" as const,
        learningValue: 0,
        reason: `Starting with a widely known ${item.genres[0]?.toLowerCase() ?? "title"} to establish a baseline.`,
        evidence: emptyEvidence(focus)
      }));
  }

  const space = buildTasteSpace(entries, { items: candidates });
  const clusters = new Map(space.clusters.map((cluster) => [cluster.id, cluster]));
  const ratedByKey = new Map(entries.map((entry) => [entry.item.key, entry]));
  const regionsByItem = new Map<string, typeof space.weakRegions>();
  for (const region of space.weakRegions) {
    for (const key of region.targetItemKeys) {
      regionsByItem.set(key, [...(regionsByItem.get(key) ?? []), region]);
    }
  }

  const probes = space.unratedItems.map<ProbeResult<TmdbItem>>((target) => {
    const item = target.item;
    const key = target.key;
    const liked = strongest(target.relationships, "liked");
    const disliked = strongest(target.relationships, "disliked");
    const likedCluster = liked ? clusters.get(liked.clusterId) : undefined;
    const dislikedCluster = disliked ? clusters.get(disliked.clusterId) : undefined;
    const regions = regionsByItem.get(key) ?? [];
    const uncertain = regions.find((region) => region.kind === "uncertain");
    const sparse = regions.find((region) => region.kind === "sparse");
    const focused = Boolean(focus && (item.genres.includes(focus) || item.keywords.includes(focus)));
    const focusBoost = focused ? 1 : 0;
    const collectionEntries = item.collection
      ? entries.filter((entry) => entry.item.collection?.id === item.collection?.id)
      : [];
    const baseEvidence: ProbeEvidence = {
      clusterIds: [liked?.clusterId, disliked?.clusterId].filter((id): id is string => Boolean(id)),
      itemKeys: [likedCluster?.supportingRatings[0]?.itemKey, dislikedCluster?.supportingRatings[0]?.itemKey]
        .filter((itemKey): itemKey is string => Boolean(itemKey)),
      weakRegionIds: regions.map((region) => region.id),
      collection: item.collection && collectionEntries.length
        ? {
            id: item.collection.id,
            name: item.collection.name,
            ratedItemKeys: collectionEntries.map((entry) => entry.item.key).sort()
          }
        : null,
      ...(focused && focus ? { focus } : {})
    };
    const prefix = focused && focus ? `You chose ${focus.toLowerCase()}. ` : "";

    if (uncertain && liked && disliked) {
      const clusterConflict = Boolean(
        likedCluster?.opposingEvidence.length ||
        dislikedCluster?.opposingEvidence.length ||
        likedCluster?.nearbyClusters.some((nearby) => nearby.clusterId === disliked.clusterId && nearby.similarity >= 0.75)
      );
      const probeKind = clusterConflict ? "conflict_resolution" : "boundary";
      const boundaryStrength = Math.min(liked.affinity, -disliked.affinity);
      return {
        item,
        probeKind,
        learningValue: 1.5 + boundaryStrength * 0.8 + (1 - uncertain.confidence) * 0.4 + focusBoost * 0.9 + familiarity(item) * 0.1,
        reason: clusterConflict
          ? `${prefix}This resembles both ${clusterTitle(likedCluster)}, which drew you in, and ${clusterTitle(dislikedCluster)}, which did not. Your response resolves that conflicting evidence.`
          : `${prefix}This sits between what you liked about ${clusterTitle(likedCluster)} and what you disliked about ${clusterTitle(dislikedCluster)}. Your response sharpens that boundary.`,
        evidence: baseEvidence
      };
    }

    if (baseEvidence.collection) {
      const ratedTitles = baseEvidence.collection.ratedItemKeys
        .map((itemKey) => ratedByKey.get(itemKey)?.item.title)
        .filter((title): title is string => Boolean(title));
      return {
        item,
        probeKind: "collection_completion",
        learningValue: 1.6 + Math.min(0.3, collectionEntries.length * 0.1) + focusBoost * 0.9 + familiarity(item) * 0.1,
        reason: `${prefix}${baseEvidence.collection.name} is already represented by ${naturalList(ratedTitles.slice(0, 2))}. Rating another member tests whether that preference holds across the set.`,
        evidence: baseEvidence
      };
    }

    if (sparse) {
      const area = sparse.commonTags[0]?.name ?? sparse.commonGenres[0]?.name;
      return {
        item,
        probeKind: "sparse_region",
        learningValue: 1 + (1 - sparse.confidence) * 0.4 + focusBoost * 0.9 + familiarity(item) * 0.1,
        reason: `${prefix}Dossier has little evidence around ${area?.toLowerCase() ?? "this part of taste space"}. This fills that weak region without assuming the whole genre works the same way.`,
        evidence: baseEvidence
      };
    }

    if (liked || disliked) {
      const relationship = liked && (!disliked || Math.abs(liked.affinity) >= Math.abs(disliked.affinity)) ? liked : disliked!;
      const cluster = clusters.get(relationship.clusterId);
      return {
        item,
        probeKind: "confirmation",
        learningValue: 0.55 + (1 - Math.min(1, Math.abs(relationship.affinity))) * 0.2 + focusBoost * 0.9 + familiarity(item) * 0.1,
        reason: `${prefix}This is close to the pattern around ${clusterTitle(cluster)}. Your response checks whether that signal is reliable.`,
        evidence: { ...baseEvidence, clusterIds: [relationship.clusterId], itemKeys: cluster?.supportingRatings.slice(0, 2).map((rating) => rating.itemKey) ?? [] }
      };
    }

    return {
      item,
      probeKind: "fallback",
      learningValue: focusBoost * 0.9 + familiarity(item) * 0.1,
      reason: `${prefix}No stronger unresolved probe is available, so this recognisable title provides a neutral fallback check.`,
      evidence: baseEvidence
    };
  });

  return probes.sort((a, b) =>
    b.learningValue - a.learningValue ||
    familiarity(b.item) - familiarity(a.item) ||
    tmdbKey(a.item).localeCompare(tmdbKey(b.item))
  );
}

export function selectRateQuestion(candidates: TmdbItem[], entries: RatingEntry[], focus?: string): ProbeResult<TmdbItem> | null {
  return rankRateProbes(candidates, entries, focus)[0] ?? null;
}

export type Prediction = { score: number; evidence: EvidenceLevel; expected: "like"|"dislike"|"uncertain" };
export const DISSONANCE_MAX_SCORE = 25;

export function predictionFor(item: TmdbItem, entries: RatingEntry[]): Prediction {
  const score = predictPreference(item, entries);
  const meaningful = entries.filter(e => Math.abs(ratingWeight(e.rating)) >= 1).length;
  return { score, evidence: meaningful >= 10 ? "strong" : meaningful >= 5 ? "some" : "sparse", expected: score >= 58 ? "like" : score <= 25 ? "dislike" : "uncertain" };
}

/** Titles Dossier has enough evidence to actively predict the user will
 * dislike. This intentionally shares the positive-surprise threshold below:
 * liking one of these strongly is precisely the correction Dissonance mode
 * exists to elicit. Least likely first; recognisability breaks score ties. */
export function rankDissonantCandidates(
  candidates: TmdbItem[],
  entries: RatingEntry[]
): Array<{ item: TmdbItem; prediction: Prediction }> {
  return candidates
    .map((item) => ({ item, prediction: predictionFor(item, entries) }))
    .filter(({ prediction }) => prediction.evidence !== "sparse" && prediction.score <= DISSONANCE_MAX_SCORE)
    .sort((a, b) => a.prediction.score - b.prediction.score || familiarity(b.item) - familiarity(a.item));
}

/** Turns a low match score into the falsifiable claim Dissonance mode is
 * actually testing. The scorer works from feature fingerprints, so this
 * explanation deliberately cites the strongest feature evidence and the
 * user's own rating history instead of merely restating "likely dislike". */
export function dissonanceAssumptionFor(
  item: TmdbItem,
  entries: RatingEntry[],
  prediction: Prediction
): { summary: string; evidence: string[] } {
  const positive = entries.filter((entry) => ratingWeight(entry.rating) > 0);
  const negative = entries.filter((entry) => ratingWeight(entry.rating) < 0);
  const bySimilarity = (a: RatingEntry, b: RatingEntry) =>
    cosineSimilarity(item.features, b.item.features) - cosineSimilarity(item.features, a.item.features);
  const nearestNegative = [...negative].sort(bySimilarity)[0];
  const negativeSimilarity = nearestNegative
    ? cosineSimilarity(item.features, nearestNegative.item.features)
    : 0;

  if (nearestNegative && negativeSimilarity >= 0.35) {
    const sharedTraits = AXIS_KEYS
      .filter((axis) => item.features[axis] * nearestNegative.item.features[axis] > 0.04)
      .sort(
        (a, b) =>
          Math.abs(item.features[b] * nearestNegative.item.features[b]) -
          Math.abs(item.features[a] * nearestNegative.item.features[a])
      )
      .slice(0, 2)
      .map((axis) => axisPhrase(axis, item.features[axis]));
    const traits = naturalList(
      sharedTraits.length
        ? sharedTraits
        : [...AXIS_KEYS]
            .sort((a, b) => Math.abs(item.features[b]) - Math.abs(item.features[a]))
            .slice(0, 2)
            .map((axis) => axisPhrase(axis, item.features[axis]))
    );
    return {
      summary: `Dossier assumes this title's ${traits} will work against your taste because that combination resembles ${nearestNegative.item.title}, which you rated negatively. That evidence puts it at a ${prediction.score}% taste match.`,
      evidence: [nearestNegative.item.key, ...sharedTraits]
    };
  }

  const nearestPositive = [...positive].sort(bySimilarity)[0];
  if (nearestPositive) {
    const contrasts = AXIS_KEYS
      .map((axis) => ({
        axis,
        gap: Math.abs(item.features[axis] - nearestPositive.item.features[axis]),
        itemPhrase: axisPhrase(axis, item.features[axis]),
        preferredPhrase: axisPhrase(axis, nearestPositive.item.features[axis])
      }))
      .filter(({ gap, itemPhrase, preferredPhrase }) => gap >= 0.2 && itemPhrase !== preferredPhrase)
      .sort((a, b) => b.gap - a.gap)
      .slice(0, 2);
    const itemTraits = naturalList(contrasts.map(({ itemPhrase }) => itemPhrase));
    const preferredTraits = naturalList(contrasts.map(({ preferredPhrase }) => preferredPhrase));
    const dominantTraits = [...AXIS_KEYS]
      .sort((a, b) => Math.abs(item.features[b]) - Math.abs(item.features[a]))
      .slice(0, 2)
      .map((axis) => axisPhrase(axis, item.features[axis]));
    return {
      summary: contrasts.length
        ? `Dossier assumes this title's ${itemTraits} will not suit you because your positive ratings lean toward ${preferredTraits}, especially ${nearestPositive.item.title}. That contrast puts it at a ${prediction.score}% taste match.`
        : `Dossier assumes this title's ${naturalList(dominantTraits)} will not suit you because no positive taste pattern reinforces that combination; ${nearestPositive.item.title} is the closest positive example, but only weakly resembles it. That puts it at a ${prediction.score}% taste match.`,
      evidence: [nearestPositive.item.key, ...contrasts.map(({ axis }) => axis)]
    };
  }

  const dominantTraits = [...AXIS_KEYS]
    .sort((a, b) => Math.abs(item.features[b]) - Math.abs(item.features[a]))
    .slice(0, 2)
    .map((axis) => axisPhrase(axis, item.features[axis]));
  return {
    summary: `Dossier assumes this title's ${naturalList(dominantTraits)} sit outside the taste patterns it has learned from you. That limited evidence puts it at a ${prediction.score}% taste match.`,
    evidence: dominantTraits
  };
}

export type Surprise = { direction:"positive"|"negative"; summary:string; options:Array<{kind:"axis"|"genre"|"tag"; key:string; label:string}> };
export function detectSurprise(item: TmdbItem, rating: Rating, before: Prediction, entries: RatingEntry[]): Surprise | null {
  if (before.evidence === "sparse") return null;
  const w = ratingWeight(rating);
  const direction = before.score >= 60 && w <= -1 ? "negative" : before.score <= DISSONANCE_MAX_SCORE && w >= 1.5 ? "positive" : null;
  if (!direction) return null;
  const nearest = [...entries].filter(e => direction === "negative" ? ratingWeight(e.rating)>0 : ratingWeight(e.rating)<0)
    .sort((a,b)=>cosineSimilarity(item.features,b.item.features)-cosineSimilarity(item.features,a.item.features))[0];
  const axis = nearest ? topAxisDifference(item.features, nearest.item.features) : AXIS_KEYS[0];
  const raw = [
    { kind:"axis" as const, key:axis, label:`The ${axisPhrase(axis, item.features[axis])} mattered` },
    ...item.keywords.slice(0,2).map(key=>({kind:"tag" as const,key,label:`The ${key} element mattered`})),
    ...item.genres.slice(0,1).map(key=>({kind:"genre" as const,key,label:`The ${key.toLowerCase()} side mattered`}))
  ];
  return { direction, options:raw.slice(0,3), summary: direction === "negative"
    ? `Unexpected based on your ratings so far: Dossier expected this to fit${nearest ? ` near ${nearest.item.title}` : ""}. Something else may matter here.`
    : `This sits outside the patterns Dossier currently associates with your favourites. It may reveal an underrepresented part of your taste.` };
}

export function explainRating(item: TmdbItem, rating: Rating, before: Prediction): string {
  const kind = ratingKind(rating); const strength = Math.abs(ratingWeight(rating));
  const pattern = item.keywords.slice(0,2).join(" and ") || item.genres.slice(0,2).join(" and ") || "this pattern";
  if (kind === "not_interested") return `Dossier will treat this as lack of interest around ${pattern.toLowerCase()}, not as disliking the whole ${item.genres[0]?.toLowerCase() ?? "category"}.`;
  if (kind === "watchlist") return `Watchlist interest is weak positive evidence, not a claim that you already like ${item.title}.`;
  if (kind === "neutral") return `Neutral adds coverage without pulling your taste model towards or away from ${item.title}.`;
  const intensity = strength >= 2 ? "strong" : strength >= 1.5 ? "meaningful" : "some";
  const direction = kind === "like" ? "positive" : "negative";
  const change = (before.expected === "like" && kind === "dislike") || (before.expected === "dislike" && kind === "like") ? " This contradicts the current guess, so Dossier will weaken that assumption." : "";
  return `This is ${intensity} ${direction} evidence around ${pattern.toLowerCase()}.${change}`;
}

export type TasteArea = { name:string; status:"strong"|"learning"; why:string };
export function tasteSnapshot(entries: RatingEntry[]): TasteArea[] {
  const map = new Map<string, RatingEntry[]>();
  for (const e of entries) for (const g of e.item.genres) map.set(g,[...(map.get(g)??[]),e]);
  return [...map].map(([name, xs])=>{
    const pos=xs.filter(x=>ratingWeight(x.rating)>0).length, neg=xs.filter(x=>ratingWeight(x.rating)<0).length;
    const strong=xs.length>=4 && Math.max(pos,neg)/xs.length>=.7;
    return {name,status:strong?"strong":"learning",why:strong?`${xs.length} responses point mostly in the same direction.`:xs.length<4?`Only ${xs.length} response${xs.length===1?"":"s"} so far.`:`Positive, negative, and indifferent signals are mixed.`} as TasteArea;
  }).sort((a,b)=>a.status.localeCompare(b.status)||a.name.localeCompare(b.name));
}

export function shouldStopActiveLearning(entries: RatingEntry[], bestValue: number): {stop:boolean; reason:string} {
  const recent=entries.slice(-8); const settled=recent.length===8 && recent.filter(e=>Math.abs(ratingWeight(e.rating))>=1).length>=6;
  return {stop:entries.length>=20 && settled && bestValue<.85, reason:"The areas you have covered are producing little new uncertainty, so another proactive question is unlikely to add much right now."};
}
