/** One-time-per-launch background upgrade for ratings made before the
 * recommender started scoring against real TMDB keyword tags. Existing
 * snapshots may carry the coarse, genre+overview-only lens vector (what
 * list results carry) rather than the full per-item vector (what a
 * detail() fetch carries — see discovery.ts:enrichItem and lens.ts).
 *
 * Walks the rated library and re-saves any entry whose freshly-fetched
 * vector differs from what's stored. detail() is disk-cached forever, so
 * once a title's been upgraded this whole pass is a fast no-op on every
 * future launch (cache hits, no writes). Best-effort: network/TMDB
 * failures are skipped silently and simply retried next launch. */
import { ratedToTmdbItem, type RatingEntry } from "$lib/types";
import { enrichItem, mapWithConcurrency } from "$lib/discovery";
import { preferences } from "$lib/state/preferences.svelte";

function featuresEqual(a: RatingEntry["item"]["features"], b: RatingEntry["item"]["features"]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export async function upgradeExistingRatings(
  concurrency = 6,
  onProgress?: (processed: number, total: number) => void
): Promise<{ upgraded: number; total: number }> {
  const entries = preferences.entries();
  const total = entries.length;
  let processed = 0;
  let upgraded = 0;
  onProgress?.(0, total);
  await mapWithConcurrency(entries, concurrency, async (entry) => {
    const enriched = await enrichItem(ratedToTmdbItem(entry.item));
    if (!featuresEqual(entry.item.features, enriched.features)) {
      await preferences.setRating(enriched, entry.rating);
      upgraded++;
    }
    processed++;
    onProgress?.(processed, total);
  });
  return { upgraded, total };
}
