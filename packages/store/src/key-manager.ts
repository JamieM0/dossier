import { randomBytes, scryptSync, createHash } from "node:crypto";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const SERVICE = "Dossier";
const ACCOUNT = "master-key";

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
      const keytar = await import("keytar");
      return await keytar.getPassword(SERVICE, ACCOUNT);
    } catch {
      return null;
    }
  }

  private async writeToSecureStorage(value: string): Promise<boolean> {
    try {
      const keytar = await import("keytar");
      await keytar.setPassword(SERVICE, ACCOUNT, value);
      return true;
    } catch {
      return false;
    }
  }
}
