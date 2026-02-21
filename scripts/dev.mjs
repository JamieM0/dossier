import { spawn } from "node:child_process";

const isMacos = process.platform === "darwin";

const command = isMacos
  ? ["--parallel", "--filter", "@dossier/dossier-ui", "--filter", "@dossier/dossier-desktop", "dev"]
  : ["--filter", "@dossier/dossier-ui", "dev"];

if (!isMacos) {
  // Desktop shell is macOS-targeted today; keep `pnpm dev` usable on Windows/Linux.
  console.log("Non-macOS environment detected. Running UI dev server only.");
}

const child = spawn("pnpm", command, {
  stdio: "inherit",
  shell: process.platform === "win32",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});

child.on("error", (error) => {
  console.error(`Failed to start pnpm: ${error.message}`);
  process.exit(1);
});
