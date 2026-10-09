import { average, distribution, round } from './hard-metrics.mjs';
import { meanInterval } from './real-metrics.mjs';
export function summarize(viewers, protocol) {
 return Object.fromEntries(protocol.arms.map(arm=>{
  const values=viewers.map(v=>average(v.sessions.map(s=>s.steps.find(x=>x.count===60).measures[arm].auc)));
  const baseline=viewers.map(v=>average(v.sessions.map(s=>s.steps.find(x=>x.count===60).measures.current.auc)));
  const deltas=viewers.flatMap(v=>v.sessions.flatMap(s=>s.steps.filter(x=>x.count>10&&x.count<=60).map(x=>x.deltas[arm])));
  return [arm,{auc:distribution(values),gain:meanInterval(values.map((x,i)=>x-baseline[i])),
   precision10:round(average(viewers.map(v=>average(v.sessions.map(s=>s.steps.find(x=>x.count===60).measures[arm].precision10))))),
   worstStep:round(Math.min(0,...deltas)),largeLossRate:round(deltas.filter(x=>x<-.05).length/Math.max(1,deltas.length)),
   orderSpread:round(Math.max(0,...viewers.flatMap(v=>v.sessions.map(s=>s.order[arm].aucSpread))))}];
 }));
}
export function decision(viewers, failures, protocol, limited=false) {
 const sealed=viewers.filter(v=>v.partition==='sealed'),summary=summarize(sealed,protocol),g=protocol.gates;
 const subgroups=Object.fromEntries(['stable_axes','changing_taste'].map(t=>[t,summarize(sealed.filter(v=>v.type===t),protocol)]));
 const candidates=protocol.arms.filter(a=>a!=='current').map(arm=>{
  const r=summary[arm],f=failures.map(x=>x.arms[arm]);
  const gates={meanGain:r.gain.mean>=g.minimumMeanGain,positiveLowerBound:r.gain.lower>0,
   worstTenth:r.auc.p10>=summary.current.auc.p10+g.worstDecileDelta,
   stableTaste:subgroups.stable_axes[arm].gain.lower>=g.subgroupLowerDelta,
   changingTaste:subgroups.changing_taste[arm].gain.lower>=g.subgroupLowerDelta,
   singleRatingSafety:r.worstStep>=-g.maxSingleRatingLoss,
   largeLossFrequency:r.largeLossRate<=summary.current.largeLossRate*g.largeLossRateRatio,
   orderInvariant:sealed.length>0&&sealed.every(v=>v.sessions.every(s=>s.order[arm].scoreSignatures===1)),
   historicalGain:f.length===5&&f.every(x=>x.gainCurrent40>=g.historicalFinalGain),
   historicalDecline:f.length===5&&f.every(x=>x.change>=g.historicalTotalDecline),
   historicalStep:f.length===5&&f.every(x=>x.worstStep>=-g.maxSingleRatingLoss),
   contracts:sealed.length>0&&sealed.every(v=>v.sessions.every(s=>Object.values(s.contracts).every(Boolean)&&s.scorerRestoration[arm]))};
  return {arm,gates,passed:Object.values(gates).every(Boolean)};
 });
 const eligible=candidates.filter(c=>c.passed).sort((a,b)=>summary[b.arm].gain.mean-summary[a.arm].gain.mean);
 return {candidateGates:candidates,decision:{status:limited?'smoke_only':eligible.length?'eligible_for_adoption_review':'do_not_promote',
  selected:limited?null:eligible[0]?.arm??null,reason:limited?'Limited runs cannot decide adoption.':eligible.length?'Every frozen requirement passes.':'No candidate passes every frozen requirement.'}};
}
