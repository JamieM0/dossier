import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { average, round } from './hard-metrics.mjs';
import { meanInterval } from './real-metrics.mjs';
const read=p=>JSON.parse(existsSync(p)?readFileSync(p):gunzipSync(readFileSync(p+'.gz')));
const protocol=read('benchmarks/personal-lens-v1-protocol.json'),report=read('../../reports/personal-lens-v1.json');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const fixtures=Object.fromEntries(Object.entries(protocol.fixtures).map(([name,f])=>[name,read('../../'+f.path)]));
const canonical=conditions=>JSON.stringify(conditions.slice().sort((a,b)=>JSON.stringify(a)<JSON.stringify(b)?-1:JSON.stringify(a)>JSON.stringify(b)?1:0));
test('personal lens keeps frozen inputs and reserved confirmation',()=>{
 for(const f of Object.values(protocol.fixtures))assert.equal(sha(readFileSync('../../'+f.path)),f.sha256);
 assert.equal(report.protocolHash,sha(readFileSync('benchmarks/personal-lens-v1-protocol.json')));
 assert.deepEqual(report.protocol,protocol);
 assert.equal(report.viewers,342);assert.equal(report.sessions,684);
 const newPeople=fixtures.synthetic.viewers;
 assert.equal(newPeople.filter(v=>v.partition==='sealed').length,24);
 assert.equal(newPeople.filter(v=>v.partition==='development').length,48);
 for(const p of newPeople)assert(p.trainingKeys.every(id=>!p.holdoutKeys.includes(id)));
});
test('questions use rated training items and only explicit causal answers create features',()=>{
 for(const v of report.viewerResults){
  const fixture=v.cohort.startsWith('synthetic_')?fixtures.synthetic:fixtures[v.cohort];
  const person=(fixture.viewers??fixture.personas).find(p=>p.id===v.viewer);assert(person);
  const training=new Set(person.trainingRatings?.map(r=>r.filmKey)??person.trainingKeys??fixture.trainingKeys);
  const heldout=new Set(person.heldOutRatings?.map(r=>r.filmKey)??person.holdoutKeys??fixture.holdoutKeys);
  assert.equal(v.sessions.length,2);
  for(const s of v.sessions){
   assert(s.prompts<=10);assert.equal(s.prompts,s.answers.length);assert.equal(s.none+s.confirmations,s.prompts);
   assert.equal(s.lens.features.length,s.confirmations);
   for(const a of s.answers){
    assert(a.question.pair.every(id=>training.has(id)&&!heldout.has(id)));
    assert(a.question.similarity>=protocol.candidate.similarity);
    assert(a.question.choices.length<=protocol.candidate.shortlist);
    if(a.selected){
     assert(v.cohort.startsWith('synthetic_'));
     const feature=a.question.choices.find(f=>f.id===a.selected);assert(feature);
     assert.equal(canonical(feature.conditions),canonical(person.rule.conditions));
     assert.equal(feature.effect,person.rule.effect);
    }else assert(s.lens.limitations.some(l=>l.questionId===a.question.id));
   }
   if(!v.cohort.startsWith('synthetic_'))assert.equal(s.confirmations,0);
   assert.equal(s.traces.length,s.prompts);
   let previous=s.checkpoints[0].inferred.auc;
   for(const trace of s.traces){assert.equal(trace.delta,round(trace.auc-previous));previous=trace.auc;}
   for(const budget of protocol.questionBudgets){
    assert.deepEqual(s.checkpoints[budget].fixed,s.checkpoints[0].fixed);
    assert.deepEqual(s.checkpoints[budget].inferred,s.checkpoints[0].inferred);
   }
   assert(s.contracts.portability);assert(s.contracts.limitation);
  }
 }
});
test('reports average repeated sessions per person and exclude unavailable rating controls',()=>{
 for(const [name,c]of Object.entries(report.cohorts)){
  const rows=report.viewerResults.filter(v=>v.cohort===name);
  const aucs=rows.map(v=>average(v.sessions.map(s=>s.checkpoints[10].personal.auc)));
  assert.equal(c.learning[10].personal.auc.mean,round(average(aucs)));
  const deltas=rows.map(v=>average(v.sessions.map(s=>s.checkpoints[10].personal.auc-s.checkpoints[10].inferred.auc)));
  assert.deepEqual(c.learning[10].personal.gain,meanInterval(deltas));
  const controls=rows.filter(v=>v.sessions.every(s=>s.ratingControlAvailable));
  assert.equal(c.equalPromptViewers,controls.length);
  assert.deepEqual(c.equalPromptGain,meanInterval(controls.map(v=>average(v.sessions.map(s=>s.checkpoints[10].personal.auc-s.ratingControl.auc)))));
 }
});
test('frozen gates mechanically determine the decision',()=>{
 for(const [name,gates]of Object.entries(report.candidateGates)){
  const c=report.cohorts[name],p=c.learning[10].personal,b=c.learning[10].inferred,g=protocol.gates;
  assert.equal(gates.minimumGain,p.gain.mean>=g.minimumGain);assert.equal(gates.positiveLowerBound,p.gain.lower>0);
  assert.equal(gates.worstDecile,p.auc.p10-b.auc.p10>=g.worstDecileMinimumDelta);
  assert.equal(gates.sampleEfficiency,c.equalPromptGain.lower>0);assert.equal(gates.promptSafety,c.worstPromptDelta>=-g.maxSinglePromptLoss);
  assert.equal(gates.correction,c.correction.tested>0&&c.correction.reversed/c.correction.tested>=g.correctionReversalRate);
  assert.equal(gates.ruleRecovery,c.ruleRecovery>=g.minimumRuleRecovery);
  assert.equal(gates.confidentErrors,b.confidentErrorBurden-p.confidentErrorBurden>=g.minimumConfidenceErrorReduction);
 }
 const passed=Object.keys(report.candidateGates).length===2&&Object.values(report.candidateGates).every(g=>Object.values(g).every(Boolean));
 assert.equal(report.decision.status,passed?'promote_for_confirmation':'do_not_promote');
});
