import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { decryptJson, encryptJson } from "./crypto.js";
import { createDefaultState } from "./defaults.js";
import { EncryptedStore } from "./encrypted-store.js";
import { KeyManager } from "./key-manager.js";
import { migratePersistedState } from "./migrations.js";
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
        const state = migratePersistedState(encryptedStore.load());
        const repository = new DossierRepository(state, (next) => encryptedStore.save(next));
        return new DossierStoreService(dataDir, encryptedStore, keyManager, repository);
    }
    getDataPath(...parts) {
        return join(this.dataDir, ...parts);
    }
    getBackupsDirPath() {
        return this.getDataPath("backups");
    }
    toBackupSummary(record) {
        return {
            backupId: record.backupId,
            createdAt: record.artifact.createdAt,
            schemaVersion: record.artifact.schemaVersion,
            checksum: record.artifact.checksum,
            lastVerifiedAt: record.artifact.lastVerifiedAt,
            fileName: record.fileName,
            sizeBytes: record.sizeBytes
        };
    }
    loadBackups() {
        const backupsDir = this.getBackupsDirPath();
        if (!existsSync(backupsDir)) {
            return [];
        }
        const records = [];
        for (const fileName of readdirSync(backupsDir)) {
            if (!fileName.endsWith(".json")) {
                continue;
            }
            const filePath = join(backupsDir, fileName);
            try {
                const raw = readFileSync(filePath, "utf8");
                const parsed = JSON.parse(raw);
                if (!parsed.backupId || !parsed.artifact) {
                    continue;
                }
                const sizeBytes = statSync(filePath).size;
                records.push({
                    backupId: parsed.backupId,
                    artifact: parsed.artifact,
                    fileName,
                    filePath,
                    sizeBytes
                });
            }
            catch {
                continue;
            }
        }
        return records.sort((a, b) => Date.parse(b.artifact.createdAt) - Date.parse(a.artifact.createdAt));
    }
    listLocalBackups() {
        return this.loadBackups().map((record) => this.toBackupSummary(record));
    }
    createLocalBackup(passphrase) {
        const artifact = this.createEncryptedExport(passphrase);
        const backupId = randomUUID();
        const fileSafeStamp = artifact.createdAt.replace(/[:.]/g, "-");
        const fileName = `${fileSafeStamp}-${backupId}.json`;
        const backupsDir = this.getBackupsDirPath();
        const filePath = join(backupsDir, fileName);
        mkdirSync(backupsDir, { recursive: true });
        const envelope = { backupId, artifact };
        writeFileSync(filePath, JSON.stringify(envelope, null, 2), "utf8");
        const sizeBytes = statSync(filePath).size;
        this.repository.recordAuditEvent({
            eventType: "BACKUP_CREATED",
            actor: "USER",
            details: { backup_id: backupId, checksum: artifact.checksum, file_name: fileName }
        });
        return this.toBackupSummary({ backupId, artifact, fileName, sizeBytes });
    }
    verifyLocalBackup(backupId) {
        const record = this.loadBackups().find((candidate) => candidate.backupId === backupId);
        if (!record) {
            return null;
        }
        const verified = this.verifyBackup(record.artifact);
        const envelope = { backupId, artifact: verified };
        writeFileSync(record.filePath, JSON.stringify(envelope, null, 2), "utf8");
        const sizeBytes = statSync(record.filePath).size;
        this.repository.recordAuditEvent({
            eventType: "BACKUP_VERIFIED",
            actor: "USER",
            details: { backup_id: backupId, checksum: verified.checksum, file_name: record.fileName }
        });
        return this.toBackupSummary({
            backupId,
            artifact: verified,
            fileName: record.fileName,
            sizeBytes
        });
    }
    restoreLocalBackup(backupId, passphrase) {
        const record = this.loadBackups().find((candidate) => candidate.backupId === backupId);
        if (!record) {
            return null;
        }
        this.importEncryptedExport(record.artifact, passphrase);
        this.repository.recordAuditEvent({
            eventType: "BACKUP_RESTORED",
            actor: "USER",
            details: { backup_id: backupId, checksum: record.artifact.checksum, file_name: record.fileName }
        });
        return this.toBackupSummary(record);
    }
    deleteProfileIrreversible() {
        const previousProfileId = this.repository.snapshot().profile.profile_id;
        this.repository.replaceState(createDefaultState());
        rmSync(this.getBackupsDirPath(), { recursive: true, force: true });
        return {
            deleted: true,
            previousProfileId,
            nextProfileId: this.repository.snapshot().profile.profile_id
        };
    }
    createEncryptedExport(passphrase) {
        const salt = randomBytes(16).toString("base64");
        const key = this.keyManager.deriveExportKey(passphrase, salt);
        const snapshot = this.repository.snapshot();
        const encrypted = encryptJson(snapshot, key);
        const payload = JSON.stringify({ salt, encrypted });
        const checksum = createHash("sha256").update(payload).digest("hex");
        return {
            schemaVersion: snapshot.profile.schema_version,
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
        const imported = migratePersistedState(decryptJson(parsed.encrypted, key));
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
export * from "./migrations.js";
//# sourceMappingURL=index.js.map