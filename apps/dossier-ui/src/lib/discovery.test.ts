import { afterEach, describe, expect, it, vi } from "vitest";
import { enrichItem, enrichItems, mapWithConcurrency } from "./discovery";
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
