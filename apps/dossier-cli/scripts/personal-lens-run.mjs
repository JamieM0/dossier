import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { featureVector, PERSONAL_LENS_CONFIG, lensRuleId, readPersonalLens, matchesLensRule } from '@dossier/domain';
import { execute } from '../dist/actions.js';
import { assess, average, distribution, key, round, shuffled } from './hard-metrics.mjs';
import { meanInterval } from './real-metrics.mjs';
const argv=process.argv.slice(2).filter(a=>a!=='--'),value=(flag,fallback)=>argv.includes(flag)?argv[argv.indexOf(flag)+1]:fallback;
const maxViewers=Number(value('--max-viewers','0')),cohortFilter=value('--cohort',null),output=value('--output','reports/personal-lens-v1.json');
if(!Number.isSafeInteger(maxViewers)||maxViewers<0)throw new Error('Invalid viewer limit');
if(value('--protocol','personal-lens-v1')!=='personal-lens-v1')throw new Error('Unknown protocol');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const bytes=readFileSync('apps/dossier-cli/benchmarks/personal-lens-v1-protocol.json'),protocol=JSON.parse(bytes);
assert.deepEqual(protocol.candidate,PERSONAL_LENS_CONFIG);
assert.equal(hash(readFileSync('apps/dossier-cli/scripts/prepare-personal-lens.mjs')),protocol.generatorHash);
const modelPaths=readdirSync('packages/domain/dist',{recursive:true}).filter(p=>p.endsWith('.js')&&!p.endsWith('.test.js')).map(p=>'packages/domain/dist/'+p).concat(['apps/dossier-cli/dist/actions.js']);
const evaluatorPaths=['personal-lens-run.mjs','personal-lens-report.mjs','hard-metrics.mjs','real-metrics.mjs'].map(p=>'apps/dossier-cli/scripts/'+p);
const fingerprint=paths=>hash(Buffer.concat(paths.slice().sort().flatMap(path=>[Buffer.from(path+'\n'),readFileSync(path)])));
const modelFingerprint=fingerprint(modelPaths),evaluatorFingerprint=fingerprint(evaluatorPaths);
const viewers=[];
for(const [cohort,entry] of Object.entries(protocol.fixtures)) {
 const data=readFileSync(entry.path);assert.equal(hash(data),entry.sha256);
 const fixture=JSON.parse(data);
 // Descriptive allowlist: raw utilities and identities never enter the catalogue.
 const byKey=new Map(fixture.items.map(raw=>{
  const item={id:raw.id,medium:raw.medium,title:raw.title,year:raw.year,genres:raw.genres,genreIds:raw.genreIds??[],keywords:raw.keywords,
   overview:raw.overview??'',runtime:raw.runtime??null,collection:raw.collection??null,directorIds:raw.directorIds??[],creatorIds:raw.creatorIds??[],
   features:cohort==='synthetic'?raw.features:featureVector(raw),posterPath:null,voteAverage:null,voteCount:0,popularity:null};
  return [key(item),item];
 }));
 // Prior fixture vectors are recomputed by the same lens in the source generators.
 for(const [index,person] of (fixture.viewers??fixture.personas).entries()) {
  const label=cohort==='synthetic'?`synthetic_${person.domain}_${person.partition}`:cohort;
  const rows=ids=>ids.map(id=>({id,rating:person.ratings[id]}));
  const training=person.trainingRatings?.map(r=>({id:r.filmKey,rating:r.rating}))??rows(person.trainingKeys??fixture.trainingKeys);
  const heldout=person.heldOutRatings?.map(r=>({id:r.filmKey,rating:r.rating}))??rows(person.holdoutKeys??fixture.holdoutKeys);
  const adapter={id:person.id,cohort:label,seedKey:index+1,byKey,training,heldout,rule:cohort==='synthetic'?person.rule:null,type:person.type??'unknown',domain:person.domain??'movies',noiseModulo:person.noiseModulo};
  assert(training.length>=protocol.ratings);assert(training.every(r=>!heldout.some(h=>h.id===r.id)));
  viewers.push(adapter);
 }
}
let selected=cohortFilter?viewers.filter(v=>v.cohort===cohortFilter):viewers;
if(!selected.length)throw new Error('No viewers selected');
if(maxViewers)selected=selected.slice(0,maxViewers);
function client(viewer,keys) {
 let vault={activeId:null,profiles:[]},pool=keys;
 const storage={root:'/personal-lens-experiment',load:()=>vault,save:next=>{vault=next;},audit:()=>{}};
 const catalogue={detail:async(m,id)=>{const item=viewer.byKey.get(`${m}:${id}`);assert(item);return item;},candidates:async()=>pool.map(id=>viewer.byKey.get(id))};
 return {call:(name,args={})=>execute(storage,name,args,catalogue),state:()=>vault.profiles[0].state,setPool:next=>{pool=next;}};
}
async function write(cli,name,args={}){return cli.call(name,{...args,expectedRevision:(await cli.call('profile.show')).revision});}
async function rank(cli,mode) {
 const rows=[];let cursor;
 do {const page=await cli.call('suggest.list',{limit:20,dials:{qualityWeight:0,popularityBias:0},personalLens:mode,...(cursor?{cursor}:{})});rows.push(...page.items);cursor=page.next;}while(cursor);
 assert.equal(new Set(rows.map(r=>r.id)).size,rows.length);return rows;
}
function metric(rows,viewer) {
 const map=Object.fromEntries(rows.map(r=>[r.id,r.score])),truth=Object.fromEntries(viewer.heldout.map(r=>[r.id,r.rating]));
 const candidates=viewer.heldout.map(r=>viewer.byKey.get(r.id));
 const positives=rows.filter(r=>truth[r.id]>0),negatives=rows.filter(r=>truth[r.id]<0);
 let confidentPairs=0,confidentErrors=0;
 for(const a of positives)for(const b of negatives)if(a.lensEvidence.confidence>=PERSONAL_LENS_CONFIG.highConfidence&&b.lensEvidence.confidence>=PERSONAL_LENS_CONFIG.highConfidence){confidentPairs++;if(a.score<=b.score)confidentErrors+=a.score===b.score?.5:1;}
 return {...assess(map,candidates,truth,rows.length>0),confidentPairs,confidentErrors,
  confidentErrorBurden:positives.length*negatives.length?confidentErrors/(positives.length*negatives.length):0,
  confidentErrorRate:confidentPairs?confidentErrors/confidentPairs:null,
  confidentPairCoverage:positives.length*negatives.length?confidentPairs/(positives.length*negatives.length):0,
  meanConfidence:average(rows.map(r=>r.lensEvidence.confidence)),limitedItems:rows.filter(r=>r.lensEvidence.limitations.length).length};
}
async function contractChecks(cli,viewer,rows) {
 const lens=(await cli.call('lens.inspect')).lens;
 const result={portability:false,removal:null,correction:null,limitation:true,correctExplanations:0,explanations:0};
 for(const row of rows) {
  const expected=lens.features.filter(f=>matchesLensRule(viewer.byKey.get(row.id),f.conditions)).map(f=>f.id).sort();
  const actual=row.lensEvidence.matched.map(f=>f.id).sort();assert.deepEqual(actual,expected);
  result.explanations++;result.correctExplanations++;
  if(row.lensEvidence.limitations.length)result.limitation&&=row.lensEvidence.confidence<=PERSONAL_LENS_CONFIG.limitationConfidence;
 }
 const temp=mkdtempSync(join(tmpdir(),'dossier-personal-lens-'));
 try {
  const file=join(temp,'profile.dossier');
  await cli.call('library.export',{path:file,passphrase:'experiment-only-roundtrip'});
  const restored=client(viewer,viewer.heldout.map(r=>r.id));
  await restored.call('profile.import',{name:'Restored lens',path:file,passphrase:'experiment-only-roundtrip'});
  assert.deepEqual((await restored.call('lens.inspect')).lens,lens);
  assert.deepEqual(await rank(restored,'personal'),rows);result.portability=true;
 }finally{rmSync(temp,{recursive:true,force:true});}
 const feature=lens.features[0];
 if(feature) {
  const corrected=client(viewer,viewer.heldout.map(r=>r.id));await corrected.call('profile.create',{name:'Correction'});
  Object.assign(corrected.state(),structuredClone(cli.state()));
  await write(corrected,'lens.correct',{id:feature.id,effect:feature.effect>0?'negative':'positive'});
  const after=await rank(corrected,'personal');
  const afterMap=new Map(after.map(r=>[r.id,r]));
  const changed=rows.filter(r=>matchesLensRule(viewer.byKey.get(r.id),feature.conditions));
  const unaffected=rows.filter(r=>!matchesLensRule(viewer.byKey.get(r.id),feature.conditions));
  const directional=changed.every(r=>(afterMap.get(r.id).score-r.score)*feature.effect<0);
  const pair=feature.pair,aliasViewer={...viewer,byKey:new Map(viewer.byKey)};
  pair.forEach((id,i)=>aliasViewer.byKey.set(`movie:${9900000+i}`,{...viewer.byKey.get(id),id:9900000+i}));
  const pairCli=client(aliasViewer,['movie:9900000','movie:9900001']);await pairCli.call('profile.create',{name:'Control pair'});
  Object.assign(pairCli.state(),structuredClone(cli.state()));
  const original=await rank(pairCli,'personal');
  await write(pairCli,'lens.correct',{id:feature.id,effect:feature.effect>0?'negative':'positive'});
  const flipped=await rank(pairCli,'personal');
  const score=(r,id)=>r.find(x=>x.id===id).score;
  const oldMargin=score(original,'movie:9900000')-score(original,'movie:9900001');
  const newMargin=score(flipped,'movie:9900000')-score(flipped,'movie:9900001');
  const oldSign=Math.sign(cli.state().ratings[pair[0]].rating);
  result.correction={affected:changed.length,directional:changed.length>0&&directional,
   unaffectedScoresStable:unaffected.every(r=>r.score===afterMap.get(r.id).score),
   meanRankMovement:average(rows.map((r,i)=>Math.abs(i-after.findIndex(x=>x.id===r.id)))),
   pairReversed:oldMargin*oldSign>0&&newMargin*oldSign<0,oldMargin,newMargin};
  await write(corrected,'lens.remove',{id:feature.id});
  const removed=await rank(corrected,'personal');
  result.removal={absent:!(await corrected.call('lens.inspect')).lens.features.some(f=>f.id===feature.id),
   noExplanation:removed.every(r=>r.lensEvidence.matched.every(f=>f.id!==feature.id))};
 }
 return result;
}
async function session(viewer,seed) {
 const order=shuffled(viewer.training,seed+viewer.seedKey*1009),cli=client(viewer,viewer.heldout.map(r=>r.id));
 await cli.call('profile.create',{name:'Lens viewer'});
 for(const row of order.slice(0,protocol.ratings))await write(cli,'rate.set',{key:row.id,value:viewer.noiseModulo&&Number(row.id.split(':')[1])%viewer.noiseModulo===0?-row.rating:row.rating});
 const defaultBefore=await cli.call('suggest.list',{limit:20,dials:{qualityWeight:0}});
 const fixed=metric(await rank(cli,'fixed'),viewer),inferred=metric(await rank(cli,'inferred'),viewer);
 const traces=[],checkpoints={0:{fixed,inferred,personal:metric(await rank(cli,'personal'),viewer)}},answers=[];
 let previous=inferred.auc;
 for(let prompt=1;prompt<=protocol.maxPrompts;prompt++) {
  const q=(await cli.call('lens.queue',{limit:1})).items[0];if(!q)break;
  const selection=viewer.rule?.conditions.length?q.choices.find(f=>lensRuleId(f.conditions)===lensRuleId(viewer.rule.conditions)&&f.effect===viewer.rule.effect):null;
  await write(cli,'lens.answer',{id:q.id,choice:selection?.id??'none'});
  const rows=await rank(cli,'personal'),measurement=metric(rows,viewer);
  traces.push({prompt,auc:measurement.auc,delta:round(measurement.auc-previous)});previous=measurement.auc;
  answers.push({question:q,selected:selection?.id??null});
  if(protocol.questionBudgets.includes(prompt))checkpoints[prompt]={fixed,inferred,personal:measurement};
 }
 const finalRows=await rank(cli,'personal'),finalMetric=metric(finalRows,viewer);
 for(const budget of protocol.questionBudgets)if(!checkpoints[budget])checkpoints[budget]={fixed,inferred,personal:finalMetric};
 assert.deepEqual(await cli.call('suggest.list',{limit:20,dials:{qualityWeight:0}}),defaultBefore);
 const contracts=await contractChecks(cli,viewer,finalRows),lens=(await cli.call('lens.inspect')).lens;
 const control=client(viewer,viewer.heldout.map(r=>r.id));await control.call('profile.create',{name:'Fifty ratings'});
 for(const row of order.slice(0,protocol.ratings+protocol.maxPrompts))await write(control,'rate.set',{key:row.id,value:viewer.noiseModulo&&Number(row.id.split(':')[1])%viewer.noiseModulo===0?-row.rating:row.rating});
 return {seed,checkpoints,prompts:answers.length,confirmations:lens.features.length,none:answers.filter(a=>!a.selected).length,
  eligibleRepresented:viewer.rule?.conditions.length>0,ruleRecovered:lens.features.some(f=>viewer.rule&&lensRuleId(f.conditions)===lensRuleId(viewer.rule.conditions)),
  causalCorrect:lens.features.filter(f=>viewer.rule&&lensRuleId(f.conditions)===lensRuleId(viewer.rule.conditions)&&f.effect===viewer.rule.effect).length,
  limitationCount:lens.limitations.length,lens,answers,traces,contracts,ratingControlAvailable:order.length>=protocol.ratings+protocol.maxPrompts,ratingControl:metric(await rank(control,'inferred'),viewer)};
}
function aggregate(rows) {
 const learning={};
 for(const budget of protocol.questionBudgets) {
  learning[budget]={};
  for(const arm of protocol.arms) {
   const perViewer=(v,field)=>average(v.sessions.map(s=>s.checkpoints[budget][arm][field]));
   const aucs=rows.map(v=>perViewer(v,'auc')),deltas=rows.map(v=>perViewer(v,'auc')-average(v.sessions.map(s=>s.checkpoints[budget].inferred.auc)));
   learning[budget][arm]={auc:distribution(aucs),ndcg10:distribution(rows.map(v=>perViewer(v,'ndcg10'))),gain:meanInterval(deltas),
    individualLosses:deltas.filter(d=>d<0).length,largeLosses:deltas.filter(d=>d<=-.05).length,worstViewerDelta:Math.min(0,...deltas),
    confidentErrorBurden:average(rows.map(v=>perViewer(v,'confidentErrorBurden'))),meanConfidence:average(rows.map(v=>perViewer(v,'meanConfidence'))),confidentPairCoverage:average(rows.map(v=>perViewer(v,'confidentPairCoverage')))};
  }
 }
 const equalBudgetRows=rows.filter(v=>v.sessions.every(s=>s.ratingControlAvailable));
 const sessions=rows.flatMap(v=>v.sessions),corrections=sessions.map(s=>s.contracts.correction).filter(Boolean),removals=sessions.map(s=>s.contracts.removal).filter(Boolean);
 const represented=rows.filter(v=>v.sessions[0].eligibleRepresented);
 return {viewers:rows.length,learning,
  equalPromptViewers:equalBudgetRows.length,equalPromptGain:meanInterval(equalBudgetRows.map(v=>average(v.sessions.map(s=>s.checkpoints[10].personal.auc-s.ratingControl.auc)))),
  prompts:distribution(rows.map(v=>average(v.sessions.map(s=>s.prompts)))),confirmed:distribution(rows.map(v=>average(v.sessions.map(s=>s.confirmations)))),
  questionCoverage:average(rows.map(v=>average(v.sessions.map(s=>s.prompts>0?1:0)))),
  ruleRecovery:represented.length?average(represented.map(v=>average(v.sessions.map(s=>s.ruleRecovered?1:0)))):null,
  causalPrecision:sessions.reduce((n,s)=>n+s.confirmations,0)?sessions.reduce((n,s)=>n+s.causalCorrect,0)/sessions.reduce((n,s)=>n+s.confirmations,0):null,
  worstPromptDelta:Math.min(0,...sessions.flatMap(s=>s.traces.map(t=>t.delta))),
  correction:{tested:corrections.length,reversed:corrections.filter(c=>c.pairReversed).length,directional:corrections.filter(c=>c.directional).length,
   unaffectedScoresStable:corrections.every(c=>c.unaffectedScoresStable),meanRankMovement:average(corrections.map(c=>c.meanRankMovement))},
  explanationPrecision:average(sessions.map(s=>s.contracts.explanations?s.contracts.correctExplanations/s.contracts.explanations:0)),
  contracts:{encryptedRoundtrip:sessions.every(s=>s.contracts.portability),limitations:sessions.every(s=>s.contracts.limitation),
   removal:removals.length>0&&removals.every(r=>r.absent&&r.noExplanation)},
  limitations:sessions.reduce((n,s)=>n+s.limitationCount,0)};
}
const started=performance.now(),viewerResults=[];
for(const [index,viewer]of selected.entries()) {
 assert.equal(fingerprint(modelPaths),modelFingerprint);assert.equal(fingerprint(evaluatorPaths),evaluatorFingerprint);
 const sessions=[];for(const seed of protocol.seeds)sessions.push(await session(viewer,seed));
 viewerResults.push({viewer:viewer.id,cohort:viewer.cohort,type:viewer.type,sessions});
 if(index%10===0||index+1===selected.length)process.stderr.write(`Personal lens viewers ${index+1}/${selected.length} (${viewer.cohort})\n`);
}
const cohorts=Object.fromEntries([...new Set(viewerResults.map(v=>v.cohort))].map(c=>[c,aggregate(viewerResults.filter(v=>v.cohort===c))]));
const gates=group=>{
 const row=group.learning[10].personal,base=group.learning[10].inferred,g=protocol.gates;
 return {minimumGain:row.gain.mean>=g.minimumGain,positiveLowerBound:row.gain.lower>0,worstDecile:row.auc.p10-base.auc.p10>=g.worstDecileMinimumDelta,
  sampleEfficiency:group.equalPromptGain.lower>0,promptSafety:group.worstPromptDelta>=-g.maxSinglePromptLoss,
  ruleRecovery:group.ruleRecovery>=g.minimumRuleRecovery,questionCoverage:group.questionCoverage>=g.minimumQuestionCoverage,
  causalPrecision:group.causalPrecision!==null&&group.causalPrecision>=g.minimumExplanationPrecision,
  explanationPrecision:group.explanationPrecision>=g.minimumExplanationPrecision,
  confidentErrors:base.confidentErrorBurden-row.confidentErrorBurden>=g.minimumConfidenceErrorReduction,
  correction:group.correction.tested>0&&group.correction.reversed/group.correction.tested>=g.correctionReversalRate,
  correctionLocality:group.correction.unaffectedScoresStable,...group.contracts};
};
const sealedNames=['synthetic_movies_sealed','synthetic_books_sealed'];
const candidateGates=Object.fromEntries(sealedNames.filter(c=>cohorts[c]).map(c=>[c,gates(cohorts[c])]));
const smoke=Boolean(maxViewers||cohortFilter),passed=Object.keys(candidateGates).length===2&&Object.values(candidateGates).every(g=>Object.values(g).every(Boolean));
const decision={status:smoke?'smoke_only':passed?'promote_for_confirmation':'do_not_promote',
 reason:smoke?'Limited runs cannot select a model.':passed?'All frozen gates passed in both invented domains; seek independent human confirmation.':'The personal lens did not pass every frozen learning, control, and coverage gate in both sealed domains.'};
const ruleTypes=Object.fromEntries(['tag','interaction','creator','decade','axis','unknown'].map(type=>[type,aggregate(viewerResults.filter(v=>v.cohort.startsWith('synthetic_')&&v.type===type))]));
const report={version:protocol.version,protocol,protocolHash:hash(bytes),modelFingerprint,evaluatorFingerprint,durationSeconds:round((performance.now()-started)/1000,2),viewers:viewerResults.length,sessions:viewerResults.length*protocol.seeds.length,cohorts,ruleTypes,candidateGates,decision,viewerResults};
writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({output,viewers:report.viewers,decision,candidateGates,durationSeconds:report.durationSeconds}));
