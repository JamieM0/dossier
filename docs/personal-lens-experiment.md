# Test a personal lens

Use experiment 4 to test whether explicit personal distinctions repair missing representation while preserving user control and honest uncertainty.

## Review the earlier decisions

Experiments 1, 2, and 3 each returned `do_not_promote`. Their candidates failed at least one frozen quality, protection, or control gate.

Experiment 4 retains the current greedy geometry, rating scorer, inferred claims, and product question queue.

Stable grouping removed rating-order dependence without protecting weaker profiles. Refine weights produced little gain and unreliable correction reversals.

Question policies estimated uncertainty inside the existing representation. Their estimates did not establish that the representation captured the person's important distinctions.

## Run the personal-lens study

To build the CLI and replay the frozen protocol, run:

```sh
pnpm lab:personal-lens
```

The command writes `reports/personal-lens-v1.json` and `reports/personal-lens-v1.md`. The JSON records every question, feature, limitation, and session.

The repository stores lossless session traces as `reports/personal-lens-v1.json.gz`. The CLI regenerates the readable JSON.

To run a limited check without replacing the full report, run:

```sh
pnpm lab:personal-lens -- --max-viewers 2 --output /tmp/personal-lens-smoke.json
```

Limited runs return `smoke_only`. They cannot select a candidate.

The runner also accepts `--cohort synthetic_movies_development` with a separate output. Any cohort filter forces `smoke_only`.

## Compare the three scoring arms

Every arm receives the same 40 ratings. Only the current person's descriptive metadata and revealed evidence cross the CLI boundary.

| Arm | Behavior |
| --- | --- |
| `fixed` | Use the current rating scorer without claims. |
| `inferred` | Use the current scorer and inferred claims. |
| `personal` | Add confirmed personal distinctions to the inferred arm. |

A separate control receives 50 randomly ordered training ratings. Recorded people with fewer than 50 training ratings do not enter equal-budget comparisons.

The study permits ten distinction prompts. Exhausted queues retain their terminal profile at later checkpoints.

Repeated sessions average within each person before uncertainty estimates. Sealed movie and book cohorts must pass every decision gate separately.

## Generate personal distinctions

The queue finds rated pairs with opposite polarity and cosine similarity of at least `0.97`.

Each question offers at most eight metadata distinctions. The rule language supports genres, tags, decades, directors, creators, collections, and axis thresholds.

A distinction contains one or two predicates. Selection uses revealed ratings, predicate support, and deterministic tie-breaking.

The person can confirm one offered distinction or choose `none`. The evaluator never invents a confirmation from a recorded rating correlation.

Confirmed distinctions add a bounded score contribution to matching candidates. Each feature contributes `0.3`; the combined adjustment stays within `-0.6` and `0.6`.

The profile stores at most six confirmed features. Correction replaces the feature's polarity; removal deletes its score contribution and explanation.

## Record representation limits

Choosing `none` stores the source pair's vectors as a known limitation. Nearby candidates receive a confidence cap of `0.35`.

The cap changes confidence rather than ranking. Confidence remains an uncalibrated proxy based on neighbour agreement and confirmed features.

The report counts high-confidence ordering errors and the coverage of confident pairs. Lower error burden can result from withholding confidence.

Broad limitation regions can reduce confidence in unrelated metadata distinctions. Read confidence results with AUC and coverage.

## Inspect the experimental CLI actions

The personal lens lives in `settings.experimentalPersonalLens`. The shared encrypted dossier codec preserves its features and limitations without a schema change.

| Action | Required arguments | Behavior |
| --- | --- | --- |
| `lens.queue` | None | List rated counterexamples and offered distinctions. |
| `lens.inspect` | None | Inspect confirmed features and limitations. |
| `lens.answer` | `id`, `choice`, `expectedRevision` | Confirm an offered feature ID or select `none`. |
| `lens.correct` | `id`, `effect`, `expectedRevision` | Replace feature polarity with `positive` or `negative`. |
| `lens.remove` | `id`, `expectedRevision` | Remove a confirmed feature. |

Use the optional `personalLens` argument with `suggest.list` or `suggest.explain`. Accepted values are `fixed`, `inferred`, and `personal`.

Experimental scoring disables public-score and popularity contributions. Omit the argument to retain default scoring.

For example, run:

```sh
pnpm cli suggest --personal-lens personal --limit 10 --json
```

Experimental recommendation rows include `lensEvidence`. This object names matching features, known limitations, confidence, and the score adjustment.

The desktop app does not consume these experiment settings. The CLI profile reset clears the experimental personal lens.

## Preserve the frozen protocol

The protocol is `apps/dossier-cli/benchmarks/personal-lens-v1-protocol.json`. It fixes fixture hashes, candidate settings, budgets, and decision gates.

The fixture generator refuses to replace an existing fixture or protocol. Create a new version to test another hypothesis or change a threshold.

The runner fingerprints the model and evaluator before sessions begin. It requires identical fingerprints throughout development and sealed evaluation.

Prior cohorts provide regressions. Their ratings cannot establish the causes of a preference, so their simulated distinction answers are always `none`.

The new synthetic cohort contains 48 development people and 24 sealed people across movies and an invented books domain.

Synthetic people confirm only an offered predicate identical to their hidden causal rule. These exact answers overstate what real people may reliably explain.

The books adapter uses generic vectors and predicates through offline movie identifiers. It tests mechanism reuse without adding books to the product.

## Verify default behavior

To replay synthetic, hard, TMDB, confirmation, and override regressions, run:

```sh
pnpm lab:personal-lens-regressions
```

The command writes `reports/personal-lens-regression-v1.json`. It leaves earlier experiment reports unchanged.

The override compatibility replay omits only the old model-identity guard. It retains fixture checks and requires identical baseline outcomes.
