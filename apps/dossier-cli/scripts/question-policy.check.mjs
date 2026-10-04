import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { average } from './hard-metrics.mjs';
const read=p=>JSON.parse(existsSync(p)?readFileSync(p):gunzipSync(readFileSync(p+'.gz')));
const protocol=read('benchmarks/question-policy-v1-protocol.json');
const report=read('../../reports/question-policy-v1.json');
const fixtures=Object.fromEntries(Object.entries(protocol.fixtures).map(([name,f])=>[name,read('../../'+f.path)]));
test('question experiment preserves frozen truth, new synthetic confirmation, and complete replay',()=>{
 for(const f of Object.values(protocol.fixtures))assert.equal(createHash('sha256').update(readFileSync('../../'+f.path)).digest('hex'),f.sha256);
 assert.equal(report.protocolHash,createHash('sha256').update(readFileSync('benchmarks/question-policy-v1-protocol.json')).digest('hex'));
 assert.equal(report.modelFingerprint,protocol.modelFingerprint);
 assert.equal(report.evaluatorFingerprint,protocol.evaluatorFingerprint);
 assert.equal(report.viewers,270);assert.equal(report.sessions,2700);
 const synthetic=fixtures.synthetic;
 assert.equal(synthetic.viewers.filter(v=>v.partition==='sealed').length,24);
 assert.equal(synthetic.viewers.filter(v=>v.partition==='development').length,48);
 assert.notDeepEqual(synthetic.viewers[0].genreWeights,fixtures.refine_regression.viewers[0].genreWeights);
 assert.equal(synthetic.trainingKeys.filter(id=>synthetic.holdoutKeys.includes(id)).length,0);
});
test('every prompt belongs to training, skips supply no rating, and checkpoints retain actual budgets',()=>{
 for(const viewer of report.viewerResults){
  const f=viewer.cohort.startsWith('synthetic_')?fixtures.synthetic:viewer.cohort.startsWith('refine_regression_')?fixtures.refine_regression:fixtures[viewer.cohort];
  const p=(f.viewers??f.personas).find(p=>p.id===viewer.viewer);
  const training=new Set(p.trainingRatings?p.trainingRatings.map(r=>r.filmKey):f.trainingKeys);
  const heldout=new Set(p.heldOutRatings?p.heldOutRatings.map(r=>r.filmKey):f.holdoutKeys);
  assert.equal(viewer.sessions.length,10);
  for(const s of viewer.sessions){
   const seen=new Set();let answers=0,skips=0;
   for(const t of s.traces.slice(1)){
    assert(training.has(t.id));assert(!heldout.has(t.id));assert(!seen.has(t.id));seen.add(t.id);
    if(t.recognized)answers++;else{skips++;assert.equal(t.aucDelta,0);}
    assert.equal(t.answers,answers);assert.equal(t.skips,skips);assert.equal(t.prompts,answers+skips);
   }
   assert.equal(s.answers,answers);assert.equal(s.skips,skips);assert.equal(s.prompts,answers+skips);
   for(const [kind,field] of [['byAnswer','answers'],['byPrompt','prompts']])for(const budget of protocol.budgets){
    const t=s[kind][budget];assert.equal(t.requested,budget);
    if(t.reached)assert.equal(t[field],budget);else assert(t[field]<budget);
   }
  }
 }
});
test('stopping follows the same trajectory as continued questioning before it stops',()=>{
 for(const v of report.viewerResults)for(const seed of protocol.seeds){
  const a=v.sessions.find(s=>s.seed===seed&&s.arm==='counterfactual');
  const b=v.sessions.find(s=>s.seed===seed&&s.arm==='counterfactual_no_stop');
  assert.deepEqual(a.traces,b.traces.slice(0,a.traces.length));
 }
});
test('viewer averaging and frozen gates mechanically determine the decision',()=>{
 const viewers=report.viewerResults.filter(v=>['original','confirmation','override'].includes(v.cohort));
 const mean=average(viewers.map(v=>average(v.sessions.filter(s=>s.arm==='disagreement').map(s=>s.byAnswer[40].metric.auc))));
 assert(Math.abs(report.recorded.learning.byAnswer[40].disagreement.auc.mean-mean)<.000051);
 for(const c of report.candidates){
  assert.equal(c.passed,Object.values(c.recorded).every(Boolean)&&Object.values(c.sealed).every(Boolean));
  for(const [group,gateSet] of [[report.recorded,c.recorded],[report.cohorts.synthetic_sealed,c.sealed]]){
   const arm=c.arm==='counterfactual'?'counterfactual_no_stop':c.arm;
   for(const kind of ['byAnswer','byPrompt'])for(const budget of [20,40]){
    const row=group.learning[kind][budget][arm],base=group.learning[kind][budget].balanced_random;
    assert.equal(gateSet[`${kind}${budget}Gain`],row.matchedBudgetViewers/group.viewers>=.9&&row.matchedBudgetGain.lower>0&&row.gain.lower>0);
    assert.equal(gateSet[`${kind}${budget}WorstDecile`],row.auc.p10>=base.auc.p10);
   }
   assert.equal(gateSet.singleAnswerSafety,group.arms[arm].largestAnswerLoss>=-.05);
   if(c.arm==='counterfactual'){
    assert.equal(gateSet.stopSavesPrompts,group.arms.counterfactual.promptSavingAgainstNoStop>=.2);
    assert.equal(gateSet.stopPreservesAuc,group.arms.counterfactual.terminalGainAgainstNoStop.lower>=-.005);
   }
  }
 }
 assert.equal(report.decision.status,report.candidates.some(c=>c.passed)?'promote_for_confirmation':'do_not_promote');
});
