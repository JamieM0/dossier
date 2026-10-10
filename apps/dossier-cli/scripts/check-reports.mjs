import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('..', import.meta.url));
const root = fileURLToPath(new URL('../../..', import.meta.url));
const checks = ['hard-metrics', 'real-metrics', 'study-metrics', 'confirmation', 'override', 'geometry', 'refine',
  'question-policy', 'personal-lens', 'personal-lens-45', 'contexts', 'library-replay', 'effective-correction',
  'guarded-correction', 'impact-correction', 'learning-stability', 'corroboration-policy', 'corroboration'];
// Historical checks use different working directories. Keep their source intact.
const historical = spawnSync(process.execPath, ['--test', ...checks.map(name => `scripts/${name}.check.mjs`)], { cwd: cli, stdio: 'inherit' });
const influence = spawnSync(process.execPath, ['--test', 'apps/dossier-cli/scripts/rating-influence.check.mjs',
  'apps/dossier-cli/scripts/personal-traces.check.mjs'], { cwd: root, stdio: 'inherit' });
process.exit((historical.status ?? 1) || (influence.status ?? 1));
