import { average, distribution } from './hard-metrics.mjs';
import { meanInterval } from './real-metrics.mjs';
export function viewerMetric(viewer,budget,arm,field='auc',scope='contexts') {
 return average(viewer.sessions.map(s=>{
  const values=s.checkpoints[budget][arm];
  const selected=scope==='contexts'?Object.keys(values).filter(c=>c!=='global'):['global'];
  return average((selected.length?selected:['global']).map(c=>values[c][field]));
 }));
}
export function summarize(rows,protocol) {
 const learning={};
 for(const budget of protocol.budgets) {
  learning[budget]={};
  for(const arm of protocol.arms) {
   const values=rows.map(v=>viewerMetric(v,budget,arm));
   const gains=baseline=>rows.map(v=>viewerMetric(v,budget,arm)-viewerMetric(v,budget,baseline));
   learning[budget][arm]={auc:distribution(values),ndcg10:distribution(rows.map(v=>viewerMetric(v,budget,arm,'ndcg10'))),
    globalAuc:distribution(rows.map(v=>viewerMetric(v,budget,arm,'auc','global'))),
    gainOverGlobal:meanInterval(gains('global')),gainOverRecency:meanInterval(gains('recency')),gainOverSeparate:meanInterval(gains('separate')),
    individualLosses:gains('global').filter(n=>n<0).length,worstViewerDelta:Math.min(0,...gains('global')),
    unavailable:average(rows.map(v=>viewerMetric(v,budget,arm,'unavailable')))};
  }
 }
 const sessions=rows.flatMap(v=>v.sessions),corrections=sessions.map(s=>s.contracts.correction).filter(Boolean);
 const matches=sessions.reduce((n,s)=>n+s.claimQuality.matches,0),correct=sessions.reduce((n,s)=>n+s.claimQuality.correct,0);
 return {viewers:rows.length,learning,counts:distribution(rows.map(v=>average(v.sessions.flatMap(s=>Object.values(s.counts))))),
  worstSingleRatingDelta:Math.min(0,...sessions.flatMap(s=>s.traces.map(t=>t.delta))),
  corrections:{tested:corrections.length,directional:corrections.filter(c=>c.directional).length},
  claimPrecision:matches?correct/matches:null,claimMatches:matches,highConfidenceClaimErrors:sessions.reduce((n,s)=>n+s.claimQuality.highErrors,0),
  contracts:Object.fromEntries(['roundtrip','globalClaimsStable','scopeIsolation','clearRestores','removeRestores','deterministic'].map(name=>[name,sessions.every(s=>s.contracts[name])])),
  noContextEqual:sessions.every(s=>s.noContextEqual!==false),globalDefaultStable:sessions.every(s=>s.globalDefaultStable)};
}
export function decide(rows,protocol,smoke=false) {
 const candidateGates={};
 for(const domain of ['movies','books']) {
  const people=rows.filter(v=>v.cohort===`synthetic_${domain}_sealed`);
  if(!people.length)continue;
  const all=summarize(people,protocol),switches=summarize(people.filter(v=>['axis_switch','interaction_switch','hidden_switch'].includes(v.type)),protocol);
  const stable=people.filter(v=>v.type==='stable'),sparse=people.filter(v=>v.type==='sparse'),g=protocol.gates;
  const gain=switches.learning[20].shared,base=all.learning[20].global;
  const stableDelta=meanInterval(stable.map(v=>viewerMetric(v,20,'shared')-viewerMetric(v,20,'global')));
  const sparseDelta=meanInterval(sparse.map(v=>viewerMetric(v,3,'shared')-viewerMetric(v,3,'separate')));
  candidateGates[domain]={contextGain:gain.gainOverGlobal.mean>=g.minimumContextGain&&gain.gainOverGlobal.lower>0,
   beatsRecency:gain.gainOverRecency.lower>0,worstDecile:all.learning[20].shared.auc.p10-base.auc.p10>=g.worstDecileMinimumDelta,
   stableTaste:stableDelta.lower!==null&&stableDelta.lower>=g.stableNoninferiority,
   sparseTransfer:sparseDelta.lower!==null&&sparseDelta.lower>0,
   updateSafety:all.worstSingleRatingDelta>=-g.maxSingleRatingLoss,
   correction:all.corrections.tested>0&&all.corrections.directional/all.corrections.tested>=g.minimumCorrectionDirection,
   claimPrecision:all.claimPrecision!==null&&all.claimPrecision>=g.minimumClaimPrecision,...all.contracts,globalDefaultStable:all.globalDefaultStable};
 }
 const passed=Object.keys(candidateGates).length===2&&Object.values(candidateGates).every(g=>Object.values(g).every(Boolean));
 return {candidateGates,decision:{status:smoke?'smoke_only':passed?'promote_for_confirmation':'do_not_promote',
  reason:smoke?'Limited runs cannot select a candidate.':passed?'Every fresh sealed context, stability, control, and ownership gate passes. Seek human confirmation.':'The shared context candidate fails at least one frozen confirmation gate. Retain experiment status.'}};
}
