/** Browser implementation of the `window.dossier` bridge — the no-backend
 * counterpart to installDesktopApi(). Satisfies the same contract
 * (app.d.ts) so the SvelteKit UI is identical across the app and the web
 * build; only the wiring differs. App-only surfaces are no-ops here.
 *
 * All calls delegate to the `webLibrary` singleton (File System Access +
 * passphrase-encrypted vault). They assume the library is already unlocked —
 * WebUnlockGate guarantees that before the app screens mount. */
import type {
  DossierSettings,
  PairwiseChoice,
  PreferencesPayload,
  RatedItem,
  Rating,
  RatingEntry,
  TmdbListResult,
  TmdbItem,
  TmdbMedium
} from "$lib/types";
import { webLibrary } from "./library.js";

/** Poster URLs in the web build point straight at TMDB's public image CDN
 * (the desktop build instead uses the Rust `tmdbimg` disk-cache scheme). */
function posterUrl(posterPath: string | null, size = "w780"): string | null {
  if (!posterPath) return null;
  const file = posterPath.replace(/^\//, "");
  return `https://image.tmdb.org/t/p/${size}/${file}`;
}

export function installWebApi(): void {
  if (typeof window === "undefined" || window.dossier) return;

  window.dossier = {
    platform: "web",
    app: {
      getVersion: (): Promise<string> => Promise.resolve(__APP_VERSION__)
    },
    window: {
      show: (): Promise<void> => Promise.resolve(),
      hide: (): Promise<void> => Promise.resolve(),
      quit: (): Promise<void> => Promise.resolve()
    },
    updater: {
      // The web build can't self-install; +layout.svelte sends the user to
      // the GitHub release page instead, so there's nothing to do here.
      installAndRestart: (): Promise<void> => Promise.resolve(),
      checkForUpdate: checkForWebUpdate
    },
    settings: {
      get: (): Promise<DossierSettings> => Promise.resolve(webLibrary.getSettings() as DossierSettings),
      set: (next: Partial<DossierSettings>): Promise<DossierSettings> =>
        webLibrary.updateSettings(next) as Promise<DossierSettings>,
      getStartOnLogin: (): Promise<boolean> => Promise.resolve(false),
      setStartOnLogin: (): Promise<boolean> => Promise.resolve(false)
    },
    preferences: {
      get: (): Promise<PreferencesPayload> =>
        Promise.resolve({
          ratings: webLibrary.getRatings() as Record<string, RatingEntry>,
          pairwise: webLibrary.getPairwise(),
          skipped: webLibrary.getSkipped()
        }),
      setRating: (
        key: string,
        rating: Rating | null,
        item?: RatedItem
      ): Promise<{ ratings: Record<string, RatingEntry> }> =>
        webLibrary
          .setRating(key, rating, item as never)
          .then((ratings) => ({ ratings: ratings as Record<string, RatingEntry> })),
      addPairwise: (winnerKey: string, loserKey: string): Promise<{ pairwise: PairwiseChoice[] }> =>
        webLibrary
          .addPairwise({ winnerKey, loserKey, ts: Date.now() })
          .then((pairwise) => ({ pairwise })),
      skip: (key: string): Promise<{ skipped: string[] }> =>
        webLibrary.addSkipped(key).then((skipped) => ({ skipped })),
      unskip: (key: string): Promise<{ skipped: string[] }> =>
        webLibrary.removeSkipped(key).then((skipped) => ({ skipped })),
      reset: (): Promise<{ ok: boolean }> => webLibrary.resetPreferences().then(() => ({ ok: true }))
    },
    tmdb: {
      status: (): Promise<{ configured: boolean }> =>
        Promise.resolve({ configured: Boolean(webLibrary.getTmdbToken()) }),
      setToken: async (token: string): Promise<{ configured: boolean }> => {
        const cleaned = cleanToken(token);
        if (!cleaned) throw new Error("token (string) required");
        // Validate against TMDB before persisting so a bad token never sticks.
        await webLibrary.validationClient(cleaned).validate();
        await webLibrary.setTmdbToken(cleaned);
        return { configured: true };
      },
      clearToken: (): Promise<{ configured: boolean }> =>
        webLibrary.clearTmdbToken().then(() => ({ configured: false })),
      genres: async (medium: TmdbMedium): Promise<{ genres: Record<string, string> }> => {
        const map = await webLibrary.tmdbClient().genres(medium);
        return { genres: Object.fromEntries(map) };
      },
      trending: (medium: TmdbMedium, page = 1): Promise<TmdbListResult> =>
        webLibrary.tmdbClient().trending(medium, page) as Promise<TmdbListResult>,
      discover: (
        medium: TmdbMedium,
        params: { sortBy?: string; withGenres?: string; minVotes?: number; page?: number } = {}
      ): Promise<TmdbListResult> =>
        webLibrary.tmdbClient().discover(medium, params) as Promise<TmdbListResult>,
      search: (medium: TmdbMedium, query: string, year?: number): Promise<TmdbListResult> =>
        webLibrary.tmdbClient().search(medium, query, year) as Promise<TmdbListResult>,
      detail: (medium: TmdbMedium, id: number): Promise<TmdbItem> =>
        webLibrary.tmdbClient().detail(medium, id) as Promise<TmdbItem>,
      posterUrl
    },
    library: {
      export: (passphrase: string): Promise<string> => webLibrary.exportLibrary(passphrase),
      import: (fileContent: string, passphrase: string): Promise<void> =>
        webLibrary.importLibrary(fileContent, passphrase)
    }
  };
}

/** Compares dotted numeric versions (e.g. "0.1.17"). Returns true if `a` is
 * strictly newer than `b`. Non-numeric parts compare as 0. */
function isNewerVersion(a: string, b: string): boolean {
  const partsA = a.split(".").map((part) => parseInt(part, 10) || 0);
  const partsB = b.split(".").map((part) => parseInt(part, 10) || 0);
  const len = Math.max(partsA.length, partsB.length);
  for (let i = 0; i < len; i += 1) {
    const diff = (partsA[i] ?? 0) - (partsB[i] ?? 0);
    if (diff !== 0) return diff > 0;
  }
  return false;
}

/** Web has no push-based updater, so it polls the public GitHub Releases API
 * directly (no auth needed for a public repo) and compares against the
 * version baked into this build at compile time. Best-effort: any network
 * failure is swallowed and treated as "no update available". */
async function checkForWebUpdate(): Promise<{ version: string; currentVersion: string } | null> {
  const currentVersion = __APP_VERSION__;
  try {
    const response = await fetch("https://api.github.com/repos/JamieM0/dossier/releases/latest", {
      headers: { Accept: "application/vnd.github+json" }
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { tag_name?: string };
    const tag = payload.tag_name ?? "";
    const latestVersion = tag.replace(/^v/, "");
    if (!latestVersion || !isNewerVersion(latestVersion, currentVersion)) return null;
    return { version: latestVersion, currentVersion };
  } catch {
    return null;
  }
}

/** Strip wrapping quotes, a leading "Bearer ", and zero-width chars from a
 * pasted TMDB token (mirrors the backend's cleaning). */
function cleanToken(input: string): string {
  let token = (input ?? "").trim().replace(/[\u200B-\u200D\uFEFF]/g, "");
  token = token.replace(/^["']|["']$/g, "");
  if (token.toLowerCase().startsWith("bearer ")) {
    token = token.slice(7).trim().replace(/^["']|["']$/g, "");
  }
  return token;
}
