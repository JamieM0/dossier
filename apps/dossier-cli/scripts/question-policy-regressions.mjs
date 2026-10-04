import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const path=`apps/dossier-cli/scripts/.question-regressions-${process.pid}.mjs`;
try {
 const source=readFileSync('apps/dossier-cli/scripts/refine-regressions.mjs','utf8');
 writeFileSync(path,source.replaceAll('reports/refine-regression-v1.json','reports/question-policy-regression-v1.json').replaceAll("version:'refine-regression-v1'","version:'question-policy-regression-v1'"));
 const result=spawnSync(process.execPath,[path],{stdio:'inherit'});
 if(result.status!==0)throw new Error('Default behavior regression failed');
}finally{rmSync(path,{force:true});}
