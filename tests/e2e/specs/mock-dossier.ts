import type { Page } from "@playwright/test";

/** The layout runs a one-time ratings-enrichment pass on every boot
 * (enrich-ratings.ts) and shows an unclosable progress modal while it
 * does — even when there's nothing to upgrade, per the explicit "always
 * show, even if nothing changed" requirement. Tests that interact with
 * the app right after a fresh `goto()` need to close it first. */
export async function dismissEnrichmentModal(page: Page): Promise<void> {
  const closeBtn = page
    .getByRole("dialog", { name: /taste data/i })
    .getByRole("button", { name: "Close" });
  try {
    await closeBtn.waitFor({ state: "visible", timeout: 10_000 });
    await closeBtn.click();
  } catch {
    // Modal never appeared — nothing to dismiss.
  }
}

/** Optional seed data applied before the app's first hydrate() — lets a
 * test start from N already-rated titles without driving the animated
 * Rate screen (clicking through its exit-animation timing is slow and,
 * under load, flaky: Playwright's actionability "stable" check can flap
 * against the card's transition). Only used by tests that need rated
 * items already in place, e.g. to reach the Refine screen directly. */
export type MockDossierSeed = {
  /** Marks this many pool movies (from the front of the pool) as liked. */
  likedMovies?: number;
  /** Pre-seeds this many synthetic "swordplay"-tagged titles already
   *  rated "not interested", and skips the pool's first 6 titles so the
   *  Rate queue starts right at "Crimson Hour" (a swordplay-tagged pool
   *  title) — lets a test reach the tag-pattern popup with a single
   *  live click instead of walking the whole queue. The popup is now
   *  tag-based (sentiment-rate over `keywords[]`) rather than genre-
   *  based, so the seeded template carries the `swordplay` keyword. */
  notInterestedHorrorSeed?: number;
};

/** Injects a fake `window.dossier` bridge so the SvelteKit app (which
 * normally talks to the Tauri shell) can be exercised in a plain
 * browser for visual review. Stateful enough for ratings to round-trip. */
export function installMockDossier(seed?: MockDossierSeed): void {
  const AXES = [
    "pacing", "tone", "emotional_intensity", "complexity", "scope",
    "realism", "thematic_weight", "character_focus", "moral_clarity", "structure"
  ];
  const feat = (over: Record<string, number> = {}) => {
    const v: Record<string, number> = {};
    for (const k of AXES) v[k] = over[k] ?? 0;
    return v;
  };
  const genreNames: Record<string, string> = {
    "28": "Action", "18": "Drama", "35": "Comedy", "878": "Science Fiction",
    "27": "Horror", "10749": "Romance", "80": "Crime"
  };
  let n = 0;
  const mk = (title: string, over: Record<string, number>, genres: string[], keywords: string[] = []) => ({
    id: ++n + 1000,
    medium: "movie" as const,
    title,
    year: 2000 + (n % 24),
    voteAverage: 6 + (n % 4),
    voteCount: 1000 + n * 10,
    popularity: 100 - n,
    genreIds: [],
    genres,
    posterPath: null,
    overview: `${title} is a sample title used for visual review.`,
    runtime: 100 + n,
    keywords,
    features: feat(over)
  });
  const pool = [
    mk("Neon Vector", { pacing: 0.9, tone: -0.3, realism: 0.8 }, ["Action", "Science Fiction"], ["cyberpunk", "heist"]),
    mk("Quiet Harbor", { tone: 0.4, emotional_intensity: 0.7, scope: -0.5 }, ["Drama", "Romance"], ["small town", "grief"]),
    mk("The Long Joke", { tone: 1, thematic_weight: -0.4 }, ["Comedy"], ["slapstick", "ensemble"]),
    mk("Midnight Ledger", { tone: -0.6, moral_clarity: -0.5, complexity: 0.6 }, ["Crime", "Drama"], ["heist", "non-linear"]),
    mk("Starfall Saga", { scope: 1, realism: 0.7, pacing: 0.5 }, ["Science Fiction", "Action"], ["space opera", "ensemble"]),
    mk("Paper Houses", { emotional_intensity: 0.6, tone: -0.2, character_focus: 0.5 }, ["Drama"], ["coming of age"]),
    mk("Crimson Hour", { tone: -0.8, emotional_intensity: 0.5 }, ["Horror"], ["swordplay"]),
    mk("Sunday Drive", { tone: 0.7, pacing: -0.4 }, ["Comedy", "Romance"], ["road trip"]),
    mk("Iron Verdict", { pacing: 0.7, moral_clarity: 0.4 }, ["Action", "Crime"], ["revenge"]),
    mk("Glass Forest", { complexity: 0.8, structure: 0.6, realism: 0.4 }, ["Science Fiction", "Drama"], ["non-linear", "solarpunk"])
  ];

  let ratings: Record<string, unknown> = {};
  let pairwise: unknown[] = [];
  let skipped: string[] = [];
  const list = (items: unknown[]) => Promise.resolve({ page: 1, totalPages: 1, items });

  if (seed?.likedMovies) {
    for (let i = 0; i < seed.likedMovies && i < pool.length; i++) {
      const item = pool[i];
      const key = `movie:${item.id}`;
      // RatedItem (what a rating's `item` snapshot must be) requires a
      // `key` field — the raw pool entries are TmdbItem-shaped and don't
      // have one, so without this every keyed {#each} on the Refine
      // screen resolves to key `undefined` for all seeded items, which
      // Svelte rejects as a duplicate key and aborts the render.
      ratings[key] = { rating: 1, item: { ...item, key }, ts: Date.now() + i };
    }
  }

  if (seed?.notInterestedHorrorSeed) {
    for (let i = 0; i < 6; i++) skipped = [...skipped, `movie:${pool[i].id}`];
    const horrorTemplate = pool[6]; // "Crimson Hour" — pool's swordplay-tagged title.
    for (let i = 0; i < seed.notInterestedHorrorSeed; i++) {
      const key = `movie:${900000 + i}`;
      ratings[key] = {
        rating: -0.5,
        item: {
          ...horrorTemplate,
          id: 900000 + i,
          title: `Seeded Horror ${i}`,
          keywords: ["swordplay"],
          key
        },
        ts: Date.now() - 10_000 + i
      };
    }
  }

  // Backed by localStorage (rather than an in-memory literal) so settings
  // actually round-trip across a page.reload() within a test, the same way
  // the real desktop/web bridges persist them — needed to exercise the Rate
  // screen's genre dials surviving a "session" like recommendationDials
  // already does.
  const SETTINGS_KEY = "mock-dossier-settings";
  const baseSettings: Record<string, unknown> = {
    theme: "system", dyslexiaMode: false, startOnLogin: false, autoUpdatesEnabled: true,
    skippedUpdateVersion: null, sidebarCollapsed: false, showingWelcome: false
  };
  function loadSettings(): Record<string, unknown> {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      return raw ? JSON.parse(raw) : { ...baseSettings };
    } catch {
      return { ...baseSettings };
    }
  }
  function saveSettings(next: Record<string, unknown>): Record<string, unknown> {
    const merged = { ...loadSettings(), ...next };
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
    } catch {
      // ignore
    }
    return merged;
  }

  (window as unknown as { dossier: unknown }).dossier = {
    platform: "app",
    app: { getVersion: () => Promise.resolve("0.0.0-test") },
    window: { show: () => Promise.resolve(), hide: () => Promise.resolve(), quit: () => Promise.resolve() },
    updater: { installAndRestart: () => Promise.resolve() },
    settings: {
      get: () => Promise.resolve(loadSettings()),
      set: (next: Record<string, unknown>) => {
        return Promise.resolve(saveSettings(next));
      },
      getStartOnLogin: () => Promise.resolve(false),
      setStartOnLogin: (e: boolean) => Promise.resolve(e)
    },
    preferences: {
      get: () => Promise.resolve({ ratings, pairwise, skipped }),
      setRating: (key: string, rating: number | null, item: unknown) => {
        if (rating === null) delete ratings[key];
        else ratings[key] = { rating, item, ts: Date.now() };
        return Promise.resolve({ ratings });
      },
      addPairwise: (winnerKey: string, loserKey: string) => {
        pairwise = [...pairwise, { winnerKey, loserKey, ts: Date.now() }];
        return Promise.resolve({ pairwise });
      },
      skip: (key: string) => { if (!skipped.includes(key)) skipped = [...skipped, key]; return Promise.resolve({ skipped }); },
      unskip: (key: string) => { skipped = skipped.filter((k) => k !== key); return Promise.resolve({ skipped }); },
      reset: () => { ratings = {}; pairwise = []; skipped = []; return Promise.resolve({ ok: true }); }
    },
    tmdb: {
      status: () => Promise.resolve({ configured: true }),
      setToken: () => Promise.resolve({ configured: true }),
      clearToken: () => Promise.resolve({ configured: false }),
      genres: () => Promise.resolve({ genres: genreNames }),
      trending: () => list(pool),
      discover: () => list(pool),
      search: () => list(pool.slice(0, 1)),
      detail: (_m: string, id: number) => Promise.resolve(pool.find((p) => p.id === id) ?? pool[0]),
      posterUrl: () => null
    },
    library: {
      export: () => Promise.resolve("{}"),
      import: () => Promise.resolve()
    }
  };
}
