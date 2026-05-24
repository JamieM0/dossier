import type {
  DossierSettings,
  PairwiseChoice,
  PreferencesPayload,
  Rating
} from "$lib/types";

declare module "phosphor-icons-svelte";

declare global {
  interface Window {
    dossier?: {
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
        setRating: (filmId: number, rating: Rating | null) => Promise<{ ratings: Record<string, Rating> }>;
        addPairwise: (winnerId: number, loserId: number) => Promise<{ pairwise: PairwiseChoice[] }>;
        skip: (filmId: number) => Promise<{ skipped: number[] }>;
        unskip: (filmId: number) => Promise<{ skipped: number[] }>;
        reset: () => Promise<{ ok: boolean }>;
      };
    };
  }
}

export {};
