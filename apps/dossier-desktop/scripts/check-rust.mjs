import { execSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const MIN_MAJOR = 1;
const MIN_MINOR = 88;
const MIN_PATCH = 0;

function parseVersion(text) {
  const match = text.match(/(\d+)\.(\d+)\.(\d+)/);
  if (!match) {
    return null;
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3])
  };
}

function isVersionAtLeast(version, minimum) {
  if (version.major !== minimum.major) {
    return version.major > minimum.major;
  }
  if (version.minor !== minimum.minor) {
    return version.minor > minimum.minor;
  }
  return version.patch >= minimum.patch;
}

const minimum = { major: MIN_MAJOR, minor: MIN_MINOR, patch: MIN_PATCH };
const scriptDir = dirname(fileURLToPath(import.meta.url));
const tauriDir = resolve(scriptDir, "../src-tauri");
const isWindows = process.platform === "win32";

function commandExists(command) {
  try {
    execSync(command, {
      cwd: tauriDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    });
    return true;
  } catch {
    return false;
  }
}

let rustcVersionRaw = "";
try {
  rustcVersionRaw = execSync("rustc --version", {
    cwd: tauriDir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trim();
} catch (error) {
  console.error("Rust toolchain is required for the Tauri desktop app.");
  console.error("Install Rust via rustup: https://rustup.rs");
  process.exit(1);
}

const rustcVersion = parseVersion(rustcVersionRaw);
if (!rustcVersion || !isVersionAtLeast(rustcVersion, minimum)) {
  const required = `${minimum.major}.${minimum.minor}.${minimum.patch}`;
  console.error(`Rust ${required}+ is required. Detected: ${rustcVersionRaw}`);
  console.error("Run:");
  console.error("  rustup toolchain install 1.88.0");
  console.error("  rustup default 1.88.0");
  process.exit(1);
}

if (isWindows) {
  const hasRustup = commandExists("rustup --version");
  const hasLinker = commandExists("where link");
  const hasCl = commandExists("where cl");

  if (!hasRustup) {
    console.error("Windows Tauri builds require rustup-managed toolchains.");
    console.error("Install rustup from https://rustup.rs and rerun `pnpm dev`.");
    process.exit(1);
  }

  if (!hasLinker || !hasCl) {
    console.warn("Warning: `cl`/`link` are not available in this terminal session.");
    console.warn("Desktop dev will attempt to bootstrap the Visual Studio build environment automatically.");
  }
}
