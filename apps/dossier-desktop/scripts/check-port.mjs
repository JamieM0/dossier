import { Socket } from "node:net";
import { execSync } from "node:child_process";

const HOST = "127.0.0.1";
const PORT = 34250;
const TIMEOUT_MS = 800;

function printPortInUseHelp() {
  console.error(`Port ${HOST}:${PORT} is already in use.`);
  console.error("Stop the existing process, then rerun `pnpm dev`.");

  if (process.platform === "win32") {
    try {
      const output = execSync(`netstat -ano | findstr :${PORT}`, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"]
      }).trim();
      if (output) {
        console.error("");
        console.error("Matching sockets (Windows):");
        console.error(output);
        console.error("");
        console.error("Use Task Manager or:");
        console.error("  taskkill /PID <pid> /F");
      }
      return;
    } catch {
      console.error(`Try: netstat -ano | findstr :${PORT}`);
      return;
    }
  }

  try {
    const output = execSync(`lsof -nP -iTCP:${PORT} -sTCP:LISTEN`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
    if (output) {
      console.error("");
      console.error("Listening process:");
      console.error(output);
      console.error("");
      console.error(`Quick kill command (macOS/Linux):`);
      console.error(`  kill -9 $(lsof -tiTCP:${PORT} -sTCP:LISTEN)`);
    }
  } catch {
    console.error(`Try: lsof -nP -iTCP:${PORT} -sTCP:LISTEN`);
  }
}

function finish(code) {
  process.exit(code);
}

const socket = new Socket();
let done = false;

function complete(code) {
  if (done) {
    return;
  }
  done = true;
  socket.destroy();
  finish(code);
}

socket.setTimeout(TIMEOUT_MS);

socket.once("connect", () => {
  printPortInUseHelp();
  complete(1);
});

socket.once("timeout", () => {
  complete(0);
});

socket.once("error", (error) => {
  if ("code" in error) {
    if (error.code === "ECONNREFUSED") {
      complete(0);
      return;
    }

    if (error.code === "EPERM") {
      console.error(
        `Warning: unable to probe ${HOST}:${PORT} due to permission limits (EPERM). Continuing startup.`
      );
      complete(0);
      return;
    }
  }

  console.error(`Failed to probe ${HOST}:${PORT}: ${error.message}`);
  complete(1);
});

socket.connect(PORT, HOST);
