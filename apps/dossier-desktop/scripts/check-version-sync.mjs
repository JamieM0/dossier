import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function readUtf8(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function parseTauriVersion(tauriConfJsonPath) {
  const json = JSON.parse(readUtf8(tauriConfJsonPath));
  if (!json?.version || typeof json.version !== "string") {
    throw new Error(`Missing/invalid "version" in ${tauriConfJsonPath}`);
  }
  return json.version;
}

function parsePackageJsonVersion(packageJsonPath) {
  const json = JSON.parse(readUtf8(packageJsonPath));
  if (!json?.version || typeof json.version !== "string") {
    throw new Error(`Missing/invalid "version" in ${packageJsonPath}`);
  }
  return json.version;
}

function parseCargoTomlPackageVersion(cargoTomlPath) {
  const contents = readUtf8(cargoTomlPath);
  const lines = contents.split(/\r?\n/);

  let inPackageSection = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#") || trimmed === "") continue;

    if (/^\[package\]\s*$/.test(trimmed)) {
      inPackageSection = true;
      continue;
    }

    if (inPackageSection && /^\[.*\]\s*$/.test(trimmed)) {
      // Next TOML section.
      break;
    }

    if (!inPackageSection) continue;

    const match = trimmed.match(/^version\s*=\s*"([^"]+)"\s*$/);
    if (match) return match[1];
  }

  throw new Error(`Could not find [package].version in ${cargoTomlPath}`);
}

function fail(message) {
  // Keep output structured so CI logs are easy to scan.
  console.error(message);
  process.exit(1);
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(scriptDir, "..");
const tauriConfJsonPath = path.join(desktopRoot, "src-tauri", "tauri.conf.json");
const cargoTomlPath = path.join(desktopRoot, "src-tauri", "Cargo.toml");
const packageJsonPath = path.join(desktopRoot, "package.json");

let tauriVersion;
let cargoVersion;
let packageVersion;

try {
  tauriVersion = parseTauriVersion(tauriConfJsonPath);
  cargoVersion = parseCargoTomlPackageVersion(cargoTomlPath);
  packageVersion = parsePackageJsonVersion(packageJsonPath);
} catch (err) {
  fail(`[preflight:version] ${err instanceof Error ? err.message : String(err)}`);
}

const mismatches = [];
if (tauriVersion !== cargoVersion) {
  mismatches.push(`- ${tauriConfJsonPath}: ${tauriVersion}`);
  mismatches.push(`- ${cargoTomlPath} ([package].version): ${cargoVersion}`);
}
if (tauriVersion !== packageVersion) {
  mismatches.push(`- ${tauriConfJsonPath}: ${tauriVersion}`);
  mismatches.push(`- ${packageJsonPath}: ${packageVersion}`);
}

if (mismatches.length > 0) {
  fail(
    [
      "[preflight:version] Version mismatch detected.",
      "Keep these in sync before tagging a release:",
      ...mismatches,
    ].join("\n")
  );
}

console.log(`[preflight:version] OK (${tauriVersion})`);
