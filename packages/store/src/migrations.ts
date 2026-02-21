import { createDefaultState } from "./defaults.js";
import type { PersistedState } from "./schema.js";

type PersistedStateV1 = Omit<
  PersistedState,
  "categories" | "compartments" | "itemCompartments" | "serviceRegistry"
> & {
  categories?: PersistedState["categories"];
  compartments?: PersistedState["compartments"];
  itemCompartments?: PersistedState["itemCompartments"];
  serviceRegistry?: PersistedState["serviceRegistry"];
};

function ensureSchemaV2(input: PersistedStateV1): PersistedState {
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

export function migratePersistedState(input: PersistedState): PersistedState {
  if (input.profile.schema_version >= 2) {
    return input;
  }

  return ensureSchemaV2(input as PersistedStateV1);
}
