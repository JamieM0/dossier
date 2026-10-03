import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { renderGeometryHtml } from "./geometry-html.mjs";

if (!process.argv.includes("--reuse-results")) {
  const result = spawnSync(process.execPath, ["apps/dossier-cli/scripts/geometry-run.mjs"], {
    stdio: ["ignore", "inherit", "inherit"]
  });
  if (result.status !== 0) throw new Error("Stable geometry experiment failed");
}
const report = JSON.parse(readFileSync("reports/stable-geometry-v1.json"));
writeFileSync("reports/stable-geometry-v1.html", renderGeometryHtml(report));
process.stdout.write(JSON.stringify({
  html: "reports/stable-geometry-v1.html",
  json: "reports/stable-geometry-v1.json",
  decision: report.decision
}) + "\n");
