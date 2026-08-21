/** One-time-per-launch background upgrade for ratings made before the
 * recommender started scoring against real TMDB keyword tags, AND for
 * ratings whose snapshots predate `RatedItem.keywords` being persisted.
 *
 * Three things get upgraded:
 *  1. The lens vector — list-sourced snapshots carry the coarse
 *     genre+overview-only vector rather than the full per-item vector
 *     a detail() fetch carries (see discovery.ts:enrichItem, lens.ts).
 *  2. The keyword tag list — older snapshots were saved before
 *     `keywords` was part of RatedItem. Without it the Rate screen's
 *     tag dials and "adjust your dials?" prompt have no signal for
 *     those titles.
 *  3. Structural relationships — collection/franchise, director, and TV
 *     creator IDs added to the same cached TMDB detail response.
 *
 * Walks the rated library and re-saves any entry whose freshly-fetched
 * vector, keyword list, OR structural metadata differs from what's stored. detail() is
 * disk-cached forever, so once a title's been upgraded this whole pass
 * is a fast no-op on every future launch (cache hits, no writes).
 * Best-effort: network/TMDB failures are skipped silently and simply
 * retried next launch. */
import { ratedToTmdbItem, type RatingEntry } from "$lib/types";
import { enrichItem, mapWithConcurrency } from "$lib/discovery";
import { preferences } from "$lib/state/preferences.svelte";

function featuresEqual(a: RatingEntry["item"]["features"], b: RatingEntry["item"]["features"]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function keywordsEqual(a: string[] | undefined, b: string[]): boolean {
  if (!a) return b.length === 0;
  if (a.length !== b.length) return false;
  const sorted = [...a].sort();
  const sortedB = [...b].sort();
  return sorted.every((k, i) => k === sortedB[i]);
}

function idsEqual(a: number[] | undefined, b: number[] | undefined): boolean {
  return JSON.stringify([...(a ?? [])].sort((x, y) => x - y)) === JSON.stringify([...(b ?? [])].sort((x, y) => x - y));
}

export async function upgradeExistingRatings(
  concurrency = 6,
  onProgress?: (processed: number, total: number, upgraded: number) => void
): Promise<{ upgraded: number; total: number }> {
  const entries = preferences.entries();
  const total = entries.length;
  let processed = 0;
  let upgraded = 0;
  onProgress?.(0, total, 0);
  await mapWithConcurrency(entries, concurrency, async (entry) => {
    const enriched = await enrichItem(ratedToTmdbItem(entry.item));
    const featuresChanged = !featuresEqual(entry.item.features, enriched.features);
    const keywordsChanged = !keywordsEqual(entry.item.keywords, enriched.keywords);
    const structureChanged =
      (entry.item.collection?.id ?? null) !== (enriched.collection?.id ?? null) ||
      !idsEqual(entry.item.directorIds, enriched.directorIds) ||
      !idsEqual(entry.item.creatorIds, enriched.creatorIds);
    if (featuresChanged || keywordsChanged || structureChanged) {
      await preferences.setRating(enriched, entry.rating);
      upgraded++;
    }
    processed++;
    onProgress?.(processed, total, upgraded);
  });
  return { upgraded, total };
}
