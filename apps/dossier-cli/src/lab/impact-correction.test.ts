import { expect, test } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { AXIS_KEYS, type TmdbItem, type FeatureVector } from '@dossier/domain';
import { execute } from '../actions.js';
import type { CliStorage, Vault } from '../storage.js';
test('impact CLI policies preserve defaults, exact narrow controls, and encrypted policy scores',async()=>{
 const items:TmdbItem[]=Array.from({length:12},(_,i)=>({id:i+1,medium:'movie',title:`Film ${i}`,year:2020,posterPath:null,
  genres:['Drama'],genreIds:[],keywords:i%2?[]:['heist'],overview:'',runtime:null,collection:null,directorIds:[],creatorIds:[],
  voteAverage:null,voteCount:0,popularity:null,features:Object.fromEntries(AXIS_KEYS.map((a,j)=>[a,((i*(j+1)+j)%11)/11])) as FeatureVector}));
 let vault:Vault={profiles:[],activeId:null};
 const storage={root:'/impact-test',load:()=>vault,save:(v:Vault)=>{vault=v},audit:()=>{}} as unknown as CliStorage;
 const api={detail:async(_m:unknown,id:number)=>items[id-1]!,candidates:async()=>items};
 const call=(name:string,args:Record<string,unknown>={})=>execute(storage,name,args,api) as Promise<any>;
 const write=async(name:string,args:Record<string,unknown>)=>call(name,{...args,expectedRevision:(await call('profile.show')).revision});
 await call('profile.create',{name:'Impact'});
 for(let id=1;id<=8;id++)await write('context.rate',{context:'global',key:`movie:${id}`,value:id%3?1:-1,observedAt:100+id});
 const normal=await call('suggest.list');
 await write('correction.set',{id:'general',kind:'general',conditions:[{kind:'tag',value:'heist'}],effect:'positive'});
 const preview=(await call('correction.preview',{id:'general'})).preview;
 await write('correction.review',{id:'general',decision:'apply',signature:preview.signature});
 await write('correction.set',{id:'title',kind:'exception',key:'movie:1',effect:'negative'});
 await write('correction.set',{id:'pair',kind:'comparison',winner:'movie:2',loser:'movie:1'});
 const arms=['impact_guarded','impact_reviewed','impact_ranked'],before=await Promise.all(arms.map(arm=>call('correction.suggest',{arm,includeRated:true,limit:100})));
 for(const [i,b]of before.entries()){
  expect(b.items.find((r:any)=>r.id==='movie:1').score).toBeLessThan(0);
  expect(b.items.find((r:any)=>r.id==='movie:2').score).toBeGreaterThan(b.items.find((r:any)=>r.id==='movie:1').score);
  expect(b.items.every((r:any)=>Math.abs(r.correctionEvidence.impact.generalDelta)<=r.correctionEvidence.impact.maximumGeneralDelta+1e-12)).toBe(true);
  if(i===2)expect(b.items.every((r:any)=>r.correctionEvidence.impact.changedRelations<=3)).toBe(true);
 }
 expect(await call('suggest.list')).toEqual(normal);
 const dir=mkdtempSync(join(tmpdir(),'impact-test-'));
 try{const path=join(dir,'profile.dossier');await call('library.export',{path,passphrase:'impact-test'});await call('profile.import',{path,passphrase:'impact-test',name:'Restored'});
  expect(await Promise.all(arms.map(arm=>call('correction.suggest',{arm,includeRated:true,limit:100})))).toEqual(before);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
