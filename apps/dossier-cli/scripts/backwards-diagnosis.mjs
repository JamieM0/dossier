import { readFileSync,writeFileSync } from 'node:fs';
import { featureVector,buildTasteSpace,scoreCandidate,scoreCandidates,tasteClaimScoreAdjustment,DEFAULT_SCORING_PARAMS,cosineSimilarity } from '@dossier/domain';
import { execute } from '../dist/actions.js';
import { assessReal } from './real-metrics.mjs';
import { key,round,shuffled } from './hard-metrics.mjs';

const fixture=JSON.parse(readFileSync(new URL('../src/lab/real-tmdb-v1.json',import.meta.url)));
const original=JSON.parse(readFileSync('reports/dossier-learning-study-tmdb.json'));
const selected=original.learningDiagnostics.slice(0,5);
const items=fixture.items.map(({source:_source,...item})=>({...item,features:featureVector(item)}));
const byKey=new Map(items.map(item=>[key(item),item]));
const rounded=scores=>Object.fromEntries(Object.entries(scores).map(([id,value])=>[id,Math.round(value*1000)/1000]));
function terms(candidates,entries,claims) {
  const clusters=buildTasteSpace(entries).clusters;
  const liked=clusters.filter(c=>c.polarity==='liked'),disliked=clusters.filter(c=>c.polarity==='disliked');
  const scores=Object.fromEntries(candidates.map(item=>[key(item),{
    liked:scoreCandidate(item,liked,[],{...DEFAULT_SCORING_PARAMS,qualityWeight:0,dislikePenalty:0}),
    disliked:scoreCandidate(item,[],disliked,{...DEFAULT_SCORING_PARAMS,qualityWeight:0}),
    quality:DEFAULT_SCORING_PARAMS.qualityWeight*((item.voteAverage??5)/10-.5)*2,
    claims:tasteClaimScoreAdjustment(item,claims)
  }]));
  return {scores,liked,disliked,claims};
}
const combine=(before,after,mask)=>Object.fromEntries(Object.keys(after.scores).map(id=>[id,
  (mask&1?after:before).scores[id].liked+(mask&2?after:before).scores[id].disliked+(mask&4?after:before).scores[id].claims+after.scores[id].quality]));
function explainTransition(before,after,candidates,truth) {
  const auc=scores=>assessReal(rounded(scores),candidates,truth).auc;
  const hybrids=Object.fromEntries(Array.from({length:8},(_,mask)=>[mask,auc(combine(before,after,mask))]));
  const shapley={};
  for(const [name,bit] of [['liked',1],['disliked',2],['claims',4]]) {
    let total=0;
    for(let mask=0;mask<8;mask++) {
      if(mask&bit)continue;
      const size=[1,2,4].filter(b=>mask&b).length;
      const weight=size===1?1/6:1/3;
      total+=weight*(hybrids[mask|bit]-hybrids[mask]);
    }
    shapley[name]=round(total,6);
  }
  const oldLiked=new Map(before.liked.map(c=>[c.id,c])),oldDisliked=new Map(before.disliked.map(c=>[c.id,c]));
  const scorer=(liked,disliked,params=DEFAULT_SCORING_PARAMS,claims=after.claims)=>Object.fromEntries(candidates.map(item=>[key(item),scoreCandidate(item,liked,disliked,params)+tasteClaimScoreAdjustment(item,claims)]));
  const interventions={
    current:hybrids[7],freezeLikedContribution:hybrids[6],freezeDislikeContribution:hybrids[5],freezeClaims:hybrids[3],
    freezeExistingLikedCentroids:auc(scorer(after.liked.map(c=>({...c,centroid:oldLiked.get(c.id)?.centroid??c.centroid})),after.disliked)),
    freezeExistingLikedConfidence:auc(scorer(after.liked.map(c=>({...c,confidence:oldLiked.get(c.id)?.confidence??c.confidence})),after.disliked)),
    freezeExistingDislikedCentroids:auc(scorer(after.liked,after.disliked.map(c=>({...c,centroid:oldDisliked.get(c.id)?.centroid??c.centroid})))),
    freezeExistingDislikedConfidence:auc(scorer(after.liked,after.disliked.map(c=>({...c,confidence:oldDisliked.get(c.id)?.confidence??c.confidence})))),
    omitNewLikedGroups:auc(scorer(after.liked.filter(c=>oldLiked.has(c.id)),after.disliked)),
    retainEarlierAveragingCount:auc(scorer(after.liked,after.disliked,{...DEFAULT_SCORING_PARAMS,topKClusters:Math.min(DEFAULT_SCORING_PARAMS.topKClusters,before.liked.length)}))
  };
  const pairs=[];
  for(const liked of candidates.filter(item=>truth[key(item)]>0))for(const disliked of candidates.filter(item=>truth[key(item)]<0)) {
    const good=key(liked),bad=key(disliked);
    const oldScore=rounded(combine(before,after,0)),newScore=rounded(combine(before,after,7));
    if(oldScore[good]<=oldScore[bad] || newScore[good]>=newScore[bad])continue;
    const parts=Object.fromEntries(['liked','disliked','claims','quality'].map(name=>[name,{before:round(before.scores[good][name]-before.scores[bad][name],6),after:round(after.scores[good][name]-after.scores[bad][name],6)}]));
    pairs.push({liked:liked.title,disliked:disliked.title,likedKey:good,dislikedKey:bad,marginBefore:round(oldScore[good]-oldScore[bad]),marginAfter:round(newScore[good]-newScore[bad]),parts});
  }
  pairs.sort((a,b)=>(a.marginAfter-a.marginBefore)-(b.marginAfter-b.marginBefore));
  const clusterInfo=c=>({id:c.id,confidence:round(c.confidence,6),weight:c.weight,films:c.supportingRatings.map(e=>({title:e.item.title,rating:e.rating})),centroid:c.centroid});
  return {hybrids,shapley,interventions,lostPairs:pairs.slice(0,4),lostPairCount:pairs.length,
    likedGroupsBefore:before.liked.map(clusterInfo),likedGroupsAfter:after.liked.map(clusterInfo),
    dislikedGroupsBefore:before.disliked.map(clusterInfo),dislikedGroupsAfter:after.disliked.map(clusterInfo)};
}
const cases=[];
for(const target of selected) {
  const viewer=fixture.viewers.find(v=>v.id===target.viewer);
  const training=new Map(viewer.trainingRatings.map(row=>[row.filmKey,row]));
  const candidates=viewer.heldOutRatings.map(row=>byKey.get(row.filmKey));
  const truth=Object.fromEntries(viewer.heldOutRatings.map(row=>[row.filmKey,row.rating]));
  const order=shuffled([...training.keys()],target.seed+viewer.sourceUserId*1009);
  let vault={activeId:null,profiles:[]};
  const storage={root:'/backwards-learning-reproduction',load:()=>vault,save:next=>{vault=next},audit:()=>{}};
  const catalogue={detail:async(medium,id)=>byKey.get(`${medium}:${id}`),candidates:async()=>candidates};
  const call=(action,args={})=>execute(storage,action,args,catalogue);
  let revision=(await call('profile.create',{name:'Failure reproduction'})).revision;
  const snapshots=[],trace=[];
  for(let count=1;count<=40;count++) {
    const film=order[count-1];
    if(!training.has(film))throw new Error('Hidden evidence in failure reproduction');
    revision=(await call('rate.set',{key:film,value:training.get(film).rating,expectedRevision:revision})).revision;
    const state=vault.profiles[0].state;
    const rows=[];let cursor;
    do {const page=await call('suggest.list',{limit:20,...(cursor?{cursor}:{})});rows.push(...page.items);cursor=page.next;}while(cursor);
    const scores=Object.fromEntries(rows.map(row=>[row.id,row.score]));
    const term=terms(candidates,Object.values(state.ratings),state.tasteClaims);
    const reconstructed=rounded(Object.fromEntries(Object.entries(term.scores).map(([id,p])=>[id,p.liked+p.disliked+p.claims+p.quality])));
    if(Object.keys(scores).some(id=>Math.abs(scores[id]-reconstructed[id])>1e-9))throw new Error('Score decomposition disagrees with CLI');
    const auc=assessReal(scores,candidates,truth,rows.length>0).auc;
    snapshots.push(term);
    trace.push({count,title:byKey.get(film).title,rating:training.get(film).rating,auc,likedGroups:term.liked.length,dislikedGroups:term.disliked.length,delta:count>1?round(auc-trace.at(-1).auc):0});
  }
  if(trace[9].auc!==target.auc10 || trace[39].auc!==target.auc40)throw new Error('Worst session did not reproduce');
  const worstStep=trace.slice(10).slice().sort((a,b)=>a.delta-b.delta)[0];
  const transition=explainTransition(snapshots[worstStep.count-2],snapshots[worstStep.count-1],candidates,truth);
  const overall=explainTransition(snapshots[9],snapshots[39],candidates,truth);
  const dominant=Object.entries(overall.shapley).sort((a,b)=>a[1]-b[1])[0][0];
  const stepDominant=Object.entries(transition.shapley).sort((a,b)=>a[1]-b[1])[0][0];
  const finalState=vault.profiles[0].state;
  const finalEntries=Object.values(finalState.ratings);
  const orderScores=Array.from({length:12},(_,i)=>{
    const entries=shuffled(finalEntries,700+i);
    const scored=scoreCandidates(candidates,entries,undefined,finalState.tasteClaims);
    return {seed:700+i,auc:assessReal(rounded(Object.fromEntries(scored.map(row=>[key(row.item),row.score]))),candidates,truth).auc};
  });
  const orderSensitivity={sameRatings:true,claimsHeldFixed:true,scores:orderScores,min:Math.min(...orderScores.map(row=>row.auc)),max:Math.max(...orderScores.map(row=>row.auc))};
  const caseReport={orderSensitivity,viewer:target.viewer,seed:target.seed,auc10:target.auc10,auc40:target.auc40,reproduced:true,trace,worstStep,dominant,stepDominant,overall,transition};
  cases.push(caseReport);
  process.stderr.write(`Reproduced ${target.viewer}/${target.seed}: ${target.auc10} to ${target.auc40}; main score component ${dominant}\n`);
}
const report={version:'backwards-diagnosis-v1',selection:'The five largest 10-to-40-rating declines from the frozen TMDB study, selected before new-viewer scoring.',cases,
  method:'Exact CLI replay after every rating; additive score reconstruction; all eight before/after combinations of liked, disliked, and claim contributions. Shapley values attribute the observed ranking-score change including interactions.',
  limitations:'These interventions diagnose these frozen sessions. They do not prove a general fix or guarantee that evidence always improves performance. No inference rules or product defaults changed.',
  gate:{newInferenceRulesAllowed:false,requires:'A targeted mechanism fix validated on frozen regressions and new viewers, or a guard chosen without hidden answers and independently tested.'}};
writeFileSync('reports/backwards-learning-diagnosis-v1.json',JSON.stringify(report,null,2)+'\n');
process.stdout.write(JSON.stringify({cases:cases.map(row=>({viewer:row.viewer,seed:row.seed,auc10:row.auc10,auc40:row.auc40,dominant:row.dominant,worstStep:row.worstStep,shapley:row.overall.shapley,interventions:row.transition.interventions})),gate:report.gate})+'\n');
