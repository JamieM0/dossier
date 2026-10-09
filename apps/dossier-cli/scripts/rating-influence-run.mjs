import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { featureVector, createDefaultState, setLibraryRating, exportLibrary, importLibrary } from '@dossier/domain';
import { key, shuffled, assess, round } from './hard-metrics.mjs';
import { pairAccuracy } from './corroboration-ranking.mjs';
import { replayLibrary } from './library-replay.mjs';
import { writeCorroborationReport, readCorroborationReport } from './corroboration-io.mjs';
import { createInfluenceScorer, INFLUENCE_ARMS, INFLUENCE_CONFIG } from './rating-influence-policy.mjs';
import { influenceDecision } from './rating-influence-metrics.mjs';
const args=process.argv.slice(2),value=(flag,fallback)=>args.includes(flag)?args[args.indexOf(flag)+1]:fallback;
const partition=value('--partition','development'),output=`reports/rating-influence-v1-${partition}.json`;
assert(['development','sealed','confirmation'].includes(partition));
const read=p=>JSON.parse(readFileSync(p)),hash=b=>createHash('sha256').update(b).digest('hex');
const protocolPath='apps/dossier-cli/benchmarks/rating-influence-v1-protocol.json',p=read(protocolPath),fixture=read(p.fixture.path);
const protocolHash=hash(readFileSync(protocolPath));
assert.deepEqual(p.arms,INFLUENCE_ARMS);assert.deepEqual(p.candidate,INFLUENCE_CONFIG);assert.equal(hash(readFileSync(p.fixture.path)),p.fixture.sha256);
assert.equal(hash(readFileSync('apps/dossier-cli/scripts/prepare-rating-influence.mjs')),p.generatorHash);
const freezePath='apps/dossier-cli/benchmarks/rating-influence-v1-reference.json';
const modelPaths=readdirSync('packages/domain/dist',{recursive:true}).filter(f=>f.endsWith('.js')&&!f.endsWith('.test.js')).map(f=>'packages/domain/dist/'+f).concat(['apps/dossier-cli/dist/actions.js']);
const fingerprint=()=>hash(Buffer.concat(modelPaths.slice().sort().flatMap(f=>[Buffer.from(f+'\n'),readFileSync(f)])));
assert.equal(fingerprint(),read('apps/dossier-cli/benchmarks/corroboration-v1-reference.json').modelFingerprint);
if(args.includes('--freeze')){
  assert(!existsSync(freezePath));assert(existsSync('reports/rating-influence-v1-development.json'));
  const sources=[protocolPath,p.fixture.path,'apps/dossier-cli/scripts/prepare-rating-influence.mjs','apps/dossier-cli/scripts/rating-influence-policy.mjs',
    'apps/dossier-cli/scripts/rating-influence-run.mjs','apps/dossier-cli/scripts/rating-influence-metrics.mjs','apps/dossier-cli/scripts/rating-influence.check.mjs','apps/dossier-cli/scripts/rating-influence-diagnosis.mjs',
    'apps/dossier-cli/scripts/hard-metrics.mjs','apps/dossier-cli/scripts/real-metrics.mjs','apps/dossier-cli/scripts/corroboration-metrics.mjs','apps/dossier-cli/scripts/corroboration-ranking.mjs',
    'apps/dossier-cli/scripts/corroboration-io.mjs','apps/dossier-cli/scripts/library-replay.mjs','reports/rating-influence-mechanisms-v1.json','docs/rating-influence-experiment.md'];
  const preserved=['reports/corroboration-v1.jsonl.gz',...Array.from({length:5},(_,i)=>`reports/corroboration-v1-traces-${i+1}.jsonl.gz`),
    'apps/dossier-cli/src/lab/corroboration-v1.json','apps/dossier-cli/benchmarks/corroboration-v1-protocol.json','apps/dossier-cli/benchmarks/corroboration-v1-reference.json','apps/dossier-cli/benchmarks/corroboration-v1-output-amendment.json',
    'apps/dossier-cli/benchmarks/learning-stability-v1-reference.json','apps/dossier-cli/benchmarks/learning-stability-v1-protocol.json',
    'reports/corroboration-analysis-v1.md','reports/corroboration-verification-v1.json','reports/corroboration-regression-v1.json',
    'reports/learning-stability-v1.json.gz','reports/rating-influence-v1-development.json','reports/rating-influence-v1-development.jsonl.gz','reports/rating-influence-v1-development-verification.json',
    ...[1,2].map(i=>`reports/rating-influence-v1-development-traces-${i}.jsonl.gz`)];
  writeFileSync(freezePath,JSON.stringify({version:p.version,sourceHashes:Object.fromEntries(sources.map(f=>[f,hash(readFileSync(f))])),
    preservedHashes:Object.fromEntries(preserved.map(f=>[f,hash(readFileSync(f))])),modelFingerprint:fingerprint(),frozenAt:new Date().toISOString()},null,2)+'\n');
  console.log('Frozen three candidates, settings, evaluator, verification, and acceptance gates before reserved evaluation.');process.exit(0);
}
if(partition!=='development'){
  const frozen=read(freezePath);
  for(const [f,h]of Object.entries({...frozen.sourceHashes,...frozen.preservedHashes}))assert.equal(hash(readFileSync(f)),h,`Frozen input changed: ${f}`);
  assert.equal(fingerprint(),frozen.modelFingerprint);
  assert(!existsSync(output),'Reserved results already exist; do not tune or overwrite');
}
const publicItems=items=>new Map(items.map(i=>[key(i),{...i,features:featureVector(i)}]));
const snapshot=item=>{const {id,medium,title,year,posterPath,voteAverage,genres,keywords,collection,directorIds,creatorIds,features}=item;return {key:key(item),id,medium,title,year,posterPath,voteAverage,genres,keywords,collection,directorIds,creatorIds,features};};
const publish=rows=>Object.fromEntries(rows.map(r=>[key(r.item),Math.round(r.score*1000)/1000||0]));
function capture(state,catalogue,keys,truth,phaseTruth,time,scorer){
  const original=JSON.stringify(state),pool=keys.map(k=>catalogue.get(k)),scores={},measures={},phase={};
  for(const arm of p.arms){scores[arm]=publish(scorer(pool,Object.values(state.ratings),state.tasteClaims,arm,time));
    measures[arm]=assess(scores[arm],pool,truth,Object.keys(scores[arm]).length>0);phase[arm]=assess(scores[arm],pool,phaseTruth,Object.keys(scores[arm]).length>0);}
  assert.equal(JSON.stringify(state),original);return {scores,measures,phase};
}
async function session(v,seed,catalogue,overrideEvents=null){
  const scorer=createInfluenceScorer(),training=shuffled(v.trainingKeys,v.seed+seed);
  let order=training;
  if(v.type==='novel_preference')order=[...training.filter(k=>!catalogue.get(k).keywords.includes(v.novelTag)).slice(0,30),
    ...training.filter(k=>catalogue.get(k).keywords.includes(v.novelTag)),...training.filter(k=>!catalogue.get(k).keywords.includes(v.novelTag)).slice(30)];
  // Select repeated metadata keys by catalogue position on every partition.
  if(v.type==='duplicate_evidence'){const repeated=new Set(v.trainingKeys.slice(70,90));order=[...training.filter(k=>repeated.has(k)),...training.filter(k=>!repeated.has(k))];}
  let state=createDefaultState(),previous=null;const events=[],steps=[];
  const countLimit=overrideEvents?.length??p.ratings;
  for(let count=1;count<=countLimit;count++){
    const k=overrideEvents?.[count-1].key??order[count-1],truth=v.type==='changing_taste'&&count<=p.changeAt?v.oldRatings:v.ratings;
    const mistake=!overrideEvents&&((v.type==='isolated_noise'&&count===14)||(v.type==='repeated_noise'&&count>=14&&count<=18)
      ||(v.type==='biased_noise'&&count>=11&&count<=30&&catalogue.get(k).genres.includes(v.biasedGenre)));
    const event=overrideEvents?.[count-1]??{key:k,rating:mistake?(truth[k]===0?3:-truth[k]):truth[k]||0,ts:p.clock.start+count*p.clock.stepDays*86400000};
    assert(!v.holdoutKeys.includes(k));events.push(event);state=setLibraryRating(state,k,event.rating,snapshot(catalogue.get(k)),event.ts);
    assert.equal(state.ratings[k].rating,event.rating);
    const result=capture(state,catalogue,v.holdoutKeys,v.ratings,truth,event.ts,scorer);
    const before=previous?Object.fromEntries(p.arms.map(arm=>[arm,pairAccuracy(previous.scores[arm],truth,v.holdoutKeys)])):null;
    steps.push({count,event,mistake,...result,phaseBefore:before,
      phaseDeltas:Object.fromEntries(p.arms.map(arm=>[arm,previous?round(result.phase[arm].auc-before[arm]):0])),
      deltas:Object.fromEntries(p.arms.map(arm=>[arm,previous?round(result.measures[arm].auc-previous.measures[arm].auc):0]))});previous=result;
  }
  assert.deepEqual(state,replayLibrary(events,catalogue));
  const saved=structuredClone(state),time=events.at(-1).ts;
  const imported=await importLibrary(await exportLibrary(saved,'influence-lab-roundtrip'),'influence-lab-roundtrip');assert.deepEqual(imported,saved);
  assert.deepEqual(capture(imported,catalogue,v.holdoutKeys,v.ratings,v.ratings,time,scorer).scores,previous.scores);
  const orderResults=Object.fromEntries(p.arms.map(arm=>[arm,[]]));
  for(let i=0;i<p.permutations;i++){
    const permuted={...state,ratings:Object.fromEntries(shuffled(Object.entries(state.ratings),seed+i*101))};
    const result=capture(permuted,catalogue,v.holdoutKeys,v.ratings,v.ratings,time,scorer);
    for(const arm of p.arms)orderResults[arm].push(result);
  }
  const orderStats=Object.fromEntries(p.arms.map(arm=>[arm,{scoreSignatures:new Set(orderResults[arm].map(r=>JSON.stringify(Object.entries(r.scores[arm]).sort()))).size,
    aucSpread:round(Math.max(...orderResults[arm].map(r=>r.measures[arm].auc))-Math.min(...orderResults[arm].map(r=>r.measures[arm].auc)))}]));
  const first=events[0].key,original=saved.ratings[first];
  state=setLibraryRating(state,first,original.rating===0?2:-original.rating,original.item,time+86400000);
  assert.equal(Object.keys(state.ratings).length,Object.keys(saved.ratings).length);assert.notEqual(state.ratings[first].rating,original.rating);
  state=setLibraryRating(state,first,null);assert(!(first in state.ratings));
  state=setLibraryRating(state,first,original.rating,original.item,original.ts);assert.deepEqual(state.ratings,saved.ratings);
  const restored=capture(state,catalogue,v.holdoutKeys,v.ratings,v.ratings,time,scorer),claimHistoryChanged=JSON.stringify(state.tasteClaims)!==JSON.stringify(saved.tasteClaims);
  const equal=(a,b)=>JSON.stringify(Object.entries(a).sort())===JSON.stringify(Object.entries(b).sort());
  const novelKeys=v.novelTag?v.holdoutKeys.filter(k=>catalogue.get(k).keywords.includes(v.novelTag)):[];
  const novelLearning=Object.fromEntries(p.arms.map(arm=>[arm,v.type==='novel_preference'?round(pairAccuracy(previous.scores[arm],v.ratings,v.holdoutKeys)-pairAccuracy(steps[29].scores[arm],v.ratings,v.holdoutKeys)):0]));
  return {seed,events,steps,order:orderStats,claimHistoryChanged,restorationScores:restored.scores,
    scorerRestoration:Object.fromEntries(p.arms.map(arm=>[arm,equal(previous.scores[arm],restored.scores[arm])])),
    contracts:{explicitRatings:true,overwrite:true,clear:true,portability:true,readOnly:true,timestamps:true},novelLearning,novelHoldoutCount:novelKeys.length,finalProfile:saved};
}
const started=performance.now(),catalogue=publicItems(fixture.catalogues[partition]),viewerResults=[];
for(const [i,v]of fixture.viewers.filter(v=>v.partition===partition).entries()){
  const sessions=[];for(const seed of p.seeds)sessions.push(await session(v,seed,catalogue));viewerResults.push({viewer:v.id,partition:v.partition,type:v.type,sessions});
  if(i%8===0)process.stderr.write(`Influence ${partition} ${i+1}\n`);
}
// Archived synthetic failures remain regression evidence; no new real-person evaluation.
const old=await readCorroborationReport('reports/corroboration-v1.jsonl.gz'),oldFixture=read(old.protocol.fixture.path),oldCatalogue=publicItems(oldFixture.items);
const diagnosis=read('reports/rating-influence-mechanisms-v1.json'),chosen=[],ids=new Set();
for(const c of diagnosis.cases.filter(c=>c.arm==='current'&&c.type!=='changing_taste').sort((a,b)=>a.delta-b.delta))if(!ids.has(c.viewer)&&chosen.length<5){chosen.push(c);ids.add(c.viewer);}
const failures=[];
for(const c of chosen){
  const actor=oldFixture.viewers.find(v=>v.id===c.viewer),oldSession=old.viewerResults.find(v=>v.viewer===c.viewer).sessions.find(s=>s.seed===c.seed);
  const s=await session(actor,c.seed,oldCatalogue,oldSession.events.slice(0,40));
  failures.push({viewer:c.viewer,seed:c.seed,source:'archived_synthetic',events:s.events,steps:s.steps,
    arms:Object.fromEntries(p.arms.map(arm=>{const first=s.steps[9].measures[arm].auc,last=s.steps.at(-1).measures[arm].auc;
      return [arm,{auc10:first,auc40:last,change:round(last-first),gainCurrent40:round(last-s.steps.at(-1).measures.current.auc),worstStep:round(Math.min(...s.steps.slice(10).map(x=>x.phaseDeltas[arm])))}];}))});
}
const result=influenceDecision(viewerResults,failures,p,partition);
assert.equal(hash(readFileSync(protocolPath)),protocolHash,'Protocol changed during evaluation');
const report={version:p.version,protocol:p,partition,protocolHash,referenceHash:existsSync(freezePath)?hash(readFileSync(freezePath)):null,
  durationSeconds:round((performance.now()-started)/1000,2),viewers:viewerResults.length,sessions:viewerResults.length*p.seeds.length,
  ...result,failures,viewerResults};
await writeCorroborationReport(report,output);console.log(JSON.stringify({output,duration:report.durationSeconds,decision:report.decision,
  failedGates:report.candidates.map(c=>({arm:c.arm,failed:Object.entries(c.gates).filter(([,v])=>!v).map(([k])=>k)}))}));
