import { readFileSync, writeFileSync } from 'node:fs';
const source=process.argv[2]??'reports/contextual-taste-v1.json',output=process.argv[3]??source.replace(/\.json$/,'.md');
const r=JSON.parse(readFileSync(source)),pct=n=>n===null?'unavailable':(n*100).toFixed(2),interval=i=>`${pct(i.mean)} [${pct(i.lower)}, ${pct(i.upper)}]`;
const lines=['# Experiment 5: contextual taste','',`Decision: **${r.decision.status}**. ${r.decision.reason}`,'',
 `The CLI replay covers ${r.viewers} people and ${r.sessions} sessions. Repeated sessions average within each person before bootstrap uncertainty estimates.`,
 '',`Protocol: \`${r.version}\`. Model fingerprint: \`${r.modelFingerprint}\`.`,
 '', '## Compare context ranking','', 'AUC measures positive-versus-negative held-out ordering. Context results average four contexts within each person. Values use percentage points.','',
 '| Cohort | People | Global | Recency | Separate | Shared | Shared gain over global, 95% interval |','| --- | --- | --- | --- | --- | --- | --- |'];
for(const [name,c]of Object.entries(r.cohorts)) {const l=c.learning[20];lines.push(`| ${name} | ${c.viewers} | ${pct(l.global.auc.mean)} | ${pct(l.recency.auc.mean)} | ${pct(l.separate.auc.mean)} | ${pct(l.shared.auc.mean)} | ${interval(l.shared.gainOverGlobal)} |`);}
lines.push('','## Compare mechanisms','','Mechanism summaries pool fresh development and sealed people. They explain behavior without providing separate confirmation.','',
 '| Type | People | Global | Recency | Separate | Shared | Shared gain over separate, 95% interval |','| --- | --- | --- | --- | --- | --- | --- |');
for(const [name,c]of Object.entries(r.typeResults)){const l=c.learning[20];lines.push(`| ${name} | ${c.viewers} | ${pct(l.global.auc.mean)} | ${pct(l.recency.auc.mean)} | ${pct(l.separate.auc.mean)} | ${pct(l.shared.auc.mean)} | ${interval(l.shared.gainOverSeparate)} |`);}
lines.push('','## Inspect confirmation gates','','Each fresh sealed domain must pass every gate. Failed gates retain the candidate as an experiment.','',
 '| Gate | Movies | Books |','| --- | --- | --- |');
for(const gate of new Set(Object.values(r.candidateGates).flatMap(g=>Object.keys(g))))lines.push(`| ${gate} | ${r.candidateGates.movies?.[gate]??'unavailable'} | ${r.candidateGates.books?.[gate]??'unavailable'} |`);
lines.push('','## Inspect learning and protection','','These checkpoints count ratings per context. Sparse people can supply fewer ratings; terminal profiles remain at later checkpoints.','',
 '| Cohort | Ratings per context | Shared AUC | nDCG@10 | Shared p10 | Individual losses against global |','| --- | --- | --- | --- | --- | --- |');
for(const name of ['synthetic_movies_sealed','synthetic_books_sealed'])if(r.cohorts[name])for(const budget of r.protocol.budgets){const l=r.cohorts[name].learning[budget].shared;lines.push(`| ${name} | ${budget} | ${pct(l.auc.mean)} | ${pct(l.ndcg10.mean)} | ${pct(l.auc.p10)} | ${l.individualLosses} |`);}
lines.push('','## Inspect user control','','Claims carry explicit global or context scope. Confidence remains an uncalibrated claim proxy. Recommendation evidence reports no probability.','',
 '| Cohort | Largest single-rating decline | Directional corrections | Scoped claim precision | Export/import | Scope isolation |','| --- | --- | --- | --- | --- | --- |');
for(const name of ['synthetic_movies_sealed','synthetic_books_sealed'])if(r.cohorts[name]){const c=r.cohorts[name];lines.push(`| ${name} | ${pct(c.worstSingleRatingDelta)} | ${c.corrections.directional}/${c.corrections.tested} | ${pct(c.claimPrecision)} | ${c.contracts.roundtrip} | ${c.contracts.scopeIsolation} |`);}
lines.push('','## Preserve evidence limits','',...r.protocol.limits.map(l=>`- ${l}`),'',
 'Shared taste uses explicitly global ratings as its base. Context ratings change only their own residual and scoped claims.',
 '', 'A new context inherits the shared base. Separate profiles provide no recommendations before they contain a positive rating.',
 '', 'The residual uses ridge regression over the existing axes. It does not add the rejected geometry, Refine, question, or personal-lens candidates.',
 '', 'Public scores remain absent from every experimental scoring arm. Recorded people provide no-context regression evidence only.',
 '', 'Read the JSON for every checkpoint, supplied rating, claim, correction, and portability result. Product defaults remain unchanged.','');
writeFileSync(output,lines.join('\n'));console.log(JSON.stringify({output,decision:r.decision.status}));
