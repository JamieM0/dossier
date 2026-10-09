import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
const input=process.argv[2]??'reports/learning-stability-v1.json.gz',output=process.argv[3]??'reports/learning-stability-v1.md';
const bytes=readFileSync(input),r=JSON.parse(input.endsWith('.gz')?gunzipSync(bytes):bytes),summary=r.cohorts.sealed;
const labels={current:'Current',canonical_greedy:'Stable anchors',canonical_complete_link:'Strict stable groups',local:'Local evidence',local_recent:'Recent local evidence'};
const points=n=>(n*100).toFixed(2),interval=g=>`${points(g.mean)} [${points(g.lower)}, ${points(g.upper)}]`;
const lines=['# Learning stability results','',`Decision: **${r.decision.status}**. ${r.decision.reason}`,'',
 `The replay covers ${r.viewers} synthetic people and ${r.sessions} sessions.`,
 'Jamie is the only real product user. Historical MovieLens failures supply regression evidence.',
 '', '## Reserved people','',
 'Ranking accuracy measures how often a liked hidden film ranks ahead of a disliked film. Chance scores 50 percent.',
 'Intervals resample people after averaging their sessions. Repeated sessions do not count as independent people.',
 '', '| Policy | Accuracy | Gain interval, points | Largest loss, points | Large losses | Order spread, points |',
 '| --- | --- | --- | --- | --- | --- |',
 ...r.protocol.arms.map(a=>`| ${labels[a]} | ${points(summary[a].auc.mean)}% | ${interval(summary[a].gain)} | ${points(-summary[a].worstStep)} | ${points(summary[a].largeLossRate)}% | ${points(summary[a].orderSpread)} |`),
 '', '## Requirements','', '| Policy | Failed frozen requirements |','| --- | --- |',
 ...r.candidateGates.map(c=>`| ${labels[c.arm]} | ${Object.entries(c.gates).filter(([,ok])=>!ok).map(([name])=>name).join(', ')||'None'} |`),
 '', '## Taste groups','', '| Group | Current accuracy | Local gain, points | Recent local gain, points |', '| --- | --- | --- | --- |',
 ...Object.entries(r.types).map(([t,s])=>`| ${t.replaceAll('_',' ')} | ${points(s.current.auc.mean)}% | ${interval(s.local.gain)} | ${interval(s.local_recent.gain)} |`),
 '', '## Historical failures','', '| Viewer and order | Policy | Gain at forty ratings, points | Change from ten to forty, points | Largest step loss, points |', '| --- | --- | --- | --- | --- |',
 ...r.failures.flatMap(f=>r.protocol.arms.map(a=>`| ${f.viewer}, ${f.seed} | ${labels[a]} | ${points(f.arms[a].gainCurrent40)} | ${points(f.arms[a].change)} | ${points(-f.arms[a].worstStep)} |`)),
 '', '## Profile continuity','',
 `Intervening reratings and clearing change stored claims in ${r.viewerResults.flatMap(v=>v.sessions).filter(s=>s.claimHistoryChanged).length} sessions.`,
 'Both local policies restore their published scores in every session without resetting the original claims. Changed claim records alone do not establish a recommendation failure.',
 'Order tests permute the same final library while retaining timestamps and stored claims.',
 'Experimental reads preserve library state. Encrypted export and import preserve state and checkpoint scores.',
 '', '## Evidence limits','', ...r.protocol.limitations.map(x=>`- ${x}`),
 '', 'Read the [experiment guide](../docs/learning-stability-experiment.md) for the frozen requirements and reproduction commands.',
 'Read the [compressed traces](learning-stability-v1.json.gz) for every rating, score, and measurement.',''];
writeFileSync(output,lines.join('\n'));
console.log(output);
