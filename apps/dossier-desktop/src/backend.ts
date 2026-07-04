import { randomBytes } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { existsSync, mkdirSync, appendFileSync } from "node:fs";
import { join } from "node:path";

let logPath = "";
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

function log(...args: any[]) {
  const msg = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' ');
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  if (logPath) {
    try {
      appendFileSync(logPath, line);
    } catch {
      // ignore
    }
  } else {
    originalConsoleLog(...args);
  }
}

function logError(...args: any[]) {
  const msg = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, (key, value) => value instanceof Error ? { name: value.name, message: value.message, stack: value.stack } : value, 2) : String(arg)).join(' ');
  const line = `[${new Date().toISOString()}] ERROR: ${msg}\n`;
  if (logPath) {
    try {
      appendFileSync(logPath, line);
    } catch {
      // ignore
    }
  } else {
    originalConsoleError(...args);
  }
}

// Global redirection
console.log = log;
console.error = logError;

import { pathToFileURL } from "node:url";

/** TMDB media kinds. Kept as a local union so the backend has no direct
 * import of @dossier/domain — all domain logic flows through the
 * dynamically-loaded @dossier/store module (see loadStoreModule). */
type TmdbMedium = "movie" | "tv";

type DossierSettings = {
  theme: string;
  dyslexiaMode: boolean;
  startOnLogin: boolean;
  autoUpdatesEnabled: boolean;
  skippedUpdateVersion: string | null;
  sidebarCollapsed: boolean;
  showingWelcome: boolean;
  groupedRecommendations: boolean;
  recommendationDials: Record<string, number>;
  refineGroupSize: number;
  rateGenreDials: Record<string, number>;
  rateGenrePatternState: Record<string, { baseline: number; threshold: number }>;
  [key: string]: unknown;
};

const defaultSettings: DossierSettings = {
  theme: "system",
  dyslexiaMode: false,
  startOnLogin: false,
  autoUpdatesEnabled: true,
  skippedUpdateVersion: null,
  sidebarCollapsed: false,
  showingWelcome: true,
  groupedRecommendations: false,
  recommendationDials: {},
  refineGroupSize: 2,
  rateGenreDials: {},
  rateGenrePatternState: {}
};

type BackendReadyPayload = {
  type: "ready";
  controlPort: number;
  controlToken: string;
};

type Rating = -3 | -2 | -1 | -0.5 | 0 | 0.5 | 1 | 2 | 3;
/** Mirrors @dossier/domain's Rating union — kept as a literal set here too
 * since the backend has no direct domain import (see the Rating comment
 * above). Keep in sync with packages/domain/src/store/model.ts and
 * apps/dossier-ui/src/lib/types.ts. */
const VALID_RATINGS = new Set<number>([-3, -2, -1, -0.5, 0, 0.5, 1, 2, 3]);
type RatedItem = {
  key: string;
  medium: string;
  id: number;
  title: string;
  year: number | null;
  posterPath: string | null;
  voteAverage: number | null;
  genres: string[];
  features: Record<string, number>;
};
type RatingEntry = { rating: Rating; item: RatedItem; ts: number };
type RatingsMap = Record<string, RatingEntry>;
type PairwiseChoice = { winnerKey: string; loserKey: string; ts: number };

type StoreServicePort = {
  getSettings: () => Record<string, unknown>;
  updateSettings: (next: Record<string, unknown>) => Record<string, unknown>;
  getRatings: () => RatingsMap;
  setRating: (key: string, rating: Rating | null, item?: RatedItem) => RatingsMap;
  getPairwise: () => PairwiseChoice[];
  addPairwise: (choice: PairwiseChoice) => PairwiseChoice[];
  getSkipped: () => string[];
  addSkipped: (key: string) => string[];
  removeSkipped: (key: string) => string[];
  resetPreferences: () => void;
  getDataPath: (...parts: string[]) => string;
  getTmdbToken: () => Promise<string | null>;
  setTmdbToken: (token: string) => Promise<void>;
  clearTmdbToken: () => Promise<void>;
  exportLibrary: (passphrase: string) => Promise<string>;
  importLibrary: (fileContent: string, passphrase: string) => Promise<void>;
};

/** The subset of the TMDB client (from @dossier/domain, constructed by the
 * store module) that the control server uses. */
type TmdbClientPort = {
  validate: () => Promise<void>;
  genres: (medium: TmdbMedium) => Promise<Map<number, string>>;
  trending: (medium: TmdbMedium, page?: number) => Promise<unknown>;
  discover: (
    medium: TmdbMedium,
    params: {
      sortBy?: string | undefined;
      withGenres?: string | undefined;
      minVotes?: number | undefined;
      page?: number | undefined;
    }
  ) => Promise<unknown>;
  search: (medium: TmdbMedium, query: string, year?: number) => Promise<unknown>;
  detail: (medium: TmdbMedium, id: number) => Promise<unknown>;
};

/** The dynamically-loaded @dossier/store module surface used by the backend. */
type StoreModulePort = {
  DossierStoreService: { init: (dataDir: string) => Promise<StoreServicePort> };
  createTmdbClient: (token: string, cacheDir: string) => TmdbClientPort;
  TmdbConfigError: new (message?: string) => Error;
  PortableImportError: new (message?: string) => Error;
};

type ControlErrorCode = "BAD_REQUEST" | "NOT_FOUND" | "UNAUTHORIZED" | "INTERNAL";

class ControlError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ControlErrorCode,
    message: string
  ) {
    super(message);
  }
}

const CONTROL_HEADER = "x-dossier-control-token";
const controlToken = randomBytes(24).toString("base64url");

let storeModule: StoreModulePort | null = null;
let storeService: StoreServicePort | null = null;
let settingsCache: DossierSettings = { ...defaultSettings };

/** Cached TMDB client, rebuilt only when the stored token changes. The
 * client owns the long-lived metadata disk cache under the data dir. */
let tmdbClient: { token: string; client: TmdbClientPort } | null = null;

async function getTmdbClient(): Promise<TmdbClientPort> {
  if (!storeService || !storeModule) throw new ControlError(500, "INTERNAL", "store unavailable");
  const token = await storeService.getTmdbToken();
  if (!token) {
    throw new ControlError(400, "BAD_REQUEST", "TMDB token is not configured");
  }
  if (!tmdbClient || tmdbClient.token !== token) {
    tmdbClient = {
      token,
      client: storeModule.createTmdbClient(token, storeService.getDataPath("tmdb-cache"))
    };
  }
  return tmdbClient.client;
}

function parseMedium(value: string | null): TmdbMedium {
  if (value !== "movie" && value !== "tv") {
    throw new ControlError(400, "BAD_REQUEST", "medium must be 'movie' or 'tv'");
  }
  return value;
}

function getHeader(req: IncomingMessage, name: string): string | null {
  const raw = req.headers[name];
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw ?? null;
}

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function sendControlError(res: ServerResponse, error: ControlError): void {
  sendJson(res, error.status, { error: { code: error.code, message: error.message } });
}

function writeReady(payload: BackendReadyPayload): void {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

function authorize(req: IncomingMessage): void {
  const expected = process.env.DOSSIER_CONTROL_TOKEN_OVERRIDE ?? controlToken;
  const token = getHeader(req, CONTROL_HEADER);
  if (!token || token !== expected) {
    throw new ControlError(401, "UNAUTHORIZED", "invalid control token");
  }
}

function persistSettings(next: Partial<DossierSettings>): DossierSettings {
  settingsCache = { ...settingsCache, ...next };
  storeService?.updateSettings(settingsCache);
  return settingsCache;
}

function createControlRequestHandler() {
  return async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const method = req.method ?? "GET";
    const rawUrl = req.url ?? "/";
    const path = rawUrl.split("?")[0] ?? "/";
    const query = new URLSearchParams(rawUrl.split("?")[1] ?? "");

    try {
      authorize(req);

      if (method === "GET" && path === "/control/app/version") {
        sendJson(res, 200, { version: process.env.DOSSIER_APP_VERSION ?? "0.0.0" });
        return;
      }

      if (method === "GET" && path === "/control/settings") {
        sendJson(res, 200, settingsCache);
        return;
      }

      if (method === "PUT" && path === "/control/settings") {
        const body = (await readJsonBody(req)) as { next?: Partial<DossierSettings> };
        if (!body || typeof body !== "object" || !body.next || typeof body.next !== "object") {
          throw new ControlError(400, "BAD_REQUEST", "next settings payload is required");
        }
        sendJson(res, 200, persistSettings(body.next));
        return;
      }

      if (method === "GET" && path === "/control/preferences") {
        if (!storeService) throw new ControlError(500, "INTERNAL", "store unavailable");
        sendJson(res, 200, {
          ratings: storeService.getRatings(),
          pairwise: storeService.getPairwise(),
          skipped: storeService.getSkipped()
        });
        return;
      }

      if (method === "PUT" && path === "/control/preferences/rating") {
        if (!storeService) throw new ControlError(500, "INTERNAL", "store unavailable");
        const body = (await readJsonBody(req)) as {
          key?: string;
          rating?: number | null;
          item?: RatedItem;
        };
        if (!body || typeof body.key !== "string") {
          throw new ControlError(400, "BAD_REQUEST", "key (string) required");
        }
        const r = body.rating;
        if (r !== null && (r === undefined || !VALID_RATINGS.has(r))) {
          throw new ControlError(
            400,
            "BAD_REQUEST",
            "rating must be one of -3, -2, -1, -0.5, 0, 0.5, 1, 2, 3, or null"
          );
        }
        sendJson(res, 200, {
          ratings: storeService.setRating(body.key, r as Rating | null, body.item)
        });
        return;
      }

      if (method === "POST" && path === "/control/preferences/pairwise") {
        if (!storeService) throw new ControlError(500, "INTERNAL", "store unavailable");
        const body = (await readJsonBody(req)) as Partial<PairwiseChoice>;
        if (!body || typeof body.winnerKey !== "string" || typeof body.loserKey !== "string") {
          throw new ControlError(400, "BAD_REQUEST", "winnerKey and loserKey required");
        }
        const choice: PairwiseChoice = {
          winnerKey: body.winnerKey,
          loserKey: body.loserKey,
          ts: typeof body.ts === "number" ? body.ts : Date.now()
        };
        sendJson(res, 200, { pairwise: storeService.addPairwise(choice) });
        return;
      }

      if (method === "POST" && path === "/control/preferences/skip") {
        if (!storeService) throw new ControlError(500, "INTERNAL", "store unavailable");
        const body = (await readJsonBody(req)) as { key?: string };
        if (!body || typeof body.key !== "string") {
          throw new ControlError(400, "BAD_REQUEST", "key (string) required");
        }
        sendJson(res, 200, { skipped: storeService.addSkipped(body.key) });
        return;
      }

      if (method === "POST" && path === "/control/preferences/unskip") {
        if (!storeService) throw new ControlError(500, "INTERNAL", "store unavailable");
        const body = (await readJsonBody(req)) as { key?: string };
        if (!body || typeof body.key !== "string") {
          throw new ControlError(400, "BAD_REQUEST", "key (string) required");
        }
        sendJson(res, 200, { skipped: storeService.removeSkipped(body.key) });
        return;
      }

      if (method === "POST" && path === "/control/preferences/reset") {
        if (!storeService) throw new ControlError(500, "INTERNAL", "store unavailable");
        storeService.resetPreferences();
        sendJson(res, 200, { ok: true });
        return;
      }

      // --- TMDB ----------------------------------------------------------
      if (method === "GET" && path === "/control/tmdb/status") {
        if (!storeService) throw new ControlError(500, "INTERNAL", "store unavailable");
        const token = await storeService.getTmdbToken();
        sendJson(res, 200, { configured: Boolean(token) });
        return;
      }

      if (method === "PUT" && path === "/control/tmdb/token") {
        log("PUT /control/tmdb/token received");
        if (!storeService || !storeModule) throw new ControlError(500, "INTERNAL", "store unavailable");
        const body = (await readJsonBody(req)) as { token?: string };
        log(`token length in body: ${body?.token?.length ?? "undefined"}`);
        
        let token = typeof body?.token === "string" ? body.token.trim() : "";
        token = token.replace(/[\u200B-\u200D\uFEFF]/g, "");
        token = token.replace(/^["']|["']$/g, "");
        if (token.toLowerCase().startsWith("bearer ")) {
          token = token.slice(7).trim();
          token = token.replace(/^["']|["']$/g, "");
        }
        
        log(`cleaned token length: ${token.length}`);
        if (!token) {
          logError("token missing after cleaning");
          throw new ControlError(400, "BAD_REQUEST", "token (string) required");
        }
        
        // Validate against TMDB before persisting so a bad token never sticks.
        try {
          log("probing TMDB with token...");
          const probe = storeModule.createTmdbClient(token, storeService.getDataPath("tmdb-cache"));
          await probe.validate();
          log("TMDB probe successful");
        } catch (error) {
          logError(`TMDB validation failed: ${error instanceof Error ? error.message : String(error)}`);
          if (error instanceof storeModule.TmdbConfigError) {
            throw new ControlError(400, "BAD_REQUEST", error.message);
          }
          throw error;
        }
        await storeService.setTmdbToken(token);
        tmdbClient = null; // force rebuild with the new token
        log("token persisted to keychain");
        sendJson(res, 200, { configured: true });
        return;
      }

      if (method === "POST" && path === "/control/tmdb/token/clear") {
        if (!storeService) throw new ControlError(500, "INTERNAL", "store unavailable");
        await storeService.clearTmdbToken();
        tmdbClient = null;
        sendJson(res, 200, { configured: false });
        return;
      }

      if (method === "GET" && path === "/control/tmdb/genres") {
        const client = await getTmdbClient();
        const map = await client.genres(parseMedium(query.get("medium")));
        sendJson(res, 200, { genres: Object.fromEntries(map) });
        return;
      }

      if (method === "GET" && path === "/control/tmdb/trending") {
        const client = await getTmdbClient();
        const page = Number(query.get("page") ?? "1") || 1;
        sendJson(res, 200, await client.trending(parseMedium(query.get("medium")), page));
        return;
      }

      if (method === "GET" && path === "/control/tmdb/discover") {
        const client = await getTmdbClient();
        sendJson(
          res,
          200,
          await client.discover(parseMedium(query.get("medium")), {
            sortBy: query.get("sortBy") ?? undefined,
            withGenres: query.get("withGenres") ?? undefined,
            minVotes: query.get("minVotes") ? Number(query.get("minVotes")) : undefined,
            page: query.get("page") ? Number(query.get("page")) : undefined
          })
        );
        return;
      }

      if (method === "GET" && path === "/control/tmdb/search") {
        const client = await getTmdbClient();
        const q = query.get("query") ?? "";
        if (!q.trim()) throw new ControlError(400, "BAD_REQUEST", "query required");
        const year = query.get("year") ? Number(query.get("year")) : undefined;
        sendJson(res, 200, await client.search(parseMedium(query.get("medium")), q, year));
        return;
      }

      if (method === "GET" && path === "/control/tmdb/detail") {
        const client = await getTmdbClient();
        const id = Number(query.get("id"));
        if (!Number.isFinite(id)) throw new ControlError(400, "BAD_REQUEST", "id required");
        sendJson(res, 200, await client.detail(parseMedium(query.get("medium")), id));
        return;
      }

      // --- Library export / import (the bridge to/from the web build) ----
      if (method === "POST" && path === "/control/library/export") {
        if (!storeService) throw new ControlError(500, "INTERNAL", "store unavailable");
        const body = (await readJsonBody(req)) as { passphrase?: string };
        if (!body || typeof body.passphrase !== "string" || !body.passphrase) {
          throw new ControlError(400, "BAD_REQUEST", "passphrase (string) required");
        }
        const file = await storeService.exportLibrary(body.passphrase);
        sendJson(res, 200, { file });
        return;
      }

      if (method === "POST" && path === "/control/library/import") {
        if (!storeService || !storeModule) throw new ControlError(500, "INTERNAL", "store unavailable");
        const body = (await readJsonBody(req)) as { fileContent?: string; passphrase?: string };
        if (!body || typeof body.fileContent !== "string" || typeof body.passphrase !== "string") {
          throw new ControlError(400, "BAD_REQUEST", "fileContent and passphrase (strings) required");
        }
        try {
          await storeService.importLibrary(body.fileContent, body.passphrase);
        } catch (error) {
          if (error instanceof storeModule.PortableImportError) {
            throw new ControlError(400, "BAD_REQUEST", error.message);
          }
          throw error;
        }
        // Surface the freshly imported library so the UI can rehydrate.
        sendJson(res, 200, {
          ok: true,
          ratings: storeService.getRatings(),
          pairwise: storeService.getPairwise(),
          skipped: storeService.getSkipped()
        });
        return;
      }

      if (method === "POST" && path === "/control/shutdown") {
        sendJson(res, 200, { ok: true });
        process.nextTick(() => process.exit(0));
        return;
      }

      throw new ControlError(404, "NOT_FOUND", "not found");
    } catch (error) {
      logError(`Request handler error: ${error instanceof Error ? error.message : String(error)}`);
      if (error instanceof ControlError) {
        sendControlError(res, error);
        return;
      }
      if (storeModule && error instanceof storeModule.TmdbConfigError) {
        sendControlError(res, new ControlError(400, "BAD_REQUEST", error.message));
        return;
      }
      sendControlError(
        res,
        new ControlError(500, "INTERNAL", error instanceof Error ? error.message : "unknown")
      );
    }
  };
}

async function loadStoreModule(): Promise<StoreModulePort> {
  const candidates = [
    process.env.DOSSIER_PACKAGES_ROOT,
    join(process.cwd(), "packages"),
    join(process.cwd(), "..", "packages"),
    join(process.cwd(), "..", "..", "..", "packages")
  ].filter((c): c is string => Boolean(c));

  for (const root of candidates) {
    const storePath = join(root, "store", "dist", "index.js");
    if (!existsSync(storePath)) continue;
    const mod = await import(pathToFileURL(storePath).href);
    return mod as StoreModulePort;
  }

  throw new Error(
    `Unable to resolve @dossier/store dist output. Checked: ${candidates.join(", ")}`
  );
}

async function bootstrap(): Promise<void> {
  const inputDataDir = process.argv[2];
  if (!inputDataDir) {
    throw new Error("Backend bootstrap requires a data directory argument");
  }

  const dataDir = join(inputDataDir, "dossier");
  mkdirSync(dataDir, { recursive: true });
  logPath = join(dataDir, "backend-debug.log");
  log("Backend bootstrapping...");

  storeModule = await loadStoreModule();
  storeService = await storeModule.DossierStoreService.init(dataDir);
  settingsCache = {
    ...defaultSettings,
    ...(storeService.getSettings() as Partial<DossierSettings>)
  };
  storeService.updateSettings(settingsCache);

  const controlServer = createServer(createControlRequestHandler());

  await new Promise<void>((resolve, reject) => {
    controlServer.once("error", reject);
    controlServer.listen(0, "127.0.0.1", () => resolve());
  });

  const address = controlServer.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to start control server");
  }

  writeReady({ type: "ready", controlPort: address.port, controlToken });

  const shutdown = (): void => {
    controlServer.close(() => process.exit(0));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

if (process.env.DOSSIER_BACKEND_SKIP_BOOTSTRAP !== "1") {
  void bootstrap().catch((error) => {
    logError(`Failed to bootstrap Dossier backend daemon: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}
