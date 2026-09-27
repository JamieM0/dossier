import { existsSync, unlinkSync, chmodSync } from "node:fs";
import { createServer, createConnection, type Server } from "node:net";
import { pathToFileURL } from "node:url";
import { ActionError, execute, type Args } from "./actions.js";
import { CliStorage, cliRoot } from "./storage.js";

export type Request = { token: string; action: string; args: Args };
export type Response = { ok: true; result: unknown } | { ok: false; error: { code: string; message: string } };

function occupied(path: string): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection(path);
    socket.once("connect", () => { socket.destroy(); resolve(true); });
    socket.once("error", () => resolve(false));
  });
}

export async function startService(root = cliRoot(), keyOverride?: Buffer): Promise<Server> {
  const storage = await CliStorage.open(root, keyOverride);
  const token = storage.authToken();
  const path = storage.socketPath();
  if (existsSync(path)) {
    if (await occupied(path)) throw new Error("CLI service is already running");
    unlinkSync(path);
  }
  let sequence: Promise<unknown> = Promise.resolve();
  const server = createServer((socket) => {
    socket.setEncoding("utf8");
    let input = "";
    socket.on("data", (chunk: string) => {
      input += chunk;
      if (input.length > 1024 * 1024) { socket.destroy(); return; }
      const newline = input.indexOf("\n");
      if (newline < 0) return;
      const line = input.slice(0, newline); input = "";
      sequence = sequence.then(async () => {
        let response: Response;
        try {
          const request = JSON.parse(line) as Request;
          if (request.token !== token) throw new ActionError("UNAUTHORIZED", "Local client authorization failed");
          response = { ok: true, result: await execute(storage, request.action, request.args ?? {}) };
        } catch (error) {
          response = { ok: false, error: error instanceof ActionError ? { code: error.code, message: error.message } : { code: "ACTION_FAILED", message: error instanceof Error ? error.message : "Action failed" } };
        }
        socket.end(JSON.stringify(response) + "\n");
      });
    });
  });
  try {
    await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(path, () => resolve()); });
    chmodSync(path, 0o600);
  } catch (error) { server.close(); throw error; }
  server.on("close", () => { if (existsSync(path)) unlinkSync(path); });
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startService().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : error}\n`); process.exitCode = 1; });
}
