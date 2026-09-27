import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { tasteClaimId } from "@dossier/domain";
import { startService } from "./service.js";
import { CliStorage, cliRoot } from "./storage.js";

const temp = mkdtempSync(join(tmpdir(), "dossier-cli-test-"));
const key = randomBytes(32);
let server: Awaited<ReturnType<typeof startService>> | undefined;

afterEach(async () => {
  if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
  server = undefined;
});

async function separateClient(path: string, request: unknown): Promise<any> {
  const script = `import { createConnection } from "node:net";
const socket = createConnection(process.argv[1]);
let result = "";
socket.on("connect", () => socket.write(process.argv[2] + "\\n"));
socket.on("data", (chunk) => result += chunk);
socket.on("end", () => process.stdout.write(result));`;
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--input-type=module", "-e", script, path, JSON.stringify(request)]);
    let out = "", err = "";
    child.stdout.on("data", (part: Buffer) => out += part);
    child.stderr.on("data", (part: Buffer) => err += part);
    child.on("close", (code) => code === 0 ? resolve(JSON.parse(out)) : reject(new Error(err)));
  });
}

test("separate clients share an encrypted profile and reject stale writes", async () => {
  const root = join(temp, "profiles");
  server = await startService(root, key);
  const storage = await CliStorage.open(root, key);
  const token = storage.authToken();
  const send = (action: string, args: Record<string, unknown> = {}, auth = token) => separateClient(storage.socketPath(), { token: auth, action, args });

  const created = await send("profile.create", { name: "research" });
  expect(created.ok).toBe(true);
  expect(statSync(storage.socketPath()).mode & 0o777).toBe(0o600);
  expect(statSync(root).mode & 0o777).toBe(0o700);
  expect((await send("settings.set", { key: "refineGroupSize", value: 3, expectedRevision: 1 })).result.revision).toBe(2);
  expect((await send("settings.get", { key: "refineGroupSize" })).result.refineGroupSize).toBe(3);
  expect((await send("settings.set", { key: "refineGroupSize", value: 4, expectedRevision: 1 })).error.code).toBe("STALE_REVISION");
  expect((await send("profile.list", {}, "wrong")).error.code).toBe("UNAUTHORIZED");
  const raw = readFileSync(join(root, "profiles.enc.json"), "utf8");
  expect(raw).not.toContain("research");
  expect(raw).not.toContain("refineGroupSize");
  expect(storage.load().profiles[0]?.revision).toBe(2);

  const vault = storage.load();
  const condition = { kind: "genre" as const, value: "Drama", label: "Drama" };
  const originalId = tasteClaimId("positive", [condition]);
  vault.profiles[0]!.state.tasteClaims = [{
    id: originalId, conditions: [condition], effect: "positive", confidence: 0.8,
    evidence: { supportingItemKeys: [], counterexampleItemKeys: [], tasteSpaceClusterIds: [], supportingWeight: 0, counterexampleWeight: 0, matchedItemCount: 0 },
    provenance: "inferred", active: true
  }];
  storage.save(vault);
  const correction = await send("taste.claim.correct", { id: originalId, effect: "negative", expectedRevision: 2 });
  expect(correction.ok).toBe(true);
  expect(correction.result.claim.active).toBe(true);
  const claims = storage.load().profiles[0]!.state.tasteClaims;
  expect(claims.find((claim) => claim.id === originalId)?.active).toBe(false);
  expect(claims.find((claim) => claim.id === tasteClaimId("negative", [condition]))?.active).toBe(true);

  const previousRoot = process.env.DOSSIER_CLI_HOME;
  try {
    process.env.DOSSIER_CLI_HOME = join(homedir(), "Library", "Application Support", "com.dossier.desktop", "dossier");
    expect(() => cliRoot()).toThrow("overlaps the GUI store");
  } finally {
    if (previousRoot === undefined) delete process.env.DOSSIER_CLI_HOME;
    else process.env.DOSSIER_CLI_HOME = previousRoot;
  }
});

afterEach(() => { rmSync(temp, { recursive: true, force: true }); });
