import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { Readable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";

process.env.DOSSIER_BACKEND_SKIP_BOOTSTRAP = "1";
process.env.DOSSIER_CONTROL_TOKEN_OVERRIDE = "test-token";

const { createControlRequestHandler } = await import("./backend.js");

type RepoMock = {
  snapshot: () => { profile: { profile_id: string; profile_settings_json?: Record<string, unknown> } };
  setHighFidelityEnabled: (enabled: boolean) => void;
  updateProfileSettings: (settings: Record<string, unknown>) => void;
  listItems: () => unknown[];
  listItemDetailsViews: () => Array<{
    item: unknown;
    provenance: unknown | null;
    topic: unknown | null;
    compartment_ids: string[];
  }>;
  createManualItem: (input: { text: string; itemType: string; categoryId: string | null }) => unknown;
  createInference: (input: {
    text: string;
    itemType: string;
    categoryId: string | null;
    createdVia: "CONNECTOR" | "IMPORT" | "CHAT";
    sourceLabel?: string;
    whyDossierThinksThis?: string | null;
    confidence?: number | null;
  }) => unknown | null;
  updateItem: (
    itemId: string,
    patch: Partial<{ text: string; item_type: string; category_id: string | null }>
  ) => unknown | null;
  deleteItemIrreversible: (itemId: string) => boolean;
  confirmInference: (itemId: string) => unknown;
  editThenConfirmInference: (itemId: string, editedText: string) => unknown;
  dismissInference: (itemId: string, dismissReason?: string | null) => unknown;
  listTopicRules: () => unknown[];
  addTopicRule: (rule: unknown) => unknown;
  updateTopicRule: (ruleId: string, patch: unknown) => unknown | null;
  removeTopicRule: (ruleId: string) => boolean;
  listCategories: () => unknown[];
  createCategory: (input: unknown) => unknown;
  updateCategory: (categoryId: string, patch: unknown) => unknown | null;
  deleteCategory: (categoryId: string) => boolean;
  listCompartments: () => unknown[];
  createCompartment: (input: unknown) => unknown;
  updateCompartment: (compartmentId: string, patch: unknown) => unknown | null;
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

function createRepoMock(): RepoMock {
  const asRecord = (value: unknown): Record<string, unknown> =>
    value && typeof value === "object" ? (value as Record<string, unknown>) : {};

  return {
    snapshot: () => ({ profile: { profile_id: "11111111-1111-4111-8111-111111111111", profile_settings_json: {} } }),
    setHighFidelityEnabled: () => undefined,
    updateProfileSettings: () => undefined,
    listItems: () => [],
    listItemDetailsViews: () => [],
    createManualItem: (input) => ({
      item_id: "item-1",
      state: "CONFIRMED",
      text: input.text,
      item_type: input.itemType,
      category_id: input.categoryId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }),
    createInference: (input) =>
      input.text.includes("suppressed")
        ? null
        : {
            item_id: "inf-1",
            state: "INFERENCE_PENDING",
            text: input.text,
            item_type: input.itemType,
            category_id: input.categoryId ?? null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
    updateItem: (itemId, patch) =>
      itemId === "missing"
        ? null
        : {
            item_id: itemId,
            state: "CONFIRMED",
            text: patch.text ?? "updated",
            item_type: patch.item_type ?? "preference",
            category_id: patch.category_id ?? null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
    deleteItemIrreversible: (itemId) => itemId !== "missing",
    confirmInference: (itemId) => ({ item_id: itemId, state: "CONFIRMED" }),
    editThenConfirmInference: (itemId, editedText) => ({ item_id: itemId, state: "CONFIRMED", text: editedText }),
    dismissInference: (itemId, dismissReason) => ({ dismissed_id: itemId, dismiss_reason: dismissReason ?? null }),
    listTopicRules: () => [],
    addTopicRule: (rule) => rule,
    updateTopicRule: (ruleId, patch) => (ruleId === "missing" ? null : { rule_id: ruleId, ...asRecord(patch) }),
    removeTopicRule: (ruleId) => ruleId !== "missing",
    listCategories: () => [],
    createCategory: (input) => ({ category_id: "cat-1", ...asRecord(input) }),
    updateCategory: (categoryId, patch) => (categoryId === "missing" ? null : { category_id: categoryId, ...asRecord(patch) }),
    deleteCategory: (categoryId) => categoryId !== "missing",
    listCompartments: () => [],
    createCompartment: (input) => ({ compartment_id: "comp-1", ...asRecord(input) }),
    updateCompartment: (compartmentId, patch) =>
      compartmentId === "missing" ? null : { compartment_id: compartmentId, ...asRecord(patch) },
    deleteCompartment: (compartmentId) => compartmentId !== "missing",
    setItemCompartments: (itemId, compartmentIds) =>
      compartmentIds.map((compartmentId) => ({ item_id: itemId, compartment_id: compartmentId })),
    listItemCompartments: (itemId) => [{ item_id: itemId ?? "item-1", compartment_id: "comp-1" }],
    listServiceRegistry: () => [
      {
        service_id: "svc",
        identifier: "getperspectives.app",
        display_name: "Perspectives",
        icon_url: null,
        description: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ],
    listPairings: () => [
      {
        pairing_id: "pair-1",
        service_id: "svc",
        paired_at: new Date().toISOString(),
        revoked_at: null,
        scoped_bearer_token_hash: "hash",
        token_expires_at: null,
        allowed_origins_json: ["https://getperspectives.app"]
      }
    ],
    revokeService: () => undefined,
    getConsentRequest: (requestId) =>
      requestId === "missing"
        ? null
        : {
            consent_request_id: requestId,
            service_id: "svc",
            purpose: "testing",
            requested_compartment_ids_json: [],
            requested_item_ids_json: [],
            created_at: new Date().toISOString(),
            expires_at: null,
            state: "PENDING",
            nonce: "nonce-0123456789abcdef"
          },
    buildConsentPreview: () => [{ item_id: "item-1", item_type: "preference", text: "preview" }],
    buildConsentPreviewView: () => [
      {
        item: { item_id: "item-1", item_type: "preference", text: "preview", category_id: null },
        is_topic_blocked: false,
        blocked_by_rule_id: null,
        block_reason: null,
        default_allowed: true,
        compartment_ids: ["comp-1"],
        provenance: null
      }
    ],
    decideConsent: (requestId, payload) => ({ consent_request_id: requestId, ...asRecord(payload) }),
    listAudit: () => [{ event_id: "evt-1" }]
  };
}

type Handler = ReturnType<typeof createControlRequestHandler>;
let handler: Handler;

beforeEach(async () => {
  const repository = createRepoMock();
  const storeService = {
    repository,
    createEncryptedExport: () => ({ ok: true }),
    importEncryptedExport: () => undefined,
    listLocalBackups: () => [{ backupId: "b-1" }],
    createLocalBackup: () => ({ backupId: "b-1" }),
    verifyLocalBackup: (backupId: string) => (backupId === "missing" ? null : { backupId }),
    restoreLocalBackup: (backupId: string) => (backupId === "missing" ? null : { backupId }),
    deleteProfileIrreversible: () => ({
      deleted: true as const,
      previousProfileId: "11111111-1111-4111-8111-111111111111",
      nextProfileId: "22222222-2222-4222-8222-222222222222"
    })
  };

  handler = createControlRequestHandler({
    storeService,
    runGoogleTakeoutImport: async () => ({ artifactsScanned: 0, inferencesCreated: 0, inferencesSuppressed: 0 })
  });
});

afterEach(async () => {
  delete process.env.DOSSIER_CONTROL_TOKEN_OVERRIDE;
  process.env.DOSSIER_CONTROL_TOKEN_OVERRIDE = "test-token";
});

async function request(
  path: string,
  options: { method?: string; body?: string } = {},
  withAuth = true
): Promise<{ status: number; body: unknown }> {
  const req = new Readable({ read: () => undefined }) as IncomingMessage;
  req.method = options.method ?? "GET";
  req.url = path;
  req.headers = {
    "content-type": "application/json",
    ...(withAuth ? { "x-dossier-control-token": "test-token" } : {})
  };

  let status = 0;
  let rawBody = "";
  const res = {
    writeHead: (statusCode: number) => {
      status = statusCode;
      return res;
    },
    end: (chunk?: string | Buffer) => {
      if (chunk) {
        rawBody += Buffer.isBuffer(chunk) ? chunk.toString("utf8") : chunk;
      }
    }
  } as unknown as ServerResponse;

  const done = handler(req, res);
  if (options.body) {
    req.push(options.body);
  }
  req.push(null);
  await done;

  return {
    status,
    body: rawBody ? (JSON.parse(rawBody) as unknown) : null
  };
}

describe("control API routes", () => {
  test("requires auth on new phase-2 routes", async () => {
    const routes = [
      ["PATCH", "/control/profile/items/item-1", { text: "x" }],
      ["DELETE", "/control/profile/items/item-1", undefined],
      ["POST", "/control/profile/inferences/item-1/confirm", {}],
      ["POST", "/control/profile/inferences/item-1/edit-confirm", { editedText: "x" }],
      ["POST", "/control/profile/inferences/item-1/dismiss", {}],
      ["POST", "/control/profile/inferences", { text: "x", itemType: "preference" }],
      ["GET", "/control/topic-rules", undefined],
      ["POST", "/control/topic-rules", { pattern: "health" }],
      ["PATCH", "/control/topic-rules/rule-1", { pattern: "finance" }],
      ["DELETE", "/control/topic-rules/rule-1", undefined],
      ["GET", "/control/categories", undefined],
      ["POST", "/control/categories", { name: "Personal" }],
      ["PATCH", "/control/categories/cat-1", { name: "Work" }],
      ["DELETE", "/control/categories/cat-1", undefined],
      ["GET", "/control/compartments", undefined],
      ["POST", "/control/compartments", { name: "Work" }],
      ["PATCH", "/control/compartments/comp-1", { name: "External" }],
      ["DELETE", "/control/compartments/comp-1", undefined],
      ["GET", "/control/profile/items/item-1/compartments", undefined],
      ["PUT", "/control/profile/items/item-1/compartments", { compartmentIds: ["comp-1"] }],
      ["GET", "/control/consent/req-1", undefined],
      ["POST", "/control/consent/req-1/decision", { decision: "DECLINE", allowed_item_ids: [], blocked_item_overrides: [] }],
      ["GET", "/control/services", undefined],
      ["POST", "/control/services/svc/revoke", {}],
      ["GET", "/control/audit", undefined],
      ["GET", "/control/data/backups", undefined],
      ["POST", "/control/data/backups", { passphrase: "secret" }],
      ["POST", "/control/data/backups/b-1/verify", {}],
      ["POST", "/control/data/backups/b-1/restore", { passphrase: "secret" }],
      ["POST", "/control/profile/delete-irreversible", { confirmationText: "DELETE MY PROFILE" }]
    ] as const;

    for (const [method, path, body] of routes) {
      const res = await request(path, { method, ...(body ? { body: JSON.stringify(body) } : {}) }, false);
      expect(res.status).toBe(401);
      const payload = res.body as { error: { code: string } };
      expect(payload.error.code).toBe("UNAUTHORIZED");
    }
  });

  test("serves happy path for phase-2 endpoints", async () => {
    const routes = [
      ["PATCH", "/control/profile/items/item-1", { text: "new text" }, 200],
      ["DELETE", "/control/profile/items/item-1", undefined, 200],
      ["POST", "/control/profile/inferences/item-1/confirm", {}, 200],
      ["POST", "/control/profile/inferences/item-1/edit-confirm", { editedText: "edited" }, 200],
      ["POST", "/control/profile/inferences/item-1/dismiss", { dismissReason: "wrong" }, 200],
      ["POST", "/control/profile/inferences", { text: "proposal", itemType: "preference" }, 201],
      ["POST", "/control/profile/inferences", { text: "suppressed", itemType: "preference" }, 200],
      ["GET", "/control/topic-rules", undefined, 200],
      ["POST", "/control/topic-rules", { pattern: "health" }, 201],
      ["PATCH", "/control/topic-rules/rule-1", { pattern: "finance" }, 200],
      ["DELETE", "/control/topic-rules/rule-1", undefined, 200],
      ["GET", "/control/categories", undefined, 200],
      ["POST", "/control/categories", { name: "Personal" }, 201],
      ["PATCH", "/control/categories/cat-1", { name: "Work" }, 200],
      ["DELETE", "/control/categories/cat-1", undefined, 200],
      ["GET", "/control/compartments", undefined, 200],
      ["POST", "/control/compartments", { name: "Work" }, 201],
      ["PATCH", "/control/compartments/comp-1", { name: "External" }, 200],
      ["DELETE", "/control/compartments/comp-1", undefined, 200],
      ["GET", "/control/profile/items/item-1/compartments", undefined, 200],
      ["PUT", "/control/profile/items/item-1/compartments", { compartmentIds: ["comp-1"] }, 200],
      ["GET", "/control/consent/req-1", undefined, 200],
      ["POST", "/control/consent/req-1/decision", { decision: "DECLINE", allowed_item_ids: [], blocked_item_overrides: [] }, 200],
      ["GET", "/control/services", undefined, 200],
      ["POST", "/control/services/svc/revoke", {}, 200],
      ["GET", "/control/audit?date_from=2026-01-01T00:00:00.000Z&type=DISCLOSURE_SENT,CONSENT_DECIDED", undefined, 200],
      ["GET", "/control/data/backups", undefined, 200],
      ["POST", "/control/data/backups", { passphrase: "secret" }, 201],
      ["POST", "/control/data/backups/b-1/verify", {}, 200],
      ["POST", "/control/data/backups/b-1/restore", { passphrase: "secret" }, 200],
      ["POST", "/control/profile/delete-irreversible", { confirmationText: "DELETE MY PROFILE" }, 200]
    ] as const;

    for (const [method, path, body, status] of routes) {
      const res = await request(path, { method, ...(body ? { body: JSON.stringify(body) } : {}) }, true);
      expect(res.status).toBe(status);
    }
  });

  test("returns standardized error payloads", async () => {
    const response = await request("/control/categories/missing", { method: "DELETE" }, true);

    expect(response.status).toBe(404);
    const payload = response.body as {
      error: { code: string; message: string; details?: unknown };
    };
    expect(payload.error.code).toBe("NOT_FOUND");
    expect(typeof payload.error.message).toBe("string");
  });

  test("validates local model settings payload", async () => {
    const response = await request(
      "/control/settings",
      {
        method: "PUT",
        body: JSON.stringify({
          next: {
            localModelEndpoint: "https://example.com/v1",
            localModelName: "mistral"
          }
        })
      },
      true
    );

    expect(response.status).toBe(400);
    const payload = response.body as { error: { code: string; message: string } };
    expect(payload.error.code).toBe("BAD_REQUEST");
    expect(payload.error.message).toContain("local host");
  });

  test("requires profile delete confirmation phrase", async () => {
    const response = await request(
      "/control/profile/delete-irreversible",
      {
        method: "POST",
        body: JSON.stringify({ confirmationText: "delete" })
      },
      true
    );

    expect(response.status).toBe(400);
    const payload = response.body as { error: { code: string } };
    expect(payload.error.code).toBe("BAD_REQUEST");
  });
});
