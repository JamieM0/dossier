import { expect, test } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { AXIS_KEYS, type TmdbItem, type FeatureVector } from '@dossier/domain';
import { execute } from '../actions.js';
import type { CliStorage, Vault } from '../storage.js';
test('CLI corrections preserve defaults, overwrite evidence, revisions, and encrypted portability',async()=>{
 const items:TmdbItem[]=Array.from({length:8},(_,i)=>({id:i+1,medium:'movie',title:`Film ${i}`,year:2020,posterPath:null,
  genres:['Drama'],genreIds:[],keywords:i%2?[]:['heist'],overview:'',runtime:null,collection:null,directorIds:[],creatorIds:[],
  voteAverage:null,voteCount:0,popularity:null,features:Object.fromEntries(AXIS_KEYS.map(a=>[a,.4])) as FeatureVector}));
 let vault:Vault={profiles:[],activeId:null};
 const storage={root:'/effective-test',load:()=>vault,save:(v:Vault)=>{vault=v},audit:()=>{}} as unknown as CliStorage;
 const api={detail:async(_m:unknown,id:number)=>items[id-1]!,candidates:async()=>items};
 const call=(name:string,args:Record<string,unknown>={})=>execute(storage,name,args,api) as Promise<any>;
 const write=async(name:string,args:Record<string,unknown>)=>call(name,{...args,expectedRevision:(await call('profile.show')).revision});
 await call('profile.create',{name:'Correction'});
 for(let id=1;id<=4;id++)await write('context.rate',{context:'global',key:`movie:${id}`,value:id%2?1:-1,observedAt:100+id});
 await write('context.rate',{context:'global',key:'movie:1',value:-3,observedAt:200});
 expect(Object.keys(vault.profiles[0]!.state.ratings)).toHaveLength(4);
 expect(vault.profiles[0]!.state.ratings['movie:1']!.rating).toBe(-3);
 const baseline=await call('suggest.list');
 await write('correction.set',{id:'title',kind:'exception',key:'movie:1',effect:'positive'});
 await write('correction.set',{id:'pair',kind:'comparison',winner:'movie:1',loser:'movie:2'});
 const before=await call('correction.suggest',{arm:'scoped',includeRated:true,limit:100});
 expect(before.items.find((r:any)=>r.id==='movie:1').score).toBeGreaterThan(before.items.find((r:any)=>r.id==='movie:2').score);
 expect(await call('suggest.list')).toEqual(baseline);
 await expect(call('correction.set',{id:'stale',kind:'exception',key:'movie:1',effect:'negative',expectedRevision:0})).rejects.toMatchObject({code:'STALE_REVISION'});
 await expect(write('correction.set',{id:'unrated',kind:'exception',key:'movie:8',effect:'negative'})).rejects.toMatchObject({code:'INVALID_ARGUMENT'});
 const dir=mkdtempSync(join(tmpdir(),'effective-test-'));
 try{const path=join(dir,'profile.dossier');await call('library.export',{path,passphrase:'test-effective'});
  await call('profile.import',{path,passphrase:'test-effective',name:'Restored'});
  expect(await call('correction.suggest',{arm:'scoped',includeRated:true,limit:100})).toEqual(before);
 }finally{rmSync(dir,{recursive:true,force:true});}
 await write('correction.remove',{id:'title'});await write('correction.remove',{id:'pair'});
 expect((await call('correction.inspect')).corrections.feedback).toEqual([]);
 await write('profile.reset',{yes:true});
 expect((await call('correction.inspect')).corrections.feedback).toEqual([]);
 await expect(call('correction.suggest',{arm:'fake'})).rejects.toMatchObject({code:'INVALID_ARGUMENT'});
});
