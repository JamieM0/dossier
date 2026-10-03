import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { featureVector } from "@dossier/domain";
import { assess, baselineScores } from "./hard-metrics.mjs";

const bytes = readFileSync(new URL("../src/lab/hard-v1.json", import.meta.url));
const fixture = JSON.parse(bytes);
const titles = fixture.items.map((item) => ({ ...item, features: featureVector({ genres: item.genres, keywords: item.keywords, overview: item.overview }) }));
const byId = new Map(titles.map((item) => [`movie:${item.id}`, item]));

test("hard-v1 truth is frozen, disjoint, and sufficiently powered", () => {
  assert.equal(createHash("sha256").update(bytes).digest("hex"), "8707494b1b553f8762c316a9df48c37eefabe8b5ef1ea64a50c25e1f56d7c835");
  assert.equal(fixture.personas.length, 18);
  assert.equal(fixture.holdoutKeys.length, 72);
  assert.equal(new Set([...fixture.trainingKeys, ...fixture.holdoutKeys]).size, titles.length);
  assert.ok(fixture.trainingKeys.every((id) => !fixture.holdoutKeys.includes(id)));
  for (const person of fixture.personas) {
    assert.ok(fixture.holdoutKeys.filter((id) => person.ratings[id] > 0).length >= 5, person.id);
    assert.ok(fixture.holdoutKeys.filter((id) => person.ratings[id] < 0).length >= 5, person.id);
  }
  assert.ok(fixture.items.every((item) => !("latent" in item) && !("ratings" in item) && !("features" in item)));
});

test("ranking metric detects reversed evidence and empty recommendations", () => {
  const candidates = fixture.holdoutKeys.slice(0, 2).map((id) => byId.get(id));
  const truth = { [`movie:${candidates[0].id}`]: 3, [`movie:${candidates[1].id}`]: -3 };
  const correct = assess({ [`movie:${candidates[0].id}`]: 1, [`movie:${candidates[1].id}`]: -1 }, candidates, truth);
  const reversed = assess({ [`movie:${candidates[0].id}`]: -1, [`movie:${candidates[1].id}`]: 1 }, candidates, truth);
  const empty = assess({}, candidates, truth, false);
  assert.equal(correct.auc, 1);
  assert.equal(reversed.auc, 0);
  assert.equal(empty.auc, .5);
  assert.equal(empty.precision10, 0);
});

test("simple baselines receive observed evidence and public items only", () => {
  const candidates = fixture.holdoutKeys.slice(0, 5).map((id) => byId.get(id));
  const observed = [{ item: byId.get(fixture.trainingKeys[0]), rating: 3 }];
  const scores = baselineScores("genre", observed, candidates, 42);
  assert.deepEqual(Object.keys(scores).sort(), candidates.map((item) => `movie:${item.id}`).sort());
  assert.deepEqual(scores, baselineScores("genre", observed, candidates, 42));
});
