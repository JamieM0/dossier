import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createDefaultState, setLibraryRating, ratingWeight, matchesTasteClaim, tasteClaimScoreAdjustment, featureVector, scoreCandidates, DEFAULT_SCORING_PARAMS } from '@dossier/domain';
import { key, shuffled, cosine, round } from './hard-metrics.mjs';
import { summarizeCorroboration, corroborationDecision } from './corroboration-metrics.mjs';
import { readCorroborationReport } from './corroboration-io.mjs';
process.chdir(fileURLToPath(new URL('../../..',import.meta.url)));
const hash=b=>createHash('sha256').update(b).digest('hex');
export function pairAccuracy(scores,truth,keys){
  let wins=0,pairs=0;
  for(const liked of keys)if(truth[liked]>0)for(const disliked of keys)if(truth[disliked]<0){
    const delta=(scores[liked]??0)-(scores[disliked]??0);wins+=delta>0?1:delta===0?.5:0;pairs++;
  }
  return round(pairs?wins/pairs:.5);
}
function snapshot(item){
  return {key:key(item),medium:item.medium,id:item.id,title:item.title,year:item.year,posterPath:item.posterPath,voteAverage:item.voteAverage,
    genres:item.genres,keywords:item.keywords,collection:item.collection,directorIds:item.directorIds,creatorIds:item.creatorIds,features:item.features};
}
function independentScorer(config){
  const cache=new Map();
  const similarity=(a,b)=>{
    const id=[a.key??key(a),b.key??key(b)].sort().join('|');
    if(!cache.has(id))cache.set(id,Math.max(0,cosine(a.features,b.features)));return cache.get(id);
  };
  return (state,items,time,arm)=>{
    const entries=Object.values(state.ratings).sort((a,b)=>a.item.key.localeCompare(b.item.key));
    if(!entries.some(e=>ratingWeight(e.rating)>0))return {};
    const recent=arm.endsWith('recent'),supported=arm.startsWith('supported');
    const weight=e=>Math.abs(ratingWeight(e.rating))*(recent?Math.pow(.5,Math.max(0,time-e.ts)/(86400000*config.halfLifeDays)):1);
    const values=entries.map(weight);
    const densities=entries.map(e=>entries.filter(other=>ratingWeight(e.rating)*ratingWeight(other.rating)>0&&similarity(e.item,other.item)>=config.duplicateCosine).length||1);
    const amounts=entries.map((_,i)=>supported?values[i]/densities[i]:values[i]);
    const gates=entries.map((e,i)=>{
      if(!supported)return 1;
      let agrees=0,disagrees=0;
      for(const [j,other]of entries.entries())if(j!==i&&amounts[j]){
        const w=Math.pow(similarity(e.item,other.item),config.power)*amounts[j];
        if(ratingWeight(e.rating)*ratingWeight(other.rating)>0)agrees+=w;else disagrees+=w;
      }
      return agrees/(config.prior+agrees+disagrees);
    });
    const claims=state.tasteClaims.map(claim=>{
      if(!arm.includes('claims')||!claim.active||claim.provenance!=='inferred')return claim;
      const support=[],counter=[];
      entries.forEach((entry,i)=>{
        if(!amounts[i]||!matchesTasteClaim(entry.item,claim))return;
        ((ratingWeight(entry.rating)>0)===(claim.effect==='positive')?support:counter).push(amounts[i]);
      });
      const s=support.reduce((a,b)=>a+b,0),c=counter.reduce((a,b)=>a+b,0);
      return {...claim,confidence:claim.confidence*Math.max(0,s-Math.max(0,...support))/(config.prior+s+c)};
    });
    return Object.fromEntries(items.filter(item=>Object.values(item.features).some(v=>v!==0)).map(item=>{
      let sum=0,total=config.prior;
      entries.forEach((entry,i)=>{
        const w=Math.pow(similarity(item,entry.item),config.power)*amounts[i]*gates[i];
        sum+=w*(ratingWeight(entry.rating)>0?1:ratingWeight(entry.rating)<0?-1:0);total+=w;
      });
      const quality=item.voteAverage==null?0:(item.voteAverage/10-.5)*2;
      return [key(item),(Math.round((sum/total+DEFAULT_SCORING_PARAMS.qualityWeight*quality+tasteClaimScoreAdjustment(item,claims))*1000)/1000)||0];
    }));
  };
}
export function auditCorroboration(report){
  const p=report.protocol,fixture=JSON.parse(readFileSync(p.fixture.path));
  const protocolPath='apps/dossier-cli/benchmarks/corroboration-v1-protocol.json',referencePath='apps/dossier-cli/benchmarks/corroboration-v1-reference.json';
  assert.deepEqual(p,JSON.parse(readFileSync(protocolPath)));assert.equal(report.protocolHash,hash(readFileSync(protocolPath)));
  assert.equal(report.referenceHash,hash(readFileSync(referencePath)));assert.equal(p.fixture.sha256,hash(readFileSync(p.fixture.path)));
  const reference=JSON.parse(readFileSync(referencePath));
  const amendmentPath='apps/dossier-cli/benchmarks/corroboration-v1-output-amendment.json',amendment=JSON.parse(readFileSync(amendmentPath));
  assert.equal(report.serializationAmendmentHash,hash(readFileSync(amendmentPath)));assert.equal(amendment.referenceHash,report.referenceHash);
  assert.equal(hash(readFileSync(amendment.originalRunner.path)),reference.sourceHashes['apps/dossier-cli/scripts/corroboration-run.mjs']);
  for(const [path,h]of Object.entries({...reference.sourceHashes,...reference.historicalHashes,...amendment.sourceHashes}))assert.equal(hash(readFileSync(path)),h);
  const actors=new Map(fixture.viewers.map(v=>[v.id,v])),items=new Map(fixture.items.map(i=>[key(i),{...i,features:featureVector(i)}]));
  assert.equal(report.viewers,report.viewerResults.length);assert.equal(report.sessions,report.viewerResults.flatMap(v=>v.sessions).length);
  assert.equal(new Set(report.viewerResults.map(v=>v.viewer)).size,report.viewers);
  if(report.decision.status!=='smoke_only')assert.deepEqual(report.viewerResults.map(v=>v.viewer).sort(),fixture.viewers.map(v=>v.id).sort());
  const reconstruct=independentScorer(p.candidate);let ratings=0,rankings=0,policyScores=0,historicalSteps=0;
  for(const v of report.viewerResults)for(const s of v.sessions){
    const actor=actors.get(v.viewer);assert.equal(v.partition,actor.partition);assert.equal(v.type,actor.type);
    assert.deepEqual(v.sessions.map(s=>s.seed),p.seeds);assert.equal(s.steps.length,p.ratings);assert.deepEqual(s.events,s.steps.map(x=>x.event));
    const order=shuffled(actor.trainingKeys,actor.seed+s.seed).slice(0,p.ratings),pool=actor.holdoutKeys.map(k=>items.get(k));
    let state=createDefaultState(),previous=null;
    for(const [i,step]of s.steps.entries()){
      const count=i+1,k=order[i],truth=actor.type==='changing_taste'&&count<=p.changeAt?actor.oldRatings:actor.ratings;
      const mistaken=(actor.type==='isolated_noise'&&count===14)||(actor.type==='repeated_noise'&&count>=14&&count<=18)
        ||(actor.type==='biased_noise'&&count>=11&&count<=30&&items.get(k).genres.includes(actor.biasedGenre));
      const supplied=mistaken?(truth[k]===0?3:-truth[k]):truth[k];
      assert.equal(step.count,count);assert.equal(step.mistake,mistaken);assert.equal(step.event.key,k);assert(!actor.holdoutKeys.includes(k));
      assert.equal(step.event.rating,supplied||0);assert.equal(step.event.ts,p.clock.start+count*p.clock.stepDays*86400000);
      state=setLibraryRating(state,k,step.event.rating,snapshot(items.get(k)),step.event.ts);ratings++;
      for(const arm of p.arms){
        assert.equal(step.measures[arm].auc,pairAccuracy(step.scores[arm],actor.ratings,actor.holdoutKeys));
        assert.equal(step.phase[arm].auc,pairAccuracy(step.scores[arm],truth,actor.holdoutKeys));rankings+=2;
        const before=previous?pairAccuracy(previous.scores[arm],truth,actor.holdoutKeys):null;
        if(previous)assert.equal(step.phaseBefore[arm],before);else assert.equal(step.phaseBefore,null);
        assert.equal(step.phaseDeltas[arm],previous?round(step.phase[arm].auc-before):0);
        assert.equal(step.deltas[arm],previous?round(step.measures[arm].auc-previous.measures[arm].auc):0);
        if(arm!=='current'){
          const expected=reconstruct(state,pool,step.event.ts,arm);
          assert.deepEqual(Object.entries(step.scores[arm]).sort(),Object.entries(expected).sort(),`${v.viewer} ${s.seed} ${count} ${arm}`);
          policyScores+=Object.keys(expected).length;
        }else{
          const expected=Object.fromEntries(scoreCandidates(pool,Object.values(state.ratings),DEFAULT_SCORING_PARAMS,state.tasteClaims).map(r=>[key(r.item),(Math.round(r.score*1000)/1000)||0]));
          assert.deepEqual(Object.entries(step.scores.current).sort(),Object.entries(expected).sort());
        }
      }
      previous=step;
    }
    assert.deepEqual(state.ratings,s.finalProfile.ratings);assert.deepEqual(state.tasteClaims,s.finalProfile.tasteClaims);
    assert(Object.values(s.contracts).every(Boolean));
    assert(Object.entries(s.scorerRestoration).filter(([arm])=>arm!=='current').every(([,ok])=>ok));
    const restoredOrder=[...Object.entries(state.ratings).filter(([k])=>k!==order[0]),[order[0],state.ratings[order[0]]]].map(([,entry])=>entry);
    const restoredBaseline=Object.fromEntries(scoreCandidates(pool,restoredOrder,DEFAULT_SCORING_PARAMS,state.tasteClaims).map(r=>[key(r.item),(Math.round(r.score*1000)/1000)||0]));
    const same=Object.keys(restoredBaseline).length===Object.keys(s.steps.at(-1).scores.current).length&&Object.entries(restoredBaseline).every(([k,value])=>s.steps.at(-1).scores.current[k]===value);
    assert.equal(s.scorerRestoration.current,same,'Current scorer restoration must record its existing order sensitivity');
  }
  if(report.failures.length){
    const historical=JSON.parse(readFileSync('apps/dossier-cli/src/lab/real-tmdb-v1.json'));
    const catalogue=new Map(historical.items.map(i=>[key(i),{...i,features:featureVector(i)}])),calculate=independentScorer(p.candidate);
    const targets=JSON.parse(readFileSync('reports/backwards-learning-diagnosis-v1.json')).cases;
    assert.equal(report.failures.length,targets.length);
    for(const failure of report.failures){
      const actor=historical.viewers.find(v=>v.id===failure.viewer),target=targets.find(t=>t.viewer===failure.viewer&&t.seed===failure.seed);assert(target);
      const training=new Map(actor.trainingRatings.map(r=>[r.filmKey,r.rating])),order=shuffled([...training.keys()],failure.seed+actor.sourceUserId*1009);
      const truth=Object.fromEntries(actor.heldOutRatings.map(r=>[r.filmKey,r.rating])),keys=Object.keys(truth),pool=keys.map(k=>catalogue.get(k));
      let state=createDefaultState();assert.equal(failure.events.length,40);assert.equal(failure.steps.length,31);
      for(const [i,event]of failure.events.entries()){
        assert.equal(event.key,order[i]);assert.equal(event.rating,training.get(order[i]));assert(!keys.includes(event.key));
        assert.equal(event.ts,p.clock.start+(i+1)*p.clock.stepDays*86400000);
        state=setLibraryRating(state,event.key,event.rating,snapshot(catalogue.get(event.key)),event.ts);
        if(i<9)continue;
        const step=failure.steps[i-9];assert.equal(step.count,i+1);historicalSteps++;
        const baseline=Object.fromEntries(scoreCandidates(pool,Object.values(state.ratings),DEFAULT_SCORING_PARAMS,state.tasteClaims).map(r=>[key(r.item),(Math.round(r.score*1000)/1000)||0]));
        assert.deepEqual(Object.entries(step.scores.current).sort(),Object.entries(baseline).sort());
        for(const arm of p.arms){
          assert.equal(step.measures[arm].auc,pairAccuracy(step.scores[arm],truth,keys));
          assert.equal(step.deltas[arm],i>9?round(step.measures[arm].auc-failure.steps[i-10].measures[arm].auc):0);
          if(arm!=='current')assert.deepEqual(Object.entries(step.scores[arm]).sort(),Object.entries(calculate(state,pool,event.ts,arm)).sort());
        }
      }
      assert.equal(failure.steps[0].measures.current.auc,target.auc10);assert.equal(failure.steps.at(-1).measures.current.auc,target.auc40);
      for(const arm of p.arms){
        const f=failure.arms[arm],first=failure.steps[0].measures[arm].auc,last=failure.steps.at(-1).measures[arm].auc;
        assert.deepEqual(f,{auc10:first,auc40:last,change:round(last-first),gainCurrent40:round(last-failure.steps.at(-1).measures.current.auc),worstStep:round(Math.min(...failure.steps.slice(1).map(x=>x.deltas[arm])))});
      }
    }
  }
  for(const partition of ['development','sealed','confirmation'])assert.deepEqual(report.cohorts[partition],summarizeCorroboration(report.viewerResults.filter(v=>v.partition===partition),p));
  const decided=corroborationDecision(report.viewerResults,report.failures,p,report.decision.status==='smoke_only');
  assert.deepEqual(report.candidateGates,decided.candidateGates);assert.deepEqual(report.decision,decided.decision);
  return {ratings,rankings,policyScores,historicalSteps};
}
test('independent ranking counts ties and evaluates a change against one contemporaneous target',()=>{
  const before={a:1,b:0},after={a:1,b:0},old={a:3,b:-3},current={a:-3,b:3};
  assert.equal(pairAccuracy(before,old,['a','b']),1);assert.equal(pairAccuracy(after,current,['a','b']),0);
  assert.equal(pairAccuracy(after,current,['a','b'])-pairAccuracy(before,current,['a','b']),0);
  assert.equal(pairAccuracy({},current,['a','b']),.5);
});
const reportPath=process.argv.includes('--report')?process.argv[process.argv.indexOf('--report')+1]:'reports/corroboration-v1.jsonl.gz';
if(existsSync(reportPath))test('corroboration traces reproduce supplied ratings, both taste targets, and independent policy scores',async()=>{
  const bytes=readFileSync(reportPath),report=await readCorroborationReport(reportPath),checks=auditCorroboration(report);
  console.log(JSON.stringify(checks));
  if(report.decision.status!=='smoke_only'){
    const path='reports/corroboration-verification-v1.json',previous=existsSync(path)?JSON.parse(readFileSync(path)):{};
    writeFileSync(path,JSON.stringify({...(previous.reportHash===hash(bytes)?previous:{}),version:report.version,reportHash:hash(bytes),checks,independentAuditPassed:true},null,2)+'\n');
  }
});
