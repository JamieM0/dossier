import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
const path=process.argv[2]??'reports/impact-correction-v1.json';
const r=JSON.parse(existsSync(path)?readFileSync(path):gunzipSync(readFileSync(path+'.gz'))),output=process.argv[3]??path.replace(/\.json$/,'.md');
const pct=x=>(100*x).toFixed(2),gain=g=>g.mean===null?'unavailable':`${pct(g.mean)} [${pct(g.lower)}, ${pct(g.upper)}]`;
const arms=r.protocol.arms.filter(a=>a!=='current');
const lines=['# Impact correction results','',`Decision: **${r.decision.status}**. ${r.decision.reason}`,'',
 `${r.viewers} fresh synthetic people supplied ${r.sessions} sessions. Reserved confirmation includes ${r.cohorts.sealed.viewers} people.`,
 'Jamie is the only real product user. The synthetic lab supplies model decision evidence.','',
 '## Reserved ranking outcomes','','Ranking accuracy measures whether liked hidden films outrank disliked films. Chance scores 50 percent.',
 'Gains and intervals use people after averaging their two sessions. Gains and losses use ranking percentage points.','',
 '| Policy | Accuracy | Gain, 95 percent interval | Worst answer loss | Active feedback | Limited final profiles |',
 '| --- | --- | --- | --- | --- | --- |'];
for(const [arm,a]of Object.entries(r.cohorts.sealed.arms))lines.push(`| ${arm} | ${pct(a.auc.mean)}% | ${gain(a.gain)} | ${pct(a.worstPromptLoss)} | ${(arm==='current'?0:a.accepted).toFixed(2)} | ${pct(a.limitedSessionRate)}% |`);
lines.push('','Active feedback counts are means per session. Limited profiles report final attenuation by the additional relation cap.','',
 '## Controls and interactions','','| Policy | General direction | Title reversal | Pair reversal | Isolated scope stable | Populated scope stable |','| --- | --- | --- | --- | --- | --- |');
for(const [arm,a]of Object.entries(r.cohorts.sealed.arms))lines.push(`| ${arm} | ${a.corrections.general.passed}/${a.corrections.general.tested} | ${a.corrections.exception.passed}/${a.corrections.exception.tested} | ${a.corrections.comparison.passed}/${a.corrections.comparison.tested} | ${Object.values(a.corrections).every(c=>c.unrelatedStable)} | ${a.multiPreferenceLocality} |`);
lines.push('','Reviewed correction trials deliberately approve both general effects. Score changes hidden by publication count as ineffective correction.',
 'Populated scope trials reverse a general preference while retaining the other preferences. Outside scores must remain unchanged.','',
 '## Adoption requirements','','Every frozen requirement must pass. The relation cap does not itself guarantee a five-point accuracy loss limit.','',
 `| Requirement | ${arms.join(' | ')} |`,`| --- | ${arms.map(()=>'---').join(' | ')} |`);
for(const g of Object.keys(r.candidateGates.scoped))lines.push(`| ${g} | ${arms.map(a=>r.candidateGates[a][g]).join(' | ')} |`);
lines.push('','## Different synthetic tastes','');
for(const [heading,group]of [['Existing controls',arms.filter(a=>!a.startsWith('impact_'))],['Limited candidates',arms.filter(a=>a.startsWith('impact_'))]]){
 lines.push(`### ${heading}`,'',`| Type | Current accuracy | ${group.map(a=>a+' gain').join(' | ')} |`,`| --- | --- | ${group.map(()=>'---').join(' | ')} |`);
 for(const [type,t]of Object.entries(r.types))lines.push(`| ${type} | ${pct(t.arms.current.auc.mean)}% | ${group.map(a=>gain(t.arms[a].gain)).join(' | ')} |`);
 lines.push('');
}
lines.push('','## Question cost','','| Policy | Broad questions | Follow-ups | Pending | Withdrawn |','| --- | --- | --- | --- | --- |');
for(const [arm,a]of Object.entries(r.cohorts.sealed.arms))lines.push(`| ${arm} | ${a.broadQuestions.toFixed(2)} | ${a.reviewQuestions.toFixed(2)} | ${a.pending.toFixed(2)} | ${a.withdrawn.toFixed(2)} |`);
lines.push('','Question counts are means per session. Every policy uses at most eight total questions.','',
 '## Evidence and limits','','Only supplied ratings, utterances, and public film descriptions reach the application.',
 'The biased-library group simulates misleading evidence selection. Held-out ratings never enter scoring or question selection.',
 'All policies preserve ordinary recommendation defaults. Each branch checks encrypted export and import.',
 'Title and comparison control trials use rated titles. Quality paths receive only general feedback.',
 'Known film candidates, candidate-pool composition, synthetic response patterns, and score publication limit these conclusions.','',
 '[Executive decision](impact-correction-analysis-v1.md) explains the project recommendation.',
 '[Protocol guide](../docs/impact-correction-experiment.md) explains the frozen procedure.',
 '[Lossless traces](impact-correction-v1.json.gz) preserve previews, questions, profiles, scores, and correction trials.','');
writeFileSync(output,lines.join('\n'));console.log(JSON.stringify({output}));
