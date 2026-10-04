import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
const path=`apps/dossier-cli/scripts/.personal-lens45-regressions-${process.pid}.mjs`;
try {
 const source=readFileSync('apps/dossier-cli/scripts/refine-regressions.mjs','utf8')
  .replaceAll('refine-regression-v1','personal-lens-45-regression-v1')
  .replaceAll('dossier-refine-regression-','dossier-personal-lens45-regression-')
  .replaceAll('.refine-override-compatibility-','.personal-lens45-override-compatibility-');
 writeFileSync(path,source);
 const result=spawnSync(process.execPath,[path],{stdio:'inherit'});
 if(result.status!==0)throw new Error('Experiment 4.5 default regression failed');
}finally{rmSync(path,{force:true});}
