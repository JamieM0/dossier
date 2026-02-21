import type { PersistedState } from "./schema.js";
export declare class EncryptedStore {
    private readonly dataPath;
    private readonly key;
    private readonly filePath;
    constructor(dataPath: string, key: Buffer);
    private quarantineUnreadableStore;
    load(): PersistedState;
    save(state: PersistedState): void;
}
//# sourceMappingURL=encrypted-store.d.ts.map