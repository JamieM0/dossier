import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { performance } from 'node:perf_hooks';
import { CORRECTION_CONFIG, PROTECTION_CONFIG, PROTECTED_ARMS, matchesLensRule, protectedFeedback, readCorrectionReviews } from '@dossier/domain';
import { execute } from '../dist/actions.js';
import { average, assess, key, shuffled, random, round } from './hard-metrics.mjs';
import { replayLibrary } from './library-replay.mjs';
import { mainAnswer, followupAnswer, feedbackFrom, feedbackArgs, publicItem } from './guarded-correction-method.mjs';
import { summarize, decide } from './guarded-correction-metrics.mjs';
const args=process.argv.slice(2).filter(a=>a!=='--'),value=(flag,fallback)=>args.includes(flag)?args[args.indexOf(flag)+1]:fallback;
const max=Number(value('--max-viewers','0')),partition=value('--partition',null),output=value('--output','reports/guarded-correction-v1.json');
assert(Number.isSafeInteger(max)&&max>=0);assert(partition===null||['development','sealed'].includes(partition));
const sha=b=>createHash('sha256').update(b).digest('hex'),protocolPath='apps/dossier-cli/benchmarks/guarded-correction-v1-protocol.json';
const bytes=readFileSync(protocolPath),protocol=JSON.parse(bytes),fixture=JSON.parse(readFileSync(protocol.fixture.path));
assert.deepEqual(protocol.candidate,CORRECTION_CONFIG);assert.deepEqual(protocol.protection,PROTECTION_CONFIG);
assert.equal(sha(readFileSync(protocol.fixture.path)),protocol.fixture.sha256);
assert.equal(sha(readFileSync('apps/dossier-cli/scripts/prepare-guarded-correction.mjs')),protocol.generatorHash);
const referencePath='apps/dossier-cli/benchmarks/guarded-correction-v1-reference.json',referenceBytes=readFileSync(referencePath),reference=JSON.parse(referenceBytes);
for(const [p,h]of Object.entries(reference.hashes))assert.equal(sha(readFileSync(p)),h,`Archived evidence changed: ${p}`);
const modelPaths=readdirSync('packages/domain/dist',{recursive:true}).filter(p=>p.endsWith('.js')&&!p.endsWith('.test.js')).map(p=>'packages/domain/dist/'+p).concat(['apps/dossier-cli/dist/actions.js']);
const evaluatorPaths=['guarded-correction-run.mjs','guarded-correction-method.mjs','guarded-correction-metrics.mjs','effective-correction-metrics.mjs','hard-metrics.mjs','real-metrics.mjs','library-replay.mjs'].map(p=>'apps/dossier-cli/scripts/'+p);
const fingerprint=paths=>sha(Buffer.concat(paths.slice().sort().flatMap(p=>[Buffer.from(p+'\n'),readFileSync(p)])));
const modelFingerprint=fingerprint(modelPaths),evaluatorFingerprint=fingerprint(evaluatorPaths);
const byKey=new Map(fixture.items.map(r=>[key(r),publicItem(r)]));
function client(pool) {
 let vault={profiles:[],activeId:null},keys=pool;
 const storage={root:'/guarded-lab',load:()=>vault,save:v=>{vault=v},audit:()=>{}};
 const catalogue={detail:async(m,id)=>{const item=byKey.get(`${m}:${id}`);assert(item);return item;},candidates:async()=>keys.map(k=>byKey.get(k))};
 return {call:(name,args={})=>execute(storage,name,args,catalogue),state:()=>vault.profiles.find(p=>p.id===vault.activeId).state,pool:p=>{keys=p}};
}
const write=async(cli,name,args)=>cli.call(name,{...args,expectedRevision:(await cli.call('profile.show')).revision});
async function rank(cli,arm,includeRated=false) {
 const rows=[];let cursor;
 do{const p=await cli.call('correction.suggest',{arm,includeRated,limit:100,...(cursor?{cursor}:{})});rows.push(...p.items);cursor=p.next;}while(cursor);
 return rows;
}
const scores=rows=>Object.fromEntries(rows.map(r=>[r.id,r.score]));
const equal=(a,b)=>a.length===b.length&&a.every(r=>b.find(s=>s.id===r.id)?.score===r.score);
const capture=async(cli,v,arm)=>{const rows=await rank(cli,arm);return assess(scores(rows),v.holdoutKeys.map(k=>byKey.get(k)),v.ratings,rows.length>0);};
const approve=async(cli,f)=>{const {preview}=await cli.call('correction.preview',{id:f.id});return write(cli,'correction.review',{id:f.id,decision:'apply',signature:preview.signature});};
async function contracts(cli,v,arm,saved,final) {
 const training=Object.keys(saved.ratings),pool=[...v.holdoutKeys,...training],cases={};cli.pool(pool);
 const decisions=PROTECTED_ARMS.includes(arm)?protectedFeedback(saved.settings.experimentalCorrections??{version:1,feedback:[]},Object.values(saved.ratings),readCorrectionReviews(saved.settings.experimentalCorrectionReviews),arm).decisions:[];
 cases.pendingStable=true;
 for(const d of decisions.filter(d=>d.status!=='apply')) {
  const before=await rank(cli,arm,true);await write(cli,'correction.remove',{id:d.id});
  cases.pendingStable&&=equal(before,await rank(cli,arm,true));Object.assign(cli.state(),structuredClone(saved));
 }
 cli.state().settings.experimentalCorrections={version:1,feedback:[]};cli.state().settings.experimentalCorrectionReviews={version:1,reviews:[]};
 const reference=await rank(cli,arm,true),source=reference.filter(r=>training.includes(r.id));
 const a=source[0]??{id:training[0]},b=source[source.length-1]??{id:training[training.length-1]};assert(a.id!==b.id);
 const chosen=saved.settings.experimentalCorrections?.feedback.find(f=>f.kind==='general');
 if(chosen) {
  await write(cli,'correction.set',feedbackArgs(chosen));if(arm==='reviewed')await approve(cli,chosen);const before=await rank(cli,arm,true);
  const opposite={...chosen,effect:-chosen.effect};await write(cli,'correction.set',feedbackArgs(opposite));if(arm==='reviewed')await approve(cli,opposite);const after=await rank(cli,arm,true);
  const matched=before.filter(r=>matchesLensRule(byKey.get(r.id),chosen.conditions));
  cases.general={passed:matched.length>0&&matched.every(r=>((after.find(x=>x.id===r.id)?.score??NaN)-r.score)*chosen.effect<0),affected:matched.length,
   unrelatedStable:before.filter(r=>!matchesLensRule(byKey.get(r.id),chosen.conditions)).every(r=>after.find(x=>x.id===r.id)?.score===r.score)};
  await write(cli,'correction.remove',{id:chosen.id});
 }
 const exception={id:'diagnostic-exception',kind:'exception',key:a.id,effect:1};
 await write(cli,'correction.set',feedbackArgs(exception));const positive=await rank(cli,arm,true);
 await write(cli,'correction.set',feedbackArgs({...exception,effect:-1}));const negative=await rank(cli,arm,true);
 cases.exception={passed:(positive.find(r=>r.id===a.id)?.score??NaN)>0&&(negative.find(r=>r.id===a.id)?.score??NaN)<0,
  unrelatedStable:reference.filter(r=>r.id!==a.id).every(r=>positive.find(x=>x.id===r.id)?.score===r.score&&negative.find(x=>x.id===r.id)?.score===r.score)};
 await write(cli,'correction.remove',{id:exception.id});
 const pair={id:'diagnostic-pair',kind:'comparison',winner:a.id,loser:b.id};await write(cli,'correction.set',pair);const before=await rank(cli,arm,true);
 await write(cli,'correction.set',{...pair,winner:b.id,loser:a.id});const after=await rank(cli,arm,true);
 const margin=rows=>{const x=rows.find(r=>r.id===a.id),y=rows.find(r=>r.id===b.id);return x&&y?x.score-y.score:null;};
 const passed=margin(before)!==null&&margin(after)!==null&&margin(before)>0&&margin(after)<0;
 cases.comparison={passed,pairReversed:passed,beforeMargin:margin(before),afterMargin:margin(after),
  unrelatedStable:reference.filter(r=>r.id!==a.id&&r.id!==b.id).every(r=>after.find(x=>x.id===r.id)?.score===r.score)};
 await write(cli,'correction.remove',{id:pair.id});cases.removal=equal(reference,await rank(cli,arm,true));
 Object.assign(cli.state(),structuredClone(saved));cli.pool(v.holdoutKeys);cases.restoration=equal(final,await rank(cli,arm));
 return cases;
}
async function session(v,seed) {
 const source=client(v.holdoutKeys);await source.call('profile.create',{name:'Source'});
 const events=shuffled(v.trainingKeys,seed+v.seed).slice(0,protocol.ratings).map((k,i)=>({key:k,rating:v.type==='changing_taste'&&i<20?v.oldRatings[k]:v.ratings[k],ts:1700010000000+i}));
 events.push({...events[0],rating:v.ratings[events[0].key],ts:1700010000100});
 for(const e of events)await write(source,'context.rate',{context:'global',key:e.key,value:e.rating,observedAt:e.ts});
 const initial=structuredClone(source.state()),replay=replayLibrary(events,byKey);assert.deepEqual(initial.ratings,replay.ratings);assert.deepEqual(initial.tasteClaims,replay.tasteClaims);
 const commonAnswers=[],rng=random(v.seed+seed*7919);
 for(let i=0;i<protocol.maxPrompts;i++) {
  const q=(await source.call('lens45.queue',{limit:1})).items[0];if(!q)break;
  assert(q.pair.every(k=>Object.hasOwn(initial.ratings,k)&&!v.holdoutKeys.includes(k)));
  const answer={question:q,...mainAnswer(v,q.choices[0],rng)};commonAnswers.push(answer);
  await write(source,'lens45.answer',{id:q.id,answer:answer.answer});
  if(answer.answer==='confirm'&&answer.effect!==q.choices[0].effect)await write(source,'lens45.correct',{id:q.choices[0].id,effect:answer.effect>0?'positive':'negative'});
 }
 const branches={},checks={},final={},control={};let defaultStable=true,portability=true;
 for(const arm of protocol.arms) {
  const cli=client(v.holdoutKeys);await cli.call('profile.create',{name:'Branch'});Object.assign(cli.state(),structuredClone(initial));
  const normalBefore=await cli.call('suggest.list',{limit:20}),baseline=await capture(cli,v,arm),turns=[];let previous=baseline,mainIndex=0,pending=null;
  const checkpoints={0:baseline};
  for(let budget=1;budget<=protocol.maxPrompts;budget++) {
   let event;
   if(pending) {
    const {preview}=await cli.call('correction.preview',{id:pending.feedback.id});
    const decision=followupAnswer(v,pending.answer,seed,pending.index);
    await write(cli,'correction.review',{id:pending.feedback.id,decision,signature:preview.signature});
    event={kind:'review',mainIndex:pending.index,preview,decision};pending=null;
   } else {
    const answer=commonAnswers[mainIndex];if(!answer)break;
    const q=(await cli.call('lens45.queue',{limit:1})).items[0];assert.deepEqual(q,answer.question);
    await write(cli,'lens45.answer',{id:q.id,answer:answer.answer});
    event={kind:'main',mainIndex,answer};
    if(answer.answer==='confirm') {
     if(answer.effect!==q.choices[0].effect)await write(cli,'lens45.correct',{id:q.choices[0].id,effect:answer.effect>0?'positive':'negative'});
     const feedback=feedbackFrom(answer);await write(cli,'correction.set',feedbackArgs(feedback));
     if(PROTECTED_ARMS.includes(arm)) {
      event.preview=(await cli.call('correction.preview',{id:feedback.id})).preview;
      if(arm==='reviewed'&&event.preview.needsReview)pending={feedback,answer,index:mainIndex};
     }
    }
    mainIndex++;
   }
   const metric=await capture(cli,v,arm);turns.push({...event,budget,metrics:metric,delta:round(metric.auc-previous.auc)});previous=metric;
   if(protocol.checkpoints.includes(budget))checkpoints[budget]=metric;
  }
  for(const budget of protocol.checkpoints)checkpoints[budget]??=previous;
  const saved=structuredClone(cli.state()),corrections=saved.settings.experimentalCorrections??{version:1,feedback:[]};
  const protectedState=PROTECTED_ARMS.includes(arm)?protectedFeedback(corrections,Object.values(saved.ratings),readCorrectionReviews(saved.settings.experimentalCorrectionReviews),arm):null;
  const accepted=protectedState?protectedState.state.feedback.length:corrections.feedback.length;
  const decisions=protectedState?.decisions??[];
  final[arm]=await rank(cli,arm);checks[arm]=checkpoints;
  defaultStable&&=JSON.stringify(await cli.call('suggest.list',{limit:20}))===JSON.stringify(normalBefore);assert(defaultStable);
  const directory=mkdtempSync(join(tmpdir(),'dossier-guarded-'));
  try{
   const path=join(directory,'profile.dossier');await cli.call('library.export',{path,passphrase:'guarded-roundtrip'});
   const restored=client(v.holdoutKeys);await restored.call('profile.import',{path,passphrase:'guarded-roundtrip',name:'Restored'});
   assert.deepEqual(restored.state(),saved);assert.deepEqual(await rank(restored,arm),final[arm]);
  }finally{rmSync(directory,{recursive:true,force:true});}
  control[arm]=await contracts(cli,v,arm,saved,final[arm]);
  control[arm].rankMovement=0;
  branches[arm]={turns,accepted,decisions,profile:saved};
 }
 for(const arm of protocol.arms)control[arm].rankMovement=average(final[arm].map((r,i)=>Math.abs(i-final.current.findIndex(x=>x.id===r.id))));
 const checkpoints=Object.fromEntries(protocol.checkpoints.map(b=>[b,Object.fromEntries(protocol.arms.map(a=>[a,checks[a][b]]))]));
 const steps=Array.from({length:protocol.maxPrompts},(_,i)=>({prompt:i+1,delta:Object.fromEntries(protocol.arms.map(a=>[a,branches[a].turns[i]?.delta??0]))}));
 return {seed,events,answers:commonAnswers,accepted:commonAnswers.filter(a=>a.answer==='confirm').length,branches,steps,checkpoints,final,contracts:control,defaultStable,portability,overwriteMatched:true};
}
let selected=partition?fixture.viewers.filter(v=>v.partition===partition):fixture.viewers;if(max)selected=selected.slice(0,max);assert(selected.length);
const started=performance.now(),viewerResults=[];
for(const [i,v]of selected.entries()) {
 assert.equal(fingerprint(modelPaths),modelFingerprint);assert.equal(fingerprint(evaluatorPaths),evaluatorFingerprint);
 assert(v.trainingKeys.every(k=>!v.holdoutKeys.includes(k)));
 const sessions=[];for(const seed of protocol.seeds)sessions.push(await session(v,seed));
 viewerResults.push({viewer:v.id,partition:v.partition,type:v.type,sessions});
 if(i%10===0||i+1===selected.length)process.stderr.write(`Guarded correction ${i+1}/${selected.length} (${v.partition})\n`);
}
const cohorts=Object.fromEntries(['development','sealed'].map(p=>[p,summarize(viewerResults.filter(v=>v.partition===p),protocol)]));
const types=Object.fromEntries([...new Set(fixture.viewers.map(v=>v.type))].map(t=>[t,summarize(viewerResults.filter(v=>v.partition==='sealed'&&v.type===t),protocol)]));
const report={version:protocol.version,protocol,protocolHash:sha(bytes),referenceHash:sha(referenceBytes),modelFingerprint,evaluatorFingerprint,durationSeconds:round((performance.now()-started)/1000,2),
 viewers:viewerResults.length,sessions:viewerResults.length*protocol.seeds.length,cohorts,types,...decide(viewerResults,protocol,Boolean(max||partition)),viewerResults};
writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({output,decision:report.decision,candidateGates:report.candidateGates}));
