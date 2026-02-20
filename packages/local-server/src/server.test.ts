import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";
import { DossierStoreService } from "@dossier/store";
import { LocalProfileServer } from "./server.js";

let server: LocalProfileServer;
let store: DossierStoreService;

beforeEach(async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "dossier-server-"));
  store = await DossierStoreService.init(dataDir);
  server = new LocalProfileServer(store, {
    port: 34251
  });
});

afterEach(() => {
  // No explicit close API on DossierStoreService.
});

describe("local API security posture", () => {
  test("rejects missing token on protected endpoints", async () => {
    const req = {
      headers: {
        origin: "https://getperspectives.app",
        "x-dossier-client": "perspectives"
      }
    } as unknown as IncomingMessage;

    const response = createMockResponse();
    const authResult = (
      server as unknown as { authorize: (request: IncomingMessage, response: ServerResponse) => { ok: boolean } }
    ).authorize(req, response.res);

    expect(authResult.ok).toBe(false);
    expect(response.statusCode).toBe(401);
    expect(response.body).toContain("missing bearer token");
  });

  test("rejects disallowed origin", async () => {
    const req = {
      headers: {
        origin: "https://evil.example",
        authorization: "Bearer fake",
        "x-dossier-client": "perspectives"
      }
    } as unknown as IncomingMessage;

    const response = createMockResponse();
    const authResult = (
      server as unknown as { authorize: (request: IncomingMessage, response: ServerResponse) => { ok: boolean } }
    ).authorize(req, response.res);

    expect(authResult.ok).toBe(false);
    expect(response.statusCode).toBe(403);
    expect(response.body).toContain("origin not allowed");
  });
});

function createMockResponse(): {
  res: ServerResponse;
  statusCode: number;
  headers: Record<string, string>;
  body: string;
} {
  const state: {
    statusCode: number;
    headers: Record<string, string>;
    body: string;
  } = {
    statusCode: 0,
    headers: {},
    body: ""
  };

  const res = {
    writeHead: (statusCode: number, headers: Record<string, string>) => {
      state.statusCode = statusCode;
      state.headers = { ...headers };
      return res as unknown as ServerResponse;
    },
    end: (chunk?: string) => {
      if (typeof chunk === "string") {
        state.body = chunk;
      }
      return res as unknown as ServerResponse;
    },
    setHeader: () => {
      return res as unknown as ServerResponse;
    }
  } as unknown as ServerResponse;

  return {
    res,
    get statusCode() {
      return state.statusCode;
    },
    get headers() {
      return state.headers;
    },
    get body() {
      return state.body;
    }
  };
}
