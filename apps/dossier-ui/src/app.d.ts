import type {
  AlternativeSet,
  AuditEvent,
  Category,
  ChatMessage,
  Compartment,
  ConsentDecisionPayload,
  ConsentRequestView,
  DossierSettings,
  ItemCompartment,
  ItemDetailView,
  LlmChatResult,
  LlmTestResult,
  LocalBackupSummary,
  ProfileItem,
  ProfileItemView,
  ProposedInferenceResult,
  ServiceConnectionStatus,
  TakeoutImportJob,
  TakeoutImportPlan,
  TakeoutImportScope,
  TopicRule
} from "$lib/types";

declare module "phosphor-icons-svelte";

declare global {
  interface Window {
    dossier?: {
      app: { getVersion: () => Promise<string> };
      window: { show: () => Promise<void>; hide: () => Promise<void>; quit: () => Promise<void> };
      updater: {
        installAndRestart: () => Promise<void>;
      };
      settings: {
        get: () => Promise<DossierSettings>;
        set: (next: Partial<DossierSettings>) => Promise<DossierSettings>;
        getStartOnLogin: () => Promise<boolean>;
        setStartOnLogin: (enabled: boolean) => Promise<boolean>;
      };
      profile: {
        listItems: () => Promise<ProfileItemView[]>;
        createManualItem: (payload: { text: string; itemType: string; categoryId: string | null }) => Promise<ProfileItem>;
        proposeInference: (payload: {
          text: string;
          itemType: string;
          categoryId?: string | null;
          sourceLabel?: string;
          whyDossierThinksThis?: string | null;
          confidence?: number | null;
        }) => Promise<ProposedInferenceResult>;
        updateItem: (itemId: string, payload: { text?: string; itemType?: string; categoryId?: string | null }) => Promise<ProfileItem>;
        deleteItem: (itemId: string) => Promise<{ deleted: true; itemId: string }>;
        inferenceConfirm: (itemId: string) => Promise<ProfileItem>;
        inferenceEditConfirm: (itemId: string, editedText: string) => Promise<ProfileItem>;
        inferenceDismiss: (itemId: string, dismissReason?: string) => Promise<unknown>;
        getItemCompartments: (itemId: string) => Promise<ItemCompartment[]>;
        setItemCompartments: (itemId: string, compartmentIds: string[]) => Promise<ItemCompartment[]>;
        getItemDetail: (itemId: string) => Promise<ItemDetailView>;
      };
      llm: {
        test: (payload: {
          provider: "ollama" | "custom" | "openai" | "anthropic" | "google" | "openrouter" | "grok";
          endpoint: string;
          model: string;
          authMethod?: "apiKey" | "oauth";
          apiKey?: string;
          oauthToken?: string;
        }) => Promise<LlmTestResult>;
        detectOllamaModels: (endpoint: string) => Promise<{ models: string[] }>;
        chat: (messages: ChatMessage[], userMessage: string) => Promise<LlmChatResult>;
        alternatives: (text: string, itemType?: string, why?: string) => Promise<AlternativeSet>;
      };
      topicRules: {
        list: () => Promise<TopicRule[]>;
        create: (payload: {
          ruleId?: string;
          profileId?: string;
          pattern: string;
          matchMode?: "EXACT" | "PHRASE" | "KEYWORD" | "REGEX";
          scope?: "STORAGE" | "SHARING" | "STORAGE_AND_SHARING";
          isEnabled?: boolean;
        }) => Promise<TopicRule>;
        update: (
          ruleId: string,
          payload: {
            pattern?: string;
            matchMode?: "EXACT" | "PHRASE" | "KEYWORD" | "REGEX";
            scope?: "STORAGE" | "SHARING" | "STORAGE_AND_SHARING";
            isEnabled?: boolean;
          }
        ) => Promise<TopicRule>;
        delete: (ruleId: string) => Promise<{ deleted: true; ruleId: string }>;
      };
      categories: {
        list: () => Promise<Category[]>;
        create: (payload: { name: string; sortOrder?: number; isSystem?: boolean }) => Promise<Category>;
        update: (categoryId: string, payload: { name?: string; sortOrder?: number; isSystem?: boolean }) => Promise<Category>;
        delete: (categoryId: string) => Promise<{ deleted: true; categoryId: string }>;
      };
      compartments: {
        list: () => Promise<Compartment[]>;
        create: (payload: { name: string; description?: string | null; sortOrder?: number }) => Promise<Compartment>;
        update: (compartmentId: string, payload: { name?: string; description?: string | null; sortOrder?: number }) => Promise<Compartment>;
        delete: (compartmentId: string) => Promise<{ deleted: true; compartmentId: string }>;
      };
      data: {
        browseTakeoutSource: () => Promise<string | null>;
        planTakeoutImport: (path: string, scope?: TakeoutImportScope) => Promise<TakeoutImportPlan>;
        startTakeoutImportJob: (
          path: string,
          workspaceId: string,
          scope?: TakeoutImportScope
        ) => Promise<{ jobId: string; workspaceId: string; status: string }>;
        getTakeoutImportJob: (jobId: string) => Promise<TakeoutImportJob>;
        exportEncrypted: (passphrase: string) => Promise<unknown>;
        importEncrypted: (artifact: unknown, passphrase: string) => Promise<void>;
        listBackups: () => Promise<{ backups: LocalBackupSummary[] }>;
        createBackup: (passphrase: string) => Promise<LocalBackupSummary>;
        verifyBackup: (backupId: string) => Promise<LocalBackupSummary>;
        restoreBackup: (backupId: string, passphrase: string) => Promise<{ restored: true; backup: LocalBackupSummary }>;
        deleteProfileIrreversible: (
          confirmationText: string
        ) => Promise<{ deleted: true; previousProfileId: string; nextProfileId: string }>;
        runTakeoutImport: (path: string) => Promise<unknown>;
      };
      server: { health: () => Promise<unknown> };
      consent: {
        get: (requestId: string) => Promise<ConsentRequestView>;
        decide: (requestId: string, payload: ConsentDecisionPayload) => Promise<unknown>;
        onRequest: (callback: (request: unknown) => void) => () => void;
      };
      services: {
        list: () => Promise<ServiceConnectionStatus[]>;
        revoke: (serviceId: string) => Promise<{ revoked: true; serviceId: string }>;
      };
      audit: {
        list: (query?: {
          service?: string;
          item?: string;
          eventType?: string | string[];
          dateFrom?: string;
          dateTo?: string;
        }) => Promise<{ count: number; events: AuditEvent[] }>;
      };
    };
  }
}

export {};
