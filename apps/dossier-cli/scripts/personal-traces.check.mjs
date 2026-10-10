import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createDefaultState, setLibraryRating, scoreCandidates, scoreLearnedTaste, scoreBalancedTaste, scoreRecentTaste } from '@dossier/domain';
import { shuffled, key, average } from './hard-metrics.mjs';
import { meanInterval } from './real-metrics.mjs';
process.chdir(fileURLToPath(new URL('../../..', import.meta.url)));
const hash = value => createHash('sha256').update(value).digest('hex');
const bytes = path => existsSync(path) ? readFileSync(path) : gunzipSync(readFileSync(`${path}.gz`));
const read = path => JSON.parse(bytes(path));
function accuracy(scores, truth, hidden) {
  let wins = 0, pairs = 0;
  for (const a of hidden) if (truth[a] > 0) for (const b of hidden) if (truth[b] < 0) {
    const difference = (scores[a] ?? 0) - (scores[b] ?? 0);
    wins += difference > 0 ? 1 : difference === 0 ? .5 : 0; pairs++;
  }
  return Number((pairs ? wins / pairs : .5).toFixed(4));
}
for (const family of ['learned-taste-v1', 'learned-taste-v2', 'recent-taste-v1']) test(`${family} frozen traces reconstruct observed feedback, rankings, decisions, and checkpoint scores`, () => {
  const base = `apps/dossier-cli/benchmarks/${family}`;
  const reference = read(`${base}-reference.json`), fixture = read(`${base}-fixture.json`);
  assert.equal(hash(bytes(`${base}-fixture.json`)), reference.fixture);
  assert.equal(hash(bytes(reference.developmentPath)), reference.development);
  for (const [path, expected] of Object.entries(reference.sources)) assert.equal(hash(bytes(`${base}-sources/${path}`)), expected, path);
  let ratings = 0, rankings = 0, scores = 0;
  for (const partition of ['selection', 'confirmation']) {
    const report = read(`reports/${family}-${partition}.json`);
    assert.deepEqual(report.sources, reference.sources);
    assert.deepEqual(report.config, reference.config);
    const items = fixture.catalogues[partition], hidden = items.slice(100).map(key);
    const people = fixture.people.filter(p => p.partition === partition);
    assert.deepEqual(report.results.map(p => p.id), people.map(p => p.id));
    for (const result of report.results) {
      const person = people.find(p => p.id === result.id);
      for (const session of result.sessions) {
        let training = shuffled(items.slice(0,100), person.seed + session.seed);
        if (person.type === 'novel') {
          const familiar = training.filter(i => !i.keywords.includes(person.tag));
          training = [...familiar.slice(0,30), ...training.filter(i => i.keywords.includes(person.tag)), ...familiar.slice(30)];
        }
        if (person.type === 'duplicates') training = [...training.filter(i => i.id % 1000 >= 70 && i.id % 1000 < 78), ...training.filter(i => !(i.id % 1000 >= 70 && i.id % 1000 < 78))];
        let state = createDefaultState(), previous;
        assert.equal(session.steps.length, 60);
        for (const step of session.steps) {
          const count = step.count, item = training[count-1], truth = person.type === 'changing' && count <= 30 ? person.oldRatings : person.ratings;
          assert.equal(step.key, key(item)); assert(!hidden.includes(step.key));
          const supplied = person.type === 'mistake' && count === 14 ? -truth[step.key] : truth[step.key];
          assert.equal(step.rating, supplied || 0);
          const now = 1800000000000 + count * 86400000;
          state = setLibraryRating(state, step.key, step.rating, {...item,key:step.key}, now); ratings++;
          if (count > 10 && count % 4 === 0 && person.type !== 'changing') {
            const earlier = training[count-6];
            const [winner,loser] = person.utility[key(item)] >= person.utility[key(earlier)] ? [item,earlier] : [earlier,item];
            state.pairwise.push({winnerKey:key(winner),loserKey:key(loser),ts:now});
          }
          for (const arm of reference.arms) {
            assert.equal(step.measures[arm], accuracy(step.scores[arm],truth,hidden)); rankings++;
            assert.equal(step.deltas[arm], previous ? step.measures[arm] - accuracy(previous.scores[arm],truth,hidden) : 0);
            if (![10,20,40,60].includes(count)) continue;
            const entries = Object.values(state.ratings), candidates = items.slice(100);
            const calculated = arm === 'current' ? scoreCandidates(candidates,entries,undefined,state.tasteClaims)
              : arm === 'adaptive_comparisons' ? scoreRecentTaste(candidates,entries,state.tasteClaims,state.pairwise,undefined,now)
              : arm.startsWith('balanced_') ? scoreBalancedTaste(candidates,entries,state.tasteClaims,state.pairwise,arm)
              : scoreLearnedTaste(candidates,entries,state.tasteClaims,state.pairwise,arm,.05);
            const expected = Object.fromEntries(calculated.map(row => [key(row.item), Math.round(row.score*1000)/1000 || 0]));
            assert.deepEqual(step.scores[arm],expected,`${person.id}/${session.seed}/${count}/${arm}`); scores += calculated.length;
          }
          previous = step;
        }
      }
    }
    const means = arm => report.results.map(p => average(p.sessions.map(s => s.steps.at(-1).measures[arm])));
    const baseline = means('current');
    for (const arm of reference.arms) {
      const final = means(arm), updates = report.results.flatMap(p => p.sessions.flatMap(s => s.steps.slice(10).map(x => x.deltas[arm])));
      const actual = report.summary[arm];
      assert.equal(actual.auc,average(final));
      assert.deepEqual(actual.gain,meanInterval(final.map((v,i) => v-baseline[i])));
      assert.equal(actual.worstTenth,average(final.slice().sort((a,b) => a-b).slice(0,Math.ceil(final.length/10))));
      assert.equal(actual.largestUpdateLoss,Math.min(...updates));
      assert.equal(actual.largeLossFrequency,updates.filter(d => d < -.05-1e-9).length/updates.length);
      const groups = Object.fromEntries([...new Set(report.results.map(p => p.type))].map(type => [type,average(report.results.filter(p => p.type === type).map(p => average(p.sessions.map(s => s.steps.at(-1).measures[arm]-s.steps.at(-1).measures.current))))]));
      assert.deepEqual(actual.groups,groups);
      if (arm !== 'current') assert.equal(report.decisions[arm], actual.gain.mean >= .02 && actual.gain.lower > 0
        && actual.worstTenth >= report.summary.current.worstTenth-.02
        && Object.entries(groups).every(([type,d]) => d >= (type === 'missing_factor' ? -.05 : -.03))
        && actual.largeLossFrequency <= report.summary.current.largeLossFrequency
        && actual.largestUpdateLoss >= report.summary.current.largestUpdateLoss);
    }
  }
  console.log(JSON.stringify({family,ratings,rankings,scores}));
});
