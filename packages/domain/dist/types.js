import { z } from "zod";
export const itemStateSchema = z.enum(["CONFIRMED", "INFERENCE_PENDING"]);
export const createdViaSchema = z.enum(["MANUAL", "CONNECTOR", "CHAT", "IMPORT"]);
export const sourceKindSchema = z.enum(["MANUAL", "CONNECTOR"]);
export const policyModeSchema = z.enum(["ALWAYS_ASK", "SCOPED_AUTO_APPROVAL", "NEVER_ALLOW"]);
export const consentStateSchema = z.enum(["PENDING", "DECIDED", "EXPIRED"]);
export const consentDecisionSchema = z.enum(["ALLOW", "DECLINE"]);
export const overrideTypeSchema = z.enum(["ALLOW_BLOCKED_ITEM_ONCE"]);
export const eventTypeSchema = z.enum([
    "ITEM_CREATED",
    "ITEM_EDITED",
    "ITEM_DELETED",
    "INFERENCE_CREATED",
    "INFERENCE_CONFIRMED",
    "INFERENCE_DISMISSED",
    "INFERENCE_SUPPRESSED",
    "TOPIC_BLOCK_ADDED",
    "TOPIC_BLOCK_REMOVED",
    "TOPIC_BLOCK_TOGGLED",
    "COMPARTMENT_CREATED",
    "COMPARTMENT_EDITED",
    "COMPARTMENT_DELETED",
    "ITEM_COMPARTMENT_CHANGED",
    "SERVICE_PAIRED",
    "SERVICE_REVOKED",
    "SERVICE_POLICY_CHANGED",
    "CONSENT_REQUEST_RECEIVED",
    "CONSENT_DECIDED",
    "DISCLOSURE_SENT",
    "DISCLOSURE_BLOCKED_ITEM_OVERRIDDEN",
    "OUTPUT_USED_ITEM",
    "BACKUP_CREATED",
    "BACKUP_VERIFIED",
    "BACKUP_RESTORED"
]);
export const actorSchema = z.enum(["USER", "SYSTEM", "EXTERNAL_SERVICE"]);
export const erasureReasonSchema = z.enum(["USER_DELETE", "HF_MODE_DISABLED", "RETENTION_POLICY", "MIGRATION"]);
export const entityTypeSchema = z.enum(["ITEM", "RAW_ARTIFACT", "EVIDENCE_SUMMARY", "OTHER"]);
export const profileSchema = z.object({
    profile_id: z.string().uuid(),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
    schema_version: z.number().int().positive(),
    high_fidelity_enabled: z.boolean(),
    profile_settings_json: z.record(z.unknown()).optional()
});
export const itemSchema = z.object({
    item_id: z.string().uuid(),
    profile_id: z.string().uuid(),
    state: itemStateSchema,
    text: z.string().min(1),
    item_type: z.string().min(1),
    category_id: z.string().uuid().nullable(),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
    created_via: createdViaSchema,
    source_visibility: z.literal("DETAILS_ONLY")
});
export const itemTopicFlagSchema = z.object({
    item_id: z.string().uuid(),
    is_topic_blocked: z.boolean(),
    blocked_by_rule_id: z.string().uuid().nullable(),
    block_reason: z.string().nullable(),
    storage_override: z.enum(["NONE", "MANUAL_ALLOWED"])
});
export const itemProvenanceSchema = z.object({
    item_id: z.string().uuid(),
    source_label: z.string(),
    source_kind: sourceKindSchema,
    why_dossier_thinks_this: z.string().nullable(),
    confidence: z.number().min(0).max(1).nullable(),
    evidence_summary_id: z.string().uuid().nullable()
});
export const itemEditHistorySchema = z.object({
    edit_id: z.string().uuid(),
    item_id: z.string().uuid(),
    edited_at: z.string().datetime(),
    editor: z.enum(["USER", "SYSTEM"]),
    before_text: z.string(),
    after_text: z.string()
});
export const dismissedInferenceSchema = z.object({
    dismissed_id: z.string().uuid(),
    profile_id: z.string().uuid(),
    fingerprint: z.string(),
    normalised_text: z.string(),
    dismissed_at: z.string().datetime(),
    dismiss_reason: z.string().nullable(),
    evidence_summary_id: z.string().uuid().nullable()
});
export const evidenceSummarySchema = z.object({
    evidence_summary_id: z.string().uuid(),
    profile_id: z.string().uuid(),
    source_label: z.string(),
    summary_kind: z.string(),
    summary_json: z.record(z.unknown()),
    created_at: z.string().datetime()
});
export const rawArtifactSchema = z.object({
    raw_artifact_id: z.string().uuid(),
    profile_id: z.string().uuid(),
    source_label: z.string(),
    artifact_kind: z.string(),
    artifact_payload_encrypted: z.string(),
    captured_at: z.string().datetime().nullable(),
    ingested_at: z.string().datetime()
});
export const topicBlockRuleSchema = z.object({
    rule_id: z.string().uuid(),
    profile_id: z.string().uuid(),
    pattern: z.string().min(1),
    match_mode: z.enum(["EXACT", "PHRASE", "KEYWORD", "REGEX"]),
    scope: z.enum(["STORAGE", "SHARING", "STORAGE_AND_SHARING"]),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
    is_enabled: z.boolean()
});
export const servicePairingSchema = z.object({
    pairing_id: z.string().uuid(),
    service_id: z.string().uuid(),
    paired_at: z.string().datetime(),
    revoked_at: z.string().datetime().nullable(),
    scoped_bearer_token_hash: z.string(),
    token_expires_at: z.string().datetime().nullable(),
    allowed_origins_json: z.array(z.string().url())
});
export const consentRequestSchema = z.object({
    consent_request_id: z.string().uuid(),
    service_id: z.string().uuid(),
    purpose: z.string().min(1).max(500),
    requested_compartment_ids_json: z.array(z.string().uuid()),
    requested_item_ids_json: z.array(z.string().uuid()),
    created_at: z.string().datetime(),
    expires_at: z.string().datetime().nullable(),
    state: consentStateSchema,
    nonce: z.string().min(16)
});
export const consentDecisionRecordSchema = z.object({
    consent_request_id: z.string().uuid(),
    decided_at: z.string().datetime(),
    decision: consentDecisionSchema,
    allowed_item_ids_json: z.array(z.string().uuid()),
    redactions_json: z.array(z.string()).nullable()
});
export const consentOverrideSchema = z.object({
    override_id: z.string().uuid(),
    consent_request_id: z.string().uuid(),
    item_id: z.string().uuid(),
    override_type: overrideTypeSchema,
    created_at: z.string().datetime()
});
export const disclosureSchema = z.object({
    disclosure_id: z.string().uuid(),
    consent_request_id: z.string().uuid(),
    sent_at: z.string().datetime(),
    payload_hash: z.string(),
    payload_encrypted: z.string()
});
export const auditEventSchema = z.object({
    event_id: z.string().uuid(),
    profile_id: z.string().uuid(),
    timestamp: z.string().datetime(),
    event_type: eventTypeSchema,
    actor: actorSchema,
    service_id: z.string().uuid().nullable(),
    item_id: z.string().uuid().nullable(),
    consent_request_id: z.string().uuid().nullable(),
    details_json: z.record(z.unknown())
});
export const erasureLedgerEntrySchema = z.object({
    erasure_id: z.string().uuid(),
    profile_id: z.string().uuid(),
    entity_type: entityTypeSchema,
    entity_id: z.string().uuid(),
    erased_at: z.string().datetime(),
    reason: erasureReasonSchema,
    details_json: z.record(z.unknown()).nullable()
});
export const createConsentRequestInputSchema = z.object({
    purpose: z.string().min(1).max(500),
    requested_compartment_ids: z.array(z.string().uuid()).optional().default([]),
    requested_item_ids: z.array(z.string().uuid()).optional().default([]),
    nonce: z.string().min(16)
});
export const consentDecisionInputSchema = z.object({
    decision: consentDecisionSchema,
    allowed_item_ids: z.array(z.string().uuid()),
    blocked_item_overrides: z.array(z.string().uuid()).default([])
});
//# sourceMappingURL=types.js.map