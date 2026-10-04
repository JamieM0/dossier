import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { random, key } from './hard-metrics.mjs';
const source = JSON.parse(readFileSync('apps/dossier-cli/src/lab/hard-v1.json'));
const next = random(20261003);
const genres = [...new Set(source.items.flatMap(item => item.genres))];
const tags = [...new Set(source.items.flatMap(item => item.keywords))];
const quantise = u => u >= 2.4 ? 3 : u >= 1.1 ? 2 : u >= .25 ? 1 : u <= -2.4 ? -3 : u <= -1.1 ? -2 : u <= -.25 ? -1 : 0;
const viewers = Array.from({length:72}, (_, index) => {
  const genreWeights = Object.fromEntries(genres.map(g => [g, (next()-.5)*4]));
  const tagWeights = Object.fromEntries(tags.map(t => [t, (next()-.5)*1.5]));
  const hiddenWeight = index % 3 === 0 ? .9 : .15;
  const eraWeight = (next()-.5)*2;
  const interaction = tags.slice(index % tags.length, index % tags.length + 2);
  const utilities = {}, ratings = {}, contexts = {}, recognition = {};
  for (const item of source.items) {
    const id = key(item), latent = source.latent[id];
    let u = item.genres.reduce((sum,g) => sum + genreWeights[g],0);
    u += item.keywords.reduce((sum,t) => sum + tagWeights[t],0);
    u += eraWeight * (item.year - 2002)/22;
    u += hiddenWeight * (latent.craft/5 - 1 + (latent.sincere ? .4 : -.4));
    if (interaction.length === 2 && interaction.every(t => item.keywords.includes(t))) u += index % 2 ? 1 : -1;
    u += (((item.id * 17 + index * 29) % 101)/100 - .5)*.12;
    utilities[id] = u; ratings[id] = quantise(u);
    contexts[id] = {solo:u, social:u + (item.keywords.includes('action') ? .7 : -.2)};
    recognition[id] = item.year < 2000 ? .8 : .55;
  }
  return {id:`refine-v2-${index+1}`, partition:index<48?'development':'sealed', genreWeights, tagWeights, hiddenWeight, interaction, eraWeight, utilities, ratings, contexts, recognition};
});
const fixture = {version:'hard-v2-refine', seed:20261003, items:source.items, trainingKeys:source.trainingKeys, holdoutKeys:source.holdoutKeys, viewers,
 notes:'Continuous utility is independent of the scorer. Hidden craft, interactions, contexts, and recognition stay in the evaluator. Refine tests use solo utility on already-rated titles.'};
writeFileSync('apps/dossier-cli/src/lab/hard-v2-refine.json', JSON.stringify(fixture)+'\n');
const sha = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const paths = {original:'real-tmdb-v1', confirmation:'new-viewers-v1', override:'override-viewers-v1', hard:'hard-v1', synthetic:'hard-v2-refine'};
const protocol = {version:'refine-signal-v1', hypothesis:'Within-bucket pairwise choices add useful information and improve user control.',
 fixtures:Object.fromEntries(Object.entries(paths).map(([cohort,name])=>[cohort,{path:`apps/dossier-cli/src/lab/${name}.json`,sha256:sha(`apps/dossier-cli/src/lab/${name}.json`)}])),
 generatorHash:sha('apps/dossier-cli/scripts/prepare-refine.mjs'),
 arms:['ratings_only','stored_noop','axis_metric','axis_cluster_metric'], seeds:[11,29,47,83], ratings:20, ratingControl:30, comparisons:[0,3,10,20], primaryComparisons:10,
 selection:'A candidate must pass every gate on recorded viewers and independently on sealed synthetic viewers; choose the largest recorded mean gain.',
 learning:{iterations:80,step:.12,temperature:.1,axisRegularisation:.15,clusterRegularisation:.3,minComparisons:3,minDistinctItems:4,axisBounds:[.25,4],clusterBounds:[.5,2]},
 pairPolicy:'Only non-neutral items in exactly the same stored rating bucket. Sort by increasing lens cosine, then stable item keys. Evaluator ties abstain; no oracle filtering before prompting. Exhaust available pairs to meet answer budget.',
 correction:'Reverse the tenth answered comparison with refine.correct; compare the corrected pair through suggest.list in an isolated replay. Measure score direction, strict ordering reversal, and collateral movement.',
 bootstrap:'Average four sessions within each viewer, then bootstrap viewers 5000 times. Report cohorts separately; synthetic and recorded viewers are never pooled.',
 gates:{minimumGain:.02,positiveLowerBound:0,worstDecileMinimumDelta:-.01,noiseWorstDecileMinimumDelta:-.01,correctionReversalRate:1,equalBudget:'Positive lower AUC or nDCG10 bound against 30 ratings at ten answered comparisons.'},
 privacy:'Remove public-score fields and evaluator truth before the CLI boundary. All arms use qualityWeight=0 and popularityBias=0. Candidate fit reads only features, ratings, stored comparisons, and taste clusters.',
 geometry:'Current greedy geometry. Experiment 1 rejected both deterministic candidates.',
 limits:['Recorded cohorts were evaluated before; they are regressions, not independent confirmation.','Recorded within-bucket stars differ only in extreme rating buckets; ties count as unanswered prompts.','hard-v1 contains no continuous truth: all within-bucket pairs abstain.','New synthetic sealed viewers provide independent synthetic confirmation only.','Ranking tests do not test retrieval.','Claims remain unchanged; metric confidence is not a calibrated probability.']};
writeFileSync('apps/dossier-cli/benchmarks/refine-signal-v1-protocol.json',JSON.stringify(protocol,null,2)+'\n');
console.log(JSON.stringify({viewers:viewers.length,fixtures:protocol.fixtures}));
