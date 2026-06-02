import { describe, expect, it } from "vitest";
import { AXIS_KEYS, featureVector } from "./lens.js";

describe("entertainment lens", () => {
  it("produces a value on every axis, clamped to [-1, 1]", () => {
    const v = featureVector({
      genres: ["Action", "Science Fiction"],
      keywords: ["fast paced", "epic", "dystopian"],
      overview: "A breathless, thrilling chase across a dystopian future."
    });
    for (const key of AXIS_KEYS) {
      expect(v[key]).toBeGreaterThanOrEqual(-1);
      expect(v[key]).toBeLessThanOrEqual(1);
    }
  });

  it("applies genre priors with no keyword/overview signal", () => {
    // Comedy prior: { tone: 0.8, thematic_weight: -0.4 }
    const v = featureVector({ genres: ["Comedy"], keywords: [], overview: "" });
    expect(v.tone).toBe(0.8);
    expect(v.thematic_weight).toBe(-0.4);
    expect(v.pacing).toBe(0);
  });

  it("moves an axis toward its negative pole on negative keywords", () => {
    const v = featureVector({
      genres: [],
      keywords: ["slow burn", "contemplative", "meditative"],
      overview: ""
    });
    expect(v.pacing).toBeLessThan(0);
  });
});
