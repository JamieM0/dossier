import { expect, test } from 'vitest';
import { AXIS_KEYS, type FeatureVector, type TmdbItem, type RatingEntry, registry } from '@dossier/domain';
import { rankExperimentalQuestions, recognitionEstimate } from './question-policy.js';
import { execute } from '../actions.js';
import type { CliStorage, Vault } from '../storage.js';
const items:TmdbItem[]=Array.from({length:35},(_,i)=>({id:i+1,medium:'movie',title:`Title ${i}`,year:2000+i,posterPath:null,overview:'',genreIds:[],genres:[i%2?'Drama':'Comedy'],keywords:[],voteAverage:null,voteCount:0,popularity:null,runtime:null,collection:null,directorIds:[],creatorIds:[],features:Object.fromEntries(AXIS_KEYS.map((axis,j)=>[axis,Math.sin((i+1)*(j+1))])) as FeatureVector}));
const entries:RatingEntry[]=items.slice(0,10).map((item,i)=>({item:{...item,key:`movie:${item.id}`},rating:i%2?-2:2,ts:0}));
test('selection ignores public fields, is deterministic, and leaves its evidence intact',()=>{
 const candidates=items.slice(10),before=JSON.stringify({entries,candidates});
 for(const policy of ['balanced_random','disagreement','counterfactual'] as const){
  const first=rankExperimentalQuestions(candidates,entries,[],[],policy,83,false);
  expect(rankExperimentalQuestions(candidates,entries,[],[],policy,83,false)).toEqual(first);
  const changed=rankExperimentalQuestions(candidates.map(i=>({...i,voteAverage:10,popularity:999999,voteCount:99999})),entries,[],[],policy,83,false);
  expect(changed.questions.map(q=>[q.item.id,q.predictedValue,q.disagreement,q.recognition])).toEqual(first.questions.map(q=>[q.item.id,q.predictedValue,q.disagreement,q.recognition]));
 }
 expect(JSON.stringify({entries,candidates})).toBe(before);
});
test('unanimous identical profiles have zero uncertainty and can stop without inventing evidence',()=>{
 const evidence=entries.map(e=>({...e,item:{...e.item,features:items[0]!.features},rating:2 as const}));
 const candidates=items.slice(10).map(i=>({...i,features:items[0]!.features}));
 const stop=rankExperimentalQuestions(candidates,evidence,[],[],'counterfactual',11);
 expect(stop.uncertainty).toBe(0);
 expect(stop.stopped).toBe(true);
 expect(stop.questions).toEqual([]);
 expect(rankExperimentalQuestions(candidates,evidence,[],[],'counterfactual',11,false).questions).toHaveLength(6);
});
test('recognition estimates learn from explicit skips and ratings rather than hidden familiarity',()=>{
 const item=items[0]!;
 expect(recognitionEstimate(item,[],[item])).toBeLessThan(recognitionEstimate(item,[],[]));
 expect(recognitionEstimate(item,[entries[0]!],[])).toBeGreaterThan(recognitionEstimate(item,[],[]));
});
test('CLI question experiments preserve defaults, corrected claims, skips, and profile revisions',async()=>{
 let vault:Vault={activeId:null,profiles:[]};
 const storage={root:'/question-cli-test',load:()=>vault,save:(v:Vault)=>{vault=v;},audit:()=>{}} as unknown as CliStorage;
 const catalogue={detail:async(_medium:unknown,id:number)=>items[id-1]!,candidates:async()=>items};
 const call=(name:string,args:Record<string,unknown>={})=>execute(storage,name,args,catalogue) as Promise<any>;
 let revision=(await call('profile.create',{name:'Question test'})).revision;
 for(const entry of entries)revision=(await call('rate.set',{key:entry.item.key,value:entry.rating,expectedRevision:revision})).revision;
 const defaultQueue=await call('rate.queue',{mode:'active',limit:5});
 const stateBefore=JSON.stringify(vault);
 for(const policy of ['balanced_random','disagreement','counterfactual']){
  const args={mode:'active',questionPolicy:policy,questionSeed:47,questionStop:false,limit:5};
  const result=await call('rate.queue',args);
  expect(await call('rate.queue',args)).toEqual(result);
  expect(result.items).toHaveLength(5);
  expect(result.items.every((q:any)=>!vault.profiles[0]!.state.ratings[q.id])).toBe(true);
 }
 expect(JSON.stringify(vault)).toBe(stateBefore);
 expect(await call('rate.queue',{mode:'active',limit:5})).toEqual(defaultQueue);
 revision=(await call('rate.skip',{key:'movie:11',expectedRevision:revision})).revision;
 expect((await call('rate.queue',{questionPolicy:'balanced_random',limit:100})).items.some((q:any)=>q.id==='movie:11')).toBe(false);
 const existing=vault.profiles[0]!.state.tasteClaims[0];
 expect(existing).toBeDefined();
 if(existing){
  vault.profiles[0]!.state.tasteClaims[0]={...existing,active:false,provenance:'rejected',feedbackAt:0};
  revision=(await call('rate.set',{key:'movie:12',value:3,expectedRevision:revision})).revision;
  expect(vault.profiles[0]!.state.tasteClaims.find(c=>c.id===existing.id)).toMatchObject({active:false,provenance:'rejected'});
 }
 await expect(call('rate.queue',{questionPolicy:'typo'})).rejects.toMatchObject({code:'INVALID_ARGUMENT'});
 await expect(call('rate.queue',{questionPolicy:'disagreement',questionSeed:-1})).rejects.toMatchObject({code:'INVALID_ARGUMENT'});
 expect(await call('rate.queue',{questionPolicy:'counterfactual',questionStop:'false',questionSeed:47})).toEqual(await call('rate.queue',{questionPolicy:'counterfactual',questionStop:false,questionSeed:47}));
 await expect(call('rate.queue',{questionPolicy:'counterfactual',questionStop:'invalid'})).rejects.toMatchObject({code:'INVALID_ARGUMENT'});
 expect(registry.find(a=>a.name==='rate.queue')!.schema.properties.questionStop!.type).toBe('boolean');
 expect(registry.find(a=>a.name==='suggest.list')!.args).not.toContain('questionPolicy');
 expect(registry.find(a=>a.name==='rate.queue')!.schema.required).not.toContain('questionPolicy');
});
