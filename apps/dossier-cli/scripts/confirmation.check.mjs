import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { featureVector } from '@dossier/domain';
import { reviewsPlusTags } from './reviews-plus-tags-v1.mjs';
import { componentScores } from './study-metrics.mjs';
const read=path=>JSON.parse(readFileSync(new URL(path,import.meta.url)));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

test('confirmation excludes all previously tested viewers and preserves hidden truth separation',()=>{
  const old=read('../src/lab/real-tmdb-v1.json'),fresh=read('../src/lab/new-viewers-v1.json'),protocol=read('../benchmarks/confirmation-v1-protocol.json');
  assert.equal(hash(readFileSync(new URL('../src/lab/new-viewers-v1.json',import.meta.url))),protocol.fixtureHash);
  assert.equal(hash(readFileSync(new URL('./reviews-plus-tags-v1.mjs',import.meta.url))),protocol.candidateHash);
  assert.equal(fresh.viewers.length,47);
  assert.deepEqual(old.items,fresh.items);
  const originalIds=new Set(old.viewers.map(row=>row.sourceUserId));
  for(const viewer of fresh.viewers){
    assert.ok(!originalIds.has(viewer.sourceUserId));
    const training=new Set(viewer.trainingRatings.map(row=>row.filmKey));
    assert.ok(training.size>=40);
    assert.equal(viewer.heldOutRatings.length,60);
    assert.ok(viewer.heldOutRatings.every(row=>!training.has(row.filmKey)));
  }
});
test('frozen candidate exactly matches the original method, including arithmetic order',()=>{
  const f=read('../src/lab/real-tmdb-v1.json');
  const items=f.items.slice(0,60).map(item=>({...item,features:featureVector(item)}));
  const entries=items.slice(0,20).map((item,i)=>({item:{...item,key:`movie:${item.id}`},rating:i%3===0?0:i%2===0?3:-2,ts:0}));
  assert.deepEqual(reviewsPlusTags(items,entries),componentScores(items,entries,[]).find(row=>row.name==='quality_plus_metadata').scores);
});
test('the frozen regression fixture and evaluator cannot change silently',()=>{
  const reference=read('../benchmarks/tmdb-study-v1-reference.json');
  for(const[path,expected]of Object.entries(reference.protectedFiles))assert.equal(hash(readFileSync(new URL('../../../'+path,import.meta.url))),expected,path);
});
test('diagnostic attribution reconstructs the observed ranking change',()=>{
  const report=JSON.parse(readFileSync(new URL('../../../reports/backwards-learning-diagnosis-v1.json',import.meta.url)));
  assert.equal(report.cases.length,5);
  for(const row of report.cases){
    assert.ok(row.reproduced);
    for(const transition of [row.overall,row.transition]){
      const total=Object.values(transition.shapley).reduce((a,b)=>a+b,0);
      assert.ok(Math.abs(total-(transition.hybrids[7]-transition.hybrids[0]))<.000002);
    }
    assert.equal(row.trace[9].auc,row.auc10);
    assert.equal(row.trace[39].auc,row.auc40);
  }
});
