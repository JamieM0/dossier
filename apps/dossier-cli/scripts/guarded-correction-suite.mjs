import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
const args=process.argv.slice(2).filter(a=>a!=='--');
const run=(script,argv)=>{const r=spawnSync(process.execPath,[script,...argv],{stdio:'inherit'});if(r.status!==0)throw new Error(`Guarded correction failed: ${script}`);};
run('apps/dossier-cli/scripts/guarded-correction-run.mjs',args);
const output=args.includes('--output')?args[args.indexOf('--output')+1]:'reports/guarded-correction-v1.json';
writeFileSync(output+'.gz',gzipSync(readFileSync(output),{level:9}));
run('apps/dossier-cli/scripts/guarded-correction-report.mjs',[output,output.replace(/\.json$/,'.md')]);
