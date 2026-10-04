# Refine signal: experiment 2

Decision: **do_not_promote**. Neither metric passed every frozen gain, control, efficiency, and safety gate.

The CLI replay contains 198 viewers and 792 sessions. Candidate settings stay fixed through synthetic confirmation.

## What the result means

Neither candidate earns a product change. The experiment rejects these metric fits; it does not establish that comparisons lack useful information.

Axis learning gains +0.14 AUC points on recorded viewers. Its interval spans zero.

Adding group weights changes recorded AUC by -0.13 points. Its interval also spans zero.

The reserved synthetic cohort shows no reliable gain. On reserved synthetic viewers, ten additional ratings beat either comparison candidate on held-out AUC.

Recorded sessions supply a mean of 3.0972 answers after 26.8727 prompts.

The requested ten answers exhaust 362 of 432 recorded queues.

Correction usually moves scores in the requested direction. Strict ordering reversals remain rare, and group weighting moves many unrelated recommendations.

After correction, the requested ordering holds in 28/70 axis tests and 26/70 group-weight tests.

The largest single-comparison losses are -16.06 points for axis learning and -33.64 for group weighting.

For Dossier, a score change alone does not establish user control. A confirmed preference needs an observable effect that the person can inspect.

Keep the candidates behind experiment flags. Test question selection next; retain correction fidelity as a requirement for any future Refine model.

## Experiment 1 review

Both deterministic geometry candidates removed order dependence. Neither passed the frozen quality or viewer-protection gates.

Stable anchors gained 0.42 AUC points, with an interval from −0.02 to +0.86. Strict stable groups gained 0.66 points, from −0.04 to +1.39.

Both reduced the worst-tenth AUC from 44.03% to 42.86%. The CLI reconciled claims against candidate geometry and measured rounded score signatures.

The strict strategy incrementally assigns ratings under a complete-link condition. It does not perform agglomerative complete-link clustering or use medoids.

Experiment 1 retained the default public-score term. Experiment 2 removes public scores before the CLI boundary and sets their scoring weight to zero.

## Recorded viewers

| Arm | AUC | Change, 95% interval (points) | Worst tenth | nDCG10 | Viewer losses | Corrected pairs reversed |
| --- | --- | --- | --- | --- | --- | --- |
| ratings_only | 57.94% | +0.00 [+0.00, +0.00] | 47.35% | 0.4054 | 0/108 | 0/0 |
| stored_noop | 57.94% | +0.00 [+0.00, +0.00] | 47.35% | 0.4054 | 0/108 | 0/0 |
| axis_metric | 58.08% | +0.14 [-0.04, +0.34] | 48.13% | 0.4035 | 30/108 | 4/70 |
| axis_cluster_metric | 57.80% | -0.13 [-0.72, +0.41] | 46.75% | 0.3951 | 34/108 | 17/70 |

All 108 recorded viewers come from previous evaluation cohorts. These results provide regressions rather than independent confirmation.

## Interaction cost and control

The comparison policy requests non-neutral pairs in the same stored rating bucket. It uses lens distance and stable keys before the evaluator answers.

Equal-budget results include viewers with ten answers in every repeated session. Only 4 recorded viewers meet this condition. Treat this subset as exploratory.

Both gain columns compare with 30 ratings and show 95% intervals in points. Rank movement is the mean change in position. Largest losses include every answered comparison through the 20-answer checkpoint.

| Arm | Viewers | AUC gain | nDCG10 gain | Largest loss | Correction direction | Rank movement |
| --- | --- | --- | --- | --- | --- | --- |
| axis_metric | 4 | +3.01 [-7.53, +13.48] | +1.60 [-2.03, +5.55] | -16.06 | 69/70 | 0.8879 |
| axis_cluster_metric | 4 | +2.22 [-4.90, +13.36] | +4.11 [+0.14, +9.97] | -33.64 | 70/70 | 2.7117 |

Corrections reverse the tenth answer through `refine.correct`. Aliases let `suggest.list` score rated items without changing the fitted profile.

A reversal requires the original ordering and corrected ordering to follow their respective choices. Weight changes alone do not pass this gate.

## Compare ten prompts

Ten comparison prompts also show no reliable AUC gain over ten additional ratings on recorded viewers.

| Candidate | AUC gain over 30 ratings, 95% interval (points) |
| --- | --- |
| axis_metric | +0.14 [-0.66, +1.00] |
| axis_cluster_metric | -0.02 [-0.90, +0.91] |

The prompt comparison stops exhausted queues. It never assumes that silence or a tie provides a preference constraint.

## Frozen gates

Candidates must pass every gate on recorded viewers and reserved synthetic viewers separately.

| Arm | Recorded gates not met | Sealed synthetic gates not met |
| --- | --- | --- |
| axis_metric | minimumGain, positiveLowerBound, equalBudget, correction | minimumGain, positiveLowerBound, equalBudget, correction |
| axis_cluster_metric | minimumGain, positiveLowerBound, correction, noisyWorstDecile | minimumGain, positiveLowerBound, worstDecile, equalBudget, correction, noisyWorstDecile |

## original

31 viewers, averaged within each viewer before uncertainty estimates.

| Arm | AUC | Change, 95% interval (points) | Worst tenth | nDCG10 | Viewer losses | Corrected pairs reversed |
| --- | --- | --- | --- | --- | --- | --- |
| ratings_only | 57.48% | +0.00 [+0.00, +0.00] | 47.35% | 0.3506 | 0/31 | 0/0 |
| stored_noop | 57.48% | +0.00 [+0.00, +0.00] | 47.35% | 0.3506 | 0/31 | 0/0 |
| axis_metric | 57.20% | -0.28 [-0.55, -0.03] | 48.20% | 0.3473 | 12/31 | 1/10 |
| axis_cluster_metric | 57.25% | -0.23 [-0.95, +0.49] | 47.86% | 0.3439 | 13/31 | 2/10 |

114/124 sessions cannot supply ten answers. Mean answers: 2.2339. Mean prompts: 19.8548.

## confirmation

47 viewers, averaged within each viewer before uncertainty estimates.

| Arm | AUC | Change, 95% interval (points) | Worst tenth | nDCG10 | Viewer losses | Corrected pairs reversed |
| --- | --- | --- | --- | --- | --- | --- |
| ratings_only | 58.49% | +0.00 [+0.00, +0.00] | 45.30% | 0.4016 | 0/47 | 0/0 |
| stored_noop | 58.49% | +0.00 [+0.00, +0.00] | 45.30% | 0.4016 | 0/47 | 0/0 |
| axis_metric | 58.81% | +0.32 [+0.07, +0.60] | 45.75% | 0.3996 | 11/47 | 1/43 |
| axis_cluster_metric | 58.92% | +0.43 [-0.36, +1.21] | 46.82% | 0.3963 | 12/47 | 11/43 |

145/188 sessions cannot supply ten answers. Mean answers: 3.7074. Mean prompts: 28.7979.

## override

30 viewers, averaged within each viewer before uncertainty estimates.

| Arm | AUC | Change, 95% interval (points) | Worst tenth | nDCG10 | Viewer losses | Corrected pairs reversed |
| --- | --- | --- | --- | --- | --- | --- |
| ratings_only | 57.54% | +0.00 [+0.00, +0.00] | 48.19% | 0.4680 | 0/30 | 0/0 |
| stored_noop | 57.54% | +0.00 [+0.00, +0.00] | 48.19% | 0.4680 | 0/30 | 0/0 |
| axis_metric | 57.84% | +0.30 [-0.10, +0.78] | 48.44% | 0.4678 | 7/30 | 2/17 |
| axis_cluster_metric | 56.62% | -0.92 [-2.33, +0.27] | 46.63% | 0.4463 | 9/30 | 4/17 |

103/120 sessions cannot supply ten answers. Mean answers: 3.0333. Mean prompts: 31.1083.

## hard

18 viewers, averaged within each viewer before uncertainty estimates.

| Arm | AUC | Change, 95% interval (points) | Worst tenth | nDCG10 | Viewer losses | Corrected pairs reversed |
| --- | --- | --- | --- | --- | --- | --- |
| ratings_only | 72.52% | +0.00 [+0.00, +0.00] | 48.76% | 0.4761 | 0/18 | 0/0 |
| stored_noop | 72.52% | +0.00 [+0.00, +0.00] | 48.76% | 0.4761 | 0/18 | 0/0 |
| axis_metric | 72.50% | -0.01 [-0.04, +0.00] | 48.76% | 0.4752 | 1/18 | 0/2 |
| axis_cluster_metric | 72.64% | +0.12 [+0.00, +0.37] | 48.76% | 0.4789 | 0/18 | 1/2 |

70/72 sessions cannot supply ten answers. Mean answers: 0.4722. Mean prompts: 105.0417.

## synthetic development

48 viewers, averaged within each viewer before uncertainty estimates.

| Arm | AUC | Change, 95% interval (points) | Worst tenth | nDCG10 | Viewer losses | Corrected pairs reversed |
| --- | --- | --- | --- | --- | --- | --- |
| ratings_only | 81.51% | +0.00 [+0.00, +0.00] | 69.68% | 0.5576 | 0/48 | 0/0 |
| stored_noop | 81.51% | +0.00 [+0.00, +0.00] | 69.68% | 0.5576 | 0/48 | 0/0 |
| axis_metric | 81.40% | -0.12 [-0.33, +0.10] | 67.32% | 0.5599 | 25/48 | 8/191 |
| axis_cluster_metric | 80.11% | -1.41 [-2.26, -0.55] | 66.22% | 0.5666 | 33/48 | 49/191 |

1/192 sessions cannot supply ten answers. Mean answers: 9.9948. Mean prompts: 9.9948.

## synthetic sealed

24 viewers, averaged within each viewer before uncertainty estimates.

| Arm | AUC | Change, 95% interval (points) | Worst tenth | nDCG10 | Viewer losses | Corrected pairs reversed |
| --- | --- | --- | --- | --- | --- | --- |
| ratings_only | 82.52% | +0.00 [+0.00, +0.00] | 71.45% | 0.5697 | 0/24 | 0/0 |
| stored_noop | 82.52% | +0.00 [+0.00, +0.00] | 71.45% | 0.5697 | 0/24 | 0/0 |
| axis_metric | 82.63% | +0.12 [-0.15, +0.41] | 70.88% | 0.5703 | 10/24 | 2/96 |
| axis_cluster_metric | 81.85% | -0.67 [-2.03, +0.65] | 70.26% | 0.5902 | 11/24 | 35/96 |

0/96 sessions cannot supply ten answers. Mean answers: 10. Mean prompts: 10.

## Interpretation limits

- Recorded cohorts were evaluated before; they are regressions, not independent confirmation.
- Recorded within-bucket stars differ only in extreme rating buckets; ties count as unanswered prompts.
- hard-v1 has quantised truth. Clean within-bucket pairs abstain; noisy-rater comparisons can reveal rating errors.
- New synthetic sealed viewers provide independent synthetic confirmation only.
- Ranking tests do not test retrieval.
- Claims remain unchanged; metric confidence is not a calibrated probability.

The new synthetic catalogue includes hidden craft preferences, descriptor interactions, context preferences, and recognition probability.

This experiment uses solo preferences and already-rated titles. Context and recognition fields support later experiments; they do not affect Refine answers here.

The learned metric changes matching weights and optional cluster confidence multipliers. It preserves the current rating geometry and stored claims.

The fit uses cluster scores for its pairwise loss; claim adjustments still contribute to final rankings. This mismatch can limit control fidelity.

## Reproduce the result

To run the frozen experiment, use:

```sh
pnpm lab:refine-signal
```

The command writes `reports/refine-signal-v1.json` and `reports/refine-signal-v1.md`. The JSON includes every session and fitted metric.

To run a limited check without overwriting the complete report, use:

```sh
pnpm lab:refine-signal -- --max-viewers 2 --output /tmp/refine-smoke.json
```

Limited runs always report `smoke_only`. Fixture hashes, model fingerprints, and evaluator fingerprints record the frozen run.

The Markdown renderer includes editorial corrections after measurement. Its SHA-256 is `0639d00bb9d6842183c17defcfae3ecd0f36c5181d9c86c8b9872a8315741520`.
