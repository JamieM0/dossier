import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { AXIS_KEYS, featureVector, ratingWeight, tasteClaimScoreAdjustment, scoreCandidates, DEFAULT_SCORING_PARAMS, createDefaultState, setLibraryRating } from '@dossier/domain';
import { key, cosine, shuffled, round, assess } from './hard-metrics.mjs';
import { pairAccuracy } from './corroboration-ranking.mjs';
import { replayLibrary } from './library-replay.mjs';
import { readCorroborationReport } from './corroboration-io.mjs';
import { influenceDecision } from './rating-influence-metrics.mjs';
import { createInfluenceScorer } from './rating-influence-policy.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
const publish=rows=>Object.fromEntries(rows.map(r=>[key(r.item),Math.round(r.score*1000)/1000||0]));
const similarities=new Map();
const independentSimilarity=(a,b)=>{
  const id=[a.key??key(a),b.key??key(b)].sort().join('|');
  if(!similarities.has(id))similarities.set(id,Math.max(0,cosine(a.features,b.features)));
  return similarities.get(id);
};

test('local exceptions contain contradictory transfer and additive evidence leaves old influence intact',()=>{
  const vector=(tone,pacing)=>Object.fromEntries(AXIS_KEYS.map(a=>[a,a==='tone'?tone:a==='pacing'?pacing:0]));
  const item=(id,features)=>({id,medium:'movie',key:`movie:${id}`,title:`Probe ${id}`,features,genres:[],keywords:[],voteAverage:null});
  const anchor=item(1,vector(1,0)),target=item(2,vector(.7,Math.sqrt(.51))),matched=item(3,vector(1,0));
  const time=1700000000000,entries=[{item:anchor,rating:3,ts:time-86400000}],newEntry={item:item(4,vector(1,0)),rating:-3,ts:time};
  const scorer=createInfluenceScorer();
  const before=scorer([target,matched],entries,[],'exception_recent',time),after=scorer([target,matched],[...entries,newEntry],[],'exception_recent',time);
  assert.equal(before.find(r=>r.item.id===2).score,after.find(r=>r.item.id===2).score);
  assert(after.find(r=>r.item.id===3).score<before.find(r=>r.item.id===3).score);
  const additiveBefore=scorer([target],entries,[],'additive_recent',time)[0].score;
  const additiveAfter=scorer([target],[...entries,newEntry],[],'additive_recent',time)[0].score;
  assert(Math.abs(additiveAfter-additiveBefore+( .7**4*2/2))<1e-12);
  const restored=scorer([target],entries,[],'additive_recent',time)[0].score;assert.equal(restored,additiveBefore);
});

// Independent formula reconstruction uses generic vector arithmetic, not candidate code.
export function independentScores(state,pool,time,arm,config){
  if(arm==='current')return publish(scoreCandidates(pool,Object.values(state.ratings),DEFAULT_SCORING_PARAMS,state.tasteClaims));
  const observations=Object.values(state.ratings).sort((a,b)=>a.ts-b.ts||a.item.key.localeCompare(b.item.key));
  if(!observations.some(e=>ratingWeight(e.rating)>0))return {};
  const recency=(e,t)=>arm==='local'?1:Math.pow(.5,Math.max(0,t-e.ts)/(86400000*config.halfLifeDays));
  const exceptional=[];
  for(const [i,e]of observations.entries()){
    let total=0,signed=0;
    if(arm==='exception_recent')for(const [j,earlier]of observations.slice(0,i).entries()){
      const sim=independentSimilarity(e.item,earlier.item);
      if(exceptional[j]&&sim<config.exceptionCosine)continue;
      const w=sim**4*Math.abs(ratingWeight(earlier.rating))*recency(earlier,e.ts);
      total+=w;signed+=w*Math.sign(ratingWeight(earlier.rating));
    }
    exceptional.push(arm==='exception_recent'&&total>=config.exceptionMass&&signed/(config.prior+total)*Math.sign(ratingWeight(e.rating)) < -config.exceptionMargin);
  }
  return Object.fromEntries(pool.filter(i=>Object.values(i.features).some(v=>v!==0)).map(item=>{
    let sum=0,total=config.prior;
    observations.forEach((e,i)=>{
      const sim=independentSimilarity(item,e.item);
      const weight=exceptional[i]&&sim<config.exceptionCosine?0:sim**(arm==='narrow_recent'?config.narrowPower:4)*Math.abs(ratingWeight(e.rating))*recency(e,time);
      sum+=weight*Math.sign(ratingWeight(e.rating));total+=weight;
    });
    const quality=item.voteAverage==null?0:(item.voteAverage/10-.5)*2;
    return [key(item),Math.round((sum/(arm==='additive_recent'?config.prior:total)+DEFAULT_SCORING_PARAMS.qualityWeight*quality+tasteClaimScoreAdjustment(item,state.tasteClaims))*1000)/1000||0];
  }));
}
test('independent policies preserve authoritative claims, inactive tombstones, and chronological restoration',()=>{
  const fixture=JSON.parse(readFileSync('apps/dossier-cli/src/lab/rating-influence-v1.json')),catalogue=new Map(fixture.catalogues.development.map(i=>[key(i),i]));
  const actor=fixture.viewers[0],events=actor.trainingKeys.slice(0,30).map((k,i)=>({key:k,rating:actor.ratings[k],ts:1000+i}));
  const state=replayLibrary(events,catalogue),pool=actor.holdoutKeys.map(k=>catalogue.get(k)),scorer=createInfluenceScorer();
  const config=JSON.parse(readFileSync('apps/dossier-cli/benchmarks/rating-influence-v1-protocol.json')).candidate;
  for(const provenance of ['inferred','user_confirmed'])for(const active of [true,false]){
    const variant={...state,tasteClaims:state.tasteClaims.map(c=>({...c,provenance,active}))};
    for(const arm of ['narrow_recent','exception_recent','additive_recent']){
      const original=structuredClone(variant),rows=scorer(pool,Object.values(variant.ratings),variant.tasteClaims,arm,1030);
      assert.deepEqual(publish(rows),independentScores(variant,pool,1030,arm,config));assert.deepEqual(variant,original);
      const permuted={...variant,ratings:Object.fromEntries(shuffled(Object.entries(variant.ratings),27))};
      assert.deepEqual(publish(scorer(pool,Object.values(permuted.ratings),permuted.tasteClaims,arm,1030)),publish(rows));
    }
  }
});
const index=process.argv.indexOf('--report');
if(index>=0)test('every frozen synthetic trace reproduces ratings, scores, metrics, and decisions independently',async()=>{
  const path=process.argv[index+1],report=await readCorroborationReport(path),p=report.protocol,fixture=JSON.parse(readFileSync(p.fixture.path));
  assert.deepEqual(p,JSON.parse(readFileSync('apps/dossier-cli/benchmarks/rating-influence-v1-protocol.json')));
  assert.equal(report.protocolHash,hash(readFileSync('apps/dossier-cli/benchmarks/rating-influence-v1-protocol.json')));
  assert.equal(hash(readFileSync(p.fixture.path)),p.fixture.sha256);
  if(report.partition!=='development'){
    const frozenPath='apps/dossier-cli/benchmarks/rating-influence-v1-reference.json',frozen=JSON.parse(readFileSync(frozenPath));
    assert.equal(report.referenceHash,hash(readFileSync(frozenPath)));
    for(const [f,h]of Object.entries({...frozen.sourceHashes,...frozen.preservedHashes}))assert.equal(hash(readFileSync(f)),h);
  }
  const catalogue=new Map(fixture.catalogues[report.partition].map(i=>[key(i),{...i,features:featureVector(i)}]));
  const checks={ratings:0,scores:0,rankings:0,sessions:0,syntheticHistoricalSteps:0};
  assert.equal(report.viewerResults.length,report.partition==='development'?44:88);assert.equal(new Set(report.viewerResults.map(v=>v.viewer)).size,report.viewerResults.length);
  for(const viewer of report.viewerResults){
    const actor=fixture.viewers.find(v=>v.id===viewer.viewer);assert.equal(actor.partition,report.partition);assert.equal(actor.type,viewer.type);
    assert.deepEqual(viewer.sessions.map(s=>s.seed),p.seeds);
    for(const session of viewer.sessions){
      let state=createDefaultState(),previous=null;assert.equal(session.steps.length,60);checks.sessions++;
      let training=shuffled(actor.trainingKeys,actor.seed+session.seed);
      if(actor.type==='novel_preference')training=[...training.filter(k=>!catalogue.get(k).keywords.includes(actor.novelTag)).slice(0,30),...training.filter(k=>catalogue.get(k).keywords.includes(actor.novelTag)),...training.filter(k=>!catalogue.get(k).keywords.includes(actor.novelTag)).slice(30)];
      if(actor.type==='duplicate_evidence'){const repeated=new Set(actor.trainingKeys.slice(70,90));training=[...training.filter(k=>repeated.has(k)),...training.filter(k=>!repeated.has(k))];}
      assert.deepEqual(session.events,session.steps.map(s=>s.event));
      for(const [i,step]of session.steps.entries()){
        const count=i+1,k=training[i],truth=actor.type==='changing_taste'&&count<=30?actor.oldRatings:actor.ratings;
        const mistake=(actor.type==='isolated_noise'&&count===14)||(actor.type==='repeated_noise'&&count>=14&&count<=18)||(actor.type==='biased_noise'&&count>=11&&count<=30&&catalogue.get(k).genres.includes(actor.biasedGenre));
        assert.equal(step.count,count);assert.equal(step.mistake,mistake);assert.equal(step.event.key,k);assert(!actor.holdoutKeys.includes(k));
        assert.equal(step.event.rating,mistake?(truth[k]===0?3:-truth[k]):truth[k]||0);assert.equal(step.event.ts,p.clock.start+count*2*86400000);
        const snapshot=replayLibrary([step.event],catalogue).ratings[k].item;
        state=setLibraryRating(state,k,step.event.rating,snapshot,step.event.ts);checks.ratings++;
        const pool=actor.holdoutKeys.map(k=>catalogue.get(k));
        for(const arm of p.arms){
          const expected=independentScores(state,pool,step.event.ts,arm,p.candidate);
          assert.deepEqual(Object.entries(step.scores[arm]).sort(),Object.entries(expected).sort(),`${actor.id}/${session.seed}/${count}/${arm}`);checks.scores+=Object.keys(expected).length;
          assert.deepEqual(step.measures[arm],assess(expected,pool,actor.ratings,Object.keys(expected).length>0));
          assert.deepEqual(step.phase[arm],assess(expected,pool,truth,Object.keys(expected).length>0));checks.rankings+=2;
          const before=previous?pairAccuracy(previous.scores[arm],truth,actor.holdoutKeys):null;
          if(previous)assert.equal(step.phaseBefore[arm],before);
          assert.equal(step.phaseDeltas[arm],previous?round(step.phase[arm].auc-before):0);
          assert.equal(step.deltas[arm],previous?round(step.measures[arm].auc-previous.measures[arm].auc):0);
        }
        previous=step;
      }
      assert.deepEqual(state,replayLibrary(session.events,catalogue));assert.deepEqual(state,session.finalProfile);assert(Object.values(session.contracts).every(Boolean));
      for(const arm of p.arms.slice(1))assert(session.scorerRestoration[arm]);
      const scorer=createInfluenceScorer(),time=session.events.at(-1).ts,pool=actor.holdoutKeys.map(k=>catalogue.get(k));
      for(const arm of p.arms){
        const signatures=new Set(),aucs=[];
        for(let j=0;j<p.permutations;j++){
          const shuffledState={...state,ratings:Object.fromEntries(shuffled(Object.entries(state.ratings),session.seed+j*101))};
          const scores=independentScores(shuffledState,pool,time,arm,p.candidate);signatures.add(JSON.stringify(Object.entries(scores).sort()));aucs.push(pairAccuracy(scores,actor.ratings,actor.holdoutKeys));
        }
        assert.equal(session.order[arm].scoreSignatures,signatures.size);assert.equal(session.order[arm].aucSpread,round(Math.max(...aucs)-Math.min(...aucs)));
        if(actor.type==='novel_preference')assert.equal(session.novelLearning[arm],round(pairAccuracy(previous.scores[arm],actor.ratings,actor.holdoutKeys)-pairAccuracy(session.steps[29].scores[arm],actor.ratings,actor.holdoutKeys)));
      }
      const first=session.events[0].key,original=state.ratings[first];
      let restored=setLibraryRating(state,first,original.rating===0?2:-original.rating,original.item,time+86400000);
      restored=setLibraryRating(restored,first,null);restored=setLibraryRating(restored,first,original.rating,original.item,original.ts);
      assert.deepEqual(restored.ratings,state.ratings);assert.equal(session.claimHistoryChanged,JSON.stringify(restored.tasteClaims)!==JSON.stringify(state.tasteClaims));
      for(const arm of p.arms)assert.deepEqual(Object.entries(session.restorationScores[arm]).sort(),Object.entries(independentScores(restored,pool,time,arm,p.candidate)).sort());
    }
  }
  const old=JSON.parse(readFileSync('apps/dossier-cli/src/lab/corroboration-v1.json')),oldCatalogue=new Map(old.items.map(i=>[key(i),i]));
  assert.equal(report.failures.length,5);
  for(const failure of report.failures){
    const actor=old.viewers.find(v=>v.id===failure.viewer),pool=actor.holdoutKeys.map(k=>oldCatalogue.get(k));assert.equal(failure.source,'archived_synthetic');
    let state=createDefaultState();
    for(const [i,step]of failure.steps.entries()){
      const snapshot=replayLibrary([step.event],oldCatalogue).ratings[step.event.key].item;
      state=setLibraryRating(state,step.event.key,step.event.rating,snapshot,step.event.ts);checks.syntheticHistoricalSteps++;
      for(const arm of p.arms){const scores=independentScores(state,pool,step.event.ts,arm,p.candidate);assert.deepEqual(Object.entries(scores).sort(),Object.entries(step.scores[arm]).sort());}
    }
    assert.deepEqual(state,replayLibrary(failure.events,oldCatalogue));
    for(const arm of p.arms){const first=failure.steps[9].measures[arm].auc,last=failure.steps.at(-1).measures[arm].auc;
      assert.deepEqual(failure.arms[arm],{auc10:first,auc40:last,change:round(last-first),gainCurrent40:round(last-failure.steps.at(-1).measures.current.auc),worstStep:round(Math.min(...failure.steps.slice(10).map(x=>x.phaseDeltas[arm])))});}
  }
  const decision=influenceDecision(report.viewerResults,report.failures,p,report.partition);
  for(const [k,v]of Object.entries(decision))assert.deepEqual(report[k],v);
  writeFileSync(`reports/rating-influence-v1-${report.partition}-verification.json`,JSON.stringify({reportHash:hash(readFileSync(path)),independentAuditPassed:true,checks},null,2)+'\n');
  console.log(JSON.stringify(checks));
});
