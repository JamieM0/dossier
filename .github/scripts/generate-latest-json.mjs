// Generates latest.json for the Tauri updater from signed build artifacts.
// Reads .app.tar.gz.sig (macOS) and, if present, -setup.exe.sig (Windows) from
// ARTIFACTS_DIR, then writes a combined latest.json pointing at the release on
// BUILDS_REPO.
//
// Releases are now built locally and published to the main dossier repo, so the
// macOS artifact is required and Windows is optional (only emitted if a Windows
// signature is found in the artifacts dir).
//
// Required env vars:
//   TAG           - git tag, e.g. "v0.1.3"
//   ARTIFACTS_DIR - directory containing the collected artifacts (default: "dist")
//   OUTPUT        - output path for latest.json (default: "latest.json")
//   BUILDS_REPO   - owner/repo where the release will be published
//                   (default: "JamieM0/dossier")

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const tag = process.env.TAG;
const artifactsDir = process.env.ARTIFACTS_DIR ?? 'dist';
const output = process.env.OUTPUT ?? 'latest.json';
const buildsRepo = process.env.BUILDS_REPO ?? 'JamieM0/dossier';

if (!tag) {
  console.error('Error: TAG env var is required (e.g. TAG=v0.1.3)');
  process.exit(1);
}

const version = tag.replace(/^v/, '');
const files = readdirSync(artifactsDir);

const macSigFile = files.find(f => f.endsWith('.app.tar.gz.sig'));
const winSigFile = files.find(f => f.endsWith('-setup.exe.sig'));

if (!macSigFile) {
  console.error(`Error: no .app.tar.gz.sig found in ${artifactsDir}/`);
  console.error(`Files present: ${files.join(', ')}`);
  process.exit(1);
}

const baseUrl = `https://github.com/${buildsRepo}/releases/download/${tag}`;

const platforms = {
  'darwin-aarch64': {
    signature: readFileSync(join(artifactsDir, macSigFile), 'utf8').trim(),
    url: `${baseUrl}/${macSigFile.replace(/\.sig$/, '')}`,
  },
};

if (winSigFile) {
  platforms['windows-x86_64'] = {
    signature: readFileSync(join(artifactsDir, winSigFile), 'utf8').trim(),
    url: `${baseUrl}/${winSigFile.replace(/\.sig$/, '')}`,
  };
} else {
  console.warn('Warning: no -setup.exe.sig found — emitting macOS-only latest.json');
}

const latest = {
  version,
  notes: '',
  pub_date: new Date().toISOString(),
  platforms,
};

const json = JSON.stringify(latest, null, 2) + '\n';
writeFileSync(output, json);
console.log(`Generated ${output}:`);
console.log(json);
