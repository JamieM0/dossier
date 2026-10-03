import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { round } from './hard-metrics.mjs';
import { renderStudyHtml } from './study-html.mjs';

const flags = process.argv.slice(2);
const value = (flag, fallback) => flags.includes(flag) ? flags[flags.indexOf(flag) + 1] : fallback;
const prefix = value('--prefix', 'reports/dossier-learning-study-current');
if (prefix === 'reports/dossier-learning-study') throw new Error('The baseline is frozen. Choose a different --prefix for current results.');
const reuse = flags.includes('--reuse-results');
const paths = { bundled: `${prefix}-bundled.json`, tmdb: `${prefix}-tmdb.json` };
for (const [name, fixture] of [['bundled', 'real-v1'], ['tmdb', 'real-tmdb-v1']]) {
  if (!reuse) {
    const result = spawnSync(process.execPath, ['apps/dossier-cli/scripts/study-run.mjs', '--fixture', `apps/dossier-cli/src/lab/${fixture}.json`, '--output', paths[name]], { stdio: ['ignore', 'ignore', 'inherit'] });
    if (result.status !== 0) throw new Error(`${name} benchmark failed`);
  }
}
const runs = Object.fromEntries(Object.entries(paths).map(([name,path]) => [name, JSON.parse(readFileSync(path))]));
const oldFixture = JSON.parse(readFileSync('apps/dossier-cli/src/lab/real-v1.json'));
const fixture = JSON.parse(readFileSync('apps/dossier-cli/src/lab/real-tmdb-v1.json'));
if (JSON.stringify(fixture.viewers) !== JSON.stringify(oldFixture.viewers)) throw new Error('Metadata comparison changed the hidden truth');
if (runs.bundled.modelFingerprint !== runs.tmdb.modelFingerprint || runs.bundled.evaluatorFingerprint !== runs.tmdb.evaluatorFingerprint) throw new Error('Metadata comparison changed the model or evaluator');
const baseline = JSON.parse(readFileSync('reports/dossier-real-v1-baseline.json'));
const bundledMatchesOriginal = runs.bundled.sessions.every(session => {
  const prior = baseline.sessions.find(row => row.viewer === session.viewer && row.seed === session.seed);
  return Object.keys(session.snapshots).every(count => JSON.stringify(session.snapshots[count].dossier) === JSON.stringify(prior.snapshots[count].dossier));
});
const report = { version: 'learning-study-v1', runs, metadataAudit: { parentFixtureHash: fixture.parentFixtureHash, directors: fixture.items.filter(item => item.directorIds.length).length, collections: fixture.items.filter(item => item.collection).length,
  discrepancies: fixture.selection.metadataDiscrepancies, imdbChecks: fixture.selection.identityAudit, tvException: fixture.selection.tvException },
  verification: { bundledMatchesOriginal, unchangedTruth: true, componentMatchesCli: true, completeRuns: 2 }, comparison: null };
const reference = value('--reference', '');
if (reference) {
  const previous = JSON.parse(readFileSync(reference));
  report.comparison = {};
  for (const [name,current] of Object.entries(runs)) {
    const old = previous.runs[name];
    if (current.fixtureHash !== old.fixtureHash || current.evaluatorFingerprint !== old.evaluatorFingerprint || JSON.stringify(current.seeds) !== JSON.stringify(old.seeds)) throw new Error('Regression reference changes cohort or scoring procedure');
    const oldViewers = new Map(old.viewers.map(row => [row.id,row]));
    const viewers = current.viewers.map(row => ({ id: row.id, delta: round(row.dossierAt20 - oldViewers.get(row.id).dossierAt20) }));
    report.comparison[name] = { modelChanged: current.modelFingerprint !== old.modelFingerprint, auc20: round(current.learning[20].dossier.auc.mean - old.learning[20].dossier.auc.mean), auc3: round(current.learning[3].dossier.auc.mean - old.learning[3].dossier.auc.mean), top10: round(current.learning[20].dossier.precision10.mean - old.learning[20].dossier.precision10.mean), beliefCorrection: round((current.beliefCorrectionRate ?? 0)-(old.beliefCorrectionRate ?? 0)), questionBenefit: round(current.calibration.byCount[20].pairedDelta.mean - old.calibration.byCount[20].pairedDelta.mean), improved: viewers.filter(row => row.delta > .03), regressed: viewers.filter(row => row.delta < -.03), viewers };
  }
}
for (const run of Object.values(report.runs)) {
  run.sessionMeasures = run.sessions.map(({ viewer,seed,observed,snapshots }) => ({ viewer,seed,observed, checkpoints: Object.fromEntries(Object.entries(snapshots).map(([count,snap]) => [count,{ auc:snap.dossier.auc, top10:snap.dossier.precision10, components: Object.fromEntries(Object.entries(snap.components).map(([name,row]) => [name,row.auc])) }])) }));
  delete run.sessions;
}
const verificationPath = value('--verification', '');
if (verificationPath) Object.assign(report.verification, JSON.parse(readFileSync(verificationPath)));
writeFileSync(`${prefix}.json`, JSON.stringify(report,null,2)+'\n');
writeFileSync(`${prefix}.html`, renderStudyHtml(report));
if (flags.includes('--save-reference')) {
  throw new Error('The current study is frozen. Create a separately named reference for a new benchmark version.');
}
process.stdout.write(JSON.stringify({ html:`${prefix}.html`, json:`${prefix}.json`, verified:report.verification, comparison:report.comparison })+'\n');
