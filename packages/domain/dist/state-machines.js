import { createHash, randomUUID } from "node:crypto";
function nowIso() {
    return new Date().toISOString();
}
export function normalizeInferenceFingerprint(text, itemType) {
    const normalized = `${itemType.toLowerCase()}::${text.trim().toLowerCase().replace(/\s+/g, " ")}`;
    return createHash("sha256").update(normalized).digest("hex");
}
export function canCreateInference(fingerprint, dismissed) {
    return !dismissed.some((entry) => entry.fingerprint === fingerprint);
}
export function manualCreateItem(params) {
    const timestamp = nowIso();
    return {
        item_id: randomUUID(),
        profile_id: params.profileId,
        state: "CONFIRMED",
        text: params.text,
        item_type: params.itemType,
        category_id: params.categoryId,
        created_at: timestamp,
        updated_at: timestamp,
        created_via: "MANUAL",
        source_visibility: "DETAILS_ONLY"
    };
}
export function createInferenceItem(params) {
    const timestamp = nowIso();
    return {
        item_id: randomUUID(),
        profile_id: params.profileId,
        state: "INFERENCE_PENDING",
        text: params.text,
        item_type: params.itemType,
        category_id: params.categoryId,
        created_at: timestamp,
        updated_at: timestamp,
        created_via: params.createdVia,
        source_visibility: "DETAILS_ONLY"
    };
}
export function confirmInference(item) {
    if (item.state !== "INFERENCE_PENDING") {
        throw new Error("Only INFERENCE_PENDING items can be confirmed");
    }
    return {
        ...item,
        state: "CONFIRMED",
        updated_at: nowIso()
    };
}
export function editThenConfirmInference(item, editedText) {
    if (item.state !== "INFERENCE_PENDING") {
        throw new Error("Only INFERENCE_PENDING items can be edited then confirmed");
    }
    const editedAt = nowIso();
    return {
        item: {
            ...item,
            text: editedText,
            state: "CONFIRMED",
            updated_at: editedAt
        },
        editHistory: {
            edit_id: randomUUID(),
            item_id: item.item_id,
            edited_at: editedAt,
            editor: "USER",
            before_text: item.text,
            after_text: editedText
        }
    };
}
export function dismissInference(item, profileId, dismissReason) {
    if (item.state !== "INFERENCE_PENDING") {
        throw new Error("Only INFERENCE_PENDING items can be dismissed");
    }
    const timestamp = nowIso();
    const fingerprint = normalizeInferenceFingerprint(item.text, item.item_type);
    return {
        dismissed_id: randomUUID(),
        profile_id: profileId,
        fingerprint,
        normalised_text: item.text.trim().toLowerCase(),
        dismissed_at: timestamp,
        dismiss_reason: dismissReason,
        evidence_summary_id: null
    };
}
export function expireConsentRequest(request) {
    if (request.state !== "PENDING") {
        return request;
    }
    const now = new Date();
    const expires = request.expires_at ? new Date(request.expires_at) : null;
    if (!expires || now < expires) {
        return request;
    }
    return {
        ...request,
        state: "EXPIRED"
    };
}
export function decideConsentRequest(request, decision) {
    if (request.state !== "PENDING") {
        throw new Error("Consent request is no longer pending");
    }
    void decision;
    return {
        ...request,
        state: "DECIDED"
    };
}
export function auditEvent(params) {
    return {
        ...params,
        event_id: randomUUID(),
        timestamp: nowIso()
    };
}
//# sourceMappingURL=state-machines.js.map