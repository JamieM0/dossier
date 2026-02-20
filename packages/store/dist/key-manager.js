import { randomBytes, scryptSync, createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
const SERVICE = "Dossier";
const ACCOUNT = "master-key";
export class KeyManager {
    keyPath;
    constructor(dataPath) {
        this.keyPath = join(dataPath, "keys", "master.key");
    }
    async loadOrCreateMasterKey() {
        const fromSecureStorage = await this.readFromSecureStorage();
        if (fromSecureStorage) {
            return Buffer.from(fromSecureStorage, "base64");
        }
        if (existsSync(this.keyPath)) {
            return Buffer.from(readFileSync(this.keyPath, "utf8"), "base64");
        }
        const master = randomBytes(32);
        mkdirSync(dirname(this.keyPath), { recursive: true });
        writeFileSync(this.keyPath, master.toString("base64"), { mode: 0o600 });
        await this.writeToSecureStorage(master.toString("base64"));
        return master;
    }
    deriveExportKey(passphrase, salt) {
        return scryptSync(passphrase, salt, 32);
    }
    hashToken(token) {
        return createHash("sha256").update(token).digest("hex");
    }
    async readFromSecureStorage() {
        try {
            const keytar = await import("keytar");
            return await keytar.getPassword(SERVICE, ACCOUNT);
        }
        catch {
            return null;
        }
    }
    async writeToSecureStorage(value) {
        try {
            const keytar = await import("keytar");
            await keytar.setPassword(SERVICE, ACCOUNT, value);
        }
        catch {
            // Fallback file storage is used when secure storage is unavailable.
        }
    }
}
//# sourceMappingURL=key-manager.js.map