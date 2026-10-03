# Evaluation execution

## Prepare an isolated run

Inspect `package.json`, the CLI package scripts and the current runner flags. Treat those files as authoritative for command syntax.

Read `docs/simulation-lab.md`, `docs/hard-benchmark.md`, `docs/real-benchmark.md`, `docs/learning-study.md`, `docs/confirmation-experiment.md` and `docs/override-experiment.md`.

Create `reports/evaluations/<UTC timestamp>-<source label>/` in the real repository. Keep logs and intermediate files inside that directory.

Copy the working tree into an isolated workspace, including untracked evaluation fixtures and scripts. Exclude `.git`, personal profiles and generated presentation assets.
Install from the lockfile there and build the CLI once. Record a content hash of the tested source snapshot alongside Git HEAD and dirty status.

Some runners write fixed filenames or read original baseline files by name. Run those families in separate disposable snapshots with original reference files intact.
Copy their outputs into the dated evidence bundle after each run. Never run fixed-output suites over the real repository's preserved reports.

Run existing CLI metric checks and type checks. Keep command exit codes and elapsed time in the execution log.

## Required families

| Family | Runner or guide | Evidence to retain |
|---|---|---|
| CLI state and repeatability | CLI actions, `docs/simulation-lab.md` | Disposable profile, ten ratings, claims and recommendations, one contradictory rating, clean replay |
| Easy synthetic sanity check | `dist/lab/run.js` | 24 designed people plus 240 variations, seed 42, four clones, and reversed-rating sensitivity |
| Hard synthetic regression | `scripts/hard-run.mjs` | Fixed 18 people, all simple baselines, all checkpoints, belief revision, questions, damage and failures |
| Recorded real-film regression | `scripts/real-run.mjs` | Fixed 31 viewers, bundled metadata, public reviews and other baselines, per-viewer results |
| Metadata and model comparisons | `scripts/study-suite.mjs` | Both metadata sources, unchanged personal truth, all eleven methods, score parity with the CLI |
| Frozen TMDB regression | `scripts/tmdb-regression.mjs` | Comparison with the protected reference, fixture and evaluator integrity |
| Fixed candidate confirmation replay | `scripts/confirmation-run.mjs` | All 47 viewers, public reviews, unchanged candidate, current Dossier, eight unusual-taste cases |
| Backwards-learning diagnosis | `scripts/backwards-diagnosis.mjs` | Five original cases, each rating step, score contributions and twelve final-library rating orders |
| Unusual-taste protection | `scripts/override-run.mjs` | All 108 viewers, 30-viewer subgroup, supplied-evidence decisions, missed opportunities, five failure checks |

Paths above are relative to `apps/dossier-cli/`. Use direct runner arguments for unique output paths when available.
The original CLI sanity check proves action-to-model changes and deterministic replay. Live UI parity is outside this evaluation.

### Current command examples

Run these commands from the isolated repository root after building the CLI. Replace `RUN` with the absolute evidence directory.
Inspect runner flags before executing because the lab can change.

```sh
pnpm --filter @dossier/cli build:bundle
pnpm --filter @dossier/cli test
pnpm --filter @dossier/cli typecheck
node apps/dossier-cli/dist/lab/run.js --users 264 --variations 10 --seed 42 --clones 4 --output RUN/easy.json
node apps/dossier-cli/dist/lab/run.js --sensitivity --output RUN/easy-sensitivity.json
node apps/dossier-cli/scripts/hard-run.mjs --reference apps/dossier-cli/benchmarks/hard-v1-reference.json --output RUN/hard.json --html RUN/hard.html
node apps/dossier-cli/scripts/real-run.mjs --reference apps/dossier-cli/benchmarks/real-v1-reference.json --output RUN/real.json --html RUN/real.html
node apps/dossier-cli/scripts/study-suite.mjs --prefix RUN/study
node apps/dossier-cli/scripts/tmdb-regression.mjs --output RUN/tmdb.json
node apps/dossier-cli/scripts/confirmation-run.mjs --output RUN/confirmation.json
node apps/dossier-cli/scripts/backwards-diagnosis.mjs
node apps/dossier-cli/scripts/override-run.mjs --output RUN/override.json
```

The diagnosis runner currently writes `reports/backwards-learning-diagnosis-v1.json`. Preserve that output from its disposable workspace.
The override runner reads baseline diagnosis and confirmation files. Keep those original files available as historical references.
Run expensive families sequentially and provide brief progress updates.

## A changed model needs a fair replay

The original override runner requires the original model fingerprint. The diagnosis runner requires the original failure endpoints.
Those checks establish reproduction of historical failures. They cannot test a changed model as though it were the original model.

When the current model differs, reproduce the original failures using recoverable archived source in a separate workspace.
Test the current model on exactly those viewers, rating orders, hidden films and checkpoints using a separately versioned evaluation driver.
Preserve the original protocols and references. Record both model identities and every evaluator change.

That driver may adapt lab plumbing, but it must preserve scoring, truth separation and the unchanged candidate.
Use original endpoints as the comparison, rather than requiring a changed model to repeat its predecessor's errors.
Measure final scores, ten-to-forty losses and the largest loss after one added rating. Inspect recommendation and claim changes.

If archived source or a valid current-model driver is unavailable, mark the affected family blocked.
Continue independent tests and publish a partial report with that limitation. Never bypass a fingerprint check or fabricate reproduction.

## Required measurements

Use checkpoints of 1, 3, 5, 10, 20 and 40 ratings where the protocol supports them.
The legacy easy lab starts at three ratings; its separate sensitivity trial supplies the one-rating check.

Retain ranking AUC, clear likes among ten suggestions, recommendation coverage, person-level spread and individual losses.
Retain graded ranking error where implemented. Dossier returns ranking scores, so rating MAE is unavailable without calibrated rating predictions.
Report high-ranked dislikes and claim mistakes with their denominators. Label them as proxies rather than calibrated high-confidence prediction errors.

Measure claim outcomes and supporting evidence before and after contradiction. Keep removed, narrowed, replaced, unchanged and overcorrected outcomes distinct.
Keep changing eligibility visible: a better correction percentage can result from fewer eligible claims.

Compare Dossier questions with paired random reasonable titles. Use the same initial evidence, hidden films and total question count.
Measure evidence-count efficiency, not only the final score. Report a plateau only with a predefined, reproducible criterion.

Run reversed ratings, shuffled ratings, removed important ratings, injected contradictions and reduced evidence.
Investigate damage conditions that fail to hurt the score. Show whether the problem affects the average or only particular people.

For the five failures, attribute changes to film representation, grouping, claims, dislike penalties or question selection only when interventions support that attribution.
Label untested explanations as hypotheses. Compare identical final libraries across rating orders separately from clones receiving different films.

## Verify the evidence

Repeat complete primary real-viewer runs from clean disposable state. Compare result data after removing genuine timestamps and durations only.
Recalculate ordering scores and top-ten counts independently from saved scores and hidden ratings. Recheck supplied titles against the training pool.
Check candidate and protection decisions against revealed evidence only. Record missing source-rating checks if the pinned MovieLens archive is unavailable.

The existing `verify-study.py`, `verify-confirmation.py` and `verify-override.py` use fixed report paths and temporary archive paths.
Inspect them before use. Adapt input paths in a disposable copy while preserving their calculations and checks.
Keep verification outputs beside the exact result file hashes they cover. Old verification does not certify a new run.

A failed repeat, scoring mismatch or hidden-answer leak invalidates the affected comparison. Explain it before making a product recommendation.
