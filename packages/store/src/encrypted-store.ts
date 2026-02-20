import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { decryptJson, encryptJson, type EncryptedBlob } from "./crypto.js";
import { createDefaultState } from "./defaults.js";
import type { PersistedState } from "./schema.js";

const STORE_FILE = "store.enc.json";

export class EncryptedStore {
  private readonly filePath: string;

  constructor(private readonly dataPath: string, private readonly key: Buffer) {
    this.filePath = join(dataPath, STORE_FILE);
  }

  load(): PersistedState {
    if (!existsSync(this.filePath)) {
      return createDefaultState();
    }

    const raw = readFileSync(this.filePath, "utf8");
    const blob = JSON.parse(raw) as EncryptedBlob;
    return decryptJson<PersistedState>(blob, this.key);
  }

  save(state: PersistedState): void {
    mkdirSync(this.dataPath, { recursive: true });
    const blob = encryptJson(state, this.key);
    writeFileSync(this.filePath, JSON.stringify(blob, null, 2), { mode: 0o600 });
  }
}
