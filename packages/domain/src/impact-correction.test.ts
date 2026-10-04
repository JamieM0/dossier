import { expect, test } from 'vitest';
import { AXIS_KEYS, type FeatureVector } from './lens.js';
import { emptyCorrections, setCorrection, scoreCorrections, type Correction } from './effective-correction.js';
import { correctionPreview, emptyCorrectionReviews, reviewCorrection } from './protected-correction.js';
import { changedRelations, impactScale, IMPACT_CONFIG, scoreImpactCorrections } from './impact-correction.js';
import type { TmdbItem } from './tmdb/types.js';
const items:TmdbItem[]=Array.from({length:24},(_,i)=>({id:i+1,medium:'movie',title:`Film ${i}`,year:2020,posterPath:null,
 overview:'',genres:['Drama'],genreIds:[],keywords:i%2?['heist']:[],directorIds:[],creatorIds:[],collection:null,
 voteAverage:null,voteCount:0,popularity:null,runtime:null,features:Object.fromEntries(AXIS_KEYS.map((a,j)=>[a,((i*(j+1)+j)%23)/23])) as FeatureVector}));
const entries=items.slice(0,12).map((item,i)=>({item:{...item,key:`movie:${item.id}`},rating:(i%3?3:-3) as 3|-3,ts:100+i}));
const rule:Correction={id:'rule',kind:'general',conditions:[{kind:'tag',value:'heist'}],effect:1};
const approve=(f:Correction)=>reviewCorrection(emptyCorrectionReviews(),f,entries,'apply',correctionPreview(f,entries).signature);
const baseline=scoreCorrections(items,entries,[],emptyCorrections(),'current');
const byId=(rows:typeof baseline)=>new Map(rows.map(r=>[r.item.id,r.score]));
test('even explicit review limits broad score influence to a fraction of baseline spread',()=>{
 const state=setCorrection(emptyCorrections(),rule),rows=scoreImpactCorrections(items,entries,[],state,approve(rule),'impact_reviewed'),base=byId(baseline);
 const bound=impactScale(baseline.map(r=>r.score))*IMPACT_CONFIG.relativeStrength;
 for(const r of rows){expect(Math.abs(r.score-base.get(r.item.id)!)).toBeLessThanOrEqual(bound+1e-12);if(!r.item.keywords.includes('heist'))expect(r.score).toBe(base.get(r.item.id));}
 const opposite={...rule,effect:-1 as const},negative=scoreImpactCorrections(items,entries,[],setCorrection(state,opposite),approve(opposite),'impact_reviewed');
 for(const r of rows.filter(r=>r.item.keywords.includes('heist')))expect(r.score).toBeGreaterThan(byId(negative).get(r.item.id)!);
 expect(byId(scoreImpactCorrections(items,entries,[],emptyCorrections(),emptyCorrectionReviews(),'impact_reviewed'))).toEqual(base);
});
test('rank limiting bounds raw and published changed relations including ties',()=>{
 const state=setCorrection(emptyCorrections(),rule),rows=scoreImpactCorrections(items,entries,[],state,approve(rule),'impact_ranked'),scores=byId(rows);
 expect(Math.max(...changedRelations(baseline.map(r=>r.score),baseline.map(r=>scores.get(r.item.id)!)))).toBeLessThanOrEqual(IMPACT_CONFIG.maximumChangedRelations);
 const same=items.map(item=>({...item,features:items[0]!.features})),sameEntries=entries.map(e=>({...e,item:{...e.item,features:items[0]!.features}}));
 const approved=reviewCorrection(emptyCorrectionReviews(),rule,sameEntries,'apply',correctionPreview(rule,sameEntries).signature);
 const tied=scoreImpactCorrections(same,sameEntries,[],state,approved,'impact_ranked');
 expect(tied.every(r=>r.correctionEvidence.impact.fraction===0)).toBe(true);
});
test('narrow exceptions and comparisons retain the original exact authority without broad feedback',()=>{
 let state=setCorrection(emptyCorrections(),{id:'title',kind:'exception',key:'movie:2',effect:-1});
 for(const [winner,loser]of [['movie:24','movie:2'],['movie:23','movie:24']])state=setCorrection(state,{id:winner,kind:'comparison',winner,loser});
 for(const arm of ['impact_guarded','impact_reviewed','impact_ranked'] as const){
  const rows=scoreImpactCorrections(items,entries,[],state,emptyCorrectionReviews(),arm);expect(byId(rows)).toEqual(byId(scoreCorrections(items,entries,[],state,'scoped')));
  const combined=setCorrection(state,rule),changed=scoreImpactCorrections(items,entries,[],combined,approve(rule),arm),scores=byId(changed);
  expect(scores.get(2)).toBeLessThan(0);expect(scores.get(24)).toBeGreaterThan(scores.get(2)!);expect(scores.get(23)).toBeGreaterThan(scores.get(24)!);
  if(arm==='impact_ranked')expect(Math.max(...changedRelations(rows.map(r=>r.score),rows.map(r=>scores.get(r.item.id)!)))).toBeLessThanOrEqual(3);
 }
});
test('overlapping preferences cannot stack past the broad limit, and pair cycles still expose conflicts',()=>{
 let state=setCorrection(emptyCorrections(),rule);state=setCorrection(state,{id:'genre',kind:'general',conditions:[{kind:'genre',value:'Drama'}],effect:-1});
 let reviews=approve(rule);const genre=state.feedback.find(f=>f.id==='genre')!;reviews=reviewCorrection(reviews,genre,entries,'apply',correctionPreview(genre,entries).signature);
 const rows=scoreImpactCorrections(items,entries,[],state,reviews,'impact_reviewed');expect(rows.some(r=>r.correctionEvidence.conflicts.length)).toBe(true);
 for(const [winner,loser]of [['movie:1','movie:2'],['movie:2','movie:3'],['movie:3','movie:1']])state=setCorrection(state,{id:winner,kind:'comparison',winner,loser});
 const cyclic=scoreImpactCorrections(items,entries,[],state,reviews,'impact_reviewed');expect(byId(cyclic)).toEqual(byId(rows));expect(cyclic.find(r=>r.item.id===1)!.correctionEvidence.conflicts).toContain('movie:1');
});
