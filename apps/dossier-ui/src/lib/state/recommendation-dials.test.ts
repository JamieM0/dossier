import { describe, expect, it } from "vitest";
import { DEFAULT_SCORING_PARAMS } from "$lib/recommender";
import { convertDialsToParams, defaultDialValues, DIAL_DEFS } from "$lib/state/recommendation-dials.svelte";

describe("recommendation dials", () => {
  it("default dial positions convert to scoring params behaviorally identical to DEFAULT_SCORING_PARAMS", () => {
    // axisWeights is compared separately: convertDialsToParams always emits
    // an explicit weight per axis dial, while DEFAULT_SCORING_PARAMS relies
    // on weightedCosineSimilarity's implicit "missing key = 1" default —
    // both mean "no emphasis," just structured differently.
    const { axisWeights, ...rest } = convertDialsToParams(defaultDialValues());
    const { axisWeights: defaultAxisWeights, ...defaultRest } = DEFAULT_SCORING_PARAMS;
    expect(defaultAxisWeights).toEqual({});
    expect(rest).toEqual(defaultRest);
    for (const weight of Object.values(axisWeights)) expect(weight).toBe(1);
  });

  it("every dial has a description mentioning both ends of its range", () => {
    for (const def of DIAL_DEFS) {
      expect(def.description.toLowerCase()).toContain("low");
      expect(def.description.toLowerCase()).toContain("high");
    }
  });

  it("moving a dial away from default changes the resulting params", () => {
    const values = defaultDialValues();
    values.dislikeAversion = 100;
    const params = convertDialsToParams(values);
    expect(params.dislikePenalty).not.toBe(DEFAULT_SCORING_PARAMS.dislikePenalty);
  });
});
