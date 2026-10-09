import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { writeCorroborationReport } from './corroboration-io.mjs';
import { featureVector, scoreCandidates, DEFAULT_SCORING_PARAMS, exportLibrary, importLibrary } from '@dossier/domain';
import { execute } from '../dist/actions.js';
import { key, shuffled, assess, round } from './hard-metrics.mjs';
import { replayLibrary } from './library-replay.mjs';
import { CORROBORATION_CONFIG, CORROBORATION_ARMS, createCorroborationScorer } from './corroboration-policy.mjs';
import { summarizeCorroboration, corroborationDecision } from './corroboration-metrics.mjs';
const args=process.argv.slice(2).filter(a=>a!=='--'),value=(f,d)=>args.includes(f)?args[args.indexOf(f)+1]:d;
const max=Number(value('--max-viewers','0')),partition=value('--partition',null),output=value('--output','reports/corroboration-v1.json');
assert(Number.isSafeInteger(max)&&max>=0);assert(partition===null||['development','sealed','confirmation'].includes(partition));
const hash=b=>createHash('sha256').update(b).digest('hex'),read=p=>JSON.parse(readFileSync(p));
const protocolPath='apps/dossier-cli/benchmarks/corroboration-v1-protocol.json',protocol=read(protocolPath);
assert.deepEqual(protocol.candidate,CORROBORATION_CONFIG);assert.deepEqual(protocol.arms,CORROBORATION_ARMS);
assert.equal(hash(readFileSync(protocol.fixture.path)),protocol.fixture.sha256);
assert.equal(hash(readFileSync('apps/dossier-cli/scripts/prepare-corroboration.mjs')),protocol.generatorHash);
const sources=['apps/dossier-cli/scripts/corroboration-policy.mjs','apps/dossier-cli/scripts/corroboration-run.mjs',
  'apps/dossier-cli/scripts/corroboration-metrics.mjs','apps/dossier-cli/scripts/hard-metrics.mjs','apps/dossier-cli/scripts/real-metrics.mjs',
  'apps/dossier-cli/scripts/library-replay.mjs',protocolPath];
const modelPaths=readdirSync('packages/domain/dist',{recursive:true}).filter(p=>p.endsWith('.js')&&!p.endsWith('.test.js')).map(p=>'packages/domain/dist/'+p).concat(['apps/dossier-cli/dist/actions.js']);
const fingerprint=paths=>hash(Buffer.concat(paths.slice().sort().flatMap(p=>[Buffer.from(p+'\n'),readFileSync(p)])));
const earlier=read('apps/dossier-cli/benchmarks/learning-stability-v1-reference.json');
for(const [p,h]of Object.entries({...earlier.sourceHashes,...earlier.historicalHashes}))assert.equal(hash(readFileSync(p)),h,`Earlier frozen input changed: ${p}`);
assert.equal(fingerprint(modelPaths),earlier.modelFingerprint,'Product model changed since stability experiment');
const freezePath='apps/dossier-cli/benchmarks/corroboration-v1-reference.json';
if(args.includes('--freeze')){
  assert(!existsSync(freezePath),'Frozen reference already exists');
  const historical=['apps/dossier-cli/src/lab/real-tmdb-v1.json','reports/backwards-learning-diagnosis-v1.json',
    'apps/dossier-cli/benchmarks/learning-stability-v1-reference.json','reports/learning-stability-v1.json.gz'];
  writeFileSync(freezePath,JSON.stringify({version:protocol.version,sourceHashes:Object.fromEntries(sources.map(p=>[p,hash(readFileSync(p))])),
    modelFingerprint:fingerprint(modelPaths),historicalHashes:Object.fromEntries(historical.map(p=>[p,hash(readFileSync(p))]))},null,2)+'\n');
  console.log('Frozen candidate, evaluator, earlier evidence, and unchanged product model.');process.exit(0);
}
const reference=read(freezePath);
const amendmentPath='apps/dossier-cli/benchmarks/corroboration-v1-output-amendment.json',amendment=read(amendmentPath);
assert.equal(amendment.referenceHash,hash(readFileSync(freezePath)));
for(const [p,h]of Object.entries({...reference.sourceHashes,...reference.historicalHashes,...amendment.sourceHashes}))assert.equal(hash(readFileSync(p)),h,`Frozen input changed: ${p}`);
assert.equal(hash(readFileSync(amendment.originalRunner.path)),reference.sourceHashes['apps/dossier-cli/scripts/corroboration-run.mjs']);
assert.equal(fingerprint(modelPaths),reference.modelFingerprint);
const fixture=read(protocol.fixture.path);
const publicItems=items=>new Map(items.map(r=>[key(r),{id:r.id,medium:r.medium,title:r.title,year:r.year,posterPath:r.posterPath,
  genres:r.genres,genreIds:r.genreIds,keywords:r.keywords,overview:r.overview,runtime:r.runtime,collection:r.collection,
  directorIds:r.directorIds,creatorIds:r.creatorIds,features:featureVector(r),voteAverage:r.voteAverage,voteCount:r.voteCount,popularity:r.popularity}]));
const byKey=publicItems(fixture.items);
function client(catalogue,pool){
  let vault={profiles:[],activeId:null};const storage={root:'/corroboration-lab',load:()=>vault,save:v=>{vault=v},audit:()=>{}};
  const adapter={detail:async(m,id)=>{const item=catalogue.get(`${m}:${id}`);assert(item);return item;},candidates:async()=>pool.map(k=>catalogue.get(k))};
  return {call:(name,args={})=>execute(storage,name,args,adapter),state:()=>vault.profiles[0].state,score:createCorroborationScorer()};
}
const publish=rows=>Object.fromEntries(rows.map(r=>[key(r.item),Math.round(r.score*1000)/1000]));
const sameScores=(a,b)=>Object.keys(a).length===Object.keys(b).length&&Object.entries(a).every(([k,v])=>b[k]===v);
async function capture(cli,catalogue,pool,truth,phaseTruth,time){
  const scores={},measures={},phase={},previews={},original=structuredClone(cli.state()),items=pool.map(k=>catalogue.get(k));
  const entries=Object.values(cli.state().ratings),claims=cli.state().tasteClaims;
  for(const arm of protocol.arms){
    if(arm.startsWith('supported')){
      const result=cli.score(items,entries,claims,arm.endsWith('recent')?'recent':'timeless',arm.includes('claims'),DEFAULT_SCORING_PARAMS.qualityWeight,time);
      scores[arm]=publish(result.rows);previews[arm]={claims:result.claims,evidence:result.evidence};
    }else{
      const options=arm==='current'?{}:{localEvidence:arm==='local'?'timeless':'recent',referenceTime:time};
      const rows=[];let cursor;
      do{const page=await cli.call('suggest.list',{limit:200,...options,...(cursor?{cursor}:{})});rows.push(...page.items);cursor=page.next;}while(cursor);
      scores[arm]=Object.fromEntries(rows.map(r=>[r.id,r.score]));
      assert.deepEqual(scores[arm],publish(scoreCandidates(items,entries,DEFAULT_SCORING_PARAMS,claims,options)),'CLI parity failed');
    }
    const available=Object.keys(scores[arm]).length>0;
    measures[arm]=assess(scores[arm],items,truth,available);phase[arm]=assess(scores[arm],items,phaseTruth,available);
  }
  assert.deepEqual(cli.state(),original,'A scorer changed stored ratings or claims');
  return {scores,measures,phase,previews};
}
async function rate(cli,event){
  await cli.call(event.rating===null?'rate.clear':'rate.set',{key:event.key,...(event.rating===null?{}:{value:event.rating}),expectedRevision:(await cli.call('profile.show')).revision});
  if(event.rating!==null)cli.state().ratings[event.key].ts=event.ts;
}
async function session(v,seed){
  const cli=client(byKey,v.holdoutKeys);await cli.call('profile.create',{name:'Corroboration viewer'});
  const order=shuffled(v.trainingKeys,v.seed+seed).slice(0,protocol.ratings),events=[],steps=[];let previous=null;
  for(let count=1;count<=protocol.ratings;count++){
    const k=order[count-1],phaseTruth=v.type==='changing_taste'&&count<=protocol.changeAt?v.oldRatings:v.ratings;
    const mistake=(v.type==='isolated_noise'&&count===14)||(v.type==='repeated_noise'&&count>=14&&count<=18)
      ||(v.type==='biased_noise'&&count>=11&&count<=30&&byKey.get(k).genres.includes(v.biasedGenre));
    const rating=mistake?(phaseTruth[k]===0?3:-phaseTruth[k]):phaseTruth[k];
    const event={key:k,rating:rating||0,ts:protocol.clock.start+count*protocol.clock.stepDays*86400000};
    assert(!v.holdoutKeys.includes(k));events.push(event);await rate(cli,event);
    assert.equal(cli.state().ratings[k].rating,event.rating,'Explicit rating changed');
    const result=await capture(cli,byKey,v.holdoutKeys,v.ratings,phaseTruth,event.ts);
    const previousUnderPhase=previous?Object.fromEntries(protocol.arms.map(arm=>[arm,assess(previous.scores[arm],v.holdoutKeys.map(k=>byKey.get(k)),phaseTruth,Object.keys(previous.scores[arm]).length>0).auc])):null;
    steps.push({count,event,mistake,...result,
      deltas:Object.fromEntries(protocol.arms.map(arm=>[arm,previous?round(result.measures[arm].auc-previous.measures[arm].auc):0])),
      phaseBefore:previousUnderPhase,phaseDeltas:Object.fromEntries(protocol.arms.map(arm=>[arm,previous?round(result.phase[arm].auc-previousUnderPhase[arm]):0]))});previous=result;
  }
  assert.deepEqual(cli.state().ratings,replayLibrary(events,byKey).ratings);
  const saved=structuredClone(cli.state()),time=events.at(-1).ts,finalScores=previous.scores;
  const imported=await importLibrary(await exportLibrary(saved,'corroboration-roundtrip'),'corroboration-roundtrip');assert.deepEqual(imported,saved);
  Object.assign(cli.state(),imported);assert.deepEqual((await capture(cli,byKey,v.holdoutKeys,v.ratings,v.ratings,time)).scores,finalScores);
  const ordering=Object.fromEntries(protocol.arms.map(arm=>[arm,[]]));
  for(let i=0;i<protocol.permutations;i++){
    cli.state().ratings=Object.fromEntries(shuffled(Object.entries(saved.ratings),seed+i*101));
    const result=await capture(cli,byKey,v.holdoutKeys,v.ratings,v.ratings,time);
    for(const arm of protocol.arms)ordering[arm].push({scores:result.scores[arm],auc:result.measures[arm].auc});
  }
  cli.state().ratings=structuredClone(saved.ratings);
  const orderResults=Object.fromEntries(protocol.arms.map(arm=>[arm,{scoreSignatures:new Set(ordering[arm].map(x=>JSON.stringify(Object.entries(x.scores).sort()))).size,
    aucSpread:round(Math.max(...ordering[arm].map(x=>x.auc))-Math.min(...ordering[arm].map(x=>x.auc)))}]));
  const k=order[0],original=saved.ratings[k],overwrite={key:k,rating:original.rating===0?2:-original.rating,ts:time+86400000};
  await rate(cli,overwrite);const overwritten=cli.state().ratings[k].rating===overwrite.rating&&Object.keys(cli.state().ratings).length===protocol.ratings;
  await rate(cli,{key:k,rating:null});const cleared=!(k in cli.state().ratings);
  await rate(cli,{key:k,rating:original.rating,ts:original.ts});
  const restored=await capture(cli,byKey,v.holdoutKeys,v.ratings,v.ratings,time),claimHistoryChanged=JSON.stringify(cli.state().tasteClaims)!==JSON.stringify(saved.tasteClaims);
  assert.deepEqual(cli.state().ratings,saved.ratings);cli.state().tasteClaims=structuredClone(saved.tasteClaims);
  const isolated=await capture(cli,byKey,v.holdoutKeys,v.ratings,v.ratings,time);
  return {seed,events,steps,order:orderResults,claimHistoryChanged,restorationScores:restored.scores,
    scorerRestoration:Object.fromEntries(protocol.arms.map(arm=>[arm,sameScores(isolated.scores[arm],finalScores[arm])])),
    contracts:{explicitRatings:true,overwrite:overwritten,clear:cleared,portability:true,readOnly:true,cliParity:true},finalProfile:saved};
}
async function historicalFailures(){
  const frozen=read('apps/dossier-cli/src/lab/real-tmdb-v1.json'),catalogue=publicItems(frozen.items),diagnosis=read('reports/backwards-learning-diagnosis-v1.json'),results=[];
  for(const target of diagnosis.cases){
    const v=frozen.viewers.find(v=>v.id===target.viewer),training=new Map(v.trainingRatings.map(r=>[r.filmKey,r.rating]));
    const pool=v.heldOutRatings.map(r=>r.filmKey),truth=Object.fromEntries(v.heldOutRatings.map(r=>[r.filmKey,r.rating]));
    const order=shuffled([...training.keys()],target.seed+v.sourceUserId*1009),cli=client(catalogue,pool);await cli.call('profile.create',{name:'Historical corroboration failure'});
    const events=[],steps=[];let previous=null;
    for(let count=1;count<=40;count++){
      const event={key:order[count-1],rating:training.get(order[count-1]),ts:protocol.clock.start+count*protocol.clock.stepDays*86400000};
      assert(!pool.includes(event.key));events.push(event);await rate(cli,event);if(count<10)continue;
      const result=await capture(cli,catalogue,pool,truth,truth,event.ts);
      steps.push({count,event,...result,deltas:Object.fromEntries(protocol.arms.map(arm=>[arm,previous?round(result.measures[arm].auc-previous.measures[arm].auc):0]))});previous=result;
    }
    assert.equal(steps[0].measures.current.auc,target.auc10);assert.equal(steps.at(-1).measures.current.auc,target.auc40);
    results.push({viewer:target.viewer,seed:target.seed,events,steps,arms:Object.fromEntries(protocol.arms.map(arm=>[arm,{auc10:steps[0].measures[arm].auc,
      auc40:steps.at(-1).measures[arm].auc,change:round(steps.at(-1).measures[arm].auc-steps[0].measures[arm].auc),
      gainCurrent40:round(steps.at(-1).measures[arm].auc-steps.at(-1).measures.current.auc),worstStep:round(Math.min(...steps.slice(1).map(x=>x.deltas[arm])))}]))});
  }
  return results;
}
const started=performance.now(),selected=(partition?fixture.viewers.filter(v=>v.partition===partition):fixture.viewers).slice(0,max||undefined),viewerResults=[];
for(const [i,v]of selected.entries()){
  assert(v.trainingKeys.every(k=>!v.holdoutKeys.includes(k)));
  const sessions=[];for(const seed of protocol.seeds)sessions.push(await session(v,seed));
  viewerResults.push({viewer:v.id,partition:v.partition,type:v.type,sessions});
  if(i%8===0||i+1===selected.length)process.stderr.write(`Corroboration ${i+1}/${selected.length} (${v.partition})\n`);
}
const failures=max||partition?[]:await historicalFailures();assert.equal(fingerprint(modelPaths),reference.modelFingerprint);
const report={version:protocol.version,protocol,protocolHash:hash(readFileSync(protocolPath)),referenceHash:hash(readFileSync(freezePath)),
  serializationAmendmentHash:hash(readFileSync(amendmentPath)),
  durationSeconds:round((performance.now()-started)/1000,2),viewers:viewerResults.length,sessions:viewerResults.length*protocol.seeds.length,
  cohorts:Object.fromEntries(['development','sealed','confirmation'].map(p=>[p,summarizeCorroboration(viewerResults.filter(v=>v.partition===p),protocol)])),
  types:Object.fromEntries(['sealed','confirmation'].map(p=>[p,Object.fromEntries([...new Set(viewerResults.map(v=>v.type))].map(t=>[t,summarizeCorroboration(viewerResults.filter(v=>v.partition===p&&v.type===t),protocol)]))])),
  failures,...corroborationDecision(viewerResults,failures,protocol,Boolean(max||partition)),viewerResults};
await writeCorroborationReport(report,output);
console.log(JSON.stringify({output,viewers:report.viewers,duration:report.durationSeconds,decision:report.decision,candidateGates:report.candidateGates}));
