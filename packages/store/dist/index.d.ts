import { KeyManager } from "./key-manager.js";
import { DossierRepository } from "./repository.js";
export type BackupArtifact = {
    schemaVersion: number;
    createdAt: string;
    payloadBase64: string;
    checksum: string;
    lastVerifiedAt: string | null;
};
export declare class DossierStoreService {
    private readonly encryptedStore;
    readonly keyManager: KeyManager;
    readonly repository: DossierRepository;
    private readonly dataDir;
    private constructor();
    static init(dataDir: string): Promise<DossierStoreService>;
    getDataPath(...parts: string[]): string;
    createEncryptedExport(passphrase: string): BackupArtifact;
    importEncryptedExport(artifact: BackupArtifact, passphrase: string): void;
    verifyBackup(artifact: BackupArtifact): BackupArtifact;
}
export * from "./repository.js";
export * from "./key-manager.js";
//# sourceMappingURL=index.d.ts.map