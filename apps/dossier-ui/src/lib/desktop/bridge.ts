import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import type {
  AlternativeSet,
  AuditEvent,
  AuditQuery,
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

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function installDesktopApi(): void {
  if (!isTauriRuntime() || window.dossier) {
    return;
  }

  window.dossier = {
    app: {
      getVersion: (): Promise<string> => invoke("app_get_version")
    },
    window: {
      show: (): Promise<void> => invoke("window_show"),
      hide: (): Promise<void> => invoke("window_hide"),
      quit: (): Promise<void> => invoke("window_quit")
    },
    updater: {
      installAndRestart: (): Promise<void> => invoke("update_install_and_restart")
    },
    settings: {
      get: (): Promise<DossierSettings> => invoke("settings_get"),
      set: (next: Partial<DossierSettings>): Promise<DossierSettings> => invoke("settings_set", { next }),
      getStartOnLogin: (): Promise<boolean> => invoke("settings_get_start_on_login"),
      setStartOnLogin: (enabled: boolean): Promise<boolean> => invoke("settings_set_start_on_login", { enabled })
    },
    profile: {
      listItems: (): Promise<ProfileItemView[]> => invoke("profile_list_items"),
      createManualItem: (payload: { text: string; itemType: string; categoryId: string | null }): Promise<ProfileItem> =>
        invoke("profile_create_manual_item", { payload }),
      proposeInference: (payload: {
        text: string;
        itemType: string;
        categoryId?: string | null;
        sourceLabel?: string;
        whyDossierThinksThis?: string | null;
        confidence?: number | null;
      }): Promise<ProposedInferenceResult> => invoke("profile_propose_inference", { payload }),
      updateItem: (itemId: string, payload: { text?: string; itemType?: string; categoryId?: string | null }): Promise<ProfileItem> =>
        invoke("profile_update_item", { itemId, payload }),
      deleteItem: (itemId: string): Promise<{ deleted: true; itemId: string }> =>
        invoke("profile_delete_item", { itemId }),
      inferenceConfirm: (itemId: string): Promise<ProfileItem> => invoke("inference_confirm", { itemId }),
      inferenceEditConfirm: (itemId: string, editedText: string): Promise<ProfileItem> =>
        invoke("inference_edit_confirm", { itemId, editedText }),
      inferenceDismiss: (itemId: string, dismissReason?: string): Promise<unknown> =>
        invoke("inference_dismiss", { itemId, dismissReason }),
      getItemCompartments: (itemId: string): Promise<ItemCompartment[]> =>
        invoke("item_compartments_get", { itemId }),
      setItemCompartments: (itemId: string, compartmentIds: string[]): Promise<ItemCompartment[]> =>
        invoke("item_compartments_set", { itemId, compartmentIds }),
      getItemDetail: (itemId: string): Promise<ItemDetailView> =>
        invoke("profile_item_detail", { itemId })
    },
    llm: {
      test: (payload: {
        provider: "ollama" | "custom" | "openai" | "anthropic" | "google" | "openrouter" | "grok";
        endpoint: string;
        model: string;
        authMethod?: "apiKey" | "oauth";
        apiKey?: string;
        oauthToken?: string;
      }): Promise<LlmTestResult> =>
        invoke("llm_test", { payload }),
      detectOllamaModels: (endpoint: string): Promise<{ models: string[] }> =>
        invoke("llm_detect_ollama_models", { endpoint }),
      chat: (messages: ChatMessage[], userMessage: string): Promise<LlmChatResult> =>
        invoke("llm_chat", { messages, userMessage }),
      alternatives: (text: string, itemType?: string, why?: string): Promise<AlternativeSet> =>
        invoke("llm_alternatives", { text, itemType, why })
    },
    topicRules: {
      list: (): Promise<TopicRule[]> => invoke("topic_rules_list"),
      create: (payload: {
        ruleId?: string;
        profileId?: string;
        pattern: string;
        matchMode?: "EXACT" | "PHRASE" | "KEYWORD" | "REGEX";
        scope?: "STORAGE" | "SHARING" | "STORAGE_AND_SHARING";
        isEnabled?: boolean;
      }): Promise<TopicRule> => invoke("topic_rules_create", { payload }),
      update: (
        ruleId: string,
        payload: {
          pattern?: string;
          matchMode?: "EXACT" | "PHRASE" | "KEYWORD" | "REGEX";
          scope?: "STORAGE" | "SHARING" | "STORAGE_AND_SHARING";
          isEnabled?: boolean;
        }
      ): Promise<TopicRule> => invoke("topic_rules_update", { ruleId, payload }),
      delete: (ruleId: string): Promise<{ deleted: true; ruleId: string }> =>
        invoke("topic_rules_delete", { ruleId })
    },
    categories: {
      list: (): Promise<Category[]> => invoke("categories_list"),
      create: (payload: { name: string; sortOrder?: number; isSystem?: boolean }): Promise<Category> =>
        invoke("categories_create", { payload }),
      update: (
        categoryId: string,
        payload: { name?: string; sortOrder?: number; isSystem?: boolean }
      ): Promise<Category> => invoke("categories_update", { categoryId, payload }),
      delete: (categoryId: string): Promise<{ deleted: true; categoryId: string }> =>
        invoke("categories_delete", { categoryId })
    },
    compartments: {
      list: (): Promise<Compartment[]> => invoke("compartments_list"),
      create: (payload: { name: string; description?: string | null; sortOrder?: number }): Promise<Compartment> =>
        invoke("compartments_create", { payload }),
      update: (
        compartmentId: string,
        payload: { name?: string; description?: string | null; sortOrder?: number }
      ): Promise<Compartment> => invoke("compartments_update", { compartmentId, payload }),
      delete: (compartmentId: string): Promise<{ deleted: true; compartmentId: string }> =>
        invoke("compartments_delete", { compartmentId })
    },
    data: {
      browseTakeoutSource: (): Promise<string | null> => invoke("data_browse_takeout_source"),
      planTakeoutImport: (path: string, scope?: TakeoutImportScope): Promise<TakeoutImportPlan> =>
        invoke("data_takeout_plan", { path, scope }),
      startTakeoutImportJob: (
        path: string,
        workspaceId: string,
        scope?: TakeoutImportScope
      ): Promise<{ jobId: string; workspaceId: string; status: string }> =>
        invoke("data_takeout_start_job", { path, workspaceId, scope }),
      getTakeoutImportJob: (jobId: string): Promise<TakeoutImportJob> =>
        invoke("data_takeout_job_status", { jobId }),
      exportEncrypted: (passphrase: string): Promise<unknown> => invoke("data_export_encrypted", { passphrase }),
      importEncrypted: (artifact: unknown, passphrase: string): Promise<void> =>
        invoke("data_import_encrypted", { artifact, passphrase }),
      runTakeoutImport: (path: string): Promise<unknown> => invoke("data_run_takeout_import", { path }),
      listBackups: (): Promise<{ backups: LocalBackupSummary[] }> => invoke("data_backups_list"),
      createBackup: (passphrase: string): Promise<LocalBackupSummary> =>
        invoke("data_backup_create", { passphrase }),
      verifyBackup: (backupId: string): Promise<LocalBackupSummary> =>
        invoke("data_backup_verify", { backupId }),
      restoreBackup: (backupId: string, passphrase: string): Promise<{ restored: true; backup: LocalBackupSummary }> =>
        invoke("data_backup_restore", { backupId, passphrase }),
      deleteProfileIrreversible: (
        confirmationText: string
      ): Promise<{ deleted: true; previousProfileId: string; nextProfileId: string }> =>
        invoke("profile_delete_irreversible", { confirmationText })
    },
    server: {
      health: (): Promise<unknown> => invoke("server_health")
    },
    consent: {
      get: (requestId: string): Promise<ConsentRequestView> => invoke("consent_get", { requestId }),
      decide: (requestId: string, payload: ConsentDecisionPayload): Promise<unknown> =>
        invoke("consent_decide", { requestId, payload }),
      onRequest: (callback: (request: unknown) => void): (() => void) => {
        let stop: (() => void) | null = null;
        let disposed = false;

        void listen<unknown>("consent:request", (event) => callback(event.payload)).then((unlisten) => {
          if (disposed) {
            unlisten();
            return;
          }
          stop = unlisten;
        });

        return () => {
          disposed = true;
          stop?.();
          stop = null;
        };
      }
    },
    services: {
      list: (): Promise<ServiceConnectionStatus[]> => invoke("services_list"),
      revoke: (serviceId: string): Promise<{ revoked: true; serviceId: string }> =>
        invoke("services_revoke", { serviceId })
    },
    audit: {
      list: (query: AuditQuery = {}): Promise<{ count: number; events: AuditEvent[] }> => {
        const eventType = Array.isArray(query.eventType) ? query.eventType.join(",") : query.eventType;
        return invoke("audit_list", {
          service: query.service,
          item: query.item,
          eventType,
          dateFrom: query.dateFrom,
          dateTo: query.dateTo
        });
      }
    }
  };
}
