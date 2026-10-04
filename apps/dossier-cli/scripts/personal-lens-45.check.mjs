import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { featureVector, lensRuleId, matchesLensRule, PERSONAL_LENS_45_CONFIG } from '@dossier/domain';
import { average, round, shuffled } from './hard-metrics.mjs';
import { meanInterval } from './real-metrics.mjs';
const read=p=>JSON.parse(existsSync(p)?readFileSync(p):gunzipSync(readFileSync(p+'.gz')));
const protocol=read('benchmarks/personal-lens-45-v1-protocol.json'),report=read('../../reports/personal-lens-45-v1.json');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const fixtures=Object.fromEntries(Object.entries(protocol.fixtures).map(([name,f])=>[name,read('../../'+f.path)]));
function fixtureFor(cohort){return cohort.startsWith('synthetic_')?fixtures.synthetic:cohort.startsWith('lens4_')?fixtures.lens4_regression:fixtures[cohort];}
test('experiment 4.5 preserves frozen fixtures and reserves fresh confirmation people',()=>{
 for(const f of Object.values(protocol.fixtures))assert.equal(sha(readFileSync('../../'+f.path)),f.sha256);
 assert.deepEqual(report.protocol,protocol);assert.deepEqual(protocol.candidate,PERSONAL_LENS_45_CONFIG);
 assert.equal(report.protocolHash,sha(readFileSync('benchmarks/personal-lens-45-v1-protocol.json')));
 assert.equal(report.viewers,438);assert.equal(report.sessions,876);assert.equal(report.experiment,'4.5');
 const people=fixtures.synthetic.viewers,oldPeople=new Set(fixtures.lens4_regression.viewers.map(v=>v.id));
 assert.equal(people.filter(v=>v.partition==='sealed').length,48);
 assert(people.every(v=>!oldPeople.has(v.id)));
 assert.notDeepEqual(fixtures.synthetic.items,fixtures.lens4_regression.items);
 for(const p of people){assert(p.trainingKeys.every(k=>!p.holdoutKeys.includes(k)));assert(p.holdoutKeys.some(k=>p.ratings[k]>0));assert(p.holdoutKeys.some(k=>p.ratings[k]<0));}
});
test('every question uses revealed personal evidence and every confirmation uses only its offered causal predicate',()=>{
 for(const v of report.viewerResults){
  const fixture=fixtureFor(v.cohort),people=fixture.viewers??fixture.personas,index=people.findIndex(p=>p.id===v.viewer),person=people[index];assert(person);
  const authored=['synthetic','lens4_regression'].some(name=>fixtures[name]===fixture);
  const itemByKey=new Map(fixture.items.map(raw=>[`${raw.medium}:${raw.id}`,{...raw,features:authored?raw.features:featureVector(raw)}]));
  const training=person.trainingRatings?.map(r=>({id:r.filmKey,rating:r.rating}))??(person.trainingKeys??fixture.trainingKeys).map(id=>({id,rating:person.ratings[id]}));
  assert.equal(v.sessions.length,2);
  for(const s of v.sessions){
   const observed=shuffled(training,s.seed+(index+1)*1009).slice(0,40).map(r=>({...r,rating:person.noiseModulo&&Number(r.id.split(':')[1])%person.noiseModulo===0?-r.rating:r.rating}));
   const keys=new Set(observed.map(r=>r.id));
   assert.equal(s.prompts,s.answers.length);assert(s.prompts<=10);assert.equal(s.confirmations,s.lens.features.length);
   const seen=new Set();
   for(const a of s.answers){
    assert(!seen.has(a.question.id));seen.add(a.question.id);
    assert.equal(a.question.choices.length,1);const f=a.question.choices[0];
    assert(a.question.pair.every(k=>keys.has(k)));
    assert(f.conditions.length>=1&&f.conditions.length<=2);
    const support=observed.filter(r=>Math.abs(r.rating)>=1&&matchesLensRule(itemByKey.get(r.id),f.conditions)&&Math.sign(r.rating)===f.effect);
    const contrast=observed.filter(r=>Math.abs(r.rating)>=1&&!matchesLensRule(itemByKey.get(r.id),f.conditions)&&Math.sign(r.rating)!==f.effect);
    assert.equal(a.question.support,support.length);assert.equal(a.question.contrast,contrast.length);assert(support.length>=3&&contrast.length>=3);
    if(a.answer==='confirm'){
     assert(authored);assert.equal(lensRuleId(f.conditions),lensRuleId(person.rule.conditions));assert.equal(f.effect,person.rule.effect);
     assert(s.lens.features.some(feature=>feature.id===f.id));
    }else if(a.answer==='unknown'){
     assert(authored);assert.equal(person.rule.conditions.length,0);assert(s.lens.limitations.some(l=>l.questionId===a.question.id));
    }else {assert.equal(a.answer,'none');assert(s.lens.rejected.includes(f.id));assert(!s.lens.limitations.some(l=>l.questionId===a.question.id));}
   }
   for(const a of s.narrowAnswers)assert(a.question.pair.every(k=>keys.has(k)));
   if(!authored)assert.equal(s.confirmations,0);
   assert(s.contracts.portability);assert(s.contracts.explanations);assert(s.contracts.limitations);
   let prior=s.checkpoints[0].inferred.auc;
   for(const t of s.traces){assert.equal(t.delta,round(t.auc-prior));prior=t.auc;}
   assert.equal(s.contracts.sharedScoresEqual,true);
  }
 }
});
test('viewer aggregation separates discovery and control comparisons and excludes missing rating budgets',()=>{
 for(const [name,c]of Object.entries(report.cohorts)){
  const people=report.viewerResults.filter(v=>v.cohort===name);
  const gain=baseline=>people.map(v=>average(v.sessions.map(s=>s.checkpoints[10].broad_personal.auc))-average(v.sessions.map(s=>s.checkpoints[10][baseline].auc)));
  assert.deepEqual(c.learning[10].broad_personal.gain,meanInterval(gain('inferred')));
  assert.deepEqual(c.learning[10].broad_personal.gainOverNarrow,meanInterval(gain('narrow_personal')));
  assert.deepEqual(c.learning[10].broad_personal.gainOverNativeAuthored,meanInterval(gain('broad_authored_claims')));
  assert.deepEqual(c.learning[10].broad_personal.gainOverShared,meanInterval(gain('broad_shared')));
  const represented=people.filter(v=>v.sessions[0].eligibleRepresented);
  assert.equal(c.ruleRecovery,represented.length?average(represented.map(v=>average(v.sessions.map(s=>Number(s.ruleRecovered))))):null);
  const eligible=people.filter(v=>v.sessions.every(s=>s.ratingControlAvailable));assert.equal(c.equalPromptViewers,eligible.length);
  assert.deepEqual(c.equalPromptGain,meanInterval(eligible.map(v=>average(v.sessions.map(s=>s.checkpoints[10].broad_personal.auc-s.ratingControl.auc)))));
  for(const v of people)for(const s of v.sessions)for(const budget of protocol.questionBudgets){
   assert.deepEqual(s.checkpoints[budget].inferred,s.checkpoints[0].inferred);
   assert.equal(s.checkpoints[budget].broad_shared.auc,s.checkpoints[budget].broad_claims_equal_strength.auc);
   assert.equal(s.checkpoints[budget].broad_shared.ndcg10,s.checkpoints[budget].broad_claims_equal_strength.ndcg10);
  }
 }
});
test('frozen discovery and language-attribution gates mechanically determine separate decisions',()=>{
 for(const [name,gates]of Object.entries(report.candidateGates)){
  const c=report.cohorts[name],p=c.learning[10].broad_personal,b=c.learning[10].inferred,g=protocol.gates,correction=c.corrections.broad_personal;
  assert.equal(gates.minimumGain,p.gain.mean>=g.minimumGain);assert.equal(gates.positiveLowerBound,p.gain.lower>0);
  assert.equal(gates.broaderLearning,p.gainOverNarrow.lower>0);assert.equal(gates.recoveryImprovement,c.recoveryDelta>=g.minimumCoverageGain);
  assert.equal(gates.ruleRecovery,c.ruleRecovery>=g.minimumRuleRecovery);assert.equal(gates.worstDecile,p.auc.p10-b.auc.p10>=g.worstDecileMinimumDelta);
  assert.equal(gates.sampleEfficiency,c.equalPromptGain.lower>0);assert.equal(gates.promptSafety,c.worstPromptDelta>=-g.maxSinglePromptLoss);
  assert.equal(gates.correction,correction.tested>0&&correction.reversed/correction.tested>=g.correctionReversalRate);
  assert.equal(gates.confidentErrors,b.confidentErrorBurden-p.confidentErrorBurden>=g.minimumConfidenceErrorReduction);
  const a=report.attribution[name];
  assert.equal(a.languageExpansion,p.gainOverNativeAuthored.lower>0&&p.gainOverShared.lower>0&&p.gainOverShared.mean>=g.minimumAttributionGain);
 }
 const passed=Object.keys(report.candidateGates).length===2&&Object.values(report.candidateGates).every(g=>Object.values(g).every(Boolean));
 assert.equal(report.decision.status,passed?'promote_for_confirmation':'do_not_promote');
 assert.equal(report.decision.languageExpansion,Object.values(report.attribution).every(a=>a.languageExpansion));
});
