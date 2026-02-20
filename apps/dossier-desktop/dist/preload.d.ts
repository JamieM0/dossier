declare const api: {
    app: {
        getVersion: () => Promise<string>;
    };
    window: {
        show: () => Promise<void>;
        hide: () => Promise<void>;
        quit: () => Promise<void>;
    };
    settings: {
        get: () => Promise<Record<string, unknown>>;
        set: (next: Record<string, unknown>) => Promise<Record<string, unknown>>;
    };
    profile: {
        listItems: () => Promise<unknown[]>;
        createManualItem: (payload: {
            text: string;
            itemType: string;
            categoryId: string | null;
        }) => Promise<unknown>;
    };
    data: {
        exportEncrypted: (passphrase: string) => Promise<unknown>;
        importEncrypted: (artifact: unknown, passphrase: string) => Promise<void>;
        runTakeoutImport: (path: string) => Promise<unknown>;
    };
    server: {
        health: () => Promise<unknown>;
    };
    consent: {
        onRequest: (callback: (request: unknown) => void) => (() => void);
    };
};
declare global {
    interface Window {
        dossier: typeof api;
    }
}
export {};
//# sourceMappingURL=preload.d.ts.map