import { readFileSync, writeFileSync, createReadStream } from 'node:fs';
import { gunzipSync, createGunzip } from 'node:zlib';
import { createInterface } from 'node:readline';
const input=process.argv[2]??'reports/corroboration-v1.jsonl.gz',output=process.argv[3]??'reports/corroboration-v1.md';
let report;
if(input.endsWith('.jsonl.gz')){
  const records=createInterface({input:createReadStream(input).pipe(createGunzip()),crlfDelay:Infinity});
  for await(const line of records){const record=JSON.parse(line);if(record.type==='summary')report=record.report;else if(record.type==='failure')report.failures.push(record.failure);}
}else{const bytes=readFileSync(input);report=JSON.parse(input.endsWith('.gz')?gunzipSync(bytes):bytes);}
const labels={current:'Current',local:'Local matching',local_recent:'Recent matching',supported_local:'Supported matching',supported_recent:'Supported recent matching',
  supported_claims_local:'Supported matching and claims',supported_claims_recent:'Supported recent matching and claims'};
const points=n=>(n*100).toFixed(2),interval=g=>`${points(g.mean)} [${points(g.lower)}, ${points(g.upper)}]`;
const lines=['# Corroboration results','',`Decision: **${report.decision.status}**. ${report.decision.reason}`,'',
  `The experiment covers ${report.viewers} fresh synthetic people and ${report.sessions} sessions.`,
  'Jamie remains the only real product user. The product recommendation baseline remains unchanged.',
  'The two reserved cohorts each contain 64 people. Confirmation people are independent of selection people.',
  '', '## Measured outcomes','',
  'Accuracy measures how often a liked hidden film ranks ahead of a disliked film.',
  'Update losses evaluate both sides against the same contemporaneous taste, including the preference-change boundary.',
  'Intervals resample people after averaging their two sessions. Large losses exceed five ranking points after ten ratings.'];
for(const partition of ['sealed','confirmation']){
  lines.push('',`### ${partition==='sealed'?'Selection people':'Confirmation people'}`,'',
    '| Policy | Final accuracy | Gain interval, points | Present-taste gain, points | Largest update loss, points | Large losses |',
    '| --- | --- | --- | --- | --- | --- |',
    ...report.protocol.arms.map(arm=>{const s=report.cohorts[partition][arm];return `| ${labels[arm]} | ${points(s.auc.mean)}% | ${interval(s.gain)} | ${interval(s.contemporaneousGain)} | ${points(-s.worstStep)} | ${points(s.largeLossRate)}% |`;}),
    '', '| Candidate | Failed frozen requirements |', '| --- | --- |',
    ...report.candidateGates[partition].map(c=>`| ${labels[c.arm]} | ${Object.entries(c.gates).filter(([,passed])=>!passed).map(([name])=>name).join(', ')||'None'} |`),
    '', '| Taste group | Current accuracy | Supported claim gain, points | Recent supported claim gain, points |', '| --- | --- | --- | --- |',
    ...Object.entries(report.types[partition]).map(([type,s])=>`| ${type.replaceAll('_',' ')} | ${points(s.current.auc.mean)}% | ${interval(s.supported_claims_local.gain)} | ${interval(s.supported_claims_recent.gain)} |`));
}
lines.push('', '## Historical failures','', '| Viewer and order | Policy | Final gain, points | Ten-to-forty change, points | Largest update loss, points |', '| --- | --- | --- | --- | --- |',
  ...report.failures.flatMap(f=>report.protocol.arms.map(arm=>`| ${f.viewer}, ${f.seed} | ${labels[arm]} | ${points(f.arms[arm].gainCurrent40)} | ${points(f.arms[arm].change)} | ${points(-f.arms[arm].worstStep)} |`)),
  '', '## Controls and evidence limits','',
  'Every supplied rating, overwrite, removal, and original timestamp remains exact in the stored library.',
  'Stored preferences remain inspectable and unchanged by scoring. Guard previews identify supporting titles, counters, and effective influence.',
  'The experiment checks encrypted portability and score restoration while preserving original claims for scorer isolation.',
  'Eight storage-order permutations retain timestamps and stored claims. They isolate score-order sensitivity.',
  '',
  ...report.protocol.limitations.map(x=>`- ${x}`),
  '', 'Read the [experiment guide](../docs/corroboration-experiment.md) for the frozen requirements and reproduction commands.',
  'Read the [compressed traces](corroboration-v1.jsonl.gz) for every rating, score, preference preview, and measurement.','');
writeFileSync(output,lines.join('\n'));console.log(output);
