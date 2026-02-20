export declare class KeyManager {
    private readonly keyPath;
    constructor(dataPath: string);
    loadOrCreateMasterKey(): Promise<Buffer>;
    deriveExportKey(passphrase: string, salt: string): Buffer;
    hashToken(token: string): string;
    private readFromSecureStorage;
    private writeToSecureStorage;
}
//# sourceMappingURL=key-manager.d.ts.map