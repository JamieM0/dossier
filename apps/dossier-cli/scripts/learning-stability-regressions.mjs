import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
const path=`apps/dossier-cli/scripts/.learning-stability-regressions-${process.pid}.mjs`;
try {
 const source=readFileSync('apps/dossier-cli/scripts/refine-regressions.mjs','utf8')
  .replaceAll('refine-regression-v1','learning-stability-regression-v1')
  .replaceAll('dossier-refine-regression-','dossier-learning-stability-regression-')
  .replaceAll('.refine-override-compatibility-','.learning-stability-override-compatibility-');
 writeFileSync(path,source);
 const result=spawnSync(process.execPath,[path],{stdio:'inherit'});
 if(result.status!==0)throw new Error('Learning stability default regression failed');
}finally{rmSync(path,{force:true});}
