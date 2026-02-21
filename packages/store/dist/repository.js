import { createHash, randomUUID } from "node:crypto";
import { applyOneTimeBlockedOverrides, auditEvent, canCreateInference, confirmInference as transitionConfirmInference, createInferenceItem, createConsentRequestInputSchema, dismissInference as transitionDismissInference, editThenConfirmInference as transitionEditThenConfirmInference, isTopicBlockedText, manualCreateItem, consentDecisionInputSchema } from "@dossier/domain";
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
    recordAuditEvent(input) {
        this.state.auditEvents.push(auditEvent({
            profile_id: this.state.profile.profile_id,
            event_type: input.eventType,
            actor: input.actor ?? "SYSTEM",
            service_id: input.serviceId ?? null,
            item_id: input.itemId ?? null,
            consent_request_id: input.consentRequestId ?? null,
            details_json: input.details ?? {}
        }));
        this.save();
    }
    findItemIndex(itemId) {
        return this.state.items.findIndex((candidate) => candidate.item_id === itemId);
    }
    upsertTopicFlag(itemId, text, storageOverride) {
        const matchedRule = isTopicBlockedText(text, this.state.topicBlockRules);
        const nextFlag = {
            item_id: itemId,
            is_topic_blocked: Boolean(matchedRule),
            blocked_by_rule_id: matchedRule?.rule_id ?? null,
            block_reason: matchedRule ? `Matched topic block: ${matchedRule.pattern}` : null,
            storage_override: matchedRule ? storageOverride : "NONE"
        };
        const existingIndex = this.state.itemTopicFlags.findIndex((flag) => flag.item_id === itemId);
        if (existingIndex >= 0) {
            this.state.itemTopicFlags[existingIndex] = nextFlag;
        }
        else {
            this.state.itemTopicFlags.push(nextFlag);
        }
        return nextFlag;
    }
    setItemProvenance(provenance) {
        const existingIndex = this.state.itemProvenance.findIndex((entry) => entry.item_id === provenance.item_id);
        if (existingIndex >= 0) {
            this.state.itemProvenance[existingIndex] = provenance;
            return;
        }
        this.state.itemProvenance.push(provenance);
    }
    getItemProvenance(itemId) {
        return this.state.itemProvenance.find((entry) => entry.item_id === itemId) ?? null;
    }
    getItemTopicFlag(itemId) {
        return this.state.itemTopicFlags.find((entry) => entry.item_id === itemId) ?? null;
    }
    getItemCompartmentIds(itemId) {
        return this.state.itemCompartments
            .filter((membership) => membership.item_id === itemId)
            .map((membership) => membership.compartment_id);
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
    listTopicRules() {
        return [...this.state.topicBlockRules];
    }
    updateTopicRule(ruleId, patch) {
        const index = this.state.topicBlockRules.findIndex((candidate) => candidate.rule_id === ruleId);
        if (index < 0) {
            return null;
        }
        const next = {
            ...this.state.topicBlockRules[index],
            ...patch,
            updated_at: nowIso()
        };
        this.state.topicBlockRules[index] = next;
        this.state.auditEvents.push(auditEvent({
            profile_id: this.state.profile.profile_id,
            event_type: "TOPIC_BLOCK_TOGGLED",
            actor: "USER",
            service_id: null,
            item_id: null,
            consent_request_id: null,
            details_json: { rule_id: ruleId, patch }
        }));
        this.save();
        return next;
    }
    removeTopicRule(ruleId) {
        const before = this.state.topicBlockRules.length;
        this.state.topicBlockRules = this.state.topicBlockRules.filter((candidate) => candidate.rule_id !== ruleId);
        if (this.state.topicBlockRules.length === before) {
            return false;
        }
        this.state.auditEvents.push(auditEvent({
            profile_id: this.state.profile.profile_id,
            event_type: "TOPIC_BLOCK_REMOVED",
            actor: "USER",
            service_id: null,
            item_id: null,
            consent_request_id: null,
            details_json: { rule_id: ruleId }
        }));
        this.save();
        return true;
    }
    createManualItem(input) {
        if (input.categoryId && !this.state.categories.some((category) => category.category_id === input.categoryId)) {
            throw new Error("Category not found");
        }
        const item = manualCreateItem({
            profileId: this.state.profile.profile_id,
            text: input.text,
            itemType: input.itemType,
            categoryId: input.categoryId
        });
        this.state.items.push(item);
        const topicFlag = this.upsertTopicFlag(item.item_id, item.text, "MANUAL_ALLOWED");
        this.setItemProvenance({
            item_id: item.item_id,
            source_label: "You (manual)",
            source_kind: "MANUAL",
            why_dossier_thinks_this: null,
            confidence: null,
            evidence_summary_id: null
        });
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
        if (input.categoryId && !this.state.categories.some((category) => category.category_id === input.categoryId)) {
            throw new Error("Category not found");
        }
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
        this.upsertTopicFlag(item.item_id, item.text, "NONE");
        this.setItemProvenance({
            item_id: item.item_id,
            source_label: input.sourceLabel ?? "System inference",
            source_kind: "CONNECTOR",
            why_dossier_thinks_this: input.whyDossierThinksThis ?? null,
            confidence: input.confidence ?? null,
            evidence_summary_id: input.evidenceSummaryId ?? null
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
    updateItem(itemId, patch) {
        const index = this.findItemIndex(itemId);
        if (index < 0) {
            return null;
        }
        if (patch.category_id && !this.state.categories.some((category) => category.category_id === patch.category_id)) {
            throw new Error("Category not found");
        }
        const previous = this.state.items[index];
        const next = {
            ...previous,
            ...(patch.text !== undefined ? { text: patch.text } : {}),
            ...(patch.item_type !== undefined ? { item_type: patch.item_type } : {}),
            ...(patch.category_id !== undefined ? { category_id: patch.category_id } : {}),
            updated_at: nowIso()
        };
        this.state.items[index] = next;
        const storageOverride = next.created_via === "MANUAL" ? "MANUAL_ALLOWED" : "NONE";
        this.upsertTopicFlag(next.item_id, next.text, storageOverride);
        this.state.auditEvents.push(auditEvent({
            profile_id: this.state.profile.profile_id,
            event_type: "ITEM_EDITED",
            actor: "USER",
            service_id: null,
            item_id: next.item_id,
            consent_request_id: null,
            details_json: {
                before: { text: previous.text, item_type: previous.item_type, category_id: previous.category_id },
                after: { text: next.text, item_type: next.item_type, category_id: next.category_id }
            }
        }));
        this.save();
        return next;
    }
    confirmInference(itemId) {
        const index = this.findItemIndex(itemId);
        if (index < 0) {
            throw new Error("Inference item not found");
        }
        const next = transitionConfirmInference(this.state.items[index]);
        this.state.items[index] = next;
        this.state.auditEvents.push(auditEvent({
            profile_id: this.state.profile.profile_id,
            event_type: "INFERENCE_CONFIRMED",
            actor: "USER",
            service_id: null,
            item_id: itemId,
            consent_request_id: null,
            details_json: {}
        }));
        this.save();
        return next;
    }
    editThenConfirmInference(itemId, editedText) {
        const index = this.findItemIndex(itemId);
        if (index < 0) {
            throw new Error("Inference item not found");
        }
        const { item, editHistory } = transitionEditThenConfirmInference(this.state.items[index], editedText);
        this.state.items[index] = item;
        this.state.itemEditHistory.push(editHistory);
        this.upsertTopicFlag(item.item_id, item.text, "MANUAL_ALLOWED");
        this.state.auditEvents.push(auditEvent({
            profile_id: this.state.profile.profile_id,
            event_type: "INFERENCE_CONFIRMED",
            actor: "USER",
            service_id: null,
            item_id: item.item_id,
            consent_request_id: null,
            details_json: { edit_then_confirm: true, edit_id: editHistory.edit_id }
        }));
        this.save();
        return item;
    }
    dismissInference(itemId, dismissReason = null) {
        const index = this.findItemIndex(itemId);
        if (index < 0) {
            throw new Error("Inference item not found");
        }
        const item = this.state.items[index];
        const dismissed = transitionDismissInference(item, this.state.profile.profile_id, dismissReason);
        this.state.dismissedInferences.push(dismissed);
        this.state.items.splice(index, 1);
        this.state.itemTopicFlags = this.state.itemTopicFlags.filter((candidate) => candidate.item_id !== itemId);
        this.state.itemProvenance = this.state.itemProvenance.filter((candidate) => candidate.item_id !== itemId);
        this.state.itemCompartments = this.state.itemCompartments.filter((candidate) => candidate.item_id !== itemId);
        this.state.erasureLedger.push({
            erasure_id: randomUUID(),
            profile_id: this.state.profile.profile_id,
            entity_type: "ITEM",
            entity_id: itemId,
            erased_at: nowIso(),
            reason: "USER_DELETE",
            details_json: { source: "dismissInference" }
        });
        this.state.auditEvents.push(auditEvent({
            profile_id: this.state.profile.profile_id,
            event_type: "INFERENCE_DISMISSED",
            actor: "USER",
            service_id: null,
            item_id: itemId,
            consent_request_id: null,
            details_json: { dismiss_reason: dismissReason }
        }));
        this.save();
        return dismissed;
    }
    listItems() {
        return [...this.state.items];
    }
    listItemDetailsViews() {
        return this.state.items.map((item) => ({
            item,
            provenance: this.getItemProvenance(item.item_id),
            topic: this.getItemTopicFlag(item.item_id),
            compartment_ids: this.getItemCompartmentIds(item.item_id)
        }));
    }
    listCategories() {
        return [...this.state.categories];
    }
    createCategory(input) {
        const timestamp = nowIso();
        const category = {
            category_id: randomUUID(),
            profile_id: this.state.profile.profile_id,
            name: input.name,
            sort_order: input.sortOrder ?? this.state.categories.length,
            is_system: input.isSystem ?? false,
            created_at: timestamp,
            updated_at: timestamp
        };
        this.state.categories.push(category);
        this.state.auditEvents.push(auditEvent({
            profile_id: this.state.profile.profile_id,
            event_type: "CATEGORY_CREATED",
            actor: "USER",
            service_id: null,
            item_id: null,
            consent_request_id: null,
            details_json: { category_id: category.category_id, name: category.name }
        }));
        this.save();
        return category;
    }
    updateCategory(categoryId, patch) {
        const index = this.state.categories.findIndex((candidate) => candidate.category_id === categoryId);
        if (index < 0) {
            return null;
        }
        const next = {
            ...this.state.categories[index],
            ...patch,
            updated_at: nowIso()
        };
        this.state.categories[index] = next;
        this.state.auditEvents.push(auditEvent({
            profile_id: this.state.profile.profile_id,
            event_type: "CATEGORY_EDITED",
            actor: "USER",
            service_id: null,
            item_id: null,
            consent_request_id: null,
            details_json: { category_id: categoryId, patch }
        }));
        this.save();
        return next;
    }
    deleteCategory(categoryId) {
        const before = this.state.categories.length;
        this.state.categories = this.state.categories.filter((candidate) => candidate.category_id !== categoryId);
        if (this.state.categories.length === before) {
            return false;
        }
        this.state.items = this.state.items.map((item) => item.category_id === categoryId ? { ...item, category_id: null, updated_at: nowIso() } : item);
        this.state.auditEvents.push(auditEvent({
            profile_id: this.state.profile.profile_id,
            event_type: "CATEGORY_DELETED",
            actor: "USER",
            service_id: null,
            item_id: null,
            consent_request_id: null,
            details_json: { category_id: categoryId }
        }));
        this.save();
        return true;
    }
    listCompartments() {
        return [...this.state.compartments];
    }
    createCompartment(input) {
        const timestamp = nowIso();
        const compartment = {
            compartment_id: randomUUID(),
            profile_id: this.state.profile.profile_id,
            name: input.name,
            description: input.description ?? null,
            sort_order: input.sortOrder ?? this.state.compartments.length,
            created_at: timestamp,
            updated_at: timestamp
        };
        this.state.compartments.push(compartment);
        this.state.auditEvents.push(auditEvent({
            profile_id: this.state.profile.profile_id,
            event_type: "COMPARTMENT_CREATED",
            actor: "USER",
            service_id: null,
            item_id: null,
            consent_request_id: null,
            details_json: { compartment_id: compartment.compartment_id, name: compartment.name }
        }));
        this.save();
        return compartment;
    }
    updateCompartment(compartmentId, patch) {
        const index = this.state.compartments.findIndex((candidate) => candidate.compartment_id === compartmentId);
        if (index < 0) {
            return null;
        }
        const next = {
            ...this.state.compartments[index],
            ...patch,
            updated_at: nowIso()
        };
        this.state.compartments[index] = next;
        this.state.auditEvents.push(auditEvent({
            profile_id: this.state.profile.profile_id,
            event_type: "COMPARTMENT_EDITED",
            actor: "USER",
            service_id: null,
            item_id: null,
            consent_request_id: null,
            details_json: { compartment_id: compartmentId, patch }
        }));
        this.save();
        return next;
    }
    deleteCompartment(compartmentId) {
        const before = this.state.compartments.length;
        this.state.compartments = this.state.compartments.filter((candidate) => candidate.compartment_id !== compartmentId);
        if (this.state.compartments.length === before) {
            return false;
        }
        this.state.itemCompartments = this.state.itemCompartments.filter((membership) => membership.compartment_id !== compartmentId);
        this.state.auditEvents.push(auditEvent({
            profile_id: this.state.profile.profile_id,
            event_type: "COMPARTMENT_DELETED",
            actor: "USER",
            service_id: null,
            item_id: null,
            consent_request_id: null,
            details_json: { compartment_id: compartmentId }
        }));
        this.save();
        return true;
    }
    setItemCompartments(itemId, compartmentIds) {
        const itemExists = this.state.items.some((item) => item.item_id === itemId);
        if (!itemExists) {
            throw new Error("Item not found");
        }
        const requested = [...new Set(compartmentIds)];
        const known = new Set(this.state.compartments.map((compartment) => compartment.compartment_id));
        for (const compartmentId of requested) {
            if (!known.has(compartmentId)) {
                throw new Error(`Compartment not found: ${compartmentId}`);
            }
        }
        this.state.itemCompartments = this.state.itemCompartments.filter((membership) => membership.item_id !== itemId);
        for (const compartmentId of requested) {
            this.state.itemCompartments.push({
                item_id: itemId,
                compartment_id: compartmentId
            });
        }
        this.state.auditEvents.push(auditEvent({
            profile_id: this.state.profile.profile_id,
            event_type: "ITEM_COMPARTMENT_CHANGED",
            actor: "USER",
            service_id: null,
            item_id: itemId,
            consent_request_id: null,
            details_json: { compartment_ids: requested }
        }));
        this.save();
        return this.listItemCompartments(itemId);
    }
    listItemCompartments(itemId) {
        if (!itemId) {
            return [...this.state.itemCompartments];
        }
        return this.state.itemCompartments.filter((membership) => membership.item_id === itemId);
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
    listServiceRegistry() {
        return [...this.state.serviceRegistry];
    }
    listPairings() {
        return [...this.state.pairings];
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
        return this.buildConsentPreviewView(consentRequest)
            .filter((candidate) => candidate.default_allowed)
            .map((candidate) => candidate.item);
    }
    buildConsentPreviewView(consentRequest) {
        const requestedItemIds = new Set(consentRequest.requested_item_ids_json);
        const requestedCompartmentIds = new Set(consentRequest.requested_compartment_ids_json);
        for (const membership of this.state.itemCompartments) {
            if (requestedCompartmentIds.has(membership.compartment_id)) {
                requestedItemIds.add(membership.item_id);
            }
        }
        const candidateItems = this.state.items.filter((item) => requestedItemIds.has(item.item_id));
        return candidateItems.map((item) => {
            const topic = this.getItemTopicFlag(item.item_id);
            const isBlocked = topic?.is_topic_blocked ?? false;
            return {
                item,
                is_topic_blocked: isBlocked,
                blocked_by_rule_id: topic?.blocked_by_rule_id ?? null,
                block_reason: topic?.block_reason ?? null,
                default_allowed: !isBlocked,
                compartment_ids: this.getItemCompartmentIds(item.item_id),
                provenance: this.getItemProvenance(item.item_id)
            };
        });
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
        const baseAllowed = decision.allowed_item_ids.filter((itemId) => !blockedIds.has(itemId));
        const allowedWithOverrides = applyOneTimeBlockedOverrides(baseAllowed, decision.blocked_item_overrides, blockedIds);
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
        const from = filters.dateFrom ? Date.parse(filters.dateFrom) : null;
        const to = filters.dateTo ? Date.parse(filters.dateTo) : null;
        const types = Array.isArray(filters.type) ? new Set(filters.type) : filters.type ? new Set([filters.type]) : null;
        return this.state.auditEvents.filter((event) => {
            if (filters.serviceId && event.service_id !== filters.serviceId) {
                return false;
            }
            if (filters.itemId && event.item_id !== filters.itemId) {
                return false;
            }
            if (types && !types.has(event.event_type)) {
                return false;
            }
            if (from !== null && Number.isFinite(from) && Date.parse(event.timestamp) < from) {
                return false;
            }
            if (to !== null && Number.isFinite(to) && Date.parse(event.timestamp) > to) {
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
        this.state.itemProvenance = this.state.itemProvenance.filter((candidate) => candidate.item_id !== itemId);
        this.state.itemEditHistory = this.state.itemEditHistory.filter((candidate) => candidate.item_id !== itemId);
        this.state.itemCompartments = this.state.itemCompartments.filter((candidate) => candidate.item_id !== itemId);
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