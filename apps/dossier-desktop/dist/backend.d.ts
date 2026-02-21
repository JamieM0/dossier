import { type IncomingMessage, type ServerResponse } from "node:http";
type RepositoryPort = {
    snapshot: () => {
        profile: {
            profile_id: string;
            profile_settings_json?: Record<string, unknown>;
        };
    };
    setHighFidelityEnabled: (enabled: boolean) => void;
    updateProfileSettings: (settings: Record<string, unknown>) => void;
    listItems: () => unknown[];
    listItemDetailsViews: () => Array<{
        item: unknown;
        provenance: unknown | null;
        topic: unknown | null;
        compartment_ids: string[];
    }>;
    createManualItem: (input: {
        text: string;
        itemType: string;
        categoryId: string | null;
    }) => unknown;
    createInference: (input: {
        text: string;
        itemType: string;
        categoryId: string | null;
        createdVia: "CONNECTOR" | "IMPORT" | "CHAT";
        sourceLabel?: string;
        whyDossierThinksThis?: string | null;
        confidence?: number | null;
        evidenceSummaryId?: string | null;
    }) => unknown | null;
    updateItem: (itemId: string, patch: Partial<{
        text: string;
        item_type: string;
        category_id: string | null;
    }>) => unknown | null;
    deleteItemIrreversible: (itemId: string, reason?: "USER_DELETE" | "HF_MODE_DISABLED" | "RETENTION_POLICY" | "MIGRATION") => boolean;
    confirmInference: (itemId: string) => unknown;
    editThenConfirmInference: (itemId: string, editedText: string) => unknown;
    dismissInference: (itemId: string, dismissReason?: string | null) => unknown;
    listTopicRules: () => unknown[];
    addTopicRule: (rule: {
        rule_id: string;
        profile_id: string;
        pattern: string;
        match_mode: "EXACT" | "PHRASE" | "KEYWORD" | "REGEX";
        scope: "STORAGE" | "SHARING" | "STORAGE_AND_SHARING";
        is_enabled: boolean;
    }) => unknown;
    updateTopicRule: (ruleId: string, patch: Partial<{
        pattern: string;
        match_mode: "EXACT" | "PHRASE" | "KEYWORD" | "REGEX";
        scope: "STORAGE" | "SHARING" | "STORAGE_AND_SHARING";
        is_enabled: boolean;
    }>) => unknown | null;
    removeTopicRule: (ruleId: string) => boolean;
    listCategories: () => unknown[];
    createCategory: (input: {
        name: string;
        sortOrder?: number;
        isSystem?: boolean;
    }) => unknown;
    updateCategory: (categoryId: string, patch: Partial<{
        name: string;
        sort_order: number;
        is_system: boolean;
    }>) => unknown | null;
    deleteCategory: (categoryId: string) => boolean;
    listCompartments: () => unknown[];
    createCompartment: (input: {
        name: string;
        description?: string | null;
        sortOrder?: number;
    }) => unknown;
    updateCompartment: (compartmentId: string, patch: Partial<{
        name: string;
        description: string | null;
        sort_order: number;
    }>) => unknown | null;
    deleteCompartment: (compartmentId: string) => boolean;
    setItemCompartments: (itemId: string, compartmentIds: string[]) => unknown;
    listItemCompartments: (itemId?: string) => unknown;
    listServiceRegistry: () => Array<{
        service_id: string;
        identifier: string;
        display_name: string;
        icon_url: string | null;
        description: string | null;
        created_at: string;
        updated_at: string;
    }>;
    listPairings: () => Array<{
        pairing_id: string;
        service_id: string;
        paired_at: string;
        revoked_at: string | null;
        scoped_bearer_token_hash: string;
        token_expires_at: string | null;
        allowed_origins_json: string[];
    }>;
    revokeService: (serviceId: string) => void;
    getConsentRequest: (requestId: string) => unknown | null;
    buildConsentPreview: (request: unknown) => unknown[];
    buildConsentPreviewView: (request: unknown) => Array<{
        item: unknown;
        is_topic_blocked: boolean;
        blocked_by_rule_id: string | null;
        block_reason: string | null;
        default_allowed: boolean;
        compartment_ids: string[];
        provenance: unknown | null;
    }>;
    decideConsent: (requestId: string, payload: unknown) => unknown;
    listAudit: (filters: {
        serviceId?: string;
        itemId?: string;
        type?: string | string[];
        dateFrom?: string;
        dateTo?: string;
    }) => unknown[];
};
type StoreServicePort = {
    repository: RepositoryPort;
    createEncryptedExport: (passphrase: string) => unknown;
    importEncryptedExport: (artifact: unknown, passphrase: string) => void;
    listLocalBackups: () => unknown[];
    createLocalBackup: (passphrase: string) => unknown;
    verifyLocalBackup: (backupId: string) => unknown | null;
    restoreLocalBackup: (backupId: string, passphrase: string) => unknown | null;
    deleteProfileIrreversible: () => {
        deleted: true;
        previousProfileId: string;
        nextProfileId: string;
    };
};
export declare function createControlRequestHandler(options: {
    storeService: StoreServicePort;
    runGoogleTakeoutImport: (store: unknown, rootPath: string) => unknown;
}): (req: IncomingMessage, res: ServerResponse) => Promise<void>;
export {};
//# sourceMappingURL=backend.d.ts.map