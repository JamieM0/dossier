import { expect, test } from 'vitest';
import { AXIS_KEYS, type FeatureVector } from './lens.js';
import { balancedTasteInfluence, scoreBalancedTaste } from './balanced-taste.js';
import { DEFAULT_SCORING_PARAMS, scoreCandidates } from './recommender.js';
import type { RatingEntry } from './store/model.js';
import type { TmdbItem } from './tmdb/types.js';

const item = (id: number, pacing: number, tags: string[] = []): TmdbItem => ({ id, medium: 'movie', title: `Title ${id}`, year: 2000,
  genres: ['Drama'], genreIds: [], keywords: tags, overview: '', posterPath: null, runtime: 100, voteAverage: 7,
  popularity: 10, voteCount: 100, features: Object.fromEntries(AXIS_KEYS.map(axis => [axis, axis === 'pacing' ? pacing : 0])) as FeatureVector });
const entry = (id: number, pacing: number, rating: RatingEntry['rating'], tags: string[] = []): RatingEntry => ({ item: { ...item(id, pacing, tags), key: `movie:${id}` }, rating, ts: id });

test('balanced influence follows taste evidence rather than recorded actions', () => {
  const entries = [entry(1, -.8, 2), entry(2, .8, -2)];
  expect(balancedTasteInfluence([...entries, ...Array.from({ length: 100 }, (_, i) => entry(20 + i, .5, 0))])).toBe(balancedTasteInfluence(entries));
  expect(balancedTasteInfluence(entries)).toBeGreaterThan(0);
  expect(balancedTasteInfluence([...entries, entry(3, -.8, 3), entry(4, .8, -3)])).toBeGreaterThan(balancedTasteInfluence(entries));
  expect(balancedTasteInfluence([entry(1, -.8, 3)])).toBe(0);
});

test('one-sided evidence retains distinct clusters and public and discovery weights stay unchanged', () => {
  const entries = [entry(1, -.8, 2), entry(2, .8, 2)];
  const candidates = [item(3, -.8), item(4, .8)];
  expect(scoreBalancedTaste(candidates, entries, [], [], 'balanced_comparisons')).toEqual(scoreCandidates(candidates, entries));
  const mixed = [...entries, entry(5, .1, -2)];
  const baseline = scoreBalancedTaste(candidates, mixed, [], [], 'balanced_descriptive');
  const reviews = scoreBalancedTaste(candidates.map(i => ({ ...i, voteAverage: 10 })), mixed, [], [], 'balanced_descriptive');
  for (const row of baseline) expect(reviews.find(r => r.item.id === row.item.id)!.score - row.score).toBeCloseTo(.03);
  const popular = scoreBalancedTaste(candidates, mixed, [], [], 'balanced_descriptive', { ...DEFAULT_SCORING_PARAMS, popularityBias: 1 });
  const legacyPopular = scoreCandidates(candidates, mixed, { ...DEFAULT_SCORING_PARAMS, popularityBias: 1 });
  const legacy = scoreCandidates(candidates, mixed);
  expect(popular[0]!.score - baseline[0]!.score).toBeCloseTo(legacyPopular[0]!.score - legacy[0]!.score);
});

test('balanced recommendations learn a difference that the shared lens cannot express and restore after clearing feedback', () => {
  const entries = Array.from({ length: 20 }, (_, i) => entry(i + 1, .5, i < 10 ? 3 : -3, i < 10 ? ['quiet'] : ['spectacle']));
  const candidates = [item(30, .5, ['quiet']), item(31, .5, ['spectacle'])];
  const original = structuredClone(entries);
  const scored = scoreBalancedTaste(candidates, entries, [], [], 'balanced_descriptive');
  expect(scored[0]!.item.id).toBe(30);
  expect(scored[0]!.score - scored[1]!.score).toBeGreaterThan(.4);
  expect(entries).toEqual(original);
  expect(scoreBalancedTaste(candidates, entries.slice().reverse(), [], [], 'balanced_descriptive')).toEqual(scored);
});
