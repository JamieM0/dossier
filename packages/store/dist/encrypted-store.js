import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { decryptJson, encryptJson } from "./crypto.js";
import { createDefaultState } from "./defaults.js";
const STORE_FILE = "store.enc.json";
export class EncryptedStore {
    dataPath;
    key;
    filePath;
    constructor(dataPath, key) {
        this.dataPath = dataPath;
        this.key = key;
        this.filePath = join(dataPath, STORE_FILE);
    }
    load() {
        if (!existsSync(this.filePath)) {
            return createDefaultState();
        }
        const raw = readFileSync(this.filePath, "utf8");
        const blob = JSON.parse(raw);
        return decryptJson(blob, this.key);
    }
    save(state) {
        mkdirSync(this.dataPath, { recursive: true });
        const blob = encryptJson(state, this.key);
        writeFileSync(this.filePath, JSON.stringify(blob, null, 2), { mode: 0o600 });
    }
}
//# sourceMappingURL=encrypted-store.js.map