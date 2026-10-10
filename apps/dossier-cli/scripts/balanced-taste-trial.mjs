import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { featureVector, BALANCED_TASTE_CONFIG } from '@dossier/domain';
import { execute } from '../dist/actions.js';
import { random, shuffled, key, average } from './hard-metrics.mjs';
import { pairAccuracy } from './corroboration-ranking.mjs';
import { meanInterval } from './real-metrics.mjs';

const args = process.argv.slice(2);
const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const partition = option('--partition', 'development');
assert(['development', 'selection', 'confirmation'].includes(partition));
const root = 'apps/dossier-cli/benchmarks/learned-taste-v2';
const fixturePath = `${root}-fixture.json`, referencePath = `${root}-reference.json`;
const output = option('--output', `reports/learned-taste-v2-${partition}.json`);
const arms = ['current', 'balanced_descriptive', 'balanced_comparisons'];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const sources = ['packages/domain/src/learned-taste.ts', 'packages/domain/src/balanced-taste.ts', 'packages/domain/src/lens.ts', 'packages/domain/src/recommender.ts',
  'packages/domain/src/taste-space.ts', 'packages/domain/src/taste-claims.ts', 'packages/domain/src/application.ts',
  'packages/domain/src/store/model.ts', 'apps/dossier-cli/src/actions.ts', 'apps/dossier-cli/scripts/hard-metrics.mjs',
  'apps/dossier-cli/scripts/corroboration-ranking.mjs', 'apps/dossier-cli/scripts/real-metrics.mjs', 'apps/dossier-cli/scripts/balanced-taste-trial.mjs'];
const sourceHashes = () => Object.fromEntries(sources.map(path => [path, hash(readFileSync(path))]));
const initialSources = sourceHashes();
if (args.includes('--prepare')) {
  assert(!existsSync(fixturePath), 'Do not replace prepared inputs');
  const genres = ['Drama', 'Comedy', 'Action', 'Science Fiction', 'Thriller'];
  const tags = ['heist', 'small town', 'space opera', 'revenge', 'ensemble', 'coming of age', 'non-linear', 'grief', 'survival', 'satire'];
  const types = ['axes', 'tag', 'interaction', 'split_tastes', 'missing_factor', 'mistake', 'weak', 'changing', 'novel', 'duplicates'];
  const catalogues = {}, people = [];
  for (const [index, part] of ['development', 'selection', 'confirmation'].entries()) {
    const rng = random(261011970 + index * 100);
    const items = Array.from({ length: 160 }, (_, i) => {
      const raw = { id: 9900000 + index * 1000 + i, medium: 'movie', title: `Learning ${part} ${i}`, year: 1980 + i % 40,
        posterPath: null, genres: shuffled(genres, Math.floor(rng() * 1e8)).slice(0, 1 + i % 2), genreIds: [],
        keywords: shuffled(tags, Math.floor(rng() * 1e8)).slice(0, 2 + i % 2), overview: '', runtime: 100,
        collection: null, directorIds: [], creatorIds: [], voteAverage: 5 + rng() * 4, voteCount: 500, popularity: 20 };
      return { ...raw, features: featureVector(raw) };
    });
    for (let i = 0; i < 8; i++) items[70 + i] = { ...structuredClone(items[69]), id: items[70 + i].id, title: items[70 + i].title };
    catalogues[part] = items;
    for (const type of types) for (let person = 0; person < (part === 'development' ? 3 : 6); person++) {
      const seed = Math.floor(rng() * 1e8), r = random(seed);
      const axes = shuffled(['pacing', 'tone', 'complexity', 'scope', 'character_focus'], seed).slice(0, 3);
      const signs = axes.map(() => r() < .5 ? -1 : 1), tag = tags[Math.floor(r() * tags.length)];
      const craft = Object.fromEntries(items.map(i => [key(i), (r() - .5) * 1.4]));
      const utility = (item, old = false) => {
        if (type === 'missing_factor') return craft[key(item)] * 5;
        let u = 2 * signs[0] * (old ? -1 : 1) * item.features[axes[0]] + 1.2 * signs[1] * item.features[axes[1]] + .8 * signs[2] * item.features[axes[2]];
        if (type === 'tag' || type === 'novel') u += Number(item.keywords.includes(tag)) * 3 * signs[2];
        if (type === 'interaction') u += Number(item.keywords.includes(tag) && item.genres.includes('Drama')) * 3 * signs[2];
        if (type === 'split_tastes') u = 2 * Math.abs(item.features[axes[0]]) + signs[1] * item.features[axes[1]];
        return u + craft[key(item)];
      };
      const center = old => items.map(i => utility(i, old)).sort((a,b) => a-b)[80];
      const currentCenter = center(false), oldCenter = center(true);
      const rating = u => Math.abs(u) < .15 ? 0 : Math.sign(u) * (type === 'weak' ? 1 : Math.abs(u) > 1.3 ? 3 : 2);
      people.push({ id: `${part}-${type}-${person}`, partition: part, type, seed, tag,
        ratings: Object.fromEntries(items.map(i => [key(i), rating(utility(i) - currentCenter)])),
        oldRatings: Object.fromEntries(items.map(i => [key(i), rating(utility(i, true) - oldCenter)])),
        utility: Object.fromEntries(items.map(i => [key(i), utility(i)])) });
    }
  }
  writeFileSync(fixturePath, JSON.stringify({ version: 'learned-taste-v2', catalogues, people }, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ fixturePath, people: people.length }));
  process.exit(0);
}
if (args.includes('--freeze')) {
  assert(!existsSync(referencePath));
  const developmentPath = option('--development', 'reports/learned-taste-v2-development-corrected.json');
  const development = JSON.parse(readFileSync(developmentPath));
  assert.deepEqual(development.config, BALANCED_TASTE_CONFIG);
  writeFileSync(referencePath, JSON.stringify({ sources: sourceHashes(), fixture: hash(readFileSync(fixturePath)), config: BALANCED_TASTE_CONFIG,
    arms, developmentPath, development: hash(readFileSync(developmentPath)),
    requirements: { minimumMeanGain: .02, positiveInterval: true, minimumWorstTenthDelta: -.02, minimumGroupDelta: -.03, missingFactorDelta: -.05,
      updateLossFrequency: 'No more frequent than current after ten ratings', maximumUpdateLoss: 'No worse than current',
      learning: 'Preserve explicit ratings and learn corrected comparisons; no public-weight increase',
      confirmation: 'Same frozen method must pass two fresh cohorts; historical failures remain visible' } }, null, 2) + '\n', { flag: 'wx' });
  console.log('Frozen candidate sources, inputs, settings and adoption requirements.');
  process.exit(0);
}
const fixture = JSON.parse(readFileSync(fixturePath));
if (partition !== 'development') {
  const reference = JSON.parse(readFileSync(referencePath));
  assert.deepEqual(sourceHashes(), reference.sources);
  assert.equal(hash(readFileSync(fixturePath)), reference.fixture);
  assert.deepEqual(BALANCED_TASTE_CONFIG, reference.config);
}
assert(!existsSync(output), 'Do not overwrite completed results');
const items = fixture.catalogues[partition], byKey = new Map(items.map(i => [key(i), i]));
const results = [];
let actionCount = 0;
for (const [personIndex, person] of fixture.people.filter(p => p.partition === partition).entries()) {
  const sessions = [];
  for (const seed of [43, 101]) {
    let vault = { activeId: null, profiles: [] };
    const storage = { root: '/offline-learned-taste', load: () => vault, save: next => { vault = next; }, audit: () => {} };
    const pool = items.slice(100), hidden = pool.map(key);
    const catalogue = { detail: async (medium, id) => byKey.get(`${medium}:${id}`), candidates: async () => pool };
    const call = async (action, args = {}) => { actionCount++; return execute(storage, action, args, catalogue); };
    let revision = (await call('profile.create', { name: person.id })).revision;
    let training = shuffled(items.slice(0, 100), person.seed + seed);
    if (person.type === 'novel') {
      const familiar = training.filter(i => !i.keywords.includes(person.tag));
      training = [...familiar.slice(0, 30), ...training.filter(i => i.keywords.includes(person.tag)), ...familiar.slice(30)];
    }
    if (person.type === 'duplicates') training = [...training.filter(i => i.id % 1000 >= 70 && i.id % 1000 < 78), ...training.filter(i => !(i.id % 1000 >= 70 && i.id % 1000 < 78))];
    const steps = [];
    for (let count = 1; count <= 60; count++) {
      const item = training[count - 1];
      const truth = person.type === 'changing' && count <= 30 ? person.oldRatings : person.ratings;
      const rating = person.type === 'mistake' && count === 14 ? -truth[key(item)] : truth[key(item)];
      revision = (await call('rate.set', { key: key(item), value: rating, expectedRevision: revision })).revision;
      // Answers reveal an actual personal ordering among observed titles.
      // Hidden recommendation labels never enter a comparison.
      if (count > 10 && count % 4 === 0 && person.type !== 'changing') {
        const earlier = training[count - 6];
        const [winner, loser] = person.utility[key(item)] >= person.utility[key(earlier)] ? [item, earlier] : [earlier, item];
        revision = (await call('refine.choose', { winner: key(winner), loser: key(loser), expectedRevision: revision })).revision;
      }
      const measures = {}, scores = {};
      for (const arm of arms) {
        const result = await call('suggest.list', { limit: 200, ...(arm === 'current' ? {} : { learnedTaste: arm }) });
        scores[arm] = Object.fromEntries(result.items.map(row => [row.id, row.score]));
        measures[arm] = pairAccuracy(scores[arm], truth, hidden);
      }
      const before = steps.at(-1);
      const deltas = Object.fromEntries(arms.map(arm => [arm, before ? measures[arm] - pairAccuracy(before.scores[arm], truth, hidden) : 0]));
      steps.push({ count, key: key(item), rating, measures, scores, deltas });
    }
    sessions.push({ seed, steps });
  }
  results.push({ id: person.id, type: person.type, sessions });
  if (personIndex % 5 === 0) process.stderr.write(`${partition}: ${personIndex + 1} people\n`);
}
const personMeans = arm => results.map(p => average(p.sessions.map(s => s.steps.at(-1).measures[arm])));
const current = personMeans('current');
const summary = Object.fromEntries(arms.map(arm => {
  const final = personMeans(arm), updates = results.flatMap(p => p.sessions.flatMap(s => s.steps.slice(10).map(step => step.deltas[arm])));
  const groups = Object.fromEntries([...new Set(results.map(p => p.type))].map(type => [type, average(results.filter(p => p.type === type).map(p => average(p.sessions.map(s => s.steps.at(-1).measures[arm] - s.steps.at(-1).measures.current))))]));
  return [arm, { auc: average(final), gain: meanInterval(final.map((value,i) => value - current[i])),
    worstTenth: average(final.slice().sort((a,b) => a-b).slice(0, Math.max(1, Math.ceil(final.length / 10)))),
    largestUpdateLoss: Math.min(...updates), largeLossFrequency: updates.filter(d => d < -.05 - 1e-9).length / updates.length, groups }];
}));
const decisions = Object.fromEntries(arms.filter(a => a !== 'current').map(arm => [arm,
  summary[arm].gain.mean >= .02 && summary[arm].gain.lower > 0 && summary[arm].worstTenth >= summary.current.worstTenth - .02
  && Object.entries(summary[arm].groups).every(([type, delta]) => delta >= (type === 'missing_factor' ? -.05 : -.03))
  && summary[arm].largeLossFrequency <= summary.current.largeLossFrequency
  && summary[arm].largestUpdateLoss >= summary.current.largestUpdateLoss]));
assert.deepEqual(sourceHashes(), initialSources, 'Sources changed during the replay');
const report = { version: 'learned-taste-v2', partition, config: BALANCED_TASTE_CONFIG, sources: initialSources, actionCount, summary, decisions, results };
writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ output, actionCount, summary, decisions }));
