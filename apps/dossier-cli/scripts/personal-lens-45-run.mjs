import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { featureVector, PERSONAL_LENS_CONFIG, PERSONAL_LENS_45_CONFIG, LENS45_MODES, sharedRule, matchesTasteClaim, claimConditionsForRule, projectConfirmedClaims, lensRuleId, readPersonalLens, matchesLensRule } from '@dossier/domain';
import { execute } from '../dist/actions.js';
import { assess, average, distribution, key, round, shuffled } from './hard-metrics.mjs';
import { meanInterval } from './real-metrics.mjs';
const argv=process.argv.slice(2).filter(a=>a!=='--'),value=(flag,fallback)=>argv.includes(flag)?argv[argv.indexOf(flag)+1]:fallback;
const maxViewers=Number(value('--max-viewers','0')),cohortFilter=value('--cohort',null),output=value('--output','reports/personal-lens-45-v1.json');
if(!Number.isSafeInteger(maxViewers)||maxViewers<0)throw new Error('Invalid viewer limit');
if(value('--protocol','personal-lens-45-v1')!=='personal-lens-45-v1')throw new Error('Unknown protocol');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const bytes=readFileSync('apps/dossier-cli/benchmarks/personal-lens-45-v1-protocol.json'),protocol=JSON.parse(bytes);
assert.deepEqual(protocol.candidate,PERSONAL_LENS_45_CONFIG);
assert.equal(hash(readFileSync('apps/dossier-cli/scripts/prepare-personal-lens-45.mjs')),protocol.generatorHash);
const modelPaths=readdirSync('packages/domain/dist',{recursive:true}).filter(p=>p.endsWith('.js')&&!p.endsWith('.test.js')).map(p=>'packages/domain/dist/'+p).concat(['apps/dossier-cli/dist/actions.js']);
const evaluatorPaths=['personal-lens-45-run.mjs','personal-lens-45-report.mjs','hard-metrics.mjs','real-metrics.mjs'].map(p=>'apps/dossier-cli/scripts/'+p);
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
   features:['synthetic','lens4_regression'].includes(cohort)?raw.features:featureVector(raw),posterPath:null,voteAverage:null,voteCount:0,popularity:null};
  return [key(item),item];
 }));
 // Prior fixture vectors are recomputed by the same lens in the source generators.
 for(const [index,person] of (fixture.viewers??fixture.personas).entries()) {
  const label=cohort==='synthetic'?`synthetic_${person.domain}_${person.partition}`:cohort==='lens4_regression'?`lens4_${person.domain}_regression`:cohort;
  const rows=ids=>ids.map(id=>({id,rating:person.ratings[id]}));
  const training=person.trainingRatings?.map(r=>({id:r.filmKey,rating:r.rating}))??rows(person.trainingKeys??fixture.trainingKeys);
  const heldout=person.heldOutRatings?.map(r=>({id:r.filmKey,rating:r.rating}))??rows(person.holdoutKeys??fixture.holdoutKeys);
  const adapter={id:person.id,cohort:label,seedKey:index+1,byKey,training,heldout,rule:['synthetic','lens4_regression'].includes(cohort)?person.rule:null,type:person.type??'unknown',domain:person.domain??'movies',noiseModulo:person.noiseModulo};
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
 do {const page=await cli.call('suggest.list',{limit:20,dials:{qualityWeight:0,popularityBias:0},...(LENS45_MODES.includes(mode)?{experiment45:mode}:{personalLens:mode==='narrow_personal'?'personal':mode}),...(cursor?{cursor}:{})});rows.push(...page.items);cursor=page.next;}while(cursor);
 assert.equal(new Set(rows.map(r=>r.id)).size,rows.length);return rows;
}
function metric(rows,viewer) {
 const map=Object.fromEntries(rows.map(r=>[r.id,r.score])),truth=Object.fromEntries(viewer.heldout.map(r=>[r.id,r.rating]));
 const candidates=viewer.heldout.map(r=>viewer.byKey.get(r.id));
 const positives=rows.filter(r=>truth[r.id]>0),negatives=rows.filter(r=>truth[r.id]<0);
 let confidentPairs=0,confidentErrors=0;
 for(const a of positives)for(const b of negatives)if((a.lens45Evidence??a.lensEvidence).confidence>=PERSONAL_LENS_CONFIG.highConfidence&&(b.lens45Evidence??b.lensEvidence).confidence>=PERSONAL_LENS_CONFIG.highConfidence){confidentPairs++;if(a.score<=b.score)confidentErrors+=a.score===b.score?.5:1;}
 return {...assess(map,candidates,truth,rows.length>0),confidentPairs,confidentErrors,
  confidentErrorBurden:positives.length*negatives.length?confidentErrors/(positives.length*negatives.length):0,
  confidentErrorRate:confidentPairs?confidentErrors/confidentPairs:null,
  confidentPairCoverage:positives.length*negatives.length?confidentPairs/(positives.length*negatives.length):0,
  meanConfidence:average(rows.map(r=>(r.lens45Evidence??r.lensEvidence).confidence)),limitedItems:rows.filter(r=>(r.lens45Evidence??r.lensEvidence).limitations.length).length};
}
const sameScores=(a,b)=>JSON.stringify(a.map(r=>[r.id,r.score]))===JSON.stringify(b.map(r=>[r.id,r.score]));
async function contractChecks(cli,viewer,byMode) {
 const lens=(await cli.call('lens45.inspect')).lens;
 const result={portability:false,sharedScoresEqual:sameScores(byMode.broad_shared,byMode.broad_claims_equal_strength),
  explanations:true,limitations:true,corrections:{},removals:{}};
 for(const mode of LENS45_MODES) {
  const expectedProjection=projectConfirmedClaims(Object.values(cli.state().ratings),cli.state().tasteClaims,lens,mode==='broad_authored_claims');
  const native=mode==='broad_native_claims'||mode==='broad_authored_claims';
  for(const row of byMode[mode]) {
   const eligible=lens.features.filter(f=>native?expectedProjection.applied.includes(f.id):mode==='broad_shared'||mode==='broad_claims_equal_strength'?sharedRule(f):true);
   const expected=eligible.filter(f=>{
    if(native||mode==='broad_claims_equal_strength')return matchesTasteClaim(viewer.byKey.get(row.id),{conditions:claimConditionsForRule(f)});
    return matchesLensRule(viewer.byKey.get(row.id),f.conditions);
   }).map(f=>f.id).sort();
   const actual=row.lens45Evidence.matched.map(f=>f.id).sort();
   assert.deepEqual(actual,expected);
   if(row.lens45Evidence.limitations.length)result.limitations&&=row.lens45Evidence.confidence<=PERSONAL_LENS_CONFIG.limitationConfidence;
  }
 }
 const temp=mkdtempSync(join(tmpdir(),'dossier-lens45-'));
 try {
  const path=join(temp,'profile.dossier');await cli.call('library.export',{path,passphrase:'experiment45-roundtrip'});
  const restored=client(viewer,viewer.heldout.map(r=>r.id));await restored.call('profile.import',{name:'Restored45',path,passphrase:'experiment45-roundtrip'});
  assert.deepEqual((await restored.call('lens45.inspect')).lens,lens);
  for(const mode of LENS45_MODES)assert.deepEqual(await rank(restored,mode),byMode[mode]);
  result.portability=true;
 }finally{rmSync(temp,{recursive:true,force:true});}
 const feature=lens.features[0];if(!feature)return result;
 const pool=feature.pair,aliasViewer={...viewer,byKey:new Map(viewer.byKey)};
 pool.forEach((id,i)=>aliasViewer.byKey.set(`movie:${9900000+i}`,{...viewer.byKey.get(id),id:9900000+i}));
 const pairCli=client(aliasViewer,['movie:9900000','movie:9900001']);await pairCli.call('profile.create',{name:'Pair45'});
 Object.assign(pairCli.state(),structuredClone(cli.state()));
 const before=Object.fromEntries(await Promise.all(LENS45_MODES.map(async mode=>[mode,await rank(pairCli,mode)])));
 await write(pairCli,'lens45.correct',{id:feature.id,effect:feature.effect>0?'negative':'positive'});
 const after=Object.fromEntries(await Promise.all(LENS45_MODES.map(async mode=>[mode,await rank(pairCli,mode)])));
 const changed=client(viewer,viewer.heldout.map(r=>r.id));await changed.call('profile.create',{name:'Changed45'});
 Object.assign(changed.state(),structuredClone(pairCli.state()));
 for(const mode of LENS45_MODES) {
  const rows=await rank(changed,mode),map=new Map(rows.map(r=>[r.id,r]));
  const native=mode==='broad_native_claims'||mode==='broad_authored_claims';
  const applicable=native?byMode[mode].some(r=>r.lens45Evidence.applied.includes(feature.id)):
   mode==='broad_shared'||mode==='broad_claims_equal_strength'?sharedRule(feature):true;
  if(!applicable)continue;
  const matches=item=>native?matchesTasteClaim(item,{conditions:claimConditionsForRule(feature)}):matchesLensRule(item,feature.conditions);
  const relevant=byMode[mode].filter(r=>matches(viewer.byKey.get(r.id))),unrelated=byMode[mode].filter(r=>!matches(viewer.byKey.get(r.id)));
  const margin=rows=>rows.find(r=>r.id==='movie:9900000').score-rows.find(r=>r.id==='movie:9900001').score;
  result.corrections[mode]={pairReversed:margin(before[mode])*feature.effect>0&&margin(after[mode])*feature.effect<0,
   beforeMargin:margin(before[mode]),afterMargin:margin(after[mode]),directional:relevant.length>0&&relevant.every(r=>(map.get(r.id).score-r.score)*feature.effect<0),
   unrelatedStable:unrelated.every(r=>r.score===map.get(r.id).score),affected:relevant.length,
   meanRankMovement:average(byMode[mode].map((r,i)=>Math.abs(i-rows.findIndex(x=>x.id===r.id))))};
 }
 await write(changed,'lens45.remove',{id:feature.id});
 for(const mode of LENS45_MODES) {
  const rows=await rank(changed,mode);
  result.removals[mode]={absent:!(await changed.call('lens45.inspect')).lens.features.some(f=>f.id===feature.id),
   noExplanation:rows.every(r=>r.lens45Evidence.matched.every(f=>f.id!==feature.id))};
 }
 return result;
}
async function session(viewer,seed) {
 const order=shuffled(viewer.training,seed+viewer.seedKey*1009),cli=client(viewer,viewer.heldout.map(r=>r.id));
 await cli.call('profile.create',{name:'Broad45'});
 for(const row of order.slice(0,protocol.ratings))await write(cli,'rate.set',{key:row.id,value:viewer.noiseModulo&&Number(row.id.split(':')[1])%viewer.noiseModulo===0?-row.rating:row.rating});
 const initialState=structuredClone(cli.state()),defaultBefore=await cli.call('suggest.list',{limit:20,dials:{qualityWeight:0}});
 const inferredRows=await rank(cli,'inferred'),inferred=metric(inferredRows,viewer);
 const capture=async()=>Object.fromEntries(await Promise.all(LENS45_MODES.map(async mode=>[mode,metric(await rank(cli,mode),viewer)])));
 const checkpoints={0:{inferred,...await capture()}},answers=[],traces=[];
 let previous=inferred.auc;
 for(let prompt=1;prompt<=protocol.maxPrompts;prompt++) {
  const question=(await cli.call('lens45.queue',{limit:1})).items[0];if(!question)break;
  const rule=question.choices[0],confirm=viewer.rule?.conditions.length&&lensRuleId(rule.conditions)===lensRuleId(viewer.rule.conditions)&&rule.effect===viewer.rule.effect;
  const answer=confirm?'confirm':viewer.rule&&viewer.rule.conditions.length===0?'unknown':'none';
  await write(cli,'lens45.answer',{id:question.id,answer});
  const auc=confirm?metric(await rank(cli,'broad_personal'),viewer).auc:previous;
  traces.push({prompt,auc,delta:round(auc-previous)});previous=auc;answers.push({question,answer});
  if(protocol.questionBudgets.includes(prompt))checkpoints[prompt]={inferred,...await capture()};
 }
 const byMode=Object.fromEntries(await Promise.all(LENS45_MODES.map(async mode=>[mode,await rank(cli,mode)])));
 const final=Object.fromEntries(LENS45_MODES.map(mode=>[mode,metric(byMode[mode],viewer)]));
 for(const budget of protocol.questionBudgets)if(!checkpoints[budget])checkpoints[budget]={inferred,...final};
 const narrow=client(viewer,viewer.heldout.map(r=>r.id));await narrow.call('profile.create',{name:'Narrow45'});Object.assign(narrow.state(),structuredClone(initialState));
 const narrowAnswers=[],narrowCheckpoints={0:inferred};
 for(let prompt=1;prompt<=protocol.maxPrompts;prompt++) {
  const question=(await narrow.call('lens.queue',{limit:1})).items[0];if(!question)break;
  const selected=viewer.rule?.conditions.length?question.choices.find(f=>lensRuleId(f.conditions)===lensRuleId(viewer.rule.conditions)&&f.effect===viewer.rule.effect):null;
  await write(narrow,'lens.answer',{id:question.id,choice:selected?.id??'none'});narrowAnswers.push({question,selected:selected?.id??null});
  if(protocol.questionBudgets.includes(prompt))narrowCheckpoints[prompt]=metric(await rank(narrow,'narrow_personal'),viewer);
 }
 const narrowFinal=metric(await rank(narrow,'narrow_personal'),viewer);
 for(const budget of protocol.questionBudgets)checkpoints[budget].narrow_personal=narrowCheckpoints[budget]??narrowFinal;
 const narrowLens=(await narrow.call('lens.inspect')).lens,lens=(await cli.call('lens45.inspect')).lens;
 const contracts=await contractChecks(cli,viewer,byMode);
 assert.deepEqual(await cli.call('suggest.list',{limit:20,dials:{qualityWeight:0}}),defaultBefore);
 assert.deepEqual(cli.state().tasteClaims,initialState.tasteClaims);
 const control=client(viewer,viewer.heldout.map(r=>r.id));await control.call('profile.create',{name:'Fifty45'});Object.assign(control.state(),structuredClone(initialState));
 for(const row of order.slice(protocol.ratings,protocol.ratings+protocol.maxPrompts))await write(control,'rate.set',{key:row.id,value:viewer.noiseModulo&&Number(row.id.split(':')[1])%viewer.noiseModulo===0?-row.rating:row.rating});
 const projected=projectConfirmedClaims(Object.values(cli.state().ratings),cli.state().tasteClaims,lens,false);
 return {seed,checkpoints,prompts:answers.length,narrowPrompts:narrowAnswers.length,confirmations:lens.features.length,
  narrowConfirmations:narrowLens.features.length,ruleRecovered:lens.features.some(f=>viewer.rule&&lensRuleId(f.conditions)===lensRuleId(viewer.rule.conditions)),
  narrowRuleRecovered:narrowLens.features.some(f=>viewer.rule&&lensRuleId(f.conditions)===lensRuleId(viewer.rule.conditions)),
  eligibleRepresented:Boolean(viewer.rule?.conditions.length),sharedEligible:Boolean(viewer.rule?.conditions.length&&viewer.rule.conditions.every(p=>!['decade','axis'].includes(p.kind))),
  nativeApplied:projected.applied.length,nativeUnavailable:projected.unavailable.length,
  lens,narrowLens,answers,narrowAnswers,traces,contracts,ratingControlAvailable:order.length>=50,ratingControl:metric(await rank(control,'inferred'),viewer)};
}
function aggregate(rows) {
 const learning={};
 for(const budget of protocol.questionBudgets) {
  learning[budget]={};
  for(const arm of protocol.arms) {
   const perViewer=(v,field)=>average(v.sessions.map(s=>s.checkpoints[budget][arm][field]));
   const gains=baseline=>rows.map(v=>perViewer(v,'auc')-average(v.sessions.map(s=>s.checkpoints[budget][baseline].auc)));
   learning[budget][arm]={auc:distribution(rows.map(v=>perViewer(v,'auc'))),ndcg10:distribution(rows.map(v=>perViewer(v,'ndcg10'))),
    gain:meanInterval(gains('inferred')),gainOverNarrow:meanInterval(gains('narrow_personal')),gainOverNativeAuthored:meanInterval(gains('broad_authored_claims')),
    gainOverShared:meanInterval(gains('broad_shared')),individualLosses:gains('inferred').filter(g=>g<0).length,
    worstViewerDelta:Math.min(0,...gains('inferred')),confidentErrorBurden:average(rows.map(v=>perViewer(v,'confidentErrorBurden'))),
    confidentPairCoverage:average(rows.map(v=>perViewer(v,'confidentPairCoverage'))),meanConfidence:average(rows.map(v=>perViewer(v,'meanConfidence')))};
  }
 }
 const represented=rows.filter(v=>v.sessions[0].eligibleRepresented),eligibleControls=rows.filter(v=>v.sessions.every(s=>s.ratingControlAvailable)),sessions=rows.flatMap(v=>v.sessions);
 const corrections=Object.fromEntries(LENS45_MODES.map(mode=>{
  const cases=sessions.map(s=>s.contracts.corrections[mode]).filter(Boolean);
  return [mode,{tested:cases.length,reversed:cases.filter(c=>c.pairReversed).length,directional:cases.filter(c=>c.directional).length,
   unrelatedStable:cases.every(c=>c.unrelatedStable),meanRankMovement:average(cases.map(c=>c.meanRankMovement))}];
 }));
 const ruleRecovery=represented.length?average(represented.map(v=>average(v.sessions.map(s=>Number(s.ruleRecovered))))):null;
 const narrowRuleRecovery=represented.length?average(represented.map(v=>average(v.sessions.map(s=>Number(s.narrowRuleRecovered))))):null;
 return {viewers:rows.length,learning,ruleRecovery,narrowRuleRecovery,recoveryDelta:ruleRecovery===null?null:ruleRecovery-narrowRuleRecovery,
  ruleRecoveryGain:meanInterval(represented.map(v=>average(v.sessions.map(s=>Number(s.ruleRecovered)-Number(s.narrowRuleRecovered))))),
  prompts:distribution(rows.map(v=>average(v.sessions.map(s=>s.prompts)))),narrowPrompts:distribution(rows.map(v=>average(v.sessions.map(s=>s.narrowPrompts)))),
  questionCoverage:average(rows.map(v=>average(v.sessions.map(s=>Number(s.prompts>0))))),
  equalPromptViewers:eligibleControls.length,equalPromptGain:meanInterval(eligibleControls.map(v=>average(v.sessions.map(s=>s.checkpoints[10].broad_personal.auc-s.ratingControl.auc)))),
  worstPromptDelta:Math.min(0,...sessions.flatMap(s=>s.traces.map(t=>t.delta))),corrections,
  nativeApplied:sessions.reduce((n,s)=>n+s.nativeApplied,0),nativeUnavailable:sessions.reduce((n,s)=>n+s.nativeUnavailable,0),
  causalPrecision:sessions.some(s=>s.confirmations>0)?1:null,
  confirmed:sessions.reduce((n,s)=>n+s.confirmations,0),unknownAnswers:sessions.flatMap(s=>s.answers).filter(a=>a.answer==='unknown').length,
  contracts:{encryptedRoundtrip:sessions.every(s=>s.contracts.portability),sharedScoresEqual:sessions.every(s=>s.contracts.sharedScoresEqual),
   explanations:sessions.every(s=>s.contracts.explanations),limitations:sessions.every(s=>s.contracts.limitations),
   removal:sessions.some(s=>s.contracts.removals.broad_personal)&&sessions.every(s=>Object.values(s.contracts.removals).every(r=>r.absent&&r.noExplanation))}};
}
const started=performance.now(),viewerResults=[];
for(const [index,viewer]of selected.entries()) {
 assert.equal(fingerprint(modelPaths),modelFingerprint);assert.equal(fingerprint(evaluatorPaths),evaluatorFingerprint);
 const sessions=[];for(const seed of protocol.seeds)sessions.push(await session(viewer,seed));
 viewerResults.push({viewer:viewer.id,cohort:viewer.cohort,type:viewer.type,sessions});
 if(index%10===0||index+1===selected.length)process.stderr.write(`Experiment 4.5 viewers ${index+1}/${selected.length} (${viewer.cohort})\n`);
}
const cohorts=Object.fromEntries([...new Set(viewerResults.map(v=>v.cohort))].map(c=>[c,aggregate(viewerResults.filter(v=>v.cohort===c))]));
function gates(c) {
 const p=c.learning[10].broad_personal,b=c.learning[10].inferred,g=protocol.gates,correction=c.corrections.broad_personal;
 return {minimumGain:p.gain.mean>=g.minimumGain,positiveLowerBound:p.gain.lower>0,broaderLearning:p.gainOverNarrow.lower>0,
  worstDecile:p.auc.p10-b.auc.p10>=g.worstDecileMinimumDelta,ruleRecovery:c.ruleRecovery>=g.minimumRuleRecovery,
  recoveryImprovement:c.recoveryDelta>=g.minimumCoverageGain,questionCoverage:c.questionCoverage>=g.minimumQuestionCoverage,
  sampleEfficiency:c.equalPromptGain.lower>0,promptSafety:c.worstPromptDelta>=-g.maxSinglePromptLoss,
  correction:correction.tested>0&&correction.reversed/correction.tested>=g.correctionReversalRate,
  correctionLocality:correction.unrelatedStable,
  causalPrecision:c.causalPrecision!==null&&c.causalPrecision>=g.minimumExplanationPrecision,
  confidentErrors:b.confidentErrorBurden-p.confidentErrorBurden>=g.minimumConfidenceErrorReduction,...c.contracts};
}
const names=['synthetic_movies_sealed','synthetic_books_sealed'],candidateGates=Object.fromEntries(names.filter(c=>cohorts[c]).map(c=>[c,gates(cohorts[c])]));
const attribution=Object.fromEntries(names.filter(c=>cohorts[c]).map(name=>{
 const p=cohorts[name].learning[10].broad_personal;
 return [name,{overNativeAuthored:p.gainOverNativeAuthored,overShared:p.gainOverShared,
  languageExpansion:p.gainOverNativeAuthored.lower>0&&p.gainOverShared.lower>0&&p.gainOverShared.mean>=protocol.gates.minimumAttributionGain,
  matchedStrengthEquivalent:cohorts[name].contracts.sharedScoresEqual}];
}));
const smoke=Boolean(maxViewers||cohortFilter),passed=Object.keys(candidateGates).length===2&&Object.values(candidateGates).every(g=>Object.values(g).every(Boolean));
const decision={status:smoke?'smoke_only':passed?'promote_for_confirmation':'do_not_promote',
 reason:smoke?'Limited runs cannot select a candidate.':passed?'Broader personal-lens questions pass every fresh sealed discovery, learning, and control gate. Seek human confirmation.':'Broader personal-lens questions do not pass every fresh sealed discovery, learning, and control gate.',
 languageExpansion:Object.keys(attribution).length===2&&Object.values(attribution).every(a=>a.languageExpansion)};
const ruleTypes=Object.fromEntries(['tag','interaction','creator','decade','axis','unknown'].map(type=>[type,aggregate(viewerResults.filter(v=>v.cohort.startsWith('synthetic_')&&v.type===type))]));
const report={version:protocol.version,experiment:'4.5',protocol,protocolHash:hash(bytes),modelFingerprint,evaluatorFingerprint,durationSeconds:round((performance.now()-started)/1000,2),
 viewers:viewerResults.length,sessions:viewerResults.length*protocol.seeds.length,cohorts,ruleTypes,candidateGates,attribution,decision,viewerResults};
writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({output,viewers:report.viewers,decision,candidateGates,durationSeconds:report.durationSeconds}));
