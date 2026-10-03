import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { registry } from "@dossier/domain";
import {
  addLibraryPairwise, correctLibraryPairwise, buildPairwiseCandidates, buildRankingGroup, buildTasteSpace, createDiscovery, cosineSimilarity, matchesTasteClaim,
  DEFAULT_SCORING_PARAMS, exportLibrary, importLibrary,
  isValidRating, rankDissonantCandidates, rankRateProbes, resetLibraryPreferences,
  scoreCandidates, setLibraryClaimFeedback, setLibraryRating, setLibrarySkipped,
  tasteSnapshot, tasteClaimId, updateLibrarySettings, withDefaults, type PersistedState, type TmdbItem,
  type TmdbMedium, type TasteClaim, type TasteClaimCondition, type ScoringParams
} from "@dossier/domain";
import { createTmdbClient } from "@dossier/store";
import { CliStorage, newProfile, publicProfile, type Profile, type Vault } from "./storage.js";

export class ActionError extends Error {
  constructor(readonly code: string, message: string) { super(message); }
}
export type Args = Record<string, unknown>;
export { registry, uiOnly } from "@dossier/domain";

/** Local, offline catalogue for deterministic CLI action simulations. */
export type ActionCatalogue = {
  detail(medium: TmdbMedium, id: number): Promise<TmdbItem>;
  candidates(medium: TmdbMedium, kind: "rate" | "suggest"): Promise<TmdbItem[]>;
};

const string = (args: Args, key: string): string => {
  const value = args[key];
  if (typeof value !== "string" || !value.trim()) throw new ActionError("INVALID_ARGUMENT", `${key} is required`);
  return value.trim();
};
const profileName = (args: Args): string => {
  const name = string(args, "name");
  if (name.length > 80 || /[\x00-\x1f\x7f]/.test(name)) throw new ActionError("INVALID_ARGUMENT", "Profile name must be at most 80 printable characters");
  return name;
};
const number = (args: Args, key: string, fallback: number, min = 1, max = 100): number => {
  const value = args[key] === undefined ? fallback : Number(args[key]);
  if (!Number.isInteger(value) || value < min || value > max) throw new ActionError("INVALID_ARGUMENT", `${key} must be ${min}..${max}`);
  return value;
};
const medium = (args: Args): TmdbMedium => args.medium === "tv" ? "tv" : "movie";
const itemKey = (key: string): { medium: TmdbMedium; id: number } => {
  const match = /^(movie|tv):([1-9]\d*)$/.exec(key);
  if (!match) throw new ActionError("INVALID_ARGUMENT", "Use movie:ID or tv:ID");
  return { medium: match[1] as TmdbMedium, id: Number(match[2]) };
};
const compact = (item: TmdbItem, score?: number) => ({ id: `${item.medium}:${item.id}`, title: item.title, year: item.year, ...(score === undefined ? {} : { score: Math.round(score * 1000) / 1000 }) });
function page<T>(items: T[], args: Args, defaultLimit = 20) {
  const limit = number(args, "limit", defaultLimit, 1, 100);
  const offset = args.cursor === undefined ? 0 : Number(Buffer.from(string(args, "cursor"), "base64url").toString());
  if (!Number.isSafeInteger(offset) || offset < 0) throw new ActionError("INVALID_CURSOR", "Start again without --cursor");
  return { items: items.slice(offset, offset + limit), next: offset + limit < items.length ? Buffer.from(String(offset + limit)).toString("base64url") : null };
}
function choose(vault: Vault, args: Args, active = true): Profile {
  const selector = typeof args.profile === "string" ? args.profile : active ? vault.activeId : null;
  const profile = vault.profiles.find((entry) => entry.id === selector || entry.name === selector);
  if (!profile) throw new ActionError("PROFILE_NOT_FOUND", "Create or select a CLI profile");
  return profile;
}
function revision(profile: Profile, args: Args): void {
  if (Number(args.expectedRevision) !== profile.revision) throw new ActionError("STALE_REVISION", `Refresh profile revision ${profile.revision} and retry`);
}
function mutate(storage: CliStorage, vault: Vault, profile: Profile, args: Args, next: PersistedState) {
  revision(profile, args);
  profile.state = withDefaults(next);
  profile.revision++;
  storage.save(vault);
  return profile.revision;
}
function requireYes(args: Args): void { if (args.yes !== true) throw new ActionError("CONFIRM_REQUIRED", "Repeat with --yes"); }
function entries(profile: Profile) { return Object.values(profile.state.ratings); }
function snapshot(item: TmdbItem) {
  return { key: `${item.medium}:${item.id}`, medium: item.medium, id: item.id, title: item.title, year: item.year, posterPath: item.posterPath, voteAverage: item.voteAverage, genres: item.genres, keywords: item.keywords, collection: item.collection, directorIds: item.directorIds, creatorIds: item.creatorIds, features: item.features };
}
function validImport(state: PersistedState): PersistedState {
  if (!state || typeof state !== "object" || !state.ratings || typeof state.ratings !== "object" || !Array.isArray(state.pairwise) || !Array.isArray(state.skipped) || !Array.isArray(state.tasteClaims)) throw new ActionError("INVALID_IMPORT", "Use a valid Dossier export");
  return state;
}
const settingTypes: Record<string, "boolean" | "number" | "object"> = {
  refineGroupSize: "number",
  rateGenreDials: "object",
  rateTagDials: "object",
  recommendationDials: "object"
};
async function tmdb(storage: CliStorage) {
  const token = await storage.getTmdbToken() ?? await storage.getTmdbApiKey();
  if (!token) throw new ActionError("TMDB_NOT_CONFIGURED", "Run dossier tmdb set using stdin");
  return createTmdbClient(token, join(storage.root, "tmdb-cache"));
}
async function candidates(storage: CliStorage, profile: Profile, which: TmdbMedium, candidatePage: number, kind: "rate" | "suggest", catalogue?: ActionCatalogue) {
  if (catalogue) return catalogue.candidates(which, kind);
  const api = await tmdb(storage);
  const discovery = createDiscovery(api);
  const exclude = new Set([...Object.keys(profile.state.ratings), ...profile.state.skipped]);
  const raw = kind === "rate"
    ? discovery.buildRatingQueue(which, exclude, candidatePage, profile.state.settings.rateGenreDials as Record<string, number> ?? {}, profile.state.settings.rateTagDials as Record<string, number> ?? {}, entries(profile))
    : discovery.buildCandidatePool(which, entries(profile), exclude, candidatePage);
  return discovery.enrichItems(await raw);
}
function findClaim(profile: Profile, id: string): TasteClaim {
  const claim = profile.state.tasteClaims.find((entry) => entry.id === id);
  if (!claim) throw new ActionError("CLAIM_NOT_FOUND", "List claims and retry with an ID");
  return claim;
}

export async function execute(storage: CliStorage, name: string, args: Args, catalogue?: ActionCatalogue): Promise<unknown> {
  if (!registry.some((entry) => entry.name === name)) throw new ActionError("UNKNOWN_ACTION", "Run dossier help --json");
  const vault = storage.load();
  if (name === "system.status") return { running: true, profiles: vault.profiles.length, activeId: vault.activeId };
  if (name === "system.version") return { version: (JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }).version };
  if (name === "profile.create") {
    const title = profileName(args);
    if (vault.profiles.some((profile) => profile.name.toLowerCase() === title.toLowerCase())) throw new ActionError("NAME_EXISTS", "Choose another profile name");
    const profile = newProfile(title);
    vault.profiles.push(profile);
    vault.activeId = profile.id;
    storage.save(vault); storage.audit("profile.create", profile.id);
    return publicProfile(profile);
  }
  if (name === "profile.list") return { items: vault.profiles.map(publicProfile), activeId: vault.activeId };
  if (name === "profile.show") return publicProfile(choose(vault, args));
  if (name === "profile.inspect") { const selected = choose(vault, args); return { ...publicProfile(selected), pairwise: selected.state.pairwise.length, skipped: selected.state.skipped.length, claims: selected.state.tasteClaims.length, settings: Object.keys(selected.state.settings).sort() }; }
  if (name === "profile.use") {
    const profile = choose(vault, args);
    if (profile.archived) throw new ActionError("PROFILE_ARCHIVED", "Select an active profile");
    vault.activeId = profile.id; storage.save(vault); return publicProfile(profile);
  }
  if (name === "profile.import") {
    const imported = validImport(await importLibrary(readFileSync(string(args, "path"), "utf8"), string(args, "passphrase")));
    if (args.dryRun === true) return { valid: true, ratings: Object.keys(imported.ratings).length };
    const title = profileName(args);
    if (vault.profiles.some((entry) => entry.name.toLowerCase() === title.toLowerCase())) throw new ActionError("NAME_EXISTS", "Choose another profile name");
    const profile = newProfile(title); profile.state = imported;
    vault.profiles.push(profile); vault.activeId = profile.id; storage.save(vault); storage.audit("profile.import", profile.id);
    return publicProfile(profile);
  }
  if (name === "tmdb.status") { const tokenConfigured = Boolean(await storage.getTmdbToken()), keyConfigured = Boolean(await storage.getTmdbApiKey()); return { configured: tokenConfigured || keyConfigured, tokenConfigured, keyConfigured }; }
  if (name === "tmdb.set") { await storage.setTmdbToken(string(args, "token")); return { configured: true }; }
  if (name === "tmdb.set-key") { await storage.setTmdbApiKey(string(args, "apiKey")); return { keyConfigured: true }; }
  if (name === "tmdb.clear") { requireYes(args); await storage.clearTmdbToken(); await storage.clearTmdbApiKey(); return { configured: false, tokenConfigured: false, keyConfigured: false }; }
  if (name === "tmdb.validate") { await (await tmdb(storage)).validate(); return { valid: true }; }
  if (name === "tmdb.validate-key") { const key = await storage.getTmdbApiKey(); if (!key) throw new ActionError("TMDB_NOT_CONFIGURED", "Run dossier tmdb set-key using stdin"); await createTmdbClient(key, join(storage.root, "tmdb-cache")).validate(); return { valid: true }; }
  if (name === "tmdb.search") { const result = await (await tmdb(storage)).search(medium(args), string(args, "query")); return { items: result.items.slice(0, number(args, "limit", 10)).map((item) => compact(item)) }; }
  if (name === "backup.create") return { file: storage.createBackup() };
  if (name === "backup.list") return { items: storage.listBackups() };
  if (name === "backup.delete") { const file = string(args, "file"); if (!storage.listBackups().includes(file)) throw new ActionError("BACKUP_NOT_FOUND", "List backups and retry"); if (args.dryRun === true) return { file, dryRun: true }; requireYes(args); storage.deleteBackup(file); return { deleted: file }; }
  if (name === "backup.restore") {
    const current = choose(vault, args); revision(current, args);
    if (args.dryRun !== true) requireYes(args);
    return storage.restoreBackup(string(args, "file"), vault, args.dryRun === true);
  }
  const profile = choose(vault, args);
  const state = profile.state;
  if (name === "profile.rename") { revision(profile, args); const title = profileName(args); if (vault.profiles.some((entry) => entry.id !== profile.id && entry.name.toLowerCase() === title.toLowerCase())) throw new ActionError("NAME_EXISTS", "Choose another profile name"); profile.name = title; profile.revision++; storage.save(vault); return publicProfile(profile); }
  if (name === "profile.archive") { revision(profile, args); profile.archived = true; profile.revision++; if (vault.activeId === profile.id) vault.activeId = null; storage.save(vault); storage.audit("profile.archive", profile.id); return publicProfile(profile); }
  if (name === "profile.unarchive") { revision(profile, args); profile.archived = false; profile.revision++; storage.save(vault); storage.audit("profile.unarchive", profile.id); return publicProfile(profile); }
  if (name === "profile.delete") { revision(profile, args); if (args.dryRun === true) return { profile: publicProfile(profile), dryRun: true }; requireYes(args); vault.profiles = vault.profiles.filter((entry) => entry.id !== profile.id); if (vault.activeId === profile.id) vault.activeId = null; storage.save(vault); storage.audit("profile.delete", profile.id); return { deleted: profile.id }; }
  if (name === "profile.export" || name === "library.export") { const path = string(args, "path"); writeFileSync(path, JSON.stringify(await exportLibrary(state, string(args, "passphrase"))), { mode: 0o600, flag: "wx" }); storage.audit("profile.export", profile.id); return { file: path }; }
  if (name === "profile.reset") { revision(profile, args); if (args.dryRun === true) return { ratings: Object.keys(state.ratings).length }; requireYes(args); return { revision: mutate(storage, vault, profile, args, resetLibraryPreferences(state)) }; }
  if (name === "library.import") { revision(profile, args); const imported = validImport(await importLibrary(readFileSync(string(args, "path"), "utf8"), string(args, "passphrase"))); if (args.dryRun === true) return { ratings: Object.keys(imported.ratings).length }; requireYes(args); const nextRevision = mutate(storage, vault, profile, args, imported); storage.audit("library.import", profile.id); return { revision: nextRevision }; }
  if (name === "settings.get") return args.key ? { [string(args, "key")]: state.settings[string(args, "key")] ?? null } : { settings: state.settings };
  if (name === "settings.set") {
    const key = string(args, "key"), value = args.value;
    if (!settingTypes[key] || typeof value !== settingTypes[key] || (settingTypes[key] === "object" && (!value || Array.isArray(value)))) throw new ActionError("INVALID_ARGUMENT", "Unsupported setting or value");
    if (key === "refineGroupSize" && (!Number.isInteger(value) || Number(value) < 2 || Number(value) > 10)) throw new ActionError("INVALID_ARGUMENT", "refineGroupSize must be 2..10");
    if ((key === "rateGenreDials" || key === "rateTagDials") && Object.values(value as Record<string, unknown>).some((dial) => !Number.isInteger(dial) || Number(dial) < 1 || Number(dial) > 100)) throw new ActionError("INVALID_ARGUMENT", "Rate dials must be 1..100");
    if (key === "recommendationDials" && Object.entries(value as Record<string, unknown>).some(([dial, setting]) => !(dial in DEFAULT_SCORING_PARAMS) || (dial !== "axisWeights" && (typeof setting !== "number" || !Number.isFinite(setting))))) throw new ActionError("INVALID_ARGUMENT", "Invalid recommendation dials");
    if (key === "recommendationDials" && "axisWeights" in (value as object)) {
      const weights = (value as { axisWeights: unknown }).axisWeights;
      if (!weights || typeof weights !== "object" || Array.isArray(weights) || Object.values(weights).some((weight) => typeof weight !== "number" || !Number.isFinite(weight) || weight < 0)) throw new ActionError("INVALID_ARGUMENT", "Invalid axis weights");
    }
    return { settings: { [key]: value }, revision: mutate(storage, vault, profile, args, updateLibrarySettings(state, { [key]: value })) };
  }
  if (name === "rate.set") {
    const key = string(args, "key"); const parsed = itemKey(key); const value = Number(args.value);
    if (!isValidRating(value)) throw new ActionError("INVALID_ARGUMENT", "Use -3..3, -0.5, or 0.5");
    const item = state.ratings[key]?.item ?? snapshot(await (catalogue ? catalogue.detail(parsed.medium, parsed.id) : (await tmdb(storage)).detail(parsed.medium, parsed.id)));
    return { item: { id: key, title: item.title, rating: value }, revision: mutate(storage, vault, profile, args, setLibraryRating(state, key, value, item)) };
  }
  if (name === "rate.clear") { const key = string(args, "key"); itemKey(key); return { key, revision: mutate(storage, vault, profile, args, setLibraryRating(state, key, null)) }; }
  if (name === "rate.skip") { const key = string(args, "key"); itemKey(key); return { key, revision: mutate(storage, vault, profile, args, setLibrarySkipped(state, key, true)) }; }
  if (name === "rate.queue" || name === "suggest.list") {
    const which = medium(args); const offset = args.cursor ? Number(Buffer.from(string(args, "cursor"), "base64url").toString()) : 0;
    if (!Number.isSafeInteger(offset) || offset < 0) throw new ActionError("INVALID_CURSOR", "Start again without --cursor");
    const source = await candidates(storage, profile, which, Math.floor(offset / 20) + 1, name === "rate.queue" ? "rate" : "suggest", catalogue);
    const filtered = source.filter((item) => !state.ratings[`${item.medium}:${item.id}`] && !state.skipped.includes(`${item.medium}:${item.id}`));
    let items: Array<{ id: string; title: string; year: number | null; score?: number; reason?: string }>;
    if (name === "rate.queue") {
      const mode = args.mode ?? "standard";
      if (mode === "active" || mode === "focused") items = rankRateProbes(filtered, entries(profile), typeof args.focus === "string" ? args.focus : undefined, state.tasteClaims, state.skipped).map((probe) => ({ ...compact(probe.item), reason: probe.reason }));
      else if (mode === "challenge") items = rankDissonantCandidates(filtered, entries(profile), state.tasteClaims).map(({ item, prediction }) => ({ ...compact(item), score: prediction.score / 100 }));
      else items = filtered.map((item) => compact(item));
    } else {
      const configuredDials = args.dials ?? state.settings.recommendationDials;
      const dials = typeof configuredDials === "object" && configuredDials !== null ? configuredDials as Partial<ScoringParams> : {};
      if (Object.entries(dials).some(([dial, setting]) => !(dial in DEFAULT_SCORING_PARAMS) || (dial !== "axisWeights" && (typeof setting !== "number" || !Number.isFinite(setting))))) throw new ActionError("INVALID_ARGUMENT", "Invalid recommendation dials");
      if (dials.axisWeights !== undefined && (!dials.axisWeights || typeof dials.axisWeights !== "object" || Object.values(dials.axisWeights).some((weight) => typeof weight !== "number" || !Number.isFinite(weight) || weight < 0))) throw new ActionError("INVALID_ARGUMENT", "Invalid axis weights");
      const params = { ...DEFAULT_SCORING_PARAMS, ...dials };
      const filters = typeof args.filters === "object" && args.filters !== null ? args.filters as { genres?: string[]; yearFrom?: number; yearTo?: number; minVoteAverage?: number } : {};
      if (filters.genres && (!Array.isArray(filters.genres) || filters.genres.some((genre) => typeof genre !== "string"))) throw new ActionError("INVALID_ARGUMENT", "filters.genres must be a string array");
      if ([filters.yearFrom, filters.yearTo, filters.minVoteAverage].some((value) => value !== undefined && (typeof value !== "number" || !Number.isFinite(value)))) throw new ActionError("INVALID_ARGUMENT", "Invalid recommendation filter");
      const narrowed = filtered.filter((item) =>
        (!filters.genres?.length || filters.genres.some((genre) => item.genres.includes(genre))) &&
        (filters.yearFrom === undefined || (item.year !== null && item.year >= filters.yearFrom)) &&
        (filters.yearTo === undefined || (item.year !== null && item.year <= filters.yearTo)) &&
        (filters.minVoteAverage === undefined || (item.voteAverage !== null && item.voteAverage >= filters.minVoteAverage))
      );
      items = scoreCandidates(narrowed, entries(profile), params, state.tasteClaims).map(({ item, score }) => compact(item, score));
    }
    const limit = number(args, "limit", 10, 1, 20);
    const batch = catalogue ? items : items.slice(0, 20);
    const end = offset % 20 + limit;
    const hasNext = catalogue ? offset + limit < batch.length : end < batch.length || source.length >= 20;
    const nextOffset = catalogue ? offset + limit : end < 20 ? offset + limit : (Math.floor(offset / 20) + 1) * 20;
    return { items: batch.slice(catalogue ? offset : offset % 20, catalogue ? offset + limit : end), next: hasNext ? Buffer.from(String(nextOffset)).toString("base64url") : null };
  }
  if (name === "suggest.explain") {
    const parsed = itemKey(string(args, "key")); const item = await (catalogue ? catalogue.detail(parsed.medium, parsed.id) : (await tmdb(storage)).detail(parsed.medium, parsed.id));
    const scored = scoreCandidates([item], entries(profile), DEFAULT_SCORING_PARAMS, state.tasteClaims)[0];
    const related = state.tasteClaims.filter((claim) => claim.active && matchesTasteClaim(item, claim)).map((claim) => claim.id);
    const clusters = buildTasteSpace(entries(profile)).clusters.filter((cluster) => cluster.polarity === "liked").map((cluster) => ({ id: cluster.id, similarity: cosineSimilarity(item.features, cluster.centroid) })).sort((a, b) => b.similarity - a.similarity).slice(0, 3);
    return { item: compact(item), score: scored?.score ?? null, evidence: { claims: related, clusters } };
  }
  if (name === "refine.queue") {
    const size = number(args, "size", Number(state.settings.refineGroupSize) || 2, 2, 10);
    const rated = entries(profile);
    return size === 2 ? { items: buildPairwiseCandidates(rated, state.pairwise, number(args, "limit", 10)).map((pair) => pair.map((entry) => ({ id: entry.item.key, title: entry.item.title }))) } : { items: buildRankingGroup(rated, state.pairwise, size).map((entry) => ({ id: entry.item.key, title: entry.item.title })) };
  }
  if (name === "refine.choose" || name === "refine.correct") {
    const winner = string(args, "winner"), loser = string(args, "loser");
    if (winner === loser || !state.ratings[winner] || !state.ratings[loser]) throw new ActionError("INVALID_ARGUMENT", "Choose two different rated items");
    const choice = { winnerKey: winner, loserKey: loser, ts: Date.now() };
    const exists = state.pairwise.some((entry) => [entry.winnerKey, entry.loserKey].sort().join("|") === [winner, loser].sort().join("|"));
    if (name === "refine.correct" && !exists) throw new ActionError("CHOICE_NOT_FOUND", "Record a choice before correcting it");
    if (name === "refine.choose" && exists) throw new ActionError("CHOICE_EXISTS", "Use refine correct to change this pair");
    return { revision: mutate(storage, vault, profile, args, name === "refine.correct" ? correctLibraryPairwise(state, choice) : addLibraryPairwise(state, choice)) };
  }
  if (name === "refine.rank") {
    const keys = args.keys;
    if (!Array.isArray(keys) || keys.length < 2 || new Set(keys).size !== keys.length || keys.some((key) => typeof key !== "string" || !state.ratings[key])) throw new ActionError("INVALID_ARGUMENT", "Provide distinct rated item IDs");
    let next = state;
    const seen = new Set(state.pairwise.map((entry) => [entry.winnerKey, entry.loserKey].sort().join("|")));
    for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) {
      const pair = [keys[i] as string, keys[j] as string].sort().join("|");
      if (!seen.has(pair)) next = addLibraryPairwise(next, { winnerKey: keys[j] as string, loserKey: keys[i] as string, ts: Date.now() });
    }
    return { revision: mutate(storage, vault, profile, args, next) };
  }
  if (name === "taste.areas") return { areas: tasteSnapshot(entries(profile)) };
  if (name === "taste.coverage") { const space = buildTasteSpace(entries(profile)); return { ratings: entries(profile).length, claims: state.tasteClaims.length, clusters: space.clusters.length, weakRegions: space.weakRegions.length }; }
  if (name === "taste.claims") return page(state.tasteClaims.map((claim) => ({ id: claim.id, effect: claim.effect, confidence: claim.confidence, provenance: claim.provenance, active: claim.active })), args);
  if (name === "taste.claim.inspect") return { claim: findClaim(profile, string(args, "id")) };
  if (name.startsWith("taste.claim.")) {
    const claim = findClaim(profile, string(args, "id"));
    const provenance = name === "taste.claim.confirm" ? "user_confirmed" : name === "taste.claim.reject" ? "explicitly_rejected" : "corrected";
    if (name === "taste.claim.correct") {
      if (args.effect !== "positive" && args.effect !== "negative" && args.conditions === undefined) throw new ActionError("INVALID_ARGUMENT", "Supply --effect or --conditions");
      if (args.effect !== undefined && args.effect !== "positive" && args.effect !== "negative") throw new ActionError("INVALID_ARGUMENT", "Effect must be positive or negative");
      const conditions = args.conditions === undefined ? claim.conditions : args.conditions;
      if (!Array.isArray(conditions) || conditions.length < 1 || conditions.length > 2 || conditions.some((condition: TasteClaimCondition) => !condition || typeof condition.kind !== "string" || typeof condition.label !== "string" || !["string", "number"].includes(typeof condition.value))) throw new ActionError("INVALID_ARGUMENT", "Supply one or two valid conditions");
      const effect = (args.effect ?? claim.effect) as TasteClaim["effect"];
      const id = tasteClaimId(effect, conditions as TasteClaimCondition[]);
      if (id === claim.id) throw new ActionError("INVALID_ARGUMENT", "Correction must change the claim");
      const corrected: TasteClaim = { ...claim, id, effect, conditions: conditions as TasteClaim["conditions"] };
      const tombstoned = setLibraryClaimFeedback(state, claim, "corrected");
      const next = setLibraryClaimFeedback(tombstoned, corrected, "user_confirmed");
      const nextRevision = mutate(storage, vault, profile, args, next);
      return { claim: profile.state.tasteClaims.find((entry) => entry.id === id), revision: nextRevision };
    }
    const nextRevision = mutate(storage, vault, profile, args, setLibraryClaimFeedback(state, claim, provenance));
    return { claim: profile.state.tasteClaims.find((entry) => entry.id === claim.id), revision: nextRevision };
  }
  if (name === "library.list") {
    let rows: Array<{ id: string; title: string; year: number | null; rating: number | null }> = Object.values(state.ratings).map((entry) => ({ id: entry.item.key, title: entry.item.title, year: entry.item.year, rating: entry.rating }));
    if (args.filter === "skipped") rows = state.skipped.map((id) => ({ id, title: state.ratings[id]?.item.title ?? "", year: state.ratings[id]?.item.year ?? null, rating: null }));
    if (args.filter === "watchlist") rows = rows.filter((entry) => entry.rating === 0.5);
    if (args.filter === "not-interested") rows = rows.filter((entry) => entry.rating === -0.5);
    if (typeof args.query === "string") rows = rows.filter((entry) => entry.title.toLowerCase().includes((args.query as string).toLowerCase()));
    return page(rows.sort((a, b) => a.title.localeCompare(b.title)), args);
  }
  if (name === "library.inspect") { const key = string(args, "key"); const entry = state.ratings[key]; return entry ? { item: entry } : { item: null, skipped: state.skipped.includes(key) }; }
  if (name === "library.remove") { const key = string(args, "key"); const next = setLibrarySkipped(setLibraryRating(state, key, null), key, false); return { revision: mutate(storage, vault, profile, args, next) }; }
  throw new ActionError("UNKNOWN_ACTION", "Run dossier help --json");
}
