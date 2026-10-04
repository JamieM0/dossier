import { expect, test } from 'vitest';
import { AXIS_KEYS, type FeatureVector } from './lens.js';
import { buildTasteSpace } from './taste-space.js';
import { learnRefineMetric, type RefineMetricMode } from './refine-metric.js';
import { scoreCandidates, DEFAULT_SCORING_PARAMS } from './recommender.js';
import type { RatingEntry, PairwiseChoice } from './store/model.js';
import type { TmdbItem } from './tmdb/types.js';
const f=(pacing:number,tone:number):FeatureVector=>Object.fromEntries(AXIS_KEYS.map(axis=>[axis,axis==='pacing'?pacing:axis==='tone'?tone:0])) as FeatureVector;
const entries:RatingEntry[]=[[1,.2],[.8,.4],[.5,.7],[.1,1]].map(([pacing,tone],i)=>({rating:3,ts:i,item:{key:`movie:${i+1}`,id:i+1,medium:'movie',title:String(i),year:null,posterPath:null,voteAverage:null,genres:[],keywords:[],features:f(pacing!,tone!)}}));
const choices:PairwiseChoice[]=[{winnerKey:'movie:1',loserKey:'movie:4',ts:1},{winnerKey:'movie:2',loserKey:'movie:3',ts:2},{winnerKey:'movie:1',loserKey:'movie:3',ts:3}];
const clusters=buildTasteSpace(entries).clusters;
for(const mode of ['axis_metric','axis_cluster_metric'] as RefineMetricMode[]) {
 test(`${mode} is an exact no-op with insufficient independent evidence`,()=>{
  for(const pairwise of [[],choices.slice(0,2)]) {
   const result=learnRefineMetric(entries,pairwise,clusters,mode);
   expect(result.learned).toBe(false);
   expect(Object.values(result.axisWeights)).toEqual(AXIS_KEYS.map(()=>1));
   expect(Object.values(result.clusterWeights).every(w=>w===1)).toBe(true);
  }
 });
 test(`${mode} learns bounded weights and is independent of constraint arrival order`,()=>{
  const model=learnRefineMetric(entries,choices,clusters,mode);
  expect(model.learned).toBe(true);
  expect(Object.values(model.axisWeights).some(w=>Math.abs(w-1)>.001)).toBe(true);
  expect(Object.values(model.axisWeights).every(w=>w>=.25&&w<=4)).toBe(true);
  expect(Object.values(model.clusterWeights).every(w=>w>=.5&&w<=2)).toBe(true);
  expect(learnRefineMetric(entries,[...choices].reverse(),clusters,mode)).toEqual(model);
 });
 test(`${mode} replaces an old choice and ignores removed items`,()=>{
  const correction={winnerKey:'movie:4',loserKey:'movie:1',ts:4};
  const corrected=learnRefineMetric(entries,[...choices,correction],clusters,mode);
  expect(corrected.comparisons).toBe(3);
  expect(corrected).toEqual(learnRefineMetric(entries,[correction,...choices.slice(1)],clusters,mode));
  expect(corrected.axisWeights).not.toEqual(learnRefineMetric(entries,choices,clusters,mode).axisWeights);
  expect(learnRefineMetric(entries.slice(0,3),choices,buildTasteSpace(entries.slice(0,3)).clusters,mode).learned).toBe(false);
 });
}
test('experiment is opt-in and does not read public metadata during fit',()=>{
 const poison=entries.map(entry=>({...entry,item:{...entry.item,get voteAverage():number {throw new Error('Public score leaked');}}}));
 expect(()=>learnRefineMetric(poison,choices,buildTasteSpace(poison).clusters,'axis_metric')).not.toThrow();
 const candidate={...entries[0]!.item,id:99,genreIds:[],popularity:0,voteCount:0,overview:'',runtime:null,features:f(.4,.6)} as TmdbItem;
 const params={...DEFAULT_SCORING_PARAMS,qualityWeight:0};
 expect(scoreCandidates([candidate],entries,params,[],{pairwise:choices})).toEqual(scoreCandidates([candidate],entries,params));
 expect(scoreCandidates([candidate],entries,params,[],{refineMetric:'axis_metric',pairwise:[]})).toEqual(scoreCandidates([candidate],entries,params));
});
