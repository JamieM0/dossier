import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { average, round } from './hard-metrics.mjs';
const report=JSON.parse(readFileSync(new URL('../../../reports/refine-signal-v1.json',import.meta.url)));
const repoFile=path=>new URL('../../../'+path,import.meta.url);
const fixtures=Object.fromEntries(Object.entries(report.protocol.fixtures).map(([name,entry])=>[name,JSON.parse(readFileSync(repoFile(entry.path)))]));
test('Refine report contains the complete frozen run and independent synthetic partition',()=>{
 assert.equal(report.version,'refine-signal-v1');
 assert.equal(report.viewers,198);assert.equal(report.sessions,792);
 const expected={original:31,confirmation:47,override:30,hard:18,synthetic_development:48,synthetic_sealed:24};
 assert.deepEqual(Object.fromEntries(Object.entries(report.cohorts).map(([name,group])=>[name,group.viewers])),expected);
 for(const entry of Object.values(report.protocol.fixtures))assert.equal(createHash('sha256').update(readFileSync(repoFile(entry.path))).digest('hex'),entry.sha256);
 assert.equal(report.protocolHash,createHash('sha256').update(readFileSync(repoFile('apps/dossier-cli/benchmarks/refine-signal-v1-protocol.json'))).digest('hex'));
 const ids=report.viewerResults.filter(v=>['original','confirmation','override'].includes(v.cohort)).map(v=>v.viewer);
 assert.equal(new Set(ids).size,108);
 const synthetic=fixtures.synthetic.viewers;
 assert(synthetic.filter(v=>v.partition==='development').every(v=>!synthetic.filter(v=>v.partition==='sealed').some(s=>v.id===s.id)));
});
test('Stored comparisons and all zero-evidence arms reproduce ratings-only output',()=>{
 for(const viewer of report.viewerResults)for(const session of viewer.sessions)for(const [budget,checkpoint] of Object.entries(session.checkpoints)) {
  assert.deepEqual(checkpoint.arms.stored_noop,checkpoint.arms.ratings_only);
  if(budget==='0')for(const arm of report.protocol.arms)assert.deepEqual(checkpoint.arms[arm],checkpoint.arms.ratings_only);
  for(const model of Object.values(checkpoint.models)) {
   assert.equal(model.comparisons,checkpoint.answered);
   assert(Object.values(model.axisWeights).every(w=>w>=.25&&w<=4));
   assert(Object.values(model.clusterWeights).every(w=>w>=.5&&w<=2));
   if(!model.learned)assert(Object.values(model.axisWeights).every(w=>w===1));
  }
  assert(checkpoint.prompts>=checkpoint.answered);
  assert.equal(checkpoint.prompts,checkpoint.answered+checkpoint.ties);
 }
});
test('Corrections replace a constraint and report the observed score reversal',()=>{
 for(const viewer of report.viewerResults)for(const session of viewer.sessions)for(const correction of Object.values(session.checkpoints[10].corrections)) {
  if(!correction)continue;
  assert.equal(correction.replacementCount,1);
  assert.equal(correction.strictReversal,correction.beforeMargin<0&&correction.afterMargin>0);
  assert.equal(correction.directionImproved,correction.afterMargin>correction.beforeMargin);
 }
});
test('Aggregate gains average sessions within viewers and frozen gates determine selection',()=>{
 const recorded=report.viewerResults.filter(v=>['original','confirmation','override'].includes(v.cohort));
 for(const candidate of report.candidates) {
  const gains=recorded.map(v=>average(v.sessions.map(s=>s.checkpoints[10].arms[candidate.mode].auc-s.checkpoints[10].arms.ratings_only.auc)));
  assert.equal(report.recorded.learning[10][candidate.mode].gain.mean,round(average(gains)));
  const groups=[[report.recorded,candidate.recorded],[report.cohorts.synthetic_sealed,candidate.sealed]];
  for(const [group,gates] of groups) {
   const row=group.learning[10][candidate.mode],base=group.learning[10].ratings_only;
   assert.deepEqual(gates,{
    minimumGain:row.gain.mean>=.02,positiveLowerBound:row.gain.lower>0,worstDecile:row.auc.p10-base.auc.p10>=-.01,
    equalBudget:row.eligibleEqualBudgetViewers>0&&(row.equalBudgetGain.lower>0||row.equalBudgetNdcgGain.lower>0),
    correction:row.correction.tested>0&&row.correction.strictReversal/row.correction.tested>=1,
    noisyWorstDecile:row.noise.auc.p10-base.auc.p10>=-.01
   });
  }
  assert.equal(candidate.passed,Object.values(candidate.recorded).every(Boolean)&&Object.values(candidate.sealed).every(Boolean));
 }
 assert.equal(report.decision.status==='promote_for_confirmation',report.candidates.some(c=>c.passed));
});
test('Scored evaluation items belong to the held-out split',()=>{
 for(const viewer of report.viewerResults) {
  const fixture=viewer.cohort.startsWith('synthetic_')?fixtures.synthetic:fixtures[viewer.cohort];
  const person=(fixture.viewers??fixture.personas).find(p=>p.id===viewer.viewer);
  const heldout=new Set(person.heldOutRatings?.map(r=>r.filmKey)??fixture.holdoutKeys);
  const training=new Set(person.trainingRatings?.map(r=>r.filmKey)??fixture.trainingKeys);
  assert([...heldout].every(id=>!training.has(id)));
  for(const session of viewer.sessions)for(const checkpoint of Object.values(session.checkpoints))for(const arm of Object.values(checkpoint.arms)) {
   assert(arm.top10.every(id=>heldout.has(id)));
  }
 }
});
