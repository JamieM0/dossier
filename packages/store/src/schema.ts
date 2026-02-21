import type {
  AuditEvent,
  Category,
  Compartment,
  ConsentDecisionRecord,
  ConsentOverride,
  ConsentRequest,
  Disclosure,
  DismissedInference,
  ErasureLedgerEntry,
  EvidenceSummary,
  Item,
  ItemCompartment,
  ItemEditHistory,
  ItemProvenance,
  ItemTopicFlag,
  Profile,
  RawArtifact,
  ServiceRegistryEntry,
  ServicePairing,
  TopicBlockRule
} from "@dossier/domain";

export type PersistedState = {
  profile: Profile;
  items: Item[];
  itemTopicFlags: ItemTopicFlag[];
  itemProvenance: ItemProvenance[];
  itemEditHistory: ItemEditHistory[];
  dismissedInferences: DismissedInference[];
  evidenceSummaries: EvidenceSummary[];
  rawArtifacts: RawArtifact[];
  topicBlockRules: TopicBlockRule[];
  categories: Category[];
  compartments: Compartment[];
  itemCompartments: ItemCompartment[];
  serviceRegistry: ServiceRegistryEntry[];
  pairings: ServicePairing[];
  consentRequests: ConsentRequest[];
  consentDecisions: ConsentDecisionRecord[];
  consentOverrides: ConsentOverride[];
  disclosures: Disclosure[];
  auditEvents: AuditEvent[];
  erasureLedger: ErasureLedgerEntry[];
  rateLimit: Record<string, number[]>;
};
