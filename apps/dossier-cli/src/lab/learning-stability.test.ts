import { expect, test } from 'vitest';
import { AXIS_KEYS, type TmdbItem } from '@dossier/domain';
import { execute } from '../actions.js';
import type { CliStorage, Vault } from '../storage.js';
test('local evidence is opt-in, read-only, and rejects incompatible experiment flags', async () => {
 const items = Array.from({length:6}, (_,i) => ({id:i+1,medium:'movie',title:`Film ${i}`,year:2000,genres:['Drama'],genreIds:[],keywords:[],overview:'',posterPath:null,runtime:90,voteAverage:7,voteCount:10,popularity:20,
  features:Object.fromEntries(AXIS_KEYS.map((axis,j)=>[axis,j===0?1:(i+j)%3/3]))})) as TmdbItem[];
 let vault:Vault={profiles:[],activeId:null};
 const storage={root:'/stability-test',load:()=>vault,save:(v:Vault)=>{vault=v},audit:()=>{}} as unknown as CliStorage;
 const catalogue={detail:async(_m:unknown,id:number)=>items[id-1]!,candidates:async()=>items};
 const call=(name:string,args:Record<string,unknown>={})=>execute(storage,name,args,catalogue) as Promise<any>;
 await call('profile.create',{name:'Stability'});
 for(const [id,value] of [[1,2],[2,-2]])await call('rate.set',{key:`movie:${id}`,value,expectedRevision:(await call('profile.show')).revision});
 const normal=await call('suggest.list'),saved=structuredClone(vault);
 expect((await call('suggest.list',{localEvidence:'timeless'})).items).toHaveLength(4);
 expect((await call('suggest.list',{localEvidence:'recent',referenceTime:1700000000000})).items).toHaveLength(4);
 expect(vault).toEqual(saved);expect(await call('suggest.list')).toEqual(normal);
 for(const args of [{localEvidence:'invalid'},{localEvidence:'timeless',geometry:'canonical_greedy'},
  {localEvidence:'timeless',refineMetric:'axis_metric'},{localEvidence:'recent',referenceTime:NaN},{referenceTime:1}]){
  await expect(call('suggest.list',args)).rejects.toMatchObject({code:'INVALID_ARGUMENT'});
 }
});
