import type { AuditEvent, ConsentDecisionRecord, ConsentRequest, DismissedInference, Item, ItemEditHistory } from "./types.js";
export declare function normalizeInferenceFingerprint(text: string, itemType: string): string;
export declare function canCreateInference(fingerprint: string, dismissed: DismissedInference[]): boolean;
export declare function manualCreateItem(params: {
    profileId: string;
    text: string;
    itemType: string;
    categoryId: string | null;
}): Item;
export declare function createInferenceItem(params: {
    profileId: string;
    text: string;
    itemType: string;
    categoryId: string | null;
    createdVia: "CONNECTOR" | "IMPORT" | "CHAT";
}): Item;
export declare function confirmInference(item: Item): Item;
export declare function editThenConfirmInference(item: Item, editedText: string): {
    item: Item;
    editHistory: ItemEditHistory;
};
export declare function dismissInference(item: Item, profileId: string, dismissReason: string | null): DismissedInference;
export declare function expireConsentRequest(request: ConsentRequest): ConsentRequest;
export declare function decideConsentRequest(request: ConsentRequest, decision: ConsentDecisionRecord): ConsentRequest;
export declare function auditEvent(params: Omit<AuditEvent, "event_id" | "timestamp">): AuditEvent;
//# sourceMappingURL=state-machines.d.ts.map