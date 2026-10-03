import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import {
  buildTasteSpace,
  featureVector,
  reconcileTasteClaims
} from "@dossier/domain";
import { execute } from "../dist/actions.js";
import { assessReal, meanInterval } from "./real-metrics.mjs";
import { average, distribution, key, round, shuffled } from "./hard-metrics.mjs";

const args = process.argv.slice(2);
const value = (flag, fallback) => args.includes(flag) ? args[args.indexOf(flag) + 1] : fallback;
const output = value("--output", "reports/stable-geometry-v1.json");
const requestedPermutations = Number(value("--permutations", "24"));
const maxViewers = Number(value("--max-viewers", "0"));
if (!Number.isSafeInteger(requestedPermutations) || requestedPermutations < 2) throw new Error("permutations must be an integer of at least 2");
if (!Number.isSafeInteger(maxViewers) || maxViewers < 0) throw new Error("max-viewers must be a non-negative integer");

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const readJson = (url) => JSON.parse(readFileSync(url));
const protocolUrl = new URL("../benchmarks/stable-geometry-v1-protocol.json", import.meta.url);
const protocol = readJson(protocolUrl);
const fixtureUrls = {
  original: new URL("../src/lab/real-tmdb-v1.json", import.meta.url),
  confirmation: new URL("../src/lab/new-viewers-v1.json", import.meta.url),
  override: new URL("../src/lab/override-viewers-v1.json", import.meta.url)
};
const diagnosisUrl = new URL("../../../reports/backwards-learning-diagnosis-v1.json", import.meta.url);
const diagnosis = readJson(diagnosisUrl);
for (const [name, url] of Object.entries(fixtureUrls)) {
  if (hash(readFileSync(url)) !== protocol.fixtures[name]) throw new Error(`Frozen ${name} fixture changed; create a new protocol version`);
}
if (hash(readFileSync(diagnosisUrl)) !== protocol.diagnosisHash) throw new Error("Frozen backwards-learning diagnosis changed; create a new protocol version");
if (requestedPermutations !== protocol.permutations && maxViewers === 0) throw new Error("A full run must use the protocol permutation count");

const fixtures = Object.fromEntries(Object.entries(fixtureUrls).map(([name, url]) => [name, readJson(url)]));
if (Object.values(fixtures).some((fixture) => JSON.stringify(fixture.items) !== JSON.stringify(fixtures.original.items))) {
  throw new Error("Frozen cohorts use different public catalogues");
}
const items = fixtures.original.items.map(({ source: _source, ...item }) => ({ ...item, features: featureVector(item) }));
const byKey = new Map(items.map((item) => [key(item), item]));
const strategies = protocol.strategies;
const checkpoints = protocol.checkpoints;
const viewers = Object.entries(fixtures).flatMap(([cohort, fixture]) => fixture.viewers.map((viewer) => ({ ...viewer, cohort })));
const selectedViewers = maxViewers > 0 ? viewers.slice(0, maxViewers) : viewers;

const modulePaths = readdirSync(new URL("../../../packages/domain/dist/", import.meta.url), { recursive: true })
  .filter((path) => path.endsWith(".js") && !path.endsWith(".test.js"))
  .sort()
  .map((path) => `../../../packages/domain/dist/${path}`);
const fingerprint = (paths) => hash(Buffer.concat(paths.flatMap((path) => [Buffer.from(path + "\n"), readFileSync(new URL(path, import.meta.url))])));
const modelFingerprint = fingerprint([...modulePaths, "../dist/actions.js", "../dist/storage.js"]);
const evaluatorFingerprint = fingerprint(["./geometry-run.mjs", "./real-metrics.mjs", "./hard-metrics.mjs"]);

function client(candidates) {
  let vault = { activeId: null, profiles: [] };
  const storage = { root: "/stable-geometry-experiment", load: () => vault, save: (next) => { vault = next; }, audit: () => {} };
  const catalogue = {
    detail: async (medium, id) => byKey.get(`${medium}:${id}`),
    candidates: async (_medium, kind) => kind === "suggest" ? candidates : []
  };
  return { call: (action, actionArgs = {}) => execute(storage, action, actionArgs, catalogue), state: () => vault.profiles[0].state };
}

async function rankAll(call, candidateCount, geometry) {
  const rows = [];
  let cursor;
  do {
    const page = await call("suggest.list", { limit: 20, geometry, ...(cursor ? { cursor } : {}) });
    rows.push(...page.items);
    cursor = page.next;
  } while (cursor && rows.length < candidateCount);
  return rows;
}

function rounded(value) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function profileSignature(entries, storedClaims, clusterStrategy) {
  const space = buildTasteSpace(entries, { clusterStrategy });
  const claims = clusterStrategy === "greedy"
    ? storedClaims
    : reconcileTasteClaims(entries, storedClaims, space);
  return JSON.stringify({
    clusters: space.clusters.map((cluster) => ({
      polarity: cluster.polarity,
      members: cluster.supportingRatings.map((rating) => rating.itemKey).sort(),
      centroid: Object.fromEntries(Object.entries(cluster.centroid).map(([axis, score]) => [axis, rounded(score)])),
      confidence: rounded(cluster.confidence)
    })).sort((a, b) => JSON.stringify(a.members).localeCompare(JSON.stringify(b.members))),
    claims: claims.filter((claim) => claim.active).map((claim) => ({ id: claim.id, confidence: rounded(claim.confidence) }))
      .sort((a, b) => a.id.localeCompare(b.id))
  });
}

function scoreSignature(rows) {
  return JSON.stringify(rows.map((row) => [row.id, row.score]));
}

async function permutationSession(viewer, permutation) {
  const training = new Map(viewer.trainingRatings.map((row) => [row.filmKey, row]));
  const heldOut = new Set(viewer.heldOutRatings.map((row) => row.filmKey));
  const candidates = viewer.heldOutRatings.map((row) => byKey.get(row.filmKey));
  const truth = Object.fromEntries(viewer.heldOutRatings.map((row) => [row.filmKey, row.rating]));
  const base = shuffled([...training.keys()], 11 + viewer.sourceUserId * 1009).slice(0, 40);
  const order = shuffled(base, 10_000 + permutation * 101 + viewer.sourceUserId * 997);
  const { call, state } = client(candidates);
  let revision = (await call("profile.create", { name: "Stable geometry viewer" })).revision;
  const snapshots = {};
  for (let count = 1; count <= 40; count++) {
    const filmKey = order[count - 1];
    if (!training.has(filmKey) || heldOut.has(filmKey)) throw new Error("Hidden evidence reached the CLI");
    revision = (await call("rate.set", { key: filmKey, value: training.get(filmKey).rating, expectedRevision: revision })).revision;
    if (!checkpoints.includes(count)) continue;
    snapshots[count] = {};
    for (const strategy of strategies) {
      const rows = await rankAll(call, candidates.length, strategy);
      const scores = Object.fromEntries(rows.map((row) => [row.id, row.score]));
      snapshots[count][strategy] = assessReal(scores, candidates, truth, rows.length > 0);
      if (count === 40) snapshots[count][strategy] = {
        ...snapshots[count][strategy],
        profileSignature: profileSignature(Object.values(state().ratings), state().tasteClaims, strategy),
        scoreSignature: scoreSignature(rows)
      };
    }
  }
  return snapshots;
}

const permutationResults = [];
for (const [viewerIndex, viewer] of selectedViewers.entries()) {
  const sessions = [];
  for (let permutation = 0; permutation < requestedPermutations; permutation++) {
    sessions.push(await permutationSession(viewer, permutation));
  }
  const summary = { viewer: viewer.id, cohort: viewer.cohort, checkpoints: {}, order: {} };
  for (const count of checkpoints) {
    summary.checkpoints[count] = Object.fromEntries(strategies.map((strategy) => [strategy, {
      auc: round(average(sessions.map((session) => session[count][strategy].auc))),
      ndcg10: round(average(sessions.map((session) => session[count][strategy].ndcg10))),
      precision10: round(average(sessions.map((session) => session[count][strategy].precision10)))
    }]));
  }
  for (const strategy of strategies) {
    const final = sessions.map((session) => session[40][strategy]);
    const aucs = final.map((row) => row.auc);
    summary.order[strategy] = {
      aucMin: Math.min(...aucs),
      aucMax: Math.max(...aucs),
      aucSpread: round(Math.max(...aucs) - Math.min(...aucs)),
      profileSignatures: new Set(final.map((row) => row.profileSignature)).size,
      scoreSignatures: new Set(final.map((row) => row.scoreSignature)).size
    };
  }
  permutationResults.push(summary);
  process.stderr.write(`Stable geometry viewers ${viewerIndex + 1}/${selectedViewers.length}\n`);
}

async function failureSession(target) {
  const viewer = fixtures.original.viewers.find((candidate) => candidate.id === target.viewer);
  const training = new Map(viewer.trainingRatings.map((row) => [row.filmKey, row]));
  const candidates = viewer.heldOutRatings.map((row) => byKey.get(row.filmKey));
  const truth = Object.fromEntries(viewer.heldOutRatings.map((row) => [row.filmKey, row.rating]));
  const order = shuffled([...training.keys()], target.seed + viewer.sourceUserId * 1009);
  const { call } = client(candidates);
  let revision = (await call("profile.create", { name: "Stable geometry failure" })).revision;
  const traces = Object.fromEntries(strategies.map((strategy) => [strategy, []]));
  for (let count = 1; count <= 40; count++) {
    const filmKey = order[count - 1];
    revision = (await call("rate.set", { key: filmKey, value: training.get(filmKey).rating, expectedRevision: revision })).revision;
    if (count < 10) continue;
    for (const strategy of strategies) {
      const rows = await rankAll(call, candidates.length, strategy);
      const scores = Object.fromEntries(rows.map((row) => [row.id, row.score]));
      const auc = assessReal(scores, candidates, truth, rows.length > 0).auc;
      traces[strategy].push({ count, auc, delta: traces[strategy].length ? round(auc - traces[strategy].at(-1).auc) : 0 });
    }
  }
  if (traces.greedy[0].auc !== target.auc10 || traces.greedy.at(-1).auc !== target.auc40) {
    throw new Error(`Frozen failure did not reproduce: ${target.viewer}/${target.seed}`);
  }
  return {
    viewer: target.viewer,
    seed: target.seed,
    strategies: Object.fromEntries(strategies.map((strategy) => {
      const trace = traces[strategy];
      return [strategy, {
        auc10: trace[0].auc,
        auc40: trace.at(-1).auc,
        change: round(trace.at(-1).auc - trace[0].auc),
        gainCurrent40: round(trace.at(-1).auc - traces.greedy.at(-1).auc),
        worstStep: trace.slice(1).sort((a, b) => a.delta - b.delta)[0]
      }];
    }))
  };
}

const failures = [];
if (maxViewers === 0) {
  for (const target of diagnosis.cases) failures.push(await failureSession(target));
}

function benchmarkEntries(count) {
  const source = items.filter((item) => Object.values(item.features).some((value) => value !== 0));
  return Array.from({ length: count }, (_, index) => {
    const item = source[index % source.length];
    return {
      rating: index % 5 === 0 ? -2 : index % 3 === 0 ? 3 : 1,
      ts: index,
      item: { ...item, id: index + 1, key: `movie:${index + 1}`, medium: "movie" }
    };
  });
}

const runtime = {};
for (const count of [40, 500, 5000]) {
  const entries = benchmarkEntries(count);
  runtime[count] = {};
  for (const strategy of strategies) {
    const started = performance.now();
    const space = buildTasteSpace(entries, { clusterStrategy: strategy });
    runtime[count][strategy] = { milliseconds: round(performance.now() - started, 2), clusters: space.clusters.length };
  }
}

const learning = Object.fromEntries(
  checkpoints.map((count) => [
    count,
    Object.fromEntries(
      strategies.map((strategy) => {
        const rows = permutationResults.map((viewer) => viewer.checkpoints[count][strategy]);
        return [strategy, {
          auc: distribution(rows.map((row) => row.auc)),
          ndcg10: distribution(rows.map((row) => row.ndcg10)),
          precision10: distribution(rows.map((row) => row.precision10)),
          gainCurrent: meanInterval(rows.map((row, index) =>
            row.auc - permutationResults[index].checkpoints[count].greedy.auc
          ))
        }];
      })
    )
  ])
);

const order = Object.fromEntries(strategies.map((strategy) => [strategy, {
  exactProfileViewers: permutationResults.filter((viewer) => viewer.order[strategy].profileSignatures === 1).length,
  exactScoreViewers: permutationResults.filter((viewer) => viewer.order[strategy].scoreSignatures === 1).length,
  viewers: permutationResults.length,
  meanAucSpread: round(average(permutationResults.map((viewer) => viewer.order[strategy].aucSpread))),
  maxAucSpread: Math.max(...permutationResults.map((viewer) => viewer.order[strategy].aucSpread))
}]));

function gatesFor(strategy) {
  const final = learning[40][strategy];
  const failureRows = failures.map((failure) => failure.strategies[strategy]);
  return {
    exactOrderInvariance: order[strategy].exactProfileViewers === order[strategy].viewers && order[strategy].exactScoreViewers === order[strategy].viewers,
    positiveMeanGain: final.gainCurrent.lower > 0,
    worstDecileNotWorse: final.auc.p10 >= learning[40].greedy.auc.p10,
    knownFailuresImprove: failureRows.length === 5 && failureRows.every((row) => row.gainCurrent40 >= .03),
    knownFailureDeclines: failureRows.length === 5 && failureRows.every((row) => row.change >= -.03),
    singleStepSafety: failureRows.length === 5 && failureRows.every((row) => row.worstStep.delta >= -.05)
  };
}

const candidates = strategies.filter((strategy) => strategy !== "greedy").map((strategy) => ({ strategy, gates: gatesFor(strategy) }));
for (const candidate of candidates) candidate.passed = Object.values(candidate.gates).every(Boolean);
const eligible = candidates.filter((candidate) => candidate.passed).sort((a, b) => learning[40][b.strategy].gainCurrent.mean - learning[40][a.strategy].gainCurrent.mean);
const decision = maxViewers > 0
  ? { status: "smoke_only", selected: null, reason: "A limited run cannot make a model decision." }
  : eligible.length
    ? { status: "promote_for_confirmation", selected: eligible[0].strategy, reason: "The selected strategy passed every frozen gate." }
    : { status: "do_not_promote", selected: null, reason: "No deterministic strategy passed every frozen gate." };

const report = {
  version: protocol.version,
  protocol,
  modelFingerprint,
  evaluatorFingerprint,
  permutations: requestedPermutations,
  viewers: permutationResults.length,
  cohorts: Object.fromEntries(Object.keys(fixtures).map((cohort) => [cohort, permutationResults.filter((viewer) => viewer.cohort === cohort).length])),
  learning,
  order,
  candidates,
  failures,
  runtime,
  decision,
  viewerResults: permutationResults
};
writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
process.stdout.write(JSON.stringify({ output, viewers: report.viewers, order, candidates, decision, runtime }) + "\n");
