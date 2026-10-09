import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { featureVector, scoreCandidates, buildTasteSpace, reconcileTasteClaims, DEFAULT_SCORING_PARAMS, LOCAL_EVIDENCE_CONFIG, exportLibrary, importLibrary } from '@dossier/domain';
import { execute } from '../dist/actions.js';
import { key, shuffled, random, assess, round } from './hard-metrics.mjs';
import { replayLibrary } from './library-replay.mjs';
import { summarize, decision } from './learning-stability-metrics.mjs';
const args=process.argv.slice(2).filter(a=>a!=='--'),value=(f,d)=>args.includes(f)?args[args.indexOf(f)+1]:d;
const max=Number(value('--max-viewers','0')),partition=value('--partition',null),output=value('--output','reports/learning-stability-v1.json');
assert(Number.isSafeInteger(max)&&max>=0);assert(partition===null||['development','sealed'].includes(partition));
const hash=b=>createHash('sha256').update(b).digest('hex'),read=p=>JSON.parse(readFileSync(p));
const protocolPath='apps/dossier-cli/benchmarks/learning-stability-v1-protocol.json',protocol=read(protocolPath);
assert.deepEqual(protocol.candidate,LOCAL_EVIDENCE_CONFIG);
assert.equal(hash(readFileSync(protocol.fixture.path)),protocol.fixture.sha256);
assert.equal(hash(readFileSync('apps/dossier-cli/scripts/prepare-learning-stability.mjs')),protocol.generatorHash);
const sources=['packages/domain/src/local-evidence.ts','packages/domain/src/recommender.ts','apps/dossier-cli/src/actions.ts',
 'apps/dossier-cli/scripts/learning-stability-run.mjs','apps/dossier-cli/scripts/learning-stability-metrics.mjs',
 'apps/dossier-cli/scripts/hard-metrics.mjs','apps/dossier-cli/scripts/real-metrics.mjs','apps/dossier-cli/scripts/library-replay.mjs',protocolPath];
const modelPaths=readdirSync('packages/domain/dist',{recursive:true}).filter(p=>p.endsWith('.js')&&!p.endsWith('.test.js')).map(p=>'packages/domain/dist/'+p).concat(['apps/dossier-cli/dist/actions.js']);
const fingerprint=paths=>hash(Buffer.concat(paths.slice().sort().flatMap(p=>[Buffer.from(p+'\n'),readFileSync(p)])));
const freezePath='apps/dossier-cli/benchmarks/learning-stability-v1-reference.json';
if(args.includes('--freeze')){
 assert(!existsSync(freezePath),'Frozen reference already exists');
 const historical=['apps/dossier-cli/src/lab/real-tmdb-v1.json','reports/backwards-learning-diagnosis-v1.json'];
 writeFileSync(freezePath,JSON.stringify({version:protocol.version,sourceHashes:Object.fromEntries(sources.map(p=>[p,hash(readFileSync(p))])),
  modelFingerprint:fingerprint(modelPaths),historicalHashes:Object.fromEntries(historical.map(p=>[p,hash(readFileSync(p))]))},null,2)+'\n');
 console.log('Frozen implementation, evaluator, protocol, and historical inputs.');process.exit(0);
}
const reference=read(freezePath);
for(const [p,h]of Object.entries({...reference.sourceHashes,...reference.historicalHashes}))assert.equal(hash(readFileSync(p)),h,`Frozen input changed: ${p}`);
assert.equal(fingerprint(modelPaths),reference.modelFingerprint);
const fixture=read(protocol.fixture.path);
const publicItems=items=>new Map(items.map(r=>[key(r),{id:r.id,medium:r.medium,title:r.title,year:r.year,posterPath:r.posterPath,
 genres:r.genres,genreIds:r.genreIds,keywords:r.keywords,overview:r.overview,runtime:r.runtime,collection:r.collection,
 directorIds:r.directorIds,creatorIds:r.creatorIds,features:featureVector(r),voteAverage:r.voteAverage,voteCount:r.voteCount,popularity:r.popularity}]));
const byKey=publicItems(fixture.items);
function client(byKey,pool){
 let vault={profiles:[],activeId:null};const storage={root:'/learning-stability-lab',load:()=>vault,save:v=>{vault=v},audit:()=>{}};
 const catalogue={detail:async(m,id)=>{const item=byKey.get(`${m}:${id}`);assert(item);return item;},candidates:async()=>pool.map(k=>byKey.get(k))};
 return {call:(name,args={})=>execute(storage,name,args,catalogue),state:()=>vault.profiles[0].state};
}
const options=(arm,time)=>arm==='current'?{}:arm.startsWith('canonical')?{geometry:arm}:{localEvidence:arm==='local'?'timeless':'recent',referenceTime:time};
async function rank(cli,arm,time){const rows=[];let cursor;
 do{const page=await cli.call('suggest.list',{limit:200,...options(arm,time),...(cursor?{cursor}:{})});rows.push(...page.items);cursor=page.next;}while(cursor);
 return rows;
}
const scoreMap=rows=>Object.fromEntries(rows.map(r=>[r.id,r.score]));
async function capture(cli,byKey,pool,truth,time){
 const measures={},scores={},parity={},original=structuredClone(cli.state());
 for(const arm of protocol.arms){
  const rows=await rank(cli,arm,time);scores[arm]=scoreMap(rows);
  measures[arm]=assess(scores[arm],pool.map(k=>byKey.get(k)),truth,rows.length>0);
  const strategy=arm.startsWith('canonical')?arm:'greedy',entries=Object.values(cli.state().ratings);
  const claims=strategy==='greedy'?cli.state().tasteClaims:reconcileTasteClaims(entries,cli.state().tasteClaims,buildTasteSpace(entries,{clusterStrategy:strategy}));
  const expected=scoreCandidates(pool.map(k=>byKey.get(k)),entries,DEFAULT_SCORING_PARAMS,claims,
   {...(strategy!=='greedy'?{clusterStrategy:strategy}:{}),...(arm.startsWith('local')?{localEvidence:arm==='local'?'timeless':'recent',referenceTime:time}:{})});
  assert.deepEqual(scores[arm],Object.fromEntries(expected.map(r=>[key(r.item),Math.round(r.score*1000)/1000])));parity[arm]=true;
 }
 assert.deepEqual(cli.state(),original,'Experimental reads changed the library');
 return {measures,scores,parity};
}
async function rate(cli,event){
 await cli.call(event.rating===null?'rate.clear':'rate.set',{key:event.key,...(event.rating===null?{}:{value:event.rating}),expectedRevision:(await cli.call('profile.show')).revision});
 if(event.rating!==null)cli.state().ratings[event.key].ts=event.ts;
}
async function session(v,seed){
 const cli=client(byKey,v.holdoutKeys);await cli.call('profile.create',{name:'Learning stability viewer'});
 const order=shuffled(v.trainingKeys,v.seed+seed).slice(0,60),rng=random(v.seed+seed+981),events=[],steps=[];
 let previous=null;
 for(let count=1;count<=60;count++){
  const k=order[count-1],truth=v.type==='changing_taste'&&count<=30?v.oldRatings:v.ratings;
  const event={key:k,rating:(rng()<v.noise?-truth[k]:truth[k])||0,ts:protocol.clock.start+count*protocol.clock.stepDays*86400000};
  assert(!v.holdoutKeys.includes(k));events.push(event);await rate(cli,event);
  const result=await capture(cli,byKey,v.holdoutKeys,v.ratings,event.ts);
  steps.push({count,event,...result,deltas:Object.fromEntries(protocol.arms.map(a=>[a,previous?round(result.measures[a].auc-previous.measures[a].auc):0]))});previous=result;
 }
 assert.deepEqual(cli.state().ratings,replayLibrary(events,byKey).ratings);
 const time=events.at(-1).ts,saved=structuredClone(cli.state());
 const finalScores=previous.scores,ordering={};
 const imported=await importLibrary(await exportLibrary(saved,'stability-roundtrip'),'stability-roundtrip');
 assert.deepEqual(imported,saved);
 Object.assign(cli.state(),imported);
 assert.deepEqual((await capture(cli,byKey,v.holdoutKeys,v.ratings,time)).scores,finalScores);
 for(const arm of protocol.arms)ordering[arm]=[];
 for(let i=0;i<protocol.permutations;i++){
  cli.state().ratings=Object.fromEntries(shuffled(Object.entries(saved.ratings),seed+i*101));
  const result=await capture(cli,byKey,v.holdoutKeys,v.ratings,time);
  for(const arm of protocol.arms)ordering[arm].push({scores:result.scores[arm],auc:result.measures[arm].auc});
 }
 cli.state().ratings=structuredClone(saved.ratings);
 const orderResults=Object.fromEntries(protocol.arms.map(a=>[a,{scoreSignatures:new Set(ordering[a].map(x=>JSON.stringify(Object.entries(x.scores).sort()))).size,
  aucSpread:round(Math.max(...ordering[a].map(x=>x.auc))-Math.min(...ordering[a].map(x=>x.auc)))}]));
 const k=order[0],original=saved.ratings[k];
 const rerating={key:k,rating:original.rating===0?2:-original.rating,ts:time+86400000};
 await rate(cli,rerating);const overwritten=cli.state().ratings[k].rating===rerating.rating&&Object.keys(cli.state().ratings).length===60;
 await rate(cli,{key:k,rating:null});const cleared=!(k in cli.state().ratings);
 await rate(cli,{key:k,rating:original.rating,ts:original.ts});
 const restored=await capture(cli,byKey,v.holdoutKeys,v.ratings,time);
 // Claim reconciliation is intentionally history-dependent; scorer reversibility fixes stored claims.
 const claimHistoryChanged=JSON.stringify(cli.state().tasteClaims)!==JSON.stringify(saved.tasteClaims);
 cli.state().tasteClaims=structuredClone(saved.tasteClaims);
 const restoredWithClaims=await capture(cli,byKey,v.holdoutKeys,v.ratings,time);
 return {seed,events,steps,order:orderResults,claimHistoryChanged,
  scorerRestoration:Object.fromEntries(protocol.arms.map(a=>[a,JSON.stringify(restoredWithClaims.scores[a])===JSON.stringify(finalScores[a])])),
  contracts:{overwrite:overwritten,clear:cleared,portability:true,readOnly:true,cliParity:steps.every(x=>Object.values(x.parity).every(Boolean))},
  finalProfile:saved,restorationScores:restored.scores};
}
async function historicalFailures(){
 const frozen=read('apps/dossier-cli/src/lab/real-tmdb-v1.json'),catalogue=publicItems(frozen.items),diagnosis=read('reports/backwards-learning-diagnosis-v1.json'),results=[];
 for(const target of diagnosis.cases){
  const v=frozen.viewers.find(v=>v.id===target.viewer),training=new Map(v.trainingRatings.map(r=>[r.filmKey,r.rating]));
  const pool=v.heldOutRatings.map(r=>r.filmKey),truth=Object.fromEntries(v.heldOutRatings.map(r=>[r.filmKey,r.rating]));
  const order=shuffled([...training.keys()],target.seed+v.sourceUserId*1009),cli=client(catalogue,pool);await cli.call('profile.create',{name:'Historical stability failure'});
  const steps=[];let previous=null;
  for(let count=1;count<=40;count++){
   const event={key:order[count-1],rating:training.get(order[count-1]),ts:protocol.clock.start+count*protocol.clock.stepDays*86400000};assert(!pool.includes(event.key));await rate(cli,event);
   if(count<10)continue;
   const result=await capture(cli,catalogue,pool,truth,event.ts);
   steps.push({count,...result,deltas:Object.fromEntries(protocol.arms.map(a=>[a,previous?round(result.measures[a].auc-previous.measures[a].auc):0]))});previous=result;
  }
  assert.equal(steps[0].measures.current.auc,target.auc10);assert.equal(steps.at(-1).measures.current.auc,target.auc40);
  results.push({viewer:target.viewer,seed:target.seed,steps,arms:Object.fromEntries(protocol.arms.map(a=>[a,{auc10:steps[0].measures[a].auc,
   auc40:steps.at(-1).measures[a].auc,change:round(steps.at(-1).measures[a].auc-steps[0].measures[a].auc),
   gainCurrent40:round(steps.at(-1).measures[a].auc-steps.at(-1).measures.current.auc),worstStep:round(Math.min(...steps.slice(1).map(x=>x.deltas[a])))}]))});
 }
 return results;
}
const started=performance.now(),selected=(partition?fixture.viewers.filter(v=>v.partition===partition):fixture.viewers).slice(0,max||undefined),viewerResults=[];
for(const [i,v]of selected.entries()){
 assert(v.trainingKeys.every(k=>!v.holdoutKeys.includes(k)));
 const sessions=[];for(const seed of protocol.seeds)sessions.push(await session(v,seed));
 viewerResults.push({viewer:v.id,partition:v.partition,type:v.type,sessions});
 if(i%10===0||i+1===selected.length)process.stderr.write(`Learning stability ${i+1}/${selected.length} (${v.partition})\n`);
}
const failures=max||partition?[]:await historicalFailures();
assert.equal(fingerprint(modelPaths),reference.modelFingerprint);
const report={version:protocol.version,protocol,protocolHash:hash(readFileSync(protocolPath)),referenceHash:hash(readFileSync(freezePath)),
 durationSeconds:round((performance.now()-started)/1000,2),viewers:viewerResults.length,sessions:viewerResults.length*protocol.seeds.length,
 cohorts:Object.fromEntries(['development','sealed'].map(p=>[p,summarize(viewerResults.filter(v=>v.partition===p),protocol)])),
 types:Object.fromEntries([...new Set(viewerResults.map(v=>v.type))].map(t=>[t,summarize(viewerResults.filter(v=>v.partition==='sealed'&&v.type===t),protocol)])),
 failures,...decision(viewerResults,failures,protocol,Boolean(max||partition)),viewerResults};
writeFileSync(output,JSON.stringify(report,null,2)+'\n');writeFileSync(output+'.gz',gzipSync(readFileSync(output),{level:9}));
console.log(JSON.stringify({output,viewers:report.viewers,duration:report.durationSeconds,decision:report.decision,candidateGates:report.candidateGates}));
