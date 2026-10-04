import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
const path=`apps/dossier-cli/scripts/.effective-correction-regressions-${process.pid}.mjs`;
try {
 const source=readFileSync('apps/dossier-cli/scripts/refine-regressions.mjs','utf8')
  .replaceAll('refine-regression-v1','effective-correction-regression-v1')
  .replaceAll('dossier-refine-regression-','dossier-effective-regression-')
  .replaceAll('.refine-override-compatibility-','.effective-override-compatibility-');
 writeFileSync(path,source);
 const result=spawnSync(process.execPath,[path],{stdio:'inherit'});
 if(result.status!==0)throw new Error('Effective correction default regression failed');
}finally{rmSync(path,{force:true});}
