# Test questions that earn their interruption

Use experiment 3 to compare rating-question policies by learning, interruption cost, stability, and respect for personal evidence.

## Review the earlier experiments

Experiment 1 tested deterministic taste geometry. Both candidates removed rating-order dependence, but neither passed the quality and viewer-protection gates.

Experiment 2 tested learned Refine metrics. Neither candidate passed its gain, interaction-efficiency, correction, and safety gates.

Experiment 3 therefore retains the current greedy geometry and ratings-only scorer. It changes question selection alone.

## Run the experiment

To build the CLI and run the frozen protocol, use:

```sh
pnpm lab:question-policy
```

The command writes `reports/question-policy-v1.json` and `reports/question-policy-v1.md`. The JSON records every question and viewer outcome.

The repository stores the complete JSON as `reports/question-policy-v1.json.gz`. Report audits read either form. The CLI recreates the readable JSON.

To run a limited check without replacing the complete report, use:

```sh
pnpm lab:question-policy -- --max-viewers 2 --output /tmp/question-smoke.json
```

Limited runs always return `smoke_only`. Use `--cohort synthetic_development` with a separate output to inspect that cohort alone.

## Compare the policies

Experiment 3 supplies the same descriptive training pool to every policy. Held-out titles never enter question selection.

| Policy | Behavior |
| --- | --- |
| `active` | Use the current active queue. |
| `balanced_random` | Sample randomly, weighted by estimated recognition. |
| `disagreement` | Ask where bootstrap profiles disagree about a rating. |
| `counterfactual` | Estimate uncertainty reduction, penalize disruption, and permit stopping. |
| `counterfactual_no_stop` | Continue the same counterfactual policy to the interaction limit. |

Recognition estimates use only the person's revealed ratings and skips. Public scores and other people's preferences never enter the candidate policies.

The evaluator draws recognition once per title, person, and session. Every policy shares that draw. An unrecognized title produces a skip, never a dislike.

Recorded viewers already rated every training title. Those cohorts cannot establish realistic recognition behavior.

## Understand the counterfactual simulation

The policy bootstraps six rating histories with replacement. Lens neighbours produce a distribution over seven possible rating responses.

For each possible response, the policy reweights the bootstrap profiles. It estimates pair-order disagreement over 24 descriptive training titles.

The policy also appends each hypothetical rating to the actual evidence. It penalizes changes to pair orders that all bootstrap profiles support.

The simulations hold claims fixed. Actual CLI ratings reconcile claims. This approximation can miss changes caused by inferred claims.

The shortlist contains six titles with high rating disagreement. The representative pool uses deterministic farthest-first selection in the existing lens.

The policy can stop after 10 ratings when estimated value reaches the frozen stopping threshold. This value is a model proxy.

## Preserve the evaluation boundaries

Experiment 3 measures AUC and nDCG after five, 10, 20, and 40 answers and prompts. Each session permits at most 120 prompts.

Reports include skip rates, threshold reach rates, claim errors, individual losses, and the largest single-answer decline.

Threshold reach means the first AUC crossing of 0.65. Later ratings can reverse that gain.

Stopped or exhausted sessions retain their terminal profile at later checkpoints. Reports mark these checkpoints as unreached.

Equal-budget comparisons include only viewers whose repeated sessions reach the budget in both compared policies. They require at least 90% viewer coverage.

Candidate gates require positive lower bounds for both equal-budget and all-viewer comparisons. Repeated sessions average within each person before bootstrap uncertainty estimates.

Counterfactual question-quality gates use the no-stop arm. Separate stopping gates require 20% fewer prompts and terminal AUC noninferiority within half a point.

## Preserve the frozen protocol

The protocol is `apps/dossier-cli/benchmarks/question-policy-v1-protocol.json`. It records fixture hashes, candidate settings, interaction limits, and promotion gates.

A new synthetic fixture reserves 24 people for confirmation. Its 48 development people and confirmation people differ from experiment 2.

Recorded viewers, hard-v1, and experiment 2's synthetic viewers provide regressions. They do not provide independent confirmation.

Passing supports independent human confirmation. No experiment flag changes the desktop app or the default CLI queue.

Do not change thresholds after reading outcomes. Create another protocol version for a revised policy.

## Inspect experimental CLI selection

The CLI accepts these optional arguments for `rate.queue`:

| Argument | Type | Default | Constraint | Example |
| --- | --- | --- | --- | --- |
| `questionPolicy` | string | Current queue | `balanced_random`, `disagreement`, or `counterfactual` | `disagreement` |
| `questionSeed` | integer | 11 | Zero through 2147483647 | 29 |
| `questionStop` | boolean | true | Counterfactual policy only | false |

Use `--mode active` when you specify a mode with these arguments. Omit all three arguments to use the current queue.

The experimental response includes recognition, disagreement, predicted value, stability risk, and stopping status. These are experiment diagnostics, not preference probabilities.

## Experiment terminology

| Concept | Approved term | Avoid |
| --- | --- | --- |
| One interruption | prompt | interaction when counting prompts |
| One supplied rating | answer | response when counting answers |
| Unrecognized title | skip | dislike |
| Unrevealed evaluation ratings | held-out answers | candidate evidence |
| Bootstrap ordering dispersion | uncertainty | confidence probability |

## Run the default regressions

To replay default synthetic, hard, TMDB, confirmation, and override behavior, use:

```sh
pnpm lab:question-regressions
```

The command writes `reports/question-policy-regression-v1.json`. It reuses experiment 2's regression runner through a temporary copy.

The override compatibility replay omits its old model-identity guard. It retains fixture guards and compares outcomes with the frozen report.

The runner leaves experiment 2's report unchanged. A successful result reports `passed: true`.
