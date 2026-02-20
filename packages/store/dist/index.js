import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { decryptJson, encryptJson } from "./crypto.js";
import { EncryptedStore } from "./encrypted-store.js";
import { KeyManager } from "./key-manager.js";
import { DossierRepository } from "./repository.js";
export class DossierStoreService {
    encryptedStore;
    keyManager;
    repository;
    dataDir;
    constructor(dataDir, encryptedStore, keyManager, repository) {
        this.encryptedStore = encryptedStore;
        this.keyManager = keyManager;
        this.repository = repository;
        this.dataDir = dataDir;
    }
    static async init(dataDir) {
        mkdirSync(dataDir, { recursive: true });
        const keyManager = new KeyManager(dataDir);
        const masterKey = await keyManager.loadOrCreateMasterKey();
        const encryptedStore = new EncryptedStore(dataDir, masterKey);
        const state = encryptedStore.load();
        const repository = new DossierRepository(state, (next) => encryptedStore.save(next));
        return new DossierStoreService(dataDir, encryptedStore, keyManager, repository);
    }
    getDataPath(...parts) {
        return join(this.dataDir, ...parts);
    }
    createEncryptedExport(passphrase) {
        const salt = randomBytes(16).toString("base64");
        const key = this.keyManager.deriveExportKey(passphrase, salt);
        const snapshot = this.repository.snapshot();
        const encrypted = encryptJson(snapshot, key);
        const payload = JSON.stringify({ salt, encrypted });
        const checksum = createHash("sha256").update(payload).digest("hex");
        return {
            schemaVersion: 1,
            createdAt: new Date().toISOString(),
            payloadBase64: Buffer.from(payload, "utf8").toString("base64"),
            checksum,
            lastVerifiedAt: null
        };
    }
    importEncryptedExport(artifact, passphrase) {
        const payload = Buffer.from(artifact.payloadBase64, "base64").toString("utf8");
        const checksum = createHash("sha256").update(payload).digest("hex");
        if (checksum !== artifact.checksum) {
            throw new Error("Export checksum mismatch");
        }
        const parsed = JSON.parse(payload);
        const key = this.keyManager.deriveExportKey(passphrase, parsed.salt);
        const imported = decryptJson(parsed.encrypted, key);
        // Re-apply erasure ledger guarantees before activating restored state.
        const erased = new Set(imported.erasureLedger.filter((entry) => entry.entity_type === "ITEM").map((entry) => entry.entity_id));
        imported.items = imported.items.filter((item) => !erased.has(item.item_id));
        this.repository.replaceState(imported);
    }
    verifyBackup(artifact) {
        const payload = Buffer.from(artifact.payloadBase64, "base64").toString("utf8");
        const checksum = createHash("sha256").update(payload).digest("hex");
        if (checksum !== artifact.checksum) {
            throw new Error("Backup verification failed");
        }
        return {
            ...artifact,
            lastVerifiedAt: new Date().toISOString()
        };
    }
}
export * from "./repository.js";
export * from "./key-manager.js";
//# sourceMappingURL=index.js.map