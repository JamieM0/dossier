import { createDefaultState } from "./defaults.js";
function ensureSchemaV2(input) {
    const seeded = createDefaultState();
    return {
        ...input,
        profile: {
            ...input.profile,
            schema_version: 2
        },
        categories: input.categories ?? [],
        compartments: input.compartments ?? [],
        itemCompartments: input.itemCompartments ?? [],
        serviceRegistry: input.serviceRegistry ?? seeded.serviceRegistry
    };
}
export function migratePersistedState(input) {
    if (input.profile.schema_version >= 2) {
        return input;
    }
    return ensureSchemaV2(input);
}
//# sourceMappingURL=migrations.js.map