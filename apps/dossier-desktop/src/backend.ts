import { randomBytes, randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

type LlmProviderId =
  | "ollama"
  | "custom"
  | "openai"
  | "anthropic"
  | "google"
  | "openrouter"
  | "grok";

type LlmAuthMethod = "apiKey" | "oauth";

type LlmProfile = {
  id: string;
  name: string;
  provider: LlmProviderId;
  endpoint: string;
  model: string;
  authMethod: LlmAuthMethod;
  apiKey?: string;
  oauthToken?: string;
};

type LlmRuntimeConfig = {
  endpoint: string;
  model: string;
  provider: LlmProviderId;
  authMethod: LlmAuthMethod;
  apiKey?: string;
  oauthToken?: string;
};

type DossierSettings = {
  theme: string;
  dyslexiaMode: boolean;
  highFidelityEnabled: boolean;
  startOnLogin: boolean;
  autoUpdatesEnabled: boolean;
  skippedUpdateVersion: string | null;
  localModelEndpoint: string;
  localModelName: string;
  llmProfiles: LlmProfile[];
  activeLlmProfileId: string | null;
  [key: string]: unknown;
};

type BackendReadyPayload = {
  type: "ready";
  controlPort: number;
  controlToken: string;
};

type ControlErrorCode = "BAD_REQUEST" | "NOT_FOUND" | "CONFLICT" | "UNAUTHORIZED" | "INTERNAL";

type TopicRuleInput = {
  ruleId?: string;
  profileId?: string;
  pattern: string;
  matchMode?: "EXACT" | "PHRASE" | "KEYWORD" | "REGEX";
  scope?: "STORAGE" | "SHARING" | "STORAGE_AND_SHARING";
  isEnabled?: boolean;
};

type RepositoryPort = {
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
    evidenceSummaryId?: string | null;
  }) => unknown | null;
  updateItem: (
    itemId: string,
    patch: Partial<{ text: string; item_type: string; category_id: string | null }>
  ) => unknown | null;
  deleteItemIrreversible: (itemId: string, reason?: "USER_DELETE" | "HF_MODE_DISABLED" | "RETENTION_POLICY" | "MIGRATION") => boolean;
  confirmInference: (itemId: string) => unknown;
  editThenConfirmInference: (itemId: string, editedText: string) => unknown;
  dismissInference: (itemId: string, dismissReason?: string | null) => unknown;
  listTopicRules: () => unknown[];
  addTopicRule: (rule: {
    rule_id: string;
    profile_id: string;
    pattern: string;
    match_mode: "EXACT" | "PHRASE" | "KEYWORD" | "REGEX";
    scope: "STORAGE" | "SHARING" | "STORAGE_AND_SHARING";
    is_enabled: boolean;
  }) => unknown;
  updateTopicRule: (
    ruleId: string,
    patch: Partial<{
      pattern: string;
      match_mode: "EXACT" | "PHRASE" | "KEYWORD" | "REGEX";
      scope: "STORAGE" | "SHARING" | "STORAGE_AND_SHARING";
      is_enabled: boolean;
    }>
  ) => unknown | null;
  removeTopicRule: (ruleId: string) => boolean;
  listCategories: () => unknown[];
  createCategory: (input: { name: string; sortOrder?: number; isSystem?: boolean }) => unknown;
  updateCategory: (categoryId: string, patch: Partial<{ name: string; sort_order: number; is_system: boolean }>) => unknown | null;
  deleteCategory: (categoryId: string) => boolean;
  listCompartments: () => unknown[];
  createCompartment: (input: { name: string; description?: string | null; sortOrder?: number }) => unknown;
  updateCompartment: (compartmentId: string, patch: Partial<{ name: string; description: string | null; sort_order: number }>) => unknown | null;
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

type StoreServicePort = {
  repository: RepositoryPort;
  createEncryptedExport: (passphrase: string) => unknown;
  importEncryptedExport: (artifact: unknown, passphrase: string) => void;
  listLocalBackups: () => unknown[];
  createLocalBackup: (passphrase: string) => unknown;
  verifyLocalBackup: (backupId: string) => unknown | null;
  restoreLocalBackup: (backupId: string, passphrase: string) => unknown | null;
  deleteProfileIrreversible: () => { deleted: true; previousProfileId: string; nextProfileId: string };
};

type TakeoutImportScope = {
  dateRangePreset?: "last_12_months" | "all_time";
  includedProducts?: string[];
  prioritiseHighSignalItems?: boolean;
};

type TakeoutImportPlan = {
  workspaceId: string;
  sourcePath: string;
  sourceType: "directory" | "zip";
  generatedAt: string;
  totalFiles: number;
  parseableFiles: number;
  totalBytes: number;
  parseableBytes: number;
  detectedAccount: {
    email: string | null;
    label: string;
  };
  products: Array<{
    key: string;
    label: string;
    fileCount: number;
    parseableFileCount: number;
    totalBytes: number;
    parseableBytes: number;
    selectedByDefault: boolean;
  }>;
  defaultScope: {
    dateRangePreset: "last_12_months" | "all_time";
    includedProducts: string[];
  };
  warnings: string[];
};

type TakeoutImportResult = {
  workspaceId: string;
  sourceType: "directory" | "zip";
  artifactsScanned: number;
  artifactsImported: number;
  parseErrors: number;
  inferencesCreated: number;
  inferencesSuppressed: number;
  startedAt: string;
  completedAt: string;
  scope: {
    dateRangePreset: "last_12_months" | "all_time";
    includedProducts: string[];
    prioritiseHighSignalItems: boolean;
  };
  warnings: string[];
};

type TakeoutImportProgressEvent = {
  stage: "inventory" | "parse" | "scope" | "infer" | "store" | "complete";
  status: "started" | "progress" | "completed";
  message: string;
  metrics?: Record<string, string | number | boolean | null>;
};

type TakeoutImportJobStatus = "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";

type TakeoutImportJobRecord = {
  jobId: string;
  workspaceId: string;
  sourcePath: string;
  status: TakeoutImportJobStatus;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  scope: {
    dateRangePreset: "last_12_months" | "all_time";
    includedProducts: string[];
    prioritiseHighSignalItems: boolean;
  };
  plan: TakeoutImportPlan;
  events: Array<TakeoutImportProgressEvent & { at: string }>;
  result: TakeoutImportResult | null;
  error: string | null;
};

const defaultSettings: DossierSettings = {
  theme: "Parchment",
  dyslexiaMode: false,
  highFidelityEnabled: false,
  startOnLogin: false,
  autoUpdatesEnabled: true,
  skippedUpdateVersion: null,
  localModelEndpoint: "",
  localModelName: "",
  llmProfiles: [],
  activeLlmProfileId: null
};

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

let settingsCache: DossierSettings = { ...defaultSettings };
let storeService: StoreServicePort;
let profileServer: {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  on: (event: string, listener: (payload: unknown) => void) => void;
};
let runGoogleTakeoutImport: (
  store: unknown,
  sourcePath: string,
  llmConfig?: LlmRuntimeConfig | null,
  options?: {
    workspaceId?: string;
    scope?: TakeoutImportScope;
    onProgress?: (event: TakeoutImportProgressEvent) => void;
  }
) => Promise<TakeoutImportResult>;
let planGoogleTakeoutImport: (sourcePath: string, scope?: TakeoutImportScope) => TakeoutImportPlan;
let testLlmConnection: ((config: LlmRuntimeConfig) => Promise<{ ok: boolean; model: string; error?: string }>) | null = null;
let inferFromChatMessage: ((
  config: LlmRuntimeConfig,
  history: { role: string; content: string }[],
  userMessage: string,
  profileContext?: string
) => Promise<{ reply: string; proposals: { text: string; itemType: string; why: string; confidence: number | null }[] }>) | null = null;
let generateAlternatives: ((config: LlmRuntimeConfig, text: string, itemType: string, why?: string) => Promise<{ original: string; alternatives: { text: string; reason: string }[] }>) | null = null;
let shuttingDown = false;

const controlToken = randomBytes(24).toString("base64url");
const consentQueue: unknown[] = [];
const consentWaiters = new Set<(payload: unknown | null) => void>();
const takeoutImportJobs = new Map<string, TakeoutImportJobRecord>();

class ControlError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: ControlErrorCode,
    message: string,
    readonly details?: unknown
  ) {
    super(message);
  }
}

function toRouteItem(item: unknown): unknown {
  if (!item || typeof item !== "object") {
    return item;
  }

  const cast = item as {
    item_type?: string;
    category_id?: string | null;
  };

  return {
    ...cast,
    itemType: cast.item_type,
    categoryId: cast.category_id
  };
}

function toRouteItemRecord(item: unknown): Record<string, unknown> {
  const routed = toRouteItem(item);
  if (!routed || typeof routed !== "object") {
    return {};
  }
  return routed as Record<string, unknown>;
}

function toRouteItemDetails(payload: unknown): unknown {
  if (!payload || typeof payload !== "object") {
    return toRouteItem(payload);
  }

  const cast = payload as {
    item?: unknown;
    provenance?: unknown | null;
    topic?: unknown | null;
    compartment_ids?: string[];
  };

  if (cast.item === undefined) {
    return toRouteItem(payload);
  }

  return {
    ...toRouteItemRecord(cast.item),
    provenance: cast.provenance ?? null,
    topic: cast.topic ?? null,
    compartment_ids: cast.compartment_ids ?? []
  };
}

function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  res.writeHead(statusCode, JSON_HEADERS);
  res.end(JSON.stringify(body));
}

function sendControlError(res: ServerResponse, error: ControlError): void {
  sendJson(res, error.statusCode, {
    error: {
      code: error.code,
      message: error.message,
      ...(error.details !== undefined ? { details: error.details } : {})
    }
  });
}

function fail(statusCode: number, code: ControlErrorCode, message: string, details?: unknown): never {
  throw new ControlError(statusCode, code, message, details);
}

function writeReady(payload: BackendReadyPayload): void {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

function getHeader(req: IncomingMessage, name: string): string | undefined {
  const value = req.headers[name];
  if (!value) {
    return undefined;
  }
  return Array.isArray(value) ? value[0] : value;
}

function requireControlAuth(req: IncomingMessage): void {
  const expectedToken = process.env.DOSSIER_CONTROL_TOKEN_OVERRIDE ?? controlToken;
  const token = getHeader(req, "x-dossier-control-token");
  if (token !== expectedToken) {
    fail(401, "UNAUTHORIZED", "invalid control token");
  }
}

function parseUrl(req: IncomingMessage): URL {
  return new URL(req.url ?? "/", "http://127.0.0.1");
}

function routeParam(pathname: string, pattern: RegExp): RegExpMatchArray {
  const match = pathname.match(pattern);
  if (!match) {
    fail(404, "NOT_FOUND", "not found");
  }
  return match;
}

function parseBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  return fallback;
}

function parseOptionalString(value: unknown, fieldName: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    fail(400, "BAD_REQUEST", `${fieldName} must be a string`);
  }
  return value.trim();
}

function parseOptionalNullableString(
  value: unknown,
  fieldName: string
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value !== "string") {
    fail(400, "BAD_REQUEST", `${fieldName} must be a string or null`);
  }
  return value.trim();
}

function parseRequiredString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || !value.trim()) {
    fail(400, "BAD_REQUEST", `${fieldName} is required`);
  }
  return value.trim();
}

function parseTakeoutScope(value: unknown, fallback?: TakeoutImportScope): TakeoutImportScope {
  if (value === undefined || value === null) {
    return fallback ?? {};
  }

  if (!value || typeof value !== "object") {
    fail(400, "BAD_REQUEST", "scope must be an object");
  }

  const cast = value as {
    dateRangePreset?: unknown;
    includedProducts?: unknown;
    prioritiseHighSignalItems?: unknown;
  };

  const dateRangePreset =
    cast.dateRangePreset === "all_time" || cast.dateRangePreset === "last_12_months"
      ? cast.dateRangePreset
      : fallback?.dateRangePreset;

  const includedProducts = Array.isArray(cast.includedProducts)
    ? cast.includedProducts
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
    : fallback?.includedProducts;

  const prioritiseHighSignalItems =
    typeof cast.prioritiseHighSignalItems === "boolean"
      ? cast.prioritiseHighSignalItems
      : fallback?.prioritiseHighSignalItems;

  return {
    ...(dateRangePreset ? { dateRangePreset } : {}),
    ...(includedProducts ? { includedProducts } : {}),
    ...(prioritiseHighSignalItems !== undefined ? { prioritiseHighSignalItems } : {})
  };
}

function validateEndpointUrl(endpoint: string, fieldName: string): void {
  let parsed: URL;
  try {
    parsed = new URL(endpoint);
  } catch {
    fail(400, "BAD_REQUEST", `${fieldName} must be a valid URL`);
    return;
  }

  if (!parsed.protocol || !["http:", "https:"].includes(parsed.protocol)) {
    fail(400, "BAD_REQUEST", `${fieldName} must use http or https`);
  }
}

function toProviderId(value: unknown): LlmProviderId {
  switch (value) {
    case "ollama":
    case "custom":
    case "openai":
    case "anthropic":
    case "google":
    case "openrouter":
    case "grok":
      return value;
    default:
      return "custom";
  }
}

function toAuthMethod(value: unknown): LlmAuthMethod {
  return value === "oauth" ? "oauth" : "apiKey";
}

function parseLlmProfile(value: unknown, index: number): LlmProfile {
  if (!value || typeof value !== "object") {
    fail(400, "BAD_REQUEST", `llmProfiles[${index}] must be an object`);
  }

  const raw = value as Record<string, unknown>;
  const provider = toProviderId(raw.provider);
  const endpoint = parseRequiredString(raw.endpoint, `llmProfiles[${index}].endpoint`);
  const model = parseRequiredString(raw.model, `llmProfiles[${index}].model`);
  validateEndpointUrl(endpoint, `llmProfiles[${index}].endpoint`);

  const apiKey = parseOptionalString(raw.apiKey, `llmProfiles[${index}].apiKey`) ?? "";
  const oauthToken =
    parseOptionalString(raw.oauthToken, `llmProfiles[${index}].oauthToken`) ?? "";

  return {
    id: parseOptionalString(raw.id, `llmProfiles[${index}].id`) || randomUUID(),
    name:
      parseOptionalString(raw.name, `llmProfiles[${index}].name`) ||
      `${provider}-${index + 1}`,
    provider,
    endpoint,
    model,
    authMethod: toAuthMethod(raw.authMethod),
    apiKey,
    oauthToken
  };
}

function parseLlmProfiles(value: unknown): LlmProfile[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    fail(400, "BAD_REQUEST", "llmProfiles must be an array");
  }

  return value.map((profile, index) => parseLlmProfile(profile, index));
}

function validateLegacyModelSettings(endpoint: string, model: string): void {
  if (!endpoint && !model) {
    return;
  }
  if (!endpoint || !model) {
    fail(400, "BAD_REQUEST", "localModelEndpoint and localModelName must both be set");
  }
  validateEndpointUrl(endpoint, "localModelEndpoint");
}

function normalizeSettingsPatch(payload: unknown): DossierSettings {
  if (!payload || typeof payload !== "object") {
    fail(400, "BAD_REQUEST", "settings payload is required");
  }

  const input = payload as { next?: Record<string, unknown> };
  const next = input.next;
  if (!next || typeof next !== "object") {
    fail(400, "BAD_REQUEST", "next settings payload is required");
  }

  const theme = parseOptionalString(next.theme, "theme");
  const localModelEndpoint = parseOptionalString(next.localModelEndpoint, "localModelEndpoint");
  const localModelName = parseOptionalString(next.localModelName, "localModelName");
  const llmProfiles = parseLlmProfiles(next.llmProfiles);
  const activeLlmProfileId = parseOptionalNullableString(
    next.activeLlmProfileId,
    "activeLlmProfileId"
  );
  const passthrough = Object.fromEntries(
    Object.entries(next).filter(
      ([key]) =>
        ![
          "theme",
          "dyslexiaMode",
          "highFidelityEnabled",
          "startOnLogin",
          "autoUpdatesEnabled",
          "skippedUpdateVersion",
          "localModelEndpoint",
          "localModelName",
          "llmProfiles",
          "activeLlmProfileId"
        ].includes(key)
    )
  );

  const normalized: DossierSettings = {
    ...settingsCache,
    ...passthrough,
    ...(theme !== undefined ? { theme: theme || defaultSettings.theme } : {}),
    dyslexiaMode: parseBoolean(next.dyslexiaMode, settingsCache.dyslexiaMode),
    highFidelityEnabled: parseBoolean(next.highFidelityEnabled, settingsCache.highFidelityEnabled),
    startOnLogin: parseBoolean(next.startOnLogin, settingsCache.startOnLogin),
    autoUpdatesEnabled: parseBoolean(
      next.autoUpdatesEnabled,
      settingsCache.autoUpdatesEnabled ?? defaultSettings.autoUpdatesEnabled
    ),
    skippedUpdateVersion: parseOptionalNullableString(
      next.skippedUpdateVersion,
      "skippedUpdateVersion"
    ),
    ...(localModelEndpoint !== undefined ? { localModelEndpoint } : {}),
    ...(localModelName !== undefined ? { localModelName } : {}),
    ...(llmProfiles !== undefined ? { llmProfiles } : {}),
    ...(activeLlmProfileId !== undefined ? { activeLlmProfileId } : {})
  };

  validateLegacyModelSettings(normalized.localModelEndpoint, normalized.localModelName);

  if (
    normalized.activeLlmProfileId &&
    !normalized.llmProfiles.some((profile) => profile.id === normalized.activeLlmProfileId)
  ) {
    fail(400, "BAD_REQUEST", "activeLlmProfileId must reference an existing llmProfiles entry");
  }

  if (normalized.llmProfiles.length === 0) {
    normalized.activeLlmProfileId = null;
  }

  return normalized;
}

function parseTopicRuleInput(payload: unknown, profileId: string): {
  rule_id: string;
  profile_id: string;
  pattern: string;
  match_mode: "EXACT" | "PHRASE" | "KEYWORD" | "REGEX";
  scope: "STORAGE" | "SHARING" | "STORAGE_AND_SHARING";
  is_enabled: boolean;
} {
  if (!payload || typeof payload !== "object") {
    fail(400, "BAD_REQUEST", "topic rule payload is required");
  }

  const input = payload as TopicRuleInput;
  if (!input.pattern?.trim()) {
    fail(400, "BAD_REQUEST", "pattern is required");
  }

  return {
    rule_id: input.ruleId ?? randomUUID(),
    profile_id: input.profileId ?? profileId,
    pattern: input.pattern.trim(),
    match_mode: input.matchMode ?? "KEYWORD",
    scope: input.scope ?? "STORAGE_AND_SHARING",
    is_enabled: parseBoolean(input.isEnabled, true)
  };
}

type RuntimeTopicRule = {
  rule_id: string;
  pattern: string;
  match_mode: "EXACT" | "PHRASE" | "KEYWORD" | "REGEX";
  scope: "STORAGE" | "SHARING" | "STORAGE_AND_SHARING";
  is_enabled: boolean;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function toRuntimeTopicRules(rawRules: unknown[]): RuntimeTopicRule[] {
  return rawRules
    .map((rule) => asRecord(rule))
    .map((rule) => {
      const matchMode: RuntimeTopicRule["match_mode"] =
        rule.match_mode === "EXACT" ||
        rule.match_mode === "PHRASE" ||
        rule.match_mode === "KEYWORD" ||
        rule.match_mode === "REGEX"
          ? rule.match_mode
          : "KEYWORD";
      const scope: RuntimeTopicRule["scope"] =
        rule.scope === "STORAGE" ||
        rule.scope === "SHARING" ||
        rule.scope === "STORAGE_AND_SHARING"
          ? rule.scope
          : "STORAGE_AND_SHARING";

      return {
        rule_id: typeof rule.rule_id === "string" ? rule.rule_id : randomUUID(),
        pattern: typeof rule.pattern === "string" ? rule.pattern : "",
        match_mode: matchMode,
        scope,
        is_enabled: Boolean(rule.is_enabled)
      };
    })
    .filter((rule) => rule.pattern.trim().length > 0);
}

function safeRegex(pattern: string): RegExp | null {
  try {
    return new RegExp(pattern, "i");
  } catch {
    return null;
  }
}

function findMatchedTopicRule(text: string, rules: RuntimeTopicRule[]): RuntimeTopicRule | null {
  const normalized = text.trim().toLowerCase();

  for (const rule of rules) {
    if (!rule.is_enabled) {
      continue;
    }

    const pattern = rule.pattern.trim().toLowerCase();
    if (!pattern) {
      continue;
    }

    if (rule.match_mode === "EXACT" && normalized === pattern) {
      return rule;
    }

    if ((rule.match_mode === "PHRASE" || rule.match_mode === "KEYWORD") && normalized.includes(pattern)) {
      return rule;
    }

    if (rule.match_mode === "REGEX") {
      const regex = safeRegex(rule.pattern);
      if (regex && regex.test(text)) {
        return rule;
      }
    }
  }

  return null;
}

function sanitizeSettingsForContext(settings: DossierSettings): Record<string, unknown> {
  const activeProfile =
    settings.llmProfiles.find((profile) => profile.id === settings.activeLlmProfileId) ??
    settings.llmProfiles[0] ??
    null;

  return {
    profilePreferences: {
      theme: settings.theme,
      dyslexiaMode: settings.dyslexiaMode,
      highFidelityEnabled: settings.highFidelityEnabled,
      startOnLogin: settings.startOnLogin
    },
    llm: {
      activeProfileId: settings.activeLlmProfileId,
      activeProfile: activeProfile
        ? {
            id: activeProfile.id,
            name: activeProfile.name,
            provider: activeProfile.provider,
            endpoint: activeProfile.endpoint,
            model: activeProfile.model,
            authMethod: activeProfile.authMethod
          }
        : null,
      profileCount: settings.llmProfiles.length,
      legacyModelConfigured: Boolean(settings.localModelEndpoint && settings.localModelName)
    }
  };
}

function buildChatProfileContext(repository: RepositoryPort): string {
  const profileId = repository.snapshot().profile.profile_id;
  const items = repository.listItemDetailsViews().map((entry) => {
    const item = toRouteItemRecord(entry.item);
    const topic = asRecord(entry.topic);
    const provenance = asRecord(entry.provenance);

    return {
      itemId: typeof item.item_id === "string" ? item.item_id : null,
      text: typeof item.text === "string" ? item.text : "",
      itemType: typeof item.itemType === "string" ? item.itemType : item.item_type,
      state: typeof item.state === "string" ? item.state : null,
      categoryId: typeof item.categoryId === "string" ? item.categoryId : item.category_id,
      isTopicBlocked: Boolean(topic.is_topic_blocked),
      blockedByRuleId: typeof topic.blocked_by_rule_id === "string" ? topic.blocked_by_rule_id : null,
      sourceLabel: typeof provenance.source_label === "string" ? provenance.source_label : null,
      confidence:
        typeof provenance.confidence === "number" || provenance.confidence === null
          ? provenance.confidence
          : null,
      compartmentIds: Array.isArray(entry.compartment_ids) ? entry.compartment_ids : []
    };
  });

  return JSON.stringify(
    {
      profileId,
      settings: sanitizeSettingsForContext(settingsCache),
      categories: repository.listCategories(),
      compartments: repository.listCompartments(),
      topicRules: toRuntimeTopicRules(repository.listTopicRules()),
      profileItems: items
    },
    null,
    2
  );
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown);
      } catch {
        reject(new ControlError(400, "BAD_REQUEST", "invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function shiftConsentEvent(): unknown | null {
  const next = consentQueue.shift();
  return next ?? null;
}

function pushConsentEvent(payload: unknown): void {
  const waiter = consentWaiters.values().next().value as ((payload: unknown | null) => void) | undefined;
  if (waiter) {
    consentWaiters.delete(waiter);
    waiter(payload);
    return;
  }
  consentQueue.push(payload);
}

function appendTakeoutJobEvent(job: TakeoutImportJobRecord, event: TakeoutImportProgressEvent): void {
  job.events.push({
    ...event,
    at: new Date().toISOString()
  });
  if (job.events.length > 1200) {
    job.events.splice(0, job.events.length - 1200);
  }
}

function toTakeoutJobResponse(job: TakeoutImportJobRecord): Record<string, unknown> {
  return {
    jobId: job.jobId,
    workspaceId: job.workspaceId,
    sourcePath: job.sourcePath,
    status: job.status,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    scope: job.scope,
    plan: job.plan,
    events: job.events,
    result: job.result,
    error: job.error
  };
}

function startTakeoutImportJob(
  options: {
    storeService: StoreServicePort;
    runGoogleTakeoutImport: (
      store: unknown,
      sourcePath: string,
      llmConfig?: LlmRuntimeConfig | null,
      runOptions?: {
        workspaceId?: string;
        scope?: TakeoutImportScope;
        onProgress?: (event: TakeoutImportProgressEvent) => void;
      }
    ) => Promise<TakeoutImportResult>;
  },
  payload: {
    sourcePath: string;
    workspaceId: string;
    scope: {
      dateRangePreset: "last_12_months" | "all_time";
      includedProducts: string[];
      prioritiseHighSignalItems: boolean;
    };
    plan: TakeoutImportPlan;
  }
): TakeoutImportJobRecord {
  const jobId = randomUUID();
  const job: TakeoutImportJobRecord = {
    jobId,
    workspaceId: payload.workspaceId,
    sourcePath: payload.sourcePath,
    status: "QUEUED",
    createdAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
    scope: payload.scope,
    plan: payload.plan,
    events: [],
    result: null,
    error: null
  };

  takeoutImportJobs.set(jobId, job);
  appendTakeoutJobEvent(job, {
    stage: "inventory",
    status: "started",
    message: "Import job queued."
  });

  queueMicrotask(() => {
    job.status = "RUNNING";
    job.startedAt = new Date().toISOString();
    appendTakeoutJobEvent(job, {
      stage: "inventory",
      status: "progress",
      message: "Import job started."
    });

    void options
      .runGoogleTakeoutImport(options.storeService, payload.sourcePath, getLlmConfig(), {
        workspaceId: payload.workspaceId,
        scope: payload.scope,
        onProgress: (event) => {
          appendTakeoutJobEvent(job, event);
        }
      })
      .then((result) => {
        job.status = "COMPLETED";
        job.completedAt = new Date().toISOString();
        job.result = result;
      })
      .catch((error) => {
        job.status = "FAILED";
        job.completedAt = new Date().toISOString();
        job.error = error instanceof Error ? error.message : "Import failed";
        appendTakeoutJobEvent(job, {
          stage: "complete",
          status: "completed",
          message: `Import failed: ${job.error}`
        });
      });
  });

  return job;
}

async function awaitConsentEvent(timeoutMs: number): Promise<unknown | null> {
  const existing = shiftConsentEvent();
  if (existing) {
    return existing;
  }

  return new Promise((resolve) => {
    const waiter = (payload: unknown | null): void => {
      clearTimeout(timeout);
      consentWaiters.delete(waiter);
      resolve(payload);
    };

    const timeout = setTimeout(() => {
      consentWaiters.delete(waiter);
      resolve(null);
    }, timeoutMs);

    consentWaiters.add(waiter);
  });
}

async function shutdown(controlServer: ReturnType<typeof createServer>): Promise<void> {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;

  for (const waiter of consentWaiters) {
    waiter(null);
  }
  consentWaiters.clear();

  await Promise.allSettled([
    profileServer.stop(),
    new Promise<void>((resolve) => {
      controlServer.close(() => resolve());
    })
  ]);
}

function getLlmConfig(): LlmRuntimeConfig | null {
  const activeProfile =
    settingsCache.llmProfiles.find(
      (profile) => profile.id === settingsCache.activeLlmProfileId
    ) ?? settingsCache.llmProfiles[0];

  if (activeProfile?.endpoint && activeProfile.model) {
    return {
      endpoint: activeProfile.endpoint,
      model: activeProfile.model,
      provider: activeProfile.provider,
      authMethod: activeProfile.authMethod,
      ...(activeProfile.apiKey?.trim() ? { apiKey: activeProfile.apiKey.trim() } : {}),
      ...(activeProfile.oauthToken?.trim()
        ? { oauthToken: activeProfile.oauthToken.trim() }
        : {})
    };
  }

  if (settingsCache.localModelEndpoint && settingsCache.localModelName) {
    return {
      endpoint: settingsCache.localModelEndpoint,
      model: settingsCache.localModelName,
      provider: "custom",
      authMethod: "apiKey"
    };
  }

  return null;
}

function parseLlmRuntimeConfig(value: unknown): LlmRuntimeConfig {
  if (!value || typeof value !== "object") {
    fail(400, "BAD_REQUEST", "llm payload is required");
  }

  const raw = value as Record<string, unknown>;
  const endpoint = parseRequiredString(raw.endpoint, "endpoint");
  const model = parseRequiredString(raw.model, "model");
  validateEndpointUrl(endpoint, "endpoint");
  const apiKey = parseOptionalString(raw.apiKey, "apiKey");
  const oauthToken = parseOptionalString(raw.oauthToken, "oauthToken");

  return {
    endpoint,
    model,
    provider: toProviderId(raw.provider),
    authMethod: toAuthMethod(raw.authMethod),
    ...(apiKey ? { apiKey } : {}),
    ...(oauthToken ? { oauthToken } : {})
  };
}

async function detectOllamaModels(endpoint: string): Promise<string[]> {
  const parsed = new URL(endpoint);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    return [];
  }

  const origin = `${parsed.protocol}//${parsed.host}`;
  const fromTags = await fetch(`${origin}/api/tags`, {
    signal: AbortSignal.timeout(8_000)
  })
    .then(async (response) => {
      if (!response.ok) {
        return [] as string[];
      }
      const data = (await response.json()) as {
        models?: Array<{ name?: string; model?: string }>;
      };
      return (
        data.models
          ?.map((entry) => entry.name ?? entry.model ?? "")
          .filter((name) => Boolean(name?.trim()))
          .map((name) => name.trim()) ?? []
      );
    })
    .catch(() => [] as string[]);

  const basePath = endpoint.replace(/\/+$/, "");
  const fromOpenAiList = await fetch(`${basePath}/models`, {
    signal: AbortSignal.timeout(8_000)
  })
    .then(async (response) => {
      if (!response.ok) {
        return [] as string[];
      }
      const data = (await response.json()) as {
        data?: Array<{ id?: string }>;
      };
      return (
        data.data
          ?.map((entry) => entry.id ?? "")
          .filter((name) => Boolean(name?.trim()))
          .map((name) => name.trim()) ?? []
      );
    })
    .catch(() => [] as string[]);

  return [...new Set([...fromTags, ...fromOpenAiList])];
}

export function createControlRequestHandler(options: {
  storeService: StoreServicePort;
  runGoogleTakeoutImport: (
    store: unknown,
    sourcePath: string,
    llmConfig?: LlmRuntimeConfig | null,
    runOptions?: {
      workspaceId?: string;
      scope?: TakeoutImportScope;
      onProgress?: (event: TakeoutImportProgressEvent) => void;
    }
  ) => Promise<TakeoutImportResult>;
  planGoogleTakeoutImport: (sourcePath: string, scope?: TakeoutImportScope) => TakeoutImportPlan;
}): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  return async (req, res) => {
    const method = req.method ?? "GET";
    const reqUrl = parseUrl(req);
    const path = reqUrl.pathname;

    try {
      if (method === "GET" && path === "/control/health") {
        sendJson(res, 200, { ok: true });
        return;
      }

      requireControlAuth(req);

      if (method === "GET" && path === "/control/app/version") {
        sendJson(res, 200, { version: process.env.DOSSIER_APP_VERSION ?? "0.1.0" });
        return;
      }

      if (method === "GET" && path === "/control/settings") {
        sendJson(res, 200, settingsCache);
        return;
      }

      if (method === "PUT" && path === "/control/settings") {
        settingsCache = normalizeSettingsPatch(await readJsonBody(req));

        options.storeService.repository.setHighFidelityEnabled(settingsCache.highFidelityEnabled);
        options.storeService.repository.updateProfileSettings({ ...settingsCache });
        sendJson(res, 200, settingsCache);
        return;
      }

      if (method === "POST" && path === "/control/profile/delete-irreversible") {
        const payload = (await readJsonBody(req)) as { confirmationText?: string };
        if (payload.confirmationText !== "DELETE MY PROFILE") {
          fail(400, "BAD_REQUEST", "confirmationText must match DELETE MY PROFILE");
        }

        const result = options.storeService.deleteProfileIrreversible();
        settingsCache = { ...defaultSettings };
        options.storeService.repository.updateProfileSettings({ ...settingsCache });

        sendJson(res, 200, result);
        return;
      }

      if (method === "GET" && path === "/control/profile/items") {
        const items = options.storeService.repository.listItemDetailsViews().map(toRouteItemDetails);
        sendJson(res, 200, items);
        return;
      }

      if (method === "POST" && path === "/control/profile/items") {
        const payload = (await readJsonBody(req)) as {
          text?: string;
          itemType?: string;
          categoryId?: string | null;
        };

        if (!payload.text || !payload.itemType || !("categoryId" in payload)) {
          fail(400, "BAD_REQUEST", "text, itemType, and categoryId are required");
        }

        const item = options.storeService.repository.createManualItem({
          text: payload.text,
          itemType: payload.itemType,
          categoryId: payload.categoryId ?? null
        });
        sendJson(res, 201, toRouteItem(item));
        return;
      }

      if (method === "PATCH" && path.match(/^\/control\/profile\/items\/[^/]+$/)) {
        const itemId = routeParam(path, /^\/control\/profile\/items\/([^/]+)$/)[1]!;
        const payload = (await readJsonBody(req)) as {
          text?: string;
          itemType?: string;
          categoryId?: string | null;
        };
        const next = options.storeService.repository.updateItem(itemId, {
          ...(payload.text !== undefined ? { text: payload.text } : {}),
          ...(payload.itemType !== undefined ? { item_type: payload.itemType } : {}),
          ...(payload.categoryId !== undefined ? { category_id: payload.categoryId } : {})
        });
        if (!next) {
          fail(404, "NOT_FOUND", "item not found");
        }
        sendJson(res, 200, toRouteItem(next));
        return;
      }

      if (method === "DELETE" && path.match(/^\/control\/profile\/items\/[^/]+$/)) {
        const itemId = routeParam(path, /^\/control\/profile\/items\/([^/]+)$/)[1]!;
        const deleted = options.storeService.repository.deleteItemIrreversible(itemId);
        if (!deleted) {
          fail(404, "NOT_FOUND", "item not found");
        }
        sendJson(res, 200, { deleted: true, itemId });
        return;
      }

      if (method === "POST" && path.match(/^\/control\/profile\/inferences\/[^/]+\/confirm$/)) {
        const itemId = routeParam(path, /^\/control\/profile\/inferences\/([^/]+)\/confirm$/)[1]!;
        const next = options.storeService.repository.confirmInference(itemId);
        sendJson(res, 200, toRouteItem(next));
        return;
      }

      if (method === "POST" && path.match(/^\/control\/profile\/inferences\/[^/]+\/edit-confirm$/)) {
        const itemId = routeParam(path, /^\/control\/profile\/inferences\/([^/]+)\/edit-confirm$/)[1]!;
        const payload = (await readJsonBody(req)) as { editedText?: string };
        if (!payload.editedText?.trim()) {
          fail(400, "BAD_REQUEST", "editedText is required");
        }
        const next = options.storeService.repository.editThenConfirmInference(itemId, payload.editedText);
        sendJson(res, 200, toRouteItem(next));
        return;
      }

      if (method === "POST" && path.match(/^\/control\/profile\/inferences\/[^/]+\/dismiss$/)) {
        const itemId = routeParam(path, /^\/control\/profile\/inferences\/([^/]+)\/dismiss$/)[1]!;
        const payload = (await readJsonBody(req)) as { dismissReason?: string | null };
        const next = options.storeService.repository.dismissInference(itemId, payload.dismissReason ?? null);
        sendJson(res, 200, next);
        return;
      }

      if (method === "POST" && path === "/control/profile/inferences") {
        const payload = (await readJsonBody(req)) as {
          text?: string;
          itemType?: string;
          categoryId?: string | null;
          sourceLabel?: string;
          whyDossierThinksThis?: string | null;
          confidence?: number | null;
        };

        if (!payload.text?.trim() || !payload.itemType?.trim()) {
          fail(400, "BAD_REQUEST", "text and itemType are required");
        }

        const created = options.storeService.repository.createInference({
          text: payload.text.trim(),
          itemType: payload.itemType.trim(),
          categoryId: payload.categoryId ?? null,
          createdVia: "CHAT",
          ...(payload.sourceLabel !== undefined ? { sourceLabel: payload.sourceLabel } : {}),
          ...(payload.whyDossierThinksThis !== undefined
            ? { whyDossierThinksThis: payload.whyDossierThinksThis }
            : {}),
          ...(payload.confidence !== undefined ? { confidence: payload.confidence } : {})
        });

        if (!created) {
          sendJson(res, 200, {
            suppressed: true,
            reason: "RULE_SUPPRESSED_OR_DISMISSED"
          });
          return;
        }

        sendJson(res, 201, toRouteItem(created));
        return;
      }

      if (method === "GET" && path === "/control/topic-rules") {
        sendJson(res, 200, options.storeService.repository.listTopicRules());
        return;
      }

      if (method === "POST" && path === "/control/topic-rules") {
        const payload = await readJsonBody(req);
        const parsed = parseTopicRuleInput(payload, options.storeService.repository.snapshot().profile.profile_id);
        const created = options.storeService.repository.addTopicRule(parsed);
        sendJson(res, 201, created);
        return;
      }

      if (method === "PATCH" && path.match(/^\/control\/topic-rules\/[^/]+$/)) {
        const ruleId = routeParam(path, /^\/control\/topic-rules\/([^/]+)$/)[1]!;
        const payload = (await readJsonBody(req)) as TopicRuleInput;
        const next = options.storeService.repository.updateTopicRule(ruleId, {
          ...(payload.pattern !== undefined ? { pattern: payload.pattern } : {}),
          ...(payload.matchMode !== undefined ? { match_mode: payload.matchMode } : {}),
          ...(payload.scope !== undefined ? { scope: payload.scope } : {}),
          ...(payload.isEnabled !== undefined ? { is_enabled: payload.isEnabled } : {})
        });
        if (!next) {
          fail(404, "NOT_FOUND", "topic rule not found");
        }
        sendJson(res, 200, next);
        return;
      }

      if (method === "DELETE" && path.match(/^\/control\/topic-rules\/[^/]+$/)) {
        const ruleId = routeParam(path, /^\/control\/topic-rules\/([^/]+)$/)[1]!;
        const deleted = options.storeService.repository.removeTopicRule(ruleId);
        if (!deleted) {
          fail(404, "NOT_FOUND", "topic rule not found");
        }
        sendJson(res, 200, { deleted: true, ruleId });
        return;
      }

      if (method === "GET" && path === "/control/categories") {
        sendJson(res, 200, options.storeService.repository.listCategories());
        return;
      }

      if (method === "POST" && path === "/control/categories") {
        const payload = (await readJsonBody(req)) as { name?: string; sortOrder?: number; isSystem?: boolean };
        if (!payload.name?.trim()) {
          fail(400, "BAD_REQUEST", "name is required");
        }
        const created = options.storeService.repository.createCategory({
          name: payload.name.trim(),
          ...(payload.sortOrder !== undefined ? { sortOrder: payload.sortOrder } : {}),
          ...(payload.isSystem !== undefined ? { isSystem: payload.isSystem } : {})
        });
        sendJson(res, 201, created);
        return;
      }

      if (method === "PATCH" && path.match(/^\/control\/categories\/[^/]+$/)) {
        const categoryId = routeParam(path, /^\/control\/categories\/([^/]+)$/)[1]!;
        const payload = (await readJsonBody(req)) as {
          name?: string;
          sortOrder?: number;
          isSystem?: boolean;
        };
        const next = options.storeService.repository.updateCategory(categoryId, {
          ...(payload.name !== undefined ? { name: payload.name } : {}),
          ...(payload.sortOrder !== undefined ? { sort_order: payload.sortOrder } : {}),
          ...(payload.isSystem !== undefined ? { is_system: payload.isSystem } : {})
        });
        if (!next) {
          fail(404, "NOT_FOUND", "category not found");
        }
        sendJson(res, 200, next);
        return;
      }

      if (method === "DELETE" && path.match(/^\/control\/categories\/[^/]+$/)) {
        const categoryId = routeParam(path, /^\/control\/categories\/([^/]+)$/)[1]!;
        const deleted = options.storeService.repository.deleteCategory(categoryId);
        if (!deleted) {
          fail(404, "NOT_FOUND", "category not found");
        }
        sendJson(res, 200, { deleted: true, categoryId });
        return;
      }

      if (method === "GET" && path === "/control/compartments") {
        sendJson(res, 200, options.storeService.repository.listCompartments());
        return;
      }

      if (method === "POST" && path === "/control/compartments") {
        const payload = (await readJsonBody(req)) as {
          name?: string;
          description?: string | null;
          sortOrder?: number;
        };
        if (!payload.name?.trim()) {
          fail(400, "BAD_REQUEST", "name is required");
        }
        const created = options.storeService.repository.createCompartment({
          name: payload.name.trim(),
          ...(payload.description !== undefined ? { description: payload.description } : {}),
          ...(payload.sortOrder !== undefined ? { sortOrder: payload.sortOrder } : {})
        });
        sendJson(res, 201, created);
        return;
      }

      if (method === "PATCH" && path.match(/^\/control\/compartments\/[^/]+$/)) {
        const compartmentId = routeParam(path, /^\/control\/compartments\/([^/]+)$/)[1]!;
        const payload = (await readJsonBody(req)) as {
          name?: string;
          description?: string | null;
          sortOrder?: number;
        };
        const updated = options.storeService.repository.updateCompartment(compartmentId, {
          ...(payload.name !== undefined ? { name: payload.name } : {}),
          ...(payload.description !== undefined ? { description: payload.description } : {}),
          ...(payload.sortOrder !== undefined ? { sort_order: payload.sortOrder } : {})
        });
        if (!updated) {
          fail(404, "NOT_FOUND", "compartment not found");
        }
        sendJson(res, 200, updated);
        return;
      }

      if (method === "DELETE" && path.match(/^\/control\/compartments\/[^/]+$/)) {
        const compartmentId = routeParam(path, /^\/control\/compartments\/([^/]+)$/)[1]!;
        const deleted = options.storeService.repository.deleteCompartment(compartmentId);
        if (!deleted) {
          fail(404, "NOT_FOUND", "compartment not found");
        }
        sendJson(res, 200, { deleted: true, compartmentId });
        return;
      }

      if (method === "GET" && path.match(/^\/control\/profile\/items\/[^/]+\/compartments$/)) {
        const itemId = routeParam(path, /^\/control\/profile\/items\/([^/]+)\/compartments$/)[1]!;
        sendJson(res, 200, options.storeService.repository.listItemCompartments(itemId));
        return;
      }

      if (method === "PUT" && path.match(/^\/control\/profile\/items\/[^/]+\/compartments$/)) {
        const itemId = routeParam(path, /^\/control\/profile\/items\/([^/]+)\/compartments$/)[1]!;
        const payload = (await readJsonBody(req)) as { compartmentIds?: string[] };
        if (!Array.isArray(payload.compartmentIds)) {
          fail(400, "BAD_REQUEST", "compartmentIds must be an array");
        }
        const memberships = options.storeService.repository.setItemCompartments(itemId, payload.compartmentIds);
        sendJson(res, 200, memberships);
        return;
      }

      if (method === "GET" && path.match(/^\/control\/consent\/[^/]+$/)) {
        const requestId = routeParam(path, /^\/control\/consent\/([^/]+)$/)[1]!;
        const rawRequest = options.storeService.repository.getConsentRequest(requestId);
        if (!rawRequest) {
          fail(404, "NOT_FOUND", "consent request not found");
        }
        const request = rawRequest as { service_id: string } & Record<string, unknown>;
        const service = options.storeService.repository
          .listServiceRegistry()
          .find((candidate) => candidate.service_id === request.service_id) ?? null;
        const preview = options.storeService.repository.buildConsentPreviewView(request).map((entry) => ({
          ...toRouteItemRecord(entry.item),
          is_topic_blocked: entry.is_topic_blocked,
          blocked_by_rule_id: entry.blocked_by_rule_id,
          block_reason: entry.block_reason,
          default_allowed: entry.default_allowed,
          compartment_ids: entry.compartment_ids,
          provenance: entry.provenance ?? null
        }));
        sendJson(res, 200, { ...request, service, preview_items: preview });
        return;
      }

      if (method === "GET" && path === "/control/services") {
        const registry = options.storeService.repository.listServiceRegistry();
        const pairings = options.storeService.repository.listPairings();
        const now = Date.now();

        const services = registry.map((service) => {
          const pairing = pairings.find((candidate) => candidate.service_id === service.service_id) ?? null;
          const tokenExpired = pairing?.token_expires_at
            ? new Date(pairing.token_expires_at).getTime() <= now
            : false;
          const status = !pairing
            ? "UNPAIRED"
            : pairing.revoked_at || tokenExpired
              ? "REVOKED"
              : "PAIRED";

          return {
            ...service,
            status,
            policy_mode: "ALWAYS_ASK",
            paired_at: pairing?.paired_at ?? null,
            revoked_at: pairing?.revoked_at ?? null,
            allowed_origins_json: pairing?.allowed_origins_json ?? []
          };
        });

        sendJson(res, 200, services);
        return;
      }

      if (method === "POST" && path.match(/^\/control\/services\/[^/]+\/revoke$/)) {
        const serviceId = routeParam(path, /^\/control\/services\/([^/]+)\/revoke$/)[1]!;
        const active = options.storeService.repository
          .listPairings()
          .some((pairing) => pairing.service_id === serviceId && pairing.revoked_at === null);
        if (!active) {
          fail(404, "NOT_FOUND", "active pairing not found");
        }
        options.storeService.repository.revokeService(serviceId);
        sendJson(res, 200, { revoked: true, serviceId });
        return;
      }

      if (method === "POST" && path.match(/^\/control\/consent\/[^/]+\/decision$/)) {
        const requestId = routeParam(path, /^\/control\/consent\/([^/]+)\/decision$/)[1]!;
        const payload = await readJsonBody(req);
        const decision = options.storeService.repository.decideConsent(requestId, payload);
        sendJson(res, 200, decision);
        return;
      }

      if (method === "GET" && path === "/control/audit") {
        const service = reqUrl.searchParams.get("service") ?? undefined;
        const item = reqUrl.searchParams.get("item") ?? undefined;
        const typeRaw = reqUrl.searchParams.get("type") ?? undefined;
        const type = typeRaw
          ? typeRaw
              .split(",")
              .map((entry) => entry.trim())
              .filter((entry) => entry.length > 0)
          : undefined;
        const dateFrom = reqUrl.searchParams.get("date_from") ?? undefined;
        const dateTo = reqUrl.searchParams.get("date_to") ?? undefined;

        const events = options.storeService.repository.listAudit({
          ...(service ? { serviceId: service } : {}),
          ...(item ? { itemId: item } : {}),
          ...(type && type.length > 0 ? { type: type.length === 1 ? type[0] : type } : {}),
          ...(dateFrom ? { dateFrom } : {}),
          ...(dateTo ? { dateTo } : {})
        });
        sendJson(res, 200, {
          count: events.length,
          events
        });
        return;
      }

      // LLM routes
      if (method === "POST" && path === "/control/llm/test") {
        const body = await readJsonBody(req);
        const payload =
          body && typeof body === "object" && "payload" in (body as Record<string, unknown>)
            ? (body as { payload?: unknown }).payload
            : body;
        const config = parseLlmRuntimeConfig(payload);
        if (!testLlmConnection) {
          fail(500, "INTERNAL", "inference engine not loaded");
        }
        const result = await testLlmConnection(config);
        sendJson(res, 200, result);
        return;
      }

      if (method === "POST" && path === "/control/llm/ollama-models") {
        const payload = (await readJsonBody(req)) as { endpoint?: string };
        const endpoint = parseRequiredString(payload.endpoint, "endpoint");
        validateEndpointUrl(endpoint, "endpoint");
        const models = await detectOllamaModels(endpoint);
        sendJson(res, 200, { models });
        return;
      }

      if (method === "POST" && path === "/control/llm/chat") {
        const payload = (await readJsonBody(req)) as {
          messages?: { role: string; content: string }[];
          userMessage?: string;
        };
        if (!payload.userMessage?.trim()) {
          fail(400, "BAD_REQUEST", "userMessage is required");
        }

        const llmConfig = getLlmConfig();
        if (!llmConfig || !inferFromChatMessage) {
          // Fallback: no LLM, just create a basic inference
          const created = options.storeService.repository.createInference({
            text: payload.userMessage.trim(),
            itemType: "preference",
            categoryId: null,
            createdVia: "CHAT",
            sourceLabel: "Chat",
            whyDossierThinksThis: "You explicitly asked Dossier to store this.",
            confidence: null
          });

          sendJson(res, 200, {
            reply: created
              ? "Noted! I've recorded that as a pending inference for your review."
              : "That suggestion was suppressed by your topic rules or a prior dismissal.",
            proposals: [],
            createdItems: created ? [toRouteItem(created)] : []
          });
          return;
        }

        const topicRules = toRuntimeTopicRules(options.storeService.repository.listTopicRules());
        const blockedRule = findMatchedTopicRule(payload.userMessage.trim(), topicRules);
        if (blockedRule) {
          sendJson(res, 200, {
            reply:
              "I can't discuss that topic because it matches one of your blocked-topic rules. You can ask about any other part of your profile.",
            proposals: [],
            createdItems: []
          });
          return;
        }

        const history = (payload.messages ?? [])
          .filter((msg) => msg.role === "user" || msg.role === "assistant")
          .map((msg) => ({ role: msg.role, content: msg.content }));

        const profileContext = buildChatProfileContext(options.storeService.repository);

        const result = await inferFromChatMessage(
          llmConfig,
          history,
          payload.userMessage.trim(),
          profileContext
        );
        const createdItems: unknown[] = [];

        for (const proposal of result.proposals) {
          const created = options.storeService.repository.createInference({
            text: proposal.text,
            itemType: proposal.itemType,
            categoryId: null,
            createdVia: "CHAT",
            sourceLabel: "Chat (AI)",
            whyDossierThinksThis: proposal.why,
            confidence: proposal.confidence
          });
          if (created) {
            createdItems.push(toRouteItem(created));
          }
        }

        sendJson(res, 200, {
          reply: result.reply,
          proposals: result.proposals,
          createdItems
        });
        return;
      }

      if (method === "POST" && path === "/control/llm/alternatives") {
        const payload = (await readJsonBody(req)) as {
          text?: string;
          itemType?: string;
          why?: string;
        };
        if (!payload.text?.trim()) {
          fail(400, "BAD_REQUEST", "text is required");
        }

        const llmConfig = getLlmConfig();
        if (!llmConfig || !generateAlternatives) {
          sendJson(res, 200, { alternatives: [] });
          return;
        }

        const result = await generateAlternatives(
          llmConfig,
          payload.text.trim(),
          payload.itemType ?? "preference",
          payload.why
        );
        sendJson(res, 200, result);
        return;
      }

      if (method === "GET" && path.match(/^\/control\/profile\/items\/[^/]+\/detail$/)) {
        const itemId = routeParam(path, /^\/control\/profile\/items\/([^/]+)\/detail$/)[1]!;
        const allDetails = options.storeService.repository.listItemDetailsViews();
        const detail = allDetails.find((d) => {
          const item = d.item as { item_id?: string } | null;
          return item?.item_id === itemId;
        });
        if (!detail) {
          fail(404, "NOT_FOUND", "item not found");
        }

        const auditEvents = options.storeService.repository.listAudit({ itemId });
        const itemDetail = toRouteItemDetails(detail) as Record<string, unknown>;
        sendJson(res, 200, {
          ...itemDetail,
          auditEvents,
          editHistory: []
        });
        return;
      }

      if (method === "GET" && path === "/control/data/backups") {
        sendJson(res, 200, { backups: options.storeService.listLocalBackups() });
        return;
      }

      if (method === "POST" && path === "/control/data/backups") {
        const payload = (await readJsonBody(req)) as { passphrase?: string };
        if (!payload.passphrase) {
          fail(400, "BAD_REQUEST", "passphrase is required");
        }
        sendJson(res, 201, options.storeService.createLocalBackup(payload.passphrase));
        return;
      }

      if (method === "POST" && path.match(/^\/control\/data\/backups\/[^/]+\/verify$/)) {
        const backupId = routeParam(path, /^\/control\/data\/backups\/([^/]+)\/verify$/)[1]!;
        const verified = options.storeService.verifyLocalBackup(backupId);
        if (!verified) {
          fail(404, "NOT_FOUND", "backup not found");
        }
        sendJson(res, 200, verified);
        return;
      }

      if (method === "POST" && path.match(/^\/control\/data\/backups\/[^/]+\/restore$/)) {
        const backupId = routeParam(path, /^\/control\/data\/backups\/([^/]+)\/restore$/)[1]!;
        const payload = (await readJsonBody(req)) as { passphrase?: string };
        if (!payload.passphrase) {
          fail(400, "BAD_REQUEST", "passphrase is required");
        }
        const restored = options.storeService.restoreLocalBackup(backupId, payload.passphrase);
        if (!restored) {
          fail(404, "NOT_FOUND", "backup not found");
        }
        sendJson(res, 200, { restored: true, backup: restored });
        return;
      }

      if (method === "POST" && path === "/control/data/export") {
        const payload = (await readJsonBody(req)) as { passphrase?: string };
        if (!payload.passphrase) {
          fail(400, "BAD_REQUEST", "passphrase is required");
        }
        sendJson(res, 200, options.storeService.createEncryptedExport(payload.passphrase));
        return;
      }

      if (method === "POST" && path === "/control/data/import") {
        const payload = (await readJsonBody(req)) as { artifact?: unknown; passphrase?: string };
        if (!payload.artifact || !payload.passphrase) {
          fail(400, "BAD_REQUEST", "artifact and passphrase are required");
        }
        options.storeService.importEncryptedExport(payload.artifact, payload.passphrase);
        sendJson(res, 200, { ok: true });
        return;
      }

      if (method === "POST" && path === "/control/data/takeout/plan") {
        const payload = (await readJsonBody(req)) as {
          importPath?: string;
          scope?: TakeoutImportScope;
        };
        if (!payload.importPath?.trim()) {
          fail(400, "BAD_REQUEST", "importPath is required");
        }

        const requestedScope = parseTakeoutScope(payload.scope);
        const plan = options.planGoogleTakeoutImport(payload.importPath.trim(), requestedScope);
        sendJson(res, 200, plan);
        return;
      }

      if (method === "POST" && path === "/control/data/takeout/jobs") {
        const payload = (await readJsonBody(req)) as {
          importPath?: string;
          workspaceId?: string;
          scope?: TakeoutImportScope;
        };
        if (!payload.importPath?.trim()) {
          fail(400, "BAD_REQUEST", "importPath is required");
        }

        const plan = options.planGoogleTakeoutImport(payload.importPath.trim(), parseTakeoutScope(payload.scope));
        const scope = parseTakeoutScope(payload.scope, {
          dateRangePreset: plan.defaultScope.dateRangePreset,
          includedProducts: plan.defaultScope.includedProducts,
          prioritiseHighSignalItems: true
        });

        const normalizedScope = {
          dateRangePreset: scope.dateRangePreset === "all_time" ? "all_time" : "last_12_months",
          includedProducts:
            scope.includedProducts && scope.includedProducts.length > 0
              ? scope.includedProducts
              : plan.defaultScope.includedProducts,
          prioritiseHighSignalItems: scope.prioritiseHighSignalItems !== false
        } satisfies TakeoutImportJobRecord["scope"];

        const job = startTakeoutImportJob(options, {
          sourcePath: payload.importPath.trim(),
          workspaceId: payload.workspaceId?.trim() || plan.workspaceId,
          scope: normalizedScope,
          plan
        });

        sendJson(res, 202, {
          jobId: job.jobId,
          workspaceId: job.workspaceId,
          status: job.status
        });
        return;
      }

      if (method === "GET" && path.match(/^\/control\/data\/takeout\/jobs\/[^/]+$/)) {
        const jobId = routeParam(path, /^\/control\/data\/takeout\/jobs\/([^/]+)$/)[1]!;
        const job = takeoutImportJobs.get(jobId);
        if (!job) {
          fail(404, "NOT_FOUND", "import job not found");
        }
        sendJson(res, 200, toTakeoutJobResponse(job));
        return;
      }

      if (method === "POST" && path === "/control/data/takeout-import") {
        const payload = (await readJsonBody(req)) as {
          importPath?: string;
          scope?: TakeoutImportScope;
          workspaceId?: string;
        };
        if (!payload.importPath) {
          fail(400, "BAD_REQUEST", "importPath is required");
        }

        const plan = options.planGoogleTakeoutImport(payload.importPath.trim(), parseTakeoutScope(payload.scope));
        const scope = parseTakeoutScope(payload.scope, {
          dateRangePreset: plan.defaultScope.dateRangePreset,
          includedProducts: plan.defaultScope.includedProducts,
          prioritiseHighSignalItems: true
        });
        const result = await options.runGoogleTakeoutImport(
          options.storeService,
          payload.importPath,
          getLlmConfig(),
          {
            workspaceId: payload.workspaceId?.trim() || plan.workspaceId,
            scope
          }
        );
        sendJson(res, 200, result);
        return;
      }

      if (method === "GET" && path === "/control/server/health") {
        const response = await fetch("http://127.0.0.1:34250/health");
        sendJson(res, response.status, await response.json());
        return;
      }

      if (method === "GET" && path === "/control/events/next") {
        const timeoutMs = Math.min(Number(reqUrl.searchParams.get("timeout_ms") ?? "25000"), 60000);
        const payload = await awaitConsentEvent(Math.max(timeoutMs, 1000));
        sendJson(res, 200, { event: payload });
        return;
      }

      if (method === "POST" && path === "/control/shutdown") {
        sendJson(res, 200, { ok: true });
        process.nextTick(() => process.exit(0));
        return;
      }

      fail(404, "NOT_FOUND", "not found");
    } catch (error) {
      if (error instanceof ControlError) {
        sendControlError(res, error);
        return;
      }

      sendControlError(
        res,
        new ControlError(500, "INTERNAL", "internal server error", {
          reason: error instanceof Error ? error.message : "unknown"
        })
      );
    }
  };
}

async function bootstrap(): Promise<void> {
  const inputDataDir = process.argv[2];
  if (!inputDataDir) {
    throw new Error("Backend bootstrap requires a data directory argument");
  }

  const dataDir = join(inputDataDir, "dossier");
  mkdirSync(dirname(dataDir), { recursive: true });

  const packageRootCandidates = [
    process.env.DOSSIER_PACKAGES_ROOT,
    join(process.cwd(), "packages"),
    join(process.cwd(), "..", "packages"),
    join(process.cwd(), "..", "..", "..", "packages")
  ].filter((candidate): candidate is string => Boolean(candidate));

  let modulesLoaded = false;
  for (const packagesRoot of packageRootCandidates) {
    const storePath = join(packagesRoot, "store", "dist", "index.js");
    const localServerPath = join(packagesRoot, "local-server", "dist", "index.js");
    const connectorPath = join(packagesRoot, "connectors-google-takeout", "dist", "index.js");

    if (!existsSync(storePath) || !existsSync(localServerPath) || !existsSync(connectorPath)) {
      continue;
    }

    const storeModule = await import(pathToFileURL(storePath).href);
    const localServerModule = await import(pathToFileURL(localServerPath).href);
    const connectorModule = await import(pathToFileURL(connectorPath).href);

    storeService = (await storeModule.DossierStoreService.init(dataDir)) as StoreServicePort;
    profileServer = new localServerModule.LocalProfileServer(storeService);
    runGoogleTakeoutImport = connectorModule.runGoogleTakeoutImport;
    planGoogleTakeoutImport = connectorModule.planGoogleTakeoutImport;

    // Try to load inference engine (optional — won't block startup)
    const inferenceEnginePath = join(packagesRoot, "inference-engine", "dist", "index.js");
    if (existsSync(inferenceEnginePath)) {
      try {
        const inferenceModule = await import(pathToFileURL(inferenceEnginePath).href);
        testLlmConnection = inferenceModule.testLlmConnection;
        inferFromChatMessage = inferenceModule.inferFromChatMessage;
        generateAlternatives = inferenceModule.generateAlternatives;
      } catch {
        // Inference engine unavailable — LLM features will be disabled
      }
    }

    modulesLoaded = true;
    break;
  }

  if (!modulesLoaded) {
    throw new Error(
      `Unable to resolve backend package dist outputs. Checked: ${packageRootCandidates.join(", ")}`
    );
  }

  settingsCache = {
    ...defaultSettings,
    ...(storeService.repository.snapshot().profile.profile_settings_json as Partial<DossierSettings> | undefined)
  };
  storeService.repository.setHighFidelityEnabled(settingsCache.highFidelityEnabled);

  await profileServer.start();
  profileServer.on("consent:request", (payload: unknown) => {
    pushConsentEvent(payload);
  });

  const controlServer = createServer(
    createControlRequestHandler({
      storeService,
      runGoogleTakeoutImport,
      planGoogleTakeoutImport
    })
  );

  await new Promise<void>((resolve, reject) => {
    controlServer.once("error", reject);
    controlServer.listen(0, "127.0.0.1", () => resolve());
  });

  const address = controlServer.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to start control server");
  }

  writeReady({
    type: "ready",
    controlPort: address.port,
    controlToken
  });

  process.on("SIGINT", () => {
    void shutdown(controlServer).finally(() => process.exit(0));
  });
  process.on("SIGTERM", () => {
    void shutdown(controlServer).finally(() => process.exit(0));
  });
}

if (process.env.DOSSIER_BACKEND_SKIP_BOOTSTRAP !== "1") {
  void bootstrap().catch((error) => {
    console.error("Failed to bootstrap Dossier backend daemon", error);
    process.exit(1);
  });
}
