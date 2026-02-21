import { type AuditEvent, type Category, type Compartment, type ConsentDecisionRecord, type ConsentRequest, type DismissedInference, type Disclosure, type ErasureReason, type EvidenceSummary, type Item, type ItemDetailsView, type ItemCompartment, type ItemProvenance, type RawArtifact, type ServiceRegistryEntry, type ServicePairing, type TopicBlockRule } from "@dossier/domain";
import type { PersistedState } from "./schema.js";
export declare class DossierRepository {
    private state;
    private readonly persist;
    constructor(state: PersistedState, persist: (next: PersistedState) => void);
    snapshot(): PersistedState;
    replaceState(next: PersistedState): void;
    private save;
    recordAuditEvent(input: {
        eventType: AuditEvent["event_type"];
        actor?: AuditEvent["actor"];
        serviceId?: string | null;
        itemId?: string | null;
        consentRequestId?: string | null;
        details?: Record<string, unknown>;
    }): void;
    private findItemIndex;
    private upsertTopicFlag;
    private setItemProvenance;
    private getItemProvenance;
    private getItemTopicFlag;
    private getItemCompartmentIds;
    addTopicRule(rule: Omit<TopicBlockRule, "created_at" | "updated_at">): TopicBlockRule;
    listTopicRules(): TopicBlockRule[];
    updateTopicRule(ruleId: string, patch: Partial<Pick<TopicBlockRule, "pattern" | "match_mode" | "scope" | "is_enabled">>): TopicBlockRule | null;
    removeTopicRule(ruleId: string): boolean;
    createManualItem(input: {
        text: string;
        itemType: string;
        categoryId: string | null;
    }): Item;
    createInference(input: {
        text: string;
        itemType: string;
        categoryId: string | null;
        createdVia: "CONNECTOR" | "IMPORT" | "CHAT";
        sourceLabel?: string;
        whyDossierThinksThis?: string | null;
        confidence?: number | null;
        evidenceSummaryId?: string | null;
    }): Item | null;
    updateItem(itemId: string, patch: Partial<Pick<Item, "text" | "item_type" | "category_id">>): Item | null;
    confirmInference(itemId: string): Item;
    editThenConfirmInference(itemId: string, editedText: string): Item;
    dismissInference(itemId: string, dismissReason?: string | null): DismissedInference;
    listItems(): Item[];
    listItemDetailsViews(): ItemDetailsView[];
    listCategories(): Category[];
    createCategory(input: {
        name: string;
        sortOrder?: number;
        isSystem?: boolean;
    }): Category;
    updateCategory(categoryId: string, patch: Partial<Pick<Category, "name" | "sort_order" | "is_system">>): Category | null;
    deleteCategory(categoryId: string): boolean;
    listCompartments(): Compartment[];
    createCompartment(input: {
        name: string;
        description?: string | null;
        sortOrder?: number;
    }): Compartment;
    updateCompartment(compartmentId: string, patch: Partial<Pick<Compartment, "name" | "description" | "sort_order">>): Compartment | null;
    deleteCompartment(compartmentId: string): boolean;
    setItemCompartments(itemId: string, compartmentIds: string[]): ItemCompartment[];
    listItemCompartments(itemId?: string): ItemCompartment[];
    addEvidenceSummary(input: {
        sourceLabel: string;
        summaryKind: string;
        summaryJson: Record<string, unknown>;
    }): EvidenceSummary;
    addRawArtifact(input: {
        sourceLabel: string;
        artifactKind: string;
        encryptedPayloadBase64: string;
        capturedAt: string | null;
    }): RawArtifact | null;
    listBlockedItemIds(): Set<string>;
    pairService(input: {
        serviceId: string;
        tokenHash: string;
        allowedOrigins: string[];
        tokenExpiresAt: string | null;
    }): ServicePairing;
    revokeService(serviceId: string): void;
    getPairingByTokenHash(tokenHash: string): ServicePairing | null;
    listServiceRegistry(): ServiceRegistryEntry[];
    listPairings(): ServicePairing[];
    createConsentRequest(input: unknown, serviceId: string): ConsentRequest;
    getConsentRequest(consentRequestId: string): ConsentRequest | null;
    buildConsentPreview(consentRequest: ConsentRequest): Item[];
    buildConsentPreviewView(consentRequest: ConsentRequest): Array<{
        item: Item;
        is_topic_blocked: boolean;
        blocked_by_rule_id: string | null;
        block_reason: string | null;
        default_allowed: boolean;
        compartment_ids: string[];
        provenance: ItemProvenance | null;
    }>;
    decideConsent(consentRequestId: string, decisionInput: unknown): ConsentDecisionRecord;
    createDisclosure(consentRequestId: string, payload: Record<string, unknown>): Disclosure;
    getDecision(consentRequestId: string): ConsentDecisionRecord | null;
    getDisclosurePayload(consentRequestId: string): Record<string, unknown> | null;
    listAudit(filters: {
        serviceId?: string;
        itemId?: string;
        type?: string | string[];
        dateFrom?: string;
        dateTo?: string;
    }): PersistedState["auditEvents"];
    addDismissedInference(dismissed: DismissedInference): void;
    deleteItemIrreversible(itemId: string, reason?: ErasureReason): boolean;
    setHighFidelityEnabled(enabled: boolean): void;
    updateProfileSettings(settings: Record<string, unknown>): void;
    recordRateLimit(key: string): number;
}
//# sourceMappingURL=repository.d.ts.map