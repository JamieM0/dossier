import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** Reads the version that `version-bump.py` bumps/tags for releases, so the
 * web build (which has no packaged app version) can compare itself against
 * GitHub Releases at runtime. Falls back to a dev marker outside the repo. */
function readAppVersion(): string {
  try {
    const pkgPath = fileURLToPath(new URL("../dossier-desktop/package.json", import.meta.url));
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    return typeof pkg.version === "string" ? pkg.version : "0.0.0-dev";
  } catch {
    return "0.0.0-dev";
  }
}

export default defineConfig({
  plugins: [sveltekit()],
  define: {
    __APP_VERSION__: JSON.stringify(readAppVersion())
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true
  }
});
