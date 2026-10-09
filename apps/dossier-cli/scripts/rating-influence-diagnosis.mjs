import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { featureVector, scoreCandidates, scoreCandidate, buildTasteSpace, ratingWeight, cosineSimilarity, tasteClaimScoreAdjustment, DEFAULT_SCORING_PARAMS } from '@dossier/domain';
import { readCorroborationReport } from './corroboration-io.mjs';
import { replayLibrary } from './library-replay.mjs';
import { pairAccuracy } from './corroboration-ranking.mjs';
import { average, key, round } from './hard-metrics.mjs';

const source='reports/corroboration-v1.jsonl.gz', report=await readCorroborationReport(source);
const fixture=JSON.parse(readFileSync(report.protocol.fixture.path));
const catalogue=new Map(fixture.items.map(i=>[key(i),{...i,features:featureVector(i)}]));
const arms=['current','local','local_recent'], summaries={}, selections=new Map();
for(const arm of arms){
  const groups={};
  for(const viewer of report.viewerResults)for(const session of viewer.sessions)for(const step of session.steps.filter(s=>s.count>10&&!s.mistake)){
    const history=session.steps.slice(0,step.count-1).some(s=>s.mistake)?'earlier_mistakes':'clean';
    const group=`${history}/${viewer.type}`;
    (groups[group]??=[]).push({viewer:viewer.viewer,seed:session.seed,count:step.count,delta:step.phaseDeltas[arm],arm,history});
  }
  summaries[arm]=Object.fromEntries(Object.entries(groups).map(([group,rows])=>{
    const sorted=rows.slice().sort((a,b)=>a.delta-b.delta);
    for(const row of [...sorted.slice(0,2),...sorted.slice(-2)])selections.set(`${arm}/${row.viewer}/${row.seed}/${row.count}`,row);
    return [group,{updates:rows.length,meanDelta:round(average(rows.map(r=>r.delta))),harmful:rows.filter(r=>r.delta<0).length,
      beneficial:rows.filter(r=>r.delta>0).length,largeLosses:rows.filter(r=>r.delta<-.05).length,worst:sorted[0],best:sorted.at(-1)}];
  }));
}
const publish=rows=>Object.fromEntries(rows.map(r=>[key(r.item),Math.round(r.score*1000)/1000||0]));
const same=(a,b)=>assert.deepEqual(Object.entries(a).sort(),Object.entries(b).sort());
const cases=[];
for(const selected of selections.values()){
  const viewer=report.viewerResults.find(v=>v.viewer===selected.viewer), actor=fixture.viewers.find(v=>v.id===selected.viewer);
  const session=viewer.sessions.find(s=>s.seed===selected.seed),step=session.steps[selected.count-1],prior=session.steps[selected.count-2];
  const before=replayLibrary(session.events.slice(0,selected.count-1),catalogue),after=replayLibrary(session.events.slice(0,selected.count),catalogue);
  const entries=Object.values(before.ratings),newEntry=after.ratings[step.event.key],pool=actor.holdoutKeys.map(k=>catalogue.get(k));
  const truth=actor.type==='changing_taste'&&selected.count<=30?actor.oldRatings:actor.ratings;
  const time=step.event.ts,options=selected.arm==='current'?{}:{localEvidence:selected.arm==='local'?'timeless':'recent',referenceTime:time};
  const stages={before:prior.scores[selected.arm]};
  stages.clock=publish(scoreCandidates(pool,entries,DEFAULT_SCORING_PARAMS,before.tasteClaims,options));
  if(selected.arm==='current'){
    const old=buildTasteSpace(entries).clusters, singleton=buildTasteSpace([newEntry]).clusters;
    const combined=[...old,...singleton];
    const rawBefore=new Map(scoreCandidates(pool,entries,DEFAULT_SCORING_PARAMS,before.tasteClaims).map(r=>[key(r.item),r.score]));
    stages.direct=publish(pool.map(item=>{
      const oldLiked=old.filter(c=>c.polarity==='liked'),oldDisliked=old.filter(c=>c.polarity==='disliked');
      const affinity=c=>Math.max(0,cosineSimilarity(item.features,c.centroid))*c.confidence;
      let added=0;
      if(singleton[0]?.polarity==='liked'){
        const ranked=[...oldLiked,...singleton].map(c=>({c,value:affinity(c)})).sort((a,b)=>b.value-a.value);
        if(ranked.slice(0,3).some(r=>r.c===singleton[0]))added=affinity(singleton[0])/Math.max(1,Math.min(3,oldLiked.length));
      }else if(singleton[0]&&affinity(singleton[0])>Math.max(0,...oldDisliked.map(affinity))&&oldLiked.length)added=-DEFAULT_SCORING_PARAMS.dislikePenalty*affinity(singleton[0]);
      return {item,score:(rawBefore.get(key(item))??0)+added};
    }));
    stages.routing=publish(pool.map(item=>({item,score:scoreCandidate(item,combined.filter(c=>c.polarity==='liked'),combined.filter(c=>c.polarity==='disliked'))+tasteClaimScoreAdjustment(item,before.tasteClaims)})));
    stages.previousEvidence=publish(scoreCandidates(pool,Object.values(after.ratings),DEFAULT_SCORING_PARAMS,before.tasteClaims,options));
  }else{
    const recent=selected.arm==='local_recent';
    const terms=item=>entries.map(e=>{
      const weight=Math.max(0,cosineSimilarity(item.features,e.item.features))**4*Math.abs(ratingWeight(e.rating))*(recent?2**(-Math.max(0,time-e.ts)/(86400000*30)):1);
      return {weight,signed:weight*Math.sign(ratingWeight(e.rating))};
    });
    stages.direct=publish(pool.map(item=>{
      const old=terms(item),denominator=2+old.reduce((a,t)=>a+t.weight,0),numerator=old.reduce((a,t)=>a+t.signed,0);
      const weight=Math.max(0,cosineSimilarity(item.features,newEntry.item.features))**4*Math.abs(ratingWeight(newEntry.rating));
      return {item,score:(numerator+weight*Math.sign(ratingWeight(newEntry.rating)))/denominator+ tasteClaimScoreAdjustment(item,before.tasteClaims)};
    }));
    stages.previousEvidence=publish(scoreCandidates(pool,Object.values(after.ratings),DEFAULT_SCORING_PARAMS,before.tasteClaims,options));
  }
  stages.claims=publish(scoreCandidates(pool,Object.values(after.ratings),DEFAULT_SCORING_PARAMS,after.tasteClaims,options));
  same(stages.claims,step.scores[selected.arm]);
  const oldOptions=selected.arm==='current'?{}:{...options,referenceTime:prior.event.ts};
  same(publish(scoreCandidates(pool,entries,DEFAULT_SCORING_PARAMS,before.tasteClaims,oldOptions)),stages.before);
  const auc=Object.fromEntries(Object.entries(stages).map(([s,scores])=>[s,pairAccuracy(scores,truth,actor.holdoutKeys)]));
  const titles=pool.map(item=>({key:key(item),title:item.title,taste:truth[key(item)],similarityToNew:cosineSimilarity(item.features,newEntry.item.features),
    scores:Object.fromEntries(Object.entries(stages).map(([s,scores])=>[s,scores[key(item)]??0])),delta:(stages.claims[key(item)]??0)-(stages.before[key(item)]??0)}));
  const harmedPairs=[],helpedPairs=[];
  for(const liked of titles.filter(i=>i.taste>0))for(const disliked of titles.filter(i=>i.taste<0)){
    const win=(s)=>liked.scores[s]>disliked.scores[s]?1:liked.scores[s]===disliked.scores[s]?.5:0;
    const change=win('claims')-win('before');
    if(change) (change<0?harmedPairs:helpedPairs).push({liked:liked.key,disliked:disliked.key,change,similarities:[liked.similarityToNew,disliked.similarityToNew],
      stageWins:Object.fromEntries(Object.keys(stages).map(s=>[s,win(s)]))});
  }
  cases.push({...selected,event:step.event,accurate:true,type:actor.type,auc,
    newTitle:newEntry.item.title,nearestEarlierSimilarity:Math.max(0,...entries.map(e=>cosineSimilarity(e.item.features,newEntry.item.features))),
    componentDeltas:Object.fromEntries(Object.keys(stages).slice(1).map((s,i)=>[s,round(auc[s]-auc[Object.keys(stages)[i]])])),
    claimsBefore:before.tasteClaims,claimsAfter:after.tasteClaims,events:session.events.slice(0,selected.count),titles,harmedPairs,helpedPairs});
}
const metadataContradictions=fixture.viewers.map(actor=>{
  const conflicts=[];
  for(const [i,a]of fixture.items.entries())for(const b of fixture.items.slice(i+1))if(actor.ratings[key(a)]*actor.ratings[key(b)]<0){
    const vector=JSON.stringify(a.features)===JSON.stringify(b.features);
    const metadata=JSON.stringify([a.genres,a.keywords,a.runtime,a.year])===JSON.stringify([b.genres,b.keywords,b.runtime,b.year]);
    if(vector||metadata)conflicts.push({a:key(a),b:key(b),vector,metadata});
  }
  return {viewer:actor.id,type:actor.type,conflicts};
});
const output={version:'rating-influence-mechanisms-v1',postHoc:true,sourceHash:createHash('sha256').update(readFileSync(source)).digest('hex'),summaries,cases,metadataContradictions,
  limitations:['All accurate updates after ten ratings are summarized. Replays select two largest harms and benefits per arm and history/type stratum.',
    'Sequential ablations depend on path and are not additive causal population estimates.',
    'Current direct stage adds only the new eligible cluster term while retaining old terms and divisor. Routing then applies top-K membership/divisor and max-dislike replacement. Previous-evidence measures merging and confidence changes.',
    'Local direct stage freezes the old denominator; previous-evidence stage applies the new denominator. Individual raw old kernel weights never change.',
    'Clock aging and claim transitions are separate. Both sides use the same contemporaneous taste. Completed cohorts diagnose mechanisms only.']};
writeFileSync('reports/rating-influence-mechanisms-v1.json',JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({replays:cases.length,byArm:Object.fromEntries(arms.map(arm=>[arm,{replays:cases.filter(c=>c.arm===arm).length,
  ...Object.fromEntries(['clock','direct','previousEvidence','claims'].map(s=>[s,{harmful:cases.filter(c=>c.arm===arm&&c.componentDeltas[s]<0).length,beneficial:cases.filter(c=>c.arm===arm&&c.componentDeltas[s]>0).length}]))}]))}));
