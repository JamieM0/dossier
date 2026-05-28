/** Which medium the user is browsing: movies or TV. Affects which
 * catalogue feeds Recommendations / Rate / Refine / Library.
 *
 * Persisted via localStorage so the choice survives reloads. Default
 * is "movies" on a fresh install. */
import type { TmdbMedium } from "$lib/types";

const STORAGE_KEY = "dossier:catalogue-mode";

export type CatalogueMode = "movies" | "tv";

/** Map the UI mode to a TMDB medium ("movies" → "movie"). */
export function toMedium(mode: CatalogueMode): TmdbMedium {
  return mode === "tv" ? "tv" : "movie";
}

function loadInitial(): CatalogueMode {
  if (typeof localStorage === "undefined") return "movies";
  const v = localStorage.getItem(STORAGE_KEY);
  return v === "tv" ? "tv" : "movies";
}

class CatalogueModeStore {
  mode = $state<CatalogueMode>(loadInitial());

  get medium(): TmdbMedium {
    return toMedium(this.mode);
  }

  set(mode: CatalogueMode): void {
    this.mode = mode;
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, mode);
    }
  }
}

export const catalogueMode = new CatalogueModeStore();
