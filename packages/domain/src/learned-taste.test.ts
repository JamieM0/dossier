import { expect, test } from 'vitest';
import { AXIS_KEYS, type FeatureVector } from './lens.js';
import { learnTasteDistinctions, learnedTasteEvidence, scoreLearnedTaste } from './learned-taste.js';
import type { RatingEntry } from './store/model.js';
import type { TmdbItem } from './tmdb/types.js';

const item = (id: number, pacing: number, tags: string[] = []): TmdbItem => ({ id, medium: 'movie', title: `Title ${id}`, year: null,
  genres: ['Drama'], genreIds: [], keywords: tags, overview: '', posterPath: null, runtime: null, voteAverage: null,
  popularity: null, voteCount: 0, features: Object.fromEntries(AXIS_KEYS.map(axis => [axis, axis === 'pacing' ? pacing : 0])) as FeatureVector });
const entry = (id: number, pacing: number, rating: RatingEntry['rating'], tags: string[] = []): RatingEntry => ({ item: { ...item(id, pacing, tags), key: `movie:${id}` }, rating, ts: id });

test('learns signed axis preferences rather than similarity alone', () => {
  const entries = [entry(1, -.9, 3), entry(2, -.6, 2), entry(3, .7, -2), entry(4, .9, -3)];
  const taste = learnTasteDistinctions(entries, [], 'axes');
  expect(taste.distinctions.find(d => d.value === 'pacing')!.weight).toBeLessThan(0);
  expect(learnedTasteEvidence(item(9, -.8), taste).score).toBeGreaterThan(learnedTasteEvidence(item(10, .8), taste).score);
});

test('recovers a recurring personal distinction on identical lens vectors', () => {
  const entries = Array.from({ length: 8 }, (_, i) => entry(i + 1, .5, i < 4 ? 3 : -3, i < 4 ? ['quiet'] : ['spectacle']));
  const taste = learnTasteDistinctions(entries);
  expect(learnedTasteEvidence(item(20, .5, ['quiet']), taste).score).toBeGreaterThan(learnedTasteEvidence(item(21, .5, ['spectacle']), taste).score);
  expect(taste.distinctions.find(d => d.value === 'quiet')!.support).toBe(4);
  const unseen = learnTasteDistinctions([...entries, entry(30, .5, 3, ['one-off'])]);
  expect(unseen.distinctions.some(d => d.value === 'one-off')).toBe(false);
});

test('comparisons teach distinctions, latest corrections replace constraints, and removal restores the ratings fit', () => {
  const entries = Array.from({ length: 8 }, (_, i) => entry(i + 1, i < 4 ? -.7 : .7, 2));
  const first = { winnerKey: 'movie:1', loserKey: 'movie:5', ts: 1 };
  const corrected = { winnerKey: 'movie:5', loserKey: 'movie:1', ts: 2 };
  const ratings = learnTasteDistinctions(entries, [], 'comparisons');
  const before = learnTasteDistinctions(entries, [first], 'comparisons');
  const after = learnTasteDistinctions(entries, [first, corrected], 'comparisons');
  const difference = (taste: typeof ratings) => learnedTasteEvidence(item(20, -.7), taste).score - learnedTasteEvidence(item(21, .7), taste).score;
  expect(difference(before)).toBeGreaterThan(difference(ratings));
  expect(difference(after)).toBeLessThan(difference(ratings));
  expect(after.comparisons).toBe(1);
  expect(learnTasteDistinctions(entries, [], 'comparisons')).toEqual(ratings);
});

test('fit is read-only and independent of storage ordering, hidden targets, and public ratings', () => {
  const entries = [entry(1, -.8, 2, ['quiet']), entry(2, -.6, 3, ['quiet']), entry(3, -.7, 2, ['quiet']), entry(4, .8, -3)];
  const original = structuredClone(entries);
  const taste = learnTasteDistinctions(entries);
  expect(learnTasteDistinctions(entries.slice().reverse())).toEqual(taste);
  expect(learnTasteDistinctions(entries.map(e => ({ ...e, item: { ...e.item, voteAverage: 10 } })))).toEqual(taste);
  const candidates = [item(20, -.7), item(21, .7)];
  const score = scoreLearnedTaste(candidates, entries, [], [], 'descriptive', .05);
  const withReviews = scoreLearnedTaste(candidates.map(i => ({ ...i, voteAverage: 10 })), entries, [], [], 'descriptive', .05);
  for (const row of score) expect(withReviews.find(r => r.item.id === row.item.id)!.score - row.score).toBeCloseTo(.05);
  expect(entries).toEqual(original);
});
