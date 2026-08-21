import type {
  DossierSettings,
  PairwiseChoice,
  PreferencesPayload,
  RatedItem,
  Rating,
  RatingEntry,
  TmdbCollectionResult,
  TmdbItem,
  TmdbListResult,
  TmdbMedium
} from "$lib/types";
import type { RemoteAccessStatus, RemoteTransport } from "$lib/types";

declare module "phosphor-icons-svelte";

declare global {
  interface Window {
    /** Injected by the host's dedicated remote gateway before the app bundle. */
    __DOSSIER_REMOTE__?: true;
    dossier?: {
      /** Which runtime is backing this bridge. "app" = the installed Tauri
       * desktop app (keychain-encrypted store, Node backend); "web" = the
       * no-install browser build (passphrase-encrypted File System Access
       * vault). UI differentiators gate on this. */
      platform: "app" | "web" | "remote";
      app: { getVersion: () => Promise<string> };
      window: { show: () => Promise<void>; hide: () => Promise<void>; quit: () => Promise<void> };
      updater: {
        installAndRestart: () => Promise<void>;
        /** Web-only active check against GitHub Releases (the desktop app is
         * notified instead, via the Tauri `update:available` event). Returns
         * the newer version + the currently running one, or null if already
         * current / the check failed. */
        checkForUpdate: () => Promise<{ version: string; currentVersion: string } | null>;
      };
      settings: {
        get: () => Promise<DossierSettings>;
        set: (next: Partial<DossierSettings>) => Promise<DossierSettings>;
        getStartOnLogin: () => Promise<boolean>;
        setStartOnLogin: (enabled: boolean) => Promise<boolean>;
      };
      remoteAccess?: {
        status: () => Promise<RemoteAccessStatus>;
        start: (transport: RemoteTransport, options?: Record<string, unknown>) => Promise<RemoteAccessStatus>;
        verify: () => Promise<RemoteAccessStatus>;
        approve: (id: string) => Promise<RemoteAccessStatus>;
        revoke: (id: string) => Promise<RemoteAccessStatus>;
        newPairingCode: () => Promise<RemoteAccessStatus>;
        stop: () => Promise<RemoteAccessStatus>;
        openAuthorizationUrl: (url: string) => Promise<void>;
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
        collection: (id: number, options?: { cacheOnly?: boolean }) => Promise<TmdbCollectionResult | null>;
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
