import { AXIS_KEYS } from './lens.js';
import { DEFAULT_SCORING_PARAMS, scoreCandidates } from './recommender.js';
import { buildTasteSpace } from './taste-space.js';
import { reconcileTasteClaims } from './taste-claims.js';
import { isValidRating, ratingWeight, type RatingEntry, type RatingsMap, type TasteClaim } from './store/model.js';
import type { TmdbItem } from './tmdb/types.js';

export const CONTEXT_CONFIG = { ridge: 6, prior: 8, minRatings: 3, maxResidual: .8, recencyStrength: 1 } as const;
export const CONTEXT_ARMS = ['global', 'recency', 'separate', 'shared'] as const;
export type ContextArm = typeof CONTEXT_ARMS[number];
export type ContextProfile = { id: string; name: string; ratings: RatingsMap };
export type ContextState = { version: 1; contexts: ContextProfile[] };
export const emptyContexts = (): ContextState => ({ version: 1, contexts: [] });
export function readContexts(value: unknown): ContextState {
  if (value === undefined) return emptyContexts();
  const state = value as ContextState;
  if (!state || state.version !== 1 || !Array.isArray(state.contexts) || state.contexts.length > 16) throw new Error('Invalid context profile');
  const ids = new Set<string>();
  for (const context of state.contexts) {
    if (!context || context.id === 'global' || !/^[a-z][a-z0-9_-]{0,39}$/.test(context.id) || ids.has(context.id) ||
      typeof context.name !== 'string' || !context.name.trim() || context.name.length > 80 || /[\x00-\x1f\x7f]/.test(context.name) ||
      !context.ratings || typeof context.ratings !== 'object' || Array.isArray(context.ratings)) throw new Error('Invalid context profile');
    ids.add(context.id);
    for (const [key, entry] of Object.entries(context.ratings)) {
      if (!entry || !isValidRating(entry.rating) || !Number.isFinite(entry.ts) || entry.ts < 0 || !entry.item || entry.item.key !== key ||
        !/^(movie|tv):[1-9]\d*$/.test(key) || key !== `${entry.item.medium}:${entry.item.id}` || !Array.isArray(entry.item.genres) ||
        !Array.isArray(entry.item.keywords) || !entry.item.features || AXIS_KEYS.some(a => !Number.isFinite(entry.item.features[a]))) throw new Error('Invalid context rating');
    }
  }
  return structuredClone(state);
}
const vector = (entry: { features: TmdbItem['features'] }) => [1, ...AXIS_KEYS.map(a => entry.features[a])];
const dot = (a: number[], b: number[]) => a.reduce((n, x, i) => n + x * b[i]!, 0);
const clamp = (n: number, limit: number) => Math.max(-limit, Math.min(limit, n));
const usable = (entries: readonly RatingEntry[]) => entries.filter(e => e.rating !== .5 && e.rating !== -.5);
function fit(entries: readonly RatingEntry[], target: (entry: RatingEntry) => number): number[] {
  const size = AXIS_KEYS.length + 1;
  const matrix = Array.from({ length: size }, (_, i) => Array.from({ length: size + 1 }, (_, j) => i === j ? CONTEXT_CONFIG.ridge : 0));
  for (const entry of entries.slice().sort((a,b) => a.item.key < b.item.key ? -1 : a.item.key > b.item.key ? 1 : 0)) {
    const x = vector(entry.item), y = target(entry);
    for (let i=0;i<size;i++) {
      for (let j=0;j<size;j++) matrix[i]![j]! += x[i]! * x[j]!;
      matrix[i]![size]! += x[i]! * y;
    }
  }
  for (let i=0;i<size;i++) {
    const divisor = matrix[i]![i]!;
    for (let j=i;j<=size;j++) matrix[i]![j]! /= divisor;
    for (let k=0;k<size;k++) if(k!==i) {
      const factor=matrix[k]![i]!;
      for(let j=i;j<=size;j++)matrix[k]![j]! -= factor*matrix[i]![j]!;
    }
  }
  return matrix.map(row => row[size]!);
}
function safeEntries(entries: readonly RatingEntry[]): RatingEntry[] {
  return entries.map(e=>({...e,item:{...e.item,voteAverage:null}}));
}
function claimsFor(entries: RatingEntry[]): TasteClaim[] {
  return reconcileTasteClaims(entries, [], buildTasteSpace(entries));
}
export function contextClaims(global: RatingEntry[], contexts: ContextState) {
  return [{scope:'global',claims:claimsFor(global)}, ...contexts.contexts.map(c=>({scope:c.id,claims:claimsFor(Object.values(c.ratings))}))];
}
export function scoreContexts(candidates: TmdbItem[], global: RatingEntry[], claims: readonly TasteClaim[], state: ContextState,
  contextId: string | undefined, arm: ContextArm) {
  const context = contextId === undefined ? undefined : state.contexts.find(c=>c.id===contextId);
  if(contextId !== undefined && !context) throw new Error('Context not found');
  const local = safeEntries(Object.values(context?.ratings ?? {}));
  const globals = safeEntries(global);
  const pooled = [...globals, ...state.contexts.flatMap(c=>safeEntries(Object.values(c.ratings))).sort((a,b)=>a.ts-b.ts || a.item.key.localeCompare(b.item.key))];
  const source = arm === 'global' || arm === 'recency' ? pooled : arm === 'separate' && context ? local : globals;
  const selectedClaims = arm === 'shared' || !context && arm === 'separate' ? claims : claimsFor(source);
  const safeCandidates=candidates.map(item=>({...item,voteAverage:null,voteCount:0,popularity:null}));
  const referenceTime=Math.max(0,...pooled.map(e=>e.ts));
  const params={...DEFAULT_SCORING_PARAMS,qualityWeight:0,popularityBias:0,serendipity:0,
    ratingRecencyStrength:arm==='recency'?CONTEXT_CONFIG.recencyStrength:0};
  const base = scoreCandidates(safeCandidates,source,params,selectedClaims,{referenceTime});
  const baseScores=new Map(base.map(r=>[`${r.item.medium}:${r.item.id}`,r.score]));
  const samples=usable(local),globalFit=fit(usable(globals),e=>ratingWeight(e.rating)/2);
  const residualFit=fit(samples,e=>ratingWeight(e.rating)/2-clamp(dot(vector(e.item),globalFit),1));
  const shrinkage=samples.length/(samples.length+CONTEXT_CONFIG.prior);
  const active=arm==='shared'&&context!==undefined&&samples.length>=CONTEXT_CONFIG.minRatings;
  const available=base.length>0||active;
  return {available,rows:safeCandidates.map(item=>{
    const baseScore=baseScores.get(`${item.medium}:${item.id}`)??0;
    const residual=active?clamp(dot(vector(item),residualFit)*shrinkage,CONTEXT_CONFIG.maxResidual):0;
    return {item,score:baseScore+residual,contextEvidence:{arm,scope:contextId??'global',globalRatings:globals.length,
      contextRatings:local.length,residualRatings:samples.length,shrinkage:active?shrinkage:0,baseScore,residual,
      status:!context?'global':samples.length===0?'unobserved':samples.length<CONTEXT_CONFIG.minRatings?'insufficient':'observed',
      confidence:null,coefficients:active?Object.fromEntries(AXIS_KEYS.map((a,i)=>[a,residualFit[i+1]!])):{}}};
  }).sort((a,b)=>b.score-a.score||`${a.item.medium}:${a.item.id}`.localeCompare(`${b.item.medium}:${b.item.id}`))};
}
