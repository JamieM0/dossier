/** Catalogue loader. The bundled film catalogue lives under
 * `/catalogue/index.json` (small manifest, loaded once) and
 * `/catalogue/films/{id}.json` (per-film record, loaded on demand for
 * detail views). Static files are bundled into the SvelteKit build and
 * served by Tauri's asset protocol on desktop. */
import type { CatalogueIndex, FilmDetail, FilmIndexEntry } from "$lib/types";

let indexPromise: Promise<CatalogueIndex> | null = null;
const detailCache = new Map<number, Promise<FilmDetail>>();

export async function loadCatalogueIndex(): Promise<CatalogueIndex> {
  if (!indexPromise) {
    indexPromise = fetch("/catalogue/index.json", { cache: "force-cache" })
      .then((r) => {
        if (!r.ok) throw new Error(`catalogue index missing (${r.status})`);
        return r.json() as Promise<CatalogueIndex>;
      });
  }
  return indexPromise;
}

export async function loadFilmDetail(filmId: number): Promise<FilmDetail> {
  let p = detailCache.get(filmId);
  if (!p) {
    p = fetch(`/catalogue/films/${filmId}.json`, { cache: "force-cache" })
      .then((r) => {
        if (!r.ok) throw new Error(`film ${filmId} missing (${r.status})`);
        return r.json() as Promise<FilmDetail>;
      });
    detailCache.set(filmId, p);
  }
  return p;
}

/** Cluster-key for the rating queue's "era × genre" diversification.
 * The plan calls for popular films first, sorted within recognisable
 * clusters. We bucket year into decades and grab the first genre. */
export function clusterKey(film: FilmIndexEntry): string {
  const decade = film.year ? `${Math.floor(film.year / 10) * 10}s` : "unknown";
  const genre = film.genres[0] ?? "unknown";
  return `${decade}|${genre}`;
}
