import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { average, round } from './hard-metrics.mjs';
import { meanInterval } from './real-metrics.mjs';
import { readCorroborationReport } from './corroboration-io.mjs';
import assert from 'node:assert/strict';
import { featureVector, ratingWeight, cosineSimilarity, tasteClaimScoreAdjustment } from '@dossier/domain';
import { replayLibrary } from './library-replay.mjs';
import { CORROBORATION_CONFIG, createCorroborationScorer } from './corroboration-policy.mjs';
import { pairAccuracy } from './corroboration-ranking.mjs';
const path='reports/corroboration-v1.jsonl.gz',report=await readCorroborationReport(path);
const comparisons={};
for(const partition of ['sealed','confirmation']){
  const people=report.viewerResults.filter(v=>v.partition===partition);
  const steps=people.flatMap(v=>v.sessions.flatMap(s=>s.steps.filter(x=>x.count>10).map(step=>({viewer:v.viewer,type:v.type,seed:s.seed,...step}))));
  const categories={accurate:steps.filter(s=>!s.mistake&&s.type!=='changing_taste'),mistakes:steps.filter(s=>s.mistake),
    earlierTaste:steps.filter(s=>s.type==='changing_taste'&&s.count<=30),adaptation:steps.filter(s=>s.type==='changing_taste'&&s.count>30)};
  const categoryEffects=Object.fromEntries(Object.entries(categories).map(([name,rows])=>[name,{updates:rows.length,
    arms:Object.fromEntries(report.protocol.arms.map(arm=>[arm,{meanDelta:round(average(rows.map(s=>s.phaseDeltas[arm]))),
      worstDelta:round(Math.min(0,...rows.map(s=>s.phaseDeltas[arm]))),largeLossRate:round(rows.filter(s=>s.phaseDeltas[arm]<-.05).length/Math.max(1,rows.length))}]))}]));
  const componentGains=Object.fromEntries(['supported_local','supported_recent','supported_claims_local','supported_claims_recent'].map(arm=>{
    const control=arm.includes('claims')?arm.replace('_claims',''):arm.endsWith('recent')?'local_recent':'local';
    const deltas=people.map(v=>average(v.sessions.map(s=>s.steps.at(-1).measures[arm].auc-s.steps.at(-1).measures[control].auc)));
    return [arm,{control,gain:meanInterval(deltas)}];
  }));
  const curves=Object.fromEntries(report.protocol.checkpoints.map(count=>[count,Object.fromEntries(report.protocol.arms.map(arm=>{
    const deltas=people.map(v=>average(v.sessions.map(s=>{const step=s.steps.find(x=>x.count===count);return step.phase[arm].auc-step.phase.current.auc;})));
    return [arm,meanInterval(deltas)];
  }))]));
  const worst=Object.fromEntries(report.protocol.arms.map(arm=>{
    const selected=[...steps].sort((a,b)=>a.phaseDeltas[arm]-b.phaseDeltas[arm])[0];
    return [arm,{viewer:selected.viewer,type:selected.type,seed:selected.seed,count:selected.count,event:selected.event,mistake:selected.mistake,
      before:selected.phaseBefore[arm],after:selected.phase[arm].auc,delta:selected.phaseDeltas[arm]}];
  }));
  comparisons[partition]={categoryEffects,componentGains,curves,worst};
}
const sessions=report.viewerResults.flatMap(v=>v.sessions),same=(a,b)=>Object.keys(a).length===Object.keys(b).length&&Object.entries(a).every(([key,value])=>b[key]===value);
const restoration={sessions:sessions.length,changedClaimRecords:sessions.filter(s=>s.claimHistoryChanged).length,
  scoreMismatches:Object.fromEntries(report.protocol.arms.map(arm=>[arm,sessions.filter(s=>!same(s.restorationScores[arm],s.steps.at(-1).scores[arm])).length]))};
const selected=comparisons.confirmation.worst.supported_claims_local;
const viewer=report.viewerResults.find(v=>v.viewer===selected.viewer),session=viewer.sessions.find(s=>s.seed===selected.seed);
const fixture=JSON.parse(readFileSync(report.protocol.fixture.path)),actor=fixture.viewers.find(v=>v.id===selected.viewer);
const catalogue=new Map(fixture.items.map(i=>[`movie:${i.id}`,{...i,features:featureVector(i)}])),pool=actor.holdoutKeys.map(k=>catalogue.get(k));
const before=replayLibrary(session.events.slice(0,selected.count-1),catalogue),after=replayLibrary(session.events.slice(0,selected.count),catalogue);
const scorer=createCorroborationScorer(),oldPolicy=scorer(pool,Object.values(before.ratings),before.tasteClaims,'timeless',true,0,selected.event.ts),
  newPolicy=scorer(pool,Object.values(after.ratings),after.tasteClaims,'timeless',true,0,selected.event.ts);
function contributions(state,policy){
  const gates=new Map(policy.evidence.map(e=>[e.key,e]));
  return new Map(pool.map(item=>[`${item.medium}:${item.id}`,Object.fromEntries(Object.values(state.ratings).sort((a,b)=>a.item.key.localeCompare(b.item.key)).map(entry=>{
    const evidence=gates.get(entry.item.key),weight=Math.max(0,cosineSimilarity(item.features,entry.item.features))**CORROBORATION_CONFIG.power
      *Math.abs(ratingWeight(entry.rating))/evidence.duplicateCount*evidence.gate;
    return [entry.item.key,{weight,signed:weight*Math.sign(ratingWeight(entry.rating))}];
  }))]));
}
function effectiveClaims(state,policy){const gates=new Map(policy.claims.map(c=>[c.id,c.gate]));return state.tasteClaims.map(c=>({...c,confidence:c.confidence*gates.get(c.id)}));}
const oldContributions=contributions(before,oldPolicy),newContributions=contributions(after,newPolicy),oldClaims=effectiveClaims(before,oldPolicy),newClaims=effectiveClaims(after,newPolicy);
function measure(base,claims,addNew=false){
  const scores=Object.fromEntries(pool.map(item=>{
    const k=`${item.medium}:${item.id}`,terms={...base.get(k)};
    if(addNew)terms[selected.event.key]=newContributions.get(k)[selected.event.key];
    let numerator=0,denominator=CORROBORATION_CONFIG.prior;
    for(const [,term]of Object.entries(terms).sort(([a],[b])=>a.localeCompare(b))){numerator+=term.signed;denominator+=term.weight;}
    return [k,(Math.round((numerator/denominator+tasteClaimScoreAdjustment(item,claims))*1000)/1000)||0];
  }));
  const truth=actor.type==='changing_taste'&&selected.count<=30?actor.oldRatings:actor.ratings;
  return {scores,auc:pairAccuracy(scores,truth,actor.holdoutKeys)};
}
const original=measure(oldContributions,oldClaims),final=measure(newContributions,newClaims);
assert(same(original.scores,session.steps[selected.count-2].scores.supported_claims_local));
assert(same(final.scores,session.steps[selected.count-1].scores.supported_claims_local));
const accurateUpdateSwap={viewer:selected.viewer,seed:selected.seed,count:selected.count,event:selected.event,mistake:selected.mistake,
  before:original.auc,onlyNewTitleWithOldEvidenceAndClaims:measure(oldContributions,oldClaims,true).auc,
  allEvidenceReweightedWithOldClaims:measure(newContributions,oldClaims).auc,after:final.auc,
  limitation:'One exploratory accurate-update replay. The component path isolates new-title evidence, recomputation of previous evidence weights, and effective claim changes. It is not a validated replacement policy.'};
const diagnostics={version:'corroboration-diagnostics-v1',postHoc:true,sourceHash:createHash('sha256').update(readFileSync(path)).digest('hex'),
  comparisons,restoration,accurateUpdateSwap,decisionUnchanged:true,
  limitation:'Category averages count updates and are descriptive. Component and curve intervals average sessions within people. These post-hoc summaries diagnose the recorded run; they do not tune candidates or relax its frozen adoption requirements.'};
writeFileSync('reports/corroboration-diagnostics-v1.json',JSON.stringify(diagnostics,null,2)+'\n');
console.log(JSON.stringify({sourceHash:diagnostics.sourceHash,restoration}));
