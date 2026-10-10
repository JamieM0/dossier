import { expect, test } from 'vitest';
import { AXIS_KEYS, exportLibrary, importLibrary, type FeatureVector, type TmdbItem } from '@dossier/domain';
import { execute } from '../actions.js';
import type { CliStorage, Vault } from '../storage.js';

test('CLI personal distinctions use saved ratings and corrections, explain scores, and preserve defaults and encrypted evidence', async () => {
  const items: TmdbItem[] = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, medium: 'movie', title: `Title ${i}`, year: 2000,
    genres: ['Drama'], genreIds: [], keywords: [], overview: '', runtime: 90, posterPath: null, voteAverage: 7, voteCount: 100, popularity: 10,
    features: Object.fromEntries(AXIS_KEYS.map(axis => [axis, axis === 'pacing' ? (i % 2 ? .7 : -.7) : 0])) as FeatureVector }));
  let vault: Vault = { profiles: [], activeId: null };
  const storage = { root: '/learned-taste-test', load: () => vault, save: (value: Vault) => { vault = value; }, audit: () => {} } as unknown as CliStorage;
  const catalogue = { detail: async (_medium: unknown, id: number) => items[id - 1]!, candidates: async () => items };
  const call = (name: string, args: Record<string, unknown> = {}) => execute(storage, name, args, catalogue) as Promise<any>;
  let revision = (await call('profile.create', { name: 'Learning' })).revision;
  for (let id = 1; id <= 8; id++) revision = (await call('rate.set', { key: `movie:${id}`, value: 2, expectedRevision: revision })).revision;
  const before = await call('suggest.list', { learnedTaste: 'clusters' });
  const ratingsOnly = await call('suggest.list', { learnedTaste: 'comparisons' });
  revision = (await call('refine.choose', { winner: 'movie:1', loser: 'movie:2', expectedRevision: revision })).revision;
  const learned = await call('suggest.list', { learnedTaste: 'comparisons' });
  expect(learned).not.toEqual(ratingsOnly);
  expect(await call('suggest.list', { learnedTaste: 'clusters' })).toEqual(before);
  const saved = structuredClone(vault);
  const explanation = await call('suggest.explain', { key: 'movie:9', learnedTaste: 'comparisons' });
  expect(explanation.score).toBe(learned.items.find((row: any) => row.id === 'movie:9').score);
  expect(explanation.evidence.comparisons).toBe(1);
  expect((await call('taste.distinctions')).items.some((d: any) => d.id === 'axis:pacing')).toBe(true);
  expect(vault).toEqual(saved);
  const state = vault.profiles[0]!.state;
  expect(await importLibrary(await exportLibrary(state, 'test-passphrase'), 'test-passphrase')).toEqual(state);
  revision = (await call('refine.correct', { winner: 'movie:2', loser: 'movie:1', expectedRevision: revision })).revision;
  expect(await call('suggest.list', { learnedTaste: 'comparisons' })).not.toEqual(learned);
  for (const args of [{ learnedTaste: 'invalid' }, { learnedTaste: 'axes', localEvidence: 'timeless' }, { learnedTaste: 'descriptive', dials: { axisWeights: {} } }]) {
    await expect(call('suggest.list', args)).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
  }
});


test('ordinary recommendations transfer and correct saved comparisons with signed evidence', async () => {
  const items: TmdbItem[] = Array.from({ length: 10 }, (_, i) => ({ id: i + 1, medium: 'movie', title: `Title ${i}`, year: 2000,
    genres: ['Drama'], genreIds: [], keywords: [], overview: '', runtime: 90, posterPath: null, voteAverage: 7, voteCount: 100, popularity: 10,
    features: Object.fromEntries(AXIS_KEYS.map(axis => [axis, axis === 'pacing' ? (i % 2 ? .7 : -.7) : 0])) as FeatureVector }));
  let vault: Vault = { profiles: [], activeId: null };
  const storage = { root: '/personal-base-test', load: () => vault, save: (value: Vault) => { vault = value; }, audit: () => {} } as unknown as CliStorage;
  const catalogue = { detail: async (_medium: unknown, id: number) => items[id - 1]!, candidates: async () => items };
  const call = (name: string, args: Record<string, unknown> = {}) => execute(storage, name, args, catalogue) as Promise<any>;
  let revision = (await call('profile.create', { name: 'Personal' })).revision;
  for (let id = 1; id <= 8; id++) revision = (await call('rate.set', { key: `movie:${id}`, value: id <= 4 ? 2 : -2, expectedRevision: revision })).revision;
  const baseline = await call('suggest.list');
  revision = (await call('refine.choose', { winner: 'movie:1', loser: 'movie:2', expectedRevision: revision })).revision;
  const learned = await call('suggest.list');
  expect(learned).not.toEqual(baseline);
  expect(learned.items[0].id).toBe('movie:9');
  expect((await call('suggest.explain', { key: 'movie:9' })).score).toBe(learned.items[0].score);
  revision = (await call('refine.correct', { winner: 'movie:2', loser: 'movie:1', expectedRevision: revision })).revision;
  expect((await call('suggest.list')).items[0].id).toBe('movie:10');
  const state = vault.profiles[0]!.state;
  expect(Object.values(state.ratings).map(e => e.rating)).toEqual([2,2,2,2,-2,-2,-2,-2]);
  expect(await importLibrary(await exportLibrary(state, 'test-passphrase'), 'test-passphrase')).toEqual(state);
});
