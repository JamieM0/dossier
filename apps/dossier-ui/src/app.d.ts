import type { ProfileItem } from "$lib/types";

declare module "phosphor-icons-svelte";

declare global {
  interface Window {
    dossier?: {
      app: { getVersion: () => Promise<string> };
      window: { show: () => Promise<void>; hide: () => Promise<void>; quit: () => Promise<void> };
      settings: {
        get: () => Promise<Record<string, unknown>>;
        set: (next: Record<string, unknown>) => Promise<Record<string, unknown>>;
      };
      profile: {
        listItems: () => Promise<ProfileItem[]>;
        createManualItem: (payload: { text: string; itemType: string; categoryId: string | null }) => Promise<ProfileItem>;
      };
      data: {
        exportEncrypted: (passphrase: string) => Promise<unknown>;
        importEncrypted: (artifact: unknown, passphrase: string) => Promise<void>;
        runTakeoutImport: (path: string) => Promise<unknown>;
      };
      server: { health: () => Promise<unknown> };
      consent: { onRequest: (callback: (request: unknown) => void) => () => void };
    };
  }
}

export {};
