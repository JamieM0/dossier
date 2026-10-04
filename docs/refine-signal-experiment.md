# Test the Refine signal

Use experiment 2 to test whether explicit comparisons improve Dossier's learning and control beyond ratings alone.

## Run the experiment

To build the CLI and run the frozen protocol, use:

```sh
pnpm lab:refine-signal
```

The command writes these reports:

- `reports/refine-signal-v1.md`: results, gates, and interpretation limits.
- `reports/refine-signal-v1.json`: every session, score summary, and fitted metric.

To run a limited check, use:

```sh
pnpm lab:refine-signal -- --max-viewers 2 --output /tmp/refine-smoke.json
```

The limited check writes a separate report and always returns `smoke_only`.

## Understand the scoring arms

Experiment 2 keeps the current greedy geometry because both experiment 1 candidates failed their frozen quality gates.

All arms receive only descriptive metadata and the current viewer's revealed evidence. Public scores never enter the CLI catalogue.

| Arm | Behavior |
| --- | --- |
| `ratings_only` | Score from 20 ratings and current claims. |
| `stored_noop` | Store comparisons while retaining current scoring. |
| `axis_metric` | Fit 10 positive axis weights from comparisons. |
| `axis_cluster_metric` | Also fit positive multipliers for existing taste groups. |

The candidates rebuild from defaults after each evidence change. Regularisation pulls their weights toward the current model.

The fit requires three comparisons across at least four rated items. It ignores removed items and comparisons outside the same non-neutral rating bucket.

Corrected comparisons replace earlier constraints. The candidate never infers extra pairwise answers from a ranking.

## Compare interaction budgets

The experiment supplies 20 ratings, followed by zero, three, 10, or 20 comparison answers. A separate control receives 30 ratings.

The comparison policy uses stored rating buckets, feature distance, and stable item keys. It never sees hidden preference values before selecting pairs.

The evaluator answers using continuous synthetic utility or the viewer's original MovieLens stars. Ties count as unanswered prompts.

Reports show both answer counts and prompt counts. Equal-answer comparisons include viewers who supply 10 answers in every repeated session.

The JSON also compares at most 10 comparison prompts against 10 additional ratings. Exhausted queues stop before that prompt limit.

## Test control and safety

The CLI reverses the tenth answer through `refine.correct`. The report measures ordering reversal, score direction, and collateral movement among held-out items.

Scoring aliases preserve the rated pair's features while avoiding the normal exclusion of rated titles. They do not change the fitting evidence.

A separate replay reverses 10% of available comparison answers, rounded down. This produces one reversed answer when 10 answers exist.

The report records every comparison's AUC change through the 20-answer checkpoint. It reports the largest loss alongside each viewer's aggregate loss.

Stored claims remain unchanged. The metric fit uses cluster scores, while final recommendations also include claim adjustments.

## Preserve confirmation limits

The 108 recorded viewers appeared in earlier experiments. Treat them as regressions rather than independent confirmation.

The new continuous synthetic fixture reserves 24 viewers for confirmation. Candidate and evaluator fingerprints stay fixed through that replay.

The protocol requires candidates to pass every gate separately on recorded viewers and reserved synthetic viewers. Passing supports independent human confirmation.

Neither candidate changes product defaults. Use the CLI's optional `--refine-metric axis_metric` or `--refine-metric axis_cluster_metric` argument to inspect experimental scoring.

The CLI accepts these arguments only for `suggest list`. Experimental matching does not change `suggest explain`, the desktop app, or stored profiles.

## Run the regressions

To replay the existing synthetic, hard, TMDB, confirmation, and override checks, use:

```sh
pnpm lab:refine-regressions
```

The command writes `reports/refine-regression-v1.json`. It compares saved baseline metrics and complete confirmation and override sessions.

The frozen override runner rejects changed model fingerprints. The regression command uses a temporary compatibility copy that omits only this identity guard.

The original runner and protocol remain unchanged. The result records both fingerprints and labels the compatibility replay.

## Preserve the protocol

The protocol lives at `apps/dossier-cli/benchmarks/refine-signal-v1-protocol.json`. It records fixture hashes, settings, answer budgets, and gates.

The fixture generator is `apps/dossier-cli/scripts/prepare-refine.mjs`. Preserve the existing fixture and protocol after reading results.

For a new hypothesis or threshold, create a new protocol version. Do not relax a failed gate within this experiment.
