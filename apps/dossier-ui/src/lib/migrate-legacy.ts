/** One-time, best-effort migration of pre-TMDB ratings.
 *
 * Old builds keyed ratings by BestSimilar id with a bare numeric rating
 * value: { "12345": 1, "678": -1 }. Those ids are meaningless to TMDB,
 * so we remap each by looking up its title+year in the still-bundled
 * legacy catalogue index, searching TMDB for a match, and re-saving in
 * the new medium-qualified, snapshot-carrying format.
 *
 * Pairwise choices and the skip list are dropped (low value, can't be
 * reliably remapped). The whole thing is best-effort: any rating we
 * can't resolve is silently skipped. Runs only when old-format data is
 * detected and TMDB is configured. */
import { itemKey, toRatedItem, type Rating, type TmdbMedium } from "$lib/types";

type LegacyIndexEntry = { id: number; title: string; year: number | null };

const VALID_RATINGS = new Set<number>([1, -1, 0.5, -0.5]);

function isLegacyPayload(ratings: Record<string, unknown>): boolean {
  // Old entries are plain numbers; new entries are {rating, item, ts}.
  return Object.values(ratings).some((v) => typeof v === "number");
}

async function loadLegacyIndex(path: string): Promise<Map<number, LegacyIndexEntry>> {
  const map = new Map<number, LegacyIndexEntry>();
  try {
    const res = await fetch(path, { cache: "force-cache" });
    if (!res.ok) return map;
    const data = (await res.json()) as { films?: LegacyIndexEntry[] };
    for (const f of data.films ?? []) map.set(f.id, f);
  } catch {
    // Bundle already removed (post-migration build) — nothing to map.
  }
  return map;
}

/** Run the migration if needed. Returns the number of ratings migrated,
 * or null if no migration was necessary. Throws only on unexpected
 * bridge failure. */
export async function migrateLegacyRatings(): Promise<number | null> {
  const prefs = window.dossier?.preferences;
  const tmdb = window.dossier?.tmdb;
  if (!prefs || !tmdb) return null;

  const payload = (await prefs.get()) as unknown as {
    ratings: Record<string, number | unknown>;
  };
  const ratings = payload.ratings ?? {};
  if (!isLegacyPayload(ratings)) return null;

  // Build legacy id → {title, year}. Items in the TV index are TV; the
  // rest are movies.
  const [movieIdx, tvIdx] = await Promise.all([
    loadLegacyIndex("/catalogue/index.json"),
    loadLegacyIndex("/catalogue/tv-index.json")
  ]);

  type Resolved = { newKey: string; rating: Rating; item: ReturnType<typeof toRatedItem> };
  const resolved: Resolved[] = [];

  for (const [oldKey, value] of Object.entries(ratings)) {
    if (typeof value !== "number" || !VALID_RATINGS.has(value)) continue;
    const legacyId = Number(oldKey);
    const medium: TmdbMedium = tvIdx.has(legacyId) ? "tv" : "movie";
    const meta = medium === "tv" ? tvIdx.get(legacyId) : movieIdx.get(legacyId);
    if (!meta?.title) continue;
    try {
      const found = await tmdb.search(medium, meta.title, meta.year ?? undefined);
      const best = found.items[0];
      if (!best) continue;
      const detail = await tmdb.detail(medium, best.id);
      resolved.push({
        newKey: itemKey(medium, detail.id),
        rating: value as Rating,
        item: toRatedItem(detail)
      });
    } catch {
      // skip unresolved
    }
  }

  // Clear everything old (ratings + pairwise + skip), then write the
  // migrated ratings fresh.
  await prefs.reset();
  for (const r of resolved) {
    try {
      await prefs.setRating(r.newKey, r.rating, r.item);
    } catch {
      // skip
    }
  }
  return resolved.length;
}
