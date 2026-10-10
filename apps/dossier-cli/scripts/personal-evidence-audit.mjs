import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';
import { randomBytes, createHash } from 'node:crypto';
import keytar from 'keytar';
import { decryptJson } from '@dossier/store';
import { createDefaultState, reconcileTasteClaims, ratingKind, ratingWeight, exportLibrary, withDefaults, learnTasteDistinctions } from '@dossier/domain';
import { execute } from '../dist/actions.js';
import { shuffled, average, key } from './hard-metrics.mjs';
import { pairAccuracy } from './corroboration-ranking.mjs';

const args = process.argv.slice(2);
const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const source = option('--store', join(homedir(), 'Library/Application Support/com.dossier.desktop/dossier/store.enc.json'));
const output = option('--output', join(tmpdir(), 'dossier-personal-evidence-audit.json'));
const bytes = readFileSync(source);
const encoded = await keytar.getPassword('Dossier', 'master-key');
assert(encoded, 'Desktop encryption key unavailable');
const state = withDefaults(decryptJson(JSON.parse(bytes), Buffer.from(encoded, 'base64')));
const entries = Object.values(state.ratings);
const observed = entries.filter(e => ['like', 'dislike'].includes(ratingKind(e.rating)));
assert(observed.some(e => e.rating > 0) && observed.some(e => e.rating < 0), 'Need watched likes and dislikes');
const items = new Map(entries.map(e => [e.item.key, { ...e.item, voteCount: 0, popularity: 0, overview: '', runtime: null, genreIds: [] }]));
const arms = args.includes('--base') ? ['all_evidence', 'base'] : args.includes('--balanced') ? ['all_evidence', 'balanced_descriptive', 'balanced_comparisons']
  : args.includes('--learned') ? ['all_evidence', 'axes', 'descriptive', 'comparisons'] : ['all_evidence', 'without_exclusions', 'watched_only'];
const sessions = [];
const temporary = mkdtempSync(join(tmpdir(), 'dossier-evidence-'));
let actions = 0;
try {
  // Stratify by medium and polarity. Only watched ratings are hidden targets.
  for (const seed of [31, 73, 109]) {
    const buckets = new Map();
    for (const entry of observed) {
      const bucket = `${entry.item.medium}:${Math.sign(entry.rating)}`;
      if (!buckets.has(bucket)) buckets.set(bucket, []);
      buckets.get(bucket).push(entry.item.key);
    }
    const ordered = [...buckets.values()].map(keys => shuffled(keys, seed));
    for (let fold = 0; fold < 5; fold++) {
      const hidden = new Set(ordered.flatMap(keys => keys.filter((_, i) => i % 5 === fold)));
      const truth = Object.fromEntries(observed.filter(e => hidden.has(e.item.key)).map(e => [e.item.key, e.rating]));
      const measurements = {};
      for (const arm of arms) {
        const training = entries.filter(e => !hidden.has(e.item.key)
          && (arm !== 'without_exclusions' || ratingKind(e.rating) !== 'not_interested')
          && (arm !== 'watched_only' || ['like', 'dislike'].includes(ratingKind(e.rating))));
        const research = { ...createDefaultState(), ratings: Object.fromEntries(training.map(e => [e.item.key, e])) };
        research.pairwise = state.pairwise.filter(p => research.ratings[p.winnerKey] && research.ratings[p.loserKey]);
        // Rebuild inferred claims from training alone. No hidden evidence or
        // original confirmed claim enters the scoring boundary.
        research.tasteClaims = reconcileTasteClaims(training, []);
        let vault = { activeId: null, profiles: [] };
        const storage = { root: temporary, load: () => vault, save: next => { vault = next; }, audit: () => {} };
        const catalogue = {
          detail: async (medium, id) => items.get(`${medium}:${id}`),
          candidates: async medium => [...hidden].map(k => items.get(k)).filter(item => item.medium === medium)
        };
        const call = async (action, args = {}) => { actions++; return execute(storage, action, args, catalogue); };
        const created = await call('profile.create', { name: `${arm}-${seed}-${fold}` });
        const passphrase = randomBytes(24).toString('base64');
        const path = join(temporary, 'research.dossier');
        writeFileSync(path, JSON.stringify(await exportLibrary(research, passphrase)), { mode: 0o600 });
        await call('library.import', { path, passphrase, yes: true, expectedRevision: created.revision });
        unlinkSync(path);
        assert.deepEqual(vault.profiles[0].state.ratings, research.ratings);
        const before = JSON.stringify(vault);
        const scores = {};
        for (const medium of ['movie', 'tv']) {
          const result = await call('suggest.list', { medium, limit: 200, ...(arm === 'base' ? {} : { learnedTaste: arm === 'all_evidence' || !args.includes('--learned') ? 'clusters' : arm }) });
          for (const row of result.items) scores[row.id] = row.score;
        }
        await call('taste.coverage');
        assert.equal(JSON.stringify(vault), before, 'Read actions changed evidence');
        const rankings = ['movie', 'tv'].map(medium => {
          const keys = [...hidden].filter(k => k.startsWith(`${medium}:`));
          const positives = keys.filter(k => truth[k] > 0).length;
          const negatives = keys.filter(k => truth[k] < 0).length;
          return { medium, positives, negatives, pairs: positives * negatives,
            auc: positives && negatives ? pairAccuracy(scores, truth, keys) : null };
        });
        measurements[arm] = { training: training.length, claims: research.tasteClaims.length, rankings };
      }
      sessions.push({ seed, fold, measurements });
    }
  }
  const summary = Object.fromEntries(arms.map(arm => {
    const rows = sessions.flatMap(s => s.measurements[arm].rankings).filter(r => r.pairs);
    return [arm, { meanWithinMediumAuc: average(rows.map(r => r.auc)),
      pairWeightedAuc: rows.reduce((s, r) => s + r.auc * r.pairs, 0) / rows.reduce((s, r) => s + r.pairs, 0) }];
  }));
  const timestamps = entries.map(e => e.ts).sort((a, b) => a - b);
  let densestMinute = 0;
  for (let start = 0, end = 0; start < timestamps.length; start++) {
    while (end < timestamps.length && timestamps[end] - timestamps[start] <= 60000) end++;
    densestMinute = Math.max(densestMinute, end - start);
  }
  const report = { version: 'personal-evidence-audit-v1', sourceHash: createHash('sha256').update(bytes).digest('hex'),
    ratings: entries.length, kinds: Object.fromEntries(['like', 'dislike', 'watchlist', 'not_interested', 'neutral'].map(k => [k, entries.filter(e => ratingKind(e.rating) === k).length])),
    evidenceMass: Object.fromEntries(['like', 'dislike', 'watchlist', 'not_interested'].map(k => [k, entries.filter(e => ratingKind(e.rating) === k).reduce((s, e) => s + Math.abs(ratingWeight(e.rating)), 0)])),
    comparisons: state.pairwise.length, densestMinute, actions, summary, sessions,
    ...(args.includes('--learned') ? { fittedDistinctions: learnTasteDistinctions(entries, state.pairwise, 'comparisons').distinctions.slice().sort((a,b) => Math.abs(b.weight)-Math.abs(a.weight)).slice(0,20) } : {}),
    limits: ['One person; repeated folds are not independent people.', 'Watched titles were self-selected; this does not measure unseen discovery.',
      'Not interested retains its existing negative taste weight, as requested.', 'All arms preserve the existing public-rating weight.',
      'Inferred claims use training only; saved confirmations are omitted. Learned comparison arms use training-only comparisons.'] };
  assert.deepEqual(readFileSync(source), bytes, 'Desktop library changed during audit');
  writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  console.log(JSON.stringify({ output, ...report, sessions: undefined, fittedDistinctions: undefined }));
} finally {
  const path = join(temporary, 'research.dossier');
  try { unlinkSync(path); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  rmdirSync(temporary);
}
