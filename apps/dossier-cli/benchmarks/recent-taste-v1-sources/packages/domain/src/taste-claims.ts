/** Deterministic, local-only preference-claim derivation and matching. */
import { AXIS_KEYS, type AxisKey, type FeatureVector } from "./lens.js";
import {
  ratingWeight,
  type RatedItem,
  type RatingEntry,
  type TasteClaim,
  type TasteClaimCondition,
  type TasteClaimEvidence
} from "./store/model.js";
import { buildTasteSpace, type TasteSpace } from "./taste-space.js";

export const MAX_ACTIVE_TASTE_CLAIMS = 24;
export const MAX_CLAIM_SCORE_ADJUSTMENT = 0.15;
export const MIN_CLAIM_SUPPORT = 3;
export const MIN_CONJUNCTION_IMPROVEMENT = 0.15;

const AXIS_THRESHOLD = 0.3;
const MIN_PRECISION = 0.7;

type ClaimItem = {
  features: FeatureVector;
  genres: string[];
  keywords: string[];
  collection?: RatedItem["collection"];
  directorIds?: number[];
  creatorIds?: number[];
};
type Evaluation = {
  effect: TasteClaim["effect"];
  confidence: number;
  precision: number;
  support: RatingEntry[];
  counters: RatingEntry[];
  evidence: TasteClaimEvidence;
};

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function stableHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36).padStart(7, "0");
}

export function tasteClaimConditionKey(condition: TasteClaimCondition): string {
  return `${condition.kind}:${String(condition.value)}:${condition.side ?? ""}`;
}

export function canonicalTasteClaimConditions(
  conditions: readonly TasteClaimCondition[]
): [TasteClaimCondition] | [TasteClaimCondition, TasteClaimCondition] {
  const unique = [...new Map(conditions.map((condition) => [tasteClaimConditionKey(condition), condition])).values()]
    .sort((a, b) => compareText(tasteClaimConditionKey(a), tasteClaimConditionKey(b)))
    .slice(0, 2);
  if (unique.length === 0) throw new Error("A taste claim needs at least one condition");
  return unique.length === 1 ? [unique[0]!] : [unique[0]!, unique[1]!];
}

export function tasteClaimId(
  effect: TasteClaim["effect"],
  conditions: readonly TasteClaimCondition[]
): string {
  const canonical = canonicalTasteClaimConditions(conditions);
  return `claim:${effect}:${stableHash(canonical.map(tasteClaimConditionKey).join("&"))}`;
}

export function matchesTasteClaimCondition(item: ClaimItem, condition: TasteClaimCondition): boolean {
  if (condition.kind === "genre") return item.genres.includes(String(condition.value));
  if (condition.kind === "tag") return item.keywords.includes(String(condition.value));
  if (condition.kind === "collection") return item.collection?.id === Number(condition.value);
  if (condition.kind === "director") return (item.directorIds ?? []).includes(Number(condition.value));
  if (condition.kind === "creator") return (item.creatorIds ?? []).includes(Number(condition.value));
  const value = item.features[condition.value as AxisKey] ?? 0;
  return condition.side === "low" ? value <= -AXIS_THRESHOLD : value >= AXIS_THRESHOLD;
}

export function matchesTasteClaim(item: ClaimItem, claim: Pick<TasteClaim, "conditions">): boolean {
  return claim.conditions.every((condition) => matchesTasteClaimCondition(item, condition));
}

function axisLabel(axis: AxisKey, side: "low" | "high"): string {
  const labels: Record<AxisKey, [string, string]> = {
    pacing: ["slower pacing", "faster pacing"],
    tone: ["darker tone", "lighter tone"],
    emotional_intensity: ["emotional restraint", "emotional intensity"],
    complexity: ["straightforward storytelling", "complex storytelling"],
    scope: ["intimate scope", "broad scope"],
    realism: ["realistic settings", "fantastical settings"],
    thematic_weight: ["lighter themes", "weighty themes"],
    character_focus: ["plot focus", "character focus"],
    moral_clarity: ["moral ambiguity", "clear moral stakes"],
    structure: ["conventional structure", "unusual structure"]
  };
  return labels[axis][side === "low" ? 0 : 1];
}

function candidateConditions(entries: readonly RatingEntry[]): TasteClaimCondition[] {
  const values = new Map<string, TasteClaimCondition>();
  const add = (condition: TasteClaimCondition): void => {
    values.set(tasteClaimConditionKey(condition), condition);
  };
  for (const entry of entries) {
    for (const genre of new Set(entry.item.genres)) add({ kind: "genre", value: genre, label: genre });
    for (const tag of new Set(entry.item.keywords)) add({ kind: "tag", value: tag, label: tag });
    if (entry.item.collection) add({ kind: "collection", value: entry.item.collection.id, label: entry.item.collection.name });
    for (const id of new Set(entry.item.directorIds ?? [])) add({ kind: "director", value: id, label: `director ${id}` });
    for (const id of new Set(entry.item.creatorIds ?? [])) add({ kind: "creator", value: id, label: `creator ${id}` });
    for (const axis of AXIS_KEYS) {
      if (entry.item.features[axis] >= AXIS_THRESHOLD) add({ kind: "feature_axis", value: axis, side: "high", label: axisLabel(axis, "high") });
      if (entry.item.features[axis] <= -AXIS_THRESHOLD) add({ kind: "feature_axis", value: axis, side: "low", label: axisLabel(axis, "low") });
    }
  }
  return [...values.values()].sort((a, b) => compareText(tasteClaimConditionKey(a), tasteClaimConditionKey(b)));
}

function clusterIdsFor(entries: readonly RatingEntry[], space: TasteSpace): string[] {
  const keys = new Set(entries.map((entry) => entry.item.key));
  return space.clusters
    .filter((cluster) => cluster.supportingRatings.some((rating) => keys.has(rating.itemKey)))
    .map((cluster) => cluster.id)
    .sort(compareText);
}

function evaluate(
  entries: readonly RatingEntry[],
  conditions: readonly TasteClaimCondition[],
  space: TasteSpace,
  forcedEffect?: TasteClaim["effect"]
): Evaluation | null {
  const matched = entries.filter((entry) => matchesTasteClaim(entry.item, { conditions: canonicalTasteClaimConditions(conditions) }));
  const positive = matched.filter((entry) => ratingWeight(entry.rating) > 0);
  const negative = matched.filter((entry) => ratingWeight(entry.rating) < 0);
  const positiveWeight = positive.reduce((sum, entry) => sum + ratingWeight(entry.rating), 0);
  const negativeWeight = negative.reduce((sum, entry) => sum + Math.abs(ratingWeight(entry.rating)), 0);
  if (positiveWeight === 0 && negativeWeight === 0) return null;
  const effect = forcedEffect ?? (positiveWeight >= negativeWeight ? "positive" : "negative");
  const support = effect === "positive" ? positive : negative;
  const counters = effect === "positive" ? negative : positive;
  const supportingWeight = effect === "positive" ? positiveWeight : negativeWeight;
  const counterexampleWeight = effect === "positive" ? negativeWeight : positiveWeight;
  const totalWeight = supportingWeight + counterexampleWeight;
  const precision = totalWeight > 0 ? supportingWeight / totalWeight : 0;
  const confidence = Math.max(0, Math.min(0.99, precision * (supportingWeight / (supportingWeight + 2))));
  return {
    effect,
    confidence,
    precision,
    support,
    counters,
    evidence: {
      supportingItemKeys: support.map((entry) => entry.item.key).sort(compareText),
      counterexampleItemKeys: counters.map((entry) => entry.item.key).sort(compareText),
      tasteSpaceClusterIds: clusterIdsFor(matched, space),
      supportingWeight,
      counterexampleWeight,
      matchedItemCount: matched.length
    }
  };
}

function inferredClaim(
  conditions: readonly TasteClaimCondition[],
  evaluation: Evaluation
): TasteClaim {
  const canonical = canonicalTasteClaimConditions(conditions);
  return {
    id: tasteClaimId(evaluation.effect, canonical),
    conditions: canonical,
    effect: evaluation.effect,
    confidence: evaluation.confidence,
    evidence: evaluation.evidence,
    provenance: "inferred",
    active: true
  };
}

/** Build stable claims from explicit ratings and the same TasteSpace used by
 * recommendation. Input ordering does not affect claim ordering or identity. */
export function deriveTasteClaims(
  entries: readonly RatingEntry[],
  tasteSpace: TasteSpace = buildTasteSpace(entries)
): TasteClaim[] {
  const conditions = candidateConditions(entries);
  const evaluated = new Map<string, Evaluation>();
  const singles: TasteClaim[] = [];
  for (const condition of conditions) {
    const value = evaluate(entries, [condition], tasteSpace);
    if (!value) continue;
    evaluated.set(tasteClaimConditionKey(condition), value);
    if (value.support.length >= MIN_CLAIM_SUPPORT && value.precision >= MIN_PRECISION) {
      singles.push(inferredClaim([condition], value));
    }
  }

  // Pair only recurrent conditions. Besides bounding work, this prevents a
  // one-off detail from masquerading as a meaningful conjunction.
  const recurrent = conditions.filter((condition) => {
    const value = evaluated.get(tasteClaimConditionKey(condition));
    return value && value.evidence.matchedItemCount >= MIN_CLAIM_SUPPORT + 1;
  }).slice(0, 120);
  const conjunctions: TasteClaim[] = [];
  for (let i = 0; i < recurrent.length; i++) {
    for (let j = i + 1; j < recurrent.length; j++) {
      const left = recurrent[i]!;
      const right = recurrent[j]!;
      if (left.kind === "feature_axis" && right.kind === "feature_axis" && left.value === right.value) continue;
      const value = evaluate(entries, [left, right], tasteSpace);
      if (!value || value.support.length < MIN_CLAIM_SUPPORT || value.precision < MIN_PRECISION) continue;
      const leftForEffect = evaluate(entries, [left], tasteSpace, value.effect);
      const rightForEffect = evaluate(entries, [right], tasteSpace, value.effect);
      const parentPrecision = Math.max(leftForEffect?.precision ?? 0, rightForEffect?.precision ?? 0);
      if (value.precision - parentPrecision < MIN_CONJUNCTION_IMPROVEMENT) continue;
      conjunctions.push(inferredClaim([left, right], value));
    }
  }

  return [...singles, ...conjunctions]
    .sort((a, b) =>
      b.confidence - a.confidence ||
      b.evidence.supportingWeight - a.evidence.supportingWeight ||
      a.conditions.length - b.conditions.length ||
      compareText(a.id, b.id)
    )
    .slice(0, MAX_ACTIVE_TASTE_CLAIMS);
}

/** Refresh inferred evidence while preserving user decisions. Rejection and
 * correction tombstones remain even if the same deterministic claim is
 * inferred again. */
export function reconcileTasteClaims(
  entries: readonly RatingEntry[],
  existing: readonly TasteClaim[],
  tasteSpace: TasteSpace = buildTasteSpace(entries)
): TasteClaim[] {
  const previous = new Map(existing.map((claim) => [claim.id, claim]));
  const next = deriveTasteClaims(entries, tasteSpace).map((claim) => {
    const prior = previous.get(claim.id);
    if (!prior || prior.provenance === "inferred") return claim;
    return {
      ...claim,
      provenance: prior.provenance,
      active: prior.active,
      ...(prior.feedbackAt !== undefined ? { feedbackAt: prior.feedbackAt } : {})
    };
  });
  const nextIds = new Set(next.map((claim) => claim.id));
  for (const claim of existing) {
    if (!nextIds.has(claim.id) && claim.provenance !== "inferred") next.push(claim);
  }
  return next.sort((a, b) => Number(b.active) - Number(a.active) || b.confidence - a.confidence || compareText(a.id, b.id));
}

export function withTasteClaimFeedback(
  claims: readonly TasteClaim[],
  claim: TasteClaim,
  provenance: Exclude<TasteClaim["provenance"], "inferred">,
  feedbackAt: number
): TasteClaim[] {
  const canonical = canonicalTasteClaimConditions(claim.conditions);
  const id = tasteClaimId(claim.effect, canonical);
  const base = claims.find((candidate) => candidate.id === id) ?? claim;
  const next: TasteClaim = {
    ...base,
    id,
    conditions: canonical,
    provenance,
    active: provenance === "user_confirmed",
    feedbackAt
  };
  return [...claims.filter((candidate) => candidate.id !== next.id), next]
    .sort((a, b) => Number(b.active) - Number(a.active) || b.confidence - a.confidence || compareText(a.id, b.id));
}

/** Additional evidence is deliberately capped: explicit ratings and
 * TasteSpace always dominate regardless of how many claims match. */
export function tasteClaimScoreAdjustment(item: ClaimItem, claims: readonly TasteClaim[]): number {
  let adjustment = 0;
  for (const claim of claims) {
    if (!claim.active || !matchesTasteClaim(item, claim)) continue;
    const authority = claim.provenance === "user_confirmed" ? 1 : 0.75;
    adjustment += (claim.effect === "positive" ? 1 : -1) * claim.confidence * authority * 0.06;
  }
  return Math.max(-MAX_CLAIM_SCORE_ADJUSTMENT, Math.min(MAX_CLAIM_SCORE_ADJUSTMENT, adjustment));
}

export type TasteProjectionPoint = {
  id: string;
  kind: "cluster" | "evidence" | "weak_region" | "claim";
  x: number;
  y: number;
  confidence: number;
  polarity?: "liked" | "disliked";
  itemKey?: string;
  claimId?: string;
  regionId?: string;
};

function normalized(vector: number[]): number[] {
  const length = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  return length > 1e-12 ? vector.map((value) => value / length) : vector.map(() => 0);
}

function canonicalSign(vector: number[]): number[] {
  const first = vector.find((value) => Math.abs(value) > 1e-9) ?? 1;
  return first < 0 ? vector.map((value) => -value) : vector;
}

/** Small deterministic PCA projection. It never feeds scoring or inference. */
export function projectTasteSpace2D(space: TasteSpace, claims: readonly TasteClaim[] = []): TasteProjectionPoint[] {
  const ratedByKey = new Map(space.ratedItems.map((rated) => [rated.key, rated]));
  const raw: Array<{ point: Omit<TasteProjectionPoint, "x" | "y">; vector: FeatureVector }> = [];
  for (const cluster of space.clusters) raw.push({ point: { id: cluster.id, kind: "cluster", confidence: cluster.confidence, polarity: cluster.polarity }, vector: cluster.centroid });
  for (const rated of space.ratedItems) raw.push({ point: { id: `evidence:${rated.key}`, kind: "evidence", confidence: Math.min(1, Math.abs(ratingWeight(rated.rating)) / 2), polarity: ratingWeight(rated.rating) >= 0 ? "liked" : "disliked", itemKey: rated.key }, vector: rated.item.features });
  for (const region of space.weakRegions) raw.push({ point: { id: `region:${region.id}`, kind: "weak_region", confidence: region.confidence, regionId: region.id }, vector: region.centroid });
  for (const claim of claims) {
    if (!claim.active) continue;
    const supports = claim.evidence.supportingItemKeys.map((key) => ratedByKey.get(key)?.item.features).filter((value): value is FeatureVector => Boolean(value));
    if (!supports.length) continue;
    const centroid = Object.fromEntries(AXIS_KEYS.map((axis) => [axis, supports.reduce((sum, vector) => sum + vector[axis], 0) / supports.length])) as FeatureVector;
    raw.push({ point: { id: `projection:${claim.id}`, kind: "claim", confidence: claim.confidence, claimId: claim.id, polarity: claim.effect === "positive" ? "liked" : "disliked" }, vector: centroid });
    const counters = claim.evidence.counterexampleItemKeys.map((key) => ratedByKey.get(key)?.item.features).filter((value): value is FeatureVector => Boolean(value));
    if (counters.length || claim.confidence < 0.6) {
      const boundary = counters.length
        ? Object.fromEntries(AXIS_KEYS.map((axis) => [axis, [...supports, ...counters].reduce((sum, vector) => sum + vector[axis], 0) / (supports.length + counters.length)])) as FeatureVector
        : centroid;
      raw.push({ point: { id: `claim-region:${claim.id}`, kind: "weak_region", confidence: claim.confidence, regionId: claim.id }, vector: boundary });
    }
  }
  if (!raw.length) return [];
  const mean = AXIS_KEYS.map((axis) => raw.reduce((sum, value) => sum + value.vector[axis], 0) / raw.length);
  const centered = raw.map(({ vector }) => AXIS_KEYS.map((axis, index) => vector[axis] - mean[index]!));
  const covariance = AXIS_KEYS.map((_, row) => AXIS_KEYS.map((__, column) => centered.reduce((sum, vector) => sum + vector[row]! * vector[column]!, 0)));
  const multiply = (vector: number[]): number[] => covariance.map((row) => row.reduce((sum, value, index) => sum + value * vector[index]!, 0));
  let first = normalized(AXIS_KEYS.map((_, index) => index + 1));
  for (let step = 0; step < 24; step++) first = normalized(multiply(first));
  first = canonicalSign(first);
  let second = normalized(AXIS_KEYS.map((_, index) => index % 2 === 0 ? 1 : -1));
  for (let step = 0; step < 24; step++) {
    const candidate = multiply(second);
    const dot = candidate.reduce((sum, value, index) => sum + value * first[index]!, 0);
    second = normalized(candidate.map((value, index) => value - dot * first[index]!));
  }
  second = canonicalSign(second);
  const projected = centered.map((vector) => ({
    x: vector.reduce((sum, value, index) => sum + value * first[index]!, 0),
    y: vector.reduce((sum, value, index) => sum + value * second[index]!, 0)
  }));
  const scale = Math.max(1e-9, ...projected.flatMap(({ x, y }) => [Math.abs(x), Math.abs(y)]));
  return raw.map(({ point }, index) => ({ ...point, x: projected[index]!.x / scale, y: projected[index]!.y / scale }));
}
