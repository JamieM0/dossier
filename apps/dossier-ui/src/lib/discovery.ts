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

/** The rating queue: recognisable titles first so calibration starts on
 * films people are likely to have seen. Trending + popular + a slice of
 * acclaimed titles, deduped. */
export async function buildRatingQueue(
  medium: TmdbMedium,
  excludeKeys: Set<string>,
  page = 1
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
  return dedupeExclude(merged, excludeKeys);
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
