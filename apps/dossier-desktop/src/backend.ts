import { randomBytes } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

type DossierSettings = {
  theme: string;
  dyslexiaMode: boolean;
  startOnLogin: boolean;
  autoUpdatesEnabled: boolean;
  skippedUpdateVersion: string | null;
  sidebarCollapsed: boolean;
  showingWelcome: boolean;
  [key: string]: unknown;
};

const defaultSettings: DossierSettings = {
  theme: "system",
  dyslexiaMode: false,
  startOnLogin: false,
  autoUpdatesEnabled: true,
  skippedUpdateVersion: null,
  sidebarCollapsed: false,
  showingWelcome: true
};

type BackendReadyPayload = {
  type: "ready";
  controlPort: number;
  controlToken: string;
};

type StoreServicePort = {
  getSettings: () => Record<string, unknown>;
  updateSettings: (next: Record<string, unknown>) => Record<string, unknown>;
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

let storeService: StoreServicePort | null = null;
let settingsCache: DossierSettings = { ...defaultSettings };

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
    const path = (req.url ?? "/").split("?")[0] ?? "/";

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

      if (method === "POST" && path === "/control/shutdown") {
        sendJson(res, 200, { ok: true });
        process.nextTick(() => process.exit(0));
        return;
      }

      throw new ControlError(404, "NOT_FOUND", "not found");
    } catch (error) {
      if (error instanceof ControlError) {
        sendControlError(res, error);
        return;
      }
      sendControlError(
        res,
        new ControlError(500, "INTERNAL", error instanceof Error ? error.message : "unknown")
      );
    }
  };
}

async function loadStoreService(dataDir: string): Promise<StoreServicePort> {
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
    return (await mod.DossierStoreService.init(dataDir)) as StoreServicePort;
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

  storeService = await loadStoreService(dataDir);
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
    console.error("Failed to bootstrap Dossier backend daemon", error);
    process.exit(1);
  });
}
