export type ActionSpec = { name: string; args: string[]; schema: { type: "object"; properties: Record<string, { type: string }>; required: string[] }; safety: "read" | "write" | "destructive"; output: string; description: string };
const argumentTypes: Record<string, string> = {
  expectedRevision: "integer", limit: "integer", size: "integer", value: "number|string|object", yes: "boolean", dryRun: "boolean", keys: "string[]", filters: "object", dials: "object", conditions: "object[]"
};
const optionalArguments = new Set(["limit", "cursor", "mode", "medium", "focus", "size", "filter", "dials", "filters", "dryRun", "fields", "effect", "conditions", "yes"]);
export const registry: ActionSpec[] = [
  ["profile.create", ["name"], "write", "profile", "Create a CLI profile"],
  ["profile.list", [], "read", "items,activeId", "List CLI profiles"],
  ["profile.show", [], "read", "profile", "Show the active CLI profile"],
  ["profile.inspect", ["profile"], "read", "profile", "Inspect a CLI profile"],
  ["profile.use", ["profile"], "write", "profile", "Select a CLI profile"],
  ["profile.rename", ["profile", "name", "expectedRevision"], "write", "profile", "Rename a CLI profile"],
  ["profile.archive", ["profile", "expectedRevision"], "write", "profile", "Archive a CLI profile"],
  ["profile.unarchive", ["profile", "expectedRevision"], "write", "profile", "Restore an archived CLI profile"],
  ["profile.delete", ["profile", "expectedRevision", "yes"], "destructive", "deleted", "Delete a CLI profile"],
  ["profile.export", ["profile", "path", "passphrase"], "read", "file", "Export a CLI profile"],
  ["profile.import", ["path", "passphrase", "name", "dryRun"], "write", "profile", "Import into a new CLI profile"],
  ["profile.reset", ["expectedRevision", "yes", "dryRun"], "destructive", "revision", "Reset active profile preferences"],
  ["rate.queue", ["mode", "medium", "limit", "cursor", "focus"], "read", "items,next", "Get a rating queue"],
  ["rate.set", ["key", "value", "expectedRevision"], "write", "item,revision", "Rate or watchlist an item"],
  ["rate.clear", ["key", "expectedRevision"], "write", "key,revision", "Clear a rating"],
  ["rate.skip", ["key", "expectedRevision"], "write", "key,revision", "Skip an item"],
  ["refine.queue", ["size", "limit"], "read", "items", "Get pairwise or ranked refinement"],
  ["refine.choose", ["winner", "loser", "expectedRevision"], "write", "revision", "Record a pairwise choice"],
  ["refine.correct", ["winner", "loser", "expectedRevision"], "write", "revision", "Correct a pairwise choice"],
  ["refine.rank", ["keys", "expectedRevision"], "write", "revision", "Record a ranking"],
  ["suggest.list", ["medium", "limit", "cursor", "filters", "dials"], "read", "items,next", "Get recommendations"],
  ["suggest.explain", ["key"], "read", "score,evidence", "Explain a recommendation"],
  ["taste.areas", [], "read", "areas", "Inspect taste areas"],
  ["taste.claims", ["limit", "cursor"], "read", "items,next", "List taste claims"],
  ["taste.claim.inspect", ["id"], "read", "claim", "Inspect claim evidence"],
  ["taste.claim.confirm", ["id", "expectedRevision"], "write", "claim,revision", "Confirm a claim"],
  ["taste.claim.reject", ["id", "expectedRevision"], "write", "claim,revision", "Reject a claim"],
  ["taste.claim.correct", ["id", "effect", "conditions", "expectedRevision"], "write", "claim,revision", "Correct a claim"],
  ["taste.coverage", [], "read", "coverage", "Inspect profile coverage"],
  ["library.list", ["filter", "query", "limit", "cursor"], "read", "items,next", "List library items"],
  ["library.inspect", ["key"], "read", "item", "Inspect an item"],
  ["library.remove", ["key", "expectedRevision"], "write", "revision", "Remove rating or exclusion"],
  ["library.export", ["path", "passphrase"], "read", "file", "Export the active library"],
  ["library.import", ["path", "passphrase", "expectedRevision", "yes", "dryRun"], "destructive", "revision", "Replace the active library"],
  ["settings.get", ["key"], "read", "settings", "Get settings"],
  ["settings.set", ["key", "value", "expectedRevision"], "write", "settings,revision", "Set a preference"],
  ["tmdb.status", [], "read", "configured", "Inspect CLI TMDB setup"],
  ["tmdb.set", ["token"], "write", "configured", "Set CLI TMDB credential"],
  ["tmdb.set-key", ["apiKey"], "write", "keyConfigured", "Set CLI TMDB API key"],
  ["tmdb.clear", ["yes"], "destructive", "configured", "Clear CLI TMDB credential"],
  ["tmdb.validate", [], "read", "valid", "Validate CLI TMDB credential"],
  ["tmdb.validate-key", [], "read", "valid", "Validate CLI TMDB API key"],
  ["tmdb.search", ["medium", "query", "limit"], "read", "items", "Search TMDB titles"],
  ["backup.create", [], "write", "file", "Create encrypted backup"],
  ["backup.list", [], "read", "items", "List encrypted backups"],
  ["backup.delete", ["file", "yes", "dryRun"], "destructive", "deleted", "Delete an encrypted backup"],
  ["backup.restore", ["file", "expectedRevision", "yes", "dryRun"], "destructive", "profiles", "Restore an encrypted backup"],
  ["system.status", [], "read", "status", "Inspect local service"],
  ["system.version", [], "read", "version", "Show CLI version"]
].map(([name, args, safety, output, description]) => {
  const argumentsList = args as string[];
  return {
    name: name as string, args: argumentsList,
    schema: { type: "object" as const, properties: Object.fromEntries(argumentsList.map((argument) => [argument, { type: argumentTypes[argument] ?? "string" }])), required: argumentsList.filter((argument) => !optionalArguments.has(argument) && !(argument === "profile" && name === "profile.inspect") && !(argument === "key" && name === "settings.get") && !(argument === "query" && name === "library.list")) },
    safety: safety as ActionSpec["safety"], output: output as string, description: description as string
  };
});

export const uiOnly = [
  { capability: "window controls", reason: "Native desktop window behavior" },
  { capability: "posters and animation", reason: "Visual presentation" },
  { capability: "drag gestures", reason: "The CLI records the resulting rating or ranking" },
  { capability: "updater", reason: "The desktop app owns app updates" },
  { capability: "mobile pairing", reason: "The GUI gateway owns paired devices" }
];
