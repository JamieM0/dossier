import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { featureVector, matchesTasteClaim, scoreCandidates, DEFAULT_SCORING_PARAMS, buildTasteSpace } from "@dossier/domain";
import { execute } from "../dist/actions.js";
import { average, baselineScores, cosine, distribution, key, round, shuffled } from "./hard-metrics.mjs";
import { assessReal as assess, meanInterval } from "./real-metrics.mjs";
import { componentScores, componentDefinitions, aggregateComponents, diagnoseLearning } from "./study-metrics.mjs";

const flags = process.argv.slice(2);
const flagValue = (name, fallback) => flags.includes(name) ? flags[flags.indexOf(name) + 1] : fallback;
const fixturePath = flagValue("--fixture", "apps/dossier-cli/src/lab/real-tmdb-v1.json");
const fixtureBytes = readFileSync(fixturePath);
const fixture = JSON.parse(fixtureBytes);
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const fingerprint = (paths) => sha256(Buffer.concat(paths.flatMap((path) => [Buffer.from(path + "\n"), readFileSync(new URL(path, import.meta.url))])));
const fixtureHash = sha256(fixtureBytes);
const evaluatorFingerprint = fingerprint(["./study-run.mjs", "./study-metrics.mjs", "./hard-metrics.mjs", "./real-metrics.mjs", "./generate-real-benchmark.py"]);
const domainModules = readdirSync(new URL("../../../packages/domain/dist/", import.meta.url), { recursive: true })
  .filter((path) => path.endsWith(".js") && !path.endsWith(".test.js")).sort().map((path) => `../../../packages/domain/dist/${path}`);
const modelFingerprint = fingerprint([...domainModules, "../dist/actions.js", "../dist/storage.js"]);
const items = fixture.items.map(({ source: _source, ...item }) => ({ ...item, features: featureVector({ genres: item.genres, keywords: item.keywords, overview: item.overview }) }));
const byKey = new Map(items.map((item) => [key(item), item]));
const viewers = fixture.viewers.map((viewer) => ({
  ...viewer,
  training: new Map(viewer.trainingRatings.map((row) => [row.filmKey, row])),
  heldOut: new Map(viewer.heldOutRatings.map((row) => [row.filmKey, row])),
  holdoutItems: viewer.heldOutRatings.map((row) => byKey.get(row.filmKey)),
  truth: Object.fromEntries(viewer.heldOutRatings.map((row) => [row.filmKey, row.rating]))
}));
const checkpoints = [1, 3, 5, 10, 20, 40];
const seeds = [11, 29, 47, 83];
const baselines = ["public_rating", "popularity", "genre", "vector", "nearest", "community", "random"];

function assertFixture() {
  if (!(["real-v1", "real-tmdb-v1"].includes(fixture.version)) || viewers.length !== 31 || items.length !== 1736) throw new Error("real-v1 cohort changed; create a new version");
  for (const viewer of viewers) {
    if (viewer.heldOut.size !== 60 || viewer.training.size < 40) throw new Error(`Invalid split for ${viewer.id}`);
    if ([...viewer.heldOut.keys()].some((id) => viewer.training.has(id))) throw new Error(`Training and held-out overlap for ${viewer.id}`);
    if ([...viewer.training.keys(), ...viewer.heldOut.keys()].some((id) => !byKey.has(id))) throw new Error(`Missing film for ${viewer.id}`);
    if (viewer.heldOutRatings.filter((row) => row.rating > 0).length < 12 || viewer.heldOutRatings.filter((row) => row.rating < 0).length < 12) throw new Error(`Underpowered held-out set for ${viewer.id}`);
  }
  if (fixture.items.some((item) => "rating" in item || "features" in item || "hiddenRating" in item)) throw new Error("Public film metadata contains hidden truth or precomputed lens vectors");
}

function createClient(viewer) {
  let vault = { activeId: null, profiles: [] };
  const storage = { root: "/offline-real-benchmark", load: () => vault, save: (next) => { vault = next; }, audit: () => {} };
  const publicCatalogue = {
    detail: async (medium, id) => {
      const item = byKey.get(`${medium}:${id}`);
      if (!item) throw new Error(`Unknown film ${medium}:${id}`);
      return item;
    },
    candidates: async (medium, kind) => (kind === "suggest" ? viewer.holdoutItems : [...viewer.training.keys()].map((id) => byKey.get(id))).filter((item) => item.medium === medium)
  };
  return { call: (action, args = {}) => execute(storage, action, args, publicCatalogue), getVault: () => vault };
}

async function rankAll(call, count) {
  const rows = [];
  let cursor;
  do {
    const page = await call("suggest.list", { limit: 20, ...(cursor ? { cursor } : {}) });
    rows.push(...page.items);
    cursor = page.next;
  } while (cursor && rows.length < count);
  if (rows.length > count) throw new Error("CLI recommended too many held-out films");
  return { rows, scores: Object.fromEntries(rows.map((row) => [row.id, row.score ?? 0])) };
}

async function claimsAll(call) {
  const page = await call("taste.claims", { limit: 100 });
  return Promise.all(page.items.map(async ({ id }) => (await call("taste.claim.inspect", { id })).claim));
}

function claimErrors(claims, viewer) {
  return claims.filter((claim) => {
    if (!claim.active || claim.confidence < .75) return false;
    const matched = viewer.holdoutItems.filter((item) => matchesTasteClaim(item, claim));
    if (matched.length < 3) return false;
    const mean = average(matched.map((item) => viewer.truth[key(item)]));
    return claim.effect === "positive" ? mean < -.5 : mean > .5;
  }).length;
}

function baseline(name, viewer, observed, seed) {
  if (name === "public_rating") return Object.fromEntries(viewer.holdoutItems.map((item) => [key(item), item.voteAverage ?? 0]));
  if (name === "community") return Object.fromEntries(viewer.heldOutRatings.map((row) => [row.filmKey, row.otherViewerMean]));
  return baselineScores(name, observed.map((row) => ({ item: byKey.get(row.filmKey), rating: row.suppliedRating })), viewer.holdoutItems, seed);
}

async function snapshot(call, viewer, observed, seed, inspect = false, vault) {
  const recommendations = await rankAll(call, viewer.holdoutItems.length);
  const dossier = assess(recommendations.scores, viewer.holdoutItems, viewer.truth, recommendations.rows.length > 0);
  const baselinesScored = Object.fromEntries(baselines.map((name) => [name, assess(baseline(name, viewer, observed, seed), viewer.holdoutItems, viewer.truth)]));
  const claims = await claimsAll(call);
  const state = vault?.profiles[0].state;
  const components = state ? componentScores(viewer.holdoutItems, Object.values(state.ratings), state.tasteClaims).map(({ name, scores, available }) => {
    if (name === "current") {
      if (JSON.stringify(Object.keys(scores).sort()) !== JSON.stringify(Object.keys(recommendations.scores).sort()) || Object.keys(scores).some(id => Math.abs(scores[id] - recommendations.scores[id]) > 1e-12)) throw new Error("CLI and component scorer disagree");
    }
    return [name, { ...assess(scores, viewer.holdoutItems, viewer.truth, available), ...(inspect ? { scores } : {}) }];
  }) : [];
  return { dossier, components: Object.fromEntries(components), baselines: baselinesScored, highConfidenceClaimErrors: claimErrors(claims, viewer),
    claimCount: claims.filter((claim) => claim.active).length,
    ...(inspect ? { claims, scores: recommendations.scores } : {}) };
}

function trainingOrder(viewer, seed) { return shuffled([...viewer.training.keys()], seed + viewer.sourceUserId * 1009); }

async function takeRating(call, viewer, filmKey, revision, override) {
  if (!viewer.training.has(filmKey)) throw new Error(`Held-out rating reached CLI: ${viewer.id} ${filmKey}`);
  const row = viewer.training.get(filmKey);
  const suppliedRating = override ?? row.rating;
  const result = await call("rate.set", { key: filmKey, value: suppliedRating, expectedRevision: revision });
  return { revision: result.revision, evidence: { filmKey, title: byKey.get(filmKey).title, stars: row.stars, suppliedRating } };
}

async function session(viewer, seed, strategy = "random") {
  const { call, getVault } = createClient(viewer);
  let revision = (await call("profile.create", { name: "Benchmark viewer" })).revision;
  const observed = [];
  const order = trainingOrder(viewer, seed);
  const popularity = order.map((id) => byKey.get(id).popularity ?? 0).sort((a, b) => a - b);
  const threshold = popularity[Math.floor(popularity.length * .25)];
  const reasonable = shuffled(order.filter((id) => (byKey.get(id).popularity ?? 0) >= threshold), seed + 910);
  const snapshots = {};
  for (let count = 1; count <= 40; count++) {
    let id;
    let selection = "seed_order";
    if (count > 5 && strategy === "active") {
      const questions = await call("rate.queue", { mode: "active", limit: 1 });
      id = questions.items.find((item) => viewer.training.has(item.id) && !observed.some((entry) => entry.filmKey === item.id))?.id;
      if (id) selection = "dossier_question";
    } else if (count > 5 && strategy === "reasonable_random") {
      id = reasonable.find((candidate) => !observed.some((entry) => entry.filmKey === candidate));
      if (id) selection = "random_reasonable";
    }
    id ??= order.find((candidate) => !observed.some((entry) => entry.filmKey === candidate));
    if (!id) throw new Error(`Training pool exhausted for ${viewer.id}`);
    const rated = await takeRating(call, viewer, id, revision);
    revision = rated.revision;
    observed.push({ ...rated.evidence, selection });
    if (checkpoints.includes(count)) snapshots[count] = await snapshot(call, viewer, observed, seed, [10, 20, 40].includes(count), getVault());
  }
  if (Object.keys(getVault().profiles[0].state.ratings).some((id) => viewer.heldOut.has(id))) throw new Error(`Leakage for ${viewer.id}`);
  return { viewer: viewer.id, seed, strategy, observed, snapshots };
}

function aggregateLearning(sessions) {
  return Object.fromEntries(checkpoints.map((count) => [count, Object.fromEntries(["dossier", ...baselines].map((name) => {
    const rows = sessions.map((session) => name === "dossier" ? session.snapshots[count].dossier : session.snapshots[count].baselines[name]);
    return [name, {
      auc: distribution(rows.map((row) => row.auc)),
      similarPublicRatingAuc: distribution(rows.filter((row) => row.similarPublicRatingAuc != null).map((row) => row.similarPublicRatingAuc)),
      similarPublicRatingPairs: distribution(rows.map((row) => row.similarPublicRatingPairs)),
      precision10: distribution(rows.map((row) => row.precision10)),
      ndcg10: distribution(rows.map((row) => row.ndcg10)),
      coverage: distribution(rows.map((row) => row.coverage)),
      highRankMistakes: distribution(rows.map((row) => row.highRankMistakes)),
      ...(name === "dossier" ? { highConfidenceClaimMistakes: distribution(sessions.map((session) => session.snapshots[count].highConfidenceClaimErrors)) } : {})
    }];
  }))]));
}

function viewerSummary(sessions) {
  return viewers.map((viewer) => {
    const own = sessions.filter((session) => session.viewer === viewer.id);
    const byCheckpoint = Object.fromEntries(checkpoints.map((count) => [count, {
      auc: distribution(own.map((session) => session.snapshots[count].dossier.auc)),
      precision10: distribution(own.map((session) => session.snapshots[count].dossier.precision10))
    }]));
    const bestFairBaseline = ["public_rating", "popularity", "genre", "vector", "nearest", "random"]
      .map((name) => ({ name, auc: average(own.map((session) => session.snapshots[20].baselines[name].auc)) }))
      .sort((a, b) => b.auc - a.auc)[0];
    return {
      id: viewer.id,
      ratedFilms: viewer.training.size + viewer.heldOut.size,
      heldOutLikes: viewer.heldOutRatings.filter((row) => row.rating > 0).length,
      heldOutDislikes: viewer.heldOutRatings.filter((row) => row.rating < 0).length,
      byCheckpoint, bestFairBaseline,
      dossierAt20: byCheckpoint[20].auc.mean,
      gapToBestFairBaseline: round(byCheckpoint[20].auc.mean - bestFairBaseline.auc),
      evidenceHurt: own.filter((session) => session.snapshots[40].dossier.auc < session.snapshots[10].dossier.auc - .03).length
    };
  }).sort((a, b) => a.dossierAt20 - b.dossierAt20);
}

async function calibrationTrials() {
  const pairs = [];
  for (const viewer of viewers) for (const seed of [11, 29]) {
    const active = await session(viewer, seed, "active");
    const random = await session(viewer, seed, "reasonable_random");
    pairs.push({ viewer: viewer.id, seed,
      activeQuestions: active.observed.slice(5).map((row) => row.filmKey),
      activeChosenCount: active.observed.slice(5).filter((row) => row.selection === "dossier_question").length,
      randomQuestions: random.observed.slice(5).map((row) => row.filmKey),
      active: Object.fromEntries([5, 10, 20, 40].map((count) => [count, active.snapshots[count].dossier.auc])),
      random: Object.fromEntries([5, 10, 20, 40].map((count) => [count, random.snapshots[count].dossier.auc])) });
  }
  const byCount = Object.fromEntries([5, 10, 20, 40].map((count) => [count, {
    active: distribution(pairs.map((pair) => pair.active[count])),
    reasonableRandom: distribution(pairs.map((pair) => pair.random[count])),
    pairedDelta: distribution(pairs.map((pair) => pair.active[count] - pair.random[count]))
  }]));
  return { byCount, activeChosenAfterFive: distribution(pairs.map((pair) => pair.activeChosenCount)), pairs };
}

async function scoreEvidence(viewer, evidence) {
  const { call } = createClient(viewer);
  let revision = (await call("profile.create", { name: "Benchmark viewer" })).revision;
  for (const row of evidence) revision = (await takeRating(call, viewer, row.filmKey, revision, row.rating)).revision;
  const ranking = await rankAll(call, viewer.holdoutItems.length);
  return assess(ranking.scores, viewer.holdoutItems, viewer.truth, ranking.rows.length > 0);
}

async function damageTrials() {
  const rows = [];
  for (const viewer of viewers) {
    const ids = trainingOrder(viewer, 29).slice(0, 20);
    const original = ids.map((filmKey) => ({ filmKey, rating: viewer.training.get(filmKey).rating }));
    const reversed = new Set(shuffled(ids, 601).slice(0, 10));
    const important = new Set([...original].sort((a, b) => Math.abs(b.rating) - Math.abs(a.rating)).slice(0, 10).map((row) => row.filmKey));
    const contrary = new Set(original.filter((row) => row.rating > 0).slice(0, 5).map((row) => row.filmKey));
    const permuted = shuffled(original.map((row) => row.rating), 500);
    const cases = {
      intact: original,
      reversed_half: original.map((row) => ({ ...row, rating: reversed.has(row.filmKey) ? -row.rating : row.rating })),
      randomized: original.map((row, index) => ({ ...row, rating: permuted[index] })),
      important_removed: original.filter((row) => !important.has(row.filmKey)),
      contradiction: original.map((row) => ({ ...row, rating: contrary.has(row.filmKey) ? -row.rating : row.rating })),
      five_ratings: original.slice(0, 5)
    };
    const scores = {};
    for (const [name, evidence] of Object.entries(cases)) scores[name] = await scoreEvidence(viewer, evidence);
    rows.push({ viewer: viewer.id, scores, delta: Object.fromEntries(Object.keys(cases).filter((name) => name !== "intact").map((name) => [name, round(scores[name].auc - scores.intact.auc)])) });
  }
  const names = ["reversed_half", "randomized", "important_removed", "contradiction", "five_ratings"];
  return { rows, summary: Object.fromEntries(names.map((name) => {
    const deltas = rows.map((row) => row.delta[name]);
    return [name, { deltaAuc: distribution(deltas), materiallyWorse: deltas.filter((value) => value <= -.05).length,
      unchangedOrBetter: deltas.filter((value) => value >= -.01).length,
      benchmarkSensitivityFlag: average(deltas) > -.03 }];
  })) };
}

function broadWrongClaim(claim, viewer) {
  if (!claim.active) return false;
  const matched = viewer.holdoutItems.filter((item) => matchesTasteClaim(item, claim) && viewer.truth[key(item)] !== 0);
  if (matched.length < 5) return false;
  const counter = matched.filter((item) => claim.effect === "positive" ? viewer.truth[key(item)] < 0 : viewer.truth[key(item)] > 0);
  return counter.length >= 4 && counter.length / matched.length >= .4;
}

async function beliefTrial(viewer) {
  const genres = [...new Set([...viewer.training.keys()].flatMap((id) => byKey.get(id).genres))];
  const possible = genres.map((genre) => ({
    genre,
    likes: [...viewer.training.keys()].filter((id) => byKey.get(id).genres.includes(genre) && viewer.training.get(id).rating > 0),
    dislikes: [...viewer.training.keys()].filter((id) => byKey.get(id).genres.includes(genre) && viewer.training.get(id).rating < 0)
  })).filter((row) => row.likes.length >= 5 && row.dislikes.length >= 8)
    .sort((a, b) => b.dislikes.length - a.dislikes.length || a.genre.localeCompare(b.genre));
  if (!possible.length) return { viewer: viewer.id, outcome: "not_eligible" };
  const chosen = possible[0];
  const initialIds = shuffled(chosen.likes, 400 + viewer.sourceUserId).slice(0, 5);
  const { call } = createClient(viewer);
  let revision = (await call("profile.create", { name: "Benchmark viewer" })).revision;
  const initialEvidence = [];
  for (const id of initialIds) { const rated = await takeRating(call, viewer, id, revision); revision = rated.revision; initialEvidence.push(rated.evidence); }
  const before = await snapshot(call, viewer, initialEvidence, 29, true);
  const candidates = before.claims.filter((claim) => broadWrongClaim(claim, viewer)).map((claim) => ({
    claim,
    counter: [...viewer.training.keys()].filter((id) => !initialIds.includes(id) && matchesTasteClaim(byKey.get(id), claim) &&
      (claim.effect === "positive" ? viewer.training.get(id).rating < 0 : viewer.training.get(id).rating > 0))
  })).filter((row) => row.counter.length >= 4).sort((a, b) => b.claim.confidence - a.claim.confidence);
  const selected = candidates[0];
  if (!selected) return { viewer: viewer.id, genre: chosen.genre, outcome: "no_false_claim_formed", initialEvidence, initialClaims: before.claims.filter((claim) => claim.active) };
  const contradictoryEvidence = [];
  for (const id of shuffled(selected.counter, 900 + viewer.sourceUserId).slice(0, 8)) {
    const rated = await takeRating(call, viewer, id, revision); revision = rated.revision; contradictoryEvidence.push(rated.evidence);
  }
  const after = await snapshot(call, viewer, [...initialEvidence, ...contradictoryEvidence], 29, true);
  const claim = selected.claim;
  const same = after.claims.find((next) => next.id === claim.id);
  const sameConditions = (next) => JSON.stringify(next.conditions) === JSON.stringify(claim.conditions);
  const opposite = after.claims.find((next) => next.active && next.effect !== claim.effect && sameConditions(next));
  const narrowed = after.claims.find((next) => next.active && next.effect === claim.effect && next.conditions.length > claim.conditions.length && claim.conditions.every((condition) => next.conditions.some((other) => other.kind === condition.kind && other.value === condition.value)));
  let claimResolution = narrowed ? "correctly_narrowed" : opposite ? "correctly_replaced" : !same?.active ? "correctly_removed" : "failed_to_update";
  if (opposite && claimErrors([{ ...opposite, confidence: .75 }], viewer) > 0) claimResolution = "overcorrected";
  const outcome = claimResolution.startsWith("correctly_") && after.dossier.auc < before.dossier.auc - .05 ? "overcorrected" : claimResolution;
  return { viewer: viewer.id, genre: chosen.genre, outcome, claimResolution,
    originalClaim: claim, initialEvidence, contradictoryEvidence,
    resultingClaims: after.claims.filter((entry) => entry.active),
    before: { auc: before.dossier.auc, top10: before.dossier.top10 },
    after: { auc: after.dossier.auc, top10: after.dossier.top10 },
    recommendationOverlap: before.dossier.top10.filter((id) => after.dossier.top10.includes(id)).length };
}

function failureReports(summaries, sessions) {
  return summaries.slice(0, 8).map((summary) => {
    const viewer = viewers.find((entry) => entry.id === summary.id);
    const trial = sessions.find((entry) => entry.viewer === summary.id && entry.seed === 11);
    const snap = trial.snapshots[20];
    const ordered = [...viewer.holdoutItems].sort((a, b) => (snap.scores[key(b)] ?? -999) - (snap.scores[key(a)] ?? -999));
    const mistakes = ordered.map((item, index) => ({ title: item.title, filmKey: key(item), rank: index + 1,
      stars: viewer.heldOut.get(key(item)).stars, rating: viewer.truth[key(item)], score: snap.scores[key(item)] ?? null }))
      .filter((row) => (row.rank <= 10 && row.rating < 0) || (row.rank >= 51 && row.rating > 0)).slice(0, 14);
    const contradictedClaims = snap.claims.filter((claim) => claim.active).map((claim) => {
      const matched = viewer.holdoutItems.filter((item) => matchesTasteClaim(item, claim) && viewer.truth[key(item)] !== 0);
      const counter = matched.filter((item) => claim.effect === "positive" ? viewer.truth[key(item)] < 0 : viewer.truth[key(item)] > 0);
      return { claim, matchedCount: matched.length, counterexampleCount: counter.length,
        counterexamples: counter.slice(0, 5).map((item) => ({ title: item.title, stars: viewer.heldOut.get(key(item)).stars })) };
    }).filter((row) => row.matchedCount >= 3 && row.counterexampleCount / row.matchedCount >= .4)
      .sort((a, b) => b.claim.confidence - a.claim.confidence).slice(0, 4);
    const conflictingStylePairs = [];
    for (const liked of viewer.holdoutItems.filter((item) => viewer.truth[key(item)] > 0)) {
      for (const disliked of viewer.holdoutItems.filter((item) => viewer.truth[key(item)] < 0)) {
        const similarity = cosine(liked.features, disliked.features);
        if (similarity >= .95) conflictingStylePairs.push({ liked: liked.title, disliked: disliked.title, similarity: round(similarity) });
      }
    }
    conflictingStylePairs.sort((a, b) => b.similarity - a.similarity);
    return { viewer: summary.id, aucAt20: summary.dossierAt20, bestFairBaseline: summary.bestFairBaseline,
      receivedEvidence: trial.observed.slice(0, 20), heldOutRatings: viewer.heldOutRatings.map((row) => ({ ...row, title: byKey.get(row.filmKey).title })),
      inferredClaims: snap.claims.filter((claim) => claim.active), biggestErrors: mistakes,
      diagnosticClues: {
        neutralTrainingRatings: trial.observed.slice(0, 20).filter((row) => row.suppliedRating === 0).length,
        contradictedClaims, conflictingStylePairCount: conflictingStylePairs.length,
        conflictingStyleExamples: conflictingStylePairs.slice(0, 4)
      },
      evidenceHurtSessions: summary.evidenceHurt };
  });
}

function compareReports(previous, current) {
  if (previous.fixtureHash !== current.fixtureHash || previous.evaluatorFingerprint !== current.evaluatorFingerprint || JSON.stringify(previous.seeds) !== JSON.stringify(current.seeds)) throw new Error("Real benchmark fixture or procedure changed; create a new version");
  const old = new Map(previous.viewers.map((row) => [row.id, row]));
  const changes = current.viewers.map((row) => ({ id: row.id, deltaAuc20: round(row.dossierAt20 - old.get(row.id).dossierAt20) }));
  return { deltaAuc20: round(current.learning[20].dossier.auc.mean - previous.learning[20].dossier.auc.mean),
    deltaAuc3: round(current.learning[3].dossier.auc.mean - previous.learning[3].dossier.auc.mean),
    deltaTop10: round(current.learning[20].dossier.precision10.mean - previous.learning[20].dossier.precision10.mean),
    deltaBeliefCorrection: current.beliefCorrectionRate == null || previous.beliefCorrectionRate == null ? null : round(current.beliefCorrectionRate - previous.beliefCorrectionRate),
    deltaQuestionBenefit20: round(current.calibration.byCount[20].pairedDelta.mean - previous.calibration.byCount[20].pairedDelta.mean),
    baselinesAhead: baselines.filter((name) => current.learning[20][name].auc.mean > current.learning[20].dossier.auc.mean),
    improved: changes.filter((row) => row.deltaAuc20 > .03), regressed: changes.filter((row) => row.deltaAuc20 < -.03), allViewers: changes };
}

async function main() {
  assertFixture();
  const args = process.argv.slice(2);
  const value = (flag, fallback) => { const index = args.indexOf(flag); return index < 0 ? fallback : args[index + 1] ?? fallback; };
  const output = value("--output", "reports/dossier-real-tmdb-v1-study.json");
  
  const reference = value("--reference", "");
  const sessions = [];
  for (const viewer of viewers) for (const seed of seeds) {
    sessions.push(await session(viewer, seed));
    if (sessions.length % 8 === 0) process.stderr.write(`Learning sessions ${sessions.length}/${viewers.length * seeds.length}\n`);
  }
  const learning = aggregateLearning(sessions);
  const viewerSummaries = viewerSummary(sessions);
  const belief = [];
  for (const viewer of viewers) belief.push(await beliefTrial(viewer));
  process.stderr.write(`Belief trials ${belief.length}\n`);
  const calibration = await calibrationTrials();
  process.stderr.write(`Calibration pairs ${calibration.pairs.length}\n`);
  const damage = await damageTrials();
  process.stderr.write(`Damage trials ${damage.rows.length}\n`);
  const eligibleBeliefs = belief.filter((row) => row.originalClaim);
  const viewerMean = (viewer, count, name) => average(sessions.filter((session) => session.viewer === viewer.id).map((session) => name === "dossier" ? session.snapshots[count].dossier.auc : session.snapshots[count].baselines[name].auc));
  const uncertainty = {
    auc20: meanInterval(viewers.map((viewer) => viewerMean(viewer, 20, "dossier"))),
    gapToPublicRating20: meanInterval(viewers.map((viewer) => viewerMean(viewer, 20, "dossier") - viewerMean(viewer, 20, "public_rating"))),
    learningFiveToForty: meanInterval(viewers.map((viewer) => viewerMean(viewer, 40, "dossier") - viewerMean(viewer, 5, "dossier"))),
    questionBenefit40: meanInterval(viewers.map((viewer) => average(calibration.pairs.filter((pair) => pair.viewer === viewer.id).map((pair) => pair.active[40] - pair.random[40])))),
    questionBenefit20: meanInterval(viewers.map((viewer) => average(calibration.pairs.filter((pair) => pair.viewer === viewer.id).map((pair) => pair.active[20] - pair.random[20]))))
  };
  const report = {
    schemaVersion: 1, fixtureVersion: fixture.version, fixtureHash, evaluatorFingerprint, modelFingerprint, seeds,
    sources: fixture.sources, selection: fixture.selection, filmCount: items.length, viewerCount: viewers.length, heldOutPerViewer: 60,
    methods: {
      primary: "Mean held-out AUC across viewers and four training orders. Clear likes are 4+ stars and clear dislikes are 2.5 stars or less; 3 and 3.5 stars are neutral.",
      top10: "Share of the first ten suggested films that this viewer clearly liked. Compare with that viewer's held-out like share.",
      training: "Only selected training ratings cross the CLI rate.set boundary. Held-out ratings and MovieLens identity stay in the evaluator.",
      baselines: "Public film rating, public popularity, genre, average lens vector, nearest liked film, other-viewer mean, and random ranking. Other-viewer mean has extra information unavailable to Dossier.",
      limitations: fixture.selection.caveat
    },
    componentDefinitions, components: aggregateComponents(sessions, checkpoints), learningDiagnostics: diagnoseLearning(sessions, viewers, byKey), learning, uncertainty, viewers: viewerSummaries, belief,
    beliefCorrectionRate: eligibleBeliefs.length ? round(eligibleBeliefs.filter((row) => row.outcome.startsWith("correctly_")).length / eligibleBeliefs.length) : null,
    calibration, damage, failures: failureReports(viewerSummaries, sessions),
    sessions: sessions.map(({ viewer, seed, observed, snapshots }) => ({ viewer, seed, observed, snapshots })),
    comparison: null
  };
  if (reference) report.comparison = compareReports(JSON.parse(readFileSync(reference, "utf8")), report);
  writeFileSync(output, JSON.stringify(report, null, 2) + "\n");

  process.stdout.write(JSON.stringify({ output, viewerCount: viewers.length,
    components20: report.components[20], auc20: learning[20].dossier.auc.mean,
    bestSameInformationBaseline20: Math.max(...baselines.filter((name) => name !== "community").map((name) => learning[20][name].auc.mean)),
    community20: learning[20].community.auc.mean,
    calibrationDelta20: calibration.byCount[20].pairedDelta.mean,
    beliefCorrectionRate: report.beliefCorrectionRate,
    damage: damage.summary }) + "\n");
}

main().catch((error) => { process.stderr.write(`${error.stack ?? error}\n`); process.exitCode = 1; });
