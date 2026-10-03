import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { featureVector, matchesTasteClaim } from "@dossier/domain";
import { execute } from "../dist/actions.js";
import { average, assess, baselineScores, distribution, key, round, shuffled } from "./hard-metrics.mjs";
import { renderHtml } from "./hard-html.mjs";

const fixturePath = new URL("../src/lab/hard-v1.json", import.meta.url);
const fixtureBytes = readFileSync(fixturePath);
const fixture = JSON.parse(fixtureBytes);
const fixtureHash = createHash("sha256").update(fixtureBytes).digest("hex");
const fingerprint = (paths) => {
  const digest = createHash("sha256");
  for (const path of paths) digest.update(readFileSync(new URL(path, import.meta.url)));
  return digest.digest("hex");
};
const evaluatorFingerprint = fingerprint(["./hard-run.mjs", "./hard-metrics.mjs", "./generate-hard-benchmark.py"]);
const modelFingerprint = fingerprint(["../../../packages/domain/src/lens.ts", "../../../packages/domain/src/recommender.ts", "../../../packages/domain/src/taste-space.ts", "../../../packages/domain/src/taste-claims.ts", "../../../packages/domain/src/calibration.ts", "../src/actions.ts"]);
const items = fixture.items.map((item) => ({ ...item, features: featureVector({ genres: item.genres, keywords: item.keywords, overview: item.overview }) }));
const byKey = new Map(items.map((item) => [key(item), item]));
const trainingSet = new Set(fixture.trainingKeys);
const holdoutSet = new Set(fixture.holdoutKeys);
const holdout = fixture.holdoutKeys.map((id) => byKey.get(id));
const baselines = ["popularity", "genre", "vector", "nearest", "random"];
const checkpoints = [1, 3, 5, 10, 20, 40];
const seeds = [11, 29, 47, 83];

function assertFixture() {
  if (items.length !== 288 || fixture.personas.length !== 18 || holdout.length !== 72) throw new Error("hard-v1 fixture changed; create a new benchmark version");
  if (fixture.trainingKeys.some((id) => holdoutSet.has(id)) || fixture.trainingKeys.length + holdout.length !== items.length) throw new Error("Training and held-out titles overlap");
  if (fixture.items.some((item) => "ratings" in item || "latent" in item || "persona" in item || "features" in item)) throw new Error("Raw public catalogue contains evaluator truth or precomputed lens vectors");
  for (const person of fixture.personas) {
    if (Object.keys(person.ratings).length !== items.length) throw new Error(`Incomplete truth for ${person.id}`);
    const positive = holdout.filter((item) => person.ratings[key(item)] > 0).length;
    const negative = holdout.filter((item) => person.ratings[key(item)] < 0).length;
    if (positive < 5 || negative < 5) throw new Error(`AUC is underpowered for ${person.id}`);
  }
}

function createClient() {
  let vault = { activeId: null, profiles: [] };
  const storage = { root: "/offline-hard-benchmark", load: () => vault, save: (next) => { vault = next; }, audit: () => {} };
  const publicCatalogue = {
    detail: async (medium, id) => {
      const item = byKey.get(`${medium}:${id}`);
      if (!item) throw new Error(`Unknown title ${medium}:${id}`);
      return item;
    },
    candidates: async (medium, kind) => (kind === "suggest" ? holdout : fixture.trainingKeys.map((id) => byKey.get(id))).filter((item) => item.medium === medium)
  };
  return { call: (action, args = {}) => execute(storage, action, args, publicCatalogue), getVault: () => vault };
}

async function rankAll(call) {
  const rows = [];
  let cursor;
  do {
    const page = await call("suggest.list", { limit: 20, ...(cursor ? { cursor } : {}) });
    rows.push(...page.items);
    cursor = page.next;
  } while (cursor && rows.length < holdout.length);
  if (rows.length > holdout.length) throw new Error("CLI returned more recommendations than held-out titles");
  return { rows, scores: Object.fromEntries(rows.map((row) => [row.id, row.score ?? 0])) };
}

async function claimsAll(call, inspect = false) {
  const page = await call("taste.claims", { limit: 100 });
  if (!inspect) return page.items;
  return Promise.all(page.items.map(async ({ id }) => (await call("taste.claim.inspect", { id })).claim));
}

function highConfidenceClaimErrors(claims, person) {
  return claims.filter((claim) => {
    if (!claim.active || claim.confidence < .75) return false;
    const matched = holdout.filter((item) => matchesTasteClaim(item, claim));
    if (matched.length < 3) return false;
    const mean = average(matched.map((item) => person.ratings[key(item)]));
    return claim.effect === "positive" ? mean < -.5 : mean > .5;
  }).length;
}

function overbroadClaim(claim, person) {
  if (!claim.active) return false;
  const matched = holdout.filter((item) => matchesTasteClaim(item, claim) && person.ratings[key(item)] !== 0);
  if (matched.length < 5) return false;
  const counterexamples = matched.filter((item) => claim.effect === "positive" ? person.ratings[key(item)] < 0 : person.ratings[key(item)] > 0).length;
  return counterexamples >= 4 && counterexamples / matched.length >= .4;
}

function suppliedRating(person, id) {
  const actual = person.ratings[id];
  if (person.noiseModulo && Number(id.split(":")[1]) % person.noiseModulo === 0) return -actual;
  return actual;
}

function trainingOrder(person, seed) {
  const order = shuffled(fixture.trainingKeys, seed);
  if (!["misleading_start", "claim_narrowing"].includes(person.id)) return order;
  const initial = fixture.trainingKeys.filter((id) => {
    const item = byKey.get(id);
    return item.title.startsWith("Philosophical signal") && person.ratings[id] > 0;
  }).slice(0, 5);
  return [...initial, ...order.filter((id) => !initial.includes(id))];
}

async function takeRating(call, person, id, revision, override) {
  if (!trainingSet.has(id)) throw new Error(`Held-out title reached rate.set: ${id}`);
  const rating = override ?? suppliedRating(person, id);
  const result = await call("rate.set", { key: id, value: rating, expectedRevision: revision });
  return { revision: result.revision, evidence: { id, title: byKey.get(id).title, suppliedRating: rating, hiddenRating: person.ratings[id] } };
}

async function snapshot(call, person, observed, seed, inspect = false) {
  const recommendation = await rankAll(call);
  const dossier = assess(recommendation.scores, holdout, person.ratings, recommendation.rows.length > 0);
  const baseline = Object.fromEntries(baselines.map((name) => {
    const scores = baselineScores(name, observed.map(({ id, suppliedRating }) => ({ item: byKey.get(id), rating: suppliedRating })), holdout, seed);
    return [name, assess(scores, holdout, person.ratings)];
  }));
  const claims = await claimsAll(call, true);
  const coverage = await call("taste.coverage");
  return {
    dossier, baselines: baseline,
    highConfidenceClaimErrors: highConfidenceClaimErrors(claims, person),
    claimCount: claims.filter((claim) => claim.active).length,
    clusters: coverage.clusters,
    ...(inspect ? { claims, scores: recommendation.scores } : {})
  };
}

async function session(person, seed, strategy = "random", stop = 40) {
  const { call, getVault } = createClient();
  let revision = (await call("profile.create", { name: "Benchmark profile" })).revision;
  const observed = [];
  const order = trainingOrder(person, seed);
  const eligiblePopularity = [...fixture.trainingKeys].map((id) => byKey.get(id).popularity).sort((a, b) => a - b)[Math.floor(fixture.trainingKeys.length * .25)];
  const reasonable = shuffled(fixture.trainingKeys.filter((id) => byKey.get(id).popularity >= eligiblePopularity), seed + 910);
  const snapshots = {};
  for (let count = 1; count <= stop; count++) {
    let id;
    if (strategy === "active" && count > 5) {
      const question = await call("rate.queue", { mode: "active", limit: 1 });
      id = question.items[0]?.id;
    } else if (strategy === "reasonable_random" && count > 5) id = reasonable.find((candidate) => !observed.some((entry) => entry.id === candidate));
    id ??= order.find((candidate) => !observed.some((entry) => entry.id === candidate));
    if (!id) throw new Error("Training catalogue exhausted");
    const rated = await takeRating(call, person, id, revision);
    revision = rated.revision;
    observed.push(rated.evidence);
    if (checkpoints.includes(count)) snapshots[count] = await snapshot(call, person, observed, seed, count === 20);
  }
  const ratedKeys = Object.keys(getVault().profiles[0].state.ratings);
  if (ratedKeys.some((id) => holdoutSet.has(id))) throw new Error("Leakage: held-out title was rated");
  return { person: person.id, seed, strategy, observed, snapshots };
}

function aggregateLearning(sessions) {
  const strategies = ["dossier", ...baselines];
  const output = {};
  for (const count of checkpoints) {
    output[count] = Object.fromEntries(strategies.map((strategy) => {
      const auc = sessions.map((session) => strategy === "dossier" ? session.snapshots[count].dossier.auc : session.snapshots[count].baselines[strategy].auc);
      const ndcg = sessions.map((session) => strategy === "dossier" ? session.snapshots[count].dossier.ndcg10 : session.snapshots[count].baselines[strategy].ndcg10);
      const precision = sessions.map((session) => strategy === "dossier" ? session.snapshots[count].dossier.precision10 : session.snapshots[count].baselines[strategy].precision10);
      const highRank = sessions.map((session) => strategy === "dossier" ? session.snapshots[count].dossier.highRankMistakes : session.snapshots[count].baselines[strategy].highRankMistakes);
      const coverage = sessions.map((session) => strategy === "dossier" ? session.snapshots[count].dossier.coverage : session.snapshots[count].baselines[strategy].coverage);
      return [strategy, {
        auc: distribution(auc), ndcg10: distribution(ndcg), precision10: distribution(precision),
        highRankMistakes: distribution(highRank), coverage: distribution(coverage),
        ...(strategy === "dossier" ? { highConfidenceClaimMistakes: distribution(sessions.map((session) => session.snapshots[count].highConfidenceClaimErrors)) } : {})
      }];
    }));
  }
  return output;
}

function personaSummary(sessions) {
  return fixture.personas.map((person) => {
    const own = sessions.filter((session) => session.person === person.id);
    const byCheckpoint = Object.fromEntries(checkpoints.map((count) => [count, {
      auc: distribution(own.map((session) => session.snapshots[count].dossier.auc)),
      ndcg10: distribution(own.map((session) => session.snapshots[count].dossier.ndcg10)),
      highConfidenceClaimErrors: average(own.map((session) => session.snapshots[count].highConfidenceClaimErrors))
    }]));
    const bestBaseline = baselines.map((name) => ({ name, auc: average(own.map((session) => session.snapshots[20].baselines[name].auc)) })).sort((a, b) => b.auc - a.auc)[0];
    return {
      id: person.id, description: person.description, byCheckpoint, bestBaseline,
      dossierAt20: byCheckpoint[20].auc.mean,
      baselineGapAt20: round(byCheckpoint[20].auc.mean - bestBaseline.auc),
      evidenceHurt: own.filter((session) => session.snapshots[40].dossier.auc < session.snapshots[10].dossier.auc - .03).length,
      highConfidenceClaimMistakesAt20: round(average(own.map((session) => session.snapshots[20].highConfidenceClaimErrors)))
    };
  }).sort((a, b) => a.dossierAt20 - b.dossierAt20);
}

async function beliefTrial(person, initial, contradiction) {
  if (initial.length < 5 || contradiction.length < 4) return { person: person.id, outcome: "not_eligible" };
  const { call } = createClient();
  let revision = (await call("profile.create", { name: "Benchmark profile" })).revision;
  const evidence = [];
  for (const id of initial.slice(0, 5)) { const result = await takeRating(call, person, id, revision); revision = result.revision; evidence.push(result.evidence); }
  const before = await snapshot(call, person, evidence, 29, true);
  const availableCounterexamples = (claim) => fixture.trainingKeys.filter((id) =>
    !initial.slice(0, 5).includes(id) && matchesTasteClaim(byKey.get(id), claim) &&
    (claim.effect === "positive" ? person.ratings[id] < 0 : person.ratings[id] > 0));
  const wrong = before.claims.filter((claim) =>
    overbroadClaim(claim, person) && availableCounterexamples(claim).length >= 4
  ).sort((a, b) => b.confidence - a.confidence);
  const original = wrong[0] ?? before.claims.find((claim) => claim.active) ?? null;
  const originalWrong = Boolean(original && wrong.some((claim) => claim.id === original.id));
  const matchedContradictions = originalWrong ? availableCounterexamples(original).sort((a, b) => Number(contradiction.includes(b)) - Number(contradiction.includes(a)) || a.localeCompare(b)).slice(0, 8) : contradiction.slice(0, 8);
  const contradictory = [];
  for (const id of matchedContradictions) { const result = await takeRating(call, person, id, revision); revision = result.revision; contradictory.push(result.evidence); }
  const after = await snapshot(call, person, [...evidence, ...contradictory], 29, true);
  let outcome = "no_false_claim_formed";
  let claimResolution = "not_applicable";
  if (originalWrong && original) {
    const same = after.claims.find((claim) => claim.id === original.id);
    const matchesSameCondition = (claim) => JSON.stringify(claim.conditions) === JSON.stringify(original.conditions);
    const opposite = after.claims.find((claim) => claim.active && claim.effect !== original.effect && matchesSameCondition(claim));
    const narrowed = after.claims.find((claim) => claim.active && claim.effect === original.effect && claim.conditions.length > original.conditions.length && original.conditions.every((condition) => claim.conditions.some((next) => next.kind === condition.kind && next.value === condition.value)));
    if (opposite && highConfidenceClaimErrors([{ ...opposite, confidence: .75 }], person) > 0) claimResolution = "overcorrected";
    else if (narrowed) claimResolution = "correctly_narrowed";
    else if (opposite) claimResolution = "correctly_replaced";
    else if (!same?.active) claimResolution = "correctly_removed";
    else claimResolution = "failed_to_update";
    outcome = claimResolution.startsWith("correctly_") && after.dossier.auc < before.dossier.auc - .05 ? "overcorrected" : claimResolution;
  }
  return {
    person: person.id, originalWrong, outcome, claimResolution,
    matchedCounterexamples: originalWrong ? matchedContradictions.length : 0,
    originalClaim: original,
    initialEvidence: evidence, contradictoryEvidence: contradictory,
    resultingClaims: after.claims.filter((claim) => claim.active),
    before: { auc: before.dossier.auc, top10: before.dossier.top10, claimCount: before.claimCount },
    after: { auc: after.dossier.auc, top10: after.dossier.top10, claimCount: after.claimCount },
    recommendationOverlap: before.dossier.top10.filter((id) => after.dossier.top10.includes(id)).length,
    scoreChanges: Object.fromEntries(before.dossier.top10.slice(0, 5).map((id) => [id, round((after.scores[id] ?? 0) - (before.scores[id] ?? 0))]))
  };
}

async function beliefTrials() {
  const scenarios = ["misleading_start", "claim_narrowing", "horror_exceptions", "franchise_exception", "director_exception"];
  const results = [];
  for (const id of scenarios) {
    const person = fixture.personas.find((entry) => entry.id === id);
    let initial, contradiction;
    if (["misleading_start", "claim_narrowing"].includes(id)) {
      initial = fixture.trainingKeys.filter((id) => byKey.get(id).title.startsWith("Philosophical signal") && person.ratings[id] > 0);
      contradiction = fixture.trainingKeys.filter((id) => byKey.get(id).genres.includes("Science Fiction") && person.ratings[id] < 0);
    } else if (id === "horror_exceptions") {
      initial = fixture.trainingKeys.filter((id) => byKey.get(id).genres.includes("Horror") && person.ratings[id] > 0);
      contradiction = fixture.trainingKeys.filter((id) => byKey.get(id).genres.includes("Horror") && person.ratings[id] < 0);
    } else if (id === "franchise_exception") {
      initial = fixture.trainingKeys.filter((id) => byKey.get(id).collection?.id === 8003 && person.ratings[id] > 0);
      contradiction = fixture.trainingKeys.filter((id) => byKey.get(id).collection?.id === 8003 && person.ratings[id] < 0);
    } else {
      initial = fixture.trainingKeys.filter((id) => byKey.get(id).directorIds.includes(6000) && person.ratings[id] > 0);
      contradiction = fixture.trainingKeys.filter((id) => byKey.get(id).directorIds.includes(6000) && person.ratings[id] < 0);
    }
    results.push(await beliefTrial(person, initial, contradiction));
  }
  return results;
}

async function calibrationTrials() {
  const seeds = [11, 29, 47];
  const sessions = [];
  for (const person of fixture.personas) for (const seed of seeds) {
    sessions.push(await session(person, seed, "active"));
    sessions.push(await session(person, seed, "reasonable_random"));
  }
  const byCount = {};
  for (const count of [5, 10, 20, 40]) {
    const active = sessions.filter((entry) => entry.strategy === "active").map((entry) => entry.snapshots[count].dossier.auc);
    const random = sessions.filter((entry) => entry.strategy === "reasonable_random").map((entry) => entry.snapshots[count].dossier.auc);
    byCount[count] = { active: distribution(active), reasonableRandom: distribution(random), pairedDelta: distribution(active.map((value, index) => value - random[index])) };
  }
  return { byCount, sessions: sessions.map(({ person, seed, strategy, observed, snapshots }) => ({ person, seed, strategy, asked: observed.map((entry) => entry.id), auc: Object.fromEntries([5, 10, 20, 40].map((count) => [count, snapshots[count].dossier.auc])) })) };
}

async function damageTrials() {
  const rows = [];
  for (const person of fixture.personas) {
    const order = trainingOrder(person, 29).slice(0, 20);
    const original = order.map((id) => suppliedRating(person, id));
    const permuted = shuffled(original, 500);
    const important = [...order].sort((a, b) => Math.abs(person.ratings[b]) - Math.abs(person.ratings[a])).slice(0, 10);
    const flipped = new Set(shuffled(order, 601).slice(0, 10));
    const contrary = new Set(order.filter((id) => person.ratings[id] > 0).slice(0, 5));
    const cases = [
      { name: "intact", ids: order, rating: (_, index) => original[index] },
      { name: "reversed_half", ids: order, rating: (id, index) => flipped.has(id) ? -original[index] : original[index] },
      { name: "randomized", ids: order, rating: (_, index) => permuted[index] },
      { name: "important_removed", ids: order.filter((id) => !important.includes(id)), rating: (id) => suppliedRating(person, id) },
      { name: "contradiction", ids: order, rating: (id, index) => contrary.has(id) ? -original[index] : original[index] },
      { name: "five_ratings", ids: order.slice(0, 5), rating: (id) => suppliedRating(person, id) }
    ];
    const scores = {};
    for (const scenario of cases) {
      const { call } = createClient();
      let revision = (await call("profile.create", { name: "Benchmark profile" })).revision;
      for (const [index, id] of scenario.ids.entries()) revision = (await takeRating(call, person, id, revision, scenario.rating(id, scenario.name === "important_removed" ? order.indexOf(id) : index))).revision;
      const ranking = await rankAll(call);
      scores[scenario.name] = assess(ranking.scores, holdout, person.ratings, ranking.rows.length > 0);
    }
    rows.push({ person: person.id, scores, damageDelta: Object.fromEntries(cases.slice(1).map((scenario) => [scenario.name, round(scores[scenario.name].auc - scores.intact.auc)])) });
  }
  const summary = Object.fromEntries(["reversed_half", "randomized", "important_removed", "contradiction", "five_ratings"].map((name) => {
    const deltas = rows.map((row) => row.damageDelta[name]);
    return [name, { deltaAuc: distribution(deltas), materiallyWorse: deltas.filter((delta) => delta <= -.05).length, unchangedOrBetter: deltas.filter((delta) => delta >= -.01).length, benchmarkSensitivityFlag: average(deltas) > -.03 }];
  }));
  return { summary, rows };
}

function failureReports(personas, sessions, calibration) {
  return personas.slice(0, 8).map((summary) => {
    const person = fixture.personas.find((entry) => entry.id === summary.id);
    const trial = sessions.find((entry) => entry.person === summary.id && entry.seed === 11);
    const snap = trial.snapshots[20];
    const scores = snap.scores;
    const mistakes = [...holdout].sort((a, b) => (scores[key(b)] ?? -999) - (scores[key(a)] ?? -999)).map((item, rank) => ({
      id: key(item), title: item.title, rank: rank + 1, score: scores[key(item)] ?? null,
      hiddenRating: person.ratings[key(item)], family: fixture.latent[key(item)].family
    })).filter((item) => (item.rank <= 10 && item.hiddenRating <= 0) || (item.rank >= holdout.length - 9 && item.hiddenRating > 0)).slice(0, 14);
    const calibrationPair = calibration.sessions.filter((entry) => entry.person === summary.id && entry.seed === 11);
    let suspectedLayer = "recommender or clustering";
    if (summary.id.includes("director") || summary.id.includes("franchise")) suspectedLayer = "structural claims or recommender";
    else if (["near_neighbour", "ending_sensitive", "craft_over_genre", "selective"].includes(summary.id)) suspectedLayer = "lens resolution";
    else if (calibrationPair.length === 2 && calibrationPair[0].auc[20] < calibrationPair[1].auc[20] - .05) suspectedLayer = "calibration question selection";
    return {
      id: summary.id, description: person.description, aucAt20: summary.dossierAt20,
      bestBaseline: summary.bestBaseline, suspectedLayer,
      receivedEvidence: trial.observed.slice(0, 20), heldoutCount: holdout.length,
      heldoutItems: holdout.map((item) => ({ id: key(item), title: item.title, hiddenRating: person.ratings[key(item)] })),
      inferredClaims: snap.claims, biggestErrors: mistakes,
      evidenceHurtSessions: summary.evidenceHurt
    };
  });
}

function compareReports(previous, current) {
  if (previous.fixtureHash !== current.fixtureHash) throw new Error("Benchmark fixture differs; results are not comparable");
  if (previous.evaluatorFingerprint !== current.evaluatorFingerprint || JSON.stringify(previous.seeds) !== JSON.stringify(current.seeds)) throw new Error("Evaluator or evidence seeds differ; create a new benchmark version");
  const prior = new Map(previous.personas.map((entry) => [entry.id, entry]));
  const changes = current.personas.map((entry) => ({ id: entry.id, deltaAuc20: round(entry.dossierAt20 - prior.get(entry.id).dossierAt20) })).sort((a, b) => a.deltaAuc20 - b.deltaAuc20);
  const priorDifficulty = [...previous.personas].sort((a, b) => a.dossierAt20 - b.dossierAt20);
  const hardest = new Set(priorDifficulty.slice(0, 6).map((entry) => entry.id));
  const easiest = new Set(priorDifficulty.slice(-6).map((entry) => entry.id));
  const deltaFor = (ids) => round(average(changes.filter((entry) => ids.has(entry.id)).map((entry) => entry.deltaAuc20)));
  const baselineOvertakesDossier = baselines.filter((name) => current.learning[20][name].auc.mean > current.learning[20].dossier.auc.mean);
  return {
    deltaMeanAuc20: round(current.learning[20].dossier.auc.mean - previous.learning[20].dossier.auc.mean),
    deltaColdAuc3: round(current.learning[3].dossier.auc.mean - previous.learning[3].dossier.auc.mean),
    deltaHit10At20: round(current.learning[20].dossier.precision10.mean - previous.learning[20].dossier.precision10.mean),
    deltaBeliefCorrectionRate: round(current.beliefCorrectionRate - previous.beliefCorrectionRate),
    deltaCalibrationAuc20: round(current.calibration.byCount[20].pairedDelta.mean - previous.calibration.byCount[20].pairedDelta.mean),
    deltaHardestSixAuc20: deltaFor(hardest),
    deltaEasiestSixAuc20: deltaFor(easiest),
    baselineOvertakesDossier,
    regressed: changes.filter((entry) => entry.deltaAuc20 < -.03),
    improved: changes.filter((entry) => entry.deltaAuc20 > .03),
    allPersonas: changes
  };
}

async function main() {
  assertFixture();
  const args = process.argv.slice(2);
  const value = (flag, fallback) => { const index = args.indexOf(flag); return index < 0 ? fallback : args[index + 1] ?? fallback; };
  const output = value("--output", "hard-benchmark-report.json");
  const html = value("--html", "hard-benchmark-report.html");
  const reference = value("--reference", "");
  if (args.includes("--belief-only")) {
    const belief = await beliefTrials();
    writeFileSync(output, JSON.stringify({ fixtureHash, belief }, null, 2) + "\n");
    process.stdout.write(JSON.stringify(belief.map(({ person, outcome, matchedCounterexamples, before, after }) => ({ person, outcome, matchedCounterexamples, beforeAuc: before?.auc, afterAuc: after?.auc }))) + "\n");
    return;
  }
  const sessions = [];
  for (const person of fixture.personas) for (const seed of seeds) {
    sessions.push(await session(person, seed));
    if (process.stderr.isTTY) process.stderr.write(`\rLearning sessions ${sessions.length}/${fixture.personas.length * seeds.length}`);
  }
  if (process.stderr.isTTY) process.stderr.write("\n");
  const learning = aggregateLearning(sessions);
  const personas = personaSummary(sessions);
  const belief = await beliefTrials();
  const calibration = await calibrationTrials();
  const damage = await damageTrials();
  const beliefCorrected = belief.filter((entry) => entry.originalWrong && entry.outcome.startsWith("correctly_")).length;
  const beliefEligible = belief.filter((entry) => entry.originalWrong).length;
  const report = {
    schemaVersion: 1, fixtureVersion: fixture.version, fixtureHash, evaluatorFingerprint, modelFingerprint, seeds, itemCount: items.length,
    trainingCount: fixture.trainingKeys.length, holdoutCount: fixture.holdoutKeys.length, personaCount: fixture.personas.length,
    methods: {
      primaryMetric: "macro mean held-out ranking AUC over people and evidence orders; neutral ratings excluded",
      nullRecommendationAuc: .5, top10EmptyScore: 0,
      independentTruth: "Explicit frozen rating tables derive from latent family, sincerity, ending, craft, director, collection and era rules. The adapter computes Dossier's lens from public genres, keywords and overview; only this public item metadata and selected training ratings cross the CLI action boundary.",
      predictionError: "1 - AUC is pairwise ranking error. Dossier scores are not calibrated ratings, so MAE is not reported.",
      confidenceError: "High-confidence claim error means an active claim with confidence at least 0.75 whose effect opposes mean held-out rating on at least three matching titles.",
      beliefTrial: "Belief trials select an active overbroad claim with at least five matching held-out titles, at least four held-out counterexamples, and a counterexample share of at least 40%."
    },
    legacyInvestigation: {
      oneRating: { dossierAuc: .98, simpleCosineAuc: .9917, top10Hits: 10, explanation: "The old easy oracle used the same feature axes as Dossier. A single liked Philosophical signal title ranked held-out likes almost perfectly by cosine similarity alone." },
      tenRatings: { top10Hits: 10, explanation: "The old held-out pool had 24 liked titles among 48 and repeated close feature families. A one-title similarity baseline already filled the top ten with liked titles." },
      avengersContradiction: { title: "Avengers: Infinity War", explanationScoreBefore: -.160521293504361, explanationScoreAfter: -.06809762641818962, top10Overlap: 10, claimCountBefore: 13, claimCountAfter: 12, explanation: "The rating changed claims and scores. The rated title was excluded from recommendations, and no other candidate crossed the top-ten boundary in that live CLI trace." }
    },
    learning, personas, belief, beliefCorrectionRate: beliefEligible ? round(beliefCorrected / beliefEligible) : null,
    calibration, damage,
    failures: failureReports(personas, sessions, calibration),
    sessions: sessions.map(({ person, seed, observed, snapshots }) => ({ person, seed, observed, snapshots })),
    comparison: null
  };
  if (reference) report.comparison = compareReports(JSON.parse(readFileSync(reference, "utf8")), report);
  writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  writeFileSync(html, renderHtml(report));
  process.stdout.write(JSON.stringify({ output, html, fixtureHash, meanAuc20: report.learning[20].dossier.auc.mean, bestBaselineAuc20: Math.max(...baselines.map((name) => report.learning[20][name].auc.mean)), beliefCorrectionRate: report.beliefCorrectionRate, calibrationDelta20: report.calibration.byCount[20].pairedDelta.mean, damage: report.damage.summary, comparison: report.comparison }) + "\n");
}

main().catch((error) => { process.stderr.write(`${error.stack ?? error}\n`); process.exitCode = 1; });
