import assert from 'node:assert/strict';
import test from 'node:test';
import { AXIS_KEYS, createDefaultState, setLibraryRating } from '@dossier/domain';
import { replayLibrary } from './library-replay.mjs';
test('lab replay matches overwrite, timestamp, clear, and claim reconciliation', () => {
  const item = { id: 1, medium: 'movie', title: 'Evidence', year: 2020, posterPath: null,
    voteAverage: null, genres: ['Drama'], keywords: [], collection: null, directorIds: [], creatorIds: [],
    features: Object.fromEntries(AXIS_KEYS.map(a => [a, .4])) };
  const events = [{ key: 'movie:1', rating: 2, ts: 100 }, { key: 'movie:1', rating: -1, ts: 200 }];
  const replay = replayLibrary(events, new Map([['movie:1', item]]));
  assert.equal(Object.keys(replay.ratings).length, 1);
  assert.equal(replay.ratings['movie:1'].rating, -1);
  assert.equal(replay.ratings['movie:1'].ts, 200);
  let actual = createDefaultState();
  for (const e of events) actual = setLibraryRating(actual, e.key, e.rating, { ...item, key: e.key }, e.ts);
  assert.deepEqual(replay, actual);
  assert.deepEqual(replayLibrary([...events, { key: 'movie:1', rating: null, ts: 300 }], new Map([['movie:1', item]])).ratings, {});
});
