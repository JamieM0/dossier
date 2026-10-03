import { readFileSync,writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { featureVector } from '@dossier/domain';
import { decideOverride } from './override-guard-v1.mjs';
const report=JSON.parse(readFileSync('reports/observed-rating-override-v1.json'));
const fixture=JSON.parse(readFileSync('apps/dossier-cli/src/lab/real-tmdb-v1.json'));
const items=new Map(fixture.items.map(({source,...item})=>[`${item.medium}:${item.id}`,{...item,key:`${item.medium}:${item.id}`,features:featureVector(item)}]));
let decisionChecks=0;
for(const s of report.sessions)for(const count of [20,40]) {
  // Only public film details and supplied evidence enter this decision replay.
  const observed=s.observed.slice(0,count).map(row=>({item:items.get(row.filmKey),rating:row.suppliedRating,ts:0}));
  const {comparisons,...decision}=decideOverride(observed);
  assert.deepEqual(decision,s.snapshots[count].decision);
  decisionChecks++;
}
const path='reports/observed-rating-override-verification-v1.json';
const verified=JSON.parse(readFileSync(path));
verified.observedOnlyDecisionChecks=decisionChecks;
writeFileSync(path,JSON.stringify(verified,null,2)+'\n');
process.stdout.write(JSON.stringify({observedOnlyDecisionChecks:decisionChecks})+'\n');
