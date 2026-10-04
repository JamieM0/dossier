import { summarize as original } from './effective-correction-metrics.mjs';
import { average } from './hard-metrics.mjs';
export function summarize(rows,protocol) {
 const result=original(rows,protocol),sessions=rows.flatMap(v=>v.sessions);
 for(const arm of protocol.arms) {
  const branches=sessions.map(s=>s.branches[arm]);
  Object.assign(result.arms[arm],{
   answeredViewerRate:average(rows.map(v=>Number(v.sessions.some(s=>s.branches[arm].accepted>0)))),
   prompts:average(branches.map(b=>b.turns.length)),accepted:average(branches.map(b=>b.accepted)),
   broadQuestions:average(branches.map(b=>b.turns.filter(t=>t.kind==='main').length)),
   reviewQuestions:average(branches.map(b=>b.turns.filter(t=>t.kind==='review').length)),
   pending:average(branches.map(b=>b.decisions.filter(d=>d.status==='defer').length)),
   withdrawn:average(branches.map(b=>b.decisions.filter(d=>d.status==='withdraw').length)),
   pendingStable:sessions.every(s=>s.contracts[arm].pendingStable)
  });
 }
 return result;
}
export function decide(rows,protocol,smoke=false) {
 const sealed=rows.filter(v=>v.partition==='sealed'),s=summarize(sealed,protocol);
 const noisy=['noisy_explanations','persistent_noise'].map(type=>summarize(sealed.filter(v=>v.type===type),protocol));
 const accurate=summarize(sealed.filter(v=>v.type==='multiple'),protocol),g=protocol.gates,candidateGates={};
 for(const arm of protocol.arms.filter(a=>a!=='current')) {
  const a=s.arms[arm],reference=accurate.arms.scoped.gain.mean;
  candidateGates[arm]={minimumGain:a.gain.mean!==null&&a.gain.mean>=g.minimumMeanGain,
   positiveLowerBound:a.gain.lower!==null&&a.gain.lower>0,worstDecile:a.worstDecileDelta>=g.worstDecileDelta,
   noisyProtection:noisy.every(n=>n.arms[arm].gain.lower!==null&&n.arms[arm].gain.lower>=g.noisyMeanDelta),
   singlePromptSafety:a.worstPromptLoss>=-g.maxSinglePromptLoss,
   questionCoverage:a.answeredViewerRate>=g.minAnsweredViewers,
   correction:Object.values(a.corrections).every(c=>c.tested>0&&c.passed/c.tested>=g.minCorrectionRate),
   accurateGainRetention:reference!==null&&accurate.arms[arm].gain.mean!==null&&(reference<=0||accurate.arms[arm].gain.mean>=g.accurateGainRetention*reference),
   pendingStable:a.pendingStable,...a.contracts};
 }
 const eligible=Object.entries(candidateGates).filter(([,g])=>Object.values(g).every(Boolean)).map(([a])=>a);
 const complete=rows.length===protocol.totalViewers&&sealed.length===protocol.confirmationViewers;
 return {candidateGates,decision:{status:smoke||!complete?'smoke_only':eligible.length?'eligible_for_adoption_review':'do_not_promote',eligible,
  reason:smoke||!complete?'Limited replay cannot decide adoption.':eligible.length?'All frozen synthetic requirements pass; ordinary recommendations remain unchanged.':'No candidate meets every frozen requirement. Keep ordinary recommendation defaults.'}};
}
