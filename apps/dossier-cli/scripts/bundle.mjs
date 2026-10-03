import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "../../..");
const app = join(root, "apps", "dossier-cli");
const output = join(app, "bundle");
const copyPackage = (source, target) => {
  mkdirSync(target, { recursive: true });
  cpSync(join(source, "package.json"), join(target, "package.json"));
  cpSync(join(source, "dist"), join(target, "dist"), { recursive: true });
};

rmSync(output, { recursive: true, force: true });
mkdirSync(join(output, "bin"), { recursive: true });
cpSync(join(app, "bin", "dossier.js"), join(output, "bin", "dossier.js"));
cpSync(join(app, "bin", "dossier-lab.js"), join(output, "bin", "dossier-lab.js"));
copyPackage(app, output);
copyPackage(join(root, "packages", "domain"), join(output, "node_modules", "@dossier", "domain"));
copyPackage(join(root, "packages", "store"), join(output, "node_modules", "@dossier", "store"));
cpSync(join(root, "packages", "store", "dist", "node_modules", "keytar"), join(output, "node_modules", "keytar"), { recursive: true });
writeFileSync(join(output, "README.txt"), "Dossier CLI\n\nRequires Node.js 20 or later on macOS. Run ./bin/dossier.js help.\nRun ./bin/dossier-lab.js --output lab-report.json for an offline simulation.\nThe local service starts when you run a dossier command.\n");
const manifest = JSON.parse(readFileSync(join(output, "package.json"), "utf8"));
if (!manifest.bin?.dossier) throw new Error("CLI bundle is missing its command entry");
if (!manifest.bin?.["dossier-lab"]) throw new Error("CLI bundle is missing its lab entry");
