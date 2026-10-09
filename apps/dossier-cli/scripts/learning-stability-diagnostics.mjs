import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { featureVector, scoreLocalEvidence, tasteClaimScoreAdjustment } from '@dossier/domain';
import { replayLibrary } from './library-replay.mjs';
import { assess, key, round } from './hard-metrics.mjs';
const bytes=readFileSync('reports/learning-stability-v1.json.gz'),report=JSON.parse(gunzipSync(bytes));
const fixture=JSON.parse(readFileSync(report.protocol.fixture.path));
const catalogue=new Map(fixture.items.map(i=>[key(i),{...i,features:featureVector(i)}]));
const phaseAware=Object.fromEntries(report.protocol.arms.map(arm=>{
 const updates=report.viewerResults.filter(v=>v.partition==='sealed').flatMap(v=>{
  const actor=fixture.viewers.find(a=>a.id===v.viewer),pool=actor.holdoutKeys.map(k=>catalogue.get(k));
  return v.sessions.flatMap(s=>s.steps.filter(step=>step.count>10).map(step=>{
   const truth=actor.type==='changing_taste'&&step.count<=30?actor.oldRatings:actor.ratings;
   const previous=s.steps[step.count-2];
   const score=frame=>assess(frame.scores[arm],pool,truth,Object.keys(frame.scores[arm]).length>0).auc;
   return {viewer:v.viewer,type:v.type,seed:s.seed,count:step.count,delta:round(score(step)-score(previous))};
  }));
 });
 updates.sort((a,b)=>a.delta-b.delta);
 return [arm,{updates:updates.length,worst:updates[0],largeLossRate:round(updates.filter(x=>x.delta<-.05).length/updates.length)}];
}));
const sessions=report.viewerResults.flatMap(v=>v.sessions);
const sameScores=(a,b)=>Object.keys(a).length===Object.keys(b).length&&Object.entries(a).every(([k,value])=>b[k]===value);
const restoration={sessions:sessions.length,changedClaimRecords:sessions.filter(s=>s.claimHistoryChanged).length,
 scoreMismatches:Object.fromEntries(['local','local_recent'].map(arm=>[arm,sessions.filter(s=>!sameScores(s.restorationScores[arm],s.steps.at(-1).scores[arm])).length]))};
assert.equal(restoration.scoreMismatches.local,0);assert.equal(restoration.scoreMismatches.local_recent,0);
const cases=[];
for(const arm of ['local','local_recent']){
 const available=report.viewerResults.filter(v=>v.partition==='sealed').flatMap(v=>v.sessions.flatMap(s=>s.steps.filter(x=>x.count>10).map(step=>({v,s,step}))));
 available.sort((a,b)=>a.step.deltas[arm]-b.step.deltas[arm]);
 const {v,s,step}=available[0],actor=fixture.viewers.find(a=>a.id===v.viewer);
 const before=replayLibrary(s.events.slice(0,step.count-1),catalogue),after=replayLibrary(s.events.slice(0,step.count),catalogue);
 const pool=actor.holdoutKeys.map(k=>catalogue.get(k)),mode=arm==='local'?'timeless':'recent';
 const rows=(state,claims,time)=>scoreLocalEvidence(pool,Object.values(state.ratings),claims,mode,0,time);
 const publish=rows=>Object.fromEntries(rows.map(r=>[key(r.item),Math.round(r.score*1000)/1000]));
 const score=rows=>assess(publish(rows),pool,actor.ratings,rows.length>0).auc;
 const oldTime=s.events[step.count-2].ts,newTime=step.event.ts;
 const oldKernel=rows(before,[],oldTime),newKernel=rows(after,[],newTime);
 const swap=(kernel,claims)=>kernel.map(r=>({...r,score:r.score+tasteClaimScoreAdjustment(r.item,claims)}));
 const original=score(swap(oldKernel,before.tasteClaims)),final=score(swap(newKernel,after.tasteClaims));
 assert.equal(original,s.steps[step.count-2].measures[arm].auc);assert.equal(final,step.measures[arm].auc);
 cases.push({arm,viewer:v.viewer,type:v.type,seed:s.seed,count:step.count,event:step.event,
  before:original,after:final,delta:round(final-original),
  suppliedPhase:actor.type==='changing_taste'&&step.count<=30?'earlier_taste':'current_taste',
  beforeUnderSuppliedPhase:assess(publish(swap(oldKernel,before.tasteClaims)),pool,actor.type==='changing_taste'&&step.count<=30?actor.oldRatings:actor.ratings).auc,
  afterUnderSuppliedPhase:assess(publish(swap(newKernel,after.tasteClaims)),pool,actor.type==='changing_taste'&&step.count<=30?actor.oldRatings:actor.ratings).auc,
  newKernelOldClaims:score(swap(newKernel,before.tasteClaims)),oldKernelNewClaims:score(swap(oldKernel,after.tasteClaims)),
  claimsChanged:JSON.stringify(before.tasteClaims)!==JSON.stringify(after.tasteClaims),
  claimCountBefore:before.tasteClaims.filter(c=>c.active).length,claimCountAfter:after.tasteClaims.filter(c=>c.active).length});
}
const result={version:'learning-stability-diagnostics-v1',postHoc:true,
 sourceHash:createHash('sha256').update(bytes).digest('hex'),phaseAware,restoration,cases,
 limitation:'Phase-aware summaries revisit all reserved updates without replacing frozen requirements. Component swaps diagnose the two largest frozen-metric local losses. These analyses are exploratory replays, not independent confirmation, candidate selection, or deployable fixes. Recency time advance belongs to the kernel component.'};
writeFileSync('reports/learning-stability-diagnostics-v1.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
