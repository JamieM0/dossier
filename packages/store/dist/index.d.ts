import { KeyManager } from "./key-manager.js";
import { DossierRepository } from "./repository.js";
export type BackupArtifact = {
    schemaVersion: number;
    createdAt: string;
    payloadBase64: string;
    checksum: string;
    lastVerifiedAt: string | null;
};
export type LocalBackupSummary = {
    backupId: string;
    createdAt: string;
    schemaVersion: number;
    checksum: string;
    lastVerifiedAt: string | null;
    fileName: string;
    sizeBytes: number;
};
export declare class DossierStoreService {
    private readonly encryptedStore;
    readonly keyManager: KeyManager;
    readonly repository: DossierRepository;
    private readonly dataDir;
    private constructor();
    static init(dataDir: string): Promise<DossierStoreService>;
    getDataPath(...parts: string[]): string;
    private getBackupsDirPath;
    private toBackupSummary;
    private loadBackups;
    listLocalBackups(): LocalBackupSummary[];
    createLocalBackup(passphrase: string): LocalBackupSummary;
    verifyLocalBackup(backupId: string): LocalBackupSummary | null;
    restoreLocalBackup(backupId: string, passphrase: string): LocalBackupSummary | null;
    deleteProfileIrreversible(): {
        deleted: true;
        previousProfileId: string;
        nextProfileId: string;
    };
    createEncryptedExport(passphrase: string): BackupArtifact;
    importEncryptedExport(artifact: BackupArtifact, passphrase: string): void;
    verifyBackup(artifact: BackupArtifact): BackupArtifact;
}
export * from "./repository.js";
export * from "./key-manager.js";
export * from "./migrations.js";
//# sourceMappingURL=index.d.ts.map