import { spawnSync } from 'node:child_process';
const args=process.argv.slice(2).filter(a=>a!=='--');
const run=(script,argv)=>{const result=spawnSync(process.execPath,[script,...argv],{stdio:'inherit'});if(result.status!==0)throw new Error(`Personal lens experiment failed: ${script}`);};
run('apps/dossier-cli/scripts/personal-lens-run.mjs',args);
const output=args.includes('--output')?args[args.indexOf('--output')+1]:'reports/personal-lens-v1.json';
run('apps/dossier-cli/scripts/personal-lens-report.mjs',[output,output.replace(/\.json$/,'.md')]);
