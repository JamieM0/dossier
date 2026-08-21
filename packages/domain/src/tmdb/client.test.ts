import { afterEach, describe, expect, it, vi } from "vitest";
import { TmdbClient, TmdbConfigError, type TmdbCache } from "./client.js";

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body)
  } as Response;
}

const GENRES = { genres: [{ id: 28, name: "Action" }, { id: 878, name: "Science Fiction" }] };
const DETAIL = {
  id: 27205,
  title: "Inception",
  release_date: "2010-07-16",
  vote_average: 8.4,
  vote_count: 30000,
  popularity: 50,
  genres: [{ id: 28, name: "Action" }, { id: 878, name: "Science Fiction" }],
  poster_path: "/p.jpg",
  overview: "A thief who steals corporate secrets.",
  runtime: 148,
  belongs_to_collection: {
    id: 2344,
    name: "The Inception Collection",
    poster_path: "/collection.jpg",
    backdrop_path: "/collection-backdrop.jpg"
  },
  credits: {
    crew: [
      { id: 525, job: "Director" },
      { id: 999, job: "Producer" },
      { id: 525, job: "Director" }
    ]
  },
  keywords: { keywords: [{ id: 1, name: "dream" }, { id: 2, name: "heist" }] }
};

afterEach(() => vi.restoreAllMocks());

describe("TmdbClient", () => {
  it("normalizes detail responses and computes a lens vector", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        Promise.resolve(jsonResponse(url.includes("/genre/") ? GENRES : DETAIL))
      )
    );
    const client = new TmdbClient({ token: "x".repeat(50) });
    const item = await client.detail("movie", 27205);

    expect(item.title).toBe("Inception");
    expect(item.year).toBe(2010);
    expect(item.genres).toEqual(["Action", "Science Fiction"]);
    expect(item.keywords).toEqual(["dream", "heist"]);
    expect(item.collection).toEqual({
      id: 2344,
      name: "The Inception Collection",
      posterPath: "/collection.jpg",
      backdropPath: "/collection-backdrop.jpg"
    });
    expect(item.directorIds).toEqual([525]);
    expect(item.creatorIds).toEqual([]);
    expect(typeof item.features.pacing).toBe("number");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain("append_to_response=keywords%2Ccredits");
  });

  it("parses TV creator IDs from the same cached detail response", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(jsonResponse({
      id: 1396,
      name: "Breaking Bad",
      first_air_date: "2008-01-20",
      genres: [{ id: 18, name: "Drama" }],
      created_by: [{ id: 66633 }, { id: 66633 }, { id: 123 }],
      credits: { crew: [] },
      keywords: { results: [] }
    }))));
    const client = new TmdbClient({ token: "x".repeat(50) });
    const item = await client.detail("tv", 1396);

    expect(item.creatorIds).toEqual([123, 66633]);
    expect(item.collection).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("reads disk-cached metadata from the injected cache and skips the network", async () => {
    const store = new Map<string, unknown>();
    const cache: TmdbCache = {
      get: (k) => Promise.resolve(store.get(k)),
      set: (k, v) => {
        store.set(k, v);
        return Promise.resolve();
      }
    };
    const fetchMock = vi.fn((url: string) =>
      Promise.resolve(jsonResponse(url.includes("/genre/") ? GENRES : DETAIL))
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = new TmdbClient({ token: "x".repeat(50), cache });
    await client.detail("movie", 27205); // populates cache
    const callsAfterFirst = fetchMock.mock.calls.length;

    // A fresh client sharing the same cache must not re-fetch the detail.
    const client2 = new TmdbClient({ token: "x".repeat(50), cache });
    fetchMock.mockClear();
    const again = await client2.detail("movie", 27205);
    expect(again.title).toBe("Inception");
    const detailCalls = fetchMock.mock.calls.filter(([u]) => String(u).includes("/movie/27205"));
    expect(detailCalls.length).toBe(0);
    expect(callsAfterFirst).toBeGreaterThan(0);
  });

  it("throws TmdbConfigError on a 401", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(jsonResponse({}, 401))));
    const client = new TmdbClient({ token: "x".repeat(50) });
    await expect(client.validate()).rejects.toBeInstanceOf(TmdbConfigError);
  });
});
