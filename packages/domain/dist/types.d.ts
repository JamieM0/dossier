import { z } from "zod";
export declare const itemStateSchema: z.ZodEnum<["CONFIRMED", "INFERENCE_PENDING"]>;
export type ItemState = z.infer<typeof itemStateSchema>;
export declare const createdViaSchema: z.ZodEnum<["MANUAL", "CONNECTOR", "CHAT", "IMPORT"]>;
export type CreatedVia = z.infer<typeof createdViaSchema>;
export declare const sourceKindSchema: z.ZodEnum<["MANUAL", "CONNECTOR"]>;
export type SourceKind = z.infer<typeof sourceKindSchema>;
export declare const policyModeSchema: z.ZodEnum<["ALWAYS_ASK", "SCOPED_AUTO_APPROVAL", "NEVER_ALLOW"]>;
export type PolicyMode = z.infer<typeof policyModeSchema>;
export declare const consentStateSchema: z.ZodEnum<["PENDING", "DECIDED", "EXPIRED"]>;
export type ConsentState = z.infer<typeof consentStateSchema>;
export declare const consentDecisionSchema: z.ZodEnum<["ALLOW", "DECLINE"]>;
export type ConsentDecisionType = z.infer<typeof consentDecisionSchema>;
export declare const overrideTypeSchema: z.ZodEnum<["ALLOW_BLOCKED_ITEM_ONCE"]>;
export type OverrideType = z.infer<typeof overrideTypeSchema>;
export declare const eventTypeSchema: z.ZodEnum<["ITEM_CREATED", "ITEM_EDITED", "ITEM_DELETED", "INFERENCE_CREATED", "INFERENCE_CONFIRMED", "INFERENCE_DISMISSED", "INFERENCE_SUPPRESSED", "TOPIC_BLOCK_ADDED", "TOPIC_BLOCK_REMOVED", "TOPIC_BLOCK_TOGGLED", "COMPARTMENT_CREATED", "COMPARTMENT_EDITED", "COMPARTMENT_DELETED", "ITEM_COMPARTMENT_CHANGED", "SERVICE_PAIRED", "SERVICE_REVOKED", "SERVICE_POLICY_CHANGED", "CONSENT_REQUEST_RECEIVED", "CONSENT_DECIDED", "DISCLOSURE_SENT", "DISCLOSURE_BLOCKED_ITEM_OVERRIDDEN", "OUTPUT_USED_ITEM", "BACKUP_CREATED", "BACKUP_VERIFIED", "BACKUP_RESTORED"]>;
export type AuditEventType = z.infer<typeof eventTypeSchema>;
export declare const actorSchema: z.ZodEnum<["USER", "SYSTEM", "EXTERNAL_SERVICE"]>;
export type ActorType = z.infer<typeof actorSchema>;
export declare const erasureReasonSchema: z.ZodEnum<["USER_DELETE", "HF_MODE_DISABLED", "RETENTION_POLICY", "MIGRATION"]>;
export type ErasureReason = z.infer<typeof erasureReasonSchema>;
export declare const entityTypeSchema: z.ZodEnum<["ITEM", "RAW_ARTIFACT", "EVIDENCE_SUMMARY", "OTHER"]>;
export type EntityType = z.infer<typeof entityTypeSchema>;
export declare const profileSchema: z.ZodObject<{
    profile_id: z.ZodString;
    created_at: z.ZodString;
    updated_at: z.ZodString;
    schema_version: z.ZodNumber;
    high_fidelity_enabled: z.ZodBoolean;
    profile_settings_json: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    profile_id: string;
    created_at: string;
    updated_at: string;
    schema_version: number;
    high_fidelity_enabled: boolean;
    profile_settings_json?: Record<string, unknown> | undefined;
}, {
    profile_id: string;
    created_at: string;
    updated_at: string;
    schema_version: number;
    high_fidelity_enabled: boolean;
    profile_settings_json?: Record<string, unknown> | undefined;
}>;
export type Profile = z.infer<typeof profileSchema>;
export declare const itemSchema: z.ZodObject<{
    item_id: z.ZodString;
    profile_id: z.ZodString;
    state: z.ZodEnum<["CONFIRMED", "INFERENCE_PENDING"]>;
    text: z.ZodString;
    item_type: z.ZodString;
    category_id: z.ZodNullable<z.ZodString>;
    created_at: z.ZodString;
    updated_at: z.ZodString;
    created_via: z.ZodEnum<["MANUAL", "CONNECTOR", "CHAT", "IMPORT"]>;
    source_visibility: z.ZodLiteral<"DETAILS_ONLY">;
}, "strip", z.ZodTypeAny, {
    profile_id: string;
    created_at: string;
    updated_at: string;
    item_id: string;
    state: "CONFIRMED" | "INFERENCE_PENDING";
    text: string;
    item_type: string;
    category_id: string | null;
    created_via: "MANUAL" | "CONNECTOR" | "CHAT" | "IMPORT";
    source_visibility: "DETAILS_ONLY";
}, {
    profile_id: string;
    created_at: string;
    updated_at: string;
    item_id: string;
    state: "CONFIRMED" | "INFERENCE_PENDING";
    text: string;
    item_type: string;
    category_id: string | null;
    created_via: "MANUAL" | "CONNECTOR" | "CHAT" | "IMPORT";
    source_visibility: "DETAILS_ONLY";
}>;
export type Item = z.infer<typeof itemSchema>;
export declare const itemTopicFlagSchema: z.ZodObject<{
    item_id: z.ZodString;
    is_topic_blocked: z.ZodBoolean;
    blocked_by_rule_id: z.ZodNullable<z.ZodString>;
    block_reason: z.ZodNullable<z.ZodString>;
    storage_override: z.ZodEnum<["NONE", "MANUAL_ALLOWED"]>;
}, "strip", z.ZodTypeAny, {
    item_id: string;
    is_topic_blocked: boolean;
    blocked_by_rule_id: string | null;
    block_reason: string | null;
    storage_override: "NONE" | "MANUAL_ALLOWED";
}, {
    item_id: string;
    is_topic_blocked: boolean;
    blocked_by_rule_id: string | null;
    block_reason: string | null;
    storage_override: "NONE" | "MANUAL_ALLOWED";
}>;
export type ItemTopicFlag = z.infer<typeof itemTopicFlagSchema>;
export declare const itemProvenanceSchema: z.ZodObject<{
    item_id: z.ZodString;
    source_label: z.ZodString;
    source_kind: z.ZodEnum<["MANUAL", "CONNECTOR"]>;
    why_dossier_thinks_this: z.ZodNullable<z.ZodString>;
    confidence: z.ZodNullable<z.ZodNumber>;
    evidence_summary_id: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    item_id: string;
    source_label: string;
    source_kind: "MANUAL" | "CONNECTOR";
    why_dossier_thinks_this: string | null;
    confidence: number | null;
    evidence_summary_id: string | null;
}, {
    item_id: string;
    source_label: string;
    source_kind: "MANUAL" | "CONNECTOR";
    why_dossier_thinks_this: string | null;
    confidence: number | null;
    evidence_summary_id: string | null;
}>;
export type ItemProvenance = z.infer<typeof itemProvenanceSchema>;
export declare const itemEditHistorySchema: z.ZodObject<{
    edit_id: z.ZodString;
    item_id: z.ZodString;
    edited_at: z.ZodString;
    editor: z.ZodEnum<["USER", "SYSTEM"]>;
    before_text: z.ZodString;
    after_text: z.ZodString;
}, "strip", z.ZodTypeAny, {
    item_id: string;
    edit_id: string;
    edited_at: string;
    editor: "USER" | "SYSTEM";
    before_text: string;
    after_text: string;
}, {
    item_id: string;
    edit_id: string;
    edited_at: string;
    editor: "USER" | "SYSTEM";
    before_text: string;
    after_text: string;
}>;
export type ItemEditHistory = z.infer<typeof itemEditHistorySchema>;
export declare const dismissedInferenceSchema: z.ZodObject<{
    dismissed_id: z.ZodString;
    profile_id: z.ZodString;
    fingerprint: z.ZodString;
    normalised_text: z.ZodString;
    dismissed_at: z.ZodString;
    dismiss_reason: z.ZodNullable<z.ZodString>;
    evidence_summary_id: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    profile_id: string;
    evidence_summary_id: string | null;
    dismissed_id: string;
    fingerprint: string;
    normalised_text: string;
    dismissed_at: string;
    dismiss_reason: string | null;
}, {
    profile_id: string;
    evidence_summary_id: string | null;
    dismissed_id: string;
    fingerprint: string;
    normalised_text: string;
    dismissed_at: string;
    dismiss_reason: string | null;
}>;
export type DismissedInference = z.infer<typeof dismissedInferenceSchema>;
export declare const evidenceSummarySchema: z.ZodObject<{
    evidence_summary_id: z.ZodString;
    profile_id: z.ZodString;
    source_label: z.ZodString;
    summary_kind: z.ZodString;
    summary_json: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    created_at: z.ZodString;
}, "strip", z.ZodTypeAny, {
    profile_id: string;
    created_at: string;
    source_label: string;
    evidence_summary_id: string;
    summary_kind: string;
    summary_json: Record<string, unknown>;
}, {
    profile_id: string;
    created_at: string;
    source_label: string;
    evidence_summary_id: string;
    summary_kind: string;
    summary_json: Record<string, unknown>;
}>;
export type EvidenceSummary = z.infer<typeof evidenceSummarySchema>;
export declare const rawArtifactSchema: z.ZodObject<{
    raw_artifact_id: z.ZodString;
    profile_id: z.ZodString;
    source_label: z.ZodString;
    artifact_kind: z.ZodString;
    artifact_payload_encrypted: z.ZodString;
    captured_at: z.ZodNullable<z.ZodString>;
    ingested_at: z.ZodString;
}, "strip", z.ZodTypeAny, {
    profile_id: string;
    source_label: string;
    raw_artifact_id: string;
    artifact_kind: string;
    artifact_payload_encrypted: string;
    captured_at: string | null;
    ingested_at: string;
}, {
    profile_id: string;
    source_label: string;
    raw_artifact_id: string;
    artifact_kind: string;
    artifact_payload_encrypted: string;
    captured_at: string | null;
    ingested_at: string;
}>;
export type RawArtifact = z.infer<typeof rawArtifactSchema>;
export declare const topicBlockRuleSchema: z.ZodObject<{
    rule_id: z.ZodString;
    profile_id: z.ZodString;
    pattern: z.ZodString;
    match_mode: z.ZodEnum<["EXACT", "PHRASE", "KEYWORD", "REGEX"]>;
    scope: z.ZodEnum<["STORAGE", "SHARING", "STORAGE_AND_SHARING"]>;
    created_at: z.ZodString;
    updated_at: z.ZodString;
    is_enabled: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    profile_id: string;
    created_at: string;
    updated_at: string;
    rule_id: string;
    pattern: string;
    match_mode: "EXACT" | "PHRASE" | "KEYWORD" | "REGEX";
    scope: "STORAGE" | "SHARING" | "STORAGE_AND_SHARING";
    is_enabled: boolean;
}, {
    profile_id: string;
    created_at: string;
    updated_at: string;
    rule_id: string;
    pattern: string;
    match_mode: "EXACT" | "PHRASE" | "KEYWORD" | "REGEX";
    scope: "STORAGE" | "SHARING" | "STORAGE_AND_SHARING";
    is_enabled: boolean;
}>;
export type TopicBlockRule = z.infer<typeof topicBlockRuleSchema>;
export declare const servicePairingSchema: z.ZodObject<{
    pairing_id: z.ZodString;
    service_id: z.ZodString;
    paired_at: z.ZodString;
    revoked_at: z.ZodNullable<z.ZodString>;
    scoped_bearer_token_hash: z.ZodString;
    token_expires_at: z.ZodNullable<z.ZodString>;
    allowed_origins_json: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    pairing_id: string;
    service_id: string;
    paired_at: string;
    revoked_at: string | null;
    scoped_bearer_token_hash: string;
    token_expires_at: string | null;
    allowed_origins_json: string[];
}, {
    pairing_id: string;
    service_id: string;
    paired_at: string;
    revoked_at: string | null;
    scoped_bearer_token_hash: string;
    token_expires_at: string | null;
    allowed_origins_json: string[];
}>;
export type ServicePairing = z.infer<typeof servicePairingSchema>;
export declare const consentRequestSchema: z.ZodObject<{
    consent_request_id: z.ZodString;
    service_id: z.ZodString;
    purpose: z.ZodString;
    requested_compartment_ids_json: z.ZodArray<z.ZodString, "many">;
    requested_item_ids_json: z.ZodArray<z.ZodString, "many">;
    created_at: z.ZodString;
    expires_at: z.ZodNullable<z.ZodString>;
    state: z.ZodEnum<["PENDING", "DECIDED", "EXPIRED"]>;
    nonce: z.ZodString;
}, "strip", z.ZodTypeAny, {
    created_at: string;
    state: "PENDING" | "DECIDED" | "EXPIRED";
    service_id: string;
    consent_request_id: string;
    purpose: string;
    requested_compartment_ids_json: string[];
    requested_item_ids_json: string[];
    expires_at: string | null;
    nonce: string;
}, {
    created_at: string;
    state: "PENDING" | "DECIDED" | "EXPIRED";
    service_id: string;
    consent_request_id: string;
    purpose: string;
    requested_compartment_ids_json: string[];
    requested_item_ids_json: string[];
    expires_at: string | null;
    nonce: string;
}>;
export type ConsentRequest = z.infer<typeof consentRequestSchema>;
export declare const consentDecisionRecordSchema: z.ZodObject<{
    consent_request_id: z.ZodString;
    decided_at: z.ZodString;
    decision: z.ZodEnum<["ALLOW", "DECLINE"]>;
    allowed_item_ids_json: z.ZodArray<z.ZodString, "many">;
    redactions_json: z.ZodNullable<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    consent_request_id: string;
    decided_at: string;
    decision: "ALLOW" | "DECLINE";
    allowed_item_ids_json: string[];
    redactions_json: string[] | null;
}, {
    consent_request_id: string;
    decided_at: string;
    decision: "ALLOW" | "DECLINE";
    allowed_item_ids_json: string[];
    redactions_json: string[] | null;
}>;
export type ConsentDecisionRecord = z.infer<typeof consentDecisionRecordSchema>;
export declare const consentOverrideSchema: z.ZodObject<{
    override_id: z.ZodString;
    consent_request_id: z.ZodString;
    item_id: z.ZodString;
    override_type: z.ZodEnum<["ALLOW_BLOCKED_ITEM_ONCE"]>;
    created_at: z.ZodString;
}, "strip", z.ZodTypeAny, {
    created_at: string;
    item_id: string;
    consent_request_id: string;
    override_id: string;
    override_type: "ALLOW_BLOCKED_ITEM_ONCE";
}, {
    created_at: string;
    item_id: string;
    consent_request_id: string;
    override_id: string;
    override_type: "ALLOW_BLOCKED_ITEM_ONCE";
}>;
export type ConsentOverride = z.infer<typeof consentOverrideSchema>;
export declare const disclosureSchema: z.ZodObject<{
    disclosure_id: z.ZodString;
    consent_request_id: z.ZodString;
    sent_at: z.ZodString;
    payload_hash: z.ZodString;
    payload_encrypted: z.ZodString;
}, "strip", z.ZodTypeAny, {
    consent_request_id: string;
    disclosure_id: string;
    sent_at: string;
    payload_hash: string;
    payload_encrypted: string;
}, {
    consent_request_id: string;
    disclosure_id: string;
    sent_at: string;
    payload_hash: string;
    payload_encrypted: string;
}>;
export type Disclosure = z.infer<typeof disclosureSchema>;
export declare const auditEventSchema: z.ZodObject<{
    event_id: z.ZodString;
    profile_id: z.ZodString;
    timestamp: z.ZodString;
    event_type: z.ZodEnum<["ITEM_CREATED", "ITEM_EDITED", "ITEM_DELETED", "INFERENCE_CREATED", "INFERENCE_CONFIRMED", "INFERENCE_DISMISSED", "INFERENCE_SUPPRESSED", "TOPIC_BLOCK_ADDED", "TOPIC_BLOCK_REMOVED", "TOPIC_BLOCK_TOGGLED", "COMPARTMENT_CREATED", "COMPARTMENT_EDITED", "COMPARTMENT_DELETED", "ITEM_COMPARTMENT_CHANGED", "SERVICE_PAIRED", "SERVICE_REVOKED", "SERVICE_POLICY_CHANGED", "CONSENT_REQUEST_RECEIVED", "CONSENT_DECIDED", "DISCLOSURE_SENT", "DISCLOSURE_BLOCKED_ITEM_OVERRIDDEN", "OUTPUT_USED_ITEM", "BACKUP_CREATED", "BACKUP_VERIFIED", "BACKUP_RESTORED"]>;
    actor: z.ZodEnum<["USER", "SYSTEM", "EXTERNAL_SERVICE"]>;
    service_id: z.ZodNullable<z.ZodString>;
    item_id: z.ZodNullable<z.ZodString>;
    consent_request_id: z.ZodNullable<z.ZodString>;
    details_json: z.ZodRecord<z.ZodString, z.ZodUnknown>;
}, "strip", z.ZodTypeAny, {
    profile_id: string;
    item_id: string | null;
    service_id: string | null;
    consent_request_id: string | null;
    event_id: string;
    timestamp: string;
    event_type: "ITEM_CREATED" | "ITEM_EDITED" | "ITEM_DELETED" | "INFERENCE_CREATED" | "INFERENCE_CONFIRMED" | "INFERENCE_DISMISSED" | "INFERENCE_SUPPRESSED" | "TOPIC_BLOCK_ADDED" | "TOPIC_BLOCK_REMOVED" | "TOPIC_BLOCK_TOGGLED" | "COMPARTMENT_CREATED" | "COMPARTMENT_EDITED" | "COMPARTMENT_DELETED" | "ITEM_COMPARTMENT_CHANGED" | "SERVICE_PAIRED" | "SERVICE_REVOKED" | "SERVICE_POLICY_CHANGED" | "CONSENT_REQUEST_RECEIVED" | "CONSENT_DECIDED" | "DISCLOSURE_SENT" | "DISCLOSURE_BLOCKED_ITEM_OVERRIDDEN" | "OUTPUT_USED_ITEM" | "BACKUP_CREATED" | "BACKUP_VERIFIED" | "BACKUP_RESTORED";
    actor: "USER" | "SYSTEM" | "EXTERNAL_SERVICE";
    details_json: Record<string, unknown>;
}, {
    profile_id: string;
    item_id: string | null;
    service_id: string | null;
    consent_request_id: string | null;
    event_id: string;
    timestamp: string;
    event_type: "ITEM_CREATED" | "ITEM_EDITED" | "ITEM_DELETED" | "INFERENCE_CREATED" | "INFERENCE_CONFIRMED" | "INFERENCE_DISMISSED" | "INFERENCE_SUPPRESSED" | "TOPIC_BLOCK_ADDED" | "TOPIC_BLOCK_REMOVED" | "TOPIC_BLOCK_TOGGLED" | "COMPARTMENT_CREATED" | "COMPARTMENT_EDITED" | "COMPARTMENT_DELETED" | "ITEM_COMPARTMENT_CHANGED" | "SERVICE_PAIRED" | "SERVICE_REVOKED" | "SERVICE_POLICY_CHANGED" | "CONSENT_REQUEST_RECEIVED" | "CONSENT_DECIDED" | "DISCLOSURE_SENT" | "DISCLOSURE_BLOCKED_ITEM_OVERRIDDEN" | "OUTPUT_USED_ITEM" | "BACKUP_CREATED" | "BACKUP_VERIFIED" | "BACKUP_RESTORED";
    actor: "USER" | "SYSTEM" | "EXTERNAL_SERVICE";
    details_json: Record<string, unknown>;
}>;
export type AuditEvent = z.infer<typeof auditEventSchema>;
export declare const erasureLedgerEntrySchema: z.ZodObject<{
    erasure_id: z.ZodString;
    profile_id: z.ZodString;
    entity_type: z.ZodEnum<["ITEM", "RAW_ARTIFACT", "EVIDENCE_SUMMARY", "OTHER"]>;
    entity_id: z.ZodString;
    erased_at: z.ZodString;
    reason: z.ZodEnum<["USER_DELETE", "HF_MODE_DISABLED", "RETENTION_POLICY", "MIGRATION"]>;
    details_json: z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    profile_id: string;
    details_json: Record<string, unknown> | null;
    erasure_id: string;
    entity_type: "ITEM" | "RAW_ARTIFACT" | "EVIDENCE_SUMMARY" | "OTHER";
    entity_id: string;
    erased_at: string;
    reason: "USER_DELETE" | "HF_MODE_DISABLED" | "RETENTION_POLICY" | "MIGRATION";
}, {
    profile_id: string;
    details_json: Record<string, unknown> | null;
    erasure_id: string;
    entity_type: "ITEM" | "RAW_ARTIFACT" | "EVIDENCE_SUMMARY" | "OTHER";
    entity_id: string;
    erased_at: string;
    reason: "USER_DELETE" | "HF_MODE_DISABLED" | "RETENTION_POLICY" | "MIGRATION";
}>;
export type ErasureLedgerEntry = z.infer<typeof erasureLedgerEntrySchema>;
export declare const createConsentRequestInputSchema: z.ZodObject<{
    purpose: z.ZodString;
    requested_compartment_ids: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
    requested_item_ids: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
    nonce: z.ZodString;
}, "strip", z.ZodTypeAny, {
    purpose: string;
    nonce: string;
    requested_compartment_ids: string[];
    requested_item_ids: string[];
}, {
    purpose: string;
    nonce: string;
    requested_compartment_ids?: string[] | undefined;
    requested_item_ids?: string[] | undefined;
}>;
export declare const consentDecisionInputSchema: z.ZodObject<{
    decision: z.ZodEnum<["ALLOW", "DECLINE"]>;
    allowed_item_ids: z.ZodArray<z.ZodString, "many">;
    blocked_item_overrides: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    decision: "ALLOW" | "DECLINE";
    allowed_item_ids: string[];
    blocked_item_overrides: string[];
}, {
    decision: "ALLOW" | "DECLINE";
    allowed_item_ids: string[];
    blocked_item_overrides?: string[] | undefined;
}>;
//# sourceMappingURL=types.d.ts.map