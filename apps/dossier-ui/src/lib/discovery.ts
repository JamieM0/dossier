import { createDiscovery, type DiscoveryApi, type RatingEntry, type TmdbItem, type TmdbMedium } from "@dossier/domain";

function discovery() {
  const api = typeof window === "undefined" ? undefined : window.dossier?.tmdb;
  if (!api) return createDiscovery({ detail: async () => { throw new Error("TMDB bridge unavailable"); } } as unknown as DiscoveryApi);
  return createDiscovery({
    ...api,
    genres: async (medium) => new Map(Object.entries((await api.genres(medium)).genres).map(([id, name]) => [Number(id), name]))
  } as DiscoveryApi);
}
export { MAX_UNCACHED_COLLECTION_REQUESTS } from "@dossier/domain";
export const dedupeExclude = (items: TmdbItem[], exclude: Set<string>) => discovery().dedupeExclude(items, exclude);
export const buildCollectionCandidates = (entries: RatingEntry[], exclude: Set<string>, max?: number) => discovery().buildCollectionCandidates(entries, exclude, max);
export const mapWithConcurrency = <T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>) => discovery().mapWithConcurrency(items, concurrency, fn);
export const enrichItem = (item: TmdbItem) => discovery().enrichItem(item);
export const enrichItems = (items: TmdbItem[], concurrency?: number) => discovery().enrichItems(items, concurrency);
export const applyGenreDials = (items: TmdbItem[], genres: Record<string, number>, tags: Record<string, number> = {}, rng: () => number = Math.random) => discovery().applyGenreDials(items, genres, tags, rng);
export const buildRatingQueue = (medium: TmdbMedium, exclude: Set<string>, page?: number, genres?: Record<string, number>, tags?: Record<string, number>, entries?: RatingEntry[]) => discovery().buildRatingQueue(medium, exclude, page, genres, tags, entries);
export const buildCandidatePool = (medium: TmdbMedium, entries: RatingEntry[], exclude: Set<string>, page?: number) => discovery().buildCandidatePool(medium, entries, exclude, page);
