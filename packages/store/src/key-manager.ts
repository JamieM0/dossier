import { randomBytes, scryptSync, createHash } from "node:crypto";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const SERVICE = "Dossier";
const ACCOUNT = "master-key";

/** Keychain account name for the user's TMDB API read token. Stored in
 * the OS keychain alongside the master key — never written to disk in
 * plaintext and never bundled with the app (each user supplies their
 * own). */
export const TMDB_TOKEN_ACCOUNT = "tmdb-token";

async function getKeytar() {
  const keytar = await import("keytar");
  // In ESM, CJS modules are often wrapped in a 'default' property.
  return (keytar.default || keytar) as typeof import("keytar");
}

export class KeyManager {
  private readonly keyPath: string;

  constructor(dataPath: string) {
    this.keyPath = join(dataPath, "keys", "master.key");
  }

  async loadOrCreateMasterKey(): Promise<Buffer> {
    // Primary: OS keychain (macOS Keychain / Windows Credential Manager)
    const fromSecureStorage = await this.readFromSecureStorage();
    if (fromSecureStorage) {
      this.deletePlaintextKeyFile();
      return Buffer.from(fromSecureStorage, "base64");
    }

    // Legacy migration: plaintext file written by older versions of the app.
    // Migrate the key into the OS keychain and delete the file.
    if (existsSync(this.keyPath)) {
      const keyB64 = readFileSync(this.keyPath, "utf8");
      const migrated = await this.writeToSecureStorage(keyB64);
      if (migrated) {
        this.deletePlaintextKeyFile();
      }
      return Buffer.from(keyB64, "base64");
    }

    // Generate a new key. Require OS keychain — never fall back to plaintext.
    const master = randomBytes(32);
    const masterB64 = master.toString("base64");
    const stored = await this.writeToSecureStorage(masterB64);
    if (!stored) {
      throw new Error(
        "OS keychain is unavailable. Dossier requires secure storage to protect your encryption key."
      );
    }
    return master;
  }

  deriveExportKey(passphrase: string, salt: string): Buffer {
    return scryptSync(passphrase, salt, 32);
  }

  hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  /** Read an arbitrary named secret from the OS keychain (e.g. the TMDB
   * token). Returns null if unset or the keychain is unavailable. */
  async getSecret(account: string): Promise<string | null> {
    try {
      const keytar = await getKeytar();
      return await keytar.getPassword(SERVICE, account);
    } catch (err) {
      console.error(`[key-manager] getSecret(${account}) failed:`, err);
      return null;
    }
  }

  /** Store an arbitrary named secret in the OS keychain. Returns false
   * if the keychain is unavailable — callers decide whether that is
   * fatal (it is for the master key; it is surfaced as an error for the
   * TMDB token). */
  async setSecret(account: string, value: string): Promise<boolean> {
    try {
      const keytar = await getKeytar();
      await keytar.setPassword(SERVICE, account, value);
      return true;
    } catch (err) {
      console.error(`[key-manager] setSecret(${account}) failed:`, err);
      return false;
    }
  }

  /** Delete a named secret from the OS keychain. Best-effort. */
  async deleteSecret(account: string): Promise<boolean> {
    try {
      const keytar = await getKeytar();
      return await keytar.deletePassword(SERVICE, account);
    } catch (err) {
      console.error(`[key-manager] deleteSecret(${account}) failed:`, err);
      return false;
    }
  }

  private deletePlaintextKeyFile(): void {
    try {
      if (existsSync(this.keyPath)) {
        rmSync(this.keyPath);
      }
    } catch {
      // Best-effort cleanup; not fatal if the file is already gone.
    }
  }

  private async readFromSecureStorage(): Promise<string | null> {
    try {
      const keytar = await getKeytar();
      return await keytar.getPassword(SERVICE, ACCOUNT);
    } catch (err) {
      console.error("[key-manager] readFromSecureStorage failed:", err);
      return null;
    }
  }

  private async writeToSecureStorage(value: string): Promise<boolean> {
    try {
      const keytar = await getKeytar();
      await keytar.setPassword(SERVICE, ACCOUNT, value);
      return true;
    } catch (err) {
      console.error("[key-manager] writeToSecureStorage failed:", err);
      return false;
    }
  }
}
