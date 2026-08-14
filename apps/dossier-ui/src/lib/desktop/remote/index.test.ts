import { afterEach, describe, expect, test, vi } from "vitest";
import { installRemoteApi } from "./index.js";

describe("paired-device bridge", () => {
  afterEach(() => vi.unstubAllGlobals());

  test("uses PUT for ratings and mobile-safe settings only", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ ratings: {} }) });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("window", {});
    installRemoteApi();

    await window.dossier!.preferences.setRating("movie:1", 0.5, { key: "movie:1" } as never);
    let [, init] = fetchMock.mock.calls[0]!;
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toMatchObject({ key: "movie:1", rating: 0.5 });

    await window.dossier!.settings.set({
      mobileRatingInput: "scale",
      recommendationDials: { discovery: 70 },
      startOnLogin: true
    });
    [, init] = fetchMock.mock.calls[1]!;
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual({
      mobileRatingInput: "scale",
      recommendationDials: { discovery: 70 }
    });
  });
});
