import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, mkdtempSync, rmSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { featureVector, matchesTasteClaim } from '@dossier/domain';
import { execute } from '../dist/actions.js';
import { QUESTION_POLICY_CONFIG } from '../dist/lab/question-policy.js';
import { assess, average, distribution, key, random, round } from './hard-metrics.mjs';
import { meanInterval } from './real-metrics.mjs';
const argv=process.argv.slice(2).filter(a=>a!=='--');
const value=(flag,fallback)=>argv.includes(flag)?argv[argv.indexOf(flag)+1]:fallback;
const output=value('--output','reports/question-policy-v1.json'),maxViewers=Number(value('--max-viewers','0'));
const cohortFilter=value('--cohort',null);
const workers=Number(value('--workers','4')),workerCount=Number(value('--worker-count','1')),workerIndex=Number(value('--worker-index','0'));
if(!Number.isInteger(workers)||workers<1||workers>8||!Number.isInteger(workerCount)||workerCount<1||workerCount>8||!Number.isInteger(workerIndex)||workerIndex<0||workerIndex>=workerCount)throw new Error('Invalid worker settings');
if(!Number.isSafeInteger(maxViewers)||maxViewers<0)throw new Error('Invalid max-viewers');
if(value('--protocol','question-policy-v1')!=='question-policy-v1')throw new Error('Unknown protocol');
if((maxViewers||cohortFilter)&&output==='reports/question-policy-v1.json')throw new Error('Limited runs require a separate --output.');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const protocolBytes=readFileSync('apps/dossier-cli/benchmarks/question-policy-v1-protocol.json');
const protocol=JSON.parse(protocolBytes);
if(JSON.stringify(protocol.policy)!==JSON.stringify(QUESTION_POLICY_CONFIG))throw new Error('Policy settings changed');
const fingerprint=paths=>hash(Buffer.concat(paths.sort().flatMap(p=>[Buffer.from(p+'\n'),readFileSync(p)])));
const modelPaths=readdirSync('packages/domain/dist',{recursive:true}).filter(p=>p.endsWith('.js')&&!p.endsWith('.test.js')).map(p=>'packages/domain/dist/'+p);
modelPaths.push('apps/dossier-cli/dist/actions.js','apps/dossier-cli/dist/lab/question-policy.js');
const evaluatorPaths=['question-policy-run.mjs','question-policy-report.mjs','hard-metrics.mjs','real-metrics.mjs'].map(p=>'apps/dossier-cli/scripts/'+p);
const modelFingerprint=fingerprint(modelPaths),evaluatorFingerprint=fingerprint(evaluatorPaths);
if(protocol.modelFingerprint && modelFingerprint!==protocol.modelFingerprint)throw new Error('Frozen candidate changed; create a new protocol.');
if(protocol.evaluatorFingerprint && evaluatorFingerprint!==protocol.evaluatorFingerprint)throw new Error('Frozen evaluator changed; create a new protocol.');
if(hash(readFileSync('apps/dossier-cli/scripts/prepare-question-policy.mjs'))!==protocol.generatorHash)throw new Error('Generator changed');
const fixtures={};
for(const [name,entry] of Object.entries(protocol.fixtures)){
 const bytes=readFileSync(entry.path);if(hash(bytes)!==entry.sha256)throw new Error(`Fixture changed: ${name}`);fixtures[name]=JSON.parse(bytes);
}
// This allowlist is the only route from evaluator fixtures into the CLI.
export function catalogueItem(raw){
 const item={id:raw.id,medium:raw.medium,title:raw.title,year:raw.year,genres:raw.genres,genreIds:raw.genreIds,
 keywords:raw.keywords,overview:raw.overview,runtime:raw.runtime,collection:raw.collection??null,directorIds:raw.directorIds??[],creatorIds:raw.creatorIds??[],
 posterPath:null,voteAverage:null,voteCount:0,popularity:null};return {...item,features:featureVector(item)};
}
function makeViewer(cohort,fixture,person){
 const items=fixture.items.map(catalogueItem),byKey=new Map(items.map(i=>[key(i),i]));
 if(person.trainingRatings)return {id:person.id,cohort,byKey,training:person.trainingRatings.map(r=>({id:r.filmKey,rating:r.rating})),heldout:person.heldOutRatings.map(r=>({id:r.filmKey,rating:r.rating})),recognition:null};
 const rows=ids=>ids.map(id=>({id,rating:person.ratings[id]}));
 return {id:person.id,cohort,byKey,training:rows(fixture.trainingKeys),heldout:rows(fixture.holdoutKeys),recognition:person.recognition,noiseModulo:person.noiseModulo};
}
const viewers=Object.entries(fixtures).flatMap(([cohort,fixture])=>(fixture.viewers??fixture.personas).map(p=>makeViewer(['synthetic','refine_regression'].includes(cohort)?`${cohort}_${p.partition}`:cohort,fixture,p)));
if(cohortFilter&&!viewers.some(v=>v.cohort===cohortFilter))throw new Error('Unknown cohort');
const available=cohortFilter?viewers.filter(v=>v.cohort===cohortFilter):viewers;
const unsharded=maxViewers?available.slice(0,maxViewers):available;
const selected=unsharded.filter((_,i)=>i%workerCount===workerIndex);
function client(viewer){
 let vault={activeId:null,profiles:[]};const storage={root:'/question-policy-lab',load:()=>vault,save:next=>{vault=next;},audit:()=>{}};
 const catalogue={detail:async(m,id)=>viewer.byKey.get(`${m}:${id}`),candidates:async(_medium,kind)=>(kind==='rate'?viewer.training:viewer.heldout).map(r=>viewer.byKey.get(r.id))};
 return {call:(name,args={})=>execute(storage,name,args,catalogue),state:()=>vault.profiles[0].state};
}
async function snapshot(cli,viewer){
 const rows=[];let cursor;
 do{const page=await cli.call('suggest.list',{limit:20,dials:{qualityWeight:0,popularityBias:0},...(cursor?{cursor}:{})});rows.push(...page.items);cursor=page.next;}while(cursor);
 const candidates=viewer.heldout.map(r=>viewer.byKey.get(r.id)),truth=Object.fromEntries(viewer.heldout.map(r=>[r.id,r.rating]));
 const claims=cli.state().tasteClaims.filter(c=>c.active&&c.confidence>=.8);
 let errors=0,tests=0;
 for(const claim of claims)for(const row of viewer.heldout)if(matchesTasteClaim(viewer.byKey.get(row.id),claim)){tests++;if(claim.effect==='positive'?row.rating<=0:row.rating>=0)errors++;}
 const metrics=assess(Object.fromEntries(rows.map(r=>[r.id,r.score])),candidates,truth,rows.length>0);
 delete metrics.top10;
 return {...metrics,highConfidenceClaimErrors:errors,highConfidenceClaimTests:tests,activeClaims:cli.state().tasteClaims.filter(c=>c.active).length};
}
function seedFor(viewer,seed){return Number.parseInt(hash(viewer.id+':'+seed).slice(0,8),16)&0x7fffffff;}
function recognized(viewer,id,seed){
 if(['original','confirmation','override'].includes(viewer.cohort))return true;
 const next=random(Number.parseInt(hash(viewer.id+':'+seed+':'+id).slice(0,8),16));
 return next()<(viewer.recognition?.[id]??.65);
}
function checkpoints(traces,field){
 return Object.fromEntries(protocol.budgets.map(budget=>{
  const exact=traces.find(t=>t[field]===budget),terminal=traces.at(-1);
  return [budget,{...(exact??terminal),reached:Boolean(exact),requested:budget}];
 }));
}
async function session(viewer,seed,arm){
 const cli=client(viewer);let revision=(await cli.call('profile.create',{name:'Question viewer'})).revision;
 const truth=new Map(viewer.training.map(r=>[r.id,r]));
 const traces=[{prompts:0,answers:0,skips:0,metric:await snapshot(cli,viewer)}];
 let prompts=0,answers=0,skips=0,stopped=false,exhausted=false,previous=traces[0].metric;
 const started=performance.now();
 while(prompts<protocol.maxPrompts&&answers<40){
  const question=await cli.call('rate.queue',{mode:'active',limit:1,...(arm==='active'?{}:{questionPolicy:arm==='counterfactual_no_stop'?'counterfactual':arm,
   questionSeed:(seedFor(viewer,seed)+prompts*7919)&0x7fffffff,questionStop:arm!=='counterfactual_no_stop'})});
  if(!question.items.length){stopped=Boolean(question.stopped);exhausted=!stopped;break;}
  const q=question.items[0],answer=truth.get(q.id);
  if(!answer)throw new Error('Question crossed held-out split');
  const seen=recognized(viewer,q.id,seed);prompts++;
  if(seen){answers++;revision=(await cli.call('rate.set',{key:q.id,value:viewer.noiseModulo&&Number(q.id.split(':')[1])%viewer.noiseModulo===0?-answer.rating:answer.rating,expectedRevision:revision})).revision;}
  else{skips++;revision=(await cli.call('rate.skip',{key:q.id,expectedRevision:revision})).revision;}
  const metric=seen?await snapshot(cli,viewer):previous;
  traces.push({prompts,answers,skips,id:q.id,recognized:seen,predictedValue:q.predictedValue??null,disagreement:q.disagreement??null,recognition:q.recognition??null,
    stabilityRisk:q.stabilityRisk??null,uncertainty:question.uncertainty??null,aucDelta:round(metric.auc-previous.auc),metric});
  previous=metric;
 }
 // Reissue an identical question request to verify deterministic selection and read-only behavior.
 const args={mode:'active',limit:1,...(arm==='active'?{}:{questionPolicy:arm==='counterfactual_no_stop'?'counterfactual':arm,questionSeed:seedFor(viewer,seed),questionStop:arm!=='counterfactual_no_stop'})};
 const before=JSON.stringify(cli.state()),first=await cli.call('rate.queue',args),second=await cli.call('rate.queue',args);
 if(JSON.stringify(first)!==JSON.stringify(second)||JSON.stringify(cli.state())!==before)throw new Error('Question policy is nondeterministic or mutates profile');
 return {seed,arm,prompts,answers,skips,stopped,exhausted,byAnswer:checkpoints(traces,'answers'),byPrompt:checkpoints(traces,'prompts'),terminal:previous,
  thresholdAnswers:traces.find(t=>t.metric.auc>=protocol.aucThreshold)?.answers??null,thresholdPrompts:traces.find(t=>t.metric.auc>=protocol.aucThreshold)?.prompts??null,
  largestAnswerLoss:Math.min(0,...traces.filter(t=>t.recognized).map(t=>t.aucDelta)),durationSeconds:round((performance.now()-started)/1000,3),traces};
}
const started=performance.now(),viewerResults=[];
if(workers>1&&workerCount===1){
 const root=mkdtempSync(join(tmpdir(),'dossier-question-workers-'));
 try{
  const paths=Array.from({length:workers},(_,i)=>join(root,`worker-${i}.json`));
  await Promise.all(paths.map((path,i)=>new Promise((resolve,reject)=>{
   const args=['apps/dossier-cli/scripts/question-policy-run.mjs','--workers','1','--worker-count',String(workers),'--worker-index',String(i),'--output',path];
   if(maxViewers)args.push('--max-viewers',String(maxViewers));if(cohortFilter)args.push('--cohort',cohortFilter);
   const child=spawn(process.execPath,args,{stdio:['ignore','ignore','inherit']});
   child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error(`Worker ${i} failed`)));
  })));
  const results=paths.flatMap(path=>JSON.parse(readFileSync(path)).viewerResults);
  const lookup=new Map(results.map(v=>[v.cohort+':'+v.viewer,v]));
  for(const v of unsharded){const result=lookup.get(v.cohort+':'+v.id);if(!result)throw new Error('Missing worker viewer');viewerResults.push(result);}
 }finally{rmSync(root,{recursive:true,force:true});}
}else for(const [index,viewer] of selected.entries()){ 
 if(viewer.cohort==='synthetic_sealed'&&(fingerprint(modelPaths)!==modelFingerprint||fingerprint(evaluatorPaths)!==evaluatorFingerprint))throw new Error('Candidate or evaluator changed before confirmation');
 const sessions=[];
 for(const seed of protocol.seeds)for(const arm of protocol.arms)sessions.push(await session(viewer,seed,arm));
 viewerResults.push({viewer:viewer.id,cohort:viewer.cohort,sessions});
 if(index%5===0||index+1===selected.length)process.stderr.write(`Question viewers ${index+1}/${selected.length} (${viewer.cohort}), ${round((performance.now()-started)/1000,1)}s\n`);
}
function own(v,arm){return v.sessions.filter(s=>s.arm===arm);}
function metricMean(v,arm,kind,budget,field='auc'){return average(own(v,arm).map(s=>s[kind][budget].metric[field]));}
function reliability(rows,arm){
 const traces=rows.flatMap(v=>own(v,arm).flatMap(s=>s.traces.filter(t=>t.recognized&&t.predictedValue!==null)));
 const sorted=[...traces].sort((a,b)=>a.predictedValue-b.predictedValue);
 return Array.from({length:4},(_,i)=>{
  const group=sorted.slice(Math.floor(i*sorted.length/4),Math.floor((i+1)*sorted.length/4));
  return {answers:group.length,predictedValue:round(average(group.map(t=>t.predictedValue))),observedAucDelta:round(average(group.map(t=>t.aucDelta))),lossRate:round(group.filter(t=>t.aucDelta<0).length/Math.max(1,group.length))};
 });
}
function aggregate(rows){
 const learning={};
 for(const kind of ['byAnswer','byPrompt']){
  learning[kind]={};
  for(const budget of protocol.budgets){
   learning[kind][budget]={};
   for(const arm of protocol.arms){
    const aucs=rows.map(v=>metricMean(v,arm,kind,budget));
    const gains=rows.map(v=>metricMean(v,arm,kind,budget)-metricMean(v,'balanced_random',kind,budget));
    const eligible=rows.filter(v=>[arm,'balanced_random'].every(a=>own(v,a).every(s=>s[kind][budget].reached)));
    learning[kind][budget][arm]={auc:distribution(aucs),ndcg10:distribution(rows.map(v=>metricMean(v,arm,kind,budget,'ndcg10'))),gain:meanInterval(gains),
     matchedBudgetGain:meanInterval(eligible.map(v=>metricMean(v,arm,kind,budget)-metricMean(v,'balanced_random',kind,budget))),matchedBudgetViewers:eligible.length,
     reachedSessions:rows.flatMap(v=>own(v,arm)).filter(s=>s[kind][budget].reached).length,sessions:rows.length*protocol.seeds.length,
     losses:gains.filter(g=>g<0).length,largeLosses:gains.filter(g=>g<=-.05).length,worstViewerDelta:round(Math.min(0,...gains)),
     highConfidenceClaimErrors:distribution(rows.map(v=>metricMean(v,arm,kind,budget,'highConfidenceClaimErrors')))};
   }
  }
 }
 const arms={};
 for(const arm of protocol.arms){
  const sessions=rows.flatMap(v=>own(v,arm));
  const stopDeltas=rows.map(v=>average(own(v,arm).map(s=>s.terminal.auc))-average(own(v,'counterfactual_no_stop').map(s=>s.terminal.auc)));
  const threshold=sessions.filter(s=>s.thresholdAnswers!==null);
  arms[arm]={prompts:distribution(rows.map(v=>average(own(v,arm).map(s=>s.prompts)))),answers:distribution(rows.map(v=>average(own(v,arm).map(s=>s.answers)))),
   skipRate:round(average(rows.map(v=>average(own(v,arm).map(s=>s.skips/Math.max(1,s.prompts)))))),stoppedSessions:sessions.filter(s=>s.stopped).length,exhaustedSessions:sessions.filter(s=>s.exhausted).length,
   terminalAuc:distribution(rows.map(v=>average(own(v,arm).map(s=>s.terminal.auc)))),terminalGainAgainstNoStop:meanInterval(stopDeltas),
   promptSavingAgainstNoStop:round(average(rows.map(v=>1-average(own(v,arm).map(s=>s.prompts))/Math.max(1,average(own(v,'counterfactual_no_stop').map(s=>s.prompts)))))),
   thresholdReached:threshold.length,thresholdSessions:sessions.length,thresholdAnswers:threshold.length?distribution(threshold.map(s=>s.thresholdAnswers)):null,
   thresholdPrompts:threshold.length?distribution(threshold.map(s=>s.thresholdPrompts)):null,
   largestAnswerLoss:Math.min(0,...sessions.map(s=>s.largestAnswerLoss)),questionValueCalibration:reliability(rows,arm),
   durationSeconds:round(sessions.reduce((s,t)=>s+t.durationSeconds,0),2)};
 }
 return {viewers:rows.length,learning,arms};
}
const cohorts=Object.fromEntries([...new Set(viewerResults.map(v=>v.cohort))].map(c=>[c,aggregate(viewerResults.filter(v=>v.cohort===c))]));
const recorded=aggregate(viewerResults.filter(v=>['original','confirmation','override'].includes(v.cohort)));
function gates(group,arm){
 const gates={};
 const qualityArm=arm==='counterfactual'?'counterfactual_no_stop':arm;
 for(const kind of ['byAnswer','byPrompt'])for(const budget of [20,40]){
  const c=group.learning[kind][budget][qualityArm],b=group.learning[kind][budget].balanced_random;
  gates[`${kind}${budget}Gain`]=group.viewers>0&&c.matchedBudgetViewers/group.viewers>=protocol.gates.minimumMatchedViewerFraction&&c.matchedBudgetGain.lower>protocol.gates.positiveLowerBound&&c.gain.lower>protocol.gates.positiveLowerBound;
  gates[`${kind}${budget}WorstDecile`]=c.auc.p10-b.auc.p10>=protocol.gates.worstDecileMinimumDelta;
 }
 gates.singleAnswerSafety=group.arms[qualityArm].largestAnswerLoss>=-protocol.gates.maxSingleAnswerLoss;
 if(arm==='counterfactual'){
  gates.stopSavesPrompts=group.arms[arm].promptSavingAgainstNoStop>=protocol.gates.stopMinimumPromptSaving;
  gates.stopPreservesAuc=group.arms[arm].terminalGainAgainstNoStop.lower>=-protocol.gates.stopAucNoninferiorityMargin;
 }
 return gates;
}
const candidates=['disagreement','counterfactual'].map(arm=>({arm,recorded:gates(recorded,arm),sealed:cohorts.synthetic_sealed?gates(cohorts.synthetic_sealed,arm):null}));
for(const c of candidates)c.passed=c.sealed!==null&&Object.values(c.recorded).every(Boolean)&&Object.values(c.sealed).every(Boolean);
const passed=candidates.filter(c=>c.passed);
const limited=Boolean(maxViewers||cohortFilter);
const decision={status:workerCount>1?'shard_only':limited?'smoke_only':passed.length?'promote_for_confirmation':'do_not_promote',selected:limited?null:passed[0]?.arm??null,
 reason:limited?'Limited runs cannot select a policy.':passed.length?'Candidate passed the frozen gates; seek independent human confirmation.':'No candidate passed all frozen learning, protection, and stopping gates.'};
if(fingerprint(modelPaths)!==modelFingerprint||fingerprint(evaluatorPaths)!==evaluatorFingerprint)throw new Error('Model or evaluator changed during replay');
const report={version:protocol.version,protocol,protocolHash:hash(protocolBytes),modelFingerprint,evaluatorFingerprint,fixtureHashes:protocol.fixtures,
 durationSeconds:round((performance.now()-started)/1000,2),viewers:viewerResults.length,sessions:viewerResults.reduce((s,v)=>s+v.sessions.length,0),cohorts,recorded,candidates,decision,viewerResults};
writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({output,viewers:report.viewers,sessions:report.sessions,decision,durationSeconds:report.durationSeconds}));
