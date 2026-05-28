/** Resolve a TMDB poster path to a URL served by the Rust `tmdbimg`
 * cache scheme (full-res, cached ≥90 days on disk, TMDB hit only on a
 * miss). Returns null when there's no poster or no desktop bridge. */
export function posterUrl(posterPath: string | null, size = "w342"): string | null {
  return window.dossier?.tmdb?.posterUrl(posterPath, size) ?? null;
}
