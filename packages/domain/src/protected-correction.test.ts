import { expect, test } from 'vitest';
import { AXIS_KEYS, type FeatureVector } from './lens.js';
import { emptyCorrections, setCorrection, type Correction } from './effective-correction.js';
import { correctionPreview, emptyCorrectionReviews, readCorrectionReviews, reviewCorrection, scoreProtectedCorrections } from './protected-correction.js';
import type { TmdbItem } from './tmdb/types.js';
const items:TmdbItem[]=Array.from({length:8},(_,i)=>({id:i+1,medium:'movie',title:`Film ${i}`,year:2020,posterPath:null,
 overview:'',genres:['Drama'],genreIds:[],keywords:i<4?['heist']:[],directorIds:[],creatorIds:[],collection:null,
 voteAverage:null,voteCount:0,popularity:null,runtime:null,features:Object.fromEntries(AXIS_KEYS.map(a=>[a,i<4?.9:.3])) as FeatureVector}));
const entries=items.slice(0,6).map((item,i)=>({item:{...item,key:`movie:${item.id}`},rating:(i===0?-3:3) as 3|-3,ts:100+i}));
const rule:Correction={id:'rule',kind:'general',conditions:[{kind:'tag',value:'heist'}],effect:1};
const score=(state=emptyCorrections(),reviews=emptyCorrectionReviews(),arm:'guarded'|'reviewed'='reviewed')=>Object.fromEntries(scoreProtectedCorrections(items,entries,[],state,reviews,arm).map(r=>[`movie:${r.item.id}`,r.score]));
test('a conflicting preference stays pending until its preview receives an explicit decision',()=>{
 const preview=correctionPreview(rule,entries);expect(preview.counterexamples).toEqual(['movie:1']);expect(preview.needsReview).toBe(true);
 const state=setCorrection(emptyCorrections(),rule),before=score();expect(score(state)).toEqual(before);
 const reviews=reviewCorrection(emptyCorrectionReviews(),rule,entries,'apply',preview.signature);
 expect(score(state,reviews)['movie:1']).toBeGreaterThan(0);expect(score(state,reviews)['movie:5']).toBe(before['movie:5']);
 expect(score(state,reviews,'guarded')).toEqual(before);
 const withdrawn=reviewCorrection(reviews,rule,entries,'withdraw',preview.signature);expect(score(state,withdrawn)).toEqual(before);
});
test('review cannot silently survive changed feedback or replacement of rating evidence',()=>{
 const state=setCorrection(emptyCorrections(),rule),preview=correctionPreview(rule,entries);
 const reviews=reviewCorrection(emptyCorrectionReviews(),rule,entries,'apply',preview.signature);
 const changed=entries.map(e=>({...e,ts:e.ts+1}));
 expect(()=>reviewCorrection(reviews,rule,changed,'apply',preview.signature)).toThrow(/Preview changed/);
 const rows=scoreProtectedCorrections(items,changed,[],state,reviews,'reviewed');expect(rows[0]!.correctionEvidence.reviews[0]!.reviewed).toBe(false);
 expect(()=>reviewCorrection(reviews,{...rule,effect:-1},entries,'apply',preview.signature)).toThrow();
 expect(()=>readCorrectionReviews({version:1,reviews:[{id:'x',signature:'bad',decision:'force'}]})).toThrow();
});
test('pending broad feedback preserves exact title and comparison control, correction, and removal',()=>{
 let state=setCorrection(emptyCorrections(),rule);const baseline=score(state);
 state=setCorrection(state,{id:'title',kind:'exception',key:'movie:1',effect:-1});
 expect(score(state)['movie:1']).toBeLessThan(0);
 state=setCorrection(state,{id:'title',kind:'exception',key:'movie:1',effect:1});
 expect(score(state)['movie:1']).toBeGreaterThan(0);
 state=setCorrection(state,{id:'pair',kind:'comparison',winner:'movie:8',loser:'movie:1'});
 expect(score(state)['movie:8']).toBeGreaterThan(score(state)['movie:1']!);
 state=setCorrection(state,{id:'pair',kind:'comparison',winner:'movie:1',loser:'movie:8'});
 expect(score(state)['movie:1']).toBeGreaterThan(score(state)['movie:8']!);
 expect(score(state)['movie:5']).toBe(baseline['movie:5']);expect(score()).toEqual(baseline);
});
test('reviewed general reversals honor deliberate approval in both directions',()=>{
 const positive=setCorrection(emptyCorrections(),rule),opposite={...rule,effect:-1 as const};
 const negative=setCorrection(positive,opposite);
 const a=reviewCorrection(emptyCorrectionReviews(),rule,entries,'apply',correctionPreview(rule,entries).signature);
 const b=reviewCorrection(a,opposite,entries,'apply',correctionPreview(opposite,entries).signature);
 expect(score(positive,a)['movie:1']).toBeGreaterThan(score(negative,b)['movie:1']!);
 expect(score(positive,a)['movie:5']).toBe(score(negative,b)['movie:5']);
});
