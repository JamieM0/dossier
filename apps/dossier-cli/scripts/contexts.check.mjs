import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { CONTEXT_CONFIG, CONTEXT_ARMS, createDefaultState, setLibraryRating, scoreContexts, readContexts } from '@dossier/domain';
import { average, assess, key, round, shuffled } from './hard-metrics.mjs';
import { summarize, decide } from './contexts-metrics.mjs';
const read=p=>JSON.parse(existsSync(p)?readFileSync(p):gunzipSync(readFileSync(p+'.gz')));
const protocol=read('benchmarks/contextual-taste-v1-protocol.json'),report=read('../../reports/contextual-taste-v1.json');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const fixture=read('../../'+protocol.fixtures.synthetic.path);
const byKey=new Map(fixture.items.map(raw=>[key(raw),{id:raw.id,medium:raw.medium,title:raw.title,year:raw.year,genres:raw.genres,
 genreIds:raw.genreIds??[],keywords:raw.keywords??[],overview:raw.overview??'',runtime:raw.runtime??null,collection:raw.collection??null,
 directorIds:raw.directorIds??[],creatorIds:raw.creatorIds??[],features:raw.features,posterPath:null,voteAverage:null,voteCount:0,popularity:null}]));
test('experiment 5 freezes fixtures and reserves new context people',()=>{
 assert.deepEqual(report.protocol,protocol);assert.deepEqual(protocol.candidate,CONTEXT_CONFIG);assert.deepEqual(protocol.arms,CONTEXT_ARMS);
 assert.equal(report.protocolHash,sha(readFileSync('benchmarks/contextual-taste-v1-protocol.json')));
 assert.equal(protocol.generatorHash,sha(readFileSync('scripts/prepare-contexts.mjs')));
 for(const f of Object.values(protocol.fixtures))assert.equal(f.sha256,sha(readFileSync('../../'+f.path)));
 assert.equal(report.viewers,534);assert.equal(report.sessions,1068);assert.equal(report.experiment,'5');
 assert.equal(fixture.viewers.filter(v=>v.partition==='sealed').length,48);
 const previous=new Set(Object.entries(protocol.fixtures).filter(([name])=>name!=='synthetic').flatMap(([,f])=>{
  const data=read('../../'+f.path);return(data.viewers??data.personas).map(v=>v.id);
 }));
 for(const person of fixture.viewers){assert(!previous.has(person.id));assert(person.globalEvents.every(e=>!person.holdoutKeys.includes(e.key)));assert(person.events.every(e=>!person.holdoutKeys.includes(e.key)));}
});
test('every supplied scope and rating matches its frozen personal evidence',()=>{
 for(const v of report.viewerResults){assert.equal(v.sessions.length,2);
  for(const s of v.sessions){assert(s.contracts.roundtrip);assert(s.contracts.deterministic);assert(s.globalDefaultStable);assert(s.contracts.globalClaimsStable);
   readContexts(s.profile);
   if(!v.fresh){assert.equal(s.events.length,0);assert.equal(s.noContextEqual,true);continue;}
   const person=fixture.viewers.find(p=>p.id===v.viewer),index=fixture.viewers.indexOf(person);assert(person);
   assert.deepEqual(s.globalEvents,shuffled(person.globalEvents,s.seed+(index+1)*1009).slice(0,20));
   for(const event of s.events){assert(person.events.some(e=>JSON.stringify(e)===JSON.stringify(event)));assert(!person.holdoutKeys.includes(event.key));}
   for(const context of protocol.contexts){const events=s.events.filter(e=>e.context===context);assert.equal(s.counts[context],events.length);
    const stored=s.profile.contexts.find(c=>c.id===context);assert(stored);
    assert.equal(Object.keys(stored.ratings).length,events.length);
    for(const e of events){assert.equal(stored.ratings[e.key].rating,e.rating);assert.equal(stored.ratings[e.key].ts,e.ts);}
    let previous=s.checkpoints[0].shared[context].auc;
    for(const t of s.traces.filter(t=>t.scope===context)){assert.equal(t.delta,round(t.auc-previous));previous=t.auc;}
   }
   assert.deepEqual(s.claims.map(c=>c.scope),['global',...protocol.contexts]);
  }
 }
});
test('fresh checkpoint rankings recompute from revealed evidence alone',()=>{
 for(const v of report.viewerResults.filter(v=>v.fresh))for(const s of v.sessions){
  const person=fixture.viewers.find(p=>p.id===v.viewer);let state=createDefaultState();
  for(const e of s.globalEvents)state=setLibraryRating(state,e.key,e.rating,{...byKey.get(e.key),key:e.key},e.ts);
  for(const budget of [0,3,20]){
   const contexts={version:1,contexts:protocol.contexts.map(c=>({id:c,name:c,ratings:Object.fromEntries(s.events.filter(e=>e.context===c).slice(0,budget).map(e=>[e.key,{item:{...byKey.get(e.key),key:e.key},rating:e.rating,ts:e.ts}]))}))};
   for(const arm of protocol.arms)for(const scope of ['global',...protocol.contexts]){
    const result=scoreContexts(person.holdoutKeys.map(k=>byKey.get(k)),Object.values(state.ratings),state.tasteClaims,contexts,scope==='global'?undefined:scope,arm);
    const scores=Object.fromEntries(result.available?result.rows.map(r=>[key(r.item),r.score]):[]);
    const expected=assess(scores,person.holdoutKeys.map(k=>byKey.get(k)),person.ratings[scope],result.available),actual=s.checkpoints[budget][arm][scope];
    for(const field of ['auc','ndcg10','precision10','top10','coverage'])assert.deepEqual(actual[field],expected[field]);
    assert.equal(actual.unavailable,!result.available);
   }
  }
 }
});
test('viewer aggregation and frozen gates determine the decision mechanically',()=>{
 for(const [name,c]of Object.entries(report.cohorts))assert.deepEqual(c,summarize(report.viewerResults.filter(v=>v.cohort===name),protocol));
 const computed=decide(report.viewerResults,protocol,false);assert.deepEqual(report.candidateGates,computed.candidateGates);assert.deepEqual(report.decision,computed.decision);
 assert.equal(decide(report.viewerResults,protocol,true).decision.status,'smoke_only');
});
