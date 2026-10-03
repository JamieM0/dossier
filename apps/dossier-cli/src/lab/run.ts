import { writeFileSync } from "node:fs";
import { matchesTasteClaim, type TasteClaim, type TmdbItem } from "@dossier/domain";
import { execute, type ActionCatalogue } from "../actions.js";
import type { CliStorage, Vault } from "../storage.js";
import { catalogue, personas, truth, type Persona } from "./fixtures.js";

type Row = { id: string; title: string; score?: number; reason?: string };
type Snapshot = { hit10: number; ndcg10: number; randomBaseline: number; top10: string[]; claims: TasteClaim[]; wrongClaims: string[]; prompt: string | null };
type Result = { person: string; description: string; cold: Record<number, Snapshot>; active: Record<number, Snapshot>; random: Record<number, Snapshot>; correction: { wrong: number; corrected: number; eligible: boolean }; pathOverlap: number; pathHitRange: number };

const checkpoints = [3, 5, 10, 20, 40];
function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => { state = (Math.imul(1664525, state) + 1013904223) >>> 0; return state / 4294967296; };
}
function shuffle<T>(items: T[], seed: number): T[] {
  const result = [...items], random = rng(seed);
  for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [result[i], result[j]] = [result[j]!, result[i]!]; }
  return result;
}
function key(item: TmdbItem): string { return `${item.medium}:${item.id}`; }

function actionClient(items: TmdbItem[]) {
  let vault: Vault = { activeId: null, profiles: [] };
  const byId = new Map(items.map((item) => [key(item), item]));
  const storage = {
    root: "/offline-dossier-lab", load: () => vault, save: (next: Vault) => { vault = next; }, audit: () => {}
  } as unknown as CliStorage;
  const fixture: ActionCatalogue = {
    detail: async (medium, id) => {
      const item = byId.get(`${medium}:${id}`);
      if (!item) throw new Error(`Unknown catalogue item ${medium}:${id}`);
      return item;
    },
    candidates: async (medium, kind) => items.filter((item) => item.medium === medium && ((item.id % 100 - 1) % 4 === 0) === (kind === "suggest"))
  };
  const call = async <T>(name: string, args: Record<string, unknown> = {}): Promise<T> =>
    await execute(storage, name, args, fixture) as T;
  return { call };
}

function claimWrong(claim: TasteClaim, person: Persona, items: TmdbItem[]): boolean {
  const matches = items.filter((item) => matchesTasteClaim(item, claim));
  if (matches.length < 4) return false;
  const mean = matches.reduce((total, item) => total + truth(person, item), 0) / matches.length;
  return claim.effect === "positive" ? mean < -.5 : mean > .5;
}

async function simulate(person: Persona, items: TmdbItem[], seed: number, strategy: "cold" | "active" | "random", stop = 40): Promise<Record<number, Snapshot>> {
  const { call } = actionClient(items);
  const created = await call<{ revision: number }>("profile.create", { name: person.id });
  let revision = created.revision;
  const training = items.filter((item) => (item.id % 100 - 1) % 4 !== 0);
  const holdout = items.filter((item) => (item.id % 100 - 1) % 4 === 0);
  const order = shuffle(training, seed);
  const seen = new Set<string>();
  const records: Record<number, Snapshot> = {};
  const record = async (count: number) => {
    const actual = (item: TmdbItem) => truth(person, item, Math.floor((count - 1) / 10));
    const recommendations = await call<{ items: Row[] }>("suggest.list", { limit: 10 });
    const queue = await call<{ items: Row[] }>("rate.queue", { mode: "active", limit: 1 });
    const claimsPage = await call<{ items: Array<{ id: string }> }>("taste.claims", { limit: 100 });
    const claims = await Promise.all(claimsPage.items.map(async ({ id }) => (await call<{ claim: TasteClaim }>("taste.claim.inspect", { id })).claim));
    const relevant = holdout.filter((item) => actual(item) > 0).length;
    const remaining = holdout.length;
    const ideal = Array.from({ length: Math.min(10, relevant) }, (_, index) => 1 / Math.log2(index + 2)).reduce((a, b) => a + b, 0);
    const top10 = recommendations.items.map((row) => row.id);
    const discounted = top10.reduce((sum, id, index) => sum + (actual(items.find((item) => key(item) === id)!) > 0 ? 1 / Math.log2(index + 2) : 0), 0);
    records[count] = {
      hit10: top10.length ? top10.filter((id) => actual(items.find((item) => key(item) === id)!) > 0).length / top10.length : 0,
      ndcg10: ideal ? discounted / ideal : 0,
      randomBaseline: remaining ? relevant / remaining : 0,
      top10,
      claims,
      wrongClaims: claims.filter((claim) => claim.active && claimWrong(claim, person, items)).map((claim) => claim.id),
      prompt: queue.items[0]?.id ?? null
    };
  };
  for (let count = 1; count <= stop; count++) {
    let item: TmdbItem | undefined;
    if (strategy === "active" && count > 5) {
      const queue = await call<{ items: Row[] }>("rate.queue", { mode: "active", limit: 1 });
      item = items.find((candidate) => key(candidate) === queue.items[0]?.id);
    }
    item ??= order.find((candidate) => !seen.has(key(candidate)));
    if (!item) break;
    seen.add(key(item));
    const response = await call<{ revision: number }>("rate.set", { key: key(item), value: truth(person, item, Math.floor((count - 1) / 10)), expectedRevision: revision });
    revision = response.revision;
    if (checkpoints.includes(count) || count === stop) await record(count);
  }
  return records;
}

async function correctionTrial(person: Persona, items: TmdbItem[]): Promise<Result["correction"]> {
  const training = items.filter((item) => (item.id % 100 - 1) % 4 !== 0);
  const groups = [...new Set(training.flatMap((item) => item.genres))].map((genre) => ({
    genre,
    liked: training.filter((item) => item.genres.includes(genre) && truth(person, item) > 0),
    disliked: training.filter((item) => item.genres.includes(genre) && truth(person, item) < 0)
  })).filter((group) => group.liked.length >= 5 && group.disliked.length >= 5);
  groups.sort((a, b) => Math.min(b.liked.length, b.disliked.length) - Math.min(a.liked.length, a.disliked.length));
  const group = groups[0];
  if (!group) return { eligible: false, wrong: 0, corrected: 0 };
  const { call } = actionClient(items);
  let revision = (await call<{ revision: number }>("profile.create", { name: person.id })).revision;
  const readClaims = async () => {
    const page = await call<{ items: Array<{ id: string }> }>("taste.claims", { limit: 100 });
    return Promise.all(page.items.map(async ({ id }) => (await call<{ claim: TasteClaim }>("taste.claim.inspect", { id })).claim));
  };
  for (const item of group.liked.slice(0, 5)) revision = (await call<{ revision: number }>("rate.set", { key: key(item), value: truth(person, item), expectedRevision: revision })).revision;
  const before = (await readClaims()).filter((claim) => claim.active && claimWrong(claim, person, items));
  for (const item of group.disliked.slice(0, 10)) revision = (await call<{ revision: number }>("rate.set", { key: key(item), value: truth(person, item), expectedRevision: revision })).revision;
  const after = new Map((await readClaims()).map((claim) => [claim.id, claim]));
  return {
    eligible: true, wrong: before.length,
    corrected: before.filter((claim) => {
      const later = after.get(claim.id);
      return !later?.active || later.confidence < claim.confidence - .2;
    }).length
  };
}

const average = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
const round = (value: number) => Math.round(value * 1000) / 1000;

async function sensitivityTrial(output: string) {
  const person = personas(0)[0]!;
  const items = catalogue();
  const training = items.filter((item) => (item.id % 100 - 1) % 4 !== 0);
  const holdout = items.filter((item) => (item.id % 100 - 1) % 4 === 0);
  const positive = training.filter((item) => item.title.startsWith("Philosophical signal") && truth(person, item) > 0).slice(0, 5);
  const negative = training.filter((item) => (item.title.startsWith("Space spectacle") || item.title.startsWith("Broad comedy")) && truth(person, item) < 0).slice(0, 5);
  const firstTen = positive.flatMap((item, index) => [item, negative[index]!]);
  if (firstTen.length !== 10 || firstTen.some((item) => !item)) throw new Error("Sensitivity fixture needs five positive and five negative training titles");
  const known = new Set(firstTen.map(key));
  const relevantPositive = training.filter((item) => !known.has(key(item)) && truth(person, item) > 0 && ["Intimate future", "Domestic drama", "Nature study"].some((name) => item.title.startsWith(name))).slice(0, 5);
  const relevantNegative = training.filter((item) => !known.has(key(item)) && truth(person, item) < 0 && ["Slasher", "Fantasy quest", "Broad comedy"].some((name) => item.title.startsWith(name))).slice(0, 5);
  const additional = relevantPositive.flatMap((item, index) => [item, relevantNegative[index]!]);
  if (additional.length !== 10 || additional.some((item) => !item)) throw new Error("Sensitivity fixture needs ten additional training titles");
  const heldout = [...shuffle(holdout.filter((item) => truth(person, item) > 0), 91).slice(0, 10), ...shuffle(holdout.filter((item) => truth(person, item) < 0), 92).slice(0, 10)];
  const flipped = new Set(shuffle(Array.from({ length: 10 }, (_, index) => index), 93).slice(0, 5));
  const cases = [
    { name: "one_rating", ratings: firstTen.slice(0, 1), flipped: new Set<number>() },
    { name: "sparse", ratings: firstTen.slice(0, 3), flipped: new Set<number>() },
    { name: "coherent", ratings: firstTen, flipped: new Set<number>() },
    { name: "noisy", ratings: firstTen, flipped },
    { name: "more_relevant", ratings: [...firstTen, ...additional], flipped: new Set<number>() }
  ];
  const results = [];
  for (const scenario of cases) {
    const { call } = actionClient(items);
    let revision = (await call<{ revision: number }>("profile.create", { name: scenario.name })).revision;
    for (const [index, item] of scenario.ratings.entries()) {
      const rating = truth(person, item) * (scenario.flipped.has(index) ? -1 : 1);
      revision = (await call<{ revision: number }>("rate.set", { key: key(item), value: rating, expectedRevision: revision })).revision;
    }
    const suggested = await call<{ items: Row[] }>("suggest.list", { limit: 10 });
    const claims = await call<{ items: unknown[] }>("taste.claims", { limit: 100 });
    const predictions = await Promise.all(heldout.map(async (item) => {
      const explained = await call<{ score: number | null }>("suggest.explain", { key: key(item) });
      return { id: key(item), title: item.title, hiddenRating: truth(person, item), score: explained.score };
    }));
    const liked = predictions.filter((entry) => entry.hiddenRating > 0);
    const disliked = predictions.filter((entry) => entry.hiddenRating < 0);
    const auc = average(liked.flatMap((good) => disliked.map((bad) => {
      const difference = (good.score ?? -Infinity) - (bad.score ?? -Infinity);
      return Number.isNaN(difference) || difference === 0 ? .5 : difference > 0 ? 1 : 0;
    })));
    const discount = (index: number) => 1 / Math.log2(index + 2);
    const ideal = Array.from({ length: Math.min(10, holdout.filter((item) => truth(person, item) > 0).length) }, (_, index) => discount(index)).reduce((a, b) => a + b, 0);
    const top10 = suggested.items.map((row) => ({ ...row, hiddenRating: truth(person, items.find((item) => key(item) === row.id)!) }));
    results.push({
      name: scenario.name, trainingRatings: scenario.ratings.length, reversedRatings: scenario.flipped.size,
      top10Hits: top10.filter((item) => item.hiddenRating > 0).length,
      top10Count: top10.length,
      ndcg10: round(ideal ? top10.reduce((total, item, index) => total + (item.hiddenRating > 0 ? discount(index) : 0), 0) / ideal : 0),
      heldoutAuc: round(auc), claimCount: claims.items.length,
      training: scenario.ratings.map((item, index) => ({ id: key(item), hiddenRating: truth(person, item), suppliedRating: truth(person, item) * (scenario.flipped.has(index) ? -1 : 1) })),
      predictions
    });
  }
  const report = { version: 1, persona: person.description, heldoutRatings: heldout.length, cases: results };
  if (output) writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  process.stdout.write(JSON.stringify({ ...(output ? { output } : {}), persona: person.description, heldoutRatings: heldout.length, cases: results.map(({ name, trainingRatings, reversedRatings, top10Hits, top10Count, ndcg10, heldoutAuc, claimCount }) => ({ name, trainingRatings, reversedRatings, top10Hits, top10Count, ndcg10, heldoutAuc, claimCount })) }) + "\n");
}

async function run() {
  const args = process.argv.slice(2);
  const value = (flag: string, fallback: string) => { const at = args.indexOf(flag); return at < 0 ? fallback : args[at + 1] ?? fallback; };
  const seed = Number(value("--seed", "42"));
  const limit = Number(value("--users", "48"));
  const variations = Number(value("--variations", "10"));
  const clones = Number(value("--clones", "4"));
  const output = value("--output", "");
  if (args.includes("--sensitivity")) { await sensitivityTrial(output); return; }
  if (![seed, limit, variations, clones].every(Number.isSafeInteger) || seed < 0 || limit < 1 || variations < 0 || clones < 2) throw new Error("Use non-negative integers for --seed and --variations, a positive --users value, and --clones of at least 2");
  const people = personas(variations).slice(0, limit);
  const items = catalogue();
  const results: Result[] = [];
  for (let index = 0; index < people.length; index++) {
    const person = people[index]!;
    const baseSeed = seed + index * 997;
    const cold = await simulate(person, items, baseSeed, "cold");
    const active = await simulate(person, items, baseSeed, "active", 20);
    const random = cold;
    const cloneSnapshots = [cold[20]!, ...await Promise.all(Array.from({ length: clones - 1 }, (_, clone) => simulate(person, items, baseSeed + clone + 1, "cold", 20).then((record) => record[20]!)))];
    const correction = await correctionTrial(person, items);
    const overlaps: number[] = [], hitRanges: number[] = [];
    for (let a = 0; a < cloneSnapshots.length; a++) for (let b = a + 1; b < cloneSnapshots.length; b++) {
      const first = cloneSnapshots[a]!, second = cloneSnapshots[b]!;
      overlaps.push(first.top10.filter((id) => second.top10.includes(id)).length / 10);
      hitRanges.push(Math.abs(first.hit10 - second.hit10));
    }
    results.push({
      person: person.id, description: person.description, cold, active, random,
      correction,
      pathOverlap: average(overlaps),
      pathHitRange: average(hitRanges)
    });
    if (process.stderr.isTTY) process.stderr.write(`\rSimulated ${index + 1}/${people.length} people`);
  }
  if (process.stderr.isTTY) process.stderr.write("\n");
  const sum = (fn: (result: Result) => number) => results.reduce((total, result) => total + fn(result), 0);
  const report = {
    version: 2, seed, clonesPerUser: clones, catalogueSize: items.length, trainingSize: items.length * .75, holdoutSize: items.length * .25, syntheticUsers: results.length,
    curatedUsers: results.filter((result) => !result.person.includes("-v")).length,
    metrics: {
      coldStart: Object.fromEntries(checkpoints.map((count) => [count, {
        hit10: round(average(results.map((result) => result.cold[count]?.hit10 ?? 0))),
        ndcg10: round(average(results.map((result) => result.cold[count]?.ndcg10 ?? 0))),
        randomBaseline: round(average(results.map((result) => result.cold[count]?.randomBaseline ?? 0))),
        recommendationCoverage: round(average(results.map((result) => Number((result.cold[count]?.top10.length ?? 0) === 10))))
      }])),
      calibrationAt20: { activeHit10: round(average(results.map((result) => result.active[20]!.hit10))), randomHit10: round(average(results.map((result) => result.random[20]!.hit10))) },
      incorrectClaimRateAt20: round(sum((result) => result.cold[20]!.wrongClaims.length) / Math.max(1, sum((result) => result.cold[20]!.claims.filter((claim) => claim.active).length))),
      claimCorrectionRate: round(sum((result) => result.correction.corrected) / Math.max(1, sum((result) => result.correction.wrong))),
      correctionEligibleUsers: sum((result) => Number(result.correction.eligible)),
      wrongClaimsAfterBiasedEvidence: sum((result) => result.correction.wrong),
      cloneTop10Overlap: round(average(results.map((result) => result.pathOverlap))),
      cloneHit10Range: round(average(results.map((result) => result.pathHitRange)))
    },
    designedProfiles: [...new Set(results.map((result) => result.person.slice(0, 10)))].map((id) => {
      const group = results.filter((result) => result.person.startsWith(id));
      return {
        id, description: group[0]!.description.replace(/ \(variation \d+\)$/, ""), people: group.length,
        hit10At20: round(average(group.map((result) => result.cold[20]!.hit10))),
        recommendationCoverageAt20: round(average(group.map((result) => Number(result.cold[20]!.top10.length === 10))))
      };
    }).sort((a, b) => a.hit10At20 - b.hit10At20),
    worstUsers: [...results].sort((a, b) => a.cold[20]!.hit10 - b.cold[20]!.hit10).slice(0, 10).map((result) => ({
      id: result.person, description: result.description, hit10: result.cold[20]!.hit10,
      wrongClaims: result.cold[20]!.wrongClaims, prompt: result.cold[20]!.prompt,
      recommended: result.cold[20]!.top10.map((id) => {
        const item = items.find((candidate) => key(candidate) === id)!;
        const person = people.find((candidate) => candidate.id === result.person)!;
        return { id, title: item.title, hiddenRating: truth(person, item, 1) };
      })
    })),
    users: results
  };
  const json = JSON.stringify(report, null, 2) + "\n";
  if (output) writeFileSync(output, json);
  process.stdout.write(JSON.stringify({ ...(output ? { output } : {}), syntheticUsers: results.length, metrics: report.metrics }) + "\n");
}

run().catch((error: Error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
