import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { DossierStoreService } from "./index.js";
import { createDefaultState } from "./defaults.js";
import { migratePersistedState } from "./migrations.js";
describe("store repository policy behavior", () => {
    test("migrates v1 state to schema v2", () => {
        const current = createDefaultState();
        const { categories: _categories, compartments: _compartments, itemCompartments: _itemCompartments, serviceRegistry: _serviceRegistry, ...rest } = current;
        const legacyState = {
            ...rest,
            profile: {
                ...rest.profile,
                schema_version: 1
            }
        };
        const migrated = migratePersistedState(legacyState);
        expect(migrated.profile.schema_version).toBe(2);
        expect(migrated.categories).toEqual([]);
        expect(migrated.compartments).toEqual([]);
        expect(migrated.itemCompartments).toEqual([]);
        expect(migrated.serviceRegistry.length).toBeGreaterThan(0);
    });
    test("manual blocked item is stored and flagged", async () => {
        const dataDir = mkdtempSync(join(tmpdir(), "dossier-store-"));
        const store = await DossierStoreService.init(dataDir);
        store.repository.addTopicRule({
            rule_id: crypto.randomUUID(),
            profile_id: store.repository.snapshot().profile.profile_id,
            pattern: "politics",
            match_mode: "KEYWORD",
            scope: "STORAGE_AND_SHARING",
            is_enabled: true
        });
        const item = store.repository.createManualItem({
            text: "I avoid politics in recommendations",
            itemType: "constraint",
            categoryId: null
        });
        const blockedSet = store.repository.listBlockedItemIds();
        expect(blockedSet.has(item.item_id)).toBe(true);
    });
    test("inference matching topic block is suppressed", async () => {
        const dataDir = mkdtempSync(join(tmpdir(), "dossier-store-"));
        const store = await DossierStoreService.init(dataDir);
        store.repository.addTopicRule({
            rule_id: crypto.randomUUID(),
            profile_id: store.repository.snapshot().profile.profile_id,
            pattern: "health",
            match_mode: "KEYWORD",
            scope: "STORAGE_AND_SHARING",
            is_enabled: true
        });
        const result = store.repository.createInference({
            text: "User frequently reads health articles",
            itemType: "interest",
            categoryId: null,
            createdVia: "IMPORT"
        });
        expect(result).toBeNull();
    });
    test("supports topic rule CRUD", async () => {
        const dataDir = mkdtempSync(join(tmpdir(), "dossier-store-"));
        const store = await DossierStoreService.init(dataDir);
        const profileId = store.repository.snapshot().profile.profile_id;
        const created = store.repository.addTopicRule({
            rule_id: crypto.randomUUID(),
            profile_id: profileId,
            pattern: "finance",
            match_mode: "KEYWORD",
            scope: "STORAGE_AND_SHARING",
            is_enabled: true
        });
        const updated = store.repository.updateTopicRule(created.rule_id, { pattern: "money", is_enabled: false });
        expect(updated?.pattern).toBe("money");
        expect(updated?.is_enabled).toBe(false);
        expect(store.repository.listTopicRules().length).toBe(1);
        expect(store.repository.removeTopicRule(created.rule_id)).toBe(true);
        expect(store.repository.listTopicRules()).toEqual([]);
    });
    test("supports category and compartment CRUD + membership", async () => {
        const dataDir = mkdtempSync(join(tmpdir(), "dossier-store-"));
        const store = await DossierStoreService.init(dataDir);
        const category = store.repository.createCategory({ name: "Personal" });
        const compartment = store.repository.createCompartment({ name: "Work" });
        const item = store.repository.createManualItem({
            text: "Prefers concise replies",
            itemType: "communication",
            categoryId: category.category_id
        });
        const memberships = store.repository.setItemCompartments(item.item_id, [compartment.compartment_id]);
        expect(memberships).toHaveLength(1);
        expect(memberships[0]?.compartment_id).toBe(compartment.compartment_id);
        const updatedCategory = store.repository.updateCategory(category.category_id, { name: "Profile" });
        expect(updatedCategory?.name).toBe("Profile");
        const updatedCompartment = store.repository.updateCompartment(compartment.compartment_id, { name: "External" });
        expect(updatedCompartment?.name).toBe("External");
        expect(store.repository.deleteCompartment(compartment.compartment_id)).toBe(true);
        expect(store.repository.listItemCompartments(item.item_id)).toEqual([]);
        expect(store.repository.deleteCategory(category.category_id)).toBe(true);
        expect(store.repository.listItems()[0]?.category_id).toBeNull();
    });
    test("consent preview unions requested items and compartment items", async () => {
        const dataDir = mkdtempSync(join(tmpdir(), "dossier-store-"));
        const store = await DossierStoreService.init(dataDir);
        const compartment = store.repository.createCompartment({ name: "Sharing" });
        const item = store.repository.createManualItem({
            text: "Likes tea",
            itemType: "preference",
            categoryId: null
        });
        store.repository.setItemCompartments(item.item_id, [compartment.compartment_id]);
        const serviceId = crypto.randomUUID();
        const request = store.repository.createConsentRequest({
            purpose: "Tailored responses",
            requested_item_ids: [],
            requested_compartment_ids: [compartment.compartment_id],
            nonce: "nonce-0123456789abcdef"
        }, serviceId);
        const preview = store.repository.buildConsentPreview(request);
        expect(preview.map((entry) => entry.item_id)).toContain(item.item_id);
    });
    test("consent preview view surfaces blocked items for one-time override", async () => {
        const dataDir = mkdtempSync(join(tmpdir(), "dossier-store-"));
        const store = await DossierStoreService.init(dataDir);
        const compartment = store.repository.createCompartment({ name: "Sharing" });
        const blocked = store.repository.createManualItem({
            text: "Avoid politics in examples",
            itemType: "constraint",
            categoryId: null
        });
        store.repository.addTopicRule({
            rule_id: crypto.randomUUID(),
            profile_id: store.repository.snapshot().profile.profile_id,
            pattern: "politics",
            match_mode: "KEYWORD",
            scope: "STORAGE_AND_SHARING",
            is_enabled: true
        });
        store.repository.updateItem(blocked.item_id, { text: "Avoid politics in examples" });
        store.repository.setItemCompartments(blocked.item_id, [compartment.compartment_id]);
        const request = store.repository.createConsentRequest({
            purpose: "Tailored responses",
            requested_item_ids: [],
            requested_compartment_ids: [compartment.compartment_id],
            nonce: "nonce-0123456789abcdef"
        }, crypto.randomUUID());
        const preview = store.repository.buildConsentPreviewView(request);
        expect(preview).toHaveLength(1);
        expect(preview[0]?.is_topic_blocked).toBe(true);
        expect(preview[0]?.default_allowed).toBe(false);
    });
    test("supports audit filtering by date range", async () => {
        const dataDir = mkdtempSync(join(tmpdir(), "dossier-store-"));
        const store = await DossierStoreService.init(dataDir);
        store.repository.createManualItem({
            text: "Prefers short lists",
            itemType: "communication",
            categoryId: null
        });
        const allEvents = store.repository.listAudit({});
        expect(allEvents.length).toBeGreaterThan(0);
        const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        const filteredFuture = store.repository.listAudit({ dateFrom: future });
        expect(filteredFuture).toEqual([]);
        const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const filteredRange = store.repository.listAudit({ dateFrom: past, dateTo: future });
        expect(filteredRange.length).toBeGreaterThan(0);
    });
    test("dismissed inference suppresses resuggestion", async () => {
        const dataDir = mkdtempSync(join(tmpdir(), "dossier-store-"));
        const store = await DossierStoreService.init(dataDir);
        const created = store.repository.createInference({
            text: "User likes green tea",
            itemType: "preference",
            categoryId: null,
            createdVia: "IMPORT"
        });
        expect(created).not.toBeNull();
        if (!created) {
            return;
        }
        store.repository.dismissInference(created.item_id, "Not true");
        const retry = store.repository.createInference({
            text: "User likes green tea",
            itemType: "preference",
            categoryId: null,
            createdVia: "IMPORT"
        });
        expect(retry).toBeNull();
    });
    test("item details view includes provenance, topic, and compartment IDs", async () => {
        const dataDir = mkdtempSync(join(tmpdir(), "dossier-store-"));
        const store = await DossierStoreService.init(dataDir);
        const compartment = store.repository.createCompartment({ name: "Work" });
        const item = store.repository.createManualItem({
            text: "Prefers concise updates",
            itemType: "communication",
            categoryId: null
        });
        store.repository.setItemCompartments(item.item_id, [compartment.compartment_id]);
        const details = store.repository.listItemDetailsViews();
        expect(details).toHaveLength(1);
        expect(details[0]?.item.item_id).toBe(item.item_id);
        expect(details[0]?.provenance?.source_label).toBe("You (manual)");
        expect(details[0]?.compartment_ids).toEqual([compartment.compartment_id]);
        expect(details[0]?.topic?.is_topic_blocked).toBe(false);
    });
    test("blocked item requires explicit one-time override in consent decisions", async () => {
        const dataDir = mkdtempSync(join(tmpdir(), "dossier-store-"));
        const store = await DossierStoreService.init(dataDir);
        const profileId = store.repository.snapshot().profile.profile_id;
        const blocked = store.repository.createManualItem({
            text: "Avoid politics in recommendations",
            itemType: "constraint",
            categoryId: null
        });
        store.repository.addTopicRule({
            rule_id: crypto.randomUUID(),
            profile_id: profileId,
            pattern: "politics",
            match_mode: "KEYWORD",
            scope: "STORAGE_AND_SHARING",
            is_enabled: true
        });
        store.repository.updateItem(blocked.item_id, { text: blocked.text });
        const request = store.repository.createConsentRequest({
            purpose: "Tailored responses",
            requested_item_ids: [blocked.item_id],
            requested_compartment_ids: [],
            nonce: "nonce-0123456789abcdef"
        }, crypto.randomUUID());
        const withoutOverride = store.repository.decideConsent(request.consent_request_id, {
            decision: "ALLOW",
            allowed_item_ids: [blocked.item_id],
            blocked_item_overrides: []
        });
        expect(withoutOverride.allowed_item_ids_json).toEqual([]);
    });
    test("supports local encrypted backup create/verify/restore", async () => {
        const dataDir = mkdtempSync(join(tmpdir(), "dossier-store-"));
        const store = await DossierStoreService.init(dataDir);
        const created = store.repository.createManualItem({
            text: "Prefers calm tone",
            itemType: "communication",
            categoryId: null
        });
        const backup = store.createLocalBackup("secret-passphrase");
        expect(backup.checksum).toBeTruthy();
        expect(store.listLocalBackups()).toHaveLength(1);
        const verified = store.verifyLocalBackup(backup.backupId);
        expect(verified?.lastVerifiedAt).not.toBeNull();
        store.repository.deleteItemIrreversible(created.item_id);
        expect(store.repository.listItems()).toHaveLength(0);
        const restored = store.restoreLocalBackup(backup.backupId, "secret-passphrase");
        expect(restored?.backupId).toBe(backup.backupId);
        expect(store.repository.listItems()).toHaveLength(1);
        const events = store.repository.listAudit({
            type: ["BACKUP_CREATED", "BACKUP_VERIFIED", "BACKUP_RESTORED"]
        });
        expect(events.map((event) => event.event_type)).toContain("BACKUP_RESTORED");
    });
    test("irreversible profile delete resets state and local backups", async () => {
        const dataDir = mkdtempSync(join(tmpdir(), "dossier-store-"));
        const store = await DossierStoreService.init(dataDir);
        const previousProfileId = store.repository.snapshot().profile.profile_id;
        store.repository.createManualItem({
            text: "Has weekly planning ritual",
            itemType: "routine",
            categoryId: null
        });
        store.createLocalBackup("secret-passphrase");
        const result = store.deleteProfileIrreversible();
        expect(result.deleted).toBe(true);
        expect(result.previousProfileId).toBe(previousProfileId);
        expect(result.nextProfileId).not.toBe(previousProfileId);
        expect(store.repository.listItems()).toHaveLength(0);
        expect(store.listLocalBackups()).toHaveLength(0);
    });
});
//# sourceMappingURL=repository.test.js.map