import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { readCorroborationReport } from './corroboration-io.mjs';
import { average, key, round } from './hard-metrics.mjs';
import { meanInterval } from './real-metrics.mjs';
const reports=await Promise.all(['development','sealed','confirmation'].map(p=>readCorroborationReport(`reports/rating-influence-v1-${p}.jsonl.gz`)));
const fixture=JSON.parse(readFileSync(reports[0].protocol.fixture.path)),p=reports[0].protocol,points=v=>(100*v).toFixed(2);
function regionAccuracy(scores,truth,keys,region){
  let wins=0,pairs=0;
  for(const liked of keys.filter(k=>truth[k]>0))for(const disliked of keys.filter(k=>truth[k]<0))if(region.has(liked)||region.has(disliked)){
    const delta=(scores[liked]??0)-(scores[disliked]??0);wins+=delta>0?1:delta===0?.5:0;pairs++;
  }
  return {auc:pairs?wins/pairs:.5,pairs};
}
const diagnostics={};
for(const report of reports){
  const catalogue=new Map(fixture.catalogues[report.partition].map(i=>[key(i),i]));
  const novel=report.viewerResults.filter(v=>v.type==='novel_preference');
  const regionLearning=Object.fromEntries(p.arms.map(arm=>[arm,meanInterval(novel.map(v=>{
    const actor=fixture.viewers.find(a=>a.id===v.viewer),region=new Set(actor.holdoutKeys.filter(k=>catalogue.get(k).keywords.includes(actor.novelTag)));
    return average(v.sessions.map(s=>regionAccuracy(s.steps.at(-1).scores[arm],actor.ratings,actor.holdoutKeys,region).auc-regionAccuracy(s.steps[29].scores[arm],actor.ratings,actor.holdoutKeys,region).auc));
  }))]));
  const unaffectedLearning=Object.fromEntries(p.arms.map(arm=>[arm,meanInterval(novel.map(v=>{
    const actor=fixture.viewers.find(a=>a.id===v.viewer),keys=actor.holdoutKeys.filter(k=>!catalogue.get(k).keywords.includes(actor.novelTag));
    const all=new Set(keys);return average(v.sessions.map(s=>regionAccuracy(s.steps.at(-1).scores[arm],actor.ratings,keys,all).auc-regionAccuracy(s.steps[29].scores[arm],actor.ratings,keys,all).auc));
  }))]));
  const collisions=report.viewerResults.map(v=>{
    const actor=fixture.viewers.find(a=>a.id===v.viewer),items=actor.holdoutKeys.map(k=>catalogue.get(k));let metadataConflicts=0,vectorConflicts=0,pairs=0;
    const signature=i=>JSON.stringify([i.features,i.genres,i.keywords,i.year,i.runtime,i.collection,i.directorIds,i.creatorIds,i.voteAverage,i.popularity]);
    for(const liked of items.filter(i=>actor.ratings[key(i)]>0))for(const disliked of items.filter(i=>actor.ratings[key(i)]<0)){
      pairs++;if(JSON.stringify(liked.features)===JSON.stringify(disliked.features))vectorConflicts++;
      if(signature(liked)===signature(disliked))metadataConflicts++;
    }
    return {viewer:v.viewer,type:v.type,pairs,metadataConflicts,vectorConflicts,metadataTieCeiling:round(pairs?1-.5*metadataConflicts/pairs:1)};
  });
  diagnostics[report.partition]={regionLearning,unaffectedLearning,collisions};
}
writeFileSync('reports/rating-influence-v1-diagnostics.json',JSON.stringify(diagnostics,null,2)+'\n');
const lines=['# Rating influence adoption experiment','',
  'Retain current product defaults. No candidate passes synthetic selection or independent confirmation.',
  'The trial tests three demonstrated mechanisms with 220 fresh synthetic people and 440 sessions.',
  'Development contains 44 people. Selection and confirmation contain 88 people each, using separate catalogues.',
  'Every session supplies sixty ratings. Candidates, settings, evaluator, and requirements freeze before reserved evaluation.',
  'No tuning follows selection or confirmation. Jamie remains the only real product user.','',
  'Read the [mechanism report](rating-influence-mechanisms-v1.md) and [protocol guide](../docs/rating-influence-experiment.md).','',
  '## Average quality and immediate damage','',
  '| Cohort | Scorer | Final accuracy | Gain against current, points | Person interval, points | Worst update loss, points | Large-loss frequency |',
  '| --- | --- | ---: | ---: | --- | ---: | ---: |'];
for(const report of reports.slice(1))for(const arm of p.arms){const r=report.summary[arm];lines.push(`| ${report.partition==='sealed'?'Selection':'Confirmation'} | ${arm} | ${points(r.auc.mean)}% | ${points(r.gain.mean)} | ${points(r.gain.lower)} to ${points(r.gain.upper)} | ${points(-r.worstStep)} | ${points(r.largeLossRate)}% |`);}
lines.push('','Large losses exceed five ranking points after ten observations. Both endpoints use the same contemporaneous taste.',
  'Intervals resample people after averaging their two sessions. Update counts do not represent independent people.','',
  '## Direct comparison with matching controls','',
  '| Cohort | Candidate | Gain against timeless, points | Gain against recent, points |',
  '| --- | --- | ---: | ---: |');
for(const report of reports.slice(1))for(const arm of p.arms.slice(3)){const c=report.comparisons[arm];lines.push(`| ${report.partition} | ${arm} | ${points(c.local.mean)} | ${points(c.local_recent.mean)} |`);}
lines.push('','## Vulnerable groups','',
  '| Cohort | Group | Narrow gain | Exception gain | Additive gain |',
  '| --- | --- | ---: | ---: | ---: |');
for(const report of reports.slice(1))for(const [group,rows]of Object.entries(report.groups))lines.push(`| ${report.partition} | ${group} | ${points(rows.narrow_recent.gain.mean)} | ${points(rows.exception_recent.gain.mean)} | ${points(rows.additive_recent.gain.mean)} |`);
lines.push('','Group gains use ranking points against current scoring. The JSON summaries also contain each group interval and worst update.','',
  '## Learning and adaptation','',
  '| Cohort | Scorer | Novel-region learning, points | Unexposed-region change, points | Changing-taste final gain, points | Adaptation at forty, points |',
  '| --- | --- | ---: | ---: | ---: | ---: |');
for(const report of reports.slice(1))for(const arm of p.arms){const d=diagnostics[report.partition];lines.push(`| ${report.partition} | ${arm} | ${points(d.regionLearning[arm].mean)} | ${points(d.unaffectedLearning[arm].mean)} | ${points(report.groups.changing_taste[arm].gain.mean)} | ${points(report.summary[arm].adaptation40.mean)} |`);}
lines.push('','Novel-region learning measures ranking pairs involving the previously unobserved tag between observations thirty and sixty.',
  'Unexposed-region change measures pairs without that tag. Both measurements use unchanged contemporaneous taste.',
  'Changing-taste final gain compares final recommendations against the new taste; adaptation at forty measures earlier recovery.',
  'These measures distinguish useful new learning from stability purchased by ignoring new evidence.','',
  '## Worst failures and frozen gates','');
for(const report of reports.slice(1))for(const candidate of report.candidates){const w=report.learning[candidate.arm].worst;
  lines.push(`- ${report.partition}/${candidate.arm}: ${w.viewer}, seed ${w.seed}, observation ${w.count}, ${w.mistake?'mistaken':'accurate'} rating, loss ${points(-w.delta)} points.`,
    `  Failed requirements: ${Object.entries(candidate.gates).filter(([,v])=>!v).map(([k])=>k).join(', ')}.`);
}
lines.push('','Every candidate fails measured synthetic requirements independently of the pending legacy historical check.',
  'Five archived synthetic histories test historical mechanisms with the previous numerical protection thresholds.',
  'They do not replace the existing five historical real-data failures. Candidate protection on those histories remains unverified under the synthetic-only scope.',
  'That requirement remains mandatory before adoption. Existing product regressions check prior frozen outcomes without changing earlier records.','',
  '## Representation limits and verification','',
  'The [diagnostic record](rating-influence-v1-diagnostics.json) lists feature collisions, full metadata collisions, and novel-region intervals.',
  'Opposite preferences on identical non-identity metadata require unavailable information for unseen titles.',
  'Narrow matching cannot separate those titles. Feature collisions with different metadata can instead indicate information lost by the representation.',
  'Missing-factor outcomes remain in the overall averages and group requirements.','');
for(const report of reports){const verification=JSON.parse(readFileSync(`reports/rating-influence-v1-${report.partition}-verification.json`));assert(verification.independentAuditPassed);
  lines.push(`- [${report.partition} trace manifest](rating-influence-v1-${report.partition}.json) and [independent verification](rating-influence-v1-${report.partition}-verification.json).`);}
const regression=JSON.parse(readFileSync('reports/rating-influence-regression-v1.json'));assert(regression.passed);
lines.push('- [Unchanged default regressions](rating-influence-regression-v1.json).','',
  'Independent reconstruction reproduces every supplied rating, published score, ranking measurement, ordering check, and adoption decision.',
  'Encrypted round trips, overwrite, removal, original timestamps, read-only scoring, and candidate restoration pass.',
  'The current scorer retains its known storage-order and restoration sensitivity. Candidate verification does not conceal that baseline limitation.',
  'No candidate enters the shared domain scorer. No new baseline replaces the preserved corroboration records.','',
  '## Next bounded investigation','',
  'Test a representation that distinguishes relevant preferences among close metadata matches before adding further evidence guards.',
  'Use synthetic matched pairs with one public distinguishing signal, plus pairs whose difference remains private.',
  'Measure accurate novel learning and damage to existing preferences separately, including claim-only and matching-only replays.',
  'Develop the representation on fresh development people, then freeze any candidate before another independent adoption trial.',
  'Keep question selection and shared contexts deferred.','');
writeFileSync('reports/rating-influence-v1.md',lines.join('\n'));console.log('Wrote rating-influence-v1.md and synthetic diagnostics.');
