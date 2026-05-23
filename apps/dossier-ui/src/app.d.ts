import type { DossierSettings } from "$lib/types";

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
    };
  }
}

export {};
