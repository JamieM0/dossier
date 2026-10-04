import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { performance } from 'node:perf_hooks';
import { CORRECTION_CONFIG, CORRECTION_ARMS, lensRuleId, matchesLensRule } from '@dossier/domain';
import { execute } from '../dist/actions.js';
import { average, assess, key, shuffled, random, round } from './hard-metrics.mjs';
import { replayLibrary } from './library-replay.mjs';
import { summarize, decide } from './effective-correction-metrics.mjs';
const args=process.argv.slice(2).filter(a=>a!=='--');
const value=(flag,fallback)=>args.includes(flag)?args[args.indexOf(flag)+1]:fallback;
const max=Number(value('--max-viewers','0')),partition=value('--partition',null),output=value('--output','reports/effective-correction-v1.json');
assert(Number.isSafeInteger(max)&&max>=0);assert(partition===null||['development','sealed'].includes(partition));
const hash=b=>createHash('sha256').update(b).digest('hex'),protocolPath='apps/dossier-cli/benchmarks/effective-correction-v1-protocol.json';
const protocolBytes=readFileSync(protocolPath),protocol=JSON.parse(protocolBytes);
assert.deepEqual(protocol.candidate,CORRECTION_CONFIG);assert.deepEqual(protocol.arms,CORRECTION_ARMS);
assert.equal(protocol.generatorHash,hash(readFileSync('apps/dossier-cli/scripts/prepare-effective-correction.mjs')));
assert.equal(protocol.fixture.sha256,hash(readFileSync(protocol.fixture.path)));
const fixture=JSON.parse(readFileSync(protocol.fixture.path));
const modelPaths=readdirSync('packages/domain/dist',{recursive:true}).filter(p=>p.endsWith('.js')&&!p.endsWith('.test.js')).map(p=>'packages/domain/dist/'+p).concat(['apps/dossier-cli/dist/actions.js']);
const evaluatorPaths=['effective-correction-run.mjs','effective-correction-metrics.mjs','hard-metrics.mjs','real-metrics.mjs','library-replay.mjs'].map(p=>'apps/dossier-cli/scripts/'+p);
const fingerprint=paths=>hash(Buffer.concat(paths.slice().sort().flatMap(p=>[Buffer.from(p+'\n'),readFileSync(p)])));
const modelFingerprint=fingerprint(modelPaths),evaluatorFingerprint=fingerprint(evaluatorPaths);
// Rebuild an allowlisted catalogue rather than handing evaluator records to Dossier.
const byKey=new Map(fixture.items.map(r=>[key(r),{id:r.id,medium:r.medium,title:r.title,year:r.year,posterPath:null,
 genres:r.genres,genreIds:r.genreIds,keywords:r.keywords,overview:r.overview,runtime:r.runtime,collection:r.collection,
 directorIds:r.directorIds,creatorIds:r.creatorIds,features:r.features,voteAverage:null,voteCount:0,popularity:null}]));
function client(pool) {
 let vault={profiles:[],activeId:null},keys=pool;
 const storage={root:'/effective-lab',load:()=>vault,save:v=>{vault=v},audit:()=>{}};
 const catalogue={detail:async(m,id)=>{const item=byKey.get(`${m}:${id}`);assert(item);return item;},candidates:async()=>keys.map(k=>byKey.get(k))};
 return {call:(name,args={})=>execute(storage,name,args,catalogue),state:()=>vault.profiles[0].state,pool:p=>{keys=p}};
}
const write=async(cli,name,args)=>cli.call(name,{...args,expectedRevision:(await cli.call('profile.show')).revision});
async function rank(cli,arm,includeRated=false) {
 const rows=[];let cursor;
 do{const page=await cli.call('correction.suggest',{arm,includeRated,limit:100,...(cursor?{cursor}:{})});rows.push(...page.items);cursor=page.next;}while(cursor);
 return rows;
}
const scoreMap=rows=>Object.fromEntries(rows.map(r=>[r.id,r.score]));
const equal=(a,b)=>JSON.stringify(scoreMap(a))===JSON.stringify(scoreMap(b));
const equalScores=(a,b)=>a.length===b.length&&a.every(r=>b.find(s=>s.id===r.id)?.score===r.score);
const feedbackArgs=f=>({...f,...('effect'in f?{effect:f.effect>0?'positive':'negative'}:{})});
const capture=async(cli,v)=>Object.fromEntries(await Promise.all(protocol.arms.map(async arm=>[arm,assess(scoreMap(await rank(cli,arm)),v.holdoutKeys.map(k=>byKey.get(k)),v.ratings)])));
async function contracts(cli,v,saved,final) {
 const result={},training=Object.values(saved.ratings).map(e=>e.item.key);
 cli.pool([...v.holdoutKeys,...training]);
 const defaultOriginal=structuredClone(cli.state());
 for(const arm of protocol.arms) {
  const cases={};
  // Isolate each control meaning from other explicit feedback.
  cli.state().settings.experimentalCorrections={version:1,feedback:[]};
  const reference=await rank(cli,arm,true),source=reference.filter(r=>training.includes(r.id));
  const a=source[0],b=source[source.length-1];assert(a&&b&&a.id!==b.id);
  const chosen=saved.settings.experimentalCorrections?.feedback.find(f=>f.kind==='general');
  if(chosen) {
   await write(cli,'correction.set',feedbackArgs(chosen));const before=await rank(cli,arm,true);
   await write(cli,'correction.set',feedbackArgs({...chosen,effect:-chosen.effect}));const after=await rank(cli,arm,true);
   const matched=before.filter(r=>matchesLensRule(byKey.get(r.id),chosen.conditions)),unrelated=before.filter(r=>!matchesLensRule(byKey.get(r.id),chosen.conditions));
   cases.general={passed:matched.length>0&&matched.every(r=>(after.find(x=>x.id===r.id).score-r.score)*chosen.effect<0),
    unrelatedStable:unrelated.every(r=>after.find(x=>x.id===r.id).score===r.score),affected:matched.length};
   await write(cli,'correction.remove',{id:chosen.id});
  }
  const exception={id:'diagnostic-exception',kind:'exception',key:a.id,effect:1};
  await write(cli,'correction.set',feedbackArgs(exception));const positive=await rank(cli,arm,true);
  await write(cli,'correction.set',feedbackArgs({...exception,effect:-1}));const negative=await rank(cli,arm,true);
  cases.exception={passed:positive.find(r=>r.id===a.id).score>0&&negative.find(r=>r.id===a.id).score<0,
   unrelatedStable:reference.filter(r=>r.id!==a.id).every(r=>positive.find(x=>x.id===r.id).score===r.score&&negative.find(x=>x.id===r.id).score===r.score)};
  await write(cli,'correction.remove',{id:exception.id});
  const pair={id:'diagnostic-pair',kind:'comparison',winner:a.id,loser:b.id};
  await write(cli,'correction.set',pair);const before=await rank(cli,arm,true);
  await write(cli,'correction.set',{...pair,winner:b.id,loser:a.id});const after=await rank(cli,arm,true);
  const margin=rows=>rows.find(r=>r.id===a.id).score-rows.find(r=>r.id===b.id).score;
  cases.comparison={passed:margin(before)>0&&margin(after)<0,pairReversed:margin(before)>0&&margin(after)<0,
   beforeMargin:margin(before),afterMargin:margin(after),
   unrelatedStable:reference.filter(r=>r.id!==a.id&&r.id!==b.id).every(r=>after.find(x=>x.id===r.id).score===r.score)};
  await write(cli,'correction.remove',{id:pair.id});
  cases.removal=equalScores(await rank(cli,arm,true),reference);
  cli.state().settings.experimentalCorrections=structuredClone(saved.settings.experimentalCorrections);
  cli.pool(v.holdoutKeys);cases.restoration=equalScores(await rank(cli,arm),final[arm]);
  cases.rankMovement=average(final[arm].map((r,i)=>Math.abs(i-final.current.findIndex(x=>x.id===r.id))));
  result[arm]=cases;cli.pool([...v.holdoutKeys,...training]);
 }
 Object.assign(cli.state(),defaultOriginal);cli.pool(v.holdoutKeys);return result;
}
async function session(v,seed) {
 const cli=client(v.holdoutKeys);await cli.call('profile.create',{name:'EffectiveCorrection'});
 const order=shuffled(v.trainingKeys,seed+v.seed),events=[];
 for(const [index,k]of order.slice(0,protocol.ratings).entries()) {
  const rating=v.type==='changing_taste'&&index<20?v.oldRatings[k]:v.ratings[k];
  const event={key:k,rating,ts:1700000000000+index};events.push(event);
  await write(cli,'context.rate',{context:'global',key:k,value:rating,observedAt:event.ts});
 }
 // Exercise actual repeated-rating overwrite on a training title.
 const duplicate={...events[0],rating:v.ratings[events[0].key],ts:1700000000100};events.push(duplicate);
 await write(cli,'context.rate',{context:'global',key:duplicate.key,value:duplicate.rating,observedAt:duplicate.ts});
 const replay=replayLibrary(events,byKey);assert.deepEqual(cli.state().ratings,replay.ratings);assert.deepEqual(cli.state().tasteClaims,replay.tasteClaims);
 const defaultBefore=await cli.call('suggest.list',{limit:20,dials:{qualityWeight:0,popularityBias:0}});
 const checkpoints={0:await capture(cli,v)},answers=[],steps=[],rng=random(v.seed+seed*7919);let previous=checkpoints[0],accepted=0;
 for(let prompt=1;prompt<=protocol.maxPrompts;prompt++) {
  const q=(await cli.call('lens45.queue',{limit:1})).items[0];if(!q)break;
  assert(q.pair.every(k=>Object.hasOwn(cli.state().ratings,k)&&!v.holdoutKeys.includes(k)));
  const proposed=q.choices[0],rule=v.rules.find(r=>lensRuleId(r.conditions)===lensRuleId(proposed.conditions));
  let answer='none',effect=rule?.effect,misleading=false;
  if(v.type==='missing_factor')answer='unknown';
  else if(rng()<v.abstention)answer='unknown';
  else if(rng()<v.responseNoise){answer='confirm';effect=rule?-rule.effect:proposed.effect;misleading=true;}
  else if(rule){answer='confirm';}
  // Queue history follows the supplied answer, shared by all scoring arms.
  await write(cli,'lens45.answer',{id:q.id,answer});
  if(answer==='confirm'){
   if(effect!==proposed.effect)await write(cli,'lens45.correct',{id:proposed.id,effect:effect>0?'positive':'negative'});
   await write(cli,'correction.set',{id:`general:${lensRuleId(proposed.conditions)}`,kind:'general',conditions:proposed.conditions,effect:effect>0?'positive':'negative'});accepted++;
  }
  answers.push({question:q,answer,effect:answer==='confirm'?effect:null,misleading});
  const now=await capture(cli,v);steps.push({prompt,metrics:now,delta:Object.fromEntries(protocol.arms.map(a=>[a,round(now[a].auc-previous[a].auc)]))});previous=now;
  if(protocol.checkpoints.includes(prompt))checkpoints[prompt]=now;
 }
 for(const budget of protocol.checkpoints)checkpoints[budget]??=previous;
 const saved=structuredClone(cli.state()),final=Object.fromEntries(await Promise.all(protocol.arms.map(async a=>[a,await rank(cli,a)])));
 const defaultStable=JSON.stringify(await cli.call('suggest.list',{limit:20,dials:{qualityWeight:0,popularityBias:0}}))===JSON.stringify(defaultBefore);assert(defaultStable);
 const directory=mkdtempSync(join(tmpdir(),'dossier-effective-'));let portability=false;
 try {const path=join(directory,'profile.dossier');await cli.call('library.export',{path,passphrase:'effective-roundtrip'});
  const restored=client(v.holdoutKeys);await restored.call('profile.import',{path,passphrase:'effective-roundtrip',name:'Restored'});
  assert.deepEqual(restored.state(),saved);
  for(const arm of protocol.arms)assert.deepEqual(await rank(restored,arm),final[arm]);portability=true;
 }finally{rmSync(directory,{recursive:true,force:true});}
 return {seed,events,answers,accepted,steps,checkpoints,profile:saved,final,
  contracts:await contracts(cli,v,saved,final),portability,defaultStable,overwriteMatched:true};
}
const started=performance.now();let selected=partition?fixture.viewers.filter(v=>v.partition===partition):fixture.viewers;
if(max)selected=selected.slice(0,max);assert(selected.length>0);
const viewerResults=[];
for(const [i,v]of selected.entries()) {
 assert.equal(fingerprint(modelPaths),modelFingerprint);assert.equal(fingerprint(evaluatorPaths),evaluatorFingerprint);
 assert(v.trainingKeys.every(k=>!v.holdoutKeys.includes(k)));
 const sessions=[];for(const seed of protocol.seeds)sessions.push(await session(v,seed));
 viewerResults.push({viewer:v.id,partition:v.partition,type:v.type,sessions});
 if(i%10===0||i+1===selected.length)process.stderr.write(`Effective correction ${i+1}/${selected.length} (${v.partition})\n`);
}
const cohorts=Object.fromEntries(['development','sealed'].map(p=>[p,summarize(viewerResults.filter(v=>v.partition===p),protocol)]));
const types=Object.fromEntries([...new Set(viewerResults.map(v=>v.type))].map(t=>[t,summarize(viewerResults.filter(v=>v.partition==='sealed'&&v.type===t),protocol)]));
const report={version:protocol.version,protocol,protocolHash:hash(protocolBytes),modelFingerprint,evaluatorFingerprint,
 durationSeconds:round((performance.now()-started)/1000,2),viewers:viewerResults.length,sessions:viewerResults.length*2,
 cohorts,types,...decide(viewerResults,protocol,Boolean(max||partition)),viewerResults};
writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({output,viewers:report.viewers,decision:report.decision,candidateGates:report.candidateGates}));
