import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { CORRECTION_ARMS, CORRECTION_CONFIG, broadLensQueue, emptyLens45, answerBroadLens,
 emptyCorrections, setCorrection, lensRuleId, scoreCorrections, featureVector } from '@dossier/domain';
import { assess, key, shuffled, random, round } from './hard-metrics.mjs';
import { replayLibrary } from './library-replay.mjs';
import { summarize, decide } from './effective-correction-metrics.mjs';
process.chdir(new URL('../../..',import.meta.url).pathname);
const read=p=>JSON.parse(existsSync(p)?readFileSync(p):gunzipSync(readFileSync(p+'.gz')));
const sha=b=>createHash('sha256').update(b).digest('hex');
const protocolPath='apps/dossier-cli/benchmarks/effective-correction-v1-protocol.json';
const protocol=read(protocolPath),fixture=read(protocol.fixture.path),report=read('reports/effective-correction-v1.json');
const byKey=new Map(fixture.items.map(r=>[key(r),r]));
const rows=(state,corrections,person,arm)=>scoreCorrections(person.holdoutKeys.map(k=>byKey.get(k)),Object.values(state.ratings),state.tasteClaims,corrections,arm)
 .map(r=>({id:key(r.item),score:Math.round(r.score*1000)/1000,correctionEvidence:r.correctionEvidence}));
const metrics=ranked=>Object.fromEntries(ranked.map(r=>[r.id,r.score]));
test('effective correction freezes its generator, cohorts, protocol, and public representation',()=>{
 assert.equal(report.protocolHash,sha(readFileSync(protocolPath)));assert.deepEqual(report.protocol,protocol);
 assert.equal(protocol.fixture.sha256,sha(readFileSync(protocol.fixture.path)));
 assert.equal(protocol.generatorHash,sha(readFileSync('apps/dossier-cli/scripts/prepare-effective-correction.mjs')));
 assert.deepEqual(protocol.arms,CORRECTION_ARMS);assert.deepEqual(protocol.candidate,CORRECTION_CONFIG);
 assert.equal(report.viewers,120);assert.equal(report.sessions,240);
 assert.equal(fixture.viewers.filter(v=>v.partition==='sealed').length,60);
 const reference=read('apps/dossier-cli/benchmarks/preparation-v1-reference.json');
 for(const [p,h]of Object.entries(reference.archiveHashes))assert.equal(sha(readFileSync(p)),h);
 const previous=new Set(Object.keys(reference.archiveHashes).filter(p=>p.startsWith('apps/dossier-cli/src/lab/')).flatMap(p=>{
  const data=read(p);return(data.viewers??data.personas??[]).map(v=>v.id);
 }));
 for(const person of fixture.viewers){assert(!previous.has(person.id));assert(person.trainingKeys.every(k=>!person.holdoutKeys.includes(k)));}
 for(const item of fixture.items)assert.deepEqual(item.features,featureVector(item));
});
test('every prompt and supplied answer reconstructs from training evidence and frozen actor behavior',()=>{
 for(const v of report.viewerResults) {
  const person=fixture.viewers.find(p=>p.id===v.viewer);assert(person);assert.equal(v.sessions.length,2);
  for(const s of v.sessions) {
   const order=shuffled(person.trainingKeys,s.seed+person.seed),expected=order.slice(0,40).map((k,i)=>({key:k,
    rating:person.type==='changing_taste'&&i<20?person.oldRatings[k]:person.ratings[k],ts:1700000000000+i}));
   expected.push({...expected[0],rating:person.ratings[expected[0].key],ts:1700000000100});assert.deepEqual(s.events,expected);
   const state=replayLibrary(s.events,byKey);assert.deepEqual(s.profile.ratings,state.ratings);assert.deepEqual(s.profile.tasteClaims,state.tasteClaims);
   let lens=emptyLens45(),corrections=emptyCorrections();const rng=random(person.seed+s.seed*7919);
   for(const a of s.answers){
    const q=broadLensQueue(Object.values(state.ratings),lens)[0];assert.deepEqual(a.question,q);
    assert(q.pair.every(k=>Object.hasOwn(state.ratings,k)&&!person.holdoutKeys.includes(k)));
    const proposed=q.choices[0],rule=person.rules.find(r=>lensRuleId(r.conditions)===lensRuleId(proposed.conditions));
    let answer='none',effect=rule?.effect,misleading=false;
    if(person.type==='missing_factor')answer='unknown';
    else if(rng()<person.abstention)answer='unknown';
    else if(rng()<person.responseNoise){answer='confirm';effect=rule?-rule.effect:proposed.effect;misleading=true;}
    else if(rule)answer='confirm';
    assert.equal(a.answer,answer);assert.equal(a.effect,answer==='confirm'?effect:null);assert.equal(a.misleading,misleading);
    lens=answerBroadLens(lens,q,answer,Object.values(state.ratings));
    if(answer==='confirm'){
     lens.features=lens.features.map(f=>f.id===proposed.id?{...f,effect}:f);
     corrections=setCorrection(corrections,{id:`general:${lensRuleId(proposed.conditions)}`,kind:'general',conditions:proposed.conditions,effect});
    }
   }
   assert.deepEqual(s.profile.settings.experimentalPersonalLens45??emptyLens45(),lens);
   assert.deepEqual(s.profile.settings.experimentalCorrections??emptyCorrections(),corrections);
  }
 }
});
test('all checkpoint and final rankings recompute independently of hidden preference inputs',()=>{
 for(const v of report.viewerResults){const person=fixture.viewers.find(p=>p.id===v.viewer);
  for(const s of v.sessions){const state=replayLibrary(s.events,byKey);let corrections=emptyCorrections();
   const verify=(actual)=>{
    for(const arm of protocol.arms){
     const ranked=rows(state,corrections,person,arm),expected=assess(metrics(ranked),person.holdoutKeys.map(k=>byKey.get(k)),person.ratings);
     assert.deepEqual(actual[arm],expected);
    }
   };
   verify(s.checkpoints[0]);let previous=s.checkpoints[0];
   for(const [i,a]of s.answers.entries()){
    if(a.answer==='confirm')corrections=setCorrection(corrections,{id:`general:${lensRuleId(a.question.choices[0].conditions)}`,kind:'general',conditions:a.question.choices[0].conditions,effect:a.effect});
    verify(s.steps[i].metrics);
    for(const arm of protocol.arms)assert.equal(s.steps[i].delta[arm],round(s.steps[i].metrics[arm].auc-previous[arm].auc));
    previous=s.steps[i].metrics;
    if(protocol.checkpoints.includes(i+1))assert.deepEqual(s.checkpoints[i+1],previous);
   }
   for(const checkpoint of protocol.checkpoints.filter(p=>p>s.answers.length))verify(s.checkpoints[checkpoint]);
   for(const arm of protocol.arms){const ranked=rows(state,corrections,person,arm);
    assert.deepEqual(s.final[arm].map(r=>({id:r.id,score:r.score,correctionEvidence:r.correctionEvidence})),ranked);
   }
   assert(s.portability&&s.defaultStable&&s.overwriteMatched);
  }
 }
});
test('person aggregation and every frozen requirement determine the recorded decision',()=>{
 for(const [partition,summary]of Object.entries(report.cohorts))assert.deepEqual(summary,summarize(report.viewerResults.filter(v=>v.partition===partition),protocol));
 for(const [type,summary]of Object.entries(report.types))assert.deepEqual(summary,summarize(report.viewerResults.filter(v=>v.partition==='sealed'&&v.type===type),protocol));
 const actual=decide(report.viewerResults,protocol,false);assert.deepEqual(report.candidateGates,actual.candidateGates);assert.deepEqual(report.decision,actual.decision);
});
