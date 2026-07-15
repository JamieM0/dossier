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

/** Neutral position for a Rate screen dial — mirrors
 * RATE_DIAL_DEFAULT in state/rate-dials.svelte.ts. Kept as a local
 * constant (rather than importing the Svelte store module) so this data
 * module has no framework/runes dependency. */
const DIAL_NEUTRAL = 50;

/** True only when every dial — genres AND tags — is sitting at its
 * neutral default. The "neutral dials never affect anything" rule from
 * rate-dials means this must be a real no-op, not just a weight of ~1
 * for every item. */
function allDialsNeutral(
  genreDialValues: Record<string, number>,
  tagDialValues: Record<string, number>
): boolean {
  return (
    Object.values(genreDialValues).every((v) => v === DIAL_NEUTRAL) &&
    Object.values(tagDialValues).every((v) => v === DIAL_NEUTRAL)
  );
}

/** An item's genre-dial multiplier: the average, across its genres, of
 *  each genre's dial value relative to neutral (50 → 1x, 100 → 2x,
 *  1 → 0.02x). Genres with no dial recorded count as neutral (1x).
 *
 *  Unchanged from when this was the only kind of dial: items rarely
 *  carry more than three genres, so averaging across all of them (incl.
 *  ones the user hasn't dial-adjusted, treated as neutral) is the right
 *  blend — one raised + one lowered neutralises, matching the
 *  "averages multiple genres" test. */
function genreDialMultiplier(item: TmdbItem, genreDialValues: Record<string, number>): number {
  if (item.genres.length === 0) return 1;
  const sum = item.genres.reduce((acc, g) => acc + (genreDialValues[g] ?? DIAL_NEUTRAL) / DIAL_NEUTRAL, 0);
  return sum / item.genres.length;
}

/** An item's tag-dial multiplier: the average, across ONLY the
 *  non-neutral tag dials on this item's keywords, of dial/neutral.
 *  Returns 1 when the user hasn't dial-adjusted any of this item's
 *  tags (or the item has no keywords).
 *
 *  Why non-neutral only (unlike genres, which average across all of
 *  them): items can carry 5-20 TMDB keywords, and the user will only
 *  ever have dial-adjusted a handful across their whole library. The
 *  undialed majority would dilute the dialled minority into
 *  statistical noise. Restricting to actually-dialled tags means
 *  raising a single tag dial — `swordplay:100` on a 15-keyword item —
 *  still produces a full 2x boost for any item tagged swordplay. */
function tagDialMultiplier(item: TmdbItem, tagDialValues: Record<string, number>): number {
  if (!item.keywords || item.keywords.length === 0) return 1;
  let sum = 0;
  let count = 0;
  for (const k of item.keywords) {
    const v = tagDialValues[k];
    if (v === undefined || v === DIAL_NEUTRAL) continue;
    sum += v / DIAL_NEUTRAL;
    count++;
  }
  if (count === 0) return 1;
  return sum / count;
}

/** Biases which items surface first according to the Rate screen's
 *  dials — a raised dial makes its genre/tag more likely to appear
 *  early, a lowered one less likely, but nothing is ever hard-filtered
 *  out (weights only approach, never reach, zero). Genre and tag
 *  multipliers combine multiplicatively so neither axis can drown the
 *  other out: a tag dial has full effect when genre dials are neutral
 *  (the common case) and vice versa. Implemented as a weighted random
 *  permutation (Efraimidis-Spirakis A-ES: sort by
 *  `random() ** (1/weight)` descending) so the effect is probabilistic
 *  rather than a deterministic re-sort. No-ops when every dial is
 *  neutral, per rate-dials' "defaults never affect anything" rule. */
export function applyGenreDials(
  items: TmdbItem[],
  genreDialValues: Record<string, number>,
  tagDialValues: Record<string, number> = {},
  rng: () => number = Math.random
): TmdbItem[] {
  if (items.length <= 1 || allDialsNeutral(genreDialValues, tagDialValues)) return items;
  return items
    .map((item) => {
      const mult = genreDialMultiplier(item, genreDialValues) * tagDialMultiplier(item, tagDialValues);
      return { item, key: Math.pow(rng(), 1 / Math.max(0.0001, mult)) };
    })
    .sort((a, b) => b.key - a.key)
    .map(({ item }) => item);
}

/** The rating queue: recognisable titles first so calibration starts on
 * films people are likely to have seen. Trending + popular + a slice of
 * acclaimed titles, deduped, then biased by the Rate screen's dials
 * (see applyGenreDials). */
export async function buildRatingQueue(
  medium: TmdbMedium,
  excludeKeys: Set<string>,
  page = 1,
  genreDialValues: Record<string, number> = {},
  tagDialValues: Record<string, number> = {}
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
  return applyGenreDials(dedupeExclude(merged, excludeKeys), genreDialValues, tagDialValues);
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
