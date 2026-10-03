import { readFileSync,writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { average,round } from './hard-metrics.mjs';
import { meanInterval } from './real-metrics.mjs';
import { renderConfirmationHtml } from './confirmation-html.mjs';

const flags=process.argv.slice(2);
if(!flags.includes('--reuse-results'))for(const script of ['confirmation-run.mjs','backwards-diagnosis.mjs']){
  const result=spawnSync(process.execPath,[`apps/dossier-cli/scripts/${script}`],{stdio:['ignore','ignore','inherit']});
  if(result.status!==0)throw new Error(`${script} failed`);
}
const confirmation=JSON.parse(readFileSync('reports/reviews-plus-tags-confirmation-v1.json'));
const diagnosis=JSON.parse(readFileSync('reports/backwards-learning-diagnosis-v1.json'));
const rows=confirmation.viewers.map(row=>({id:row.id,highRisk:row.highRisk,deltaAuc:round(row.after[20].candidate.auc-row.after[20].dossier.auc),deltaTop10:round(row.after[20].candidate.precision10-row.after[20].dossier.precision10)}));
const subset=rows.filter(row=>row.highRisk);
confirmation.comparisonToCurrent={gain:meanInterval(rows.map(row=>row.deltaAuc)),highRiskGain:meanInterval(subset.map(row=>row.deltaAuc)),
  materialRegressions:rows.filter(row=>row.deltaAuc<-.03),highRiskRegressions:subset.filter(row=>row.deltaAuc<-.03)};
const verificationFile='/tmp/dossier-confirmation-verification.json';
let verification={repeatChecked:false};
if(flags.includes('--verified'))verification=JSON.parse(readFileSync(verificationFile));
const report={version:'confirmation-executive-v1',confirmation,diagnosis,verification};
writeFileSync('reports/reviews-plus-tags-decision.json',JSON.stringify(report,null,2)+'\n');
writeFileSync('reports/reviews-plus-tags-decision.html',renderConfirmationHtml(report));
process.stdout.write(JSON.stringify({html:'reports/reviews-plus-tags-decision.html',decision:confirmation.decision,gain:confirmation.overall.gainAuc,comparisonToCurrent:confirmation.comparisonToCurrent})+'\n');
