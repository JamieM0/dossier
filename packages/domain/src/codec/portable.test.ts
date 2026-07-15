import { describe, expect, it } from "vitest";
import {
  exportLibrary,
  importLibrary,
  serializeEnvelope,
  PortableImportError,
  PORTABLE_FORMAT
} from "./portable.js";
import { createDefaultState, type PersistedState } from "../store/model.js";

function sampleState(): PersistedState {
  const state = createDefaultState();
  state.settings = { theme: "dark" };
  state.ratings["movie:27205"] = {
    rating: 1,
    ts: 1_700_000_000_000,
    item: {
      key: "movie:27205",
      medium: "movie",
      id: 27205,
      title: "Inception",
      year: 2010,
      posterPath: "/poster.jpg",
      voteAverage: 8.4,
      genres: ["Action", "Science Fiction"],
      keywords: ["dream", "heist"],
      features: { pacing: 0.7, tone: -0.3 }
    }
  };
  state.pairwise.push({ winnerKey: "movie:27205", loserKey: "tv:1396", ts: 1_700_000_001_000 });
  state.skipped.push("movie:603");
  return state;
}

describe("portable library codec", () => {
  it("round-trips a library through export/import with the right passphrase", async () => {
    const state = sampleState();
    const envelope = await exportLibrary(state, "correct horse battery staple");
    expect(envelope.format).toBe(PORTABLE_FORMAT);
    const restored = await importLibrary(envelope, "correct horse battery staple");
    expect(restored).toEqual(state);
  });

  it("round-trips through the serialized file form", async () => {
    const state = sampleState();
    const file = serializeEnvelope(await exportLibrary(state, "pw"));
    const restored = await importLibrary(file, "pw");
    expect(restored.ratings["movie:27205"]?.item.title).toBe("Inception");
  });

  it("rejects a wrong passphrase", async () => {
    const envelope = await exportLibrary(sampleState(), "right");
    await expect(importLibrary(envelope, "wrong")).rejects.toBeInstanceOf(PortableImportError);
  });

  it("rejects a non-Dossier file", async () => {
    await expect(importLibrary('{"hello":"world"}', "pw")).rejects.toBeInstanceOf(
      PortableImportError
    );
  });

  it("produces a different ciphertext each export (random salt/iv)", async () => {
    const a = await exportLibrary(sampleState(), "pw");
    const b = await exportLibrary(sampleState(), "pw");
    expect(a.ciphertext).not.toBe(b.ciphertext);
    expect(a.kdf.salt).not.toBe(b.kdf.salt);
  });

  it("backfills `keywords: []` onto RatedItems from a pre-keywords export", async () => {
    // Hand-construct a state whose rated item lacks the `keywords` field
    // entirely, simulating an export from before the field existed. Use
    // encrypt→decrypt so importLibrary's withDefaults runs.
    const legacy = createDefaultState();
    legacy.ratings["movie:1"] = {
      rating: 1,
      ts: 1,
      // Intentionally no `keywords` property.
      item: {
        key: "movie:1", medium: "movie", id: 1, title: "Old",
        year: 2000, posterPath: null, voteAverage: 7,
        genres: ["Drama"], features: {}
      }
    } as PersistedState["ratings"][string];

    const envelope = await exportLibrary(legacy, "pw");
    const restored = await importLibrary(envelope, "pw");
    expect(restored.ratings["movie:1"]?.item.keywords).toEqual([]);
  });
});
