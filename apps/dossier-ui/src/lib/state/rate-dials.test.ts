import { afterEach, describe, expect, it } from "vitest";
import {
  notInterestedGenreCounts,
  RATE_DIAL_DEFAULT,
  rateDials
} from "./rate-dials.svelte";
import type { RatedItem, RatingEntry } from "$lib/types";
import { RATING_DISLIKE, RATING_NOT_INTERESTED } from "$lib/types";

function mkRatedItem(id: number, genres: string[]): RatedItem {
  return {
    key: `movie:${id}`,
    medium: "movie",
    id,
    title: `Item ${id}`,
    year: 2020,
    posterPath: null,
    voteAverage: 7,
    genres,
    features: {
      pacing: 0, tone: 0, emotional_intensity: 0, complexity: 0, scope: 0,
      realism: 0, thematic_weight: 0, character_focus: 0, moral_clarity: 0, structure: 0
    }
  };
}

function notInterestedEntries(genresPerItem: string[][]): RatingEntry[] {
  return genresPerItem.map((genres, i) => ({
    rating: RATING_NOT_INTERESTED,
    item: mkRatedItem(i, genres),
    ts: i
  }));
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

  it("isDefault is true only while every dial sits at neutral", () => {
    rateDials.genres = ["Drama", "Horror"];
    rateDials.values = { Drama: 50, Horror: 50 };
    expect(rateDials.isDefault).toBe(true);
    rateDials.set("Horror", 70);
    expect(rateDials.isDefault).toBe(false);
  });

  it("reset returns every known genre to neutral", () => {
    rateDials.genres = ["Drama", "Horror"];
    rateDials.set("Drama", 10);
    rateDials.set("Horror", 90);
    rateDials.reset();
    expect(rateDials.values).toEqual({ Drama: 50, Horror: 50 });
  });

  it("set clamps to the 1-100 range", () => {
    rateDials.set("Drama", 500);
    expect(rateDials.valueFor("Drama")).toBe(100);
    rateDials.set("Drama", -20);
    expect(rateDials.valueFor("Drama")).toBe(1);
  });

  it("hydrateFromDesktop merges stored values without dropping ensureGenres-added defaults", async () => {
    setBridge({ settingsGet: { rateGenreDials: { Drama: 80 } } });
    await rateDials.ensureGenres();
    await rateDials.hydrateFromDesktop();
    expect(rateDials.values.Drama).toBe(80);
    expect(rateDials.values.Horror).toBe(50);
    expect(rateDials.values.Kids).toBe(50);
  });

  it("notInterestedGenreCounts only counts not_interested ratings, tallying every genre on an item", () => {
    const entries: RatingEntry[] = [
      ...notInterestedEntries([["Horror"], ["Horror", "Drama"], ["Drama"]]),
      { rating: RATING_DISLIKE, item: mkRatedItem(99, ["Horror"]), ts: 99 }
    ];
    const counts = notInterestedGenreCounts(entries);
    expect(counts.get("Horror")).toBe(2);
    expect(counts.get("Drama")).toBe(2);
  });

  describe("pattern detection", () => {
    it("does not trigger below the base threshold of 10", () => {
      const entries = notInterestedEntries(Array.from({ length: 9 }, () => ["Horror"]));
      expect(rateDials.checkForPattern(entries)).toBeNull();
    });

    it("triggers once a genre's not_interested count reaches 10", () => {
      const entries = notInterestedEntries(Array.from({ length: 10 }, () => ["Horror"]));
      expect(rateDials.checkForPattern(entries)).toBe("Horror");
    });

    it("picks the genre furthest past its threshold when several qualify", () => {
      const entries = notInterestedEntries([
        ...Array.from({ length: 10 }, () => ["Comedy"]),
        ...Array.from({ length: 15 }, () => ["Horror"])
      ]);
      expect(rateDials.checkForPattern(entries)).toBe("Horror");
    });

    it("accepting the prompt cuts the dial by a quarter and resets the threshold to 10", async () => {
      setBridge();
      rateDials.set("Horror", 80);
      await rateDials.resolvePattern("Horror", 10, true);
      expect(rateDials.valueFor("Horror")).toBe(60); // 80 - 80/4
      const entries = notInterestedEntries(Array.from({ length: 9 }, () => ["Horror"]));
      // 9 more since baseline=10 (19 total) isn't enough yet (needs 10 more).
      expect(rateDials.checkForPattern(entries.concat(notInterestedEntries(Array.from({ length: 10 }, () => ["Horror"]))))).toBeNull();
    });

    it("declining doubles the threshold (capped at 200) and leaves the dial untouched", async () => {
      setBridge();
      rateDials.set("Horror", 80);
      await rateDials.resolvePattern("Horror", 10, false);
      expect(rateDials.valueFor("Horror")).toBe(80); // unchanged

      // 15 more not-interested Horror items (25 total) shouldn't trigger yet — needs 20 more past the baseline of 10.
      const entries25 = notInterestedEntries(Array.from({ length: 25 }, () => ["Horror"]));
      expect(rateDials.checkForPattern(entries25)).toBeNull();

      // 20 more past baseline (30 total) crosses the doubled threshold.
      const entries30 = notInterestedEntries(Array.from({ length: 30 }, () => ["Horror"]));
      expect(rateDials.checkForPattern(entries30)).toBe("Horror");
    });

    it("caps the doubling threshold at 200", async () => {
      setBridge();
      rateDials.patternState = { Horror: { baseline: 0, threshold: 150 } };
      await rateDials.resolvePattern("Horror", 0, false);
      expect(rateDials.patternState.Horror.threshold).toBe(200);
      await rateDials.resolvePattern("Horror", 0, false);
      expect(rateDials.patternState.Horror.threshold).toBe(200);
    });

    it("never lets the dial go below the minimum of 1", async () => {
      setBridge();
      rateDials.set("Horror", 2);
      await rateDials.resolvePattern("Horror", 10, true);
      expect(rateDials.valueFor("Horror")).toBeGreaterThanOrEqual(1);
    });
  });
});
