# Preparation baseline

Use this reference to compare future model experiments with Dossier before effective correction work.
Jamie is the only real product user. The synthetic lab supplies the primary evidence for model decisions.
Historical MovieLens ratings supply additional regression evidence. They do not represent current product users.

## Product changes

The taste screen shows feedback origin, supporting ratings, and counterexamples instead of numerical confidence.
Evidence counts do not represent measured accuracy. Confirmation influences recommendations without promising an ordering override.
The preparation retains the current scorer and rating questions.

## Library behavior

New lab replays use the same rating transition as the app.
The latest rating replaces earlier evidence for the same title. Clearing removes that rating.
The context diagnostics use this transition for their additional overwrite comparison.
Historical experiment protocols and outcomes remain unchanged.

## Frozen reference

The reference records model source hashes, fixture hashes, archived outcome hashes, and the five severe learning failures.
The preparation commit preserves the corresponding implementation.
Future model experiments keep these archives intact and write separate reports.

To inspect the reference, run:

```sh
node apps/dossier-cli/scripts/preparation-baseline.mjs
```

The command checks archived hashes and lists changed model sources.
To require the preparation model, add `--require-model`.

Read the [frozen reference](../apps/dossier-cli/benchmarks/preparation-v1-reference.json) for the complete hashes.
Read the [learning diagnosis](../reports/backwards-learning-diagnosis-v1.json) for the failure mechanisms.

## Next decision

Test general preferences, title exceptions, and direct comparisons separately.
Require observable correction effects, limited collateral movement, removal, restoration, and encrypted portability.
Use imperfect synthetic explanations and fresh reserved people. Freeze requirements before examining confirmation results.
A passing experiment supports a deliberate adoption decision using synthetic evidence and Jamie's usability review.
