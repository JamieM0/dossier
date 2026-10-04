import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { featureVector, CONTEXT_CONFIG, CONTEXT_ARMS, matchesTasteClaim } from '@dossier/domain';
import { execute } from '../dist/actions.js';
import { assess, average, distribution, key, round, shuffled } from './hard-metrics.mjs';
import { meanInterval } from './real-metrics.mjs';
const argv=process.argv.slice(2).filter(a=>a!=='--'),value=(flag,fallback)=>argv.includes(flag)?argv[argv.indexOf(flag)+1]:fallback;
const maxViewers=Number(value('--max-viewers','0')),cohortFilter=value('--cohort',null),output=value('--output','reports/contextual-taste-v1.json');
if(!Number.isSafeInteger(maxViewers)||maxViewers<0)throw new Error('Invalid viewer limit');
if(value('--protocol','contextual-taste-v1')!=='contextual-taste-v1')throw new Error('Unknown protocol');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const bytes=readFileSync('apps/dossier-cli/benchmarks/contextual-taste-v1-protocol.json'),protocol=JSON.parse(bytes);
assert.deepEqual(protocol.candidate,CONTEXT_CONFIG);assert.deepEqual(protocol.arms,CONTEXT_ARMS);
assert.equal(hash(readFileSync('apps/dossier-cli/scripts/prepare-contexts.mjs')),protocol.generatorHash);
const modelPaths=readdirSync('packages/domain/dist',{recursive:true}).filter(p=>p.endsWith('.js')&&!p.endsWith('.test.js')).map(p=>'packages/domain/dist/'+p).concat(['apps/dossier-cli/dist/actions.js']);
const evaluatorPaths=['contexts-run.mjs','contexts-report.mjs','contexts-metrics.mjs','hard-metrics.mjs','real-metrics.mjs'].map(p=>'apps/dossier-cli/scripts/'+p);
const fingerprint=paths=>hash(Buffer.concat(paths.slice().sort().flatMap(path=>[Buffer.from(path+'\n'),readFileSync(path)])));
const modelFingerprint=fingerprint(modelPaths),evaluatorFingerprint=fingerprint(evaluatorPaths);
const viewers=[];
for(const [cohort,entry] of Object.entries(protocol.fixtures)) {
 const data=readFileSync(entry.path);assert.equal(hash(data),entry.sha256);
 const fixture=JSON.parse(data),authored=['synthetic','lens4_regression','lens45_regression'].includes(cohort);
 const byKey=new Map(fixture.items.map(raw=>{
  const item={id:raw.id,medium:raw.medium,title:raw.title,year:raw.year,genres:raw.genres,genreIds:raw.genreIds??[],keywords:raw.keywords??[],
   overview:raw.overview??'',runtime:raw.runtime??null,collection:raw.collection??null,directorIds:raw.directorIds??[],creatorIds:raw.creatorIds??[],
   features:authored?raw.features:featureVector(raw),posterPath:null,voteAverage:null,voteCount:0,popularity:null};
  return [key(item),item];
 }));
 for(const [index,person] of (fixture.viewers??fixture.personas).entries()) {
  const fresh=cohort==='synthetic',label=fresh?`synthetic_${person.domain}_${person.partition}`:cohort;
  const rows=ids=>ids.map(id=>({key:id,rating:person.ratings[id],ts:1700000000000}));
  const globalEvents=fresh?person.globalEvents:person.trainingRatings?.map(r=>({key:r.filmKey,rating:r.rating,ts:1700000000000}))??rows(person.trainingKeys??fixture.trainingKeys);
  const holdoutKeys=fresh?person.holdoutKeys:person.heldOutRatings?.map(r=>r.filmKey)??person.holdoutKeys??fixture.holdoutKeys;
  const ratings=fresh?person.ratings:{global:Object.fromEntries(person.heldOutRatings?.map(r=>[r.filmKey,r.rating])??holdoutKeys.map(k=>[k,person.ratings[k]]))};
  assert(globalEvents.every(r=>!holdoutKeys.includes(r.key)));assert((person.events??[]).every(r=>!holdoutKeys.includes(r.key)));
  viewers.push({id:person.id,cohort:label,fresh,seedKey:index+1,byKey,globalEvents,events:fresh?person.events:[],holdoutKeys,truth:ratings,type:fresh?person.type:'no_context',domain:person.domain??'movies'});
 }
}
let selected=cohortFilter?viewers.filter(v=>v.cohort===cohortFilter):viewers;
if(!selected.length)throw new Error('No viewers selected');if(maxViewers)selected=selected.slice(0,maxViewers);
function client(viewer,pool=viewer.holdoutKeys) {
 let vault={activeId:null,profiles:[]},keys=pool;
 const storage={root:'/contexts-experiment',load:()=>vault,save:next=>{vault=next;},audit:()=>{}};
 const catalogue={detail:async(m,id)=>{const item=viewer.byKey.get(`${m}:${id}`);assert(item);return item;},candidates:async()=>keys.map(id=>viewer.byKey.get(id))};
 return {call:(name,args={})=>execute(storage,name,args,catalogue),state:()=>vault.profiles[0].state,setPool:next=>{keys=next;}};
}
async function write(cli,name,args={}){return cli.call(name,{...args,expectedRevision:(await cli.call('profile.show')).revision});}
async function rank(cli,arm,context) {
 const rows=[];let cursor,available;
 do {const page=await cli.call('context.suggest',{arm,...(context?{context}:{}),limit:100,...(cursor?{cursor}:{})});rows.push(...page.items);cursor=page.next;available=page.available;}while(cursor);
 assert.equal(new Set(rows.map(r=>r.id)).size,rows.length);return {rows,available};
}
function metric(result,viewer,scope) {
 const scores=Object.fromEntries(result.rows.map(r=>[r.id,r.score]));
 return {...assess(scores,viewer.holdoutKeys.map(k=>viewer.byKey.get(k)),viewer.truth[scope],result.available),
  unavailable:!result.available,meanAbsoluteResidual:average(result.rows.map(r=>Math.abs(r.contextEvidence.residual))),
  status:result.rows[0]?.contextEvidence.status??'unavailable'};
}
const equal=(a,b)=>JSON.stringify(a.rows.map(r=>[r.id,r.score]))===JSON.stringify(b.rows.map(r=>[r.id,r.score]));
async function contracts(cli,viewer,final) {
 const saved=structuredClone(cli.state()),before=await cli.call('context.inspect');
 const result={roundtrip:false,globalClaimsStable:true,scopeIsolation:true,clearRestores:true,removeRestores:true,deterministic:true,correction:null};
 for(const arm of CONTEXT_ARMS)for(const scope of ['global',...(viewer.fresh?protocol.contexts:[])]) {
  const actual=await rank(cli,arm,scope==='global'?undefined:scope);
  result.deterministic&&=equal(actual,final[arm][scope]);
 }
 const root=mkdtempSync(join(tmpdir(),'dossier-contexts-'));
 try {
  const path=join(root,'profile.dossier');await cli.call('library.export',{path,passphrase:'contexts-roundtrip'});
  const restored=client(viewer);await restored.call('profile.import',{name:'RestoredContext',path,passphrase:'contexts-roundtrip'});
  assert.deepEqual(await restored.call('context.inspect'),before);
  for(const arm of CONTEXT_ARMS)for(const scope of ['global',...(viewer.fresh?protocol.contexts:[])])assert.deepEqual(await rank(restored,arm,scope==='global'?undefined:scope),final[arm][scope]);
  result.roundtrip=true;
 }finally{rmSync(root,{recursive:true,force:true});}
 if(!viewer.fresh)return result;
 const context=before.contexts.contexts.find(c=>Object.values(c.ratings).some(r=>Math.abs(r.rating)>=1));
 if(!context)return result;
 const entry=Object.values(context.ratings).find(r=>Math.abs(r.rating)>=1);
 const aliasKey='movie:5999999',alias={...viewer.byKey.get(entry.item.key),id:5999999};
 viewer.byKey.set(aliasKey,alias);cli.setPool([...viewer.holdoutKeys,aliasKey]);
 const previous=await rank(cli,'shared',context.id);
 await write(cli,'context.rate',{context:context.id,key:entry.item.key,value:-entry.rating,observedAt:entry.ts});
 const changed=await rank(cli,'shared',context.id);
 const delta=changed.rows.find(r=>r.id===aliasKey).score-previous.rows.find(r=>r.id===aliasKey).score;
 result.correction={directional:delta*entry.rating<0,delta,key:entry.item.key,scope:context.id};
 cli.setPool(viewer.holdoutKeys);
 result.globalClaimsStable=JSON.stringify(cli.state().tasteClaims)===JSON.stringify(saved.tasteClaims);
 for(const scope of ['global',...protocol.contexts.filter(c=>c!==context.id)])result.scopeIsolation&&=equal(await rank(cli,'shared',scope==='global'?undefined:scope),final.shared[scope]);
 await write(cli,'context.clear',{context:context.id,key:entry.item.key});
 await write(cli,'context.rate',{context:context.id,key:entry.item.key,value:entry.rating,observedAt:entry.ts});
 result.clearRestores=equal(await rank(cli,'shared',context.id),final.shared[context.id]);
 await write(cli,'context.remove',{context:context.id});await write(cli,'context.create',{context:context.id,name:context.name});
 result.removeRestores=equal(await rank(cli,'shared',context.id),final.shared.global);
 Object.assign(cli.state(),saved);viewer.byKey.delete(aliasKey);return result;
}
function claimQuality(inspected,viewer) {
 let matches=0,correct=0,highMatches=0,highErrors=0;
 for(const {scope,claims}of inspected.claims)for(const claim of claims.filter(c=>c.active))for(const id of viewer.holdoutKeys) {
  if(!matchesTasteClaim(viewer.byKey.get(id),claim))continue;
  const truth=viewer.truth[scope]?.[id];if(truth===undefined)continue;
  const good=claim.effect==='positive'?truth>0:truth<0;matches++;correct+=Number(good);
  if(claim.confidence>=.8){highMatches++;highErrors+=Number(!good);}
 }
 return {matches,correct,precision:matches?correct/matches:null,highMatches,highErrors};
}
async function session(viewer,seed) {
 const cli=client(viewer);await cli.call('profile.create',{name:'ContextExperiment'});
 if(viewer.fresh)for(const context of protocol.contexts)await write(cli,'context.create',{context,name:context});
 const globals=shuffled(viewer.globalEvents,seed+viewer.seedKey*1009).slice(0,viewer.fresh?20:40);
 for(const r of globals)await write(cli,'context.rate',{context:'global',key:r.key,value:r.rating,observedAt:r.ts});
 const defaultBefore=await cli.call('suggest.list',{limit:20,dials:{qualityWeight:0}}),baseClaims=structuredClone(cli.state().tasteClaims);
 const scopes=['global',...(viewer.fresh?protocol.contexts:[])];
 const capture=async()=>{
  const out={};for(const arm of CONTEXT_ARMS){out[arm]={};for(const scope of scopes)out[arm][scope]=await rank(cli,arm,scope==='global'?undefined:scope);}return out;
 };
 const metrics=raw=>Object.fromEntries(CONTEXT_ARMS.map(arm=>[arm,Object.fromEntries(scopes.map(scope=>[scope,metric(raw[arm][scope],viewer,scope)]))]));
 const initial=await capture(),checkpoints={0:metrics(initial)},traces=[],events=[];
 const counts=Object.fromEntries(protocol.contexts.map(c=>[c,0]));
 if(viewer.fresh) {
  const perContext=protocol.contexts.map(c=>shuffled(viewer.events.filter(e=>e.context===c),seed+viewer.seedKey*521+c.length*197));
  const last=Object.fromEntries(protocol.contexts.map(c=>[c,checkpoints[0].shared[c].auc]));
  for(let index=0;index<20;index++) {
   for(let c=0;c<4;c++) {
    const event=perContext[c][index];if(!event)continue;
    await write(cli,'context.rate',{context:event.context,key:event.key,value:event.rating,observedAt:event.ts});events.push(event);counts[event.context]++;
    const now=metric(await rank(cli,'shared',event.context),viewer,event.context).auc;
    traces.push({scope:event.context,key:event.key,answer:counts[event.context],auc:now,delta:round(now-last[event.context])});last[event.context]=now;
   }
   if(protocol.budgets.includes(index+1))checkpoints[index+1]=metrics(await capture());
  }
 }
 const final=await capture(),finalMetrics=metrics(final);
 for(const budget of protocol.budgets)if(!checkpoints[budget])checkpoints[budget]=finalMetrics;
 const inspected=await cli.call('context.inspect'),contract=await contracts(cli,viewer,final);
 assert.deepEqual(cli.state().tasteClaims,baseClaims);assert.deepEqual(await cli.call('suggest.list',{limit:20,dials:{qualityWeight:0}}),defaultBefore);
 const noContextEqual=viewer.fresh?null:equal(final.shared.global,final.global.global)&&equal(final.shared.global,final.separate.global);
 // Claim scope is explicit; confidence remains a proxy, never a preference probability.
 return {seed,globalEvents:globals,events,counts,checkpoints,traces,claims:inspected.claims,claimQuality:claimQuality(inspected,viewer),contracts:contract,noContextEqual,
  profile:inspected.contexts,globalDefaultStable:true};
}
const started=performance.now(),viewerResults=[];
for(const [index,viewer]of selected.entries()) {
 assert.equal(fingerprint(modelPaths),modelFingerprint);assert.equal(fingerprint(evaluatorPaths),evaluatorFingerprint);
 const sessions=[];for(const seed of protocol.seeds)sessions.push(await session(viewer,seed));
 viewerResults.push({viewer:viewer.id,cohort:viewer.cohort,type:viewer.type,domain:viewer.domain,fresh:viewer.fresh,sessions});
 if(index%10===0||index+1===selected.length)process.stderr.write(`Experiment 5 viewers ${index+1}/${selected.length} (${viewer.cohort})\n`);
}
const { summarize, decide }=await import('./contexts-metrics.mjs');
const cohorts=Object.fromEntries([...new Set(viewerResults.map(v=>v.cohort))].map(c=>[c,summarize(viewerResults.filter(v=>v.cohort===c),protocol)]));
const typeResults=Object.fromEntries(['axis_switch','interaction_switch','stable','drift','sparse','hidden_switch'].map(t=>[t,summarize(viewerResults.filter(v=>v.fresh&&v.type===t),protocol)]));
const {candidateGates,decision}=decide(viewerResults,protocol,Boolean(maxViewers||cohortFilter));
const report={version:protocol.version,experiment:'5',protocol,protocolHash:hash(bytes),modelFingerprint,evaluatorFingerprint,
 durationSeconds:round((performance.now()-started)/1000,2),viewers:viewerResults.length,sessions:viewerResults.length*protocol.seeds.length,
 cohorts,typeResults,candidateGates,decision,viewerResults};
writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({output,viewers:report.viewers,decision,candidateGates,durationSeconds:report.durationSeconds}));
