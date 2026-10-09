import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
const run=(file,args=[])=>{const r=spawnSync(process.execPath,[file,...args],{stdio:'inherit'});if(r.status!==0)throw new Error(`Rating influence failed: ${file}`);};
const runner='apps/dossier-cli/scripts/rating-influence-run.mjs',audit='apps/dossier-cli/scripts/rating-influence.check.mjs';
if(!existsSync('apps/dossier-cli/src/lab/rating-influence-v1.json'))run('apps/dossier-cli/scripts/prepare-rating-influence.mjs');
if(!existsSync('reports/rating-influence-mechanisms-v1.json'))run('apps/dossier-cli/scripts/rating-influence-diagnosis.mjs');
for(const partition of ['development','sealed','confirmation']){
  if(partition==='sealed'&&!existsSync('apps/dossier-cli/benchmarks/rating-influence-v1-reference.json'))run(runner,['--freeze']);
  if(!existsSync(`reports/rating-influence-v1-${partition}.json`))run(runner,['--partition',partition]);
  run(audit,['--report',`reports/rating-influence-v1-${partition}.jsonl.gz`]);
}
if(!existsSync('reports/rating-influence-regression-v1.json'))run('apps/dossier-cli/scripts/rating-influence-regressions.mjs');
run('apps/dossier-cli/scripts/rating-influence-report.mjs');
