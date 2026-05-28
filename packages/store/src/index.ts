import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { EncryptedStore } from "./encrypted-store.js";
import { KeyManager, TMDB_TOKEN_ACCOUNT } from "./key-manager.js";

export const SCHEMA_VERSION = 1;

/** A single film rating, encoded as a signed sentinel.
 *
 *  +1   = like           (full positive weight)
 *  -1   = dislike        (full negative weight)
 *  +0.5 = watchlist      ("Add to watchlist" — 50% positive weight)
 *  -0.5 = not_interested ("Don't show again" — stored as -0.5 but the
 *                          recommender maps this to -1 via ratingWeight(),
 *                          giving it the same effectiveness as dislike)
 *
 *  The stored value is a stable identity; ratingWeight() in the UI layer
 *  translates -0.5 → -1 for the weighted-sum recommender. This means old
 *  -0.5 records automatically get full negative weight without migration. */
export type Rating = -1 | -0.5 | 0.5 | 1;

export const RATING_LIKE: Rating = 1;
export const RATING_DISLIKE: Rating = -1;
export const RATING_WATCHLIST: Rating = 0.5;
export const RATING_NOT_INTERESTED: Rating = -0.5;

export function isValidRating(value: unknown): value is Rating {
  return value === 1 || value === -1 || value === 0.5 || value === -0.5;
}

/** A compact snapshot of a rated item, stored alongside its rating so
 * the taste profile and Library work fully offline — no TMDB re-fetch
 * needed to recompute the user's profile or render rated items. */
export type RatedItem = {
  /** "movie:27205" | "tv:1396" — medium-qualified to avoid TMDB's
   * movie/tv id-space collision. */
  key: string;
  medium: string;
  id: number;
  title: string;
  year: number | null;
  posterPath: string | null;
  voteAverage: number | null;
  genres: string[];
  /** Entertainment lens vector at rating time. */
  features: Record<string, number>;
};

export type RatingEntry = {
  rating: Rating;
  item: RatedItem;
  ts: number;
};

/** key -> rating entry. */
export type RatingsMap = Record<string, RatingEntry>;

export type PairwiseChoice = {
  /** item key of the preferred item */
  winnerKey: string;
  /** item key of the less-preferred item */
  loserKey: string;
  /** unix-ms timestamp */
  ts: number;
};

export type PersistedState = {
  schemaVersion: number;
  settings: Record<string, unknown>;
  /** itemKey -> rating entry. */
  ratings: RatingsMap;
  /** Append-only log of pairwise refinement choices. */
  pairwise: PairwiseChoice[];
  /** Item keys the user has explicitly skipped ("haven't seen"). Kept so
   * the rating queue doesn't re-show them next session. */
  skipped: string[];
};

function createDefaultState(): PersistedState {
  return {
    schemaVersion: SCHEMA_VERSION,
    settings: {},
    ratings: {},
    pairwise: [],
    skipped: []
  };
}

/** Merge missing top-level fields onto loaded state so older on-disk
 * files (written before ratings/pairwise/skipped existed) get filled in
 * with empty defaults instead of crashing the backend on read. */
function withDefaults(state: PersistedState): PersistedState {
  return {
    schemaVersion: state.schemaVersion ?? SCHEMA_VERSION,
    settings: state.settings ?? {},
    ratings: state.ratings ?? {},
    pairwise: state.pairwise ?? [],
    skipped: state.skipped ?? []
  };
}

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
}

export * from "./crypto.js";
export * from "./encrypted-store.js";
export * from "./key-manager.js";
