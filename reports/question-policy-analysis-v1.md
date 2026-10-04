# Experiment 3 decision

Do not promote either question candidate. Recognition-balanced random selection remains the strongest comparator in this experiment.

The frozen CLI replay contains 270 viewers and 2,700 sessions. It includes 24 new sealed synthetic viewers and two sessions per policy for each viewer.

Both earlier experiments rejected their candidates. Experiment 3 therefore retains current greedy geometry, ratings-only scoring, and normal claim reconciliation.

## Main results

These results compare AUC after 40 prompts. Recorded viewers recognize every training title. Synthetic viewers can skip unfamiliar titles.

| Policy | Recorded AUC | New sealed AUC | Sealed change against random, 95% interval in points |
| --- | --- | --- | --- |
| Current active queue | 57.83% | 69.19% | −10.73 [−16.17, −5.47] |
| Recognition-balanced random | 59.40% | 79.92% | 0.00 [0.00, 0.00] |
| Bootstrap disagreement | 58.46% | 70.56% | −9.36 [−12.62, −6.42] |
| Counterfactual without stopping | 57.97% | 71.28% | −8.64 [−11.94, −5.60] |
| Counterfactual with stopping | 57.49% | 69.05% | −10.87 [−14.47, −7.31] |

The stopping row retains terminal profiles for unreached checkpoints. Only 34 of its 48 sealed sessions reach 40 prompts.

The sealed result also holds at equal answer budgets. Counterfactual selection loses 11.60 points at 40 answers among 22 matched viewers.

Its interval spans −14.80 to −8.63 points. Disagreement loses 11.69 points, with an interval from −14.75 to −8.68.

Recorded differences at 40 prompts remain uncertain. Counterfactual without stopping changes AUC by −1.43 points, with an interval from −3.16 to +0.26.

Disagreement changes recorded AUC by −0.94 points, with an interval from −2.61 to +0.75.

The candidates fail their learning and worst-decile gates independently of their single-answer safety failures.

## Stopping saves prompts by sacrificing learning

On new sealed viewers, stopping saves 27.42% of prompts compared with continued counterfactual questioning.

Mean prompts fall from 74.75 to 54.29. Mean supplied ratings fall from 39.81 to 29.25.

Terminal AUC falls by 4.57 points. Its interval spans −6.88 to −2.39 points, failing the half-point noninferiority gate.

On recorded viewers, stopping saves only 8.52% of prompts. Its terminal AUC interval also fails noninferiority.

Agreement among these bootstrap profiles does not establish that Dossier learned enough about the person.

## What the model learns matters beyond ranking

Post-hoc diagnostics show narrower evidence coverage under all targeted policies. They do not prove why ranking deteriorates.

Among sealed viewers, observed genre entropy after 40 prompts is 2.82 bits for random selection and 1.92 for continued counterfactual selection.

Disagreement reaches 1.92 bits, while the current active queue reaches 1.62. Higher entropy means the supplied evidence covers genres more evenly.

Random selection produces 17.19 active claims on average. Continued counterfactual selection produces 21.92.

High-confidence incorrect claim–item matches rise from 5.02 to 17.17 per viewer. Disagreement produces 17.40.

These counts can include multiple claims about one title. They are not counts of unique false claims or mistaken films.

Claim confidence uses a threshold of 0.8. Positive claims count neutral or negative held-out ratings as errors; negative claims count neutral or positive ratings.

The combination suggests a useful next hypothesis: targeted questioning can produce a narrower, more assertive profile without improving understanding.

For Dossier, more assertions are useful only when the person can trust, inspect, and correct them.

## Predicted question value remains unreliable

On sealed viewers, the continued counterfactual policy's highest-value quartile loses AUC after 41.15% of its answers.

Its lowest-value quartile loses AUC after 26.62%. Average AUC gains are also larger in the lowest-value quartile.

These bins pool answers and provide descriptive diagnostics only. They do not provide independent statistical tests or probability calibration.

The simulated objective measures ranking dispersion among bootstrap profiles. It differs from held-out preference accuracy.

Simulation also holds claims fixed, while actual ratings reconcile claims. Both limitations can affect predicted value.

## Stability remains a separate repair target

Large losses continue after the first 10 ratings. They do not arise only during cold start.

The largest recorded single-answer decline is 36.25 points for the current queue and 31.67 for random selection.

Disagreement still loses 28.34 points in one update. Continued counterfactual selection loses 33.46.

These are worst observed sessions, not typical losses. None of the tested policies satisfies the frozen five-point safety gate.

Question selection alone does not repair the update behavior of the underlying profile.

## Recommendation for the next iteration

Keep both candidate policies behind experiment flags. Preserve the current product defaults until an explicit product decision.

Test coverage-first questioning against recognition-balanced random selection. Measure evidence breadth, held-out claim accuracy, and update stability alongside ranking.

Treat model agreement as a diagnostic. Require observed validation before presenting it as certainty or using it to end calibration automatically.

Evaluate continuity safeguards for profile updates separately. Preserve new dislikes and explicit corrections while testing whether one update moves unrelated recommendations too far.

This direction serves Dossier's broader purpose: a private model of taste that learns honestly and remains under the person's control.

## Validation and limits

Core and CLI tests pass. Repository-wide type checking reports no errors or warnings. Four report audits validate the complete frozen replay.

Default hard, TMDB, confirmation, and override outputs match their saved baselines. The original synthetic replay also completes.

The override regression uses the documented compatibility replay for its historical model fingerprint. Product behavior remains unchanged.

Candidate policies receive descriptive metadata and revealed personal evidence only. Public scores, hidden recognition, and held-out answers never enter question selection.

Recorded cohorts and experiment 2's synthetic viewers provide regressions. The new sealed cohort provides independent synthetic confirmation only.

Recorded training titles all have known ratings, so those viewers cannot establish realistic skip behavior. Context preferences remain outside this experiment.

The protocol, thresholds, and candidate settings remain fixed through confirmation. Post-hoc diagnostics do not alter gates or select another candidate.

## Reproduce and inspect

To reproduce the experiment, run:

```sh
pnpm lab:question-policy
```

To reproduce the default regression suite, run:

```sh
pnpm lab:question-regressions
```

To reproduce the post-hoc diagnostics, run:

```sh
node apps/dossier-cli/scripts/question-policy-diagnostics.mjs
```

Read `reports/question-policy-v1.json` for every prompt and checkpoint. The repository stores a lossless compressed copy as `reports/question-policy-v1.json.gz`. Read `reports/question-policy-v1.md` for complete cohort tables.

Read `reports/question-policy-diagnostics-v1.json` for diagnostics and their source hashes. Read `docs/question-policy-experiment.md` for the protocol and CLI arguments.
