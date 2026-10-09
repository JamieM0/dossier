import { average, round } from './hard-metrics.mjs';
import { meanInterval } from './real-metrics.mjs';
import { summarizeCorroboration } from './corroboration-metrics.mjs';

export function influenceDecision(viewers,failures,protocol,partition){
  const selected=viewers.filter(v=>v.partition===partition),summary=summarizeCorroboration(selected,protocol),g=protocol.gates;
  const groups=Object.fromEntries([...new Set(selected.map(v=>v.type))].map(t=>[t,summarizeCorroboration(selected.filter(v=>v.type===t),protocol)]));
  const candidates=protocol.arms.slice(3).map(arm=>{
    const r=summary[arm];
    const gates={completeCohort:selected.length===(partition==='development'?44:88),meanGain:r.gain.mean>=g.minimumMeanGain,positiveLowerBound:r.gain.lower>0,
      worstTenth:r.auc.p10>=summary.current.auc.p10+g.worstDecileDelta,contemporaneousTaste:r.contemporaneousGain.lower>=g.subgroupLowerDelta,
      ...Object.fromEntries(Object.entries(groups).map(([t,s])=>[t,s[arm].gain.lower>=g.subgroupLowerDelta])),
      adaptation40:r.adaptation40.lower>=g.subgroupLowerDelta,
      adaptationRetention:groups.changing_taste[arm].gain.mean>=Math.max(0,groups.changing_taste.local_recent.gain.mean)*g.retainedAdaptation,
      singleRatingSafety:r.worstStep>=-g.maxSingleRatingLoss,largeLossFrequency:r.largeLossRate<=summary.current.largeLossRate*g.largeLossRateRatio,
      orderInvariant:selected.every(v=>v.sessions.every(s=>s.order[arm].scoreSignatures===1)),
      novelLearning:average(selected.filter(v=>v.type==='novel_preference').map(v=>average(v.sessions.map(s=>s.novelLearning[arm]))))>0,
      legacyHistoricalVerified:false,
      historicalGain:failures.length===5&&failures.every(f=>f.arms[arm].gainCurrent40>=g.historicalFinalGain),
      historicalDecline:failures.length===5&&failures.every(f=>f.arms[arm].change>=g.historicalTotalDecline),
      historicalStep:failures.length===5&&failures.every(f=>f.arms[arm].worstStep>=-g.maxSingleRatingLoss),
      contracts:selected.every(v=>v.sessions.every(s=>Object.values(s.contracts).every(Boolean)&&s.scorerRestoration[arm]))};
    return {arm,gates,passed:Object.values(gates).every(Boolean)};
  });
  const comparisons=Object.fromEntries(protocol.arms.slice(3).map(arm=>[arm,Object.fromEntries(['current','local','local_recent'].map(control=>[control,
    meanInterval(selected.map(v=>average(v.sessions.map(s=>s.steps.at(-1).measures[arm].auc-s.steps.at(-1).measures[control].auc))))]))]));
  const learning=Object.fromEntries(protocol.arms.map(arm=>[arm,{
    novel:meanInterval(selected.filter(v=>v.type==='novel_preference').map(v=>average(v.sessions.map(s=>s.novelLearning[arm])))),
    worst:selected.flatMap(v=>v.sessions.flatMap(s=>s.steps.filter(x=>x.count>10).map(x=>({viewer:v.viewer,type:v.type,seed:s.seed,count:x.count,event:x.event,mistake:x.mistake,delta:x.phaseDeltas[arm]})))).sort((a,b)=>a.delta-b.delta)[0],
    accurateLargeLosses:selected.flatMap(v=>v.sessions.flatMap(s=>s.steps.filter(x=>x.count>10&&!x.mistake&&x.phaseDeltas[arm]<-.05))).length
  }]));
  return {summary,groups,candidates,comparisons,learning,decision:{status:partition==='development'?'development_only':candidates.some(c=>c.passed)?'passes_partition':'do_not_promote',
    selected:candidates.filter(c=>c.passed).sort((a,b)=>summary[b.arm].gain.mean-summary[a.arm].gain.mean)[0]?.arm??null}};
}
