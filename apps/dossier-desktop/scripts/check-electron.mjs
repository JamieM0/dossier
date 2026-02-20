import { copyFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);

function fail(message) {
  console.error(message);
  process.exit(1);
}

const ROOT = "/Users/jamie/Developer/Dossier";
const APP_NAME = "Dossier";

function patchMacElectronBundle(electronBinaryPath) {
  if (process.platform !== "darwin") {
    return;
  }

  const macOsDir = dirname(electronBinaryPath);
  const contentsDir = dirname(macOsDir);
  const plistPath = join(contentsDir, "Info.plist");
  const resourcesDir = join(contentsDir, "Resources");
  const sourcePngPath = join(ROOT, "apps", "dossier-desktop", "assets", "logo-mac.png");
  const sourceIcnsPath = join(ROOT, "apps", "dossier-desktop", "assets", "logo.icns");
  const targetIcnsPath = join(resourcesDir, "electron.icns");

  if (!existsSync(sourcePngPath)) {
    return;
  }

  if (!existsSync(sourceIcnsPath)) {
    execFileSync("sips", ["-s", "format", "icns", sourcePngPath, "--out", sourceIcnsPath], { stdio: "ignore" });
  }

  if (existsSync(sourceIcnsPath)) {
    copyFileSync(sourceIcnsPath, targetIcnsPath);
  }

  execFileSync("plutil", ["-replace", "CFBundleDisplayName", "-string", APP_NAME, plistPath], { stdio: "ignore" });
  execFileSync("plutil", ["-replace", "CFBundleName", "-string", APP_NAME, plistPath], { stdio: "ignore" });
}

function blockedScriptsMessage(reason) {
  return [
    "Electron package is present, but its runtime binary is missing.",
    "This usually means pnpm blocked postinstall/build scripts.",
    reason ? `Detail: ${reason}` : "",
    "Run this from /Users/jamie/Developer/Dossier:",
    "pnpm approve-builds",
    "pnpm rebuild electron",
    "pnpm dev"
  ]
    .filter(Boolean)
    .join("\n");
}

let hasElectronPackage = false;
try {
  require.resolve("electron/package.json");
  hasElectronPackage = true;
} catch {
  hasElectronPackage = false;
}

try {
  const electronPath = require("electron");
  if (!electronPath || typeof electronPath !== "string" || !existsSync(electronPath)) {
    fail(blockedScriptsMessage());
  }
  patchMacElectronBundle(electronPath);
} catch (error) {
  if (hasElectronPackage) {
    fail(blockedScriptsMessage(error instanceof Error ? error.message : undefined));
  }

  fail(
    [
      "Electron is not installed for the desktop workspace.",
      `Run this from ${ROOT}:`,
      "pnpm add -D electron@latest --filter @dossier/dossier-desktop",
      "pnpm dev"
    ].join("\n")
  );
}
