import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
const referencePath='apps/dossier-cli/benchmarks/tmdb-study-v1-reference.json';
const reference=JSON.parse(readFileSync(referencePath));
for(const [path,expected] of Object.entries(reference.protectedFiles)) {
  if(createHash('sha256').update(readFileSync(path)).digest('hex')!==expected)throw new Error(`Frozen benchmark changed: ${path}`);
}
const flags=process.argv.slice(2);
const index=flags.indexOf('--output');
const output=index<0?'reports/tmdb-regression-current.json':flags[index+1];
if(!output || output==='reports/dossier-learning-study-tmdb.json')throw new Error('Choose a result path outside the frozen baseline');
if(flags.some((flag,i)=>i!==index&&i!==index+1))throw new Error('Use --output PATH; the fixture and reference stay frozen');
const result=spawnSync(process.execPath,['apps/dossier-cli/scripts/study-run.mjs','--fixture','apps/dossier-cli/src/lab/real-tmdb-v1.json','--reference',referencePath,'--output',output],{stdio:'inherit'});
process.exitCode=result.status??1;
