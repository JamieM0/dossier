import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { featureVector } from '@dossier/domain';
import { execute } from '../dist/actions.js';
import { decideOverride,dossierScores } from './override-guard-v1.mjs';
const read=p=>JSON.parse(readFileSync(new URL(p,import.meta.url)));
const fixture=read('../src/lab/override-viewers-v1.json');
const byKey=new Map(fixture.items.map(({source,...item})=>[`${item.medium}:${item.id}`,{...item,features:featureVector(item)}]));
const entries=fixture.viewers[0].trainingRatings.slice(0,20).map(row=>({item:{...byKey.get(row.filmKey),key:row.filmKey},rating:row.rating,ts:0}));

test('override experiment preserves its candidate, rule, new viewers, and hidden films',()=>{
  const p=read('../benchmarks/override-v1-protocol.json');
  for(const[path,expected]of [['./reviews-plus-tags-v1.mjs',p.candidateHash],['./override-guard-v1.mjs',p.guardHash],['../src/lab/override-viewers-v1.json',p.freshFixtureHash]])assert.equal(createHash('sha256').update(readFileSync(new URL(path,import.meta.url))).digest('hex'),expected);
  const old=[read('../src/lab/real-tmdb-v1.json'),read('../src/lab/new-viewers-v1.json')];
  const used=new Set(old.flatMap(f=>f.viewers.map(v=>v.sourceUserId)));
  assert.equal(fixture.viewers.length,30);
  assert.deepEqual(fixture.items,old[0].items);
  for(const v of fixture.viewers){assert.ok(!used.has(v.sourceUserId));assert.ok(v.trainingRatings.length>=40);assert.equal(v.heldOutRatings.length,40);const train=new Set(v.trainingRatings.map(r=>r.filmKey));assert.ok(v.heldOutRatings.every(r=>!train.has(r.filmKey)));}
});
test('rating-validation scorer rebuilds the frozen cluster baseline in a clean CLI profile',async()=>{
  let vault={activeId:null,profiles:[]};
  const storage={root:'/test-override',load:()=>vault,save:next=>{vault=next},audit:()=>{}};
  const candidates=fixture.viewers[0].heldOutRatings.slice(0,8).map(row=>byKey.get(row.filmKey));
  const catalogue={detail:async(medium,id)=>byKey.get(`${medium}:${id}`),candidates:async()=>candidates};
  let revision=(await execute(storage,'profile.create',{name:'Validation parity'},catalogue)).revision;
  for(const entry of entries)revision=(await execute(storage,'rate.set',{key:entry.item.key,value:entry.rating,expectedRevision:revision},catalogue)).revision;
  const page=await execute(storage,'suggest.list',{limit:20,learnedTaste:'clusters'},catalogue);
  assert.deepEqual(Object.fromEntries(page.items.map(row=>[row.id,row.score])),dossierScores(candidates,entries));
});
test('override rule abstains with sparse, one-sided, or public-review-aligned evidence',()=>{
  assert.equal(decideOverride(entries.slice(0,10)).useDossier,false);
  assert.equal(decideOverride(entries.map(e=>({...e,rating:3}))).useDossier,false);
  const ranked=entries.slice().sort((a,b)=>a.item.voteAverage-b.item.voteAverage).map((e,i)=>({...e,rating:i<10?-3:3}));
  const decision=decideOverride(ranked);
  assert.equal(decision.useDossier,false);
  assert.equal(decision.reason,'public_reviews_not_clearly_misaligned');
});

test('override report retains every unusual-taste case and all five failure sessions',()=>{
  const report=read('../../../reports/observed-rating-override-v1.json');
  const previous=read('../../../reports/reviews-plus-tags-confirmation-v1.json');
  const diagnosis=read('../../../reports/backwards-learning-diagnosis-v1.json');
  assert.deepEqual(report.viewers.filter(v=>v.explicitRisk).map(v=>v.id).sort(),previous.viewers.filter(v=>v.highRisk).map(v=>v.id).sort());
  assert.equal(report.failures.length,5);
  for(const failure of report.failures){
    const old=diagnosis.cases.find(r=>r.viewer===failure.viewer&&r.seed===failure.seed);
    assert.ok(old);
    assert.equal(failure.current10,old.auc10);assert.equal(failure.current40,old.auc40);
    const session=report.sessions.find(s=>s.viewer===failure.viewer&&s.seed===failure.seed);
    for(let count=1;count<=40;count++)assert.ok(session.snapshots[count]);
    const protectedResult=failure.guardGainCurrent>=.03&&failure.guardDelta>=-.03&&failure.worstStep.delta>=-.05;
    assert.equal(failure.protected,protectedResult);
  }
  assert.equal(report.demonstrated,Object.values(report.checks).every(Boolean));
});
