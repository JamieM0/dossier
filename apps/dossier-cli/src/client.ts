import { spawn } from "node:child_process";
import { createConnection } from "node:net";
import { fileURLToPath } from "node:url";
import { CliStorage, cliRoot } from "./storage.js";
import type { Request, Response } from "./service.js";
import type { Args } from "./actions.js";

function send(path: string, request: Request): Promise<Response> {
  return new Promise((resolve, reject) => {
    const socket = createConnection(path);
    let output = "";
    socket.setEncoding("utf8");
    socket.once("connect", () => socket.write(JSON.stringify(request) + "\n"));
    socket.on("data", (chunk: string) => { output += chunk; if (output.length > 10 * 1024 * 1024) socket.destroy(new Error("Service response too large")); });
    socket.once("error", reject);
    socket.once("end", () => { try { resolve(JSON.parse(output) as Response); } catch { reject(new Error("Invalid service response")); } });
  });
}

export async function call(action: string, args: Args = {}): Promise<unknown> {
  const root = cliRoot();
  const storage = await CliStorage.open(root);
  const request: Request = { token: storage.authToken(), action, args };
  let response: Response;
  try { response = await send(storage.socketPath(), request); }
  catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT" && code !== "ECONNREFUSED") throw error;
    const service = fileURLToPath(new URL("./service.js", import.meta.url));
    const child = spawn(process.execPath, [service], { detached: true, stdio: "ignore", env: { ...process.env, DOSSIER_CLI_HOME: root } });
    child.unref();
    for (let attempt = 0; ; attempt++) {
      try { response = await send(storage.socketPath(), request); break; }
      catch (retryError) { if (attempt >= 40) throw retryError; await new Promise((resolve) => setTimeout(resolve, 100)); }
    }
  }
  if (!response.ok) throw Object.assign(new Error(response.error.message), { code: response.error.code });
  return response.result;
}
