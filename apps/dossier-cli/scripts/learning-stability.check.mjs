import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createDefaultState, setLibraryRating, ratingWeight, tasteClaimScoreAdjustment, LOCAL_EVIDENCE_CONFIG, featureVector } from '@dossier/domain';
import { cosine, key, random, shuffled } from './hard-metrics.mjs';
import { summarize, decision } from './learning-stability-metrics.mjs';
process.chdir(fileURLToPath(new URL('../../..',import.meta.url)));
const hash=b=>createHash('sha256').update(b).digest('hex');
function auc(scores,truth,keys){
 let wins=0,pairs=0;
 for(const a of keys)if(truth[a]>0)for(const b of keys)if(truth[b]<0){
  const difference=(scores[a]??0)-(scores[b]??0);wins+=difference>0?1:difference===0?.5:0;pairs++;
 }
 return Number((pairs?wins/pairs:.5).toFixed(4));
}
export function auditReport(report){
 const p=report.protocol,fixture=JSON.parse(readFileSync(p.fixture.path));
 const protocolPath='apps/dossier-cli/benchmarks/learning-stability-v1-protocol.json';
 const referencePath='apps/dossier-cli/benchmarks/learning-stability-v1-reference.json';
 assert.deepEqual(p,JSON.parse(readFileSync(protocolPath)));
 assert.equal(report.protocolHash,hash(readFileSync(protocolPath)));
 assert.equal(report.referenceHash,hash(readFileSync(referencePath)));
 const reference=JSON.parse(readFileSync(referencePath));
 for(const [path,expected]of Object.entries({...reference.sourceHashes,...reference.historicalHashes}))assert.equal(hash(readFileSync(path)),expected);
 assert.equal(hash(readFileSync(p.fixture.path)),p.fixture.sha256);
 assert.equal(report.viewers,report.viewerResults.length);
 assert.equal(report.sessions,report.viewerResults.flatMap(v=>v.sessions).length);
 assert.equal(new Set(report.viewerResults.map(v=>v.viewer)).size,report.viewers);
 if(report.decision.status!=='smoke_only')assert.deepEqual(report.viewerResults.map(v=>v.viewer).sort(),fixture.viewers.map(v=>v.id).sort());
 const items=new Map(fixture.items.map(i=>[key(i),{...i,features:featureVector(i)}])),actors=new Map(fixture.viewers.map(v=>[v.id,v]));
 let ratingChecks=0,rankingChecks=0,localChecks=0;
 for(const v of report.viewerResults)for(const s of v.sessions){
  const actor=actors.get(v.viewer);assert(actor);assert.equal(v.partition,actor.partition);assert.equal(v.type,actor.type);
  const order=shuffled(actor.trainingKeys,actor.seed+s.seed).slice(0,60),rng=random(actor.seed+s.seed+981);
  assert.deepEqual(v.sessions.map(s=>s.seed),p.seeds);assert.equal(s.steps.length,p.ratings);
  assert.deepEqual(s.events,s.steps.map(x=>x.event));
  let state=createDefaultState(),previous=null;
  for(const [index,step]of s.steps.entries()){
   const count=index+1,event=step.event,k=order[index];assert.equal(event.key,k);
   assert.equal(step.count,count);
   assert(!actor.holdoutKeys.includes(k));
   const truth=actor.type==='changing_taste'&&count<=30?actor.oldRatings:actor.ratings;
   const expected=rng()<actor.noise?-truth[k]:truth[k];assert.equal(event.rating,expected||0);
   assert.equal(event.ts,p.clock.start+count*p.clock.stepDays*86400000);
   const raw=items.get(k),snapshot={key:k,medium:raw.medium,id:raw.id,title:raw.title,year:raw.year,posterPath:raw.posterPath,
    voteAverage:raw.voteAverage,genres:raw.genres,keywords:raw.keywords,collection:raw.collection,directorIds:raw.directorIds,creatorIds:raw.creatorIds,features:raw.features};
   state=setLibraryRating(state,k,event.rating,snapshot,event.ts);ratingChecks++;
   for(const arm of p.arms){
    assert.equal(step.measures[arm].auc,auc(step.scores[arm],actor.ratings,actor.holdoutKeys));rankingChecks++;
    assert.equal(step.deltas[arm],previous?Number((step.measures[arm].auc-previous.measures[arm].auc).toFixed(4)):0);
   }
   for(const arm of ['local','local_recent']){
    const observed=Object.values(state.ratings).sort((a,b)=>a.item.key.localeCompare(b.item.key));
    const positive=observed.some(e=>ratingWeight(e.rating)>0);
    for(const candidateKey of actor.holdoutKeys){
     const item=items.get(candidateKey);
     if(!positive){assert.equal(step.scores[arm][candidateKey],undefined);continue;}
     let signed=0,total=LOCAL_EVIDENCE_CONFIG.prior;
     for(const e of observed){const r=ratingWeight(e.rating);if(!r)continue;
      const proximity=Math.max(0,cosine(item.features,e.item.features));
      const decay=arm==='local_recent'?Math.pow(.5,Math.max(0,event.ts-e.ts)/(86400000*LOCAL_EVIDENCE_CONFIG.halfLifeDays)):1;
      const w=Math.pow(proximity,LOCAL_EVIDENCE_CONFIG.power)*Math.abs(r)*decay;
      signed+=w*(r>0?1:-1);total+=w;
     }
     const score=signed/total+tasteClaimScoreAdjustment(item,state.tasteClaims);
     assert(step.scores[arm][candidateKey]===Math.round(score*1000)/1000);localChecks++;
    }
   }
   previous=step;
  }
  for(const [k,e]of Object.entries(state.ratings))assert.deepEqual(e,s.finalProfile.ratings[k]);
  assert.deepEqual(state.tasteClaims,s.finalProfile.tasteClaims);
 }
 for(const partition of ['development','sealed'])assert.deepEqual(report.cohorts[partition],summarize(report.viewerResults.filter(v=>v.partition===partition),p));
 assert.deepEqual(report.candidateGates,decision(report.viewerResults,report.failures,p,report.decision.status==='smoke_only').candidateGates);
 assert.deepEqual(report.decision,decision(report.viewerResults,report.failures,p,report.decision.status==='smoke_only').decision);
 return {ratingChecks,rankingChecks,localChecks};
}
test('independent pair counting handles ties and missing recommendation scores',()=>{
 assert.equal(auc({a:1,b:0},{a:2,b:-2},['a','b']),1);
 assert.equal(auc({a:0,b:0},{a:2,b:-2},['a','b']),.5);
 assert.equal(auc({},{a:2,b:-2},['a','b']),.5);
});
const reportPath=process.argv.includes('--report')?process.argv[process.argv.indexOf('--report')+1]:'reports/learning-stability-v1.json.gz';
if(existsSync(reportPath))test('saved stability traces reproduce supplied evidence and local scoring',()=>{
 const bytes=readFileSync(reportPath),report=JSON.parse(reportPath.endsWith('.gz')?gunzipSync(bytes):bytes);
 const checks=auditReport(report);console.log(JSON.stringify(checks));
 if(report.decision.status!=='smoke_only'){
  const path='reports/learning-stability-verification-v1.json';
  const previous=existsSync(path)?JSON.parse(readFileSync(path)):{};
  const retained=previous.reportHash===hash(bytes)?previous:{};
  writeFileSync(path,JSON.stringify({...retained,version:report.version,reportHash:hash(bytes),checks,independentAuditPassed:true},null,2)+'\n');
 }
});
