// Generates latest.json for the Tauri updater from signed build artifacts.
// Reads .app.tar.gz.sig (macOS) and .nsis.zip.sig (Windows) from ARTIFACTS_DIR,
// then writes a combined latest.json pointing at the BUILDS_REPO release.
//
// Required env vars:
//   TAG           - git tag, e.g. "v0.1.3"
//   ARTIFACTS_DIR - directory containing the collected artifacts (default: "dist")
//   OUTPUT        - output path for latest.json (default: "latest.json")
//   BUILDS_REPO   - owner/repo where the release will be published

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const tag = process.env.TAG;
const artifactsDir = process.env.ARTIFACTS_DIR ?? 'dist';
const output = process.env.OUTPUT ?? 'latest.json';
const buildsRepo = process.env.BUILDS_REPO ?? 'JamieM0/dossier-builds';

if (!tag) {
  console.error('Error: TAG env var is required (e.g. TAG=v0.1.3)');
  process.exit(1);
}

const version = tag.replace(/^v/, '');
const files = readdirSync(artifactsDir);

const macSigFile = files.find(f => f.endsWith('.app.tar.gz.sig'));
const winSigFile = files.find(f => f.endsWith('.nsis.zip.sig'));

if (!macSigFile) {
  console.error(`Error: no .app.tar.gz.sig found in ${artifactsDir}/`);
  console.error(`Files present: ${files.join(', ')}`);
  process.exit(1);
}
if (!winSigFile) {
  console.error(`Error: no .nsis.zip.sig found in ${artifactsDir}/`);
  console.error(`Files present: ${files.join(', ')}`);
  process.exit(1);
}

const macSig = readFileSync(join(artifactsDir, macSigFile), 'utf8').trim();
const winSig = readFileSync(join(artifactsDir, winSigFile), 'utf8').trim();

// Derive artifact filename from signature filename (strip .sig)
const macArtifact = macSigFile.replace(/\.sig$/, '');
const winArtifact = winSigFile.replace(/\.sig$/, '');

const baseUrl = `https://github.com/${buildsRepo}/releases/download/${tag}`;

const latest = {
  version,
  notes: '',
  pub_date: new Date().toISOString(),
  platforms: {
    'darwin-aarch64': {
      signature: macSig,
      url: `${baseUrl}/${macArtifact}`,
    },
    'windows-x86_64': {
      signature: winSig,
      url: `${baseUrl}/${winArtifact}`,
    },
  },
};

const json = JSON.stringify(latest, null, 2) + '\n';
writeFileSync(output, json);
console.log(`Generated ${output}:`);
console.log(json);
