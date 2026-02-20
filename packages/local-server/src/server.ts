import { createHash, randomBytes, randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { URL } from "node:url";
import { DossierStoreService } from "@dossier/store";
import type { PairingSession, LocalServerConfig } from "./types.js";

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

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
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown);
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, statusCode: number, body: unknown, extraHeaders: Record<string, string> = {}): void {
  res.writeHead(statusCode, { ...JSON_HEADERS, ...extraHeaders });
  res.end(JSON.stringify(body));
}

function randomToken(length = 48): string {
  return randomBytes(length).toString("base64url");
}

function hashNonce(nonce: string): string {
  return createHash("sha256").update(nonce).digest("hex");
}

export class LocalProfileServer extends EventEmitter {
  private readonly config: LocalServerConfig;
  private readonly pairings = new Map<string, PairingSession>();
  private readonly usedNonces = new Map<string, number>();
  private server = createServer(this.requestHandler.bind(this));

  constructor(private readonly storeService: DossierStoreService, config?: Partial<LocalServerConfig>) {
    super();
    this.config = {
      host: "127.0.0.1",
      port: 34250,
      allowedOrigins: ["https://getperspectives.app"],
      requiredHeaderName: "x-dossier-client",
      requiredHeaderValue: "perspectives",
      ...config
    };
  }

  async start(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.server.listen(this.config.port, this.config.host, () => resolve());
      this.server.once("error", reject);
    });
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }

  private async requestHandler(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const method = req.method ?? "GET";
    const reqUrl = new URL(req.url ?? "/", `http://${this.config.host}:${this.config.port}`);

    if (method === "OPTIONS") {
      this.handleCorsPreflight(req, res);
      return;
    }

    if (reqUrl.pathname === "/health") {
      sendJson(res, 200, { ok: true, host: this.config.host, port: this.config.port });
      return;
    }

    try {
      if (method === "POST" && reqUrl.pathname === "/v1/pairing/start") {
        const code = randomToken(8);
        this.pairings.set(code, {
          code,
          createdAt: Date.now(),
          expiresAt: Date.now() + 3 * 60 * 1000
        });
        sendJson(res, 200, { code, expires_in_seconds: 180 });
        return;
      }

      if (method === "POST" && reqUrl.pathname === "/v1/pairing/complete") {
        const payload = (await readJsonBody(req)) as {
          code?: string;
          service_id?: string;
          allowed_origin?: string;
        };

        if (!payload.code || !payload.service_id || !payload.allowed_origin) {
          sendJson(res, 400, { error: "code, service_id, and allowed_origin are required" });
          return;
        }

        const pairing = this.pairings.get(payload.code);
        if (!pairing || Date.now() > pairing.expiresAt) {
          sendJson(res, 401, { error: "pairing code invalid or expired" });
          return;
        }

        const token = randomToken();
        const tokenHash = this.storeService.keyManager.hashToken(token);

        this.storeService.repository.pairService({
          serviceId: payload.service_id,
          tokenHash,
          allowedOrigins: [payload.allowed_origin],
          tokenExpiresAt: null
        });

        this.pairings.delete(payload.code);

        sendJson(res, 200, {
          service_id: payload.service_id,
          token,
          token_type: "Bearer"
        });
        return;
      }

      if (method === "POST" && reqUrl.pathname.match(/^\/v1\/services\/[a-z0-9-]+\/revoke$/i)) {
        const auth = this.authorize(req, res);
        if (!auth.ok) {
          return;
        }

        const serviceId = reqUrl.pathname.split("/")[3] as string;
        this.storeService.repository.revokeService(serviceId);
        sendJson(res, 200, { revoked: true, service_id: serviceId });
        return;
      }

      if (method === "POST" && reqUrl.pathname === "/v1/consent-requests") {
        const auth = this.authorize(req, res);
        if (!auth.ok) {
          return;
        }

        const rateCount = this.storeService.repository.recordRateLimit(`consent:${auth.serviceId}`);
        if (rateCount > 30) {
          sendJson(res, 429, { error: "rate limit exceeded" });
          return;
        }

        const payload = (await readJsonBody(req)) as Record<string, unknown>;
        const nonce = String(payload.nonce ?? "");
        if (!nonce || nonce.length < 16) {
          sendJson(res, 400, { error: "nonce is required and must be at least 16 characters" });
          return;
        }

        const nonceHash = hashNonce(nonce);
        const now = Date.now();
        const existingNonceExpiry = this.usedNonces.get(nonceHash);
        if (existingNonceExpiry && existingNonceExpiry > now) {
          sendJson(res, 409, { error: "nonce replay detected" });
          return;
        }
        this.usedNonces.set(nonceHash, now + 5 * 60 * 1000);

        const request = this.storeService.repository.createConsentRequest(payload, auth.serviceId);
        const preview = this.storeService.repository.buildConsentPreview(request);
        this.emit("consent:request", { ...request, preview_items: preview });

        sendJson(res, 201, { ...request, preview_items: preview });
        return;
      }

      if (method === "GET" && reqUrl.pathname.match(/^\/v1\/consent-requests\/[a-z0-9-]+$/i)) {
        const auth = this.authorize(req, res);
        if (!auth.ok) {
          return;
        }

        const requestId = reqUrl.pathname.split("/").pop() as string;
        const request = this.storeService.repository.getConsentRequest(requestId);

        if (!request || request.service_id !== auth.serviceId) {
          sendJson(res, 404, { error: "consent request not found" });
          return;
        }

        const preview = this.storeService.repository.buildConsentPreview(request);
        sendJson(res, 200, { ...request, preview_items: preview });
        return;
      }

      if (method === "POST" && reqUrl.pathname.match(/^\/v1\/consent-requests\/[a-z0-9-]+\/decision$/i)) {
        const auth = this.authorize(req, res);
        if (!auth.ok) {
          return;
        }

        const requestId = reqUrl.pathname.split("/")[3] as string;
        const request = this.storeService.repository.getConsentRequest(requestId);
        if (!request || request.service_id !== auth.serviceId) {
          sendJson(res, 404, { error: "consent request not found" });
          return;
        }

        const payload = await readJsonBody(req);
        const decision = this.storeService.repository.decideConsent(requestId, payload);
        sendJson(res, 200, decision);
        return;
      }

      if (method === "GET" && reqUrl.pathname.match(/^\/v1\/consent-requests\/[a-z0-9-]+\/disclosure$/i)) {
        const auth = this.authorize(req, res);
        if (!auth.ok) {
          return;
        }

        const requestId = reqUrl.pathname.split("/")[3] as string;
        const request = this.storeService.repository.getConsentRequest(requestId);
        if (!request || request.service_id !== auth.serviceId) {
          sendJson(res, 404, { error: "consent request not found" });
          return;
        }

        const payload = this.storeService.repository.getDisclosurePayload(requestId);
        if (!payload) {
          sendJson(res, 403, { error: "disclosure denied: no ALLOW decision" });
          return;
        }

        this.storeService.repository.createDisclosure(requestId, payload);
        sendJson(res, 200, payload);
        return;
      }

      if (method === "GET" && reqUrl.pathname === "/v1/audit") {
        const auth = this.authorize(req, res);
        if (!auth.ok) {
          return;
        }

        const serviceId = reqUrl.searchParams.get("service");
        const itemId = reqUrl.searchParams.get("item");
        const type = reqUrl.searchParams.get("type");
        const filters: { serviceId?: string; itemId?: string; type?: string } = {};
        if (serviceId) {
          filters.serviceId = serviceId;
        }
        if (itemId) {
          filters.itemId = itemId;
        }
        if (type) {
          filters.type = type;
        }

        const events = this.storeService.repository.listAudit(filters);

        sendJson(res, 200, {
          count: events.length,
          events
        });
        return;
      }

      sendJson(res, 404, { error: "not found" });
    } catch (error) {
      sendJson(res, 500, {
        error: "internal server error",
        reason: error instanceof Error ? error.message : "unknown"
      });
    }
  }

  private authorize(req: IncomingMessage, res: ServerResponse): { ok: true; serviceId: string } | { ok: false } {
    const origin = req.headers.origin;
    const authHeader = req.headers.authorization;
    const requiredHeaderRaw = req.headers[this.config.requiredHeaderName];
    const requiredHeader = Array.isArray(requiredHeaderRaw) ? requiredHeaderRaw[0] : requiredHeaderRaw;

    if (!origin || !this.config.allowedOrigins.includes(origin)) {
      sendJson(res, 403, { error: "origin not allowed" }, { "access-control-allow-origin": "null" });
      return { ok: false };
    }

    if (requiredHeader !== this.config.requiredHeaderValue) {
      sendJson(res, 403, { error: `${this.config.requiredHeaderName} header missing or invalid` });
      return { ok: false };
    }

    if (!authHeader?.startsWith("Bearer ")) {
      sendJson(res, 401, { error: "missing bearer token" });
      return { ok: false };
    }

    const token = authHeader.slice("Bearer ".length);
    const tokenHash = this.storeService.keyManager.hashToken(token);
    const pairing = this.storeService.repository.getPairingByTokenHash(tokenHash);

    if (!pairing) {
      sendJson(res, 401, { error: "invalid token" });
      return { ok: false };
    }

    if (!pairing.allowed_origins_json.includes(origin)) {
      sendJson(res, 403, { error: "origin not allowed for token" });
      return { ok: false };
    }

    res.setHeader("access-control-allow-origin", origin);
    res.setHeader("vary", "origin");

    return { ok: true, serviceId: pairing.service_id };
  }

  private handleCorsPreflight(req: IncomingMessage, res: ServerResponse): void {
    const origin = req.headers.origin;
    if (!origin || !this.config.allowedOrigins.includes(origin)) {
      res.writeHead(403, JSON_HEADERS);
      res.end(JSON.stringify({ error: "origin not allowed" }));
      return;
    }

    res.writeHead(204, {
      "access-control-allow-origin": origin,
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": `content-type,authorization,${this.config.requiredHeaderName}`,
      "access-control-max-age": "600",
      vary: "origin"
    });
    res.end();
  }
}
