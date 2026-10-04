import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
const output = 'apps/dossier-cli/benchmarks/preparation-v1-reference.json';
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const sourcePaths = readdirSync('packages/domain/src', { recursive: true }).filter(p => p.endsWith('.ts') && !p.endsWith('.test.ts'))
  .map(p => 'packages/domain/src/' + p).concat(['apps/dossier-cli/src/actions.ts', 'apps/dossier-cli/src/lab/question-policy.ts']);
const archived = ['reports/backwards-learning-diagnosis-v1.json', 'reports/stable-geometry-v1.json', 'reports/refine-signal-v1.json',
  'reports/question-policy-v1.json.gz', 'reports/personal-lens-v1.json.gz', 'reports/personal-lens-45-v1.json.gz', 'reports/contextual-taste-v1.json.gz',
  'reports/dossier-real-v1-baseline.json', 'reports/dossier-learning-study-tmdb.json', 'reports/reviews-plus-tags-confirmation-v1.json',
  'reports/observed-rating-override-v1.json'];
const fixturePaths = readdirSync('apps/dossier-cli/benchmarks').filter(p => p.endsWith('-protocol.json')).map(p => 'apps/dossier-cli/benchmarks/' + p)
  .concat(readdirSync('apps/dossier-cli/src/lab').filter(p => p.endsWith('.json')).map(p => 'apps/dossier-cli/src/lab/' + p));
if (process.argv.includes('--freeze')) {
  assert(!existsSync(output), 'The preparation reference already exists; create a new version.');
  writeFileSync(output, JSON.stringify({ version: 'preparation-v1',
    purpose: 'Current scorer reference before effective correction. Archive outcomes remain immutable.',
    libraryBehavior: 'Latest rating replaces the previous rating for the same key; clearing removes it.',
    sourceHashes: Object.fromEntries(sourcePaths.sort().map(p => [p, hash(p)])),
    archiveHashes: Object.fromEntries([...archived, ...fixturePaths].sort().map(p => [p, hash(p)])),
    failures: JSON.parse(readFileSync(archived[0])).cases.map(c => ({ viewer: c.viewer, seed: c.seed, auc10: c.auc10, auc40: c.auc40 }))
  }, null, 2) + '\n');
}
const reference = JSON.parse(readFileSync(output));
for (const [path, expected] of Object.entries(reference.archiveHashes)) assert.equal(hash(path), expected, `Archived evidence changed: ${path}`);
const changedSources = Object.entries(reference.sourceHashes).filter(([p,h]) => hash(p) !== h).map(([p]) => p);
console.log(JSON.stringify({ archivedEvidenceUnchanged: true, currentModelMatches: changedSources.length === 0, changedSources }));
if (process.argv.includes('--require-model')) assert.equal(changedSources.length, 0);
