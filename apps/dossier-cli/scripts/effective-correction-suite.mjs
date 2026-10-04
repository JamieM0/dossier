import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
const args=process.argv.slice(2).filter(a=>a!=='--');
const run=(script,argv)=>{const result=spawnSync(process.execPath,[script,...argv],{stdio:'inherit'});if(result.status!==0)throw new Error(`Effective correction failed: ${script}`);};
run('apps/dossier-cli/scripts/effective-correction-run.mjs',args);
const output=args.includes('--output')?args[args.indexOf('--output')+1]:'reports/effective-correction-v1.json';
writeFileSync(output+'.gz',gzipSync(readFileSync(output),{level:9}));
run('apps/dossier-cli/scripts/effective-correction-report.mjs',[output,output.replace(/\.json$/,'.md')]);
