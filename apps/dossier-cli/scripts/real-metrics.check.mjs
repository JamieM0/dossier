import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { assessReal, meanInterval } from "./real-metrics.mjs";

test("real-v1 keeps recorded truth separate from public metadata and training", () => {
  const bytes = readFileSync(new URL("../src/lab/real-v1.json", import.meta.url));
  assert.equal(createHash("sha256").update(bytes).digest("hex"), "f1f52a04d5448a5fcf71078d61bb85ff6c5a69cd71c1cccd9f2626662c63f7ff");
  const fixture = JSON.parse(bytes);
  const filmKeys = new Set(fixture.items.map((item) => `movie:${item.id}`));
  assert.equal(fixture.viewers.length, 31);
  assert.equal(filmKeys.size, 1736);
  assert.ok(fixture.items.every((item) => !("ratings" in item) && !("features" in item) && !("hiddenRating" in item)));
  assert.ok(fixture.items.every((item) => !item.genres.includes("Sci-Fi") && !item.genres.includes("Musical")));
  const conversion = new Map([[.5, -3], [1, -3], [1.5, -2], [2, -2], [2.5, -1], [3, 0], [3.5, 0], [4, 2], [4.5, 3], [5, 3]]);
  for (const viewer of fixture.viewers) {
    const training = new Set(viewer.trainingRatings.map((row) => row.filmKey));
    const heldOut = new Set(viewer.heldOutRatings.map((row) => row.filmKey));
    assert.equal(training.size, viewer.trainingRatings.length);
    assert.equal(heldOut.size, 60);
    assert.ok([...heldOut].every((id) => !training.has(id)));
    assert.ok(viewer.heldOutRatings.filter((row) => row.rating > 0).length >= 12);
    assert.ok(viewer.heldOutRatings.filter((row) => row.rating < 0).length >= 12);
    for (const row of [...viewer.trainingRatings, ...viewer.heldOutRatings]) {
      assert.ok(filmKeys.has(row.filmKey));
      assert.equal(row.rating, conversion.get(row.stars));
    }
  }
});

test("personal ordering check excludes reputation gaps and neutral ratings", () => {
  const films = [{ id: 1, medium: "movie", voteAverage: 8 }, { id: 2, medium: "movie", voteAverage: 7.5 },
    { id: 3, medium: "movie", voteAverage: 5 }, { id: 4, medium: "movie", voteAverage: 8 }];
  const truth = { "movie:1": 3, "movie:2": -2, "movie:3": -2, "movie:4": 0 };
  const scores = { "movie:1": .3, "movie:2": .8, "movie:3": .1, "movie:4": 1 };
  const result = assessReal(scores, films, truth);
  assert.equal(result.auc, .5);
  assert.equal(result.similarPublicRatingPairs, 1);
  assert.equal(result.similarPublicRatingAuc, 0);
  const tied = assessReal({}, films, truth, false);
  assert.equal(tied.auc, .5);
  assert.equal(tied.similarPublicRatingAuc, .5);
  assert.equal(tied.precision10, 0);
});

test("uncertainty calculation is repeatable and retains the viewer count", () => {
  assert.deepEqual(meanInterval([.1, .1, .1]), { mean: .1, lower: .1, upper: .1, viewers: 3 });
  assert.deepEqual(meanInterval([-.2, .1, .3]), meanInterval([-.2, .1, .3]));
});
