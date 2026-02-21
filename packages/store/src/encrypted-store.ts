import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { decryptJson, encryptJson, type EncryptedBlob } from "./crypto.js";
import { createDefaultState } from "./defaults.js";
import type { PersistedState } from "./schema.js";

const STORE_FILE = "store.enc.json";
const CORRUPT_STORE_PREFIX = "store.enc.corrupt";

export class EncryptedStore {
  private readonly filePath: string;

  constructor(private readonly dataPath: string, private readonly key: Buffer) {
    this.filePath = join(dataPath, STORE_FILE);
  }

  private quarantineUnreadableStore(error: unknown): void {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const quarantinePath = join(this.dataPath, `${CORRUPT_STORE_PREFIX}-${stamp}.json`);
    const reason = error instanceof Error ? error.message : "unknown";

    try {
      renameSync(this.filePath, quarantinePath);
      console.warn(`Unreadable encrypted store moved to ${quarantinePath}: ${reason}`);
    } catch (quarantineError) {
      const quarantineReason = quarantineError instanceof Error ? quarantineError.message : "unknown";
      console.warn(`Unreadable encrypted store could not be quarantined (${quarantineReason}): ${reason}`);
    }
  }

  load(): PersistedState {
    if (!existsSync(this.filePath)) {
      return createDefaultState();
    }

    const raw = readFileSync(this.filePath, "utf8");
    try {
      const blob = JSON.parse(raw) as EncryptedBlob;
      return decryptJson<PersistedState>(blob, this.key);
    } catch (error) {
      this.quarantineUnreadableStore(error);
      return createDefaultState();
    }
  }

  save(state: PersistedState): void {
    mkdirSync(this.dataPath, { recursive: true });
    const blob = encryptJson(state, this.key);
    writeFileSync(this.filePath, JSON.stringify(blob, null, 2), { mode: 0o600 });
  }
}
