import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AXIS_KEYS, tasteClaimScoreAdjustment } from '@dossier/domain';
import { createCorroborationScorer } from './corroboration-policy.mjs';
const vector=Object.fromEntries(AXIS_KEYS.map((axis,i)=>[axis,i===0?1:0]));
const item=id=>({id,medium:'movie',key:`movie:${id}`,title:`Film ${id}`,features:{...vector},genres:['Drama'],keywords:[],voteAverage:null});
const entry=(id,rating=3,ts=0)=>({item:item(id),rating,ts});
const candidate=item(900);
const inferred={id:'claim:test',conditions:[{kind:'genre',value:'Drama',label:'Drama'}],effect:'positive',confidence:.9,active:true,provenance:'inferred',
  evidence:{supportingItemKeys:[],counterexampleItemKeys:[],supportingWeight:0,counterexampleWeight:0,matchedItemCount:0,tasteSpaceClusterIds:[]}};
test('one title keeps its exact rating without corroborating its own generalization',()=>{
  const stored=[entry(1)],before=structuredClone(stored),score=createCorroborationScorer();
  assert.equal(score([candidate],stored,[],'timeless',true,0,0).rows[0].score,0);
  assert(score([candidate],[...stored,entry(2)],[],'timeless',true,0,0).rows[0].score>0);
  assert.deepEqual(stored,before);
});
test('duplicated metadata cannot create unbounded corroborating influence',()=>{
  const result=createCorroborationScorer()([candidate],Array.from({length:100},(_,i)=>entry(i)),[],'timeless',true,0,0);
  assert(result.rows[0].score>0&&result.rows[0].score<.5);
  assert(result.evidence.every(e=>e.duplicateCount===100));
});
test('claim guard preserves confirmed authority and rejection while limiting unsupported inference',()=>{
  const score=createCorroborationScorer(),entries=[entry(1)],claims=[inferred],before=structuredClone(claims);
  assert.equal(score([candidate],entries,claims,'timeless',true,0,0).rows[0].score,0);
  const confirmed={...inferred,provenance:'user_confirmed'};
  assert.equal(score([candidate],entries,[confirmed],'timeless',true,0,0).rows[0].score,tasteClaimScoreAdjustment(candidate,[confirmed]));
  const rejected={...inferred,provenance:'explicitly_rejected',active:false};
  assert.equal(score([candidate],entries,[rejected],'timeless',true,0,0).rows[0].score,0);
  assert.deepEqual(claims,before);
});
test('corroboration respects chronological evidence while remaining invariant to storage order',()=>{
  const score=createCorroborationScorer(),entries=[entry(1,3,0),entry(2,3,0),entry(3,-3,90*86400000),entry(4,-3,90*86400000)];
  const result=score([candidate],entries,[],'recent',true,0,90*86400000);
  assert(result.rows[0].score<0);
  assert.deepEqual(score([candidate],[...entries].reverse(),[],'recent',true,0,90*86400000),result);
});
