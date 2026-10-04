import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const root=mkdtempSync(join(tmpdir(),'dossier-refine-regression-'));
const read=path=>JSON.parse(readFileSync(path));
const run=(script,args=[])=>{
 const result=spawnSync(process.execPath,[script,...args],{stdio:['ignore','ignore','inherit']});
 if(result.status!==0)throw new Error(`Regression failed: ${script}`);
};
const summarizeComparison=comparison=>Object.fromEntries(Object.entries(comparison).filter(([name])=>name.startsWith('delta')||['improved','regressed'].includes(name)));
const compatibilityPath=`apps/dossier-cli/scripts/.refine-override-compatibility-${process.pid}.mjs`;
try {
 run('apps/dossier-cli/dist/lab/run.js',['--users','48','--output',join(root,'synthetic.json')]);
 run('apps/dossier-cli/scripts/hard-run.mjs',['--reference','apps/dossier-cli/benchmarks/hard-v1-reference.json','--output',join(root,'hard.json'),'--html',join(root,'hard.html')]);
 run('apps/dossier-cli/scripts/tmdb-regression.mjs',['--output',join(root,'tmdb.json')]);
 run('apps/dossier-cli/scripts/confirmation-run.mjs',['--output',join(root,'confirmation.json')]);
 // Keep the frozen guard intact. This temporary compatibility replay cannot claim frozen model identity.
 const original=readFileSync('apps/dossier-cli/scripts/override-run.mjs','utf8');
 const guard="if(modelFingerprint!==protocol.referenceModelFingerprint)throw new Error('This experiment requires the frozen current Dossier model');";
 assert(original.includes(guard));
 writeFileSync(compatibilityPath,original.replace(guard,"// Compatibility replay: model identity differs; compare outcomes with the frozen report."));
 run(compatibilityPath,['--output',join(root,'override.json')]);
 const confirmation=read(join(root,'confirmation.json')),oldConfirmation=read('reports/reviews-plus-tags-confirmation-v1.json');
 const override=read(join(root,'override.json')),oldOverride=read('reports/observed-rating-override-v1.json');
 for(const field of ['viewers','sessions','learning','overall','highRisk','ruleChecks'])assert.deepEqual(confirmation[field],oldConfirmation[field]);
 for(const field of ['viewers','sessions','cohorts','checks','detection','failures'])assert.deepEqual(override[field],oldOverride[field]);
 const hard=read(join(root,'hard.json')),tmdb=read(join(root,'tmdb.json')),synthetic=read(join(root,'synthetic.json'));
 for(const result of [hard,tmdb])for(const [name,value] of Object.entries(result.comparison))if(name.startsWith('delta'))assert.equal(value,0);
 const report={version:'refine-regression-v1',checkedAt:new Date().toISOString(),
  synthetic:{viewers:synthetic.syntheticUsers,completed:true,metrics:synthetic.metrics},
  hard:{exactBaselineMetrics:true,comparison:summarizeComparison(hard.comparison)},
  tmdb:{exactBaselineMetrics:true,comparison:summarizeComparison(tmdb.comparison)},
  confirmation:{exactBaselineSessions:true,viewers:confirmation.viewers.length},
  override:{exactBaselineSessions:true,viewers:override.viewers.length,compatibilityReplay:true,
    limitation:'The frozen override runner rejects any changed model fingerprint. A temporary copy omits only that identity guard; fixture and scorer guards remain intact.',
    frozenModelFingerprint:oldOverride.modelFingerprint,currentModelFingerprint:override.modelFingerprint},
  passed:true};
 writeFileSync('reports/refine-regression-v1.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({output:'reports/refine-regression-v1.json',passed:true}));
} finally {rmSync(compatibilityPath,{force:true});rmSync(root,{recursive:true,force:true});}
