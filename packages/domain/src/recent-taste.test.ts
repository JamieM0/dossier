import { expect, test } from 'vitest';
import { recentTasteEvidence } from './recent-taste.js';
import { AXIS_KEYS, type FeatureVector } from './lens.js';
import type { RatingEntry } from './store/model.js';

test('recent evidence requires chronological observations and predicts subsequent feedback better before adapting', () => {
  const start = 1800000000000, day = 86400000, now = start + 53 * day;
  const entries: RatingEntry[] = Array.from({ length: 52 }, (_,i) => {
    const pacing = i % 2 ? .8 : -.8, current = i >= 40;
    return { rating: (pacing > 0 ? 2 : -2) * (current ? 1 : -1), ts: start + i * day,
      item: { key: `movie:${i}`, medium: 'movie', id: i, title: 'Observed', year: 2000, posterPath: null, voteAverage: 7,
        genres: [], keywords: [], features: Object.fromEntries(AXIS_KEYS.map(a => [a, a === 'pacing' ? pacing : 0])) as FeatureVector } };
  });
  const original = structuredClone(entries);
  const recent = recentTasteEvidence(entries, [], now);
  expect(recent.influence).toBeGreaterThan(.1);
  expect(recent.influence).toBeLessThanOrEqual(.25);
  expect(recent.validationImprovement).toBeGreaterThan(.2);
  expect(recentTasteEvidence(entries, [], now + 30 * day).influence).toBe(0);
  expect(recentTasteEvidence(entries.map(e => ({ ...e, ts: now })), [], now).influence).toBe(0);
  expect(recentTasteEvidence(entries.map((e,i) => i >= 40 ? { ...e, rating: 2 } : e), [], now).influence).toBe(0);
  expect(entries).toEqual(original);
});
