import { randomUUID } from "node:crypto";
export function createDefaultState() {
    const now = new Date().toISOString();
    const profileId = randomUUID();
    const perspectivesServiceId = randomUUID();
    return {
        profile: {
            profile_id: profileId,
            created_at: now,
            updated_at: now,
            schema_version: 2,
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
        categories: [],
        compartments: [],
        itemCompartments: [],
        serviceRegistry: [
            {
                service_id: perspectivesServiceId,
                identifier: "getperspectives.app",
                display_name: "Perspectives",
                icon_url: null,
                description: "External service integration for Perspectives.",
                created_at: now,
                updated_at: now
            }
        ],
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
//# sourceMappingURL=defaults.js.map