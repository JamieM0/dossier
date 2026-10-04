import { expect, it } from 'vitest';
import { AXIS_KEYS } from '@dossier/domain';
import { parse } from '../arguments.js';
import { execute, type ActionCatalogue } from '../actions.js';
import type { CliStorage, Vault } from '../storage.js';
const item={id:1,medium:'movie' as const,title:'One title',year:2000,genres:['Drama'],genreIds:[],keywords:[],overview:'',runtime:90,
 posterPath:null,voteAverage:9,voteCount:1000,popularity:100,collection:null,directorIds:[],creatorIds:[],features:Object.fromEntries(AXIS_KEYS.map(a=>[a,.4]))};
it('keeps conflicting scoped ratings, rejects stale writes, and resets every context',async()=>{
 let vault:Vault={activeId:null,profiles:[]};
 const storage={root:'/contexts-test',load:()=>vault,save:(next:Vault)=>{vault=next;},audit:()=>{}} as unknown as CliStorage;
 const catalogue:ActionCatalogue={detail:async()=>item,candidates:async()=>[item]};
 const call=(name:string,args:Record<string,unknown>={})=>execute(storage,name,args,catalogue);
 const write=async(name:string,args:Record<string,unknown>)=>call(name,{...args,expectedRevision:(await call('profile.show') as {revision:number}).revision});
 await call('profile.create',{name:'Context test'});
 await write('context.create',{context:'solo',name:'Solo'});await write('context.create',{context:'family',name:'Family'});
 const originalClaims=structuredClone(vault.profiles[0]!.state.tasteClaims);
 await write('context.rate',{context:'solo',key:'movie:1',value:3,observedAt:100});
 await write('context.rate',{context:'family',key:'movie:1',value:-3,observedAt:101});
 const inspection=await call('context.inspect') as {contexts:{contexts:{id:string,ratings:Record<string,{rating:number}>}[]}};
 expect(inspection.contexts.contexts[0]!.ratings['movie:1']!.rating).toBe(3);
 expect(inspection.contexts.contexts[1]!.ratings['movie:1']!.rating).toBe(-3);
 expect(vault.profiles[0]!.state.ratings).toEqual({});expect(vault.profiles[0]!.state.tasteClaims).toEqual(originalClaims);
 await expect(call('context.clear',{context:'solo',key:'movie:1',expectedRevision:0})).rejects.toMatchObject({code:'STALE_REVISION'});
 await expect(write('context.create',{context:'global',name:'Reserved'})).rejects.toMatchObject({code:'INVALID_ARGUMENT'});
 await expect(call('context.suggest',{context:'missing'})).rejects.toMatchObject({code:'CONTEXT_NOT_FOUND'});
 await expect(write('context.rate',{context:'solo',key:'movie:1',value:NaN})).rejects.toMatchObject({code:'INVALID_ARGUMENT'});
 await write('context.clear',{context:'solo',key:'movie:1'});
 expect((await call('context.inspect') as typeof inspection).contexts.contexts[1]!.ratings['movie:1']!.rating).toBe(-3);
 await write('profile.reset',{yes:true});
 expect((await call('context.inspect') as typeof inspection).contexts.contexts).toEqual([]);
});

it('accepts context ratings and timestamps through the command parser',()=>{
 const parsed=parse(['context','rate','--context','solo','--key','movie:1','--value','-2','--observed-at','1700000000000']);
 expect(parsed.action).toBe('context.rate');expect(parsed.args.value).toBe(-2);expect(parsed.args.observedAt).toBe(1700000000000);
});
