import { randomUUID } from "node:crypto";
import type { PersistedState } from "./schema.js";

export function createDefaultState(): PersistedState {
  const now = new Date().toISOString();

  return {
    profile: {
      profile_id: randomUUID(),
      created_at: now,
      updated_at: now,
      schema_version: 1,
      high_fidelity_enabled: false,
      profile_settings_json: {}
    },
    items: [],
    itemTopicFlags: [],
    itemProvenance: [],
    itemEditHistory: [],
    dismissedInferences: [],
    evidenceSummaries: [],
    rawArtifacts: [],
    topicBlockRules: [],
    pairings: [],
    consentRequests: [],
    consentDecisions: [],
    consentOverrides: [],
    disclosures: [],
    auditEvents: [],
    erasureLedger: [],
    rateLimit: {}
  };
}
