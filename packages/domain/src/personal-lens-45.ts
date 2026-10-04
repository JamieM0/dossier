import { AXIS_KEYS, type FeatureVector } from './lens.js';
import { cosineSimilarity } from './taste-space.js';
import { ratingWeight, type RatingEntry, type TasteClaim, type TasteClaimCondition } from './store/model.js';
import { canonicalTasteClaimConditions, matchesTasteClaim, tasteClaimId, withTasteClaimFeedback } from './taste-claims.js';
import { emptyPersonalLens, lensRuleId, matchesLensRule, PERSONAL_LENS_CONFIG,
  type LensPredicate, type LensQuestion, type LensRule, type PersonalLens, type LensItem } from './personal-lens.js';

export const PERSONAL_LENS_45_CONFIG = { minSupport: 3, minContrast: 3, maxAtoms: 120,
  supportPrior: 4, conjunctionPenalty: 0.04, maxPrompts: 10, maxFeatures: 6 } as const;
export type Lens45State = PersonalLens & { rejected: string[]; initialEffects: Record<string, 1 | -1> };
export const emptyLens45 = (): Lens45State => ({ ...emptyPersonalLens(), rejected: [], initialEffects: {} });
const compare = (a:string,b:string) => a<b?-1:a>b?1:0;
function atoms(item: LensItem): LensPredicate[] {
  return [...item.genres.map(value=>({kind:'genre' as const,value})),
    ...item.keywords.map(value=>({kind:'tag' as const,value})),
    ...(item.year===null?[]:[{kind:'decade' as const,value:String(Math.floor(item.year/10)*10)}]),
    ...(item.directorIds??[]).map(id=>({kind:'director' as const,value:String(id)})),
    ...(item.creatorIds??[]).map(id=>({kind:'creator' as const,value:String(id)})),
    ...(item.collection?[{kind:'collection' as const,value:String(item.collection.id)}]:[]),
    ...AXIS_KEYS.flatMap(value=>Math.abs(item.features[value])<.35?[]:[{kind:'axis' as const,value,side:item.features[value]>0?'high' as const:'low' as const}])];
}
export type BroadQuestion = LensQuestion & { support: number; contrast: number; predictedValue: number };
const patternCache = new Map<string, BroadQuestion[]>();
export function broadLensQueue(entries: readonly RatingEntry[], lens: Lens45State): BroadQuestion[] {
  if(lens.features.length>=PERSONAL_LENS_45_CONFIG.maxFeatures)return [];
  const rated=entries.filter(e=>Math.abs(e.rating)>=1).slice().sort((a,b)=>compare(a.item.key,b.item.key));
  const cacheKey=JSON.stringify([rated.map(e=>[e.item.key,e.rating,e.item.genres,e.item.keywords,e.item.year,e.item.directorIds,e.item.creatorIds,e.item.collection?.id,e.item.features]),lens.features.map(f=>[f.id,f.effect,f.conditions])]);
  const cached=patternCache.get(cacheKey);
  if(cached)return structuredClone(cached.filter(q=>!lens.answered.includes(q.id)));
  const unique=new Map<string,LensPredicate>();
  for(const e of rated)for(const p of atoms(e.item))unique.set(lensRuleId([p]),p);
  const recurrent=[...unique.entries()].sort(([a],[b])=>compare(a,b)).map(([,p])=>p)
    .filter(p=>rated.filter(e=>matchesLensRule(e.item,[p])).length>=PERSONAL_LENS_45_CONFIG.minSupport).slice(0,PERSONAL_LENS_45_CONFIG.maxAtoms);
  const sets=recurrent.map(p=>[p]);
  for(let i=0;i<recurrent.length;i++)for(let j=i+1;j<recurrent.length;j++) {
    const a=recurrent[i]!,b=recurrent[j]!;
    if(a.kind===b.kind&&(['axis','decade','director','creator','collection'].includes(a.kind)))continue;
    sets.push([a,b]);
  }
  const out:BroadQuestion[]=[];
  for(const conditions of sets) {
    const ruleId=lensRuleId(conditions),id=`pattern:${ruleId}`;
    if(lens.features.some(f=>f.id===ruleId))continue;
    const inside=rated.filter(e=>matchesLensRule(e.item,conditions));
    const outside=rated.filter(e=>!matchesLensRule(e.item,conditions));
    if(inside.length<PERSONAL_LENS_45_CONFIG.minSupport||outside.length<PERSONAL_LENS_45_CONFIG.minContrast)continue;
    const mean=inside.reduce((s,e)=>s+Math.sign(e.rating),0)/inside.length;
    const other=outside.reduce((s,e)=>s+Math.sign(e.rating),0)/outside.length;
    if(mean===0||mean*(mean-other)<=0)continue;
    const effect=Math.sign(mean) as 1|-1;
    const support=inside.filter(e=>Math.sign(e.rating)===effect),contrast=outside.filter(e=>Math.sign(e.rating)!==effect);
    if(support.length<PERSONAL_LENS_45_CONFIG.minSupport||contrast.length<PERSONAL_LENS_45_CONFIG.minContrast)continue;
    let pair:[string,string]|null=null,similarity=-Infinity;
    for(const a of support)for(const b of contrast) {
      // Confirmed rules retire contrasts they already explain, without a similarity gate.
      if(lens.features.some(f=>matchesLensRule(a.item,f.conditions)!==matchesLensRule(b.item,f.conditions)&&
        f.effect===Math.sign((matchesLensRule(a.item,f.conditions)?a:b).rating)))continue;
      const sim=cosineSimilarity(a.item.features,b.item.features),keys:[string,string]=[a.item.key,b.item.key];
      if(!pair||sim>similarity||(sim===similarity&&compare(JSON.stringify(keys),JSON.stringify(pair))<0)){pair=keys;similarity=sim;}
    }
    if(!pair)continue;
    const predictedValue=Math.abs(mean-other)*Math.min(support.length,contrast.length)/(Math.min(support.length,contrast.length)+PERSONAL_LENS_45_CONFIG.supportPrior)
      -PERSONAL_LENS_45_CONFIG.conjunctionPenalty*(conditions.length-1);
    const rule:LensRule={id:ruleId,conditions,effect,label:conditions.map(p=>`${p.kind}: ${p.side??''} ${p.value}`.replace('  ',' ')).join(' and '),pair};
    out.push({id,pair,similarity,choices:[rule],support:support.length,contrast:contrast.length,predictedValue});
  }
  out.sort((a,b)=>b.predictedValue-a.predictedValue||a.choices[0]!.conditions.length-b.choices[0]!.conditions.length||compare(a.id,b.id));
  if(patternCache.size>=8)patternCache.delete(patternCache.keys().next().value!);
  patternCache.set(cacheKey,out);
  return structuredClone(out.filter(q=>!lens.answered.includes(q.id)));
}
export function answerBroadLens(lens:Lens45State,q:BroadQuestion,answer:'confirm'|'none'|'unknown',entries:readonly RatingEntry[]):Lens45State {
  if(lens.answered.includes(q.id))throw new Error('Question already answered');
  const next=structuredClone(lens);next.answered.push(q.id);
  if(answer==='confirm') {
    const f=q.choices[0]!;next.features.push(structuredClone(f));next.initialEffects[f.id]=f.effect;
  }else if(answer==='unknown') {
    const features=q.pair.map(key=>entries.find(e=>e.item.key===key)?.item.features);
    if(features.some(f=>!f))throw new Error('Question evidence missing');
    next.limitations.push({questionId:q.id,pair:q.pair,features:features as FeatureVector[]});
  }else next.rejected.push(q.choices[0]!.id);
  return next;
}
export function claimConditionsForRule(rule:LensRule):TasteClaim['conditions']|null {
  if(rule.conditions.some(p=>p.kind==='decade'))return null;
  return canonicalTasteClaimConditions(rule.conditions.map(p=>({kind:p.kind==='axis'?'feature_axis':p.kind,
    value:['director','creator','collection'].includes(p.kind)?Number(p.value):p.value,label:`${p.kind} ${p.value}`,
    ...(p.side?{side:p.side}:{})} as TasteClaimCondition)));
}
export function sharedRule(rule:LensRule):boolean {return rule.conditions.every(p=>p.kind!=='axis'&&p.kind!=='decade');}
function authoredClaim(rule:LensRule,entries:readonly RatingEntry[]):TasteClaim {
  const conditions=claimConditionsForRule(rule);if(!conditions)throw new Error('Decades are outside the existing claim language');
  const matched=entries.filter(e=>matchesTasteClaim(e.item,{conditions}));
  const support=matched.filter(e=>ratingWeight(e.rating)*rule.effect>0),counters=matched.filter(e=>ratingWeight(e.rating)*rule.effect<0);
  const supportingWeight=support.reduce((s,e)=>s+Math.abs(ratingWeight(e.rating)),0),counterexampleWeight=counters.reduce((s,e)=>s+Math.abs(ratingWeight(e.rating)),0);
  const total=supportingWeight+counterexampleWeight;
  const confidence=total?Math.min(.99,supportingWeight/total*supportingWeight/(supportingWeight+2)):0;
  const effect=rule.effect>0?'positive':'negative';
  return {id:tasteClaimId(effect,conditions),conditions,effect,confidence,provenance:'inferred',active:true,
    evidence:{supportingItemKeys:support.map(e=>e.item.key).sort(compare),counterexampleItemKeys:counters.map(e=>e.item.key).sort(compare),
      tasteSpaceClusterIds:[],supportingWeight,counterexampleWeight,matchedItemCount:matched.length}};
}
export function projectConfirmedClaims(entries:readonly RatingEntry[],base:readonly TasteClaim[],lens:Lens45State,authorMissing:boolean) {
  let claims=base.slice();const applied:string[]=[],unavailable:string[]=[];
  for(const rule of lens.features) {
    const conditions=claimConditionsForRule(rule);
    if(!conditions){unavailable.push(rule.id);continue;}
    const originalEffect=(lens.initialEffects[rule.id]??rule.effect)>0?'positive':'negative';
    const originalId=tasteClaimId(originalEffect,conditions),existing=base.find(c=>c.id===originalId);
    if(!existing&&!authorMissing){unavailable.push(rule.id);continue;}
    const claim=existing??authoredClaim({...rule,effect:originalEffect==='positive'?1:-1},entries);
    if((rule.effect>0?'positive':'negative')!==originalEffect)claims=withTasteClaimFeedback(claims,claim,'corrected',0);
    const corrected={...claim,effect:rule.effect>0?'positive' as const:'negative' as const,id:tasteClaimId(rule.effect>0?'positive':'negative',conditions)};
    claims=withTasteClaimFeedback(claims,corrected,'user_confirmed',0);applied.push(rule.id);
  }
  return {claims,applied,unavailable};
}
export function matchedStrengthClaimAdjustment(item:LensItem,lens:Lens45State):number {
  const adjustment=lens.features.filter(sharedRule).reduce((s,f)=>s+(matchesTasteClaim(item,{conditions:claimConditionsForRule(f)!})?f.effect*PERSONAL_LENS_CONFIG.strength:0),0);
  return Math.max(-PERSONAL_LENS_CONFIG.maxAdjustment,Math.min(PERSONAL_LENS_CONFIG.maxAdjustment,adjustment));
}

import { personalLensEvidence } from './personal-lens.js';
import { scoreCandidates, type ScoringParams } from './recommender.js';
import type { TmdbItem } from './tmdb/types.js';
export const LENS45_MODES = ['broad_personal','broad_shared','broad_native_claims','broad_authored_claims','broad_claims_equal_strength'] as const;
export type Lens45Mode = typeof LENS45_MODES[number];
export function scoreLens45(candidates:TmdbItem[],entries:RatingEntry[],params:ScoringParams,baseClaims:readonly TasteClaim[],lens:Lens45State,mode:Lens45Mode) {
  const safe={...params,qualityWeight:0,popularityBias:0,serendipity:0};
  const projection=projectConfirmedClaims(entries,baseClaims,lens,mode==='broad_authored_claims');
  const native=mode==='broad_native_claims'||mode==='broad_authored_claims';
  const selected=native?lens.features.filter(f=>projection.applied.includes(f.id)):
    mode==='broad_shared'||mode==='broad_claims_equal_strength'?lens.features.filter(sharedRule):lens.features;
  const evidenceLens={...lens,features:selected};
  const baseline=scoreCandidates(candidates,entries,safe,baseClaims),baseScores=new Map(baseline.map(r=>[`${r.item.medium}:${r.item.id}`,r.score]));
  const rows=native?scoreCandidates(candidates,entries,safe,projection.claims):baseline;
  return rows.map(({item,score})=>{
    const evidence=personalLensEvidence(item,entries,evidenceLens);
    if(native) {
      const matched=selected.filter(f=>matchesTasteClaim(item,{conditions:claimConditionsForRule(f)!}));
      evidence.matched=matched.map(f=>({id:f.id,label:f.label,effect:f.effect}));
      if(matched.length) evidence.confidence=matched.every(f=>f.effect===matched[0]!.effect)?0.85:0.4;
      else evidence.confidence=personalLensEvidence(item,entries,{...lens,features:[]}).confidence;
      if(evidence.limitations.length) evidence.confidence=Math.min(evidence.confidence,PERSONAL_LENS_CONFIG.limitationConfidence);
    }
    const adjustment=native?score-(baseScores.get(`${item.medium}:${item.id}`)??score):mode==='broad_claims_equal_strength'?matchedStrengthClaimAdjustment(item,lens):evidence.adjustment;
    return {item,score:native?score:score+adjustment,lens45Evidence:{...evidence,adjustment,
      unavailable:native?projection.unavailable:[],applied:native?projection.applied:selected.map(f=>f.id)}};
  }).sort((a,b)=>b.score-a.score||compare(`${a.item.medium}:${a.item.id}`,`${b.item.medium}:${b.item.id}`));
}
