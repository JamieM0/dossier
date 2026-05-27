/** Which medium the user is browsing: movies or TV. Affects which
 * catalogue feeds Recommendations / Rate / Refine / Library.
 *
 * Persisted via localStorage so the choice survives reloads. Default
 * is "movies" on a fresh install. */
const STORAGE_KEY = "dossier:catalogue-mode";

export type CatalogueMode = "movies" | "tv";

function loadInitial(): CatalogueMode {
  if (typeof localStorage === "undefined") return "movies";
  const v = localStorage.getItem(STORAGE_KEY);
  return v === "tv" ? "tv" : "movies";
}

class CatalogueModeStore {
  mode = $state<CatalogueMode>(loadInitial());

  set(mode: CatalogueMode): void {
    this.mode = mode;
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, mode);
    }
  }
}

export const catalogueMode = new CatalogueModeStore();
