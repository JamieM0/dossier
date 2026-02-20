import { createHash, randomUUID } from "node:crypto";
import { applyOneTimeBlockedOverrides, auditEvent, canCreateInference, createInferenceItem, createConsentRequestInputSchema, filterItemsForSharingDefault, isTopicBlockedText, manualCreateItem, consentDecisionInputSchema } from "@dossier/domain";
function nowIso() {
    return new Date().toISOString();
}
export class DossierRepository {
    state;
    persist;
    constructor(state, persist) {
        this.state = state;
        this.persist = persist;
    }
    snapshot() {
        return this.state;
    }
    replaceState(next) {
        this.state = next;
        this.save();
    }
    save() {
        this.state.profile.updated_at = nowIso();
        this.persist(this.state);
    }
    addTopicRule(rule) {
        const timestamp = nowIso();
        const next = {
            ...rule,
            created_at: timestamp,
            updated_at: timestamp
        };
        this.state.topicBlockRules.push(next);
        this.state.auditEvents.push(auditEvent({
            profile_id: this.state.profile.profile_id,
            event_type: "TOPIC_BLOCK_ADDED",
            actor: "USER",
            service_id: null,
            item_id: null,
            consent_request_id: null,
            details_json: { rule_id: next.rule_id, pattern: next.pattern }
        }));
        this.save();
        return next;
    }
    createManualItem(input) {
        const item = manualCreateItem({
            profileId: this.state.profile.profile_id,
            text: input.text,
            itemType: input.itemType,
            categoryId: input.categoryId
        });
        this.state.items.push(item);
        const matchedRule = isTopicBlockedText(item.text, this.state.topicBlockRules);
        const topicFlag = {
            item_id: item.item_id,
            is_topic_blocked: Boolean(matchedRule),
            blocked_by_rule_id: matchedRule?.rule_id ?? null,
            block_reason: matchedRule ? `Matched topic block: ${matchedRule.pattern}` : null,
            storage_override: matchedRule ? "MANUAL_ALLOWED" : "NONE"
        };
        this.state.itemTopicFlags.push(topicFlag);
        this.state.auditEvents.push(auditEvent({
            profile_id: this.state.profile.profile_id,
            event_type: "ITEM_CREATED",
            actor: "USER",
            service_id: null,
            item_id: item.item_id,
            consent_request_id: null,
            details_json: { blocked: topicFlag.is_topic_blocked }
        }));
        this.save();
        return item;
    }
    createInference(input) {
        const matchedRule = isTopicBlockedText(input.text, this.state.topicBlockRules);
        if (matchedRule) {
            this.state.auditEvents.push(auditEvent({
                profile_id: this.state.profile.profile_id,
                event_type: "INFERENCE_SUPPRESSED",
                actor: "SYSTEM",
                service_id: null,
                item_id: null,
                consent_request_id: null,
                details_json: { reason: "topic_block", rule_id: matchedRule.rule_id, pattern: matchedRule.pattern }
            }));
            this.save();
            return null;
        }
        const fingerprint = createHash("sha256")
            .update(`${input.itemType.toLowerCase()}::${input.text.trim().toLowerCase().replace(/\s+/g, " ")}`)
            .digest("hex");
        if (!canCreateInference(fingerprint, this.state.dismissedInferences)) {
            this.state.auditEvents.push(auditEvent({
                profile_id: this.state.profile.profile_id,
                event_type: "INFERENCE_SUPPRESSED",
                actor: "SYSTEM",
                service_id: null,
                item_id: null,
                consent_request_id: null,
                details_json: { reason: "dismissed_fingerprint" }
            }));
            this.save();
            return null;
        }
        const item = createInferenceItem({
            profileId: this.state.profile.profile_id,
            text: input.text,
            itemType: input.itemType,
            categoryId: input.categoryId,
            createdVia: input.createdVia
        });
        this.state.items.push(item);
        this.state.itemTopicFlags.push({
            item_id: item.item_id,
            is_topic_blocked: false,
            blocked_by_rule_id: null,
            block_reason: null,
            storage_override: "NONE"
        });
        this.state.auditEvents.push(auditEvent({
            profile_id: this.state.profile.profile_id,
            event_type: "INFERENCE_CREATED",
            actor: "SYSTEM",
            service_id: null,
            item_id: item.item_id,
            consent_request_id: null,
            details_json: { created_via: input.createdVia }
        }));
        this.save();
        return item;
    }
    listItems() {
        return [...this.state.items];
    }
    addEvidenceSummary(input) {
        const summary = {
            evidence_summary_id: randomUUID(),
            profile_id: this.state.profile.profile_id,
            source_label: input.sourceLabel,
            summary_kind: input.summaryKind,
            summary_json: input.summaryJson,
            created_at: nowIso()
        };
        this.state.evidenceSummaries.push(summary);
        this.save();
        return summary;
    }
    addRawArtifact(input) {
        if (!this.state.profile.high_fidelity_enabled) {
            return null;
        }
        const artifact = {
            raw_artifact_id: randomUUID(),
            profile_id: this.state.profile.profile_id,
            source_label: input.sourceLabel,
            artifact_kind: input.artifactKind,
            artifact_payload_encrypted: input.encryptedPayloadBase64,
            captured_at: input.capturedAt,
            ingested_at: nowIso()
        };
        this.state.rawArtifacts.push(artifact);
        this.save();
        return artifact;
    }
    listBlockedItemIds() {
        return new Set(this.state.itemTopicFlags.filter((f) => f.is_topic_blocked).map((f) => f.item_id));
    }
    pairService(input) {
        const pairing = {
            pairing_id: randomUUID(),
            service_id: input.serviceId,
            paired_at: nowIso(),
            revoked_at: null,
            scoped_bearer_token_hash: input.tokenHash,
            token_expires_at: input.tokenExpiresAt,
            allowed_origins_json: input.allowedOrigins
        };
        this.state.pairings = this.state.pairings.filter((p) => p.service_id !== input.serviceId);
        this.state.pairings.push(pairing);
        this.state.auditEvents.push(auditEvent({
            profile_id: this.state.profile.profile_id,
            event_type: "SERVICE_PAIRED",
            actor: "SYSTEM",
            service_id: input.serviceId,
            item_id: null,
            consent_request_id: null,
            details_json: { allowed_origins: input.allowedOrigins }
        }));
        this.save();
        return pairing;
    }
    revokeService(serviceId) {
        const now = nowIso();
        this.state.pairings = this.state.pairings.map((pairing) => pairing.service_id === serviceId ? { ...pairing, revoked_at: now, scoped_bearer_token_hash: "revoked" } : pairing);
        this.state.auditEvents.push(auditEvent({
            profile_id: this.state.profile.profile_id,
            event_type: "SERVICE_REVOKED",
            actor: "USER",
            service_id: serviceId,
            item_id: null,
            consent_request_id: null,
            details_json: {}
        }));
        this.save();
    }
    getPairingByTokenHash(tokenHash) {
        const now = Date.now();
        return (this.state.pairings.find((pairing) => {
            if (pairing.scoped_bearer_token_hash !== tokenHash || pairing.revoked_at) {
                return false;
            }
            if (!pairing.token_expires_at) {
                return true;
            }
            return new Date(pairing.token_expires_at).getTime() > now;
        }) ?? null);
    }
    createConsentRequest(input, serviceId) {
        const parsed = createConsentRequestInputSchema.parse(input);
        const request = {
            consent_request_id: randomUUID(),
            service_id: serviceId,
            purpose: parsed.purpose,
            requested_compartment_ids_json: parsed.requested_compartment_ids,
            requested_item_ids_json: parsed.requested_item_ids,
            created_at: nowIso(),
            expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
            state: "PENDING",
            nonce: parsed.nonce
        };
        this.state.consentRequests.push(request);
        this.state.auditEvents.push(auditEvent({
            profile_id: this.state.profile.profile_id,
            event_type: "CONSENT_REQUEST_RECEIVED",
            actor: "EXTERNAL_SERVICE",
            service_id: serviceId,
            item_id: null,
            consent_request_id: request.consent_request_id,
            details_json: { purpose: request.purpose }
        }));
        this.save();
        return request;
    }
    getConsentRequest(consentRequestId) {
        const request = this.state.consentRequests.find((candidate) => candidate.consent_request_id === consentRequestId);
        if (!request) {
            return null;
        }
        if (request.state !== "PENDING") {
            return request;
        }
        const expiry = request.expires_at ? new Date(request.expires_at).getTime() : Number.POSITIVE_INFINITY;
        if (Date.now() > expiry) {
            request.state = "EXPIRED";
            this.save();
        }
        return request;
    }
    buildConsentPreview(consentRequest) {
        const requestedItemIds = new Set(consentRequest.requested_item_ids_json);
        const candidateItems = this.state.items.filter((item) => requestedItemIds.has(item.item_id));
        const blockedIds = this.listBlockedItemIds();
        return filterItemsForSharingDefault(candidateItems, blockedIds);
    }
    decideConsent(consentRequestId, decisionInput) {
        const request = this.getConsentRequest(consentRequestId);
        if (!request) {
            throw new Error("Consent request not found");
        }
        if (request.state !== "PENDING") {
            throw new Error("Consent request is not pending");
        }
        const decision = consentDecisionInputSchema.parse(decisionInput);
        const blockedIds = this.listBlockedItemIds();
        const allowedWithOverrides = applyOneTimeBlockedOverrides(decision.allowed_item_ids, decision.blocked_item_overrides, blockedIds);
        const record = {
            consent_request_id: consentRequestId,
            decided_at: nowIso(),
            decision: decision.decision,
            allowed_item_ids_json: decision.decision === "ALLOW" ? allowedWithOverrides : [],
            redactions_json: decision.decision === "ALLOW" ? [] : null
        };
        this.state.consentDecisions = this.state.consentDecisions.filter((r) => r.consent_request_id !== consentRequestId);
        this.state.consentDecisions.push(record);
        for (const blockedId of decision.blocked_item_overrides) {
            const override = {
                override_id: randomUUID(),
                consent_request_id: consentRequestId,
                item_id: blockedId,
                override_type: "ALLOW_BLOCKED_ITEM_ONCE",
                created_at: nowIso()
            };
            this.state.consentOverrides.push(override);
            this.state.auditEvents.push(auditEvent({
                profile_id: this.state.profile.profile_id,
                event_type: "DISCLOSURE_BLOCKED_ITEM_OVERRIDDEN",
                actor: "USER",
                service_id: request.service_id,
                item_id: blockedId,
                consent_request_id: consentRequestId,
                details_json: {}
            }));
        }
        request.state = "DECIDED";
        this.state.auditEvents.push(auditEvent({
            profile_id: this.state.profile.profile_id,
            event_type: "CONSENT_DECIDED",
            actor: "USER",
            service_id: request.service_id,
            item_id: null,
            consent_request_id: consentRequestId,
            details_json: { decision: record.decision }
        }));
        this.save();
        return record;
    }
    createDisclosure(consentRequestId, payload) {
        const serialized = JSON.stringify(payload);
        const hash = createHash("sha256").update(serialized).digest("hex");
        const disclosure = {
            disclosure_id: randomUUID(),
            consent_request_id: consentRequestId,
            sent_at: nowIso(),
            payload_hash: hash,
            payload_encrypted: Buffer.from(serialized, "utf8").toString("base64")
        };
        this.state.disclosures.push(disclosure);
        const request = this.state.consentRequests.find((entry) => entry.consent_request_id === consentRequestId);
        this.state.auditEvents.push(auditEvent({
            profile_id: this.state.profile.profile_id,
            event_type: "DISCLOSURE_SENT",
            actor: "SYSTEM",
            service_id: request?.service_id ?? null,
            item_id: null,
            consent_request_id: consentRequestId,
            details_json: { payload_hash: hash }
        }));
        this.save();
        return disclosure;
    }
    getDecision(consentRequestId) {
        return this.state.consentDecisions.find((record) => record.consent_request_id === consentRequestId) ?? null;
    }
    getDisclosurePayload(consentRequestId) {
        const decision = this.getDecision(consentRequestId);
        if (!decision || decision.decision !== "ALLOW") {
            return null;
        }
        const allowedSet = new Set(decision.allowed_item_ids_json);
        const items = this.state.items
            .filter((item) => allowedSet.has(item.item_id))
            .map((item) => ({ item_id: item.item_id, item_type: item.item_type, text: item.text }));
        return {
            consent_request_id: consentRequestId,
            shared_at: nowIso(),
            items
        };
    }
    listAudit(filters) {
        return this.state.auditEvents.filter((event) => {
            if (filters.serviceId && event.service_id !== filters.serviceId) {
                return false;
            }
            if (filters.itemId && event.item_id !== filters.itemId) {
                return false;
            }
            if (filters.type && event.event_type !== filters.type) {
                return false;
            }
            return true;
        });
    }
    addDismissedInference(dismissed) {
        this.state.dismissedInferences.push(dismissed);
        this.save();
    }
    deleteItemIrreversible(itemId, reason = "USER_DELETE") {
        const item = this.state.items.find((candidate) => candidate.item_id === itemId);
        if (!item) {
            return false;
        }
        this.state.items = this.state.items.filter((candidate) => candidate.item_id !== itemId);
        this.state.itemTopicFlags = this.state.itemTopicFlags.filter((candidate) => candidate.item_id !== itemId);
        this.state.erasureLedger.push({
            erasure_id: randomUUID(),
            profile_id: this.state.profile.profile_id,
            entity_type: "ITEM",
            entity_id: itemId,
            erased_at: nowIso(),
            reason,
            details_json: { source: "deleteItemIrreversible" }
        });
        this.state.auditEvents.push(auditEvent({
            profile_id: this.state.profile.profile_id,
            event_type: "ITEM_DELETED",
            actor: "USER",
            service_id: null,
            item_id: itemId,
            consent_request_id: null,
            details_json: { reason }
        }));
        this.save();
        return true;
    }
    setHighFidelityEnabled(enabled) {
        const wasEnabled = this.state.profile.high_fidelity_enabled;
        this.state.profile.high_fidelity_enabled = enabled;
        if (wasEnabled && !enabled && this.state.rawArtifacts.length > 0) {
            const erasedAt = nowIso();
            for (const artifact of this.state.rawArtifacts) {
                this.state.erasureLedger.push({
                    erasure_id: randomUUID(),
                    profile_id: this.state.profile.profile_id,
                    entity_type: "RAW_ARTIFACT",
                    entity_id: artifact.raw_artifact_id,
                    erased_at: erasedAt,
                    reason: "HF_MODE_DISABLED",
                    details_json: null
                });
            }
            this.state.rawArtifacts = [];
        }
        this.save();
    }
    updateProfileSettings(settings) {
        this.state.profile.profile_settings_json = {
            ...(this.state.profile.profile_settings_json ?? {}),
            ...settings
        };
        this.save();
    }
    recordRateLimit(key) {
        const now = Date.now();
        const windowMs = 60 * 1000;
        const entries = this.state.rateLimit[key] ?? [];
        const trimmed = entries.filter((entry) => now - entry < windowMs);
        trimmed.push(now);
        this.state.rateLimit[key] = trimmed;
        this.save();
        return trimmed.length;
    }
}
//# sourceMappingURL=repository.js.map