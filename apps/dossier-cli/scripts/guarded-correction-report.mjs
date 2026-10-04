import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
const path=process.argv[2]??'reports/guarded-correction-v1.json';
const r=JSON.parse(existsSync(path)?readFileSync(path):gunzipSync(readFileSync(path+'.gz'))),output=process.argv[3]??path.replace(/\.json$/,'.md');
const pct=x=>(x*100).toFixed(2),gain=g=>g.mean===null?'unavailable':`${pct(g.mean)} [${pct(g.lower)}, ${pct(g.upper)}]`;
const lines=['# Guarded correction results','',`Decision: **${r.decision.status}**. ${r.decision.reason}`,'',
 `${r.viewers} fresh synthetic people supplied ${r.sessions} sessions. Reserved confirmation includes ${r.cohorts.sealed.viewers} people.`,
 'Jamie is the only real product user. The synthetic lab supplies model decision evidence.','',
 '## Reserved outcomes','','Ranking accuracy measures whether liked hidden films outrank disliked films. Chance scores 50 percent.',
 'Gains and intervals use people after averaging their two sessions. All gains and losses use ranking percentage points.',
 'The worst loss follows one answer.','',
 '| Policy | Accuracy | Gain, 95 percent interval | Worst loss | Broad questions | Follow-ups | Applied preferences | Pending | Withdrawn |',
 '| --- | --- | --- | --- | --- | --- | --- | --- | --- |'];
for(const [arm,a]of Object.entries(r.cohorts.sealed.arms))lines.push(`| ${arm} | ${pct(a.auc.mean)}% | ${gain(a.gain)} | ${pct(a.worstPromptLoss)} | ${a.broadQuestions.toFixed(2)} | ${a.reviewQuestions.toFixed(2)} | ${(arm==='current'?0:a.accepted).toFixed(2)} | ${a.pending.toFixed(2)} | ${a.withdrawn.toFixed(2)} |`);
lines.push('','Question and preference counts are means per session. Follow-ups consume the same eight-turn budget as broad questions.','',
 '## Control outcomes','','| Policy | General correction | Title reversal | Pair reversal | Outside scope stable | Pending scores stable |','| --- | --- | --- | --- | --- | --- |');
for(const [arm,a]of Object.entries(r.cohorts.sealed.arms))lines.push(`| ${arm} | ${a.corrections.general.passed}/${a.corrections.general.tested} | ${a.corrections.exception.passed}/${a.corrections.exception.tested} | ${a.corrections.comparison.passed}/${a.corrections.comparison.tested} | ${a.contracts.locality} | ${a.pendingStable} |`);
lines.push('','Reviewed general trials deliberately approve both effects. Guarded trials receive no bypass; any ineffective reversal counts as failure.',
 'These trials measure control. Hidden-film quality measures the truth and usefulness of feedback separately.','',
 '## Adoption requirements','','Every requirement must pass. The gain and protection thresholds remain unchanged from experiment six.','',
 '| Requirement | Bounded | Scoped | Guarded | Reviewed |','| --- | --- | --- | --- | --- |');
for(const g of Object.keys(r.candidateGates.bounded))lines.push(`| ${g} | ${r.candidateGates.bounded[g]} | ${r.candidateGates.scoped[g]} | ${r.candidateGates.guarded[g]} | ${r.candidateGates.reviewed[g]} |`);
lines.push('','Both independent and persistent misleading explanations must pass protection requirements.',
 'Accurate multiple preferences must retain at least 80 percent of the scoped policy gain when that gain is positive.','',
 '## Different synthetic tastes','','| Type | Current accuracy | Bounded gain | Scoped gain | Guarded gain | Reviewed gain |','| --- | --- | --- | --- | --- | --- |');
for(const [type,t]of Object.entries(r.types))lines.push(`| ${type} | ${pct(t.arms.current.auc.mean)}% | ${gain(t.arms.bounded.gain)} | ${gain(t.arms.scoped.gain)} | ${gain(t.arms.guarded.gain)} | ${gain(t.arms.reviewed.gain)} |`);
lines.push('','## Evidence and limits','','A new cohort and catalogue prevent reuse of experiment six confirmation evidence.',
 'Only public descriptions, supplied ratings, and actual answers reach the application.',
 'The actor can repeat a wrong explanation. Follow-up approval does not constitute measured confidence.',
 'Ordinary recommendations remain unchanged. Each branch checks removal, restoration, pending scores, and encrypted portability.',
 'Title and pair feedback applies to rated diagnostic films. Unseen-film ranking gains come from broad preferences.',
 'The experiment tests known film candidates. Retrieval, human comprehension, and television remain outside its scope.','',
 '[Executive decision](guarded-correction-analysis-v1.md) explains the project implications and next hypothesis.',
 '[Protocol guide](../docs/guarded-correction-experiment.md) explains the frozen procedure.',
 '[Lossless traces](guarded-correction-v1.json.gz) preserve evidence, previews, answers, profiles, rankings, and control trials.','');
writeFileSync(output,lines.join('\n'));console.log(JSON.stringify({output}));
