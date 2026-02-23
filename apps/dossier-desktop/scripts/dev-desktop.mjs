import { execSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const desktopDir = resolve(scriptDir, "..");
const CHILD_SHUTDOWN_TIMEOUT_MS = 4000;

let activeChild = null;
let isShuttingDown = false;

async function terminateActiveChild(signal = "SIGTERM") {
  const child = activeChild;
  if (!child || child.killed || child.exitCode !== null) {
    return;
  }

  await new Promise((resolvePromise) => {
    let done = false;
    const finish = () => {
      if (done) {
        return;
      }
      done = true;
      resolvePromise();
    };

    child.once("exit", finish);

    if (process.platform === "win32") {
      try {
        execSync(`taskkill /PID ${child.pid} /T /F`, {
          cwd: desktopDir,
          stdio: ["ignore", "ignore", "ignore"]
        });
      } catch {
        try {
          child.kill(signal);
        } catch {
          // Best effort only.
        }
      }

      setTimeout(finish, 600);
      return;
    }

    try {
      if (child.pid) {
        process.kill(-child.pid, signal);
      }
    } catch {
      try {
        child.kill(signal);
      } catch {
        // Best effort only.
      }
    }

    setTimeout(() => {
      if (child.exitCode !== null) {
        finish();
        return;
      }

      try {
        if (child.pid) {
          process.kill(-child.pid, "SIGKILL");
        }
      } catch {
        try {
          child.kill("SIGKILL");
        } catch {
          // Best effort only.
        }
      }

      setTimeout(finish, 300);
    }, CHILD_SHUTDOWN_TIMEOUT_MS);
  });
}

async function handleShutdown(signal) {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;
  await terminateActiveChild(signal);
  process.exit(130);
}

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.once(signal, () => {
    void handleShutdown(signal);
  });
}

function run(command, options = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, {
      cwd: options.cwd ?? desktopDir,
      env: options.env ?? process.env,
      detached: process.platform !== "win32",
      shell: true,
      stdio: "inherit"
    });

    activeChild = child;

    child.on("error", (error) => rejectPromise(error));
    child.on("exit", (code, signal) => {
      if (activeChild === child) {
        activeChild = null;
      }

      if (signal) {
        rejectPromise(new Error(`Command interrupted by signal ${signal}: ${command}`));
        return;
      }
      if (code !== 0) {
        rejectPromise(new Error(`Command failed with exit code ${code}: ${command}`));
        return;
      }
      resolvePromise();
    });
  });
}

function commandExists(command) {
  try {
    execSync(command, {
      cwd: desktopDir,
      stdio: ["ignore", "ignore", "ignore"]
    });
    return true;
  } catch {
    return false;
  }
}

function findVsDevCmdPath() {
  const candidates = [];

  if (process.env.VSINSTALLDIR) {
    candidates.push(join(process.env.VSINSTALLDIR, "Common7", "Tools", "VsDevCmd.bat"));
  }

  const programFilesX86 = process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)";
  const vswherePath = join(
    programFilesX86,
    "Microsoft Visual Studio",
    "Installer",
    "vswhere.exe"
  );

  if (existsSync(vswherePath)) {
    try {
      const installationPath = execSync(
        `"${vswherePath}" -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath`,
        {
          cwd: desktopDir,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"]
        }
      ).trim();
      if (installationPath) {
        candidates.push(join(installationPath, "Common7", "Tools", "VsDevCmd.bat"));
      }
    } catch {
      // Fallback to candidate probing below.
    }
  }

  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function loadVsEnvironment(vsDevCmdPath) {
  const raw = execSync(`"${vsDevCmdPath}" -no_logo -arch=x64 -host_arch=x64 >nul && set`, {
    cwd: desktopDir,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    shell: "cmd.exe",
    stdio: ["ignore", "pipe", "pipe"]
  });

  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const separator = line.indexOf("=");
    if (separator <= 0) {
      continue;
    }
    const key = line.slice(0, separator);
    const value = line.slice(separator + 1);
    env[key] = value;
  }

  return env;
}

function resolveTauriEnv() {
  const tauriEnv = {
    ...process.env,
    DOSSIER_UI_DEV_SERVER: "http://127.0.0.1:5173",
    DOSSIER_BACKEND_SCRIPT: "dist/backend.js"
  };

  if (process.platform !== "win32") {
    return tauriEnv;
  }

  const hasCl = commandExists("where cl");
  const hasLink = commandExists("where link");
  if (hasCl && hasLink) {
    return tauriEnv;
  }

  const vsDevCmdPath = findVsDevCmdPath();
  if (!vsDevCmdPath) {
    throw new Error(
      "Unable to locate Visual Studio developer environment. Install Visual Studio Build Tools with 'Desktop development with C++'."
    );
  }

  console.log(`Bootstrapping MSVC toolchain from ${vsDevCmdPath}`);
  return {
    ...tauriEnv,
    ...loadVsEnvironment(vsDevCmdPath)
  };
}

async function main() {
  await run("pnpm run preflight:rust");
  await run("pnpm run preflight:port");
  await run("pnpm run build:deps");
  await run("pnpm run build");

  const tauriEnv = resolveTauriEnv();
  await run("pnpm exec tauri dev --config ./src-tauri/tauri.conf.json", {
    env: tauriEnv
  });
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
