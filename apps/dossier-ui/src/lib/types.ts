export type LlmProviderId =
  | "ollama"
  | "custom"
  | "openai"
  | "anthropic"
  | "google"
  | "openrouter"
  | "grok";

export type LlmAuthMethod = "apiKey" | "oauth";

export type LlmProfile = {
  id: string;
  name: string;
  provider: LlmProviderId;
  endpoint: string;
  model: string;
  authMethod: LlmAuthMethod;
  apiKey?: string;
  oauthToken?: string;
};

export type ProfileItem = {
  item_id: string;
  state: "CONFIRMED" | "INFERENCE_PENDING";
  text: string;
  item_type: string;
  itemType?: string;
  category_id?: string | null;
  categoryId?: string | null;
  created_at: string;
  updated_at: string;
};

export type DossierSettings = {
  theme: string;
  dyslexiaMode: boolean;
  highFidelityEnabled: boolean;
  startOnLogin: boolean;
  localModelEndpoint: string;
  localModelName: string;
  llmProfiles?: LlmProfile[];
  activeLlmProfileId?: string | null;
  [key: string]: unknown;
};

export type TakeoutDateRangePreset = "last_12_months" | "all_time";

export type TakeoutImportScope = {
  dateRangePreset?: TakeoutDateRangePreset;
  includedProducts?: string[];
  prioritiseHighSignalItems?: boolean;
};

export type TakeoutImportPlanProduct = {
  key: string;
  label: string;
  fileCount: number;
  parseableFileCount: number;
  totalBytes: number;
  parseableBytes: number;
  selectedByDefault: boolean;
};

export type TakeoutImportPlan = {
  workspaceId: string;
  sourcePath: string;
  sourceType: "directory" | "zip";
  generatedAt: string;
  totalFiles: number;
  parseableFiles: number;
  totalBytes: number;
  parseableBytes: number;
  products: TakeoutImportPlanProduct[];
  defaultScope: {
    dateRangePreset: TakeoutDateRangePreset;
    includedProducts: string[];
  };
  warnings: string[];
};

export type TakeoutImportProgressEvent = {
  stage: "inventory" | "parse" | "scope" | "infer" | "store" | "complete";
  status: "started" | "progress" | "completed";
  message: string;
  at: string;
  metrics?: Record<string, string | number | boolean | null>;
};

export type TakeoutImportResult = {
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
    dateRangePreset: TakeoutDateRangePreset;
    includedProducts: string[];
    prioritiseHighSignalItems: boolean;
  };
  warnings: string[];
};

export type TakeoutImportJob = {
  jobId: string;
  workspaceId: string;
  sourcePath: string;
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  scope: {
    dateRangePreset: TakeoutDateRangePreset;
    includedProducts: string[];
    prioritiseHighSignalItems: boolean;
  };
  plan: TakeoutImportPlan;
  events: TakeoutImportProgressEvent[];
  result: TakeoutImportResult | null;
  error: string | null;
};

export type LocalBackupSummary = {
  backupId: string;
  createdAt: string;
  schemaVersion: number;
  checksum: string;
  lastVerifiedAt: string | null;
  fileName: string;
  sizeBytes: number;
};

export type ProfileItemTopic = {
  item_id: string;
  is_topic_blocked: boolean;
  blocked_by_rule_id: string | null;
  block_reason: string | null;
  storage_override: "NONE" | "MANUAL_ALLOWED";
};

export type ProfileItemProvenance = {
  item_id: string;
  source_label: string;
  source_kind: "MANUAL" | "CONNECTOR";
  why_dossier_thinks_this: string | null;
  confidence: number | null;
  evidence_summary_id: string | null;
};

export type ProfileItemView = ProfileItem & {
  provenance: ProfileItemProvenance | null;
  topic: ProfileItemTopic | null;
  compartment_ids: string[];
};

export type TopicRule = {
  rule_id: string;
  profile_id: string;
  pattern: string;
  match_mode: "EXACT" | "PHRASE" | "KEYWORD" | "REGEX";
  scope: "STORAGE" | "SHARING" | "STORAGE_AND_SHARING";
  created_at: string;
  updated_at: string;
  is_enabled: boolean;
};

export type Category = {
  category_id: string;
  profile_id: string;
  name: string;
  sort_order: number;
  is_system: boolean;
  created_at: string;
  updated_at: string;
};

export type Compartment = {
  compartment_id: string;
  profile_id: string;
  name: string;
  description: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type ItemCompartment = {
  item_id: string;
  compartment_id: string;
};

export type ConsentPreviewItem = {
  item_id: string;
  item_type: string;
  itemType?: string;
  category_id?: string | null;
  categoryId?: string | null;
  text: string;
  is_topic_blocked: boolean;
  blocked_by_rule_id: string | null;
  block_reason: string | null;
  default_allowed: boolean;
  compartment_ids: string[];
  provenance: ProfileItemProvenance | null;
};

export type ConsentRequestView = {
  consent_request_id: string;
  service_id: string;
  service?: {
    service_id: string;
    identifier: string;
    display_name: string;
    icon_url: string | null;
    description: string | null;
    created_at: string;
    updated_at: string;
  } | null;
  purpose: string;
  requested_compartment_ids_json: string[];
  requested_item_ids_json: string[];
  created_at: string;
  expires_at: string | null;
  state: "PENDING" | "DECIDED" | "EXPIRED";
  nonce: string;
  preview_items: ConsentPreviewItem[];
};

export type ConsentDecisionPayload = {
  decision: "ALLOW" | "DECLINE";
  allowed_item_ids: string[];
  blocked_item_overrides: string[];
};

export type ProposedInferenceResult =
  | ProfileItem
  | {
      suppressed: true;
      reason: string;
    };

export type ServiceConnectionStatus = {
  service_id: string;
  identifier: string;
  display_name: string;
  icon_url: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
  status: "UNPAIRED" | "PAIRED" | "REVOKED";
  policy_mode: "ALWAYS_ASK";
  paired_at: string | null;
  revoked_at: string | null;
  allowed_origins_json: string[];
};

export type AuditEvent = {
  event_id: string;
  profile_id: string;
  timestamp: string;
  event_type: string;
  actor: "USER" | "SYSTEM" | "EXTERNAL_SERVICE";
  service_id: string | null;
  item_id: string | null;
  consent_request_id: string | null;
  details_json: Record<string, unknown>;
};

export type AuditQuery = {
  service?: string;
  item?: string;
  eventType?: string | string[];
  dateFrom?: string;
  dateTo?: string;
};

export type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type LlmTestResult = {
  ok: boolean;
  model: string;
  error?: string;
};

export type LlmInferenceProposal = {
  text: string;
  itemType: string;
  why: string;
  confidence: number | null;
};

export type LlmChatResult = {
  reply: string;
  proposals: LlmInferenceProposal[];
  createdItems: ProfileItem[];
};

export type AlternativeOption = {
  text: string;
  reason: string;
};

export type AlternativeSet = {
  original: string;
  alternatives: AlternativeOption[];
};

export type ItemDetailView = ProfileItemView & {
  auditEvents: AuditEvent[];
  editHistory: { edit_id: string; edited_at: string; editor: string; before_text: string; after_text: string }[];
};
