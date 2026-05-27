/** Catalogue loader. Two bundled catalogues — movies and TV — live
 * under `/catalogue/index.json` + `/catalogue/films/{id}.json` (movies)
 * and `/catalogue/tv-index.json` + `/catalogue/tv/{id}.json` (TV).
 * Each has a small manifest loaded once and per-item records loaded
 * on demand for detail views. Static files are bundled into the
 * SvelteKit build and served by Tauri's asset protocol on desktop. */
import type { CatalogueIndex, FilmDetail, FilmIndexEntry } from "$lib/types";
import type { CatalogueMode } from "$lib/state/catalogue-mode.svelte";

const indexPromises: Partial<Record<CatalogueMode, Promise<CatalogueIndex>>> = {};
const detailCaches: Record<CatalogueMode, Map<number, Promise<FilmDetail>>> = {
  movies: new Map(),
  tv: new Map()
};

function pathsFor(mode: CatalogueMode): { index: string; detailDir: string } {
  return mode === "tv"
    ? { index: "/catalogue/tv-index.json", detailDir: "/catalogue/tv" }
    : { index: "/catalogue/index.json", detailDir: "/catalogue/films" };
}

export async function loadCatalogueIndex(
  mode: CatalogueMode = "movies"
): Promise<CatalogueIndex> {
  let p = indexPromises[mode];
  if (!p) {
    const { index } = pathsFor(mode);
    p = fetch(index, { cache: "force-cache" }).then((r) => {
      if (!r.ok) throw new Error(`catalogue ${mode} missing (${r.status})`);
      return r.json() as Promise<CatalogueIndex>;
    });
    indexPromises[mode] = p;
  }
  return p;
}

export async function loadFilmDetail(
  filmId: number,
  mode: CatalogueMode = "movies"
): Promise<FilmDetail> {
  const cache = detailCaches[mode];
  let p = cache.get(filmId);
  if (!p) {
    const { detailDir } = pathsFor(mode);
    p = fetch(`${detailDir}/${filmId}.json`, { cache: "force-cache" }).then((r) => {
      if (!r.ok) throw new Error(`${mode} ${filmId} missing (${r.status})`);
      return r.json() as Promise<FilmDetail>;
    });
    cache.set(filmId, p);
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
