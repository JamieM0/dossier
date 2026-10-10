import { expect, test } from 'vitest';
import { createDefaultState, type RatedItem } from './store/model.js';
import { setLibraryRating } from './application.js';
import { refreshLibraryRatingItem } from './rating-metadata.js';
import { AXIS_KEYS, type FeatureVector } from './lens.js';

test('metadata refresh preserves feedback time and cannot restore cleared or overwrite changed feedback', () => {
  const item = { key: 'movie:1', medium: 'movie', id: 1, title: 'Title', year: 2000, posterPath: null,
    voteAverage: 7, genres: ['Drama'], keywords: [], features: Object.fromEntries(AXIS_KEYS.map(a => [a, .5])) as FeatureVector } as RatedItem;
  const state = setLibraryRating(createDefaultState(), item.key, -0.5, item, 123);
  const updated = refreshLibraryRatingItem(state, item.key, { ...item, keywords: ['quiet'] }, 123);
  expect(updated.ratings[item.key]).toMatchObject({ rating: -0.5, ts: 123, item: { keywords: ['quiet'] } });
  expect(state.ratings[item.key]!.item.keywords).toEqual([]);
  const cleared = setLibraryRating(state, item.key, null);
  expect(refreshLibraryRatingItem(cleared, item.key, item, 123)).toBe(cleared);
  const changed = setLibraryRating(state, item.key, 3, item, 124);
  expect(refreshLibraryRatingItem(changed, item.key, item, 123)).toBe(changed);
});
