# Questions that earn their interruption: experiment 3

Decision: **do_not_promote**. No candidate passed all frozen learning, protection, and stopping gates.

The CLI replay contains 270 viewers and 2700 sessions. Every arm uses the current greedy geometry and ratings-only scorer.

## Review experiments 1 and 2

Experiment 1 removed order dependence with two deterministic grouping candidates. Neither candidate passed the quality and viewer-protection gates.

Experiment 2 found no reliable comparison gain. Recorded viewers supplied about three answers after 27 prompts. Neither learned metric passed the control gates.

Experiment 3 therefore changes question selection alone. Public scores, hidden recognition, and held-out answers never enter selection.

## Compare policies

| Arm | Behavior |
| --- | --- |
| active | Current active queue with public fields removed. |
| balanced_random | Random sampling weighted by recognition estimated from revealed ratings and skips. |
| disagreement | Ask where bootstrap profiles disagree about the next rating. Weight selection by estimated recognition. |
| counterfactual | Simulate seven answers, estimate ranking uncertainty reduction, penalize established-order flips, and permit stopping. |
| counterfactual_no_stop | Use the same counterfactual policy and continue to the interaction limit. |

## Read the frozen gates

Candidates must beat balanced random at 20 and 40 answers and prompts. Both viewer-bootstrap lower bounds must exceed zero.

Each candidate must preserve worst-decile AUC and limit every single-answer loss to five points.

Counterfactual question-quality gates use its no-stop arm. Stopping requires at least 20% fewer prompts and terminal AUC noninferiority within half a point.

Recorded viewers and new sealed synthetic viewers must pass separately. Matched-budget comparisons require at least 90% viewer coverage.

| Candidate | Recorded gates not met | New sealed gates not met |
| --- | --- | --- |
| disagreement | byAnswer20Gain, byAnswer20WorstDecile, byAnswer40Gain, byAnswer40WorstDecile, byPrompt20Gain, byPrompt20WorstDecile, byPrompt40Gain, byPrompt40WorstDecile, singleAnswerSafety | byAnswer20Gain, byAnswer20WorstDecile, byAnswer40Gain, byAnswer40WorstDecile, byPrompt20Gain, byPrompt20WorstDecile, byPrompt40Gain, byPrompt40WorstDecile, singleAnswerSafety |
| counterfactual | byAnswer20Gain, byAnswer20WorstDecile, byAnswer40Gain, byAnswer40WorstDecile, byPrompt20Gain, byPrompt20WorstDecile, byPrompt40Gain, byPrompt40WorstDecile, singleAnswerSafety, stopSavesPrompts, stopPreservesAuc | byAnswer20Gain, byAnswer20WorstDecile, byAnswer40Gain, byAnswer40WorstDecile, byPrompt20Gain, byPrompt20WorstDecile, byPrompt40Gain, byPrompt40WorstDecile, singleAnswerSafety, stopPreservesAuc |

## recorded

108 viewers. Repeated sessions average within each viewer before uncertainty estimates.

| Budget | Policy | AUC | Gain over random, 95% interval (points) | Worst tenth | Reached sessions | Matched viewers |
| --- | --- | --- | --- | --- | --- | --- |
| 20 answers | active | 56.00% | -1.84 [-4.48, +0.69] | 38.44% | 216/216 | 108 |
| 20 answers | balanced_random | 57.85% | +0.00 [+0.00, +0.00] | 45.73% | 216/216 | 108 |
| 20 answers | disagreement | 55.39% | -2.46 [-4.02, -0.94] | 39.23% | 216/216 | 108 |
| 20 answers | counterfactual | 55.85% | -2.00 [-3.65, -0.33] | 41.85% | 195/216 | 90 |
| 20 answers | counterfactual_no_stop | 56.05% | -1.80 [-3.39, -0.19] | 41.46% | 216/216 | 108 |
| 40 answers | active | 57.83% | -1.57 [-4.03, +0.78] | 38.60% | 216/216 | 108 |
| 40 answers | balanced_random | 59.40% | +0.00 [+0.00, +0.00] | 46.88% | 216/216 | 108 |
| 40 answers | disagreement | 58.46% | -0.94 [-2.61, +0.75] | 43.27% | 216/216 | 108 |
| 40 answers | counterfactual | 57.49% | -1.91 [-3.76, +0.00] | 43.21% | 182/216 | 78 |
| 40 answers | counterfactual_no_stop | 57.97% | -1.43 [-3.16, +0.26] | 43.43% | 216/216 | 108 |
| 20 prompts | active | 56.00% | -1.84 [-4.48, +0.69] | 38.44% | 216/216 | 108 |
| 20 prompts | balanced_random | 57.85% | +0.00 [+0.00, +0.00] | 45.73% | 216/216 | 108 |
| 20 prompts | disagreement | 55.39% | -2.46 [-4.02, -0.94] | 39.23% | 216/216 | 108 |
| 20 prompts | counterfactual | 55.85% | -2.00 [-3.65, -0.33] | 41.85% | 195/216 | 90 |
| 20 prompts | counterfactual_no_stop | 56.05% | -1.80 [-3.39, -0.19] | 41.46% | 216/216 | 108 |
| 40 prompts | active | 57.83% | -1.57 [-4.03, +0.78] | 38.60% | 216/216 | 108 |
| 40 prompts | balanced_random | 59.40% | +0.00 [+0.00, +0.00] | 46.88% | 216/216 | 108 |
| 40 prompts | disagreement | 58.46% | -0.94 [-2.61, +0.75] | 43.27% | 216/216 | 108 |
| 40 prompts | counterfactual | 57.49% | -1.91 [-3.76, +0.00] | 43.21% | 182/216 | 78 |
| 40 prompts | counterfactual_no_stop | 57.97% | -1.43 [-3.16, +0.26] | 43.43% | 216/216 | 108 |

Unreached checkpoints carry the terminal profile for the intention-to-prompt summary. Matched-budget gates require at least 90% viewer coverage and positive lower bounds for both matched and all-viewer comparisons.

| Policy | Mean prompts | Mean answers | Skip rate | Stopped | Largest answer loss (points) |
| --- | --- | --- | --- | --- | --- |
| active | 40.00 | 40.00 | 0.00% | 0 | -36.25 |
| balanced_random | 40.00 | 40.00 | 0.00% | 0 | -38.38 |
| disagreement | 40.00 | 40.00 | 0.00% | 0 | -38.38 |
| counterfactual | 36.59 | 36.59 | 0.00% | 34 | -38.38 |
| counterfactual_no_stop | 40.00 | 40.00 | 0.00% | 0 | -38.38 |

Stopping saves 8.52% of prompts. Terminal AUC changes by -0.48 [-1.29, +0.27] points against continued questioning.

## original

31 viewers. Repeated sessions average within each viewer before uncertainty estimates.

| Budget | Policy | AUC | Gain over random, 95% interval (points) | Worst tenth | Reached sessions | Matched viewers |
| --- | --- | --- | --- | --- | --- | --- |
| 20 answers | active | 56.37% | -2.35 [-7.76, +2.13] | 42.17% | 62/62 | 31 |
| 20 answers | balanced_random | 58.72% | +0.00 [+0.00, +0.00] | 48.72% | 62/62 | 31 |
| 20 answers | disagreement | 55.01% | -3.71 [-5.98, -1.45] | 42.09% | 62/62 | 31 |
| 20 answers | counterfactual | 56.90% | -1.82 [-4.31, +0.63] | 44.88% | 58/62 | 28 |
| 20 answers | counterfactual_no_stop | 56.77% | -1.95 [-4.51, +0.52] | 44.32% | 62/62 | 31 |
| 40 answers | active | 57.15% | -3.19 [-8.63, +1.50] | 36.79% | 62/62 | 31 |
| 40 answers | balanced_random | 60.34% | +0.00 [+0.00, +0.00] | 47.35% | 62/62 | 31 |
| 40 answers | disagreement | 58.06% | -2.28 [-5.31, +0.77] | 45.32% | 62/62 | 31 |
| 40 answers | counterfactual | 58.14% | -2.20 [-4.92, +0.68] | 43.43% | 56/62 | 26 |
| 40 answers | counterfactual_no_stop | 57.69% | -2.65 [-5.39, +0.21] | 43.43% | 62/62 | 31 |
| 20 prompts | active | 56.37% | -2.35 [-7.76, +2.13] | 42.17% | 62/62 | 31 |
| 20 prompts | balanced_random | 58.72% | +0.00 [+0.00, +0.00] | 48.72% | 62/62 | 31 |
| 20 prompts | disagreement | 55.01% | -3.71 [-5.98, -1.45] | 42.09% | 62/62 | 31 |
| 20 prompts | counterfactual | 56.90% | -1.82 [-4.31, +0.63] | 44.88% | 58/62 | 28 |
| 20 prompts | counterfactual_no_stop | 56.77% | -1.95 [-4.51, +0.52] | 44.32% | 62/62 | 31 |
| 40 prompts | active | 57.15% | -3.19 [-8.63, +1.50] | 36.79% | 62/62 | 31 |
| 40 prompts | balanced_random | 60.34% | +0.00 [+0.00, +0.00] | 47.35% | 62/62 | 31 |
| 40 prompts | disagreement | 58.06% | -2.28 [-5.31, +0.77] | 45.32% | 62/62 | 31 |
| 40 prompts | counterfactual | 58.14% | -2.20 [-4.92, +0.68] | 43.43% | 56/62 | 26 |
| 40 prompts | counterfactual_no_stop | 57.69% | -2.65 [-5.39, +0.21] | 43.43% | 62/62 | 31 |

Unreached checkpoints carry the terminal profile for the intention-to-prompt summary. Matched-budget gates require at least 90% viewer coverage and positive lower bounds for both matched and all-viewer comparisons.

| Policy | Mean prompts | Mean answers | Skip rate | Stopped | Largest answer loss (points) |
| --- | --- | --- | --- | --- | --- |
| active | 40.00 | 40.00 | 0.00% | 0 | -31.25 |
| balanced_random | 40.00 | 40.00 | 0.00% | 0 | -33.39 |
| disagreement | 40.00 | 40.00 | 0.00% | 0 | -33.39 |
| counterfactual | 37.92 | 37.92 | 0.00% | 6 | -33.39 |
| counterfactual_no_stop | 40.00 | 40.00 | 0.00% | 0 | -33.39 |

Stopping saves 5.20% of prompts. Terminal AUC changes by +0.45 [+0.03, +1.14] points against continued questioning.

## confirmation

47 viewers. Repeated sessions average within each viewer before uncertainty estimates.

| Budget | Policy | AUC | Gain over random, 95% interval (points) | Worst tenth | Reached sessions | Matched viewers |
| --- | --- | --- | --- | --- | --- | --- |
| 20 answers | active | 55.98% | -2.51 [-6.03, +1.03] | 38.44% | 94/94 | 47 |
| 20 answers | balanced_random | 58.49% | +0.00 [+0.00, +0.00] | 45.59% | 94/94 | 47 |
| 20 answers | disagreement | 56.60% | -1.88 [-4.37, +0.42] | 41.46% | 94/94 | 47 |
| 20 answers | counterfactual | 55.66% | -2.83 [-5.66, -0.03] | 41.46% | 80/94 | 35 |
| 20 answers | counterfactual_no_stop | 56.28% | -2.21 [-4.94, +0.51] | 41.46% | 94/94 | 47 |
| 40 answers | active | 59.55% | -0.95 [-4.25, +2.35] | 41.42% | 94/94 | 47 |
| 40 answers | balanced_random | 60.50% | +0.00 [+0.00, +0.00] | 48.93% | 94/94 | 47 |
| 40 answers | disagreement | 59.71% | -0.78 [-3.49, +2.05] | 43.69% | 94/94 | 47 |
| 40 answers | counterfactual | 58.24% | -2.25 [-5.56, +1.04] | 42.17% | 73/94 | 29 |
| 40 answers | counterfactual_no_stop | 59.39% | -1.10 [-4.11, +1.77] | 39.38% | 94/94 | 47 |
| 20 prompts | active | 55.98% | -2.51 [-6.03, +1.03] | 38.44% | 94/94 | 47 |
| 20 prompts | balanced_random | 58.49% | +0.00 [+0.00, +0.00] | 45.59% | 94/94 | 47 |
| 20 prompts | disagreement | 56.60% | -1.88 [-4.37, +0.42] | 41.46% | 94/94 | 47 |
| 20 prompts | counterfactual | 55.66% | -2.83 [-5.66, -0.03] | 41.46% | 80/94 | 35 |
| 20 prompts | counterfactual_no_stop | 56.28% | -2.21 [-4.94, +0.51] | 41.46% | 94/94 | 47 |
| 40 prompts | active | 59.55% | -0.95 [-4.25, +2.35] | 41.42% | 94/94 | 47 |
| 40 prompts | balanced_random | 60.50% | +0.00 [+0.00, +0.00] | 48.93% | 94/94 | 47 |
| 40 prompts | disagreement | 59.71% | -0.78 [-3.49, +2.05] | 43.69% | 94/94 | 47 |
| 40 prompts | counterfactual | 58.24% | -2.25 [-5.56, +1.04] | 42.17% | 73/94 | 29 |
| 40 prompts | counterfactual_no_stop | 59.39% | -1.10 [-4.11, +1.77] | 39.38% | 94/94 | 47 |

Unreached checkpoints carry the terminal profile for the intention-to-prompt summary. Matched-budget gates require at least 90% viewer coverage and positive lower bounds for both matched and all-viewer comparisons.

| Policy | Mean prompts | Mean answers | Skip rate | Stopped | Largest answer loss (points) |
| --- | --- | --- | --- | --- | --- |
| active | 40.00 | 40.00 | 0.00% | 0 | -27.59 |
| balanced_random | 40.00 | 40.00 | 0.00% | 0 | -38.38 |
| disagreement | 40.00 | 40.00 | 0.00% | 0 | -38.38 |
| counterfactual | 34.98 | 34.98 | 0.00% | 21 | -38.38 |
| counterfactual_no_stop | 40.00 | 40.00 | 0.00% | 0 | -38.38 |

Stopping saves 12.55% of prompts. Terminal AUC changes by -1.15 [-2.80, +0.41] points against continued questioning.

## override

30 viewers. Repeated sessions average within each viewer before uncertainty estimates.

| Budget | Policy | AUC | Gain over random, 95% interval (points) | Worst tenth | Reached sessions | Matched viewers |
| --- | --- | --- | --- | --- | --- | --- |
| 20 answers | active | 55.66% | -0.28 [-5.79, +5.27] | 31.82% | 60/60 | 30 |
| 20 answers | balanced_random | 55.95% | +0.00 [+0.00, +0.00] | 40.63% | 60/60 | 30 |
| 20 answers | disagreement | 53.87% | -2.08 [-5.33, +1.21] | 34.63% | 60/60 | 30 |
| 20 answers | counterfactual | 55.05% | -0.89 [-3.96, +2.13] | 39.06% | 57/60 | 27 |
| 20 answers | counterfactual_no_stop | 54.95% | -1.00 [-4.06, +1.99] | 39.21% | 60/60 | 30 |
| 40 answers | active | 55.84% | -0.87 [-5.44, +3.79] | 38.60% | 60/60 | 30 |
| 40 answers | balanced_random | 56.72% | +0.00 [+0.00, +0.00] | 43.75% | 60/60 | 30 |
| 40 answers | disagreement | 56.89% | +0.18 [-2.47, +3.01] | 38.40% | 60/60 | 30 |
| 40 answers | counterfactual | 55.64% | -1.08 [-4.18, +1.83] | 41.02% | 53/60 | 23 |
| 40 answers | counterfactual_no_stop | 56.02% | -0.69 [-3.41, +1.80] | 43.96% | 60/60 | 30 |
| 20 prompts | active | 55.66% | -0.28 [-5.79, +5.27] | 31.82% | 60/60 | 30 |
| 20 prompts | balanced_random | 55.95% | +0.00 [+0.00, +0.00] | 40.63% | 60/60 | 30 |
| 20 prompts | disagreement | 53.87% | -2.08 [-5.33, +1.21] | 34.63% | 60/60 | 30 |
| 20 prompts | counterfactual | 55.05% | -0.89 [-3.96, +2.13] | 39.06% | 57/60 | 27 |
| 20 prompts | counterfactual_no_stop | 54.95% | -1.00 [-4.06, +1.99] | 39.21% | 60/60 | 30 |
| 40 prompts | active | 55.84% | -0.87 [-5.44, +3.79] | 38.60% | 60/60 | 30 |
| 40 prompts | balanced_random | 56.72% | +0.00 [+0.00, +0.00] | 43.75% | 60/60 | 30 |
| 40 prompts | disagreement | 56.89% | +0.18 [-2.47, +3.01] | 38.40% | 60/60 | 30 |
| 40 prompts | counterfactual | 55.64% | -1.08 [-4.18, +1.83] | 41.02% | 53/60 | 23 |
| 40 prompts | counterfactual_no_stop | 56.02% | -0.69 [-3.41, +1.80] | 43.96% | 60/60 | 30 |

Unreached checkpoints carry the terminal profile for the intention-to-prompt summary. Matched-budget gates require at least 90% viewer coverage and positive lower bounds for both matched and all-viewer comparisons.

| Policy | Mean prompts | Mean answers | Skip rate | Stopped | Largest answer loss (points) |
| --- | --- | --- | --- | --- | --- |
| active | 40.00 | 40.00 | 0.00% | 0 | -36.25 |
| balanced_random | 40.00 | 40.00 | 0.00% | 0 | -31.67 |
| disagreement | 40.00 | 40.00 | 0.00% | 0 | -28.75 |
| counterfactual | 37.75 | 37.75 | 0.00% | 7 | -33.22 |
| counterfactual_no_stop | 40.00 | 40.00 | 0.00% | 0 | -33.22 |

Stopping saves 5.63% of prompts. Terminal AUC changes by -0.38 [-1.47, +0.51] points against continued questioning.

## hard

18 viewers. Repeated sessions average within each viewer before uncertainty estimates.

| Budget | Policy | AUC | Gain over random, 95% interval (points) | Worst tenth | Reached sessions | Matched viewers |
| --- | --- | --- | --- | --- | --- | --- |
| 20 answers | active | 69.22% | -0.78 [-8.19, +6.65] | 49.07% | 36/36 | 18 |
| 20 answers | balanced_random | 70.00% | +0.00 [+0.00, +0.00] | 44.25% | 36/36 | 18 |
| 20 answers | disagreement | 68.79% | -1.20 [-9.42, +6.20] | 49.26% | 36/36 | 18 |
| 20 answers | counterfactual | 63.77% | -6.23 [-14.61, +1.62] | 48.69% | 15/36 | 6 |
| 20 answers | counterfactual_no_stop | 69.13% | -0.87 [-7.51, +5.80] | 48.69% | 36/36 | 18 |
| 40 answers | active | 74.62% | -4.11 [-11.59, +2.96] | 45.02% | 36/36 | 18 |
| 40 answers | balanced_random | 78.72% | +0.00 [+0.00, +0.00] | 45.95% | 36/36 | 18 |
| 40 answers | disagreement | 76.09% | -2.64 [-9.74, +3.48] | 49.47% | 36/36 | 18 |
| 40 answers | counterfactual | 64.55% | -14.17 [-24.10, -4.65] | 48.97% | 9/36 | 4 |
| 40 answers | counterfactual_no_stop | 75.87% | -2.86 [-8.76, +2.86] | 49.60% | 36/36 | 18 |
| 20 prompts | active | 68.21% | +3.84 [-4.16, +12.09] | 44.77% | 36/36 | 18 |
| 20 prompts | balanced_random | 64.38% | +0.00 [+0.00, +0.00] | 47.07% | 36/36 | 18 |
| 20 prompts | disagreement | 65.61% | +1.23 [-7.64, +9.06] | 50.00% | 36/36 | 18 |
| 20 prompts | counterfactual | 62.43% | -1.94 [-10.42, +5.75] | 48.14% | 20/36 | 8 |
| 20 prompts | counterfactual_no_stop | 64.42% | +0.05 [-9.40, +8.81] | 48.14% | 36/36 | 18 |
| 40 prompts | active | 70.92% | -3.18 [-10.57, +4.30] | 46.24% | 36/36 | 18 |
| 40 prompts | balanced_random | 74.10% | +0.00 [+0.00, +0.00] | 44.77% | 36/36 | 18 |
| 40 prompts | disagreement | 68.19% | -5.91 [-14.65, +2.67] | 47.49% | 36/36 | 18 |
| 40 prompts | counterfactual | 64.07% | -10.02 [-19.86, -0.25] | 50.00% | 11/36 | 5 |
| 40 prompts | counterfactual_no_stop | 72.76% | -1.34 [-8.12, +5.81] | 50.91% | 36/36 | 18 |

Unreached checkpoints carry the terminal profile for the intention-to-prompt summary. Matched-budget gates require at least 90% viewer coverage and positive lower bounds for both matched and all-viewer comparisons.

| Policy | Mean prompts | Mean answers | Skip rate | Stopped | Largest answer loss (points) |
| --- | --- | --- | --- | --- | --- |
| active | 61.64 | 40.00 | 34.59% | 0 | -23.82 |
| balanced_random | 61.58 | 40.00 | 34.51% | 0 | -46.72 |
| disagreement | 60.58 | 40.00 | 33.44% | 0 | -46.72 |
| counterfactual | 32.11 | 21.06 | 33.05% | 27 | -46.72 |
| counterfactual_no_stop | 60.72 | 40.00 | 33.69% | 0 | -46.72 |

Stopping saves 47.50% of prompts. Terminal AUC changes by -11.32 [-19.08, -4.89] points against continued questioning.

## refine_regression_development

48 viewers. Repeated sessions average within each viewer before uncertainty estimates.

| Budget | Policy | AUC | Gain over random, 95% interval (points) | Worst tenth | Reached sessions | Matched viewers |
| --- | --- | --- | --- | --- | --- | --- |
| 20 answers | active | 67.77% | -11.92 [-15.25, -8.69] | 49.75% | 96/96 | 48 |
| 20 answers | balanced_random | 79.69% | +0.00 [+0.00, +0.00] | 63.25% | 96/96 | 48 |
| 20 answers | disagreement | 70.76% | -8.92 [-11.26, -6.59] | 55.69% | 96/96 | 48 |
| 20 answers | counterfactual | 70.12% | -9.57 [-12.02, -7.07] | 55.68% | 75/96 | 30 |
| 20 answers | counterfactual_no_stop | 71.38% | -8.31 [-10.43, -6.15] | 57.39% | 96/96 | 48 |
| 40 answers | active | 70.75% | -15.64 [-19.28, -12.10] | 54.08% | 96/96 | 48 |
| 40 answers | balanced_random | 86.39% | +0.00 [+0.00, +0.00] | 76.67% | 96/96 | 48 |
| 40 answers | disagreement | 73.96% | -12.44 [-14.74, -10.17] | 59.78% | 96/96 | 48 |
| 40 answers | counterfactual | 71.14% | -15.25 [-18.09, -12.54] | 56.67% | 47/96 | 12 |
| 40 answers | counterfactual_no_stop | 74.16% | -12.23 [-14.39, -10.00] | 59.54% | 96/96 | 48 |
| 20 prompts | active | 66.45% | -10.01 [-13.74, -6.37] | 48.61% | 96/96 | 48 |
| 20 prompts | balanced_random | 76.46% | +0.00 [+0.00, +0.00] | 61.82% | 96/96 | 48 |
| 20 prompts | disagreement | 70.19% | -6.26 [-8.38, -4.19] | 54.87% | 96/96 | 48 |
| 20 prompts | counterfactual | 69.18% | -7.28 [-9.54, -5.10] | 55.31% | 82/96 | 35 |
| 20 prompts | counterfactual_no_stop | 69.56% | -6.90 [-9.07, -4.77] | 55.31% | 96/96 | 48 |
| 40 prompts | active | 67.62% | -15.32 [-19.35, -11.49] | 49.20% | 96/96 | 48 |
| 40 prompts | balanced_random | 82.94% | +0.00 [+0.00, +0.00] | 67.35% | 96/96 | 48 |
| 40 prompts | disagreement | 72.06% | -10.88 [-13.26, -8.38] | 58.08% | 96/96 | 48 |
| 40 prompts | counterfactual | 70.63% | -12.31 [-15.03, -9.55] | 57.17% | 61/96 | 19 |
| 40 prompts | counterfactual_no_stop | 72.15% | -10.79 [-13.14, -8.24] | 59.76% | 96/96 | 48 |

Unreached checkpoints carry the terminal profile for the intention-to-prompt summary. Matched-budget gates require at least 90% viewer coverage and positive lower bounds for both matched and all-viewer comparisons.

| Policy | Mean prompts | Mean answers | Skip rate | Stopped | Largest answer loss (points) |
| --- | --- | --- | --- | --- | --- |
| active | 61.03 | 40.00 | 33.89% | 0 | -34.30 |
| balanced_random | 60.34 | 40.00 | 33.23% | 0 | -35.94 |
| disagreement | 61.63 | 40.00 | 34.57% | 0 | -35.94 |
| counterfactual | 46.28 | 30.09 | 34.04% | 49 | -35.94 |
| counterfactual_no_stop | 61.75 | 40.00 | 34.76% | 0 | -35.94 |

Stopping saves 24.91% of prompts. Terminal AUC changes by -3.02 [-5.09, -1.09] points against continued questioning.

## refine_regression_sealed

24 viewers. Repeated sessions average within each viewer before uncertainty estimates.

| Budget | Policy | AUC | Gain over random, 95% interval (points) | Worst tenth | Reached sessions | Matched viewers |
| --- | --- | --- | --- | --- | --- | --- |
| 20 answers | active | 69.81% | -12.45 [-17.70, -7.44] | 50.00% | 48/48 | 24 |
| 20 answers | balanced_random | 82.27% | +0.00 [+0.00, +0.00] | 69.48% | 48/48 | 24 |
| 20 answers | disagreement | 71.82% | -10.45 [-14.06, -7.25] | 57.47% | 48/48 | 24 |
| 20 answers | counterfactual | 67.55% | -14.72 [-19.11, -10.80] | 53.10% | 34/48 | 14 |
| 20 answers | counterfactual_no_stop | 70.24% | -12.03 [-15.18, -9.19] | 58.16% | 48/48 | 24 |
| 40 answers | active | 74.61% | -14.05 [-19.00, -9.10] | 54.03% | 48/48 | 24 |
| 40 answers | balanced_random | 88.66% | +0.00 [+0.00, +0.00] | 79.06% | 48/48 | 24 |
| 40 answers | disagreement | 76.27% | -12.39 [-16.27, -8.57] | 60.89% | 48/48 | 24 |
| 40 answers | counterfactual | 70.86% | -17.80 [-22.71, -12.99] | 55.69% | 24/48 | 7 |
| 40 answers | counterfactual_no_stop | 73.84% | -14.82 [-18.91, -10.90] | 60.21% | 48/48 | 24 |
| 20 prompts | active | 68.09% | -7.73 [-14.02, -0.84] | 50.00% | 48/48 | 24 |
| 20 prompts | balanced_random | 75.82% | +0.00 [+0.00, +0.00] | 55.85% | 48/48 | 24 |
| 20 prompts | disagreement | 68.81% | -7.01 [-11.23, -2.65] | 53.77% | 48/48 | 24 |
| 20 prompts | counterfactual | 66.41% | -9.41 [-13.93, -4.81] | 51.36% | 38/48 | 16 |
| 20 prompts | counterfactual_no_stop | 67.12% | -8.69 [-13.13, -4.19] | 51.36% | 48/48 | 24 |
| 40 prompts | active | 70.56% | -15.81 [-21.48, -10.63] | 50.21% | 48/48 | 24 |
| 40 prompts | balanced_random | 86.36% | +0.00 [+0.00, +0.00] | 76.87% | 48/48 | 24 |
| 40 prompts | disagreement | 73.00% | -13.36 [-17.53, -9.51] | 59.03% | 48/48 | 24 |
| 40 prompts | counterfactual | 68.09% | -18.28 [-22.75, -13.92] | 53.64% | 28/48 | 10 |
| 40 prompts | counterfactual_no_stop | 70.06% | -16.31 [-20.21, -12.62] | 57.48% | 48/48 | 24 |

Unreached checkpoints carry the terminal profile for the intention-to-prompt summary. Matched-budget gates require at least 90% viewer coverage and positive lower bounds for both matched and all-viewer comparisons.

| Policy | Mean prompts | Mean answers | Skip rate | Stopped | Largest answer loss (points) |
| --- | --- | --- | --- | --- | --- |
| active | 60.63 | 40.00 | 33.23% | 0 | -25.52 |
| balanced_random | 61.19 | 40.00 | 34.21% | 0 | -27.25 |
| disagreement | 61.56 | 40.00 | 34.53% | 0 | -25.52 |
| counterfactual | 45.44 | 29.08 | 35.50% | 24 | -25.52 |
| counterfactual_no_stop | 61.73 | 40.00 | 34.83% | 0 | -25.52 |

Stopping saves 26.43% of prompts. Terminal AUC changes by -2.98 [-5.53, -0.62] points against continued questioning.

## synthetic_development

48 viewers. Repeated sessions average within each viewer before uncertainty estimates.

| Budget | Policy | AUC | Gain over random, 95% interval (points) | Worst tenth | Reached sessions | Matched viewers |
| --- | --- | --- | --- | --- | --- | --- |
| 20 answers | active | 69.40% | -13.19 [-16.25, -10.29] | 51.59% | 96/96 | 48 |
| 20 answers | balanced_random | 82.58% | +0.00 [+0.00, +0.00] | 69.31% | 96/96 | 48 |
| 20 answers | disagreement | 72.58% | -10.00 [-12.66, -7.56] | 58.44% | 96/96 | 48 |
| 20 answers | counterfactual | 71.78% | -10.80 [-13.49, -8.35] | 60.60% | 67/96 | 23 |
| 20 answers | counterfactual_no_stop | 72.50% | -10.09 [-12.73, -7.63] | 60.21% | 96/96 | 48 |
| 40 answers | active | 74.94% | -12.64 [-15.41, -10.12] | 55.41% | 94/96 | 46 |
| 40 answers | balanced_random | 87.58% | +0.00 [+0.00, +0.00] | 75.35% | 95/96 | 47 |
| 40 answers | disagreement | 77.19% | -10.39 [-12.57, -8.28] | 67.12% | 96/96 | 47 |
| 40 answers | counterfactual | 73.73% | -13.85 [-16.89, -11.15] | 59.98% | 50/96 | 15 |
| 40 answers | counterfactual_no_stop | 76.63% | -10.95 [-13.28, -8.79] | 61.61% | 96/96 | 47 |
| 20 prompts | active | 65.48% | -10.72 [-13.80, -7.57] | 48.69% | 96/96 | 48 |
| 20 prompts | balanced_random | 76.20% | +0.00 [+0.00, +0.00] | 62.11% | 96/96 | 48 |
| 20 prompts | disagreement | 69.57% | -6.63 [-9.20, -4.07] | 56.13% | 96/96 | 48 |
| 20 prompts | counterfactual | 68.97% | -7.22 [-9.94, -4.58] | 55.38% | 90/96 | 42 |
| 20 prompts | counterfactual_no_stop | 68.98% | -7.21 [-9.93, -4.58] | 55.38% | 96/96 | 48 |
| 40 prompts | active | 69.41% | -13.22 [-15.96, -10.51] | 54.07% | 96/96 | 48 |
| 40 prompts | balanced_random | 82.63% | +0.00 [+0.00, +0.00] | 72.25% | 96/96 | 48 |
| 40 prompts | disagreement | 73.64% | -9.00 [-11.55, -6.72] | 61.69% | 96/96 | 48 |
| 40 prompts | counterfactual | 72.28% | -10.36 [-13.16, -7.77] | 59.76% | 65/96 | 22 |
| 40 prompts | counterfactual_no_stop | 73.05% | -9.58 [-12.29, -7.13] | 59.76% | 96/96 | 48 |

Unreached checkpoints carry the terminal profile for the intention-to-prompt summary. Matched-budget gates require at least 90% viewer coverage and positive lower bounds for both matched and all-viewer comparisons.

| Policy | Mean prompts | Mean answers | Skip rate | Stopped | Largest answer loss (points) |
| --- | --- | --- | --- | --- | --- |
| active | 79.01 | 39.97 | 47.17% | 0 | -30.01 |
| balanced_random | 77.03 | 39.98 | 46.64% | 0 | -32.00 |
| disagreement | 71.65 | 40.00 | 42.58% | 0 | -32.00 |
| counterfactual | 54.18 | 30.28 | 43.36% | 46 | -32.00 |
| counterfactual_no_stop | 71.09 | 40.00 | 42.22% | 0 | -32.00 |

Stopping saves 23.90% of prompts. Terminal AUC changes by -2.90 [-4.61, -1.41] points against continued questioning.

## synthetic_sealed

24 viewers. Repeated sessions average within each viewer before uncertainty estimates.

| Budget | Policy | AUC | Gain over random, 95% interval (points) | Worst tenth | Reached sessions | Matched viewers |
| --- | --- | --- | --- | --- | --- | --- |
| 20 answers | active | 68.04% | -10.65 [-16.99, -4.77] | 43.76% | 48/48 | 24 |
| 20 answers | balanced_random | 78.69% | +0.00 [+0.00, +0.00] | 62.07% | 48/48 | 24 |
| 20 answers | disagreement | 71.39% | -7.30 [-10.57, -4.07] | 60.93% | 48/48 | 24 |
| 20 answers | counterfactual | 68.34% | -10.34 [-14.21, -6.51] | 56.65% | 37/48 | 15 |
| 20 answers | counterfactual_no_stop | 70.33% | -8.35 [-11.95, -4.63] | 59.12% | 48/48 | 24 |
| 40 answers | active | 74.18% | -11.48 [-16.04, -6.93] | 53.74% | 46/48 | 22 |
| 40 answers | balanced_random | 85.66% | +0.00 [+0.00, +0.00] | 79.19% | 46/48 | 22 |
| 40 answers | disagreement | 74.33% | -11.33 [-14.18, -8.44] | 64.82% | 47/48 | 22 |
| 40 answers | counterfactual | 69.97% | -15.69 [-19.68, -11.80] | 58.54% | 20/48 | 2 |
| 40 answers | counterfactual_no_stop | 74.54% | -11.12 [-14.10, -8.32] | 63.97% | 47/48 | 22 |
| 20 prompts | active | 63.75% | -10.78 [-17.39, -4.28] | 40.12% | 48/48 | 24 |
| 20 prompts | balanced_random | 74.53% | +0.00 [+0.00, +0.00] | 61.57% | 48/48 | 24 |
| 20 prompts | disagreement | 67.48% | -7.05 [-9.69, -4.47] | 56.29% | 48/48 | 24 |
| 20 prompts | counterfactual | 66.77% | -7.76 [-10.87, -4.72] | 53.96% | 46/48 | 22 |
| 20 prompts | counterfactual_no_stop | 66.92% | -7.61 [-10.64, -4.64] | 53.96% | 48/48 | 24 |
| 40 prompts | active | 69.19% | -10.73 [-16.17, -5.47] | 45.56% | 48/48 | 24 |
| 40 prompts | balanced_random | 79.92% | +0.00 [+0.00, +0.00] | 64.01% | 48/48 | 24 |
| 40 prompts | disagreement | 70.56% | -9.36 [-12.62, -6.42] | 59.25% | 48/48 | 24 |
| 40 prompts | counterfactual | 69.05% | -10.87 [-14.47, -7.31] | 55.60% | 34/48 | 12 |
| 40 prompts | counterfactual_no_stop | 71.28% | -8.64 [-11.94, -5.60] | 59.12% | 48/48 | 24 |

Unreached checkpoints carry the terminal profile for the intention-to-prompt summary. Matched-budget gates require at least 90% viewer coverage and positive lower bounds for both matched and all-viewer comparisons.

| Policy | Mean prompts | Mean answers | Skip rate | Stopped | Largest answer loss (points) |
| --- | --- | --- | --- | --- | --- |
| active | 77.90 | 39.88 | 46.31% | 0 | -24.37 |
| balanced_random | 77.17 | 39.81 | 46.71% | 0 | -22.86 |
| disagreement | 73.90 | 39.92 | 44.25% | 0 | -22.86 |
| counterfactual | 54.29 | 29.25 | 44.93% | 28 | -22.86 |
| counterfactual_no_stop | 74.75 | 39.81 | 45.28% | 0 | -22.86 |

Stopping saves 27.42% of prompts. Terminal AUC changes by -4.57 [-6.88, -2.39] points against continued questioning.

## Interpretation limits

- Recorded cohorts and hard-v2 were evaluated before; they are regressions.
- New sealed viewers confirm synthetic behavior only; no independent human cohort.
- Recorded data cannot measure recognition realistically because only already-rated titles have known answers.
- Bootstrap uncertainty and predicted question value are proxies, not calibrated preference probabilities.
- Counterfactual simulation conditions a finite ensemble rather than refitting every posterior profile; it holds claims fixed.
- Context fields do not affect answers; this protocol uses solo preferences.
- Ranking over fixed held-out items does not test catalogue retrieval.

The counterfactual policy reweights a finite bootstrap ensemble for each possible answer. It does not refit every posterior profile.

Simulated stability checks append ratings with fixed claims. Actual CLI ratings reconcile claims, so policy predictions can miss claim changes.

Reports include high-confidence claim errors and question-value calibration bins. These measurements do not establish calibrated probability or explanation accuracy.

Identical repeated requests preserve the stored profile and return identical questions. CLI tests also preserve explicit claim corrections across rating updates.

## Reproduce the result

To run the frozen experiment, use:

```sh
pnpm lab:question-policy
```

To run a limited check without replacing the full report, use:

```sh
pnpm lab:question-policy -- --max-viewers 2 --output /tmp/question-smoke.json
```

Limited runs return `smoke_only`. The JSON stores every prompt, answer, skip, checkpoint, and viewer outcome.

Protocol SHA-256: `c0709037d5ad8d3a087a1181c3816c1811a17c679d588b13ed31149621fe161e`.

Model SHA-256: `9dd026a50f574428a4f947a91f32368646a065e9baffa0758d0d69e96c0c3f8e`.

Evaluator SHA-256: `a8535a392707e4a940b2742971c79fb7362965e40a12a6cb70902d8484f6ffc4`.
