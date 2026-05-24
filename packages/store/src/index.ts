import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { EncryptedStore } from "./encrypted-store.js";
import { KeyManager } from "./key-manager.js";

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

export type RatingsMap = Record<string, Rating>;

export type PairwiseChoice = {
  /** film id of the preferred film */
  winnerId: number;
  /** film id of the less-preferred film */
  loserId: number;
  /** unix-ms timestamp */
  ts: number;
};

export type PersistedState = {
  schemaVersion: number;
  settings: Record<string, unknown>;
  /** filmId -> rating. Keyed by string for JSON portability. */
  ratings: RatingsMap;
  /** Append-only log of pairwise refinement choices. */
  pairwise: PairwiseChoice[];
  /** Film IDs the user has explicitly skipped ("haven't seen"). Kept so
   * the rating queue doesn't re-show them next session. */
  skipped: number[];
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

  setRating(filmId: number, rating: Rating | null): RatingsMap {
    const ratings = { ...this.state.ratings };
    const key = String(filmId);
    if (rating === null) {
      delete ratings[key];
    } else {
      ratings[key] = rating;
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

  getSkipped(): number[] {
    return [...this.state.skipped];
  }

  addSkipped(filmId: number): number[] {
    if (this.state.skipped.includes(filmId)) {
      return this.getSkipped();
    }
    this.state = { ...this.state, skipped: [...this.state.skipped, filmId] };
    this.encryptedStore.save(this.state);
    return this.getSkipped();
  }

  removeSkipped(filmId: number): number[] {
    if (!this.state.skipped.includes(filmId)) {
      return this.getSkipped();
    }
    this.state = {
      ...this.state,
      skipped: this.state.skipped.filter((id) => id !== filmId)
    };
    this.encryptedStore.save(this.state);
    return this.getSkipped();
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
