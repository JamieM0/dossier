import { describe, expect, it } from 'vitest';
import { AXIS_KEYS } from './lens.js';
import { emptyContexts, readContexts, scoreContexts, type ContextState } from './contextual-taste.js';
import { createDefaultState, type RatingEntry, type Rating } from './store/model.js';
import { setLibraryRating } from './application.js';
import type { TmdbItem } from './tmdb/types.js';
const item=(id:number,x:number):TmdbItem=>({id,medium:'movie',title:`Item ${id}`,year:2000,genres:['Drama'],genreIds:[],keywords:[],overview:'',runtime:90,
 posterPath:null,voteAverage:null,voteCount:0,popularity:null,collection:null,directorIds:[],creatorIds:[],
 features:Object.fromEntries(AXIS_KEYS.map((a,i)=>[a,i===0?x:i===1?.4:0])) as TmdbItem['features']});
const entry=(id:number,x:number,rating:Rating):RatingEntry=>({item:{...item(id,x),key:`movie:${id}`},rating,ts:1700000000000});
const global=[entry(1,-.8,-2),entry(2,.8,2),entry(3,.4,1),entry(4,-.4,-1)];
const local=[entry(5,-.8,2),entry(6,.8,-2),entry(7,-.4,1),entry(8,.4,-1)];
const contexts:ContextState={version:1,contexts:[{id:'solo',name:'Solo',ratings:Object.fromEntries(local.map(e=>[e.item.key,e]))},{id:'family',name:'Family',ratings:{}}]};
const candidates=[item(90,-.7),item(91,.7)];
describe('experimental contextual taste',()=>{
 it('keeps identical evidence identical without context labels and falls back in an empty context',()=>{
  const base=scoreContexts(candidates,global,[],emptyContexts(),undefined,'shared');
  expect(scoreContexts(candidates,global,[],emptyContexts(),undefined,'global').rows.map(r=>[r.item.id,r.score])).toEqual(base.rows.map(r=>[r.item.id,r.score]));
  expect(scoreContexts(candidates,global,[],contexts,'family','shared').rows.map(r=>[r.item.id,r.score])).toEqual(base.rows.map(r=>[r.item.id,r.score]));
  expect(scoreContexts(candidates,global,[],contexts,'family','separate').available).toBe(false);
 });
 it('learns opposite contextual direction without moving another context or the global base',()=>{
  const withContext=scoreContexts(candidates,global,[],contexts,'solo','shared');
  const low=withContext.rows.find(r=>r.item.id===90)!,high=withContext.rows.find(r=>r.item.id===91)!;
  expect(low.contextEvidence.residual).toBeGreaterThan(0);expect(high.contextEvidence.residual).toBeLessThan(0);
  const changed=structuredClone(contexts);changed.contexts[0]!.ratings['movie:5']!.rating=-2;
  expect(scoreContexts(candidates,global,[],changed,'family','shared')).toEqual(scoreContexts(candidates,global,[],contexts,'family','shared'));
  expect(scoreContexts(candidates,global,[],changed,undefined,'shared')).toEqual(scoreContexts(candidates,global,[],contexts,undefined,'shared'));
  expect(scoreContexts(candidates,global,[],changed,'solo','shared').rows.find(r=>r.item.id===90)!.score).toBeLessThan(low.score);
 });
 it('uses no public signal and returns reproducible recency scores from the evidence clock',()=>{
  const contaminated=candidates.map(i=>({...i,voteAverage:10,popularity:1e8,voteCount:1e7}));
  for(const arm of ['global','recency','separate','shared'] as const)expect(scoreContexts(contaminated,global,[],contexts,'solo',arm)).toEqual(scoreContexts(candidates,global,[],contexts,'solo',arm));
  expect(scoreContexts(candidates,global,[],contexts,'solo','recency')).toEqual(scoreContexts(candidates,global,[],contexts,'solo','recency'));
 });
 it('requires enough actual ratings and does not learn taste from watchlists',()=>{
  const state=structuredClone(contexts);state.contexts[0]!.ratings=Object.fromEntries(local.slice(0,2).map(e=>[e.item.key,e]));
  let result=scoreContexts(candidates,global,[],state,'solo','shared');expect(result.rows.every(r=>r.contextEvidence.residual===0)).toBe(true);
  state.contexts[0]!.ratings['movie:8']={...local[3]!,rating:.5};
  result=scoreContexts(candidates,global,[],state,'solo','shared');expect(result.rows.every(r=>r.contextEvidence.residual===0)).toBe(true);
 });
 it('rejects invalid imported state and preserves a valid clone',()=>{
  const restored=readContexts(contexts);expect(restored).toEqual(contexts);expect(restored).not.toBe(contexts);
  expect(()=>readContexts({version:1,contexts:[contexts.contexts[0],contexts.contexts[0]]})).toThrow();
  expect(()=>readContexts({version:1,contexts:[{...contexts.contexts[0],ratings:{'movie:99':local[0]}}]})).toThrow();
  expect(()=>readContexts({version:1,contexts:[{id:'global',name:'bad',ratings:{}}]})).toThrow();
 });
 it('retains global feedback when inferring contextual claims',()=>{
  let state=createDefaultState();for(const e of global)state=setLibraryRating(state,e.item.key,e.rating,e.item,e.ts);
  expect(scoreContexts(candidates,Object.values(state.ratings),state.tasteClaims,contexts,'solo','shared').rows.every(r=>r.contextEvidence.confidence===null)).toBe(true);
 });
});
