import { readFileSync,writeFileSync,existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { renderOverrideHtml } from './override-html.mjs';
if(!process.argv.includes('--reuse-results')) {
  const result=spawnSync(process.execPath,['apps/dossier-cli/scripts/override-run.mjs'],{stdio:['ignore','ignore','inherit']});
  if(result.status!==0)throw new Error('Override experiment failed');
}
const report=JSON.parse(readFileSync('reports/observed-rating-override-v1.json'));
const verificationPath='reports/observed-rating-override-verification-v1.json';
if(existsSync(verificationPath)) {
  const verification=JSON.parse(readFileSync(verificationPath));
  // Attach verification only when it covers these exact session results.
  const { createHash }=await import('node:crypto');
  const hash=createHash('sha256').update(readFileSync('reports/observed-rating-override-v1.json')).digest('hex');
  if(hash===verification.resultsHash)Object.assign(report.verification,verification);
}
writeFileSync('reports/observed-rating-override-decision-v1.json',JSON.stringify(report,null,2)+'\n');
writeFileSync('reports/observed-rating-override-v1.html',renderOverrideHtml(report));
process.stdout.write(JSON.stringify({html:'reports/observed-rating-override-v1.html',demonstrated:report.demonstrated,checks:report.checks})+'\n');
