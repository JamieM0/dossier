import { expect, test } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { AXIS_KEYS, type TmdbItem, type FeatureVector } from '@dossier/domain';
import { execute } from '../actions.js';
import type { CliStorage, Vault } from '../storage.js';
test('preview, approval, withdrawal, invalidation, and reset preserve encrypted CLI state',async()=>{
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
 const baseline=await call('suggest.list'),revision=(await call('profile.show')).revision;
 await write('correction.set',{id:'general',kind:'general',conditions:[{kind:'tag',value:'heist'}],effect:'positive'});
 const pending=await call('correction.suggest',{arm:'reviewed',includeRated:true,limit:100});
 const preview=(await call('correction.preview',{id:'general'})).preview;
 expect(preview.needsReview).toBe(true);expect((await call('profile.show')).revision).toBe(revision+1);
 await expect(write('correction.review',{id:'general',decision:'apply',signature:'old'})).rejects.toMatchObject({code:'INVALID_ARGUMENT'});
 await expect(call('correction.review',{id:'general',decision:'apply',signature:preview.signature,expectedRevision:0})).rejects.toMatchObject({code:'STALE_REVISION'});
 await write('correction.review',{id:'general',decision:'apply',signature:preview.signature});
 const applied=await call('correction.suggest',{arm:'reviewed',includeRated:true,limit:100});
 expect(applied.items.find((r:any)=>r.id==='movie:1').score).toBeGreaterThan(1);
 await write('correction.review',{id:'general',decision:'withdraw',signature:preview.signature});
 expect((await call('correction.suggest',{arm:'reviewed',includeRated:true,limit:100})).items.map((r:any)=>r.score)).toEqual(pending.items.map((r:any)=>r.score));
 await write('correction.review',{id:'general',decision:'apply',signature:preview.signature});
 expect(await call('suggest.list')).toEqual(baseline);
 const dir=mkdtempSync(join(tmpdir(),'protected-test-'));
 try {const path=join(dir,'profile.dossier');await call('library.export',{path,passphrase:'protected-test'});await call('profile.import',{path,passphrase:'protected-test',name:'Restored'});
  expect(await call('correction.suggest',{arm:'reviewed',includeRated:true,limit:100})).toEqual(applied);
 }finally{rmSync(dir,{recursive:true,force:true});}
 await write('context.rate',{context:'global',key:'movie:1',value:1,observedAt:999});
 expect((await call('correction.suggest',{arm:'reviewed',includeRated:true,limit:100})).items[0].correctionEvidence.reviews[0].reviewed).toBe(false);
 await expect(write('correction.review',{id:'general',decision:'apply',signature:preview.signature})).rejects.toMatchObject({code:'INVALID_ARGUMENT'});
 await write('profile.reset',{yes:true});expect((await call('correction.inspect')).reviews.reviews).toEqual([]);
});
