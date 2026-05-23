import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { EncryptedStore } from "./encrypted-store.js";
import { KeyManager } from "./key-manager.js";

export const SCHEMA_VERSION = 1;

export type PersistedState = {
  schemaVersion: number;
  settings: Record<string, unknown>;
};

function createDefaultState(): PersistedState {
  return { schemaVersion: SCHEMA_VERSION, settings: {} };
}

export class DossierStoreService {
  private state: PersistedState;

  private constructor(
    private readonly dataDir: string,
    private readonly encryptedStore: EncryptedStore<PersistedState>,
    readonly keyManager: KeyManager,
    initialState: PersistedState
  ) {
    this.state = initialState;
  }

  static async init(dataDir: string): Promise<DossierStoreService> {
    mkdirSync(dataDir, { recursive: true });

    const keyManager = new KeyManager(dataDir);
    const masterKey = await keyManager.loadOrCreateMasterKey();
    const encryptedStore = new EncryptedStore<PersistedState>(dataDir, masterKey, createDefaultState);
    const state = encryptedStore.load();

    return new DossierStoreService(dataDir, encryptedStore, keyManager, state);
  }

  getDataPath(...parts: string[]): string {
    return join(this.dataDir, ...parts);
  }

  getSettings(): Record<string, unknown> {
    return { ...this.state.settings };
  }

  updateSettings(next: Record<string, unknown>): Record<string, unknown> {
    this.state = {
      ...this.state,
      settings: { ...this.state.settings, ...next }
    };
    this.encryptedStore.save(this.state);
    return this.getSettings();
  }
}

export * from "./crypto.js";
export * from "./encrypted-store.js";
export * from "./key-manager.js";
