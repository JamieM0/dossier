import type {
  DossierSettings,
  PairwiseChoice,
  PreferencesPayload,
  RatedItem,
  Rating,
  RatingEntry,
  TmdbItem,
  TmdbListResult,
  TmdbMedium
} from "$lib/types";

declare module "phosphor-icons-svelte";

declare global {
  interface Window {
    dossier?: {
      /** Which runtime is backing this bridge. "app" = the installed Tauri
       * desktop app (keychain-encrypted store, Node backend); "web" = the
       * no-install browser build (passphrase-encrypted File System Access
       * vault). UI differentiators gate on this. */
      platform: "app" | "web";
      app: { getVersion: () => Promise<string> };
      window: { show: () => Promise<void>; hide: () => Promise<void>; quit: () => Promise<void> };
      updater: {
        installAndRestart: () => Promise<void>;
      };
      settings: {
        get: () => Promise<DossierSettings>;
        set: (next: Partial<DossierSettings>) => Promise<DossierSettings>;
        getStartOnLogin: () => Promise<boolean>;
        setStartOnLogin: (enabled: boolean) => Promise<boolean>;
      };
      preferences: {
        get: () => Promise<PreferencesPayload>;
        setRating: (
          key: string,
          rating: Rating | null,
          item?: RatedItem
        ) => Promise<{ ratings: Record<string, RatingEntry> }>;
        addPairwise: (winnerKey: string, loserKey: string) => Promise<{ pairwise: PairwiseChoice[] }>;
        skip: (key: string) => Promise<{ skipped: string[] }>;
        unskip: (key: string) => Promise<{ skipped: string[] }>;
        reset: () => Promise<{ ok: boolean }>;
      };
      tmdb: {
        status: () => Promise<{ configured: boolean }>;
        setToken: (token: string) => Promise<{ configured: boolean }>;
        clearToken: () => Promise<{ configured: boolean }>;
        genres: (medium: TmdbMedium) => Promise<{ genres: Record<string, string> }>;
        trending: (medium: TmdbMedium, page?: number) => Promise<TmdbListResult>;
        discover: (
          medium: TmdbMedium,
          params?: { sortBy?: string; withGenres?: string; minVotes?: number; page?: number }
        ) => Promise<TmdbListResult>;
        search: (medium: TmdbMedium, query: string, year?: number) => Promise<TmdbListResult>;
        detail: (medium: TmdbMedium, id: number) => Promise<TmdbItem>;
        posterUrl: (posterPath: string | null, size?: string) => string | null;
      };
      /** Portable, passphrase-encrypted library export/import — the only
       * bridge between the desktop app's library and the web build's. */
      library: {
        export: (passphrase: string) => Promise<string>;
        import: (fileContent: string, passphrase: string) => Promise<void>;
      };
    };
  }
}

export {};
