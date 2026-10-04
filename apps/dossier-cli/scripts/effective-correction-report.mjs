import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
const path=process.argv[2]??'reports/effective-correction-v1.json';
const report=JSON.parse(existsSync(path)?readFileSync(path):gunzipSync(readFileSync(path+'.gz')));
const output=process.argv[3]??path.replace(/\.json$/,'.md');
const pct=x=>(100*x).toFixed(2),interval=x=>x.mean===null?'unavailable':`${pct(x.mean)} [${pct(x.lower)}, ${pct(x.upper)}]`;
const lines=['# Effective correction results','',`Decision: **${report.decision.status}**. ${report.decision.reason}`,'',
 `${report.viewers} synthetic movie people supplied ${report.sessions} sessions. Reserved confirmation contains ${report.cohorts.sealed.viewers} people.`,
 '','Jamie is the only real product user. These results guide model decisions through the synthetic lab.','',
 '## Confirmation results','',
 'Ranking accuracy measures whether liked hidden films rank ahead of disliked films. Chance scores 50 percent.',
 'Gain intervals resample people after averaging their two sessions. Repeated sessions do not count as independent people.','',
 '| Arm | Ranking accuracy | Gain, 95 percent interval in points | Large viewer losses | Worst prompt loss |',
 '| --- | --- | --- | --- | --- |'];
for(const [arm,a]of Object.entries(report.cohorts.sealed.arms))lines.push(`| ${arm} | ${pct(a.auc.mean)}% | ${interval(a.gain)} | ${a.individualLosses} | ${pct(a.worstPromptLoss)} |`);
lines.push('','## Control outcomes','','Diagnostic corrections reverse supplied feedback. They measure control, rather than the truth of that feedback.','',
 '| Arm | General direction | Title sign change | Comparison reversed | Unrelated scores stable |','| --- | --- | --- | --- | --- |');
for(const [arm,a]of Object.entries(report.cohorts.sealed.arms))lines.push(`| ${arm} | ${a.corrections.general.passed}/${a.corrections.general.tested} | ${a.corrections.exception.passed}/${a.corrections.exception.tested} | ${a.corrections.comparison.passed}/${a.corrections.comparison.tested} | ${a.contracts.locality} |`);
lines.push('','General preferences require directional influence. They do not promise universal ordering against films outside the preference.',
 'Direct comparisons require the requested ordering before and after correction. Title exceptions require the requested score sign.',
 'Unrelated score stability does not imply unchanged rank positions. A corrected film can move past an unrelated film.','',
 '## Requirements','','Every requirement must pass before a candidate earns adoption review.','',
 '| Requirement | Native | Bounded | Scoped |','| --- | --- | --- | --- |');
for(const g of Object.keys(report.candidateGates.bounded))lines.push(`| ${g} | ${report.candidateGates.native[g]} | ${report.candidateGates.bounded[g]} | ${report.candidateGates.scoped[g]} |`);
lines.push('','## Different synthetic tastes','','| Type | Current accuracy | Native gain | Bounded gain | Scoped gain |','| --- | --- | --- | --- | --- |');
for(const [type,c]of Object.entries(report.types))lines.push(`| ${type} | ${pct(c.arms.current.auc.mean)}% | ${interval(c.arms.native.gain)} | ${interval(c.arms.bounded.gain)} | ${interval(c.arms.scoped.gain)} |`);
lines.push('','## Recommended decision','','Keep product defaults unchanged while reviewing the failed requirements.',
 'Distinguish effective control from recommendation quality. A policy can obey misleading feedback and reduce accuracy.',
 'Use subgroup outcomes to define a new hypothesis. Do not adjust this experiment after inspecting reserved outcomes.','',
 '## Evidence and limits','','Every scorer receives public descriptions and supplied ratings only.',
 'The lab replaces repeated ratings through the application transition. Hidden ratings never train a model.',
 'Every session checks default recommendations and encrypted export and import.',
 'The experiment measures candidate ranking, rather than film retrieval or human comprehension.',
 'Direct title and comparison feedback applies to rated titles in diagnostic pools. Their transfer to unseen films remains untested.',
 'The current and native controls represent unchanged scoring and existing feedback behavior.',
 'The native title control rerates a title. Its changes can affect recommendations outside that title.',
 'The scoped policy uses fixed priorities. These priorities do not constitute measured confidence.',
 '',`Protocol hash: \`${report.protocolHash}\`.`, '',
 '[Experiment guide](../docs/effective-correction-experiment.md) explains the frozen procedure.',
 '[Lossless traces](effective-correction-v1.json.gz) preserve questions, supplied answers, profiles, rankings, and control trials.','');
writeFileSync(output,lines.join('\n'));
console.log(JSON.stringify({output}));
