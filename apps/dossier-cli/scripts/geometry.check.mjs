import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const report = JSON.parse(readFileSync(new URL("../../../reports/stable-geometry-v1.json", import.meta.url)));

test("stable geometry report is a complete frozen run", () => {
  assert.equal(report.version, "stable-geometry-v1");
  assert.equal(report.viewers, 108);
  assert.equal(report.permutations, 24);
  assert.deepEqual(report.cohorts, { original: 31, confirmation: 47, override: 30 });
  assert.equal(report.failures.length, 5);
});

test("deterministic candidates are exactly invariant to evidence order", () => {
  for (const strategy of ["canonical_greedy", "canonical_complete_link"]) {
    assert.equal(report.order[strategy].exactProfileViewers, report.viewers);
    assert.equal(report.order[strategy].exactScoreViewers, report.viewers);
    assert.equal(report.order[strategy].maxAucSpread, 0);
  }
});

test("decision is the mechanical result of the frozen gates", () => {
  for (const candidate of report.candidates) {
    assert.equal(candidate.passed, Object.values(candidate.gates).every(Boolean));
  }
  const passing = report.candidates.filter((candidate) => candidate.passed);
  assert.equal(report.decision.status === "promote_for_confirmation", passing.length > 0);
  assert.equal(report.decision.selected == null, passing.length === 0);
});
