import { spawnSync } from 'node:child_process';
const args=process.argv.slice(2).filter(a=>a!=='--');
const run=(file,argv)=>{const result=spawnSync(process.execPath,[file,...argv],{stdio:'inherit'});if(result.status!==0)throw new Error(`Learning stability failed: ${file}`);};
run('apps/dossier-cli/scripts/learning-stability-run.mjs',args);
const output=args.includes('--output')?args[args.indexOf('--output')+1]:'reports/learning-stability-v1.json';
run('apps/dossier-cli/scripts/learning-stability-report.mjs',[output,output.replace(/\.json$/,'.md')]);
