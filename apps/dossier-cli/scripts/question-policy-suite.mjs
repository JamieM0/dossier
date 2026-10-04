import { spawnSync } from 'node:child_process';
const args=process.argv.slice(2).filter(a=>a!=='--');
const run=(script,args)=>{const result=spawnSync(process.execPath,[script,...args],{stdio:'inherit'});if(result.status!==0)throw new Error(`Question experiment failed: ${script}`);};
run('apps/dossier-cli/scripts/question-policy-run.mjs',args);
const output=args.includes('--output')?args[args.indexOf('--output')+1]:'reports/question-policy-v1.json';
run('apps/dossier-cli/scripts/question-policy-report.mjs',[output,output.replace(/\.json$/,'.md')]);
