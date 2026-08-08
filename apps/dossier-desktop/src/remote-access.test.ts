import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { request as httpsRequest } from "node:https";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import { afterEach, describe, expect, test } from "vitest";
import { RemoteAccessManager } from "./remote-access.js";

type Response = { status: number; body: string; headers: IncomingMessage["headers"] };

function request(url: string, method = "GET", value?: unknown, cookie?: string): Promise<Response> {
  const target = new URL(url);
  const payload = value === undefined ? null : Buffer.from(JSON.stringify(value));
  return new Promise((resolve, reject) => {
    const req = httpsRequest({
      hostname: target.hostname,
      port: target.port,
      path: target.pathname + target.search,
      method,
      rejectUnauthorized: false,
      headers: {
        ...(payload ? { "content-type": "application/json", "content-length": String(payload.length) } : {}),
        ...(cookie ? { cookie } : {})
      }
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf8"), headers: res.headers }));
    });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

const cleanup: string[] = [];
afterEach(() => {
  for (const path of cleanup.splice(0)) rmSync(path, { recursive: true, force: true });
});

describe("LAN remote access", () => {
  test("creates a QR target, requires host approval, and blocks host-only APIs", async () => {
    const root = mkdtempSync(join(tmpdir(), "dossier-remote-test-"));
    cleanup.push(root);
    const ui = join(root, "ui");
    mkdirSync(ui);
    writeFileSync(join(ui, "index.html"), "<!doctype html><html><head></head><body>Dossier</body></html>");
    let settings: Record<string, unknown> = {};
    const control = (req: IncomingMessage, res: ServerResponse) => {
      expect(req.headers["x-dossier-control-token"]).toBe("control-test-token");
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ratings: {}, pairwise: [], skipped: [] }));
    };
    const manager = new RemoteAccessManager(
      root, ui, join(root, "missing-helper"), control, "control-test-token",
      () => settings,
      (next) => (settings = { ...settings, ...next })
    );

    try {
      const ready = await manager.start("lan");
      expect(ready.phase, ready.error ?? ready.message ?? undefined).toBe("ready");
      expect(ready.pairingUrl).toMatch(/^https:\/\/(10\.|192\.168\.|172\.).*:48731\/pair\?code=/);
      expect(ready.certificateUrl).toMatch(/^http:\/\/.+:48730\/dossier-lan-ca\.crt$/);

      const health = await request(`${ready.origin}/health`);
      expect(health.status).toBe(200);
      expect(JSON.parse(health.body)).toEqual({ ok: true });
      expect(health.headers["x-content-type-options"]).toBe("nosniff");

      // Nothing in the app shell or API is available merely because the
      // endpoint is reachable. The host must approve a device first.
      const blockedShell = await request(`${ready.origin}/`);
      expect(blockedShell.status).toBe(302);
      expect(blockedShell.headers.location).toBe("/pairing-required");
      const blockedPreferences = await request(`${ready.origin}/api/preferences`);
      expect(blockedPreferences.status).toBe(401);
      expect(JSON.parse(blockedPreferences.body).error.code).toBe("UNAUTHORIZED");

      const pairPage = await request(ready.pairingUrl!);
      expect(pairPage.status).toBe(200);
      expect(pairPage.body).toContain("Pair with Dossier");
      expect(pairPage.body).toContain("/?install-pwa=1");

      const code = new URL(ready.pairingUrl!).searchParams.get("code")!;
      const pairing = await request(`${ready.origin}/pair/request`, "POST", { code, name: "Test phone" });
      expect(pairing.status).toBe(202);
      const id = JSON.parse(pairing.body).id as string;
      expect(manager.status().pendingDevices).toHaveLength(1);
      expect(manager.status().pairingUrl).toBeNull();

      const reusedCode = await request(`${ready.origin}/pair/request`, "POST", { code, name: "Second phone" });
      expect(reusedCode.status).toBe(410);
      const stillBlocked = await request(`${ready.origin}/api/preferences`);
      expect(stillBlocked.status).toBe(401);

      manager.approve(id);
      const approved = await request(`${ready.origin}/pair/status?id=${encodeURIComponent(id)}&code=${encodeURIComponent(code)}`);
      expect(approved.status).toBe(200);
      expect(JSON.parse(approved.body)).toEqual({ approved: true });
      const cookie = approved.headers["set-cookie"]?.[0].split(";")[0];
      expect(cookie).toMatch(/^dossier_device=/);

      const safe = await request(`${ready.origin}/api/preferences`, "GET", undefined, cookie);
      expect(safe.status).toBe(200);
      const forbidden = await request(`${ready.origin}/api/tmdb/token/clear`, "POST", {}, cookie);
      expect(forbidden.status).toBe(403);
      expect(JSON.parse(forbidden.body).error.code).toBe("HOST_ONLY");

      const stopped = await manager.stop(true);
      expect(stopped.phase).toBe("idle");
      expect(stopped.devices).toHaveLength(0);
    } finally {
      await manager.stop(true);
    }
  }, 20_000);
});
