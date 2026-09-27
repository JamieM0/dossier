import { readFileSync } from "node:fs";
import { call } from "./client.js";
import { registry, uiOnly, type Args } from "./actions.js";

import { parse } from "./arguments.js";

function readSecret(prompt: string): Promise<string> {
  if (!process.stdin.isTTY) return Promise.resolve(readFileSync(0, "utf8").trimEnd());
  return new Promise((resolve) => {
    process.stderr.write(prompt);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    let value = "";
    process.stdin.on("data", (data: Buffer) => {
      for (const byte of data) {
        if (byte === 10 || byte === 13) { process.stdin.setRawMode(false); process.stdin.pause(); process.stderr.write("\n"); resolve(value); return; }
        if (byte === 3) process.exit(130);
        if (byte === 127) value = value.slice(0, -1);
        else value += String.fromCharCode(byte);
      }
    });
  });
}

function project(result: unknown, fields: string[]): unknown {
  if (Array.isArray(result)) return result.map((entry) => project(entry, fields));
  if (!result || typeof result !== "object") return result;
  const object = result as Record<string, unknown>;
  if (Array.isArray(object.items)) return { ...object, items: project(object.items, fields) };
  return Object.fromEntries(fields.filter((field) => field in object).map((field) => [field, object[field]]));
}

function readable(result: unknown): string {
  if (!result || typeof result !== "object") return String(result);
  const value = result as { items?: unknown[]; next?: string | null };
  if (!Array.isArray(value.items) || !value.items.length || typeof value.items[0] !== "object") return JSON.stringify(result, null, 2);
  const rows = value.items as Record<string, unknown>[];
  const keys = Object.keys(rows[0] ?? {});
  const cells = rows.map((row) => keys.map((key) => String(row[key] ?? "")));
  const widths = keys.map((key, index) => Math.max(key.length, ...cells.map((row) => row[index]?.length ?? 0)));
  const lines = [keys.map((key, index) => key.padEnd(widths[index] ?? 0)).join("  "), ...cells.map((row) => row.map((cell, index) => cell.padEnd(widths[index] ?? 0)).join("  "))];
  if (value.next) lines.push(`Next cursor: ${value.next}`);
  return lines.join("\n");
}

async function main() {
  const { action, args, flags } = parse(process.argv.slice(2));
  if (action === "help") {
    const help = { commands: registry, uiOnly };
    process.stdout.write(flags.has("json") ? JSON.stringify(help) + "\n" : registry.map((item) => `${item.name.padEnd(22)} ${item.description}`).join("\n") + "\n"); return;
  }
  if (action === "tmdb.set") args.token = await readSecret("TMDB token: ");
  if (action === "tmdb.set-key") args.apiKey = await readSecret("TMDB API key: ");
  if (["profile.export", "profile.import", "library.export", "library.import"].includes(action)) args.passphrase = await readSecret("Passphrase: ");
  if (action === "settings.set") { try { args.value = JSON.parse(String(args.value)); } catch { /* string value */ } }
  for (const key of ["filters", "dials", "conditions"]) if (typeof args[key] === "string") args[key] = JSON.parse(args[key] as string);
  if (action === "refine.rank" && typeof args.keys === "string") args.keys = String(args.keys).split(",");
  if (registry.find((entry) => entry.name === action)?.safety !== "read" && !["profile.create", "profile.use", "profile.import", "tmdb.set", "tmdb.set-key", "tmdb.clear", "backup.create", "backup.delete"].includes(action) && args.expectedRevision === undefined) {
    const active = await call(args.profile ? "profile.inspect" : "profile.show", args.profile ? { profile: args.profile } : {}) as { id: string; revision: number };
    args.expectedRevision = active.revision;
    args.profile = active.id;
  }
  let result = await call(action, args);
  if (args.fields) result = project(result, String(args.fields).split(","));
  if (flags.has("ndjson") && result && typeof result === "object" && Array.isArray((result as {items?: unknown[]}).items)) {
    for (const item of (result as { items: unknown[] }).items) process.stdout.write(JSON.stringify(item) + "\n");
  } else if (flags.has("readable")) process.stdout.write(readable(result) + "\n");
  else process.stdout.write(JSON.stringify(result) + "\n");
}

main().catch((error: Error & { code?: string }) => { process.stderr.write(`${error.code ?? "ERROR"}: ${error.message}\n`); process.exitCode = 1; });
