/** Injects a fake `window.dossier` bridge so the SvelteKit app (which
 * normally talks to the Tauri shell) can be exercised in a plain
 * browser for visual review. Stateful enough for ratings to round-trip. */
export function installMockDossier(): void {
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
  const mk = (title: string, over: Record<string, number>, genres: string[]) => ({
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
    keywords: [],
    features: feat(over)
  });
  const pool = [
    mk("Neon Vector", { pacing: 0.9, tone: -0.3, realism: 0.8 }, ["Action", "Science Fiction"]),
    mk("Quiet Harbor", { tone: 0.4, emotional_intensity: 0.7, scope: -0.5 }, ["Drama", "Romance"]),
    mk("The Long Joke", { tone: 1, thematic_weight: -0.4 }, ["Comedy"]),
    mk("Midnight Ledger", { tone: -0.6, moral_clarity: -0.5, complexity: 0.6 }, ["Crime", "Drama"]),
    mk("Starfall Saga", { scope: 1, realism: 0.7, pacing: 0.5 }, ["Science Fiction", "Action"]),
    mk("Paper Houses", { emotional_intensity: 0.6, tone: -0.2, character_focus: 0.5 }, ["Drama"]),
    mk("Crimson Hour", { tone: -0.8, emotional_intensity: 0.5 }, ["Horror"]),
    mk("Sunday Drive", { tone: 0.7, pacing: -0.4 }, ["Comedy", "Romance"]),
    mk("Iron Verdict", { pacing: 0.7, moral_clarity: 0.4 }, ["Action", "Crime"]),
    mk("Glass Forest", { complexity: 0.8, structure: 0.6, realism: 0.4 }, ["Science Fiction", "Drama"])
  ];

  let ratings: Record<string, unknown> = {};
  let pairwise: unknown[] = [];
  let skipped: string[] = [];
  const list = (items: unknown[]) => Promise.resolve({ page: 1, totalPages: 1, items });

  (window as unknown as { dossier: unknown }).dossier = {
    app: { getVersion: () => Promise.resolve("0.0.0-test") },
    window: { show: () => Promise.resolve(), hide: () => Promise.resolve(), quit: () => Promise.resolve() },
    updater: { installAndRestart: () => Promise.resolve() },
    settings: {
      get: () => Promise.resolve({ theme: "system", dyslexiaMode: false, startOnLogin: false, autoUpdatesEnabled: true, skippedUpdateVersion: null, sidebarCollapsed: false, showingWelcome: false }),
      set: (next: Record<string, unknown>) => Promise.resolve(next),
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
    }
  };
}
