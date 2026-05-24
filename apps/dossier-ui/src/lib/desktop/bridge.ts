import { invoke } from "@tauri-apps/api/core";
import type { DossierSettings, PairwiseChoice, PreferencesPayload, Rating } from "$lib/types";

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function installDesktopApi(): void {
  if (!isTauriRuntime() || window.dossier) {
    return;
  }

  window.dossier = {
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
      setRating: (filmId: number, rating: Rating | null): Promise<{ ratings: Record<string, Rating> }> =>
        invoke("preferences_set_rating", { filmId, rating }),
      addPairwise: (winnerId: number, loserId: number): Promise<{ pairwise: PairwiseChoice[] }> =>
        invoke("preferences_add_pairwise", { winnerId, loserId }),
      skip: (filmId: number): Promise<{ skipped: number[] }> =>
        invoke("preferences_skip", { filmId }),
      unskip: (filmId: number): Promise<{ skipped: number[] }> =>
        invoke("preferences_unskip", { filmId }),
      reset: (): Promise<{ ok: boolean }> => invoke("preferences_reset")
    }
  };
}
