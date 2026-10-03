import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { featureVector, scoreCandidates } from '@dossier/domain';
import { execute } from '../dist/actions.js';
import { average, distribution, key, round, shuffled } from './hard-metrics.mjs';
import { assessReal, meanInterval } from './real-metrics.mjs';
import { reviewsPlusTags } from './reviews-plus-tags-v1.mjs';

const flags = process.argv.slice(2);
const value = (name,fallback) => flags.includes(name) ? flags[flags.indexOf(name)+1] : fallback;
const bytes = readFileSync(new URL('../src/lab/new-viewers-v1.json',import.meta.url));
const fixture = JSON.parse(bytes);
const original = JSON.parse(readFileSync(new URL('../src/lab/real-tmdb-v1.json',import.meta.url)));
const protocol = JSON.parse(readFileSync(new URL('../benchmarks/confirmation-v1-protocol.json',import.meta.url)));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
if (hash(bytes)!==protocol.fixtureHash || hash(readFileSync(new URL('./reviews-plus-tags-v1.mjs',import.meta.url)))!==protocol.candidateHash) throw new Error('Frozen confirmation fixture or candidate changed');
if (fixture.viewers.some(v=>original.viewers.some(old=>old.sourceUserId===v.sourceUserId))) throw new Error('Confirmation reuses an evaluated viewer');
if (JSON.stringify(fixture.items)!==JSON.stringify(original.items)) throw new Error('Confirmation changes the frozen public metadata');
const publicItems = fixture.items.map(({source:_source,...item})=>({...item,features:featureVector(item)}));
const byKey = new Map(publicItems.map(item=>[key(item),item]));
const checkpoints=protocol.checkpoints, seeds=protocol.seeds;
const modulePaths=readdirSync(new URL('../../../packages/domain/dist/',import.meta.url),{recursive:true}).filter(p=>p.endsWith('.js')&&!p.endsWith('.test.js')).sort().map(p=>`../../../packages/domain/dist/${p}`);
const fingerprint=paths=>hash(Buffer.concat(paths.flatMap(p=>[Buffer.from(p+'\n'),readFileSync(new URL(p,import.meta.url))])));
const modelFingerprint=fingerprint([...modulePaths,'../dist/actions.js','../dist/storage.js']);
const evaluatorFingerprint=fingerprint(['./confirmation-run.mjs','./reviews-plus-tags-v1.mjs','./hard-metrics.mjs','./real-metrics.mjs']);
const publicScores=Object.fromEntries(publicItems.map(item=>[key(item),(item.voteAverage??0)/10]));
const sessions=[];
const viewerSummaries=[];
let ratingActions=0;
for (const viewer of fixture.viewers) {
  const training=new Map(viewer.trainingRatings.map(row=>[row.filmKey,row]));
  const heldOut=new Set(viewer.heldOutRatings.map(row=>row.filmKey));
  if (heldOut.size!==60 || [...heldOut].some(id=>training.has(id)) || training.size<40) throw new Error('Invalid confirmation split');
  const candidates=viewer.heldOutRatings.map(row=>byKey.get(row.filmKey));
  const truth=Object.fromEntries(viewer.heldOutRatings.map(row=>[row.filmKey,row.rating]));
  const trainingItems=viewer.trainingRatings.map(row=>byKey.get(row.filmKey));
  const trainingTruth=Object.fromEntries(viewer.trainingRatings.map(row=>[row.filmKey,row.rating]));
  const publicTrainingAuc=assessReal(publicScores,trainingItems,trainingTruth).auc;
  for (const seed of seeds) {
    let vault={activeId:null,profiles:[]};
    const storage={root:'/confirmation-disposable',load:()=>vault,save:next=>{vault=next},audit:()=>{}};
    const catalogue={detail:async(medium,id)=>byKey.get(`${medium}:${id}`), candidates:async()=>candidates};
    const call=(action,args={})=>execute(storage,action,args,catalogue);
    let revision=(await call('profile.create',{name:'Confirmation viewer'})).revision;
    const order=shuffled([...training.keys()],seed+viewer.sourceUserId*1009);
    const observed=[],snapshots={};
    for (let count=1;count<=40;count++) {
      const id=order[count-1];
      if (heldOut.has(id)) throw new Error('Hidden rating reached CLI');
      revision=(await call('rate.set',{key:id,value:training.get(id).rating,expectedRevision:revision})).revision;
      ratingActions++;
      observed.push({filmKey:id,title:byKey.get(id).title,stars:training.get(id).stars,suppliedRating:training.get(id).rating});
      if (!checkpoints.includes(count)) continue;
      const entries=Object.values(vault.profiles[0].state.ratings);
      const candidate=reviewsPlusTags(candidates,entries);
      const scores={};let cursor;
      do {
        const page=await call('suggest.list',{limit:20,...(cursor?{cursor}:{})});
        for(const row of page.items)scores[row.id]=row.score;
        cursor=page.next;
      }while(cursor);
      const direct=Object.fromEntries(scoreCandidates(candidates,entries,undefined,vault.profiles[0].state.tasteClaims).map(row=>[key(row.item),Math.round(row.score*1000)/1000]));
      if (JSON.stringify(Object.keys(scores).sort())!==JSON.stringify(Object.keys(direct).sort()) || Object.keys(scores).some(id=>scores[id]!==direct[id]))throw new Error('CLI scorer parity failed');
      snapshots[count]={dossier:assessReal(scores,candidates,truth,Object.keys(scores).length>0),publicReviews:assessReal(publicScores,candidates,truth),candidate:assessReal(candidate,candidates,truth),
        ...(count===20?{scores:{dossier:scores,publicReviews:Object.fromEntries(candidates.map(item=>[key(item),publicScores[key(item)]])),candidate}}:{})};
    }
    sessions.push({viewer:viewer.id,seed,observed,snapshots});
  }
  const own=sessions.filter(row=>row.viewer===viewer.id);
  const after=Object.fromEntries(checkpoints.map(count=>[count,Object.fromEntries(['dossier','publicReviews','candidate'].map(method=>[method,{
    auc:round(average(own.map(row=>row.snapshots[count][method].auc))),precision10:round(average(own.map(row=>row.snapshots[count][method].precision10)))
  }]))]));
  viewerSummaries.push({id:viewer.id,publicTrainingAuc,highRisk:publicTrainingAuc<=.60,after,
    deltaAuc20:round(after[20].candidate.auc-after[20].publicReviews.auc),deltaTop10:round(after[20].candidate.precision10-after[20].publicReviews.precision10),
    candidateLearningLoss:own.filter(row=>row.snapshots[40].candidate.auc<row.snapshots[10].candidate.auc-.03).length});
  process.stderr.write(`Confirmation viewers ${viewerSummaries.length}/${fixture.viewers.length}\n`);
}
const summarize=rows=>({viewers:rows.length,
  methods:Object.fromEntries(['dossier','publicReviews','candidate'].map(name=>[name,{auc:distribution(rows.map(row=>row.after[20][name].auc)),precision10:distribution(rows.map(row=>row.after[20][name].precision10))}])),
  gainAuc:meanInterval(rows.map(row=>row.deltaAuc20)),gainTop10:meanInterval(rows.map(row=>row.deltaTop10)),
  rankingRegressions:rows.filter(row=>row.deltaAuc20<-.03).map(row=>row.id),recommendationRegressions:rows.filter(row=>row.deltaTop10<=-.1+1e-9).map(row=>row.id),
  materiallyHelped:rows.filter(row=>row.deltaAuc20>.03).length});
const overall=summarize(viewerSummaries),highRisk=summarize(viewerSummaries.filter(row=>row.highRisk));
const learning=Object.fromEntries(checkpoints.map(count=>[count,Object.fromEntries(['dossier','publicReviews','candidate'].map(method=>[method,{auc:round(average(viewerSummaries.map(row=>row.after[count][method].auc))),precision10:round(average(viewerSummaries.map(row=>row.after[count][method].precision10)))}]))]));
const ruleChecks={meanGainAtLeastHalfPoint:overall.gainAuc.mean>=.005,intervalExcludesZero:overall.gainAuc.lower>0,noMeanRecommendationLoss:overall.gainTop10.mean>=0,highRiskSampleSufficient:highRisk.viewers>=8,noMaterialHighRiskMeanLoss:highRisk.viewers>0&&highRisk.gainAuc.mean>=-.03};
const regressions=viewerSummaries.filter(row=>row.deltaAuc20<-.03 || row.deltaTop10<=-.1+1e-9).sort((a,b)=>a.deltaAuc20-b.deltaAuc20).map(row=>{
  const viewer=fixture.viewers.find(v=>v.id===row.id),own=sessions.filter(s=>s.viewer===row.id);
  const representative=own.slice().sort((a,b)=>(a.snapshots[20].candidate.auc-a.snapshots[20].publicReviews.auc)-(b.snapshots[20].candidate.auc-b.snapshots[20].publicReviews.auc))[0];
  const truth=new Map(viewer.heldOutRatings.map(r=>[r.filmKey,r]));
  return {...row,seed:representative.seed,evidence:representative.observed.slice(0,20),
    promotedDislikes:representative.snapshots[20].candidate.top10.filter(id=>truth.get(id).rating<0&&!representative.snapshots[20].publicReviews.top10.includes(id)).map(id=>({title:byKey.get(id).title,stars:truth.get(id).stars})),
    displacedLikes:representative.snapshots[20].publicReviews.top10.filter(id=>truth.get(id).rating>0&&!representative.snapshots[20].candidate.top10.includes(id)).map(id=>({title:byKey.get(id).title,stars:truth.get(id).stars}))};
});
const report={version:'confirmation-v1',fixtureHash:hash(bytes),candidateHash:protocol.candidateHash,evaluatorFingerprint,modelFingerprint,protocol,viewers:viewerSummaries,overall,highRisk,learning,ruleChecks,
  decision:Object.values(ruleChecks).every(Boolean)?'eligible_for_further_review':'do_not_promote',regressions,sessions,verification:{ratingActions,cliParityPassed:true,noViewerOverlap:true,trainingHeldOutDisjoint:true}};
const output=value('--output','reports/reviews-plus-tags-confirmation-v1.json');
writeFileSync(output,JSON.stringify(report,null,2)+'\n');
process.stdout.write(JSON.stringify({output,overall,highRisk,ruleChecks,decision:report.decision})+'\n');
