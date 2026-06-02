import { mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  createDefaultState,
  exportLibrary,
  importLibrary,
  serializeEnvelope,
  withDefaults,
  type PairwiseChoice,
  type PersistedState,
  type Rating,
  type RatedItem,
  type RatingsMap
} from "@dossier/domain";
import { EncryptedStore } from "./encrypted-store.js";
import { KeyManager, TMDB_TOKEN_ACCOUNT } from "./key-manager.js";

export class DossierStoreService {
  private state: PersistedState;

  private constructor(
    private readonly dataDir: string,
    private readonly encryptedStore: EncryptedStore<PersistedState>,
    readonly keyManager: KeyManager,
    initialState: PersistedState
  ) {
    this.state = withDefaults(initialState);
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

  getRatings(): RatingsMap {
    return { ...this.state.ratings };
  }

  /** Set or clear a rating. `item` is required when setting (the snapshot
   * stored with the rating); pass rating=null to clear. */
  setRating(key: string, rating: Rating | null, item?: RatedItem): RatingsMap {
    const ratings = { ...this.state.ratings };
    if (rating === null) {
      delete ratings[key];
    } else if (item) {
      ratings[key] = { rating, item, ts: Date.now() };
    } else if (ratings[key]) {
      // Update the rating value while keeping the existing snapshot.
      ratings[key] = { ...ratings[key], rating, ts: Date.now() };
    } else {
      throw new Error(`setRating(${key}): item snapshot required for a new rating`);
    }
    this.state = { ...this.state, ratings };
    this.encryptedStore.save(this.state);
    return this.getRatings();
  }

  getPairwise(): PairwiseChoice[] {
    return [...this.state.pairwise];
  }

  addPairwise(choice: PairwiseChoice): PairwiseChoice[] {
    this.state = { ...this.state, pairwise: [...this.state.pairwise, choice] };
    this.encryptedStore.save(this.state);
    return this.getPairwise();
  }

  getSkipped(): string[] {
    return [...this.state.skipped];
  }

  addSkipped(key: string): string[] {
    if (this.state.skipped.includes(key)) {
      return this.getSkipped();
    }
    this.state = { ...this.state, skipped: [...this.state.skipped, key] };
    this.encryptedStore.save(this.state);
    return this.getSkipped();
  }

  removeSkipped(key: string): string[] {
    if (!this.state.skipped.includes(key)) {
      return this.getSkipped();
    }
    this.state = {
      ...this.state,
      skipped: this.state.skipped.filter((k) => k !== key)
    };
    this.encryptedStore.save(this.state);
    return this.getSkipped();
  }

  /** The user's TMDB API read token from the OS keychain, or null if
   * they haven't configured one yet. */
  getTmdbToken(): Promise<string | null> {
    return this.keyManager.getSecret(TMDB_TOKEN_ACCOUNT);
  }

  /** Persist the user's TMDB token to the OS keychain. Throws if the
   * keychain is unavailable — we never fall back to plaintext for
   * secrets. */
  async setTmdbToken(token: string): Promise<void> {
    const ok = await this.keyManager.setSecret(TMDB_TOKEN_ACCOUNT, token);
    if (!ok) {
      throw new Error(
        "OS keychain is unavailable. Dossier needs secure storage to save your TMDB token."
      );
    }
  }

  /** Remove the stored TMDB token. */
  async clearTmdbToken(): Promise<void> {
    await this.keyManager.deleteSecret(TMDB_TOKEN_ACCOUNT);
  }

  /** Wipe all preference data (ratings, pairwise, skipped). Settings
   * are preserved so theme/sidebar state survives a reset. */
  resetPreferences(): void {
    this.state = { ...this.state, ratings: {}, pairwise: [], skipped: [] };
    this.encryptedStore.save(this.state);
  }

  /** Encrypt the entire library into a portable, passphrase-protected
   * `.dossier` file (the only bridge to/from the web build). */
  async exportLibrary(passphrase: string): Promise<string> {
    return serializeEnvelope(await exportLibrary(this.state, passphrase));
  }

  /** Replace the current library with the contents of a `.dossier` file.
   * Throws (PortableImportError) on a wrong passphrase or malformed file. */
  async importLibrary(fileContent: string, passphrase: string): Promise<void> {
    const imported = await importLibrary(fileContent, passphrase);
    this.state = withDefaults(imported);
    this.encryptedStore.save(this.state);
  }
}

export { createTmdbClient, FsTmdbCache } from "./tmdb-node.js";
export * from "@dossier/domain";
export * from "./crypto.js";
export * from "./encrypted-store.js";
export * from "./key-manager.js";
