import { setLibraryRating } from './application.js';
import { createDefaultState } from './store/model.js';
import { claimConditionsForRule } from './personal-lens-45.js';
import { tasteClaimId, withTasteClaimFeedback } from './taste-claims.js';
import { scoreCandidates, DEFAULT_SCORING_PARAMS } from './recommender.js';
import { lensRuleId, matchesLensRule, readPersonalLens, type LensPredicate } from './personal-lens.js';
import type { RatingEntry, TasteClaim } from './store/model.js';
import type { TmdbItem } from './tmdb/types.js';

export const CORRECTION_ARMS = ['current', 'native', 'bounded', 'scoped'] as const;
export type CorrectionArm = typeof CORRECTION_ARMS[number];
export const CORRECTION_CONFIG = { boundedStrength: .3, boundedCap: .6, priority: 2, withinScope: .1, pairMargin: .004 } as const;
export type Correction =
  | { id: string; kind: 'general'; conditions: LensPredicate[]; effect: 1 | -1 }
  | { id: string; kind: 'exception'; key: string; effect: 1 | -1 }
  | { id: string; kind: 'comparison'; winner: string; loser: string };
export type CorrectionState = { version: 1; feedback: Correction[] };
export const emptyCorrections = (): CorrectionState => ({ version: 1, feedback: [] });
const validKey = (key: unknown): key is string => typeof key === 'string' && /^(movie|tv):[1-9]\d*$/.test(key);
export function validateCorrection(value: unknown): Correction {
  const f = value as Correction;
  if (!f || typeof f.id !== 'string' || !f.id.length || f.id.length > 500) throw new Error('Correction needs a stable id');
  if (f.kind === 'general') {
    readPersonalLens({ version: 1, features: [{ ...f, label: f.id, pair: ['movie:1', 'movie:2'] }], limitations: [], answered: [] });
    const conditions = [...f.conditions].sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    if (new Set(conditions.map(p => JSON.stringify(p))).size !== conditions.length) throw new Error('Duplicate predicate');
    return { id: f.id, kind: f.kind, conditions, effect: f.effect };
  }
  if (f.kind === 'exception' && validKey(f.key) && [1,-1].includes(f.effect)) return { id:f.id, kind:f.kind, key:f.key, effect:f.effect };
  if (f.kind === 'comparison' && validKey(f.winner) && validKey(f.loser) && f.winner !== f.loser) return { id:f.id, kind:f.kind, winner:f.winner, loser:f.loser };
  throw new Error('Use a general preference, title exception, or distinct title comparison');
}
export function readCorrections(value: unknown): CorrectionState {
  if (value === undefined) return emptyCorrections();
  const state = value as CorrectionState;
  if (!state || state.version !== 1 || !Array.isArray(state.feedback) || state.feedback.length > 50) throw new Error('Invalid correction profile');
  const feedback = state.feedback.map(validateCorrection);
  if (new Set(feedback.map(f => f.id)).size !== feedback.length) throw new Error('Duplicate correction id');
  return { version:1, feedback };
}
function target(f: Correction): string {
  return f.kind === 'general' ? `general:${lensRuleId(f.conditions)}` : f.kind === 'exception' ? `exception:${f.key}` : `comparison:${[f.winner,f.loser].sort().join('|')}`;
}
export function setCorrection(state: CorrectionState, value: unknown): CorrectionState {
  const f = validateCorrection(value);
  const feedback = state.feedback.filter(old => old.id !== f.id && target(old) !== target(f)).concat(f);
  return readCorrections({version:1,feedback});
}
export function removeCorrection(state: CorrectionState, id: string): CorrectionState {
  if (!state.feedback.some(f => f.id === id)) throw new Error('Correction not found');
  return {version:1,feedback:state.feedback.filter(f => f.id !== id)};
}
const key = (item: TmdbItem) => `${item.medium}:${item.id}`;
export function scoreCorrections(candidates: TmdbItem[], entries: RatingEntry[], claims: readonly TasteClaim[], state: CorrectionState, arm: CorrectionArm) {
  if (arm === 'native') {
    let profile = { ...createDefaultState(), ratings:Object.fromEntries(entries.map(e=>[e.item.key,e])), tasteClaims:claims.slice() };
    for (const f of state.feedback) if (f.kind === 'exception' && profile.ratings[f.key])
      profile = setLibraryRating(profile, f.key, f.effect * 3 as 3 | -3, undefined, profile.ratings[f.key]!.ts);
    let nativeClaims = profile.tasteClaims;
    const applied:string[]=[], unavailable:string[]=[];
    for(const f of state.feedback) if(f.kind==='general') {
      const conditions=claimConditionsForRule({ ...f,label:f.id,pair:['movie:1','movie:2'] });
      const original=conditions?nativeClaims.find(c=>c.id===tasteClaimId('positive',conditions)||c.id===tasteClaimId('negative',conditions)):undefined;
      if(!original){unavailable.push(f.id);continue;}
      const effect=f.effect>0?'positive' as const:'negative' as const;
      if(original.effect!==effect)nativeClaims=withTasteClaimFeedback(nativeClaims,original,'corrected',0);
      nativeClaims=withTasteClaimFeedback(nativeClaims,{...original,effect,id:tasteClaimId(effect,original.conditions)},'user_confirmed',0);
      applied.push(f.id);
    }
    return scoreCandidates(candidates,Object.values(profile.ratings),{...DEFAULT_SCORING_PARAMS,qualityWeight:0,popularityBias:0,serendipity:0},nativeClaims)
      .map(r=>({...r,correctionEvidence:{applied:applied.filter(id=>{
        const f=state.feedback.find(f=>f.id===id)!;return f.kind==='general'&&matchesLensRule(r.item,f.conditions);
      }).concat(state.feedback.filter(f=>f.kind==='exception'&&f.key===key(r.item)).map(f=>f.id)),conflicts:[],unavailable,confidence:null}}))
      .sort((a,b)=>b.score-a.score||key(a.item).localeCompare(key(b.item)));
  }
  const baseline = scoreCandidates(candidates, entries, { ...DEFAULT_SCORING_PARAMS, qualityWeight:0, popularityBias:0, serendipity:0 }, claims);
  const scores = new Map(baseline.map(r => [key(r.item), r.score]));
  const evidence = new Map(baseline.map(r => [key(r.item), { applied: [] as string[], conflicts: [] as string[] }]));
  if (arm !== 'current') for (const {item} of baseline) {
    const id = key(item), base = scores.get(id)!;
    const matches = state.feedback.filter((f): f is Extract<Correction,{kind:'general'}> => f.kind === 'general' && matchesLensRule(item,f.conditions));
    const exception = state.feedback.find((f): f is Extract<Correction,{kind:'exception'}> => f.kind === 'exception' && f.key === id);
    if (arm === 'bounded') {
      const raw = matches.reduce((s,f) => s + f.effect * CORRECTION_CONFIG.boundedStrength,0) + (exception?.effect ?? 0)*CORRECTION_CONFIG.boundedStrength;
      scores.set(id,base + Math.max(-CORRECTION_CONFIG.boundedCap,Math.min(CORRECTION_CONFIG.boundedCap,raw)));
      evidence.get(id)!.applied = [...matches.map(f=>f.id), ...(exception?[exception.id]:[])];
    } else {
      const specificity = Math.max(0,...matches.map(f=>f.conditions.length));
      const chosen = matches.filter(f=>f.conditions.length===specificity);
      const effects = new Set(chosen.map(f=>f.effect));
      const effect = exception?.effect ?? (effects.size===1?chosen[0]?.effect:undefined);
      if (effect !== undefined) {
        scores.set(id,effect*CORRECTION_CONFIG.priority + Math.max(-CORRECTION_CONFIG.withinScope,Math.min(CORRECTION_CONFIG.withinScope,base*CORRECTION_CONFIG.withinScope)));
        evidence.get(id)!.applied = exception?[exception.id]:chosen.map(f=>f.id);
      } else if (effects.size>1) evidence.get(id)!.conflicts=chosen.map(f=>f.id);
    }
  }
  const comparisons = state.feedback.filter((f): f is Extract<Correction,{kind:'comparison'}> => f.kind==='comparison');
  if (arm === 'bounded') for (const f of comparisons) {
    if (scores.has(f.winner)) { scores.set(f.winner,scores.get(f.winner)!+.3);evidence.get(f.winner)!.applied.push(f.id); }
    if (scores.has(f.loser)) { scores.set(f.loser,scores.get(f.loser)!-.3);evidence.get(f.loser)!.applied.push(f.id); }
  }
  if (arm === 'scoped') {
    // Pair authority is local. Contradictory graphs abstain instead of inventing an order.
    const applicable=comparisons.filter(f=>scores.has(f.winner)&&scores.has(f.loser));
    const graph=new Map<string,string[]>();
    for(const f of applicable)graph.set(f.winner,[...(graph.get(f.winner)??[]),f.loser]);
    const visiting=new Set<string>(),visited=new Set<string>();
    const cycle=(id:string):boolean=>{
      if(visiting.has(id))return true;if(visited.has(id))return false;visiting.add(id);
      for(const next of graph.get(id)??[])if(cycle(next))return true;
      visiting.delete(id);visited.add(id);return false;
    };
    if([...graph.keys()].some(cycle)) for(const f of applicable) {
      evidence.get(f.winner)!.conflicts.push(f.id);evidence.get(f.loser)!.conflicts.push(f.id);
    } else {
      const solved=new Set<string>();
      const satisfy=(id:string):void=>{
        if(solved.has(id))return;
        for(const loser of graph.get(id)??[]) {
          satisfy(loser);
          scores.set(id,Math.max(scores.get(id)!,scores.get(loser)!+CORRECTION_CONFIG.pairMargin));
        }
        solved.add(id);
      };
      for(const id of [...graph.keys()].sort())satisfy(id);
      for(const f of applicable)for(const id of [f.winner,f.loser])evidence.get(id)!.applied.push(f.id);
    }
  }
  return baseline.map(r=>({...r,score:scores.get(key(r.item))!,correctionEvidence:{...evidence.get(key(r.item))!,confidence:null}}))
    .sort((a,b)=>b.score-a.score||key(a.item).localeCompare(key(b.item)));
}
