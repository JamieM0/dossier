import { readFileSync, writeFileSync } from 'node:fs';
const input=process.argv[2]??'reports/question-policy-v1.json',output=process.argv[3]??input.replace(/\.json$/,'.md');
const r=JSON.parse(readFileSync(input));
const pct=n=>`${(n*100).toFixed(2)}%`,points=n=>`${n>=0?'+':''}${(n*100).toFixed(2)}`;
const interval=x=>x.mean===null?'Unavailable':`${points(x.mean)} [${points(x.lower)}, ${points(x.upper)}]`;
const lines=['# Questions that earn their interruption: experiment 3','',`Decision: **${r.decision.status}**. ${r.decision.reason}`,'',
 `The CLI replay contains ${r.viewers} viewers and ${r.sessions} sessions. Every arm uses the current greedy geometry and ratings-only scorer.`,
 '', '## Review experiments 1 and 2','',
 'Experiment 1 removed order dependence with two deterministic grouping candidates. Neither candidate passed the quality and viewer-protection gates.',
 '', 'Experiment 2 found no reliable comparison gain. Recorded viewers supplied about three answers after 27 prompts. Neither learned metric passed the control gates.',
 '', 'Experiment 3 therefore changes question selection alone. Public scores, hidden recognition, and held-out answers never enter selection.',
 '', '## Compare policies','',
 '| Arm | Behavior |','| --- | --- |',
 '| active | Current active queue with public fields removed. |',
 '| balanced_random | Random sampling weighted by recognition estimated from revealed ratings and skips. |',
 '| disagreement | Ask where bootstrap profiles disagree about the next rating. Weight selection by estimated recognition. |',
 '| counterfactual | Simulate seven answers, estimate ranking uncertainty reduction, penalize established-order flips, and permit stopping. |',
 '| counterfactual_no_stop | Use the same counterfactual policy and continue to the interaction limit. |',
 '', '## Read the frozen gates','',
 'Candidates must beat balanced random at 20 and 40 answers and prompts. Both viewer-bootstrap lower bounds must exceed zero.',
 '', 'Each candidate must preserve worst-decile AUC and limit every single-answer loss to five points.',
 '', 'Counterfactual question-quality gates use its no-stop arm. Stopping requires at least 20% fewer prompts and terminal AUC noninferiority within half a point.',
 '', 'Recorded viewers and new sealed synthetic viewers must pass separately. Matched-budget comparisons require at least 90% viewer coverage.',
 '', '| Candidate | Recorded gates not met | New sealed gates not met |', '| --- | --- | --- |'];
for(const c of r.candidates)lines.push(`| ${c.arm} | ${Object.entries(c.recorded).filter(([,ok])=>!ok).map(([k])=>k).join(', ')||'None'} | ${c.sealed?Object.entries(c.sealed).filter(([,ok])=>!ok).map(([k])=>k).join(', ')||'None':'Unavailable'} |`);
for(const [name,g] of [['recorded',r.recorded],...Object.entries(r.cohorts)]){
 lines.push('',`## ${name}`,'',`${g.viewers} viewers. Repeated sessions average within each viewer before uncertainty estimates.`,'',
 '| Budget | Policy | AUC | Gain over random, 95% interval (points) | Worst tenth | Reached sessions | Matched viewers |',
 '| --- | --- | --- | --- | --- | --- | --- |');
 for(const kind of ['byAnswer','byPrompt'])for(const budget of [20,40])for(const arm of r.protocol.arms){
  const x=g.learning[kind][budget][arm];
  lines.push(`| ${budget} ${kind==='byAnswer'?'answers':'prompts'} | ${arm} | ${pct(x.auc.mean)} | ${interval(x.gain)} | ${pct(x.auc.p10)} | ${x.reachedSessions}/${x.sessions} | ${x.matchedBudgetViewers} |`);
 }
 lines.push('', 'Unreached checkpoints carry the terminal profile for the intention-to-prompt summary. Matched-budget gates require at least 90% viewer coverage and positive lower bounds for both matched and all-viewer comparisons.',
 '', '| Policy | Mean prompts | Mean answers | Skip rate | Stopped | Largest answer loss (points) |', '| --- | --- | --- | --- | --- | --- |');
 for(const arm of r.protocol.arms){const x=g.arms[arm];lines.push(`| ${arm} | ${x.prompts.mean.toFixed(2)} | ${x.answers.mean.toFixed(2)} | ${pct(x.skipRate)} | ${x.stoppedSessions} | ${points(x.largestAnswerLoss)} |`);}
 const x=g.arms.counterfactual;
 lines.push('',`Stopping saves ${pct(x.promptSavingAgainstNoStop)} of prompts. Terminal AUC changes by ${interval(x.terminalGainAgainstNoStop)} points against continued questioning.`);
}
lines.push('', '## Interpretation limits','',...r.protocol.limits.map(x=>`- ${x}`),'',
 'The counterfactual policy reweights a finite bootstrap ensemble for each possible answer. It does not refit every posterior profile.',
 '', 'Simulated stability checks append ratings with fixed claims. Actual CLI ratings reconcile claims, so policy predictions can miss claim changes.',
 '', 'Reports include high-confidence claim errors and question-value calibration bins. These measurements do not establish calibrated probability or explanation accuracy.',
 '', 'Identical repeated requests preserve the stored profile and return identical questions. CLI tests also preserve explicit claim corrections across rating updates.',
 '', '## Reproduce the result','', 'To run the frozen experiment, use:', '', '```sh', 'pnpm lab:question-policy', '```', '',
 'To run a limited check without replacing the full report, use:', '', '```sh', 'pnpm lab:question-policy -- --max-viewers 2 --output /tmp/question-smoke.json', '```', '',
 'Limited runs return `smoke_only`. The JSON stores every prompt, answer, skip, checkpoint, and viewer outcome.',
 '', `Protocol SHA-256: \`${r.protocolHash}\`.`, '', `Model SHA-256: \`${r.modelFingerprint}\`.`, '', `Evaluator SHA-256: \`${r.evaluatorFingerprint}\`.`,'');
writeFileSync(output,lines.join('\n'));
console.log(JSON.stringify({output}));
