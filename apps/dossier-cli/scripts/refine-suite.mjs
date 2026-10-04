import { spawnSync } from 'node:child_process';
const args=process.argv.slice(2).filter(arg=>arg!=='--');
const result=spawnSync(process.execPath,['apps/dossier-cli/scripts/refine-run.mjs',...args],{stdio:'inherit'});
if(result.status!==0)throw new Error('Refine experiment failed');
const output=args.includes('--output')?args[args.indexOf('--output')+1]:'reports/refine-signal-v1.json';
const rendered=spawnSync(process.execPath,['apps/dossier-cli/scripts/refine-report.mjs',output,output.replace(/\.json$/,'.md')],{stdio:'inherit'});
if(rendered.status!==0)throw new Error('Refine report failed');
