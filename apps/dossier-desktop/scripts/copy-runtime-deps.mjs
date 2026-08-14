import { cpSync, existsSync, mkdirSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, parse, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const outputRoot = join(scriptDir, "..", "dist", "node_modules");
const desktopManifest = join(scriptDir, "..", "package.json");
const desktopPackage = JSON.parse(readFileSync(desktopManifest, "utf8"));
const entryDependencies = Object.entries(desktopPackage.dependencies ?? {})
  .filter(([, version]) => !version.startsWith("workspace:"))
  .map(([name]) => name);

function readManifest(packageRoot) {
  return JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));
}

function findPackageRoot(resolvedFile, expectedName) {
  let candidate = resolvedFile;
  while (candidate !== parse(candidate).root) {
    candidate = dirname(candidate);
    const manifestPath = join(candidate, "package.json");
    if (!existsSync(manifestPath)) continue;
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    if (manifest.name === expectedName) return realpathSync(candidate);
  }
  throw new Error(`Could not find package root for ${expectedName} from ${resolvedFile}`);
}

function resolvePackage(name, fromManifest) {
  const requireFromPackage = createRequire(fromManifest);
  try {
    return realpathSync(dirname(requireFromPackage.resolve(`${name}/package.json`)));
  } catch {
    return findPackageRoot(requireFromPackage.resolve(name), name);
  }
}

function dependencyNames(manifest) {
  return Object.keys({
    ...(manifest.dependencies ?? {}),
    ...(manifest.optionalDependencies ?? {})
  });
}

const packages = new Map();
const preferredByName = new Map();
const queue = entryDependencies.map((name) => resolvePackage(name, desktopManifest));

while (queue.length > 0) {
  const packageRoot = queue.shift();
  if (packages.has(packageRoot)) continue;

  const manifest = readManifest(packageRoot);
  const dependencies = new Map();
  const fromManifest = join(packageRoot, "package.json");
  for (const name of dependencyNames(manifest)) {
    try {
      const dependencyRoot = resolvePackage(name, fromManifest);
      dependencies.set(name, dependencyRoot);
      queue.push(dependencyRoot);
    } catch (error) {
      if (!(name in (manifest.optionalDependencies ?? {}))) throw error;
    }
  }

  packages.set(packageRoot, { manifest, dependencies });
  if (!preferredByName.has(manifest.name)) preferredByName.set(manifest.name, packageRoot);
}

rmSync(outputRoot, { recursive: true, force: true });
mkdirSync(outputRoot, { recursive: true });

function copyPackage(sourceRoot, destinationRoot) {
  cpSync(sourceRoot, destinationRoot, {
    recursive: true,
    filter(source) {
      const relativeSource = relative(sourceRoot, source);
      return relativeSource !== "node_modules" && !relativeSource.startsWith(`node_modules${sep}`);
    }
  });

  const { dependencies } = packages.get(sourceRoot);
  for (const [name, dependencyRoot] of dependencies) {
    if (preferredByName.get(name) === dependencyRoot) continue;
    copyPackage(dependencyRoot, join(destinationRoot, "node_modules", ...name.split("/")));
  }
}

for (const [name, sourceRoot] of preferredByName) {
  copyPackage(sourceRoot, join(outputRoot, ...name.split("/")));
}

console.log(`Copied ${packages.size} runtime packages to dist/node_modules`);
