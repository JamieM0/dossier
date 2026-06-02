import { cpSync, mkdirSync } from "fs";
import { createRequire } from "module";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

const keytarDir = dirname(require.resolve("keytar/package.json"));
const destDir = join(__dirname, "../dist/node_modules/keytar");

mkdirSync(join(destDir, "lib"), { recursive: true });
mkdirSync(join(destDir, "build", "Release"), { recursive: true });

cpSync(join(keytarDir, "package.json"), join(destDir, "package.json"));
cpSync(join(keytarDir, "lib", "keytar.js"), join(destDir, "lib", "keytar.js"));
cpSync(join(keytarDir, "build", "Release", "keytar.node"), join(destDir, "build", "Release", "keytar.node"));

console.log("Copied keytar native module to dist/node_modules/keytar");

// Bundle @dossier/domain's compiled output INTO this package's dist so that
// `import { ... } from "@dossier/domain"` resolves at runtime in the packaged
// app via Node's node_modules walk from store/dist (the packaged app does not
// ship workspace symlinks). Same mechanism as keytar above. The store dist is
// already globbed into tauri bundle.resources, so the nested copy ships too.
const domainDir = dirname(require.resolve("@dossier/domain/package.json"));
const domainDest = join(__dirname, "../dist/node_modules/@dossier/domain");

mkdirSync(domainDest, { recursive: true });
cpSync(join(domainDir, "package.json"), join(domainDest, "package.json"));
cpSync(join(domainDir, "dist"), join(domainDest, "dist"), { recursive: true });

console.log("Copied @dossier/domain to dist/node_modules/@dossier/domain");
