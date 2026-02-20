import { type ConsentDecisionRecord, type ConsentRequest, type DismissedInference, type Disclosure, type ErasureReason, type EvidenceSummary, type Item, type RawArtifact, type ServicePairing, type TopicBlockRule } from "@dossier/domain";
import type { PersistedState } from "./schema.js";
export declare class DossierRepository {
    private state;
    private readonly persist;
    constructor(state: PersistedState, persist: (next: PersistedState) => void);
    snapshot(): PersistedState;
    replaceState(next: PersistedState): void;
    private save;
    addTopicRule(rule: Omit<TopicBlockRule, "created_at" | "updated_at">): TopicBlockRule;
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
    }): Item | null;
    listItems(): Item[];
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
    createConsentRequest(input: unknown, serviceId: string): ConsentRequest;
    getConsentRequest(consentRequestId: string): ConsentRequest | null;
    buildConsentPreview(consentRequest: ConsentRequest): Item[];
    decideConsent(consentRequestId: string, decisionInput: unknown): ConsentDecisionRecord;
    createDisclosure(consentRequestId: string, payload: Record<string, unknown>): Disclosure;
    getDecision(consentRequestId: string): ConsentDecisionRecord | null;
    getDisclosurePayload(consentRequestId: string): Record<string, unknown> | null;
    listAudit(filters: {
        serviceId?: string;
        itemId?: string;
        type?: string;
    }): PersistedState["auditEvents"];
    addDismissedInference(dismissed: DismissedInference): void;
    deleteItemIrreversible(itemId: string, reason?: ErasureReason): boolean;
    setHighFidelityEnabled(enabled: boolean): void;
    updateProfileSettings(settings: Record<string, unknown>): void;
    recordRateLimit(key: string): number;
}
//# sourceMappingURL=repository.d.ts.map