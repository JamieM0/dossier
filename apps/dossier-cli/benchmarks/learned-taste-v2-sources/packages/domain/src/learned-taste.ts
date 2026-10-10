import { AXIS_KEYS, type AxisKey } from './lens.js';
import { ratingWeight, type PairwiseChoice, type RatedItem, type RatingEntry, type TasteClaim } from './store/model.js';
import { tasteClaimScoreAdjustment } from './taste-claims.js';
import type { TmdbItem } from './tmdb/types.js';

export type LearnedTasteMode = 'axes' | 'descriptive' | 'comparisons';
export const LEARNED_TASTE_CONFIG = { iterations: 100, regularisation: 4, minimumSupport: 3, maxTags: 96, comparisonMargin: 0.25 } as const;
type Item = Pick<RatedItem, 'features' | 'genres' | 'keywords'>;
export type TasteDistinction = { id: string; kind: 'axis' | 'genre' | 'tag'; value: string; weight: number; support: number };
export type LearnedTaste = { distinctions: TasteDistinction[]; intercept: number; ratings: number; comparisons: number };
type Example = { values: Map<number, number>; target: number; weight: number };

const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
function encode(item: Item, distinctions: readonly TasteDistinction[]): Map<number, number> {
  const values = new Map<number, number>([[0, 1]]);
  distinctions.forEach((distinction, i) => {
    const value = distinction.kind === 'axis' ? item.features[distinction.value as AxisKey]
      : distinction.kind === 'genre' ? Number(item.genres.includes(distinction.value))
      : Number(item.keywords.includes(distinction.value));
    if (value) values.set(i + 1, value);
  });
  return values;
}

/** Fit inspectable distinctions from personal evidence only. Candidate
 * descriptions never select the vocabulary or enter the fit. */
export function learnTasteDistinctions(entries: readonly RatingEntry[], choices: readonly PairwiseChoice[] = [], mode: LearnedTasteMode = 'descriptive'): LearnedTaste {
  const ordered = entries.filter(e => ratingWeight(e.rating) !== 0).slice().sort((a, b) => compare(a.item.key, b.item.key));
  const distinctions: TasteDistinction[] = AXIS_KEYS.map(value => ({ id: `axis:${value}`, kind: 'axis', value, weight: 0, support: ordered.filter(e => e.item.features[value] !== 0).length }));
  if (mode !== 'axes') {
    for (const kind of ['genre', 'tag'] as const) {
      const counts = new Map<string, number>();
      for (const entry of ordered) for (const value of new Set(kind === 'genre' ? entry.item.genres : entry.item.keywords)) counts.set(value, (counts.get(value) ?? 0) + 1);
      const values = [...counts.entries()].filter(([, count]) => count >= LEARNED_TASTE_CONFIG.minimumSupport)
        .sort((a, b) => b[1] - a[1] || compare(a[0], b[0])).slice(0, kind === 'tag' ? LEARNED_TASTE_CONFIG.maxTags : counts.size);
      for (const [value, support] of values) distinctions.push({ id: `${kind}:${value}`, kind, value, weight: 0, support });
    }
  }
  const byKey = new Map(ordered.map(e => [e.item.key, e]));
  const vectors = new Map(ordered.map(e => [e.item.key, encode(e.item, distinctions)]));
  const examples: Example[] = ordered.map(e => ({ values: vectors.get(e.item.key)!, target: ratingWeight(e.rating) / 2, weight: Math.abs(ratingWeight(e.rating)) }));
  const latest = new Map<string, PairwiseChoice>();
  if (mode === 'comparisons') for (const choice of choices) {
    if (!byKey.has(choice.winnerKey) || !byKey.has(choice.loserKey) || choice.winnerKey === choice.loserKey) continue;
    const id = [choice.winnerKey, choice.loserKey].sort(compare).join('|');
    const previous = latest.get(id);
    if (!previous || choice.ts > previous.ts || (choice.ts === previous.ts && compare(choice.winnerKey, previous.winnerKey) > 0)) latest.set(id, choice);
  }
  for (const [, choice] of [...latest].sort((a, b) => compare(a[0], b[0]))) {
    const values = new Map(vectors.get(choice.winnerKey)!);
    for (const [index, value] of vectors.get(choice.loserKey)!) values.set(index, (values.get(index) ?? 0) - value);
    for (const [index, value] of values) if (value === 0) values.delete(index);
    if (values.size) examples.push({ values, target: LEARNED_TASTE_CONFIG.comparisonMargin, weight: 1 });
  }
  const weights = Array<number>(distinctions.length + 1).fill(0);
  const residuals = examples.map(e => e.target);
  const columns = weights.map((_, index) => examples.flatMap((e, row) => e.values.has(index) ? [{ row, value: e.values.get(index)!, weight: e.weight }] : []));
  for (let iteration = 0; iteration < LEARNED_TASTE_CONFIG.iterations; iteration++) {
    let largestChange = 0;
    for (let index = 0; index < weights.length; index++) {
      const previous = weights[index]!;
      let numerator = 0, denominator = index === 0 ? 0 : LEARNED_TASTE_CONFIG.regularisation;
      for (const cell of columns[index]!) {
        numerator += cell.weight * cell.value * (residuals[cell.row]! + cell.value * previous);
        denominator += cell.weight * cell.value ** 2;
      }
      const next = denominator ? numerator / denominator : 0;
      weights[index] = next;
      for (const cell of columns[index]!) residuals[cell.row] = residuals[cell.row]! - cell.value * (next - previous);
      largestChange = Math.max(largestChange, Math.abs(next - previous));
    }
    if (largestChange < 1e-9) break;
  }
  return { distinctions: distinctions.map((d, i) => ({ ...d, weight: weights[i + 1]! })), intercept: weights[0]!, ratings: ordered.length, comparisons: latest.size };
}

export function learnedTasteEvidence(item: Item, taste: LearnedTaste) {
  const contributions = [...encode(item, taste.distinctions)].filter(([index]) => index > 0)
    .map(([index, value]) => ({ ...taste.distinctions[index - 1]!, contribution: value * taste.distinctions[index - 1]!.weight }));
  return { score: taste.intercept + contributions.reduce((sum, d) => sum + d.contribution, 0), contributions };
}

export function scoreLearnedTaste(candidates: TmdbItem[], entries: readonly RatingEntry[], claims: readonly TasteClaim[], choices: readonly PairwiseChoice[], mode: LearnedTasteMode, qualityWeight: number) {
  if (!entries.some(e => ratingWeight(e.rating) > 0)) return [];
  const taste = learnTasteDistinctions(entries, choices, mode);
  return candidates.filter(item => AXIS_KEYS.some(axis => item.features[axis] !== 0)).map(item => {
    const evidence = learnedTasteEvidence(item, taste);
    const quality = item.voteAverage == null ? 0 : (item.voteAverage / 10 - 0.5) * 2;
    return { item, score: evidence.score + qualityWeight * quality + tasteClaimScoreAdjustment(item, claims) };
  }).sort((a, b) => b.score - a.score || compare(`${a.item.medium}:${a.item.id}`, `${b.item.medium}:${b.item.id}`));
}
