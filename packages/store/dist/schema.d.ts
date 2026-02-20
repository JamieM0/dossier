import type { AuditEvent, ConsentDecisionRecord, ConsentOverride, ConsentRequest, Disclosure, DismissedInference, ErasureLedgerEntry, EvidenceSummary, Item, ItemEditHistory, ItemProvenance, ItemTopicFlag, Profile, RawArtifact, ServicePairing, TopicBlockRule } from "@dossier/domain";
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
    pairings: ServicePairing[];
    consentRequests: ConsentRequest[];
    consentDecisions: ConsentDecisionRecord[];
    consentOverrides: ConsentOverride[];
    disclosures: Disclosure[];
    auditEvents: AuditEvent[];
    erasureLedger: ErasureLedgerEntry[];
    rateLimit: Record<string, number[]>;
};
//# sourceMappingURL=schema.d.ts.map