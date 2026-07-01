import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { upgradeExistingRatings } from "./enrich-ratings";
import { preferences } from "$lib/state/preferences.svelte";
import type { FeatureVector, RatingEntry } from "./types";

function features(over: Partial<FeatureVector> = {}): FeatureVector {
  const v: any = {};
  for (const k of [
    "pacing", "tone", "emotional_intensity", "complexity", "scope",
    "realism", "thematic_weight", "character_focus", "moral_clarity", "structure"
  ]) v[k] = over[k as keyof FeatureVector] ?? 0;
  return v as FeatureVector;
}

function entry(id: number, feats: FeatureVector): RatingEntry {
  return {
    rating: 1,
    ts: Date.now(),
    item: {
      key: `movie:${id}`, medium: "movie", id, title: `Title ${id}`, year: 2015,
      posterPath: null, voteAverage: 7, genres: ["Drama"], features: feats
    }
  };
}

describe("upgradeExistingRatings", () => {
  beforeEach(() => {
    preferences.ratings = {};
  });
  afterEach(() => {
    delete (globalThis as unknown as { window?: unknown }).window;
    preferences.ratings = {};
  });

  it("re-saves only entries whose fresh detail() vector differs from what's stored", async () => {
    const alreadyGood = entry(1, features({ tone: -0.9 }));
    const stale = entry(2, features({ tone: 0 })); // coarse/list-only vector on record

    preferences.ratings = {
      [alreadyGood.item.key]: alreadyGood,
      [stale.item.key]: stale
    };

    const detail = vi.fn(async (_medium: string, id: number) => {
      // "Fresh" detail fetch: item 1 hasn't changed, item 2 gets a richer vector.
      const feats = id === 1 ? features({ tone: -0.9 }) : features({ tone: -0.85, emotional_intensity: 0.6 });
      return {
        id, medium: "movie", title: `Title ${id}`, year: 2015, voteAverage: 7, voteCount: 10,
        popularity: 1, genreIds: [], genres: ["Drama"], posterPath: null, overview: "",
        runtime: 100, keywords: ["revenge"], features: feats
      };
    });
    const setRating = vi.fn(async (key: string, rating: RatingEntry["rating"], item?: RatingEntry["item"]) => {
      if (item) preferences.ratings = { ...preferences.ratings, [key]: { rating, item, ts: Date.now() } };
      return { ratings: preferences.ratings };
    });
    (globalThis as any).window = { dossier: { tmdb: { detail }, preferences: { setRating } } };

    const result = await upgradeExistingRatings(4);

    expect(result.total).toBe(2);
    expect(result.upgraded).toBe(1);
    // Only the stale entry's key should have been re-saved through the bridge.
    const savedKeys = setRating.mock.calls.map((c) => c[0]);
    expect(savedKeys).toEqual([stale.item.key]);
  });

  it("is a no-op when every stored vector already matches a fresh fetch", async () => {
    const a = entry(1, features({ tone: -0.9 }));
    preferences.ratings = { [a.item.key]: a };

    const detail = vi.fn(async (_medium: string, id: number) => ({
      id, medium: "movie", title: `Title ${id}`, year: 2015, voteAverage: 7, voteCount: 10,
      popularity: 1, genreIds: [], genres: ["Drama"], posterPath: null, overview: "",
      runtime: 100, keywords: [], features: features({ tone: -0.9 })
    }));
    const setRating = vi.fn();
    (globalThis as any).window = { dossier: { tmdb: { detail }, preferences: { setRating } } };

    const result = await upgradeExistingRatings(4);
    expect(result.upgraded).toBe(0);
    expect(setRating).not.toHaveBeenCalled();
  });

  it("reports progress for every entry, including an initial 0/total call, even with nothing to upgrade", async () => {
    const a = entry(1, features({ tone: -0.9 }));
    const b = entry(2, features({ tone: 0.5 }));
    preferences.ratings = { [a.item.key]: a, [b.item.key]: b };

    const detail = vi.fn(async (_medium: string, id: number) => ({
      id, medium: "movie", title: `Title ${id}`, year: 2015, voteAverage: 7, voteCount: 10,
      popularity: 1, genreIds: [], genres: ["Drama"], posterPath: null, overview: "",
      // Same features as stored — nothing should be upgraded.
      runtime: 100, keywords: [], features: id === 1 ? features({ tone: -0.9 }) : features({ tone: 0.5 })
    }));
    (globalThis as any).window = { dossier: { tmdb: { detail }, preferences: { setRating: vi.fn() } } };

    const calls: Array<[number, number]> = [];
    const result = await upgradeExistingRatings(4, (processed, total) => calls.push([processed, total]));

    expect(result).toEqual({ upgraded: 0, total: 2 });
    expect(calls[0]).toEqual([0, 2]); // fires immediately, even before any item resolves
    expect(calls[calls.length - 1]).toEqual([2, 2]); // ends fully processed
    expect(calls.length).toBe(3); // initial + one per entry
  });

  it("reports 0/0 immediately when there are no ratings at all", async () => {
    (globalThis as any).window = { dossier: { tmdb: { detail: vi.fn() }, preferences: { setRating: vi.fn() } } };
    const calls: Array<[number, number]> = [];
    const result = await upgradeExistingRatings(4, (processed, total) => calls.push([processed, total]));
    expect(result).toEqual({ upgraded: 0, total: 0 });
    expect(calls).toEqual([[0, 0]]);
  });
});
