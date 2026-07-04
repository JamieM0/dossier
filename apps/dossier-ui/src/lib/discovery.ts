/** TMDB-backed candidate generation. This is the *data source* for the
 * recommender and rating queue — NOT the recommender itself. We pull
 * broad, recognisable pools (trending / popular / by-genre discover) and
 * let recommender.ts rank them with the user's taste profile. We never
 * use TMDB's own /recommendations or /similar endpoints: the ranking
 * brain stays entirely ours so it remains medium-agnostic. */
import type { RatingEntry, TmdbItem, TmdbMedium } from "$lib/types";

const genreMaps: Partial<Record<TmdbMedium, Map<string, number>>> = {};

function tmdb() {
  const api = window.dossier?.tmdb;
  if (!api) throw new Error("TMDB bridge unavailable (not running in the desktop shell).");
  return api;
}

/** name → id map for a medium (cached). Lets us turn the user's liked
 * genre names back into discover filter ids. */
async function genreNameToId(medium: TmdbMedium): Promise<Map<string, number>> {
  const cached = genreMaps[medium];
  if (cached) return cached;
  const { genres } = await tmdb().genres(medium);
  const map = new Map<string, number>();
  for (const [id, name] of Object.entries(genres)) map.set(name, Number(id));
  genreMaps[medium] = map;
  return map;
}

function dedupeExclude(items: TmdbItem[], excludeKeys: Set<string>): TmdbItem[] {
  const seen = new Set<string>();
  const out: TmdbItem[] = [];
  for (const it of items) {
    const key = `${it.medium}:${it.id}`;
    if (excludeKeys.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
}

/** Run `fn` over `items` with at most `concurrency` in flight at once,
 * preserving input order in the result. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker(): Promise<void> {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, worker));
  return results;
}

/** Upgrade a list-sourced item to the full per-item lens vector, which
 * uses TMDB's curated keyword tags (list results only carry genres +
 * overview text — see lens.ts for why that alone barely discriminates
 * between two same-genre movies). Falls back to the original item on any
 * fetch failure (offline, TMDB error, deleted title) so rating or scoring
 * never blocks on this. Cheap to repeat: detail() is disk-cached forever
 * once a title has been fetched once. */
export async function enrichItem(item: TmdbItem): Promise<TmdbItem> {
  try {
    return await tmdb().detail(item.medium, item.id);
  } catch {
    return item;
  }
}

/** Batch form of enrichItem for a whole candidate page, with bounded
 * concurrency so we don't fire 50+ simultaneous requests at TMDB. */
export async function enrichItems(items: TmdbItem[], concurrency = 8): Promise<TmdbItem[]> {
  return mapWithConcurrency(items, concurrency, enrichItem);
}

/** Neutral position for a Rate screen genre dial — mirrors
 * RATE_DIAL_DEFAULT in state/rate-dials.svelte.ts. Kept as a local
 * constant (rather than importing the Svelte store module) so this data
 * module has no framework/runes dependency. */
const GENRE_DIAL_NEUTRAL = 50;

/** True only when every dial is sitting at its neutral default — the
 * "neutral dials never affect anything" rule from rate-dials means this
 * must be a real no-op, not just a weight of ~1 for every item. */
function allGenreDialsNeutral(dialValues: Record<string, number>): boolean {
  return Object.values(dialValues).every((v) => v === GENRE_DIAL_NEUTRAL);
}

/** An item's relative "chance of being seen" multiplier: the average,
 * across its genres, of each genre's dial value relative to neutral
 * (50 → 1x, 100 → 2x, 1 → 0.02x). Genres with no dial recorded count as
 * neutral (1x). */
function genreDialMultiplier(item: TmdbItem, dialValues: Record<string, number>): number {
  if (item.genres.length === 0) return 1;
  const sum = item.genres.reduce((acc, g) => acc + (dialValues[g] ?? GENRE_DIAL_NEUTRAL) / GENRE_DIAL_NEUTRAL, 0);
  return sum / item.genres.length;
}

/** Biases which items surface first according to the Rate screen's
 * genre dials — a raised dial makes its genre more likely to appear
 * early, a lowered one less likely, but nothing is ever hard-filtered
 * out (weights only approach, never reach, zero). Implemented as a
 * weighted random permutation (Efraimidis-Spirakis A-ES: sort by
 * `random() ** (1/weight)` descending) so the effect is probabilistic
 * rather than a deterministic re-sort. No-ops when every dial is
 * neutral, per rate-dials' "defaults never affect anything" rule. */
export function applyGenreDials(
  items: TmdbItem[],
  dialValues: Record<string, number>,
  rng: () => number = Math.random
): TmdbItem[] {
  if (items.length <= 1 || allGenreDialsNeutral(dialValues)) return items;
  return items
    .map((item) => ({ item, key: Math.pow(rng(), 1 / Math.max(0.0001, genreDialMultiplier(item, dialValues))) }))
    .sort((a, b) => b.key - a.key)
    .map(({ item }) => item);
}

/** The rating queue: recognisable titles first so calibration starts on
 * films people are likely to have seen. Trending + popular + a slice of
 * acclaimed titles, deduped, then biased by the Rate screen's genre
 * dials (see applyGenreDials). */
export async function buildRatingQueue(
  medium: TmdbMedium,
  excludeKeys: Set<string>,
  page = 1,
  genreDialValues: Record<string, number> = {}
): Promise<TmdbItem[]> {
  const api = tmdb();
  const [trending, popular, acclaimed] = await Promise.all([
    api.trending(medium, page),
    api.discover(medium, { sortBy: "popularity.desc", minVotes: 500, page }),
    api.discover(medium, { sortBy: "vote_average.desc", minVotes: 2000, page })
  ]);
  // Interleave so the queue is mostly popular with a steady trickle of
  // acclaimed-but-less-mainstream titles.
  const merged: TmdbItem[] = [];
  const lists = [trending.items, popular.items, acclaimed.items];
  const max = Math.max(...lists.map((l) => l.length));
  for (let i = 0; i < max; i++) {
    for (const list of lists) if (list[i]) merged.push(list[i]);
  }
  return applyGenreDials(dedupeExclude(merged, excludeKeys), genreDialValues);
}

/** Derive the user's strongest genres from their liked items, weighted
 * by rating. Returns up to `n` TMDB genre ids for discover filtering. */
async function likedGenreIds(
  medium: TmdbMedium,
  entries: RatingEntry[],
  n = 4
): Promise<number[]> {
  const nameToId = await genreNameToId(medium);
  const score = new Map<string, number>();
  for (const e of entries) {
    if (e.rating <= 0) continue; // liked / watchlist only
    for (const g of e.item.genres) score.set(g, (score.get(g) ?? 0) + e.rating);
  }
  return [...score.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => nameToId.get(name))
    .filter((id): id is number => id != null)
    .slice(0, n);
}

/** A candidate pool to rank for recommendations. Biased toward the
 * user's liked genres (broadens coverage) plus trending (freshness),
 * across the requested page depth. */
export async function buildCandidatePool(
  medium: TmdbMedium,
  entries: RatingEntry[],
  excludeKeys: Set<string>,
  page = 1
): Promise<TmdbItem[]> {
  const api = tmdb();
  const genreIds = await likedGenreIds(medium, entries);
  const withGenres = genreIds.length ? genreIds.join("|") : undefined;

  const requests: Promise<{ items: TmdbItem[] }>[] = [
    api.discover(medium, { sortBy: "popularity.desc", minVotes: 200, withGenres, page }),
    api.discover(medium, { sortBy: "vote_average.desc", minVotes: 1000, withGenres, page })
  ];
  // Mix in trending only on the first page so it doesn't crowd later pages.
  if (page === 1) requests.push(api.trending(medium, 1));

  const results = await Promise.all(requests);
  return dedupeExclude(results.flatMap((r) => r.items), excludeKeys);
}
