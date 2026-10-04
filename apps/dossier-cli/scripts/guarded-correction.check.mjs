import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { featureVector, broadLensQueue, emptyLens45, answerBroadLens, lensRuleId, matchesLensRule,
 emptyCorrections, setCorrection, removeCorrection, scoreCorrections, scoreProtectedCorrections, PROTECTION_CONFIG, CORRECTION_CONFIG,
 correctionPreview, emptyCorrectionReviews, reviewCorrection, protectedFeedback } from '@dossier/domain';
import { assess, key, shuffled, random, round } from './hard-metrics.mjs';
import { replayLibrary } from './library-replay.mjs';
import { summarize, decide } from './guarded-correction-metrics.mjs';
process.chdir(new URL('../../..',import.meta.url).pathname);
const read=p=>JSON.parse(existsSync(p)?readFileSync(p):gunzipSync(readFileSync(p+'.gz')));
const sha=b=>createHash('sha256').update(b).digest('hex');
const path='apps/dossier-cli/benchmarks/guarded-correction-v1-protocol.json',protocol=read(path),fixture=read(protocol.fixture.path);
const report=read(process.env.DOSSIER_GUARDED_REPORT??'reports/guarded-correction-v1.json');
const byKey=new Map(fixture.items.map(r=>[key(r),r]));
const feedback=a=>({id:`general:${lensRuleId(a.question.choices[0].conditions)}`,kind:'general',conditions:a.question.choices[0].conditions,effect:a.effect});
const rows=(pool,state,corrections,reviews,arm)=>{
 const args=[pool,Object.values(state.ratings),state.tasteClaims,corrections];
 return (['guarded','reviewed'].includes(arm)?scoreProtectedCorrections(...args,reviews,arm):scoreCorrections(...args,arm))
  .map(r=>({id:key(r.item),score:Math.round(r.score*1000)/1000||0,correctionEvidence:r.correctionEvidence}));
};
const scoreMap=rows=>Object.fromEntries(rows.map(r=>[r.id,r.score]));
const canonical=o=>JSON.parse(JSON.stringify(o));
test('guarded correction freezes fresh cohorts, public features, candidates, and archived results',()=>{
 assert.equal(report.protocolHash,sha(readFileSync(path)));assert.deepEqual(report.protocol,protocol);
 assert.equal(protocol.fixture.sha256,sha(readFileSync(protocol.fixture.path)));
 assert.equal(protocol.generatorHash,sha(readFileSync('apps/dossier-cli/scripts/prepare-guarded-correction.mjs')));
 assert.deepEqual(protocol.candidate,CORRECTION_CONFIG);assert.deepEqual(protocol.protection,PROTECTION_CONFIG);
 assert.equal(fixture.viewers.length,160);assert.equal(fixture.viewers.filter(v=>v.partition==='sealed').length,80);
 const archived=read('apps/dossier-cli/benchmarks/preparation-v1-reference.json');
 for(const [p,h]of Object.entries(archived.archiveHashes))assert.equal(sha(readFileSync(p)),h);
 const previous=new Set(read('apps/dossier-cli/src/lab/effective-correction-v1.json').viewers.map(v=>v.id));
 for(const v of fixture.viewers){assert(!previous.has(v.id));assert(v.trainingKeys.every(k=>!v.holdoutKeys.includes(k)));}
 const previousItems=new Set(read('apps/dossier-cli/src/lab/effective-correction-v1.json').items.map(key));
 for(const item of fixture.items){assert(!previousItems.has(key(item)));assert.deepEqual(item.features,featureVector(item));}
 if(!process.env.DOSSIER_GUARDED_REPORT){assert.equal(report.viewers,160);assert.equal(report.sessions,320);}
 const reference=read('apps/dossier-cli/benchmarks/guarded-correction-v1-reference.json');
 for(const [p,h]of Object.entries(reference.hashes))assert.equal(sha(readFileSync(p)),h);
 assert.equal(report.referenceHash,sha(readFileSync('apps/dossier-cli/benchmarks/guarded-correction-v1-reference.json')));
});
test('main answers reconstruct from the common queue; only actual repeated-rating evidence trains branches',()=>{
 for(const v of report.viewerResults){const person=fixture.viewers.find(p=>p.id===v.viewer);assert(person);assert.equal(v.sessions.length,2);
  for(const s of v.sessions){
   const expected=shuffled(person.trainingKeys,s.seed+person.seed).slice(0,40).map((k,i)=>({key:k,rating:person.type==='changing_taste'&&i<20?person.oldRatings[k]:person.ratings[k],ts:1700010000000+i}));
   expected.push({...expected[0],rating:person.ratings[expected[0].key],ts:1700010000100});assert.deepEqual(s.events,expected);
   const state=replayLibrary(s.events,byKey),rng=random(person.seed+s.seed*7919);let lens=emptyLens45();
   for(const a of s.answers){
    const q=broadLensQueue(Object.values(state.ratings),lens)[0];assert.deepEqual(a.question,q);
    assert(q.pair.every(k=>Object.hasOwn(state.ratings,k)&&!person.holdoutKeys.includes(k)));
    const rule=person.rules.find(r=>lensRuleId(r.conditions)===lensRuleId(q.choices[0].conditions));let answer='none',effect=rule?.effect,misleading=false;
    if(person.type==='missing_factor')answer='unknown';else if(rng()<person.abstention)answer='unknown';
    else if(rng()<person.responseNoise){answer='confirm';effect=rule?-rule.effect:q.choices[0].effect;misleading=true;}else if(rule)answer='confirm';
    assert.deepEqual({answer:a.answer,effect:a.effect,misleading:a.misleading},{answer,effect:answer==='confirm'?effect:null,misleading});
    lens=answerBroadLens(lens,q,answer,Object.values(state.ratings));if(answer==='confirm')lens.features=lens.features.map(f=>f.id===q.choices[0].id?{...f,effect}:f);
   }
   for(const b of Object.values(s.branches)){assert.deepEqual(b.profile.ratings,state.ratings);assert.deepEqual(b.profile.tasteClaims,state.tasteClaims);}
  }
 }
});
test('every branch reconstructs previews, follow-up cost, uncertainty, state, rankings, and losses',()=>{
 for(const v of report.viewerResults){const person=fixture.viewers.find(p=>p.id===v.viewer);
  for(const s of v.sessions){const state=replayLibrary(s.events,byKey),pool=person.holdoutKeys.map(k=>byKey.get(k));
   for(const arm of protocol.arms){const b=s.branches[arm];let lens=emptyLens45(),corrections=emptyCorrections(),reviews=emptyCorrectionReviews(),mainIndex=0,pending=null;
    const metric=()=>{const r=rows(pool,state,corrections,reviews,arm);return assess(scoreMap(r),pool,person.ratings,r.length>0);};
    let previous=metric();assert.deepEqual(s.checkpoints[0][arm],previous);assert(b.turns.length<=8);
    for(const [i,t]of b.turns.entries()){
     assert.equal(t.budget,i+1);
     if(pending){assert.equal(t.kind,'review');assert.equal(t.mainIndex,pending.index);
      const f=feedback(pending.answer),preview=correctionPreview(f,Object.values(state.ratings));assert.deepEqual(t.preview,preview);
      const rng=random(person.seed+s.seed*21337+pending.index*97),rule=person.rules.find(r=>lensRuleId(r.conditions)===lensRuleId(f.conditions));
      let decision;
      if(person.type==='missing_factor'||rng()<person.abstention)decision='defer';else if(person.persistent&&pending.answer.misleading)decision='apply';
      else{const correct=Boolean(rule&&rule.effect===f.effect);decision=rng()<person.followupNoise?(correct?'withdraw':'apply'):(correct?'apply':'withdraw');}
      assert.equal(t.decision,decision);reviews=reviewCorrection(reviews,f,Object.values(state.ratings),decision,preview.signature);pending=null;
     }else{assert.equal(t.kind,'main');assert.equal(t.mainIndex,mainIndex);assert.deepEqual(t.answer,s.answers[mainIndex]);
      const a=t.answer,q=broadLensQueue(Object.values(state.ratings),lens)[0];assert.deepEqual(q,a.question);
      lens=answerBroadLens(lens,q,a.answer,Object.values(state.ratings));
      if(a.answer==='confirm'){
       lens.features=lens.features.map(f=>f.id===q.choices[0].id?{...f,effect:a.effect}:f);corrections=setCorrection(corrections,feedback(a));
       reviews={version:1,reviews:reviews.reviews.filter(r=>corrections.feedback.some(f=>f.id===r.id))};
       if(['guarded','reviewed'].includes(arm)){
        assert.deepEqual(t.preview,correctionPreview(feedback(a),Object.values(state.ratings)));
        if(arm==='reviewed'&&t.preview.needsReview)pending={index:mainIndex,answer:a};
       }
      }
      mainIndex++;
     }
     const current=metric();assert.deepEqual(t.metrics,current);assert.equal(t.delta,round(current.auc-previous.auc)||0);previous=current;
     assert.equal(s.steps[i].delta[arm],t.delta);if(protocol.checkpoints.includes(i+1))assert.deepEqual(s.checkpoints[i+1][arm],previous);
    }
    for(const budget of protocol.checkpoints.filter(p=>p>b.turns.length))assert.deepEqual(s.checkpoints[budget][arm],previous);
    for(const t of s.steps.slice(b.turns.length))assert.equal(t.delta[arm],0);
    assert.deepEqual(b.profile.settings.experimentalPersonalLens45??emptyLens45(),lens);
    assert.deepEqual(b.profile.settings.experimentalCorrections??emptyCorrections(),corrections);
    assert.deepEqual(b.profile.settings.experimentalCorrectionReviews??emptyCorrectionReviews(),reviews);
    const protection=['guarded','reviewed'].includes(arm)?protectedFeedback(corrections,Object.values(state.ratings),reviews,arm):null;
    assert.deepEqual(b.decisions,protection?.decisions??[]);assert.equal(b.accepted,(protection?.state??corrections).feedback.length);
    assert.deepEqual(s.final[arm].map(r=>({id:r.id,score:r.score,correctionEvidence:r.correctionEvidence})),canonical(rows(pool,state,corrections,reviews,arm)));
   }
   assert(s.portability&&s.defaultStable&&s.overwriteMatched);
  }
 }
});
test('narrow controls, deliberate broad review, deferred scoring, and scope recompute independently',()=>{
 for(const v of report.viewerResults){const person=fixture.viewers.find(p=>p.id===v.viewer);
  for(const s of v.sessions){const state=replayLibrary(s.events,byKey),training=Object.keys(state.ratings),pool=[...person.holdoutKeys,...training].map(k=>byKey.get(k));
   for(const arm of protocol.arms){const actual=s.contracts[arm],saved=s.branches[arm].profile;
    const score=(feedback,reviews=emptyCorrectionReviews())=>rows(pool,state,{version:1,feedback},reviews,arm),reference=score([]),source=reference.filter(r=>training.includes(r.id));
    const a=source[0]??{id:training[0]},b=source[source.length-1]??{id:training[training.length-1]},chosen=saved.settings.experimentalCorrections?.feedback.find(f=>f.kind==='general');
    if(chosen){const opposite={...chosen,effect:-chosen.effect},review=f=>arm==='reviewed'?reviewCorrection(emptyCorrectionReviews(),f,Object.values(state.ratings),'apply',correctionPreview(f,Object.values(state.ratings)).signature):emptyCorrectionReviews();
     const before=score([chosen],review(chosen)),after=score([opposite],review(opposite)),matched=before.filter(r=>matchesLensRule(byKey.get(r.id),chosen.conditions));
     assert.equal(actual.general.passed,matched.length>0&&matched.every(r=>((after.find(x=>x.id===r.id)?.score??NaN)-r.score)*chosen.effect<0));assert.equal(actual.general.affected,matched.length);
     assert.equal(actual.general.unrelatedStable,before.filter(r=>!matchesLensRule(byKey.get(r.id),chosen.conditions)).every(r=>after.find(x=>x.id===r.id)?.score===r.score));
    }else assert.equal(actual.general,undefined);
    const positive=score([{id:'diagnostic-exception',kind:'exception',key:a.id,effect:1}]),negative=score([{id:'diagnostic-exception',kind:'exception',key:a.id,effect:-1}]);
    assert.equal(actual.exception.passed,(positive.find(r=>r.id===a.id)?.score??NaN)>0&&(negative.find(r=>r.id===a.id)?.score??NaN)<0);
    assert.equal(actual.exception.unrelatedStable,reference.filter(r=>r.id!==a.id).every(r=>positive.find(x=>x.id===r.id)?.score===r.score&&negative.find(x=>x.id===r.id)?.score===r.score));
    const before=score([{id:'diagnostic-pair',kind:'comparison',winner:a.id,loser:b.id}]),after=score([{id:'diagnostic-pair',kind:'comparison',winner:b.id,loser:a.id}]);
    const margin=rows=>{const x=rows.find(r=>r.id===a.id),y=rows.find(r=>r.id===b.id);return x&&y?x.score-y.score:null;};
    assert.equal(actual.comparison.beforeMargin,margin(before));assert.equal(actual.comparison.afterMargin,margin(after));
    assert.equal(actual.comparison.passed,margin(before)!==null&&margin(after)!==null&&margin(before)>0&&margin(after)<0);
    assert.equal(actual.comparison.pairReversed,actual.comparison.passed);
    assert.equal(actual.comparison.unrelatedStable,reference.filter(r=>r.id!==a.id&&r.id!==b.id).every(r=>after.find(x=>x.id===r.id)?.score===r.score));
    if(['guarded','reviewed'].includes(arm)){
     const corrections=saved.settings.experimentalCorrections??emptyCorrections(),reviews=saved.settings.experimentalCorrectionReviews??emptyCorrectionReviews();
     const original=rows(pool,state,corrections,reviews,arm),p=protectedFeedback(corrections,Object.values(state.ratings),reviews,arm);
     assert.equal(actual.pendingStable,p.decisions.filter(d=>d.status!=='apply').every(d=>{
      const without=rows(pool,state,removeCorrection(corrections,d.id),reviews,arm);return original.every(r=>without.find(x=>x.id===r.id)?.score===r.score);
     }));
    }else assert(actual.pendingStable);
    assert(actual.removal&&actual.restoration);
   }
  }
 }
});
test('people aggregation and all frozen protection requirements determine adoption',()=>{
 for(const [p,summary]of Object.entries(report.cohorts))assert.deepEqual(summary,summarize(report.viewerResults.filter(v=>v.partition===p),protocol));
 for(const [type,summary]of Object.entries(report.types))assert.deepEqual(summary,summarize(report.viewerResults.filter(v=>v.partition==='sealed'&&v.type===type),protocol));
 const actual=decide(report.viewerResults,protocol,Boolean(process.env.DOSSIER_GUARDED_REPORT));assert.deepEqual(report.candidateGates,actual.candidateGates);assert.deepEqual(report.decision,actual.decision);
});
