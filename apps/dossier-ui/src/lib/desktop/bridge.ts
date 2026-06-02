import { invoke } from "@tauri-apps/api/core";
import { installWebApi } from "./web/index.js";
import type {
  DossierSettings,
  PairwiseChoice,
  PreferencesPayload,
  RatedItem,
  Rating,
  RatingEntry,
  TmdbListResult,
  TmdbItem,
  TmdbMedium
} from "$lib/types";

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/** Build a poster URL for the Rust `tmdbimg` cache scheme. The webview
 * exposes custom schemes differently per platform: Windows serves them
 * as `http://<scheme>.localhost/...`, macOS/Linux as `<scheme>://...`.
 * Returns null when there is no poster. */
function posterUrl(posterPath: string | null, size = "w780"): string | null {
  if (!posterPath) return null;
  const file = posterPath.replace(/^\//, "");
  const isWindows =
    typeof navigator !== "undefined" && /Windows/i.test(navigator.userAgent);
  return isWindows
    ? `http://tmdbimg.localhost/${size}/${file}`
    : `tmdbimg://localhost/${size}/${file}`;
}

export function installDesktopApi(): void {
  if (!isTauriRuntime() || window.dossier) {
    return;
  }

  window.dossier = {
    platform: "app",
    app: {
      getVersion: (): Promise<string> => invoke("app_get_version")
    },
    window: {
      show: (): Promise<void> => invoke("window_show"),
      hide: (): Promise<void> => invoke("window_hide"),
      quit: (): Promise<void> => invoke("window_quit")
    },
    updater: {
      installAndRestart: (): Promise<void> => invoke("update_install_and_restart")
    },
    settings: {
      get: (): Promise<DossierSettings> => invoke("settings_get"),
      set: (next: Partial<DossierSettings>): Promise<DossierSettings> => invoke("settings_set", { next }),
      getStartOnLogin: (): Promise<boolean> => invoke("settings_get_start_on_login"),
      setStartOnLogin: (enabled: boolean): Promise<boolean> => invoke("settings_set_start_on_login", { enabled })
    },
    preferences: {
      get: (): Promise<PreferencesPayload> => invoke("preferences_get"),
      setRating: (
        key: string,
        rating: Rating | null,
        item?: RatedItem
      ): Promise<{ ratings: Record<string, RatingEntry> }> =>
        invoke("preferences_set_rating", { key, rating, item: item ?? null }),
      addPairwise: (winnerKey: string, loserKey: string): Promise<{ pairwise: PairwiseChoice[] }> =>
        invoke("preferences_add_pairwise", { winnerKey, loserKey }),
      skip: (key: string): Promise<{ skipped: string[] }> =>
        invoke("preferences_skip", { key }),
      unskip: (key: string): Promise<{ skipped: string[] }> =>
        invoke("preferences_unskip", { key }),
      reset: (): Promise<{ ok: boolean }> => invoke("preferences_reset")
    },
    tmdb: {
      status: (): Promise<{ configured: boolean }> => invoke("tmdb_status"),
      setToken: (token: string): Promise<{ configured: boolean }> =>
        invoke("tmdb_set_token", { token }),
      clearToken: (): Promise<{ configured: boolean }> => invoke("tmdb_clear_token"),
      genres: (medium: TmdbMedium): Promise<{ genres: Record<string, string> }> =>
        invoke("tmdb_genres", { medium }),
      trending: (medium: TmdbMedium, page = 1): Promise<TmdbListResult> =>
        invoke("tmdb_trending", { medium, page }),
      discover: (
        medium: TmdbMedium,
        params: { sortBy?: string; withGenres?: string; minVotes?: number; page?: number } = {}
      ): Promise<TmdbListResult> =>
        invoke("tmdb_discover", {
          medium,
          sortBy: params.sortBy ?? null,
          withGenres: params.withGenres ?? null,
          minVotes: params.minVotes ?? null,
          page: params.page ?? null
        }),
      search: (medium: TmdbMedium, query: string, year?: number): Promise<TmdbListResult> =>
        invoke("tmdb_search", { medium, query, year: year ?? null }),
      detail: (medium: TmdbMedium, id: number): Promise<TmdbItem> =>
        invoke("tmdb_detail", { medium, id }),
      posterUrl
    },
    library: {
      export: (passphrase: string): Promise<string> =>
        invoke("library_export", { passphrase }),
      import: (fileContent: string, passphrase: string): Promise<void> =>
        invoke("library_import", { fileContent, passphrase })
    }
  };
}

/** Install the right `window.dossier` bridge for the current runtime: the
 * Tauri desktop bridge inside the app, or the no-backend web bridge in a
 * plain browser. Called once at layout init. */
export function installBridge(): void {
  if (isTauriRuntime()) {
    installDesktopApi();
  } else {
    installWebApi();
  }
}
