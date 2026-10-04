import { AXIS_KEYS, type AxisKey, type FeatureVector } from './lens.js';
import { ratingKind, type PairwiseChoice, type RatingEntry } from './store/model.js';
import type { TasteCluster } from './taste-space.js';

export type RefineMetricMode = 'axis_metric' | 'axis_cluster_metric';
export const REFINE_METRIC_CONFIG = {
  iterations: 80, step: .12, temperature: .1, axisRegularisation: .15,
  clusterRegularisation: .3, minComparisons: 3, minDistinctItems: 4,
  axisBounds: [.25, 4], clusterBounds: [.5, 2]
} as const;
export type RefineMetric = {
  axisWeights: Record<AxisKey, number>;
  clusterWeights: Record<string, number>;
  comparisons: number;
  distinctItems: number;
  learned: boolean;
};

type Vector = number[];
type Cluster = { id: string; features: Vector; confidence: number; polarity: string };
const vector = (features: FeatureVector): Vector => AXIS_KEYS.map(axis => features[axis]);
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

function similarity(a: Vector, b: Vector, weights: Vector): { value: number; gradient: Vector } {
  let dot = 0, aa = 0, bb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]! * weights[i]!;
    aa += a[i]! ** 2 * weights[i]!;
    bb += b[i]! ** 2 * weights[i]!;
  }
  if (!aa || !bb) return { value: 0, gradient: a.map(() => 0) };
  const norm = Math.sqrt(aa * bb), value = dot / norm;
  return { value, gradient: a.map((ai, i) => weights[i]! * (
    ai * b[i]! / norm - .5 * value * (ai ** 2 / aa + b[i]! ** 2 / bb)
  )) };
}

function scoreGradient(features: Vector, clusters: Cluster[], logWeights: Vector, topK: number, dislikePenalty: number) {
  const axisWeights = logWeights.slice(0, AXIS_KEYS.length).map(Math.exp);
  const matches = clusters.map((cluster, index) => {
    const sim = similarity(features, cluster.features, axisWeights);
    const scale = cluster.confidence * Math.exp(logWeights[AXIS_KEYS.length + index] ?? 0);
    const value = Math.max(0, sim.value) * scale;
    const gradient = Array<number>(logWeights.length).fill(0);
    if (sim.value > 0) {
      for (let i = 0; i < AXIS_KEYS.length; i++) gradient[i] = sim.gradient[i]! * scale;
      if (AXIS_KEYS.length + index < gradient.length) gradient[AXIS_KEYS.length + index] = value;
    }
    return { value, gradient, polarity: cluster.polarity, index };
  });
  const liked = matches.filter(c => c.polarity === 'liked').sort((a,b) => b.value-a.value || a.index-b.index);
  const disliked = matches.filter(c => c.polarity === 'disliked').sort((a,b) => b.value-a.value || a.index-b.index)[0];
  const k = Math.min(Math.max(1, Math.round(topK)), liked.length);
  let value = 0;
  const gradient = Array<number>(logWeights.length).fill(0);
  for (const match of liked.slice(0,k)) {
    value += match.value/k;
    for (let i=0;i<gradient.length;i++) gradient[i] = gradient[i]! + match.gradient[i]!/k;
  }
  if (disliked) {
    value -= dislikePenalty * disliked.value;
    for (let i=0;i<gradient.length;i++) gradient[i] = gradient[i]! - dislikePenalty*disliked.gradient[i]!;
  }
  return { value, gradient };
}

/** Fit an experiment-only metric from the current explicit evidence.
 * Refit from defaults so corrections replace constraints without stale state. */
export function learnRefineMetric(
  entries: readonly RatingEntry[], choices: readonly PairwiseChoice[], tasteClusters: readonly TasteCluster[],
  mode: RefineMetricMode, topK = 3, dislikePenalty = .6
): RefineMetric {
  const byKey = new Map(entries.map(entry => [entry.item.key, entry]));
  const latest = new Map<string, PairwiseChoice>();
  for (const choice of choices) {
    const winner = byKey.get(choice.winnerKey), loser = byKey.get(choice.loserKey);
    if (!winner || !loser || winner === loser) continue;
    const kind = ratingKind(winner.rating);
    if (!['like','dislike'].includes(kind) || winner.rating !== loser.rating) continue;
    const id = [choice.winnerKey, choice.loserKey].sort(compare).join('|');
    const previous = latest.get(id);
    if (!previous || choice.ts > previous.ts || (choice.ts === previous.ts && compare(choice.winnerKey,previous.winnerKey) > 0)) latest.set(id,choice);
  }
  const pairs = [...latest.entries()].sort((a,b)=>compare(a[0],b[0])).map(([,choice])=>choice);
  const distinctItems = new Set(pairs.flatMap(p=>[p.winnerKey,p.loserKey])).size;
  const clusters: Cluster[] = tasteClusters.map(c=>({id:c.id,features:vector(c.centroid),confidence:c.confidence,polarity:c.polarity}));
  const count = AXIS_KEYS.length + (mode === 'axis_cluster_metric' ? clusters.length : 0);
  const logWeights = Array<number>(count).fill(0);
  const learned = pairs.length >= REFINE_METRIC_CONFIG.minComparisons && distinctItems >= REFINE_METRIC_CONFIG.minDistinctItems;
  if (learned) {
    const examples = pairs.map(pair=>({winner:vector(byKey.get(pair.winnerKey)!.item.features),loser:vector(byKey.get(pair.loserKey)!.item.features)}));
    for (let iteration=0;iteration<REFINE_METRIC_CONFIG.iterations;iteration++) {
      const gradient = Array<number>(count).fill(0);
      for (const example of examples) {
        const winner = scoreGradient(example.winner,clusters,logWeights,topK,dislikePenalty);
        const loser = scoreGradient(example.loser,clusters,logWeights,topK,dislikePenalty);
        const margin = (winner.value-loser.value)/REFINE_METRIC_CONFIG.temperature;
        const factor = -1/(1+Math.exp(Math.max(-50,Math.min(50,margin))))/REFINE_METRIC_CONFIG.temperature/examples.length;
        for (let i=0;i<count;i++) gradient[i] = gradient[i]! + factor*(winner.gradient[i]!-loser.gradient[i]!);
      }
      for (let i=0;i<count;i++) {
        const axis = i < AXIS_KEYS.length;
        const regularisation = axis ? REFINE_METRIC_CONFIG.axisRegularisation : REFINE_METRIC_CONFIG.clusterRegularisation;
        const bounds = axis ? REFINE_METRIC_CONFIG.axisBounds : REFINE_METRIC_CONFIG.clusterBounds;
        const step = REFINE_METRIC_CONFIG.step/Math.sqrt(1+iteration/20);
        logWeights[i] = Math.max(Math.log(bounds[0]),Math.min(Math.log(bounds[1]),logWeights[i]!-step*(gradient[i]!+2*regularisation*logWeights[i]!)));
      }
    }
  }
  return {
    axisWeights:Object.fromEntries(AXIS_KEYS.map((axis,i)=>[axis,Math.exp(logWeights[i]!)])) as Record<AxisKey,number>,
    clusterWeights:Object.fromEntries(clusters.map((cluster,i)=>[cluster.id,Math.exp(logWeights[AXIS_KEYS.length+i]??0)])),
    comparisons:pairs.length,distinctItems,learned
  };
}
