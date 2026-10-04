import { AXIS_KEYS, type FeatureVector } from "./lens.js";
import { cosineSimilarity } from "./taste-space.js";
import type { RatedItem, RatingEntry } from "./store/model.js";

export const PERSONAL_LENS_CONFIG = {
  similarity: 0.97, shortlist: 8, maxFeatures: 6, strength: 0.3,
  maxAdjustment: 0.6, limitationConfidence: 0.35, highConfidence: 0.8
} as const;
export type LensPredicate = { kind: "genre" | "tag" | "decade" | "director" | "creator" | "collection" | "axis"; value: string; side?: "low" | "high" };
export type LensRule = { id: string; conditions: LensPredicate[]; effect: 1 | -1; label: string; pair: [string, string] };
export type LensQuestion = { id: string; pair: [string, string]; similarity: number; choices: LensRule[] };
export type PersonalLens = { version: 1; features: LensRule[]; limitations: { questionId: string; pair: [string, string]; features: FeatureVector[] }[]; answered: string[] };
export const emptyPersonalLens = (): PersonalLens => ({ version: 1, features: [], limitations: [], answered: [] });
export function readPersonalLens(value: unknown): PersonalLens {
  if (value === undefined) return emptyPersonalLens();
  const lens = value as PersonalLens;
  if (!lens || lens.version !== 1 || !Array.isArray(lens.features) || !Array.isArray(lens.limitations) || !Array.isArray(lens.answered) ||
    lens.features.length > PERSONAL_LENS_CONFIG.maxFeatures || lens.answered.some(id => typeof id !== "string") ||
    lens.features.some(f => !f || typeof f.id !== "string" || typeof f.label !== "string" || ![1, -1].includes(f.effect) ||
      !Array.isArray(f.pair) || f.pair.length !== 2 || f.pair.some(k => typeof k !== "string") ||
      !Array.isArray(f.conditions) || f.conditions.length < 1 || f.conditions.length > 2 ||
      f.conditions.some(p => !p || !["genre", "tag", "decade", "director", "creator", "collection", "axis"].includes(p.kind) ||
        typeof p.value !== "string" || (p.kind === "axis" && (!AXIS_KEYS.includes(p.value as typeof AXIS_KEYS[number]) || !["low", "high"].includes(p.side ?? ""))))) ||
    lens.limitations.some(l => !l || typeof l.questionId !== "string" || !Array.isArray(l.pair) || l.pair.length !== 2 || l.pair.some(k => typeof k !== "string") ||
      !Array.isArray(l.features) || l.features.length !== 2 || l.features.some(v => !v || AXIS_KEYS.some(a => !Number.isFinite(v[a]))))) {
    throw new Error("Invalid experimental personal lens");
  }
  return lens;
}
export type LensItem = Pick<RatedItem, "genres" | "keywords" | "year" | "directorIds" | "creatorIds" | "collection" | "features">;
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
export const lensRuleId = (conditions: readonly LensPredicate[]): string => JSON.stringify([...conditions].sort((a, b) => compare(JSON.stringify(a), JSON.stringify(b))));
export function matchesLensRule(item: LensItem, conditions: readonly LensPredicate[]): boolean {
  return conditions.every(p => {
    if (p.kind === "genre") return item.genres.includes(p.value);
    if (p.kind === "tag") return item.keywords.includes(p.value);
    if (p.kind === "decade") return item.year !== null && String(Math.floor(item.year / 10) * 10) === p.value;
    if (p.kind === "director") return (item.directorIds ?? []).includes(Number(p.value));
    if (p.kind === "creator") return (item.creatorIds ?? []).includes(Number(p.value));
    if (p.kind === "collection") return item.collection?.id === Number(p.value);
    const value = item.features[p.value as keyof FeatureVector];
    return p.side === "high" ? value >= 0.35 : value <= -0.35;
  });
}
function predicates(item: LensItem): LensPredicate[] {
  return [
    ...item.genres.map(value => ({ kind: "genre" as const, value })),
    ...item.keywords.map(value => ({ kind: "tag" as const, value })),
    ...(item.year === null ? [] : [{ kind: "decade" as const, value: String(Math.floor(item.year / 10) * 10) }]),
    ...(item.directorIds ?? []).map(value => ({ kind: "director" as const, value: String(value) })),
    ...(item.creatorIds ?? []).map(value => ({ kind: "creator" as const, value: String(value) })),
    ...(item.collection ? [{ kind: "collection" as const, value: String(item.collection.id) }] : []),
    ...AXIS_KEYS.filter(axis => Math.abs(item.features[axis]) >= 0.35).map(value => ({ kind: "axis" as const, value, side: item.features[value] > 0 ? "high" as const : "low" as const }))
  ];
}
function ruleLabel(conditions: LensPredicate[]): string {
  return conditions.map(p => p.kind === "axis" ? `${p.side} ${p.value}` : `${p.kind}: ${p.value}`).join(" and ");
}
export function personalLensQueue(entries: readonly RatingEntry[], lens: PersonalLens): LensQuestion[] {
  const rated = entries.filter(e => Math.abs(e.rating) >= 1).slice().sort((a, b) => compare(a.item.key, b.item.key));
  const out: LensQuestion[] = [];
  if (lens.features.length >= PERSONAL_LENS_CONFIG.maxFeatures) return out;
  for (let i = 0; i < rated.length; i++) for (let j = i + 1; j < rated.length; j++) {
    const a = rated[i]!, b = rated[j]!;
    if (Math.sign(a.rating) === Math.sign(b.rating)) continue;
    const pair: [string, string] = [a.item.key, b.item.key];
    const id = JSON.stringify(pair);
    if (lens.answered.includes(id)) continue;
    const similarity = cosineSimilarity(a.item.features, b.item.features);
    if (similarity < PERSONAL_LENS_CONFIG.similarity) continue;
    const proposed = new Map<string, LensRule & { value: number }>();
    for (const source of [a, b]) {
      const atoms = predicates(source.item);
      const sets = atoms.map(p => [p]);
      for (let x = 0; x < atoms.length; x++) for (let y = x + 1; y < atoms.length; y++) sets.push([atoms[x]!, atoms[y]!]);
      for (const conditions of sets) {
        const ruleId = lensRuleId(conditions);
        if (lens.features.some(f => f.id === ruleId) || matchesLensRule(a.item, conditions) === matchesLensRule(b.item, conditions)) continue;
        const matched = rated.filter(e => matchesLensRule(e.item, conditions));
        const agreement = matched.reduce((s, e) => s + (Math.sign(e.rating) === Math.sign(source.rating) ? 1 : -1), 0);
        // Prefer supported distinctions; penalize conjunctions with little evidence.
        const value = agreement / (matched.length + 2) - 0.04 * (conditions.length - 1);
        proposed.set(ruleId, { id: ruleId, conditions, effect: Math.sign(source.rating) as 1 | -1,
          label: ruleLabel(conditions), pair, value });
      }
    }
    const choices = [...proposed.values()].sort((x, y) => y.value - x.value || compare(x.id, y.id))
      .slice(0, PERSONAL_LENS_CONFIG.shortlist).map(({ value: _value, ...rule }) => rule);
    out.push({ id, pair, similarity, choices });
  }
  return out.sort((a, b) => b.similarity - a.similarity || compare(a.id, b.id));
}
export function answerPersonalLens(lens: PersonalLens, question: LensQuestion, selected: string | null, entries: readonly RatingEntry[]): PersonalLens {
  if (lens.answered.includes(question.id)) throw new Error("Question already answered");
  const next = structuredClone(lens);
  next.answered.push(question.id);
  if (selected === null) {
    const vectors = question.pair.map(key => entries.find(e => e.item.key === key)?.item.features);
    if (vectors.some(v => !v)) throw new Error("Question evidence missing");
    next.limitations.push({ questionId: question.id, pair: question.pair, features: vectors as FeatureVector[] });
  } else {
    const rule = question.choices.find(f => f.id === selected);
    if (!rule) throw new Error("Select an offered distinction or none");
    next.features.push(structuredClone(rule));
  }
  return next;
}
export function personalLensEvidence(item: LensItem, entries: readonly RatingEntry[], lens: PersonalLens) {
  const matched = lens.features.filter(f => matchesLensRule(item, f.conditions));
  const raw = matched.reduce((s, f) => s + f.effect * PERSONAL_LENS_CONFIG.strength, 0);
  const adjustment = Math.max(-PERSONAL_LENS_CONFIG.maxAdjustment, Math.min(PERSONAL_LENS_CONFIG.maxAdjustment, raw));
  const neighbours = entries.filter(e => Math.abs(e.rating) >= 1).map(e => ({ rating: Math.sign(e.rating), similarity: cosineSimilarity(item.features, e.item.features) }))
    .sort((a, b) => b.similarity - a.similarity).slice(0, 4);
  const sum = neighbours.reduce((s, n) => s + n.rating, 0);
  let confidence = neighbours.length ? 0.5 + 0.45 * Math.abs(sum) / 4 * Math.max(0, neighbours[0]!.similarity) : 0;
  if (matched.length) confidence = matched.every(f => f.effect === matched[0]!.effect) ? 0.85 : 0.4;
  const limitations = lens.limitations.filter(l => l.features.some(v => cosineSimilarity(item.features, v) >= PERSONAL_LENS_CONFIG.similarity));
  if (limitations.length) confidence = Math.min(confidence, PERSONAL_LENS_CONFIG.limitationConfidence);
  return { adjustment, confidence, matched: matched.map(f => ({ id: f.id, label: f.label, effect: f.effect })), limitations: limitations.map(l => l.questionId) };
}
