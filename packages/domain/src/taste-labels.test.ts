import { expect, test } from 'vitest';
import { tasteClaimsForDisplay } from './taste-labels.js';
import { deriveTasteClaims } from './taste-claims.js';
import { AXIS_KEYS, type FeatureVector } from './lens.js';
import type { RatingEntry } from './store/model.js';

test('display labels follow the lens and preserve stored claim identity and evidence', () => {
  const entries: RatingEntry[] = Array.from({ length: 3 }, (_,i) => ({ rating: 2, ts: i,
    item: { key: `movie:${i}`, id: i, medium: 'movie', title: 'Title', year: 2000, voteAverage: 7, posterPath: null,
      genres: [], keywords: [], features: Object.fromEntries(AXIS_KEYS.map(a => [a, a === 'realism' ? .8 : 0])) as FeatureVector } }));
  const original = deriveTasteClaims(entries), saved = structuredClone(original);
  const displayed = tasteClaimsForDisplay(original);
  expect(displayed.find(c => c.conditions[0].value === 'realism')!.conditions[0].label).toBe('fantastical settings');
  expect(displayed.map(c => c.id)).toEqual(original.map(c => c.id));
  expect(displayed.map(c => c.evidence)).toEqual(original.map(c => c.evidence));
  expect(original).toEqual(saved);
});
