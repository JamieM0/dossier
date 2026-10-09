import { describe, it, expect } from 'vitest';
import { scoreLocalEvidence } from './local-evidence.js';
import { AXIS_KEYS } from './lens.js';
import type { TmdbItem } from './tmdb/types.js';
import type { RatingEntry, Rating } from './store/model.js';
const vector = (tone: number, pacing = 0) => ({ ...Object.fromEntries(AXIS_KEYS.map(k => [k, 0])), tone, pacing }) as TmdbItem['features'];
const item = (id: number, tone: number, pacing = 0) => ({ id, medium: 'movie', title: String(id), year: 2000, genres: [], genreIds: [], keywords: [], overview: '', runtime: 90, posterPath: null, voteAverage: null, voteCount: 0, popularity: null, features: vector(tone, pacing) }) as TmdbItem;
const entry = (id: number, rating: Rating, tone: number, ts = 0): RatingEntry => ({ rating, ts, item: { ...item(id, tone), key: `movie:${id}` } });
describe('experimental local evidence', () => {
 it('preserves unrelated scores when evidence has zero proximity', () => {
  const pool = [item(10, 1), item(11, 0, 1)];
  const before = scoreLocalEvidence(pool, [entry(1, 2, 1)], [], 'timeless', 0, 0);
  const after = scoreLocalEvidence(pool, [entry(1, 2, 1), entry(2, -2, 1)], [], 'timeless', 0, 0);
  expect(after.find(r => r.item.id === 11)?.score).toBe(before.find(r => r.item.id === 11)?.score);
  expect(after.find(r => r.item.id === 10)!.score).toBeLessThan(before.find(r => r.item.id === 10)!.score);
 });
 it('produces identical scores for reordered evidence', () => {
  const entries = [entry(3, 3, 1), entry(1, -2, 1), entry(2, 1, -1)];
  expect(scoreLocalEvidence([item(10, 1)], entries, [], 'timeless', 0, 0))
   .toEqual(scoreLocalEvidence([item(10, 1)], entries.reverse(), [], 'timeless', 0, 0));
 });
 it('lets recent contradictory evidence outweigh old evidence', () => {
  const now = 120 * 86_400_000;
  const entries = [entry(1, 3, 1), entry(2, -3, 1, now)];
  expect(scoreLocalEvidence([item(10, 1)], entries, [], 'timeless', 0, now)[0].score).toBe(0);
  expect(scoreLocalEvidence([item(10, 1)], entries, [], 'recent', 0, now)[0].score).toBeLessThan(0);
 });
 it('returns no recommendations without positive evidence', () => {
  expect(scoreLocalEvidence([item(10, 1)], [entry(1, -2, 1)], [], 'timeless', 0, 0)).toEqual([]);
 });
});
