/** The web build's library — the no-backend counterpart to the desktop's
 * keychain-encrypted store + Node control server. Everything runs in the
 * browser: state lives in a passphrase-encrypted "vault" file inside a
 * user-picked folder (File System Access), TMDB is called directly, and the
 * lens/recommender already run client-side.
 *
 * The vault holds the library AND its TMDB token; `exportLibrary()` emits a
 * token-free `.dossier` file — the only bridge to/from the desktop app. */
import {
  TmdbClient,
  createDefaultState,
  decryptWithPassphrase,
  encryptWithPassphrase,
  exportLibrary as exportLibraryEnvelope,
  importLibrary as importLibraryState,
  serializeEnvelope,
  type PairwiseChoice,
  type PersistedState,
  type Rating,
  type RatedItem,
  type RatingsMap,
  type TmdbMedium
} from "@dossier/domain";
import {
  ensurePermission,
  fileExists,
  getSavedDirectory,
  pickDirectory,
  readFile,
  writeFile,
  type FsDirectoryHandle
} from "./fs-access.js";

const VAULT_FILE = "dossier-library.vault.json";

/** Mirrors the desktop backend's defaultSettings so the UI hydrates the
 * same shape regardless of platform. */
const DEFAULT_SETTINGS: Record<string, unknown> = {
  theme: "system",
  dyslexiaMode: false,
  startOnLogin: false,
  autoUpdatesEnabled: true,
  skippedUpdateVersion: null,
  sidebarCollapsed: false,
  showingWelcome: true,
  groupedRecommendations: false,
  recommendationDials: {},
  refineGroupSize: 2
};

type WebVault = {
  state: PersistedState;
  tmdbToken: string | null;
};

class LockedError extends Error {
  constructor() {
    super("The web library is locked. Unlock it with your passphrase first.");
  }
}

class WebLibrary {
  private dir: FsDirectoryHandle | null = null;
  private passphrase: string | null = null;
  private vault: WebVault | null = null;
  private tmdbClientCache: { token: string; client: TmdbClient } | null = null;

  get unlocked(): boolean {
    return this.vault !== null && this.passphrase !== null && this.dir !== null;
  }

  /** True once a folder has been chosen in a previous session and it holds a
   * Dossier vault — i.e. the user is returning and should be asked to unlock
   * rather than set up. */
  async hasExistingLibrary(): Promise<boolean> {
    const dir = this.dir ?? (await getSavedDirectory());
    if (!dir) return false;
    if (!(await ensurePermission(dir))) return false;
    this.dir = dir;
    return fileExists(dir, VAULT_FILE);
  }

  /** First-run setup: pick a folder and create an empty, passphrase-encrypted
   * vault. */
  async setup(passphrase: string): Promise<void> {
    if (!passphrase) throw new Error("A passphrase is required");
    const dir = this.dir ?? (await pickDirectory());
    if (!(await ensurePermission(dir))) {
      throw new Error("Permission to access the chosen folder was denied.");
    }
    this.dir = dir;
    this.passphrase = passphrase;
    this.vault = { state: createDefaultState(), tmdbToken: null };
    this.vault.state.settings = { ...DEFAULT_SETTINGS };
    await this.save();
  }

  /** Returning-session unlock: re-acquire the folder and decrypt the vault. */
  async unlock(passphrase: string): Promise<void> {
    const dir = this.dir ?? (await getSavedDirectory()) ?? (await pickDirectory());
    if (!(await ensurePermission(dir))) {
      throw new Error("Permission to access the library folder was denied.");
    }
    this.dir = dir;

    const raw = await readFile(dir, VAULT_FILE);
    if (raw === null) {
      // Folder chosen but no vault yet → treat as first-run setup.
      this.passphrase = passphrase;
      this.vault = { state: createDefaultState(), tmdbToken: null };
      this.vault.state.settings = { ...DEFAULT_SETTINGS };
      await this.save();
      return;
    }

    // Throws PortableImportError on a wrong passphrase.
    this.vault = await decryptWithPassphrase<WebVault>(raw, passphrase);
    if (!this.vault.state) this.vault = { state: createDefaultState(), tmdbToken: null };
    this.passphrase = passphrase;
  }

  private requireVault(): WebVault {
    if (!this.vault || !this.passphrase || !this.dir) throw new LockedError();
    return this.vault;
  }

  private async save(): Promise<void> {
    if (!this.vault || !this.passphrase || !this.dir) throw new LockedError();
    const envelope = await encryptWithPassphrase(this.vault, this.passphrase);
    await writeFile(this.dir, VAULT_FILE, serializeEnvelope(envelope));
  }

  // --- settings -----------------------------------------------------------
  getSettings(): Record<string, unknown> {
    return { ...DEFAULT_SETTINGS, ...this.requireVault().state.settings };
  }

  async updateSettings(next: Record<string, unknown>): Promise<Record<string, unknown>> {
    const vault = this.requireVault();
    vault.state.settings = { ...vault.state.settings, ...next };
    await this.save();
    return this.getSettings();
  }

  // --- preferences --------------------------------------------------------
  getRatings(): RatingsMap {
    return { ...this.requireVault().state.ratings };
  }

  async setRating(key: string, rating: Rating | null, item?: RatedItem): Promise<RatingsMap> {
    const vault = this.requireVault();
    const ratings = { ...vault.state.ratings };
    if (rating === null) {
      delete ratings[key];
    } else if (item) {
      ratings[key] = { rating, item, ts: Date.now() };
    } else if (ratings[key]) {
      ratings[key] = { ...ratings[key], rating, ts: Date.now() };
    } else {
      throw new Error(`setRating(${key}): item snapshot required for a new rating`);
    }
    vault.state.ratings = ratings;
    await this.save();
    return this.getRatings();
  }

  getPairwise(): PairwiseChoice[] {
    return [...this.requireVault().state.pairwise];
  }

  async addPairwise(choice: PairwiseChoice): Promise<PairwiseChoice[]> {
    const vault = this.requireVault();
    vault.state.pairwise = [...vault.state.pairwise, choice];
    await this.save();
    return this.getPairwise();
  }

  getSkipped(): string[] {
    return [...this.requireVault().state.skipped];
  }

  async addSkipped(key: string): Promise<string[]> {
    const vault = this.requireVault();
    if (!vault.state.skipped.includes(key)) {
      vault.state.skipped = [...vault.state.skipped, key];
      await this.save();
    }
    return this.getSkipped();
  }

  async removeSkipped(key: string): Promise<string[]> {
    const vault = this.requireVault();
    if (vault.state.skipped.includes(key)) {
      vault.state.skipped = vault.state.skipped.filter((k) => k !== key);
      await this.save();
    }
    return this.getSkipped();
  }

  async resetPreferences(): Promise<void> {
    const vault = this.requireVault();
    vault.state.ratings = {};
    vault.state.pairwise = [];
    vault.state.skipped = [];
    await this.save();
  }

  // --- TMDB ---------------------------------------------------------------
  getTmdbToken(): string | null {
    return this.requireVault().tmdbToken;
  }

  async setTmdbToken(token: string): Promise<void> {
    const vault = this.requireVault();
    vault.tmdbToken = token;
    this.tmdbClientCache = null;
    await this.save();
  }

  async clearTmdbToken(): Promise<void> {
    const vault = this.requireVault();
    vault.tmdbToken = null;
    this.tmdbClientCache = null;
    await this.save();
  }

  /** A TMDB client for the stored token (browser: no disk cache; the client
   * keeps its own short in-memory cache). */
  tmdbClient(): TmdbClient {
    const token = this.getTmdbToken();
    if (!token) throw new Error("TMDB token is not configured");
    if (!this.tmdbClientCache || this.tmdbClientCache.token !== token) {
      this.tmdbClientCache = { token, client: new TmdbClient({ token }) };
    }
    return this.tmdbClientCache.client;
  }

  /** Build a transient client to validate a candidate token before storing. */
  validationClient(token: string): TmdbClient {
    return new TmdbClient({ token });
  }

  // --- library export / import -------------------------------------------
  /** Token-free portable `.dossier` file content. */
  async exportLibrary(passphrase: string): Promise<string> {
    return serializeEnvelope(await exportLibraryEnvelope(this.requireVault().state, passphrase));
  }

  async importLibrary(fileContent: string, passphrase: string): Promise<void> {
    const vault = this.requireVault();
    // Throws PortableImportError on a wrong passphrase / foreign file.
    vault.state = await importLibraryState(fileContent, passphrase);
    await this.save();
  }
}

/** Process-wide singleton — the web counterpart to the single backend store. */
export const webLibrary = new WebLibrary();

export type { TmdbMedium };
