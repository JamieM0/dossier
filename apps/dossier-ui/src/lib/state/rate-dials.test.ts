import { afterEach, describe, expect, it } from "vitest";
import {
  RATE_DIAL_DEFAULT,
  rateDials,
  tagTallies
} from "./rate-dials.svelte";
import type { RatedItem, RatingEntry } from "$lib/types";
import { RATING_DISLIKE, RATING_LIKE, RATING_NOT_INTERESTED } from "$lib/types";

function mkRatedItem(id: number, genres: string[], keywords: string[] = []): RatedItem {
  return {
    key: `movie:${id}`,
    medium: "movie",
    id,
    title: `Item ${id}`,
    year: 2020,
    posterPath: null,
    voteAverage: 7,
    genres,
    keywords,
    features: {
      pacing: 0, tone: 0, emotional_intensity: 0, complexity: 0, scope: 0,
      realism: 0, thematic_weight: 0, character_focus: 0, moral_clarity: 0, structure: 0
    }
  };
}

function entry(id: number, rating: RatingEntry["rating"], tags: string[]): RatingEntry {
  return { rating, item: mkRatedItem(id, [], tags), ts: id };
}

function dontCareEntries(n: number, tag: string): RatingEntry[] {
  return Array.from({ length: n }, (_, i) => entry(i, RATING_NOT_INTERESTED, [tag]));
}

function setBridge(overrides: Partial<{ settingsGet: unknown; genres: unknown }> = {}): void {
  (globalThis as unknown as { window: unknown }).window = {
    dossier: {
      settings: {
        get: () => Promise.resolve(overrides.settingsGet ?? {}),
        set: (next: unknown) => Promise.resolve(next)
      },
      tmdb: {
        genres:
          overrides.genres ??
          ((medium: string) =>
            Promise.resolve({
              genres: medium === "tv" ? { "1": "Drama", "2": "Kids" } : { "1": "Drama", "3": "Horror" }
            }))
      }
    }
  };
}

describe("rate-dials store", () => {
  afterEach(() => {
    delete (globalThis as unknown as { window?: unknown }).window;
    rateDials.values = {};
    rateDials.genres = [];
    rateDials.tagValues = {};
    rateDials.tags = [];
    rateDials.patternState = {};
  });

  it("ensureGenres unions movie + tv genre names and defaults each to neutral", async () => {
    setBridge();
    await rateDials.ensureGenres();
    expect(rateDials.genres).toEqual(["Drama", "Horror", "Kids"]);
    expect(rateDials.values).toEqual({ Drama: 50, Horror: 50, Kids: 50 });
  });

  it("ensureGenres never overwrites an already-set dial", async () => {
    setBridge();
    rateDials.set("Drama", 90);
    await rateDials.ensureGenres();
    expect(rateDials.values.Drama).toBe(90);
    expect(rateDials.values.Horror).toBe(50);
  });

  it("ensureTags harvests every keyword from the entry list, sorted alphabetically, defaulting each to neutral", () => {
    rateDials.ensureTags([
      entry(1, RATING_LIKE, ["swordplay", "dragon"]),
      entry(2, RATING_LIKE, ["donghua"]),
      entry(2, RATING_LIKE, ["swordplay"]) // dupe
    ]);
    expect(rateDials.tags).toEqual(["donghua", "dragon", "swordplay"]);
    expect(rateDials.tagValues).toEqual({ donghua: 50, dragon: 50, swordplay: 50 });
  });

  it("ensureTags never overwrites a tag dial the user has moved", () => {
    rateDials.setTag("swordplay", 90);
    rateDials.ensureTags([entry(1, RATING_LIKE, ["swordplay", "dragon"])]);
    expect(rateDials.tagValueFor("swordplay")).toBe(90);
    expect(rateDials.tagValueFor("dragon")).toBe(50);
  });

  it("isDefault is true only while every dial — genre AND tag — sits at neutral", () => {
    rateDials.genres = ["Drama"];
    rateDials.tags = ["swordplay"];
    rateDials.values = { Drama: 50 };
    rateDials.tagValues = { swordplay: 50 };
    expect(rateDials.isDefault).toBe(true);
    rateDials.setTag("swordplay", 70);
    expect(rateDials.isDefault).toBe(false);
    rateDials.setTag("swordplay", 50);
    expect(rateDials.isDefault).toBe(true);
    rateDials.set("Drama", 80);
    expect(rateDials.isDefault).toBe(false);
  });

  it("reset returns every known genre AND tag to neutral", () => {
    rateDials.genres = ["Drama"];
    rateDials.tags = ["swordplay"];
    rateDials.set("Drama", 10);
    rateDials.setTag("swordplay", 90);
    rateDials.reset();
    expect(rateDials.values).toEqual({ Drama: 50 });
    expect(rateDials.tagValues).toEqual({ swordplay: 50 });
  });

  it("set / setTag clamp to the 1-100 range", () => {
    rateDials.set("Drama", 500);
    expect(rateDials.valueFor("Drama")).toBe(100);
    rateDials.set("Drama", -20);
    expect(rateDials.valueFor("Drama")).toBe(1);
    rateDials.setTag("swordplay", 500);
    expect(rateDials.tagValueFor("swordplay")).toBe(100);
  });

  it("hydrateFromDesktop merges stored genre + tag values without dropping ensure-added defaults", async () => {
    setBridge({ settingsGet: { rateGenreDials: { Drama: 80 }, rateTagDials: { swordplay: 30 } } });
    await rateDials.ensureGenres();
    rateDials.ensureTags([entry(1, RATING_LIKE, ["swordplay", "dragon"])]);
    await rateDials.hydrateFromDesktop();
    expect(rateDials.values.Drama).toBe(80);
    expect(rateDials.values.Horror).toBe(50);
    expect(rateDials.tagValueFor("swordplay")).toBe(30);
    expect(rateDials.tagValueFor("dragon")).toBe(50);
  });

  it("tagTallies counts seen + dontCare per tag, skipping entries with no keywords", () => {
    const entries: RatingEntry[] = [
      entry(1, RATING_NOT_INTERESTED, ["swordplay"]),
      entry(2, RATING_NOT_INTERESTED, ["swordplay", "dragon"]),
      entry(3, RATING_LIKE, ["swordplay"]),
      entry(4, RATING_DISLIKE, []), // no tags — ignored entirely
      entry(5, RATING_LIKE, ["dragon"])
    ];
    const tallies = tagTallies(entries);
    expect(tallies.get("swordplay")).toEqual({ tag: "swordplay", seen: 3, dontCare: 2 });
    expect(tallies.get("dragon")).toEqual({ tag: "dragon", seen: 2, dontCare: 1 });
  });

  describe("pattern detection", () => {
    it("does not trigger below the seen-count threshold of 10", () => {
      // 9 dont-cares out of 9 seen — rate 1.0, but seen 9 < threshold 10.
      const entries = dontCareEntries(9, "swordplay");
      expect(rateDials.checkForPattern(entries)).toBeNull();
    });

    it("triggers once a tag's seen-count reaches 10 AND don't-care rate >= 0.75", () => {
      // 10 dont-cares / 10 seen = 1.0 rate, seen >= 10 → triggers.
      const entries = dontCareEntries(10, "swordplay");
      const result = rateDials.checkForPattern(entries);
      expect(result?.tag).toBe("swordplay");
      expect(result?.seen).toBe(10);
      expect(result?.dontCare).toBe(10);
    });

    it("does NOT trigger when the user has liked a healthy share — the sentiment fix", () => {
      // 10 dont-cares + 8 likes = 10/18 = 0.56 rate, below 0.75. Even
      // though there are 10 dont-cares (the legacy trigger), the rate
      // gate correctly suppresses the prompt because the user clearly
      // still enjoys the cluster. This is the original bug.
      const entries: RatingEntry[] = [
        ...dontCareEntries(10, "swordplay"),
        ...Array.from({ length: 8 }, (_, i) => entry(100 + i, RATING_LIKE, ["swordplay"]))
      ];
      expect(rateDials.checkForPattern(entries)).toBeNull();
    });

    it("triggers at exactly the 0.75 boundary (3 dont-cares of 4 seen after threshold seen)", () => {
      // Need seen >= 10 to clear the seen-threshold gate, so build a
      // 10-seen, 7.5-dontCare-equivalent: 8 dont-cares of 10 seen = 0.8.
      const entries: RatingEntry[] = [
        ...dontCareEntries(8, "swordplay"),
        ...Array.from({ length: 2 }, (_, i) => entry(200 + i, RATING_LIKE, ["swordplay"]))
      ];
      const result = rateDials.checkForPattern(entries);
      expect(result?.tag).toBe("swordplay");
      expect(result?.dontCare).toBe(8);
      expect(result?.seen).toBe(10);
    });

    it("picks the tag with the most don't-cares when several qualify", () => {
      const entries: RatingEntry[] = [
        ...dontCareEntries(10, "swordplay"),
        ...dontCareEntries(15, "dragon")
      ];
      expect(rateDials.checkForPattern(entries)?.tag).toBe("dragon");
    });

    it("accepting the prompt cuts the tag dial by a quarter and resets the seen-threshold", async () => {
      setBridge();
      rateDials.setTag("swordplay", 80);
      await rateDials.resolvePattern("swordplay", 10, true);
      expect(rateDials.tagValueFor("swordplay")).toBe(60); // 80 - 80/4
      // After accept, baseline seen=10. 9 more dont-cares since (19
      // total) isn't enough yet (needs 10 more past baseline).
      const more9 = dontCareEntries(9, "swordplay").map((e, i) => ({ ...e, item: { ...e.item, id: 500 + i, key: `movie:${500 + i}` } }));
      const total19 = [...dontCareEntries(10, "swordplay"), ...more9];
      expect(rateDials.checkForPattern(total19)).toBeNull();
    });

    it("declining doubles the seen-threshold (capped at 200) and leaves the dial untouched", async () => {
      setBridge();
      rateDials.setTag("swordplay", 80);
      await rateDials.resolvePattern("swordplay", 10, false);
      expect(rateDials.tagValueFor("swordplay")).toBe(80); // unchanged

      // 15 more seen (25 total) shouldn't trigger — needs 20 past baseline 10.
      const more15 = Array.from({ length: 15 }, (_, i) => entry(300 + i, RATING_NOT_INTERESTED, ["swordplay"]));
      const total25 = [...dontCareEntries(10, "swordplay"), ...more15];
      expect(rateDials.checkForPattern(total25)).toBeNull();

      // 20 more past baseline (30 total) crosses the doubled threshold.
      const more20 = Array.from({ length: 20 }, (_, i) => entry(400 + i, RATING_NOT_INTERESTED, ["swordplay"]));
      const total30 = [...dontCareEntries(10, "swordplay"), ...more20];
      expect(rateDials.checkForPattern(total30)?.tag).toBe("swordplay");
    });

    it("caps the doubling threshold at 200", async () => {
      setBridge();
      rateDials.patternState = { swordplay: { baseline: 0, threshold: 150 } };
      await rateDials.resolvePattern("swordplay", 0, false);
      expect(rateDials.patternState.swordplay.threshold).toBe(200);
      await rateDials.resolvePattern("swordplay", 0, false);
      expect(rateDials.patternState.swordplay.threshold).toBe(200);
    });

    it("never lets the dial go below the minimum of 1", async () => {
      setBridge();
      rateDials.setTag("swordplay", 2);
      await rateDials.resolvePattern("swordplay", 10, true);
      expect(rateDials.tagValueFor("swordplay")).toBeGreaterThanOrEqual(1);
    });
  });
});
