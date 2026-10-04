import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
const path=`apps/dossier-cli/scripts/.impact-correction-regressions-${process.pid}.mjs`;
try {
 const source=readFileSync('apps/dossier-cli/scripts/refine-regressions.mjs','utf8')
  .replaceAll('refine-regression-v1','impact-correction-regression-v1')
  .replaceAll('dossier-refine-regression-','dossier-impact-regression-')
  .replaceAll('.refine-override-compatibility-','.impact-override-compatibility-');
 writeFileSync(path,source);
 const result=spawnSync(process.execPath,[path],{stdio:'inherit'});
 if(result.status!==0)throw new Error('Impact correction default regression failed');
}finally{rmSync(path,{force:true});}
