import { average, distribution } from './hard-metrics.mjs';
import { meanInterval } from './real-metrics.mjs';
export function summarize(rows, protocol) {
 const sessions=rows.flatMap(v=>v.sessions),result={viewers:rows.length,arms:{}};
 for(const arm of protocol.arms) {
  const final=v=>average(v.sessions.map(s=>s.checkpoints[8][arm].auc));
  const gains=rows.map(v=>final(v)-average(v.sessions.map(s=>s.checkpoints[8].current.auc)));
  const contracts=sessions.map(s=>s.contracts[arm]);
  const kinds=Object.fromEntries(['general','exception','comparison'].map(kind=>{
   const cases=contracts.map(c=>c[kind]).filter(Boolean);
   return [kind,{tested:cases.length,passed:cases.filter(c=>c.passed).length,
    sourcePairReversed:cases.filter(c=>c.pairReversed).length,unrelatedStable:cases.every(c=>c.unrelatedStable)}];
  }));
  result.arms[arm]={auc:distribution(rows.map(final)),gain:meanInterval(gains),
   worstDecileDelta:distribution(rows.map(final)).p10-distribution(rows.map(v=>average(v.sessions.map(s=>s.checkpoints[8].current.auc)))).p10,
   individualLosses:gains.filter(g=>g<-.03).length,
   worstPromptLoss:Math.min(0,...sessions.flatMap(s=>s.steps.map(t=>t.delta[arm]))),
   corrections:kinds,contracts:{removal:contracts.every(c=>c.removal),restoration:contracts.every(c=>c.restoration),
    locality:Object.values(kinds).every(c=>c.unrelatedStable),portability:sessions.every(s=>s.portability),
    defaults:sessions.every(s=>s.defaultStable),overwrite:sessions.every(s=>s.overwriteMatched)},
   answeredViewerRate:average(rows.map(v=>Number(v.sessions.some(s=>s.accepted>0)))),
   prompts:average(sessions.map(s=>s.answers.length)),accepted:average(sessions.map(s=>s.accepted)),
   harmfulPromptRate:average(sessions.flatMap(s=>s.steps.map(t=>Number(t.delta[arm]<0)))),
   meanRankMovement:average(contracts.map(c=>c.rankMovement))};
 }
 return result;
}
export function decide(rows,protocol,smoke=false) {
 const sealed=rows.filter(v=>v.partition==='sealed'),summary=summarize(sealed,protocol),noisy=summarize(sealed.filter(v=>v.type==='noisy_explanations'),protocol);
 const g=protocol.gates,candidateGates={};
 for(const arm of protocol.arms.filter(a=>a!=='current')) {
  const a=summary.arms[arm],n=noisy.arms[arm];
  candidateGates[arm]={minimumGain:a.gain.mean!==null&&a.gain.mean>=g.minimumMeanGain,
   positiveLowerBound:a.gain.lower!==null&&a.gain.lower>0,worstDecile:a.worstDecileDelta>=g.worstDecileDelta,
   noisyProtection:n.gain.lower!==null&&n.gain.lower>=g.noisyMeanDelta,
   singlePromptSafety:a.worstPromptLoss>=-g.maxSinglePromptLoss,
   questionCoverage:a.answeredViewerRate>=g.minAnsweredViewers,
   correction:Object.values(a.corrections).every(c=>c.tested>0&&c.passed/c.tested>=g.minCorrectionRate),...a.contracts};
 }
 const complete=sealed.length===60&&rows.length===120;
 const eligible=Object.entries(candidateGates).filter(([,g])=>Object.values(g).every(Boolean)).map(([arm])=>arm);
 return {candidateGates,decision:{status:smoke||!complete?'smoke_only':eligible.length?'eligible_for_adoption_review':'do_not_promote',eligible,
  reason:smoke||!complete?'Limited replay cannot establish adoption eligibility.':eligible.length?'Candidates passed frozen synthetic requirements; product defaults remain unchanged.':'No candidate passed every frozen gain, control, and protection requirement.'}};
}
