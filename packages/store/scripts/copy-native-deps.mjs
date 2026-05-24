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
