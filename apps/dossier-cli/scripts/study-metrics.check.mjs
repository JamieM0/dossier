import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { featureVector } from '@dossier/domain';
import { componentScores } from './study-metrics.mjs';

const movie = (id, genres, quality) => ({ id, medium: 'movie', title: `Film ${id}`, year: 2000, voteAverage: quality, genres, keywords: [], overview: '', directorIds: [], creatorIds: [], collection: null, features: featureVector({ genres, keywords: [], overview: '' }) });
test('component scores depend only on public metadata and observed ratings', () => {
  const candidates = [movie(1, ['Drama'], 8), movie(2, ['Action'], 4)];
  const liked = movie(3, ['Drama'], 6);
  const entries = [{ item: { ...liked, key: 'movie:3' }, rating: 3, ts: 0 }];
  const rows = Object.fromEntries(componentScores(candidates, entries, []).map(row => [row.name, row]));
  assert.equal(rows.public_quality.scores['movie:1'], .8);
  assert.equal(rows.public_quality.scores['movie:2'], .4);
  assert.ok(rows.quality_plus_similarity.scores['movie:1'] > rows.quality_plus_similarity.scores['movie:2']);
  assert.ok(rows.metadata_similarity.scores['movie:1'] > rows.metadata_similarity.scores['movie:2']);
  assert.deepEqual(rows.current.scores, rows.no_claims.scores);
  assert.equal(componentScores(candidates, [], []).find(row => row.name === 'current').available, false);
});
test('claim removal is isolated from the observed film ratings', () => {
  const candidates = [movie(1, ['Drama'], 7), movie(2, ['Action'], 7)];
  const entries = [{ item: { ...movie(3, ['Drama'], 7), key: 'movie:3' }, rating: 3, ts: 0 }];
  const claim = { id: 'test', active: true, effect: 'negative', confidence: 1, provenance: 'inferred', conditions: [{ kind: 'genre', value: 'Drama', label: 'Drama' }] };
  const before = JSON.stringify(entries);
  const rows = Object.fromEntries(componentScores(candidates, entries, [claim]).map(row => [row.name, row]));
  assert.ok(rows.current.scores['movie:1'] < rows.no_claims.scores['movie:1']);
  assert.equal(rows.current.scores['movie:2'], rows.no_claims.scores['movie:2']);
  assert.equal(JSON.stringify(entries), before);
});

test('TMDB metadata preserves the original viewers, ratings, and film keys', () => {
  const old = JSON.parse(readFileSync(new URL('../src/lab/real-v1.json', import.meta.url)));
  const bytes = readFileSync(new URL('../src/lab/real-tmdb-v1.json', import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), '8d9c1e10bcd3c7841cefe68e25d90355e02a2cf3bb8cf6b6a5c777c7298c3bdc');
  const current = JSON.parse(bytes);
  assert.deepEqual(current.viewers, old.viewers);
  assert.deepEqual(current.items.map(item => item.id), old.items.map(item => item.id));
  assert.equal(current.items.length, 1736);
  assert.equal(current.items.filter(item => item.directorIds.length > 0).length, 1735);
  assert.equal(current.items.filter(item => item.collection).length, 477);
  assert.equal(current.items.filter(item => item.source.tmdbMedium === 'tv').length, 1);
  assert.ok(current.selection.identityAudit.every(row => row.verified));
  assert.ok(current.items.every(item => !('features' in item) && !('rating' in item) && !('hiddenRating' in item)));
  assert.ok(new Set(current.items.map(item => `${item.source.tmdbMedium}:${item.source.tmdbId}`)).size === current.items.length);
});
