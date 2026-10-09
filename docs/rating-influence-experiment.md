# Rating influence experiment

This reference explains the synthetic lab protocol and its adoption requirements.
Read the [mechanism report](../reports/rating-influence-mechanisms-v1.md) before interpreting candidate outcomes.
Jamie remains the only real product user. Question selection and shared contexts remain deferred.

## Candidates and evidence

The lab tests three explanations with three candidates.
Narrow recent matching raises cosine similarity to power eight instead of four.
Local exceptions restrict a surprising observation to matches with cosine similarity at least 0.85.
A surprising observation contradicts its preceding evidence by more than 0.15, with at least one unit of matching evidence.
The exception rule reconstructs chronological history using original timestamps and stable keys.
It never reads future observations when classifying an observation.
Additive recent matching replaces the changing denominator with the fixed prior of two.
All candidates retain stored inferred preferences and the thirty-day half-life.

The scorer receives public metadata, observed ratings, stored inferred preferences, and reference time.
The evaluator retains private taste, mistake labels, actor types, and future preferences.
These inputs never enter a candidate scorer.
Explicit ratings remain exact and never become inferred preferences.

The fixture contains 44 development, 88 selection, and 88 confirmation people.
Each person supplies sixty ratings in each of two sessions.
Each partition uses a different generated catalogue with disjoint title keys.
The development cohort tests the fixed mechanisms before the reserved evaluation.
No parameter search occurs in this version.

Eleven actor types cover stable preferences, interactions, unavailable factors, three mistake patterns, changing taste, weak ratings, novel preferences, duplicates, and metadata-matched tastes.
Novel-preference histories expose the selected tag after thirty observations.
Duplicate histories begin with twenty distinct titles sharing metadata.
Metadata-matched people can like and dislike identical descriptions because private craft preference differs.
Missing-factor and metadata-matched people test unavailable information; their results must remain visible.

## Acceptance requirements

The frozen JSON protocol retains the corroboration thresholds.
Mean final gain against current scoring must reach two ranking points, with a positive person-level interval lower bound.
The worst tenth and every actor group must remain within one point of current scoring.
Contemporaneous quality must also remain within one point.
No update after ten ratings can lose more than five points.
Large-loss frequency must fall by at least half against current scoring.
Changing people must retain eighty percent of recent matching's positive final gain.
Adaptation at forty observations must remain within one point of current scoring.
Novel-preference people must show positive mean learning between observations thirty and sixty.
The analysis also compares every candidate directly against timeless and recent matching.

All explicit-rating, overwrite, removal, timestamp, encrypted-portability, read-only, ordering, and restoration contracts must pass.
The scorer must reproduce identical scores across eight storage-order permutations.
Independent formula reconstruction must reproduce every published score and ranking measurement.
The selected candidate must pass both reserved cohorts without later tuning.

Five archived synthetic failures add regression coverage with the previous numerical historical thresholds.
They require three-point final gain, at most three-point total decline, and no update loss above five points.
These synthetic cases do not replace the existing five historical real-data failures.
The existing historical requirement remains mandatory before adoption.
This version leaves candidate protection on those real-data histories unverified to respect the synthetic-only evaluation scope.
An unverified historical requirement blocks adoption even if every synthetic requirement passes.
Existing frozen regressions still check that current product outcomes remain unchanged.

## Measurements and limits

Every update compares old and new recommendations against the same taste at that moment.
Taste changes after observation thirty. Final adaptation is a separate measurement.
Intervals resample people, after averaging sessions within each person.
Reports include average quality, actor groups, worst updates, large losses, and learning from novel evidence.
A full metadata collision imposes an information limit for unseen titles.
A feature-vector collision can instead expose information lost by the current representation.
Synthetic ranking cannot establish retrieval quality or usefulness for Jamie.

## Reproduction

Build the existing runtime with `pnpm --filter @dossier/cli build:bundle`.
The following commands reproduce the staged procedure in a checkout without completed experiment-eleven outputs.
The freeze command refuses to replace a reference. Reserved runners refuse to replace completed results.

```sh
node apps/dossier-cli/scripts/prepare-rating-influence.mjs
node apps/dossier-cli/scripts/rating-influence-diagnosis.mjs
node apps/dossier-cli/scripts/rating-influence-run.mjs --partition development
node apps/dossier-cli/scripts/rating-influence.check.mjs --report reports/rating-influence-v1-development.jsonl.gz
node apps/dossier-cli/scripts/rating-influence-run.mjs --freeze
node apps/dossier-cli/scripts/rating-influence-run.mjs --partition sealed
node apps/dossier-cli/scripts/rating-influence.check.mjs --report reports/rating-influence-v1-sealed.jsonl.gz
node apps/dossier-cli/scripts/rating-influence-run.mjs --partition confirmation
node apps/dossier-cli/scripts/rating-influence.check.mjs --report reports/rating-influence-v1-confirmation.jsonl.gz
node apps/dossier-cli/scripts/rating-influence-regressions.mjs
```

For a completed checkout, run the verification commands against the committed archives.
The fixture generator also refuses to replace existing inputs.
The frozen reference hashes candidates, evaluator, criteria, development outputs, and preserved earlier experiment records.
