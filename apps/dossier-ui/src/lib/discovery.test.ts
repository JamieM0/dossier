import { afterEach, describe, expect, it, vi } from "vitest";
import { applyGenreDials, enrichItem, enrichItems, mapWithConcurrency } from "./discovery";
import type { TmdbItem } from "./types";

function mkItem(id: number, overrides: Partial<TmdbItem> = {}): TmdbItem {
  return {
    id, medium: "movie", title: `Item ${id}`, year: 2015, voteAverage: 7, voteCount: 100,
    popularity: 10, genreIds: [], genres: ["Drama"], posterPath: null, overview: "",
    runtime: 100, keywords: [], features: {
      pacing: 0, tone: 0, emotional_intensity: 0, complexity: 0, scope: 0,
      realism: 0, thematic_weight: 0, character_focus: 0, moral_clarity: 0, structure: 0
    },
    ...overrides
  };
}

/** discovery.ts only needs `window.dossier` to exist — stub it directly on
 * globalThis rather than pulling in a full jsdom environment. */
function setBridge(tmdb: unknown): void {
  (globalThis as unknown as { window: { dossier: unknown } }).window = { dossier: { tmdb } };
}

describe("mapWithConcurrency", () => {
  it("preserves input order regardless of completion order", async () => {
    const delays = [30, 10, 20, 5, 25];
    const result = await mapWithConcurrency(delays, 3, (d) => new Promise((r) => setTimeout(() => r(d * 2), d)));
    expect(result).toEqual(delays.map((d) => d * 2));
  });

  it("never runs more than `concurrency` at once", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const items = Array.from({ length: 20 }, (_, i) => i);
    await mapWithConcurrency(items, 4, async (i) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      return i;
    });
    expect(maxInFlight).toBeLessThanOrEqual(4);
  });

  it("handles empty input", async () => {
    const result = await mapWithConcurrency<number, number>([], 4, async (i) => i);
    expect(result).toEqual([]);
  });
});

describe("enrichItem / enrichItems", () => {
  afterEach(() => {
    delete (globalThis as unknown as { window?: unknown }).window;
  });

  it("replaces a list item with the detail-fetched (keyword-enriched) version", async () => {
    const listItem = mkItem(42);
    const detailItem = mkItem(42, { keywords: ["heist", "revenge"], genres: ["Action", "Crime"] });
    const detail = vi.fn().mockResolvedValue(detailItem);
    setBridge({ detail });

    const result = await enrichItem(listItem);
    expect(result).toBe(detailItem);
    expect(detail).toHaveBeenCalledWith("movie", 42);
  });

  it("falls back to the original item when the detail fetch fails", async () => {
    const listItem = mkItem(7);
    setBridge({ detail: vi.fn().mockRejectedValue(new Error("network down")) });

    const result = await enrichItem(listItem);
    expect(result).toBe(listItem);
  });

  it("falls back when the tmdb bridge is entirely unavailable", async () => {
    const listItem = mkItem(9);
    // window.dossier left unset by the afterEach cleanup above.
    const result = await enrichItem(listItem);
    expect(result).toBe(listItem);
  });

  it("enrichItems enriches a whole batch, falling back per-item on failure", async () => {
    const items = [mkItem(1), mkItem(2), mkItem(3)];
    setBridge({
      detail: vi.fn(async (_medium: string, id: number) => {
        if (id === 2) throw new Error("boom");
        return mkItem(id, { keywords: ["x"] });
      })
    });

    const result = await enrichItems(items, 2);
    expect(result[0].keywords).toEqual(["x"]);
    expect(result[1]).toBe(items[1]); // fell back
    expect(result[2].keywords).toEqual(["x"]);
  });
});

describe("applyGenreDials", () => {
  it("is a no-op when every dial is at its neutral default (50)", () => {
    const items = [mkItem(1, { genres: ["Action"] }), mkItem(2, { genres: ["Comedy"] })];
    const result = applyGenreDials(items, { Action: 50, Comedy: 50 }, {}, () => 0.3);
    expect(result).toBe(items);
  });

  it("is a no-op when no dial values are supplied at all", () => {
    const items = [mkItem(1, { genres: ["Action"] }), mkItem(2, { genres: ["Comedy"] })];
    const result = applyGenreDials(items, {}, {}, () => 0.3);
    expect(result).toBe(items);
  });

  it("is a no-op when only genre dials are neutral but tag dials are also all neutral", () => {
    const items = [mkItem(1, { genres: ["Action"], keywords: ["swordplay"] })];
    const result = applyGenreDials(items, {}, { swordplay: 50 }, () => 0.3);
    expect(result).toBe(items);
  });

  it("biases a raised genre's items toward the front of the queue", () => {
    // Feed the same "random" draw to both items so any difference in
    // ordering comes only from the weight the dial assigns them.
    const rng = () => 0.5;
    const action = mkItem(1, { genres: ["Action"] });
    const comedy = mkItem(2, { genres: ["Comedy"] });
    const result = applyGenreDials([comedy, action], { Action: 100, Comedy: 50 }, {}, rng);
    expect(result[0]).toBe(action);
    expect(result[1]).toBe(comedy);
  });

  it("biases a lowered genre's items toward the back of the queue", () => {
    const rng = () => 0.5;
    const horror = mkItem(1, { genres: ["Horror"] });
    const comedy = mkItem(2, { genres: ["Comedy"] });
    const result = applyGenreDials([horror, comedy], { Horror: 1, Comedy: 50 }, {}, rng);
    expect(result[0]).toBe(comedy);
    expect(result[1]).toBe(horror);
  });

  it("averages multiple genres so one raised genre doesn't fully rescue a lowered one", () => {
    const rng = () => 0.5;
    // Half Action (raised), half Horror (heavily lowered) should land
    // between an all-neutral item and an all-lowered item.
    const mixed = mkItem(1, { genres: ["Action", "Horror"] });
    const neutral = mkItem(2, { genres: ["Comedy"] });
    const lowered = mkItem(3, { genres: ["Horror"] });
    const result = applyGenreDials([mixed, neutral, lowered], { Action: 100, Horror: 1, Comedy: 50 }, {}, rng);
    expect(result.indexOf(neutral)).toBeLessThan(result.indexOf(lowered));
    expect(result.indexOf(mixed)).toBeLessThan(result.indexOf(lowered));
  });

  it("never hard-filters an item out, even at the lowest dial position", () => {
    const items = Array.from({ length: 5 }, (_, i) => mkItem(i, { genres: ["Horror"] }));
    const result = applyGenreDials(items, { Horror: 1 }, {}, Math.random);
    expect(result).toHaveLength(items.length);
    expect(new Set(result)).toEqual(new Set(items));
  });

  it("a raised TAG dial boosts items carrying that tag, even with 0 genre dials set", () => {
    // The user's whole point: a rare tag like swordplay should still
    // surface its items when dialled up, regardless of genre dials.
    const rng = () => 0.5;
    const swordplay = mkItem(1, { genres: ["Action"], keywords: ["swordplay", "donghua"] });
    const neutral = mkItem(2, { genres: ["Comedy"], keywords: ["romance"] });
    const result = applyGenreDials([neutral, swordplay], {}, { swordplay: 100 }, rng);
    expect(result[0]).toBe(swordplay);
    expect(result[1]).toBe(neutral);
  });

  it("a lowered TAG dial sinks items carrying that tag", () => {
    const rng = () => 0.5;
    const swordplay = mkItem(1, { genres: ["Action"], keywords: ["swordplay"] });
    const neutral = mkItem(2, { genres: ["Comedy"], keywords: ["romance"] });
    const result = applyGenreDials([swordplay, neutral], {}, { swordplay: 1 }, rng);
    expect(result[0]).toBe(neutral);
    expect(result[1]).toBe(swordplay);
  });

  it("a tag dial has FULL effect on an item with many undialled keywords (no dilution)", () => {
    // The reason tagDialMultiplier averages ONLY non-neutral dials, not
    // all keywords: a 15-keyword item with one dialled tag (swordplay:100)
    // should still get a full 2x boost, not 1.07x.
    const rng = () => 0.5;
    const manyKeywords = mkItem(1, {
      genres: ["Drama"],
      keywords: ["swordplay", "k1", "k2", "k3", "k4", "k5", "k6", "k7", "k8", "k9", "k10", "k11", "k12", "k13", "k14"]
    });
    const neutral = mkItem(2, { genres: ["Comedy"] });
    const result = applyGenreDials([neutral, manyKeywords], {}, { swordplay: 100 }, rng);
    expect(result[0]).toBe(manyKeywords);
  });

  it("genre and tag multipliers combine multiplicatively", () => {
    // Action:100 (2x genre) + swordplay:100 (2x tag) = 4x combined;
    // Action:100 (2x) + no tag dial = 2x. The first should beat the second.
    const rng = () => 0.5;
    const both = mkItem(1, { genres: ["Action"], keywords: ["swordplay"] });
    const genreOnly = mkItem(2, { genres: ["Action"] });
    const result = applyGenreDials([genreOnly, both], { Action: 100 }, { swordplay: 100 }, rng);
    expect(result[0]).toBe(both);
    expect(result[1]).toBe(genreOnly);
  });

  it("a raised tag cannot fully rescue a heavily-lowered tag on the same item (avg within tags)", () => {
    // swordplay:100 + romance:1 → avg of non-neutral = (2 + 0.02)/2 ≈ 1.01,
    // effectively neutral. Matches the "averages multiple genres" semantics.
    const rng = () => 0.5;
    const mixed = mkItem(1, { genres: ["Drama"], keywords: ["swordplay", "romance"] });
    const lowered = mkItem(2, { genres: ["Drama"], keywords: ["romance"] });
    const neutral = mkItem(3, { genres: ["Drama"] });
    const result = applyGenreDials(
      [mixed, neutral, lowered],
      {},
      { swordplay: 100, romance: 1 },
      rng
    );
    expect(result.indexOf(mixed)).toBeLessThan(result.indexOf(lowered));
    expect(result.indexOf(neutral)).toBeLessThan(result.indexOf(lowered));
  });
});
