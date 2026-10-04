import { expect, test } from 'vitest';
import { AXIS_KEYS, type FeatureVector } from './lens.js';
import { answerPersonalLens, emptyPersonalLens, lensRuleId, personalLensEvidence, personalLensQueue, readPersonalLens } from './personal-lens.js';
import type { RatingEntry } from './store/model.js';
const features=Object.fromEntries(AXIS_KEYS.map(a=>[a,.5])) as FeatureVector;
const entry=(id:number,rating:1|-1,tags:string[]):RatingEntry=>({rating,ts:id,item:{key:`movie:${id}`,id,medium:'movie',title:'Test',year:2020,posterPath:null,voteAverage:null,genres:['Drama'],keywords:tags,features}});
const entries=[entry(1,1,['practical-effects']),entry(2,-1,[]),entry(3,1,['practical-effects']),entry(4,-1,[])];
test('counterexamples propose deterministic local distinctions, including conjunctions',()=>{
 const q=personalLensQueue(entries,emptyPersonalLens());
 expect(q).toEqual(personalLensQueue(entries.slice().reverse(),emptyPersonalLens()));
 expect(q[0]!.choices.some(f=>f.id===lensRuleId([{kind:'tag',value:'practical-effects'}]))).toBe(true);
 expect(q.every(x=>x.choices.every(f=>f.conditions.length<=2))).toBe(true);
});
test('confirmation changes only matching metadata and none caps uncertainty without moving scores',()=>{
 const q=personalLensQueue(entries,emptyPersonalLens())[0]!;
 const rule=q.choices.find(f=>f.conditions.length===1&&f.conditions[0]!.kind==='tag')!;
 const lens=answerPersonalLens(emptyPersonalLens(),q,rule.id,entries);
 expect(personalLensEvidence(entries[0]!.item,entries,lens).adjustment).toBe(.3);
 expect(personalLensEvidence(entries[1]!.item,entries,lens).adjustment).toBe(0);
 expect(personalLensQueue(entries,lens).some(x=>x.id===q.id)).toBe(false);
 expect(()=>answerPersonalLens(lens,q,rule.id,entries)).toThrow();
 const unknown=answerPersonalLens(emptyPersonalLens(),q,null,entries);
 const evidence=personalLensEvidence(entries[0]!.item,entries,unknown);
 expect(evidence.adjustment).toBe(0);expect(evidence.confidence).toBeLessThanOrEqual(.35);
 expect(evidence.limitations).toEqual([q.id]);
 expect(readPersonalLens(JSON.parse(JSON.stringify(lens)))).toEqual(lens);
 expect(()=>readPersonalLens({version:1})).toThrow();
});
test('watchlist, neutral, and not-interested sentinels never become causal counterexamples',()=>{
 const ignored=entries.map((e,i)=>({...e,rating:([.5,0,-.5,0] as const)[i]!}));
 expect(personalLensQueue(ignored,emptyPersonalLens())).toEqual([]);
});
