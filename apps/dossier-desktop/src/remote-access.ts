import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { createServer as createHttpServer, type IncomingMessage, type RequestListener, type Server as HttpServer, type ServerResponse } from "node:http";
import { createServer as createHttpsServer, type Server as HttpsServer } from "node:https";
import { networkInterfaces } from "node:os";
import { extname, join, normalize, resolve } from "node:path";
import { createInterface } from "node:readline";
import { generate } from "selfsigned";
import { connect as tlsConnect } from "node:tls";

type Transport = "tailscale" | "direct" | "lan";
type Phase = "idle" | "starting" | "authorizing" | "enabling_funnel" | "verifying" | "ready" | "error";

type StoredDevice = {
  id: string;
  name: string;
  browser: string;
  approvedAt: number;
  lastSeenAt: number;
  tokenHash: string;
};

type PendingDevice = {
  id: string;
  code: string;
  name: string;
  browser: string;
  requestedAt: number;
  approved: boolean;
  sessionToken: string;
};

export type RemoteAccessPublicStatus = {
  phase: Phase;
  transport: Transport | null;
  origin: string | null;
  pairingUrl: string | null;
  authUrl: string | null;
  approvalUrl: string | null;
  error: string | null;
  message: string | null;
  localPort: number | null;
  certificateUrl: string | null;
  pendingDevices: Array<Omit<PendingDevice, "code" | "approved" | "sessionToken">>;
  devices: Array<Omit<StoredDevice, "tokenHash">>;
};

type Settings = Record<string, unknown> & {
  remoteAccess?: {
    enabled?: boolean;
    transport?: Transport | null;
    origin?: string | null;
    devices?: Array<Record<string, unknown>>;
    options?: Record<string, unknown>;
  };
};

/** Preference data a paired device may read and update. Host credentials,
 * device management, and operating-system settings intentionally stay out
 * of this list. Keep this aligned with the remote UI bridge. */
const REMOTE_SETTING_KEYS = [
  "theme", "dyslexiaMode", "groupedRecommendations", "refineGroupSize",
  "mobileRatingInput", "recommendationDials", "rateGenreDials", "rateTagDials", "rateTagPatternState"
] as const;

function remoteSettings(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(REMOTE_SETTING_KEYS.filter((key) => key in value).map((key) => [key, value[key]]));
}

const MIME: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".woff2": "font/woff2"
};

const LAN_HTTPS_PORT = 48731;
const LAN_CERTIFICATE_PORT = 48730;
const MAX_REQUEST_BODY_BYTES = 1_048_576;
const SECURITY_HEADERS: Record<string, string> = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "no-referrer",
  "permissions-policy": "camera=(self), microphone=(), geolocation=()"
};

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("base64url");
}

function lanListenError(error: unknown, port: number): Error {
  if ((error as NodeJS.ErrnoException)?.code === "EADDRINUSE") {
    return new Error(`Dossier's stable LAN port ${port} is already in use. Close any other Dossier instance, then try again.`);
  }
  return error instanceof Error ? error : new Error(String(error));
}

function json(res: ServerResponse, status: number, payload: unknown, headers: Record<string, string> = {}): void {
  res.writeHead(status, { ...SECURITY_HEADERS, "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers });
  res.end(JSON.stringify(payload));
}

async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const bytes = Buffer.from(chunk);
    size += bytes.length;
    if (size > MAX_REQUEST_BODY_BYTES) throw new Error("Request body is too large.");
    chunks.push(bytes);
  }
  if (chunks.length === 0) return {};
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    return value && typeof value === "object" ? value as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function privateIpv4(): string | null {
  const candidates: Array<{ ip: string; score: number }> = [];
  for (const [name, entries] of Object.entries(networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family !== "IPv4" || entry.internal) continue;
      const ip = entry.address;
      if (!(ip.startsWith("10.") || ip.startsWith("192.168.") || /^172\.(1[6-9]|2\d|3[01])\./.test(ip))) continue;
      const preferred = /^(en\d+|eth\d+|wlan\d+|wi-?fi|ethernet)$/i.test(name) ? 20 : 0;
      const virtual = /(bridge|docker|vmnet|vbox|utun|tailscale|hyper-v|vethernet)/i.test(name) ? -20 : 0;
      candidates.push({ ip, score: preferred + virtual });
    }
  }
  return candidates.sort((a, b) => b.score - a.score)[0]?.ip ?? null;
}

function parseCookies(req: IncomingMessage): Record<string, string> {
  return Object.fromEntries((req.headers.cookie ?? "").split(";").map((part) => part.trim()).filter(Boolean).map((part) => {
    const index = part.indexOf("=");
    return index < 0 ? [part, ""] : [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
  }));
}

function browserName(userAgent: string): string {
  if (/CriOS|Chrome/i.test(userAgent)) return "Chrome";
  if (/FxiOS|Firefox/i.test(userAgent)) return "Firefox";
  if (/Safari/i.test(userAgent)) return "Safari";
  return "Browser";
}

function pairingPage(code: string): string {
  const safeCode = JSON.stringify(code);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#faf7f2"><title>Pair with Dossier</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#faf7f2;color:#282522;font:16px system-ui;padding:24px;box-sizing:border-box}.card{width:min(420px,100%);background:white;border:1px solid #ded7cd;border-radius:24px;padding:30px;box-shadow:0 20px 55px #402b1718}h1{font-size:28px;margin:0 0 10px}p{color:#6e665e;line-height:1.55}.dot{width:10px;height:10px;border-radius:50%;background:#d2603d;display:inline-block;margin-right:8px;animation:p 1.2s infinite}@keyframes p{50%{opacity:.3}}</style></head><body><main class="card"><h1>Pair with Dossier</h1><p id="status"><span class="dot"></span>Asking the host PC for approval…</p><p>Keep this page open. Your library will appear here after the host approves this device.</p></main><script>const code=${safeCode};let id=null;async function run(){try{if(!id){const r=await fetch('/pair/request',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code,name:navigator.platform||'Phone'})});const x=await r.json();if(!r.ok)throw new Error(x.error||'Pairing code rejected');id=x.id}const r=await fetch('/pair/status?id='+encodeURIComponent(id)+'&code='+encodeURIComponent(code));const x=await r.json();if(x.approved){location.replace('/?install-pwa=1');return}document.querySelector('#status').innerHTML='<span class="dot"></span>Waiting for approval on the host PC…';setTimeout(run,1200)}catch(e){document.querySelector('#status').textContent=e.message}}run()</script></body></html>`;
}

export class RemoteAccessManager {
  private phase: Phase = "idle";
  private transport: Transport | null = null;
  private origin: string | null = null;
  private pairingUrl: string | null = null;
  private pairingCode: string | null = null;
  private authUrl: string | null = null;
  private approvalUrl: string | null = null;
  private error: string | null = null;
  private message: string | null = null;
  private localPort: number | null = null;
  private certificateUrl: string | null = null;
  private gateway: HttpServer | null = null;
  private lanServer: HttpsServer | null = null;
  private certificateServer: HttpServer | null = null;
  private helper: ChildProcess | null = null;
  private pending = new Map<string, PendingDevice>();
  private devices: StoredDevice[] = [];
  private transportOptions: Record<string, unknown> = {};

  constructor(
    private readonly dataDir: string,
    private readonly uiDir: string,
    private readonly helperPath: string,
    private readonly controlHandler: RequestListener,
    private readonly controlToken: string,
    private readonly getSettings: () => Settings,
    private readonly saveSettings: (next: Partial<Settings>) => Settings
  ) {
    const configured = getSettings().remoteAccess?.devices ?? [];
    this.devices = configured.filter((value): value is StoredDevice =>
      typeof value.id === "string" && typeof value.tokenHash === "string"
    ).map((value) => ({
      id: String(value.id), name: String(value.name ?? "Approved device"), browser: String(value.browser ?? "Browser"),
      approvedAt: Number(value.approvedAt ?? Date.now()), lastSeenAt: Number(value.lastSeenAt ?? Date.now()), tokenHash: String(value.tokenHash)
    }));
  }

  status(): RemoteAccessPublicStatus {
    this.expirePending();
    return {
      phase: this.phase, transport: this.transport, origin: this.origin, pairingUrl: this.pairingUrl,
      authUrl: this.authUrl, approvalUrl: this.approvalUrl, error: this.error, message: this.message,
      localPort: this.localPort, certificateUrl: this.certificateUrl,
      pendingDevices: [...this.pending.values()].filter((item) => !item.approved).map(({ id, name, browser, requestedAt }) => ({ id, name, browser, requestedAt })),
      devices: this.devices.map(({ tokenHash: _, ...device }) => device)
    };
  }

  async start(transport: Transport, options: Record<string, unknown> = {}): Promise<RemoteAccessPublicStatus> {
    await this.stop(false);
    this.transport = transport;
    this.transportOptions = { ...options };
    this.phase = "starting";
    this.message = "Starting the encrypted Dossier gateway";
    this.error = null;
    this.persist(false);
    try {
      if (!existsSync(join(this.uiDir, "index.html"))) throw new Error("The mobile app bundle is missing. Rebuild Dossier and try again.");
      await this.startGateway();
      if (transport === "lan") await this.startLan();
      else await this.startHelper(transport, options);
    } catch (error) {
      await this.stop(false);
      this.transport = transport;
      this.transportOptions = { ...options };
      this.fail(error instanceof Error ? error.message : String(error));
    }
    return this.status();
  }

  async restore(): Promise<void> {
    const configured = this.getSettings().remoteAccess;
    if (!configured?.enabled || !configured.transport) return;
    const options = { ...(configured.options ?? {}) };
    if (configured.transport === "direct" && !options.hostname && configured.origin) {
      try { options.hostname = new URL(configured.origin).hostname; } catch { /* start() will surface the missing hostname */ }
    }
    try {
      await this.start(configured.transport, options);
    } catch (error) {
      this.fail(error instanceof Error ? error.message : String(error));
    }
  }

  async stop(clearDevices = true): Promise<RemoteAccessPublicStatus> {
    const helper = this.helper;
    this.helper = null;
    this.phase = "idle";
    if (helper) await this.stopHelper(helper);
    await Promise.all([
      new Promise<void>((resolveClose) => this.lanServer ? this.lanServer.close(() => resolveClose()) : resolveClose()),
      new Promise<void>((resolveClose) => this.certificateServer ? this.certificateServer.close(() => resolveClose()) : resolveClose()),
      new Promise<void>((resolveClose) => this.gateway ? this.gateway.close(() => resolveClose()) : resolveClose())
    ]);
    this.lanServer = null;
    this.certificateServer = null;
    this.gateway = null;
    this.transport = null;
    this.transportOptions = {};
    this.origin = null;
    this.pairingUrl = null;
    this.pairingCode = null;
    this.authUrl = null;
    this.approvalUrl = null;
    this.error = null;
    this.message = null;
    this.localPort = null;
    this.certificateUrl = null;
    this.pending.clear();
    if (clearDevices) {
      this.devices = [];
      this.persist(false);
    }
    return this.status();
  }

  private async stopHelper(helper: ChildProcess): Promise<void> {
    if (helper.exitCode !== null || helper.signalCode !== null) return;
    await new Promise<void>((resolveStop) => {
      let settled = false;
      const finish = (): void => {
        if (settled) return;
        settled = true;
        clearTimeout(forceTimer);
        resolveStop();
      };
      const forceTimer = setTimeout(() => {
        if (helper.exitCode === null && helper.signalCode === null) helper.kill("SIGKILL");
        finish();
      }, 5_000);
      helper.once("exit", finish);
      if (!helper.kill("SIGTERM")) finish();
    });
  }

  approve(id: string): RemoteAccessPublicStatus {
    const pending = this.pending.get(id);
    if (!pending) throw new Error("That pairing request has expired.");
    pending.approved = true;
    const now = Date.now();
    this.devices.push({ id: pending.id, name: pending.name, browser: pending.browser, approvedAt: now, lastSeenAt: now, tokenHash: sha256(pending.sessionToken) });
    this.persist(true);
    return this.status();
  }

  revoke(id: string): RemoteAccessPublicStatus {
    this.devices = this.devices.filter((device) => device.id !== id);
    this.pending.delete(id);
    this.persist(this.phase === "ready");
    return this.status();
  }

  newPairingCode(): RemoteAccessPublicStatus {
    if (this.phase !== "ready" || !this.origin) throw new Error("The remote endpoint is not ready.");
    this.pairingCode = randomBytes(24).toString("base64url");
    this.pairingUrl = `${this.origin}/pair?code=${encodeURIComponent(this.pairingCode)}`;
    return this.status();
  }

  async verifyDirect(): Promise<RemoteAccessPublicStatus> {
    if (this.transport !== "direct" || !this.origin) throw new Error("Direct HTTPS is not waiting for verification.");
    try {
      const hostname = new URL(this.origin).hostname;
      await new Promise<void>((resolveConnect, reject) => {
        const socket = tlsConnect({ host: "127.0.0.1", port: this.localPort!, servername: hostname, rejectUnauthorized: true });
        const timer = setTimeout(() => socket.destroy(new Error("certificate validation timed out")), 25_000);
        socket.once("secureConnect", () => { clearTimeout(timer); socket.end(); resolveConnect(); });
        socket.once("error", (error) => { clearTimeout(timer); reject(error); });
      });
      this.becomeReady(this.origin);
    } catch (error) {
      this.phase = "verifying";
      this.error = `Dossier could not reach ${this.origin}. Confirm DNS and forward public TCP 443 to this PC's port ${this.localPort}. ${error instanceof Error ? error.message : String(error)}`;
    }
    return this.status();
  }

  private async startGateway(): Promise<void> {
    this.gateway = createHttpServer(this.requestHandler());
    await new Promise<void>((resolveListen, reject) => {
      this.gateway!.once("error", reject);
      this.gateway!.listen(0, "127.0.0.1", () => resolveListen());
    });
  }

  private async startLan(): Promise<void> {
    const ip = privateIpv4();
    if (!ip) throw new Error("No private Wi-Fi or Ethernet address was found on this PC.");
    const certDir = join(this.dataDir, "remote-access", "lan");
    mkdirSync(certDir, { recursive: true, mode: 0o700 });
    const caPath = join(certDir, "dossier-lan-ca.crt");
    const caKeyPath = join(certDir, "dossier-lan-ca.key");
    const certPath = join(certDir, "dossier-lan-server.crt");
    const keyPath = join(certDir, "dossier-lan-server.key");
    const addressPath = join(certDir, "address.txt");
    const addressMatches = existsSync(addressPath) && readFileSync(addressPath, "utf8") === ip;
    if (!addressMatches || !existsSync(caPath) || !existsSync(caKeyPath) || !existsSync(certPath) || !existsSync(keyPath)) {
      const root = await generate([{ name: "commonName", value: "Dossier LAN Root" }], {
        algorithm: "sha256", keySize: 2048, notAfterDate: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000),
        extensions: [
          { name: "basicConstraints", cA: true },
          { name: "keyUsage", keyCertSign: true, cRLSign: true }
        ]
      });
      const server = await generate([{ name: "commonName", value: ip }], {
        algorithm: "sha256", keySize: 2048, notAfterDate: new Date(Date.now() + 825 * 24 * 60 * 60 * 1000),
        ca: { cert: root.cert, key: root.private },
        extensions: [
          { name: "basicConstraints", cA: false },
          { name: "keyUsage", digitalSignature: true, keyEncipherment: true },
          { name: "extKeyUsage", serverAuth: true },
          { name: "subjectAltName", altNames: [{ type: 7, ip }] }
        ]
      });
      writeFileSync(caPath, root.cert, { mode: 0o600 });
      writeFileSync(caKeyPath, root.private, { mode: 0o600 });
      writeFileSync(certPath, `${server.cert.trim()}\n${root.cert.trim()}\n`, { mode: 0o600 });
      writeFileSync(keyPath, server.private, { mode: 0o600 });
      writeFileSync(addressPath, ip, { mode: 0o600 });
    }
    this.lanServer = createHttpsServer({ cert: readFileSync(certPath), key: readFileSync(keyPath) }, this.requestHandler());
    await new Promise<void>((resolveListen, reject) => {
      this.lanServer!.once("error", (error) => reject(lanListenError(error, LAN_HTTPS_PORT)));
      this.lanServer!.listen(LAN_HTTPS_PORT, "0.0.0.0", () => resolveListen());
    });
    const address = this.lanServer.address();
    if (!address || typeof address === "string") throw new Error("The LAN HTTPS gateway did not expose a port.");
    this.localPort = address.port;
    this.certificateServer = createHttpServer((req, res) => {
      if (req.url !== "/dossier-lan-ca.crt") return json(res, 404, { error: "Not found" });
      res.writeHead(200, { ...SECURITY_HEADERS, "content-type": "application/x-x509-ca-cert", "content-disposition": "attachment; filename=dossier-lan-ca.crt", "cache-control": "no-store" });
      res.end(readFileSync(caPath));
    });
    await new Promise<void>((resolveListen, reject) => {
      this.certificateServer!.once("error", (error) => reject(lanListenError(error, LAN_CERTIFICATE_PORT)));
      this.certificateServer!.listen(LAN_CERTIFICATE_PORT, "0.0.0.0", () => resolveListen());
    });
    const certificateAddress = this.certificateServer.address();
    if (!certificateAddress || typeof certificateAddress === "string") throw new Error("The LAN certificate helper did not expose a port.");
    this.certificateUrl = `http://${ip}:${certificateAddress.port}/dossier-lan-ca.crt`;
    this.becomeReady(`https://${ip}:${address.port}`);
  }

  private async startHelper(transport: "tailscale" | "direct", options: Record<string, unknown>): Promise<void> {
    if (!existsSync(this.helperPath)) throw new Error("Dossier's remote-access helper is missing. Rebuild the desktop app and try again.");
    const address = this.gateway?.address();
    if (!address || typeof address === "string") throw new Error("The Dossier gateway is not running.");
    const args = ["--mode", transport, "--upstream", `http://127.0.0.1:${address.port}`, "--state-dir", join(this.dataDir, "remote-access")];
    if (transport === "direct") {
      const hostname = String(options.hostname ?? "").trim();
      const email = String(options.email ?? "").trim();
      const port = Number(options.port ?? 48732);
      if (!hostname) throw new Error("Enter the public hostname that will reach this PC.");
      if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("The local HTTPS port must be between 1024 and 65535.");
      this.localPort = port;
      args.push("--hostname", hostname, "--email", email, "--port", String(port));
    }
    // Keep a parent-owned stdin pipe open for the helper's lifetime. If this
    // backend is killed without a graceful shutdown, the OS closes the pipe
    // and the helper cancels itself instead of becoming an orphaned tsnet node.
    const helper = spawn(this.helperPath, args, { stdio: ["pipe", "pipe", "pipe"] });
    this.helper = helper;
    helper.once("error", (error) => {
      if (this.helper !== helper) return;
      this.helper = null;
      this.fail(error.message);
    });
    helper.once("exit", (code, signal) => {
      if (this.helper !== helper) return;
      this.helper = null;
      if (this.phase !== "idle" && this.phase !== "error") this.fail(`Remote-access helper stopped (${signal ?? code ?? "unknown"}).`);
    });
    const lines = createInterface({ input: helper.stdout! });
    lines.on("line", (line) => this.onHelperEvent(line));
    helper.stderr!.on("data", () => { /* helper emits user-facing failures as JSON */ });
    this.phase = transport === "tailscale" ? "authorizing" : "verifying";
    this.message = transport === "tailscale" ? "Waiting for Tailscale to issue Dossier's authorization link" : "Starting the Direct HTTPS listener";
  }

  private onHelperEvent(line: string): void {
    let event: { type?: string; stage?: string; url?: string; origin?: string; message?: string };
    try { event = JSON.parse(line); } catch { return; }
    if (event.type === "auth_url" && event.url) {
      this.authUrl = event.url;
      this.phase = "authorizing";
      this.message = "Authorize Dossier in the browser, then return here";
    } else if (event.type === "approval_url" && event.url) {
      this.approvalUrl = event.url;
      this.phase = "enabling_funnel";
      this.message = "Allow Funnel for Dossier in Tailscale, then return here";
    } else if (event.type === "state") {
      if (event.stage === "funnel") this.phase = "enabling_funnel";
      this.message = event.message ?? null;
    } else if (event.type === "ready" && event.origin) {
      this.origin = event.origin;
      if (this.transport === "direct") {
        this.phase = "verifying";
        this.message = `Forward public TCP 443 to this PC's port ${this.localPort}, then verify the endpoint.`;
      } else {
        this.becomeReady(event.origin);
      }
    } else if (event.type === "error") {
      this.fail(event.message ?? "Remote-access helper failed.");
    }
  }

  private becomeReady(origin: string): void {
    this.origin = origin;
    this.phase = "ready";
    this.error = null;
    this.message = "Scan the pairing code, then approve the phone on this PC";
    this.pairingCode = randomBytes(24).toString("base64url");
    this.pairingUrl = `${origin}/pair?code=${encodeURIComponent(this.pairingCode)}`;
    this.persist(true);
  }

  private fail(message: string): void {
    this.phase = "error";
    this.error = message;
    this.message = null;
    this.persist(false);
  }

  private persist(enabled: boolean): void {
    this.saveSettings({ remoteAccess: {
      enabled, transport: enabled ? this.transport : null, origin: enabled ? this.origin : null,
      devices: this.devices, options: enabled ? this.transportOptions : {}
    }});
  }

  private expirePending(): void {
    const cutoff = Date.now() - 10 * 60_000;
    for (const [id, pending] of this.pending) if (pending.requestedAt < cutoff) this.pending.delete(id);
  }

  private authenticated(req: IncomingMessage): StoredDevice | null {
    const token = parseCookies(req).dossier_device;
    if (!token) return null;
    const device = this.devices.find((candidate) => candidate.tokenHash === sha256(token)) ?? null;
    if (device) device.lastSeenAt = Date.now();
    return device;
  }

  private requestHandler(): RequestListener {
    return (req, res) => void this.handleRequest(req, res).catch((error) => json(res, 500, { error: error instanceof Error ? error.message : String(error) }));
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const requestUrl = new URL(req.url ?? "/", "https://dossier.invalid");
    const path = requestUrl.pathname;
    if (path === "/health") return json(res, 200, { ok: true });
    if (path === "/dossier-lan.crt" && this.transport === "lan") {
      const certPath = join(this.dataDir, "remote-access", "lan", "dossier-lan-ca.crt");
      res.writeHead(200, { ...SECURITY_HEADERS, "content-type": "application/x-x509-ca-cert", "content-disposition": "attachment; filename=dossier-lan.crt", "cache-control": "no-store" });
      res.end(readFileSync(certPath));
      return;
    }
    if (path === "/pair" && req.method === "GET") {
      const code = requestUrl.searchParams.get("code") ?? "";
      if (!this.pairingCode || code !== this.pairingCode) return json(res, 410, { error: "This pairing code is invalid or has expired." });
      res.writeHead(200, {
        ...SECURITY_HEADERS,
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        "content-security-policy": "default-src 'none'; connect-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
      });
      res.end(pairingPage(code));
      return;
    }
    if (path === "/pair/request" && req.method === "POST") {
      const value = await body(req);
      const code = String(value.code ?? "");
      if (!this.pairingCode || code !== this.pairingCode) return json(res, 410, { error: "This pairing code is invalid or has expired." });
      const id = randomUUID();
      this.pending.set(id, {
        id, code, name: String(value.name ?? "Phone").slice(0, 80), browser: browserName(req.headers["user-agent"] ?? ""),
        requestedAt: Date.now(), approved: false, sessionToken: randomBytes(32).toString("base64url")
      });
      // The QR is a single-use capability. Consume it as soon as one phone
      // presents it, before host approval, so a copied code cannot create a
      // second request while the legitimate phone is waiting.
      this.pairingCode = null;
      this.pairingUrl = null;
      return json(res, 202, { id });
    }
    if (path === "/pair/status" && req.method === "GET") {
      const id = requestUrl.searchParams.get("id") ?? "";
      const code = requestUrl.searchParams.get("code") ?? "";
      const pending = this.pending.get(id);
      if (!pending || pending.code !== code) return json(res, 404, { error: "Pairing request not found." });
      if (!pending.approved) return json(res, 200, { approved: false });
      this.pending.delete(id);
      this.pairingCode = null;
      this.pairingUrl = null;
      return json(res, 200, { approved: true }, { "set-cookie": `dossier_device=${encodeURIComponent(pending.sessionToken)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=31536000` });
    }

    const device = this.authenticated(req);
    if (!device) {
      if (path.startsWith("/api/")) return json(res, 401, { error: { code: "UNAUTHORIZED", message: "This device is not approved by the Dossier host." } });
      res.writeHead(302, { ...SECURITY_HEADERS, "cache-control": "no-store", location: "/pairing-required" });
      res.end();
      return;
    }

    if (path.startsWith("/api/posters/") && req.method === "GET") {
      const match = path.match(/^\/api\/posters\/(w(?:92|154|185|342|500|780)|original)\/([^/]+)$/);
      if (!match) return json(res, 400, { error: { code: "BAD_REQUEST", message: "Invalid poster path." } });
      const upstream = await fetch(`https://image.tmdb.org/t/p/${match[1]!}/${encodeURIComponent(decodeURIComponent(match[2]!))}`);
      if (!upstream.ok) return json(res, upstream.status, { error: { code: "UPSTREAM", message: "Poster unavailable." } });
      const content = Buffer.from(await upstream.arrayBuffer());
      // Poster choices reveal library activity, so do not leave them in a
      // revoked phone's HTTP cache even though the bytes originate at TMDB.
      res.writeHead(200, { ...SECURITY_HEADERS, "content-type": upstream.headers.get("content-type") ?? "image/jpeg", "cache-control": "no-store" });
      res.end(content);
      return;
    }

    if (path.startsWith("/api/")) {
      const mapped = path.replace(/^\/api/, "/control");
      const allowed = [
        ["GET", /^\/control\/app\/version$/], ["GET", /^\/control\/settings$/], ["PUT", /^\/control\/settings$/],
        ["GET", /^\/control\/preferences$/], ["PUT", /^\/control\/preferences\/rating$/],
        ["POST", /^\/control\/preferences\/(pairwise|skip|unskip)$/], ["GET", /^\/control\/tmdb\/(status|genres|trending|discover|search|detail|collection)$/]
      ].some(([method, pattern]) => req.method === method && (pattern as RegExp).test(mapped));
      if (!allowed) return json(res, 403, { error: { code: "HOST_ONLY", message: "This action can only be completed on the Dossier host PC." } });
      if (mapped === "/control/settings" && req.method === "GET") {
        return json(res, 200, remoteSettings(this.getSettings()));
      }
      if (mapped === "/control/settings" && req.method === "PUT") {
        return json(res, 200, remoteSettings(this.saveSettings(remoteSettings(await body(req)))));
      }
      req.headers["x-dossier-control-token"] = this.controlToken;
      req.url = mapped + requestUrl.search;
      this.controlHandler(req, res);
      return;
    }

    let relative = decodeURIComponent(path).replace(/^\/+/, "") || "index.html";
    if (relative === "pairing-required") {
      return json(res, 401, { error: "Open a fresh pairing code from the Dossier host PC." });
    }
    let file = resolve(this.uiDir, normalize(relative));
    if (!file.startsWith(resolve(this.uiDir))) return json(res, 404, { error: "Not found" });
    if (!existsSync(file) || !statSync(file).isFile()) file = join(this.uiDir, "index.html");
    let content = readFileSync(file);
    if (file.endsWith("index.html")) {
      content = Buffer.from(content.toString("utf8").replace("</head>", "<script>window.__DOSSIER_REMOTE__=true</script></head>"));
    }
    res.writeHead(200, { ...SECURITY_HEADERS, "content-type": MIME[extname(file)] ?? "application/octet-stream", "cache-control": file.endsWith("index.html") ? "no-store" : "private, max-age=31536000, immutable" });
    res.end(content);
  }
}
