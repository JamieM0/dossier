import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { featureVector } from '@dossier/domain';
import { execute } from '../dist/actions.js';
import { reviewsPlusTags } from './reviews-plus-tags-v1.mjs';
import { decideOverride, dossierScores } from './override-guard-v1.mjs';
import { assessReal, meanInterval } from './real-metrics.mjs';
import { average, key, round, shuffled } from './hard-metrics.mjs';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const read=path=>JSON.parse(readFileSync(new URL(path,import.meta.url)));
const protocol=read('../benchmarks/override-v1-protocol.json');
for(const[path,expected]of [['./reviews-plus-tags-v1.mjs',protocol.candidateHash],['./override-guard-v1.mjs',protocol.guardHash],['../src/lab/override-viewers-v1.json',protocol.freshFixtureHash]]) {
  if(hash(readFileSync(new URL(path,import.meta.url)))!==expected)throw new Error(`Frozen experiment changed: ${path}`);
}
const modules=readdirSync(new URL('../../../packages/domain/dist/',import.meta.url),{recursive:true}).filter(p=>p.endsWith('.js')&&!p.endsWith('.test.js')).sort().map(p=>`../../../packages/domain/dist/${p}`);
const fingerprint=paths=>hash(Buffer.concat(paths.flatMap(p=>[Buffer.from(p+'\n'),readFileSync(new URL(p,import.meta.url))])));
const modelFingerprint=fingerprint([...modules,'../dist/actions.js','../dist/storage.js']);
if(modelFingerprint!==protocol.referenceModelFingerprint)throw new Error('This experiment requires the frozen current Dossier model');
const fixtures={original:read('../src/lab/real-tmdb-v1.json'),confirmation:read('../src/lab/new-viewers-v1.json'),fresh:read('../src/lab/override-viewers-v1.json')};
const oldIds=new Set([...fixtures.original.viewers,...fixtures.confirmation.viewers].map(v=>v.sourceUserId));
if(fixtures.fresh.viewers.some(v=>oldIds.has(v.sourceUserId)))throw new Error('Fresh cohort reuses a viewer');
if(Object.values(fixtures).some(f=>JSON.stringify(f.items)!==JSON.stringify(fixtures.original.items)))throw new Error('Public catalogue changed');
const items=fixtures.original.items.map(({source:_source,...item})=>({...item,features:featureVector(item)}));
const byKey=new Map(items.map(item=>[key(item),item]));
const diagnosis=JSON.parse(readFileSync('reports/backwards-learning-diagnosis-v1.json'));
const originalReport=JSON.parse(readFileSync('reports/dossier-learning-study-tmdb.json'));
const confirmationReport=JSON.parse(readFileSync('reports/reviews-plus-tags-confirmation-v1.json'));
const explicitRisk=new Set(confirmationReport.viewers.filter(v=>v.highRisk).map(v=>v.id));
const methods=['publicReviews','candidate','dossier','guard'];
let ratingActions=0,cliParityChecks=0,originalEndpointChecks=0;
const guardCache=new Map();
const select=entries=>{
  const id=entries.map(e=>`${key(e.item)}=${e.rating}`).join('|');
  if(!guardCache.has(id))guardCache.set(id,decideOverride(entries));
  return guardCache.get(id);
};
const stripDecision=({comparisons,...decision})=>decision;
async function replay(viewer,seed,cohort,every=false) {
  const training=new Map(viewer.trainingRatings.map(r=>[r.filmKey,r]));
  const hidden=new Map(viewer.heldOutRatings.map(r=>[r.filmKey,r]));
  if([...hidden.keys()].some(id=>training.has(id)))throw new Error('Hidden film in training');
  const candidates=[...hidden.keys()].map(id=>byKey.get(id));
  const truth=Object.fromEntries([...hidden].map(([id,row])=>[id,row.rating]));
  const publicScores=Object.fromEntries(candidates.map(item=>[key(item),(item.voteAverage??0)/10]));
  let vault={activeId:null,profiles:[]};
  const storage={root:'/override-disposable',load:()=>vault,save:next=>{vault=next},audit:()=>{}};
  const catalogue={detail:async(medium,id)=>byKey.get(`${medium}:${id}`),candidates:async()=>candidates};
  const call=(action,args={})=>execute(storage,action,args,catalogue);
  let revision=(await call('profile.create',{name:'Override experiment viewer'})).revision;
  const order=shuffled([...training.keys()],seed+viewer.sourceUserId*1009);
  const observed=[],snapshots={};
  for(let count=1;count<=40;count++) {
    const id=order[count-1];
    if(hidden.has(id)||!training.has(id))throw new Error('Hidden answer reached CLI');
    revision=(await call('rate.set',{key:id,value:training.get(id).rating,expectedRevision:revision})).revision;
    ratingActions++;
    observed.push({filmKey:id,title:byKey.get(id).title,suppliedRating:training.get(id).rating,stars:training.get(id).stars});
    if(!every&&!protocol.checkpoints.includes(count))continue;
    const entries=Object.values(vault.profiles[0].state.ratings);
    const decision=select(entries);
    const candidate=reviewsPlusTags(candidates,entries),dossier={};let cursor;
    do {const page=await call('suggest.list',{limit:20,...(cursor?{cursor}:{})});for(const row of page.items)dossier[row.id]=row.score;cursor=page.next;}while(cursor);
    const direct=dossierScores(candidates,entries);
    if(Object.keys(dossier).length!==Object.keys(direct).length||Object.keys(dossier).some(id=>dossier[id]!==direct[id]))throw new Error('Validation helper differs from actual CLI');
    cliParityChecks++;
    const scores={publicReviews:publicScores,candidate,dossier,guard:decision.useDossier?dossier:candidate};
    snapshots[count]={decision:stripDecision(decision),...Object.fromEntries(methods.map(name=>[name,assessReal(scores[name],candidates,truth,Object.keys(scores[name]).length>0)])),
      ...(count===20||count===40?{scores,claims:vault.profiles[0].state.tasteClaims}:{}),
      ...(every?{newRating:observed.at(-1)}:{})};
  }
  if(cohort!=='fresh') {
    const ref=cohort==='original'?originalReport:confirmationReport;
    const saved=ref.sessions.find(row=>row.viewer===viewer.id&&row.seed===seed);
    for(const count of protocol.checkpoints){
      if(saved.snapshots[count].dossier.auc!==snapshots[count].dossier.auc || saved.snapshots[count].dossier.precision10!==snapshots[count].dossier.precision10)throw new Error(`Existing Dossier session changed: ${viewer.id}/${seed}/${count} ${JSON.stringify({old:saved.snapshots[count].dossier,current:snapshots[count].dossier})}`);
      originalEndpointChecks++;
    }
  }
  return {viewer:viewer.id,seed,cohort,observed,snapshots};
}
const sessions=[],viewers=[],failures=[];
for(const[cohort,fixture]of Object.entries(fixtures)) {
  for(const viewer of fixture.viewers) {
    const own=[];
    for(const seed of protocol.seeds) {
      const target=diagnosis.cases.find(row=>row.viewer===viewer.id&&row.seed===seed);
      const session=await replay(viewer,seed,cohort,Boolean(target));
      sessions.push(session);own.push(session);
      if(target) {
        if(session.snapshots[10].dossier.auc!==target.auc10||session.snapshots[40].dossier.auc!==target.auc40)throw new Error('Known failure did not reproduce');
        const steps=Array.from({length:30},(_,i)=>i+11).map(count=>({count,title:session.snapshots[count].newRating.title,
          delta:round(session.snapshots[count].guard.auc-session.snapshots[count-1].guard.auc),usedDossier:session.snapshots[count].decision.useDossier}));
        const before=session.snapshots[10],after=session.snapshots[40];
        failures.push({viewer:viewer.id,seed,reproduced:true,current10:before.dossier.auc,current40:after.dossier.auc,
          candidate10:before.candidate.auc,candidate40:after.candidate.auc,guard10:before.guard.auc,guard40:after.guard.auc,
          guardDelta:round(after.guard.auc-before.guard.auc),guardGainCurrent:round(after.guard.auc-after.dossier.auc),worstStep:steps.slice().sort((a,b)=>a.delta-b.delta)[0],
          decisions:steps.map(row=>({count:row.count,...session.snapshots[row.count].decision})),
          protected:after.guard.auc-after.dossier.auc>=.03&&after.guard.auc-before.guard.auc>=-.03&&steps.every(row=>row.delta>=-.05)});
      }
    }
    const trainingScores=Object.fromEntries(viewer.trainingRatings.map(row=>[row.filmKey,(byKey.get(row.filmKey).voteAverage??0)/10]));
    const trainingTruth=Object.fromEntries(viewer.trainingRatings.map(row=>[row.filmKey,row.rating]));
    const trainingPublic=assessReal(trainingScores,viewer.trainingRatings.map(row=>byKey.get(row.filmKey)),trainingTruth).auc;
    const after=Object.fromEntries(protocol.checkpoints.map(count=>[count,Object.fromEntries(methods.map(name=>[name,{
      auc:round(average(own.map(s=>s.snapshots[count][name].auc))),precision10:round(average(own.map(s=>s.snapshots[count][name].precision10)))}]))]));
    viewers.push({id:viewer.id,cohort,explicitRisk:explicitRisk.has(viewer.id),highRisk:trainingPublic<=.60,trainingPublic,after,
      overrides:Object.fromEntries(protocol.checkpoints.map(n=>[n,own.filter(s=>s.snapshots[n].decision.useDossier).length]))});
    process.stderr.write(`Override experiment ${viewers.length}/108: ${cohort}/${viewer.id}\n`);
  }
}
const summarize=(rows,count)=>({viewers:rows.length,methods:Object.fromEntries(methods.map(m=>[m,{auc:round(average(rows.map(r=>r.after[count][m].auc))),precision10:round(average(rows.map(r=>r.after[count][m].precision10)))}])),
  gains:Object.fromEntries(['publicReviews','candidate','dossier'].map(m=>[m,{auc:meanInterval(rows.map(r=>r.after[count].guard.auc-r.after[count][m].auc)),top10:meanInterval(rows.map(r=>r.after[count].guard.precision10-r.after[count][m].precision10))}])),
  overrides:rows.reduce((n,r)=>n+r.overrides[count],0),overriddenViewers:rows.filter(r=>r.overrides[count]>0).length,
  regressions:Object.fromEntries(['publicReviews','candidate','dossier'].map(m=>[m,rows.filter(r=>r.after[count].guard.auc-r.after[count][m].auc<-.03||r.after[count].guard.precision10-r.after[count][m].precision10<=-.1+1e-9).map(r=>({viewer:r.id,auc:round(r.after[count].guard.auc-r.after[count][m].auc),top10:round((r.after[count].guard.precision10-r.after[count][m].precision10)*10)}))]))});
const cohorts=Object.fromEntries(Object.keys(fixtures).map(c=>[c,Object.fromEntries(protocol.checkpoints.map(n=>[n,summarize(viewers.filter(r=>r.cohort===c),n)]))]));
const unusual=viewers.filter(v=>v.explicitRisk),freshRisk=viewers.filter(v=>v.cohort==='fresh'&&v.highRisk);
const primary=cohorts.fresh[40];
const selected=sessions.filter(s=>s.cohort==='fresh'&&s.snapshots[40].decision.useDossier);
const useful=sessions.filter(s=>s.cohort==='fresh'&&s.snapshots[40].dossier.auc-s.snapshots[40].candidate.auc>.03);
const detection={selected:selected.length,usefulAvailable:useful.length,correctlySelected:selected.filter(s=>s.snapshots[40].dossier.auc-s.snapshots[40].candidate.auc>.03).length,
  harmful:selected.filter(s=>s.snapshots[40].dossier.auc-s.snapshots[40].candidate.auc<-.03).length,
  missed:useful.filter(s=>!s.snapshots[40].decision.useDossier).map(s=>({viewer:s.viewer,seed:s.seed,missedGain:round(s.snapshots[40].dossier.auc-s.snapshots[40].candidate.auc),reason:s.snapshots[40].decision.reason})),
  selectedMeanGain:selected.length?round(average(selected.map(s=>s.snapshots[40].dossier.auc-s.snapshots[40].candidate.auc))):null};
const exceptions=viewers.filter(v=>['movielens-82','movielens-484'].includes(v.id));
const checks={freshMeanGain:primary.gains.candidate.auc.mean>=0&&primary.gains.candidate.auc.lower>=0&&primary.gains.candidate.top10.mean>=0,
  detectUsefulOverrides:primary.overriddenViewers>=2&&detection.selectedMeanGain>.03,
  individualSafety:primary.regressions.candidate.length===0&&[20,40].every(n=>summarize(unusual,n).regressions.candidate.length===0),
  protectKnownExceptions:exceptions.length===2&&exceptions.every(v=>[20,40].every(n=>v.after[n].guard.auc-v.after[n].dossier.auc>=-.03&&v.after[n].guard.precision10-v.after[n].dossier.precision10>-.1+1e-9)),
  fiveFailureProtection:failures.length===5&&failures.every(f=>f.protected)};
const report={version:'observed-rating-override-v1',protocol,modelFingerprint,evaluatorFingerprint:fingerprint(['./override-run.mjs','./override-guard-v1.mjs','./reviews-plus-tags-v1.mjs','./real-metrics.mjs','./hard-metrics.mjs']),
  checks,demonstrated:Object.values(checks).every(Boolean),cohorts,unusual:Object.fromEntries([20,40].map(n=>[n,summarize(unusual,n)])),freshRisk:Object.fromEntries([20,40].map(n=>[n,summarize(freshRisk,n)])),detection,
  verification:{ratingActions,cliParityChecks,originalEndpointChecks,freshViewerCount:30,totalViewers:viewers.length},viewers,failures,sessions};
const flags=process.argv.slice(2),output=flags.includes('--output')?flags[flags.indexOf('--output')+1]:'reports/observed-rating-override-v1.json';
writeFileSync(output,JSON.stringify(report,null,2)+'\n');
process.stdout.write(JSON.stringify({output,checks,primary,detection,failures:failures.map(({decisions,...row})=>row)})+'\n');
