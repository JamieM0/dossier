import type {
  DossierSettings,
  PairwiseChoice,
  PreferencesPayload,
  RatedItem,
  Rating,
  RatingEntry,
  TmdbItem,
  TmdbListResult,
  TmdbMedium
} from "$lib/types";

/** Remote clients talk only to the dedicated paired-device gateway. The
 * localhost control token and host-only endpoints are deliberately absent. */
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    credentials: "same-origin",
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) }
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    throw new Error(payload?.error?.message ?? `Dossier gateway returned ${response.status}`);
  }
  return response.json() as Promise<T>;
}

function body(value: unknown): RequestInit {
  return { method: "POST", body: JSON.stringify(value) };
}

function hostOnly(): Promise<never> {
  return Promise.reject(new Error("This action can only be completed on the Dossier host PC."));
}

function posterUrl(posterPath: string | null, size = "w780"): string | null {
  if (!posterPath) return null;
  return `/api/posters/${encodeURIComponent(size)}/${encodeURIComponent(posterPath.replace(/^\//, ""))}`;
}

export function installRemoteApi(): void {
  if (typeof window === "undefined" || window.dossier) return;
  window.dossier = {
    platform: "remote",
    app: { getVersion: () => api<{ version: string }>("/app/version").then((r) => r.version) },
    window: { show: hostOnly, hide: hostOnly, quit: hostOnly },
    updater: { installAndRestart: hostOnly, checkForUpdate: () => Promise.resolve(null) },
    settings: {
      get: () => api<DossierSettings>("/settings"),
      set: (next) => {
        const { theme, dyslexiaMode, groupedRecommendations, refineGroupSize } = next;
        return api<DossierSettings>("/settings", body({ theme, dyslexiaMode, groupedRecommendations, refineGroupSize }));
      },
      getStartOnLogin: () => Promise.resolve(false),
      setStartOnLogin: hostOnly
    },
    preferences: {
      get: () => api<PreferencesPayload>("/preferences"),
      setRating: (key: string, rating: Rating | null, item?: RatedItem) =>
        api<{ ratings: Record<string, RatingEntry> }>("/preferences/rating", body({ key, rating, item })),
      addPairwise: (winnerKey: string, loserKey: string) =>
        api<{ pairwise: PairwiseChoice[] }>("/preferences/pairwise", body({ winnerKey, loserKey })),
      skip: (key: string) => api<{ skipped: string[] }>("/preferences/skip", body({ key })),
      unskip: (key: string) => api<{ skipped: string[] }>("/preferences/unskip", body({ key })),
      reset: hostOnly
    },
    tmdb: {
      status: () => api<{ configured: boolean }>("/tmdb/status"),
      setToken: hostOnly,
      clearToken: hostOnly,
      genres: (medium: TmdbMedium) => api<{ genres: Record<string, string> }>(`/tmdb/genres?medium=${medium}`),
      trending: (medium: TmdbMedium, page = 1) => api<TmdbListResult>(`/tmdb/trending?medium=${medium}&page=${page}`),
      discover: (medium: TmdbMedium, params = {}) => {
        const query = new URLSearchParams({ medium });
        for (const [key, value] of Object.entries(params)) if (value !== undefined) query.set(key, String(value));
        return api<TmdbListResult>(`/tmdb/discover?${query}`);
      },
      search: (medium: TmdbMedium, query: string, year?: number) =>
        api<TmdbListResult>(`/tmdb/search?medium=${medium}&query=${encodeURIComponent(query)}${year ? `&year=${year}` : ""}`),
      detail: (medium: TmdbMedium, id: number) => api<TmdbItem>(`/tmdb/detail?medium=${medium}&id=${id}`),
      posterUrl
    },
    library: { export: hostOnly, import: hostOnly }
  };
}
