import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { featureVector } from '@dossier/domain';
import { execute } from '../dist/actions.js';
import { key, shuffled, average } from './hard-metrics.mjs';
import { pairAccuracy } from './corroboration-ranking.mjs';

const fixture = JSON.parse(readFileSync('apps/dossier-cli/src/lab/real-tmdb-v1.json'));
const reference = JSON.parse(readFileSync('reports/backwards-learning-diagnosis-v1.json'));
const items = fixture.items.map(({ source: _source, ...item }) => ({ ...item, features: featureVector(item) }));
const byKey = new Map(items.map(item => [key(item), item]));
const arms = ['current', 'axes', 'descriptive', 'comparisons'];
const results = [];
let actions = 0;
for (const target of reference.cases) {
  const viewer = fixture.viewers.find(v => v.id === target.viewer);
  const training = new Map(viewer.trainingRatings.map(row => [row.filmKey, row.rating]));
  const truth = Object.fromEntries(viewer.heldOutRatings.map(row => [row.filmKey, row.rating]));
  const hidden = Object.keys(truth);
  const catalogue = { detail: async (medium, id) => byKey.get(`${medium}:${id}`), candidates: async medium => hidden.map(k => byKey.get(k)).filter(i => i.medium === medium) };
  let vault = { activeId: null, profiles: [] };
  const storage = { root: '/offline-learned-history', load: () => vault, save: next => { vault = next; }, audit: () => {} };
  const call = (action, args = {}) => { actions++; return execute(storage, action, args, catalogue); };
  let revision = (await call('profile.create', { name: target.viewer })).revision;
  const order = shuffled([...training.keys()], target.seed + viewer.sourceUserId * 1009);
  const steps = [];
  for (let count = 1; count <= 40; count++) {
    const id = order[count - 1];
    assert(!hidden.includes(id));
    revision = (await call('rate.set', { key: id, value: training.get(id), expectedRevision: revision })).revision;
    const measures = {};
    for (const arm of arms) {
      const scores = {};
      for (const medium of ['movie', 'tv']) {
        const result = await call('suggest.list', { medium, limit: 200, ...(arm === 'current' ? {} : { learnedTaste: arm }) });
        for (const row of result.items) scores[row.id] = row.score;
      }
      measures[arm] = pairAccuracy(scores, truth, hidden);
    }
    steps.push({ count, measures });
  }
  assert.equal(steps[9].measures.current, target.auc10);
  assert.equal(steps[39].measures.current, target.auc40);
  const summary = Object.fromEntries(arms.map(arm => [arm, { auc10: steps[9].measures[arm], auc40: steps[39].measures[arm],
    totalChange: steps[39].measures[arm] - steps[9].measures[arm], gain: steps[39].measures[arm] - steps[39].measures.current,
    largestUpdateLoss: Math.min(...steps.slice(10).map((step, i) => step.measures[arm] - steps[i + 9].measures[arm])) }]));
  results.push({ viewer: target.viewer, seed: target.seed, summary, steps });
}
const summary = Object.fromEntries(arms.map(arm => [arm, { meanFinalGain: average(results.map(r => r.summary[arm].gain)),
  largestUpdateLoss: Math.min(...results.map(r => r.summary[arm].largestUpdateLoss)) }]));
const report = { version: 'learned-taste-historical-v1', actions, summary, results };
const output = 'reports/learned-taste-v1-historical.json';
writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ output, actions, summary, cases: results.map(r => ({ viewer: r.viewer, summary: r.summary })) }));
