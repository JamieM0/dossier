# Impact correction results

Decision: **do_not_promote**. No candidate meets every frozen requirement. Keep ordinary recommendation defaults.

200 fresh synthetic people supplied 400 sessions. Reserved confirmation includes 100 people.
Jamie is the only real product user. The synthetic lab supplies model decision evidence.

## Reserved ranking outcomes

Ranking accuracy measures whether liked hidden films outrank disliked films. Chance scores 50 percent.
Gains and intervals use people after averaging their two sessions. Gains and losses use ranking percentage points.

| Policy | Accuracy | Gain, 95 percent interval | Worst answer loss | Active feedback | Limited final profiles |
| --- | --- | --- | --- | --- | --- |
| current | 70.03% | 0.00 [0.00, 0.00] | 0.00 | 0.00 | 0.00% |
| scoped | 74.85% | 4.82 [3.58, 6.12] | -55.28 | 1.63 | 0.00% |
| guarded | 75.55% | 5.52 [4.39, 6.73] | -27.93 | 1.42 | 0.00% |
| reviewed | 74.99% | 4.96 [3.80, 6.18] | -55.28 | 1.51 | 0.00% |
| impact_guarded | 71.13% | 1.10 [0.86, 1.36] | -2.48 | 1.42 | 0.00% |
| impact_reviewed | 71.10% | 1.06 [0.82, 1.32] | -2.64 | 1.51 | 0.00% |
| impact_ranked | 70.19% | 0.16 [0.11, 0.20] | -1.03 | 1.50 | 64.00% |

Active feedback counts are means per session. Limited profiles report final attenuation by the additional relation cap.

## Controls and interactions

| Policy | General direction | Title reversal | Pair reversal | Isolated scope stable | Populated scope stable |
| --- | --- | --- | --- | --- | --- |
| current | 0/149 | 0/200 | 0/200 | true | true |
| scoped | 149/149 | 200/200 | 200/200 | true | true |
| guarded | 139/149 | 200/200 | 200/200 | true | true |
| reviewed | 149/149 | 200/200 | 200/200 | true | true |
| impact_guarded | 139/149 | 200/200 | 200/200 | true | true |
| impact_reviewed | 149/149 | 200/200 | 200/200 | true | true |
| impact_ranked | 132/149 | 200/200 | 200/200 | true | false |

Reviewed correction trials deliberately approve both general effects. Score changes hidden by publication count as ineffective correction.
Populated scope trials reverse a general preference while retaining the other preferences. Outside scores must remain unchanged.

## Adoption requirements

Every frozen requirement must pass. The relation cap does not itself guarantee a five-point accuracy loss limit.

| Requirement | scoped | guarded | reviewed | impact_guarded | impact_reviewed | impact_ranked |
| --- | --- | --- | --- | --- | --- | --- |
| minimumGain | true | true | true | false | false | false |
| positiveLowerBound | true | true | true | true | true | true |
| worstDecile | true | true | true | true | true | true |
| noisyProtection | false | true | false | true | true | true |
| singlePromptSafety | false | false | false | true | true | true |
| questionCoverage | true | true | true | true | true | true |
| correction | true | true | true | true | true | false |
| accurateGainRetention | true | true | true | false | false | false |
| pendingStable | true | true | true | true | true | true |
| impactBound | true | true | true | true | true | true |
| removal | true | true | true | true | true | true |
| restoration | true | true | true | true | true | true |
| locality | true | true | true | true | true | false |
| portability | true | true | true | true | true | true |
| defaults | true | true | true | true | true | true |
| overwrite | true | true | true | true | true | true |

## Different synthetic tastes

### Existing controls

| Type | Current accuracy | scoped gain | guarded gain | reviewed gain |
| --- | --- | --- | --- | --- |
| multiple | 78.22% | 7.84 [4.50, 12.19] | 8.09 [4.63, 12.48] | 7.84 [4.50, 12.19] |
| noisy_explanations | 80.36% | 4.03 [-0.33, 8.02] | 6.55 [3.61, 9.34] | 6.21 [3.25, 9.05] |
| partial_explanations | 78.33% | 4.60 [1.96, 7.73] | 4.60 [1.96, 7.73] | 4.60 [1.96, 7.73] |
| missing_factor | 53.54% | 0.00 [0.00, 0.00] | 0.00 [0.00, 0.00] | 0.00 [0.00, 0.00] |
| changing_taste | 74.07% | 1.30 [0.23, 2.94] | 0.51 [0.11, 1.01] | 1.30 [0.23, 2.94] |
| exceptions | 72.20% | 7.27 [4.24, 10.41] | 7.83 [4.27, 11.93] | 6.56 [4.09, 9.07] |
| persistent_noise | 71.70% | 3.86 [-2.03, 9.20] | 8.09 [4.87, 11.48] | 3.72 [-2.10, 9.08] |
| conflicting_evidence | 57.26% | 5.81 [3.49, 8.35] | 5.71 [3.36, 8.29] | 5.55 [3.07, 8.23] |
| consistent_misleading | 60.11% | 4.03 [0.64, 8.07] | 4.29 [0.86, 8.33] | 4.32 [0.91, 8.35] |
| weak_ratings | 74.55% | 9.47 [5.61, 14.05] | 9.50 [5.62, 14.10] | 9.50 [5.62, 14.10] |

### Limited candidates

| Type | Current accuracy | impact_guarded gain | impact_reviewed gain | impact_ranked gain |
| --- | --- | --- | --- | --- |
| multiple | 78.22% | 1.87 [1.00, 2.94] | 1.87 [1.00, 2.94] | 0.35 [0.14, 0.57] |
| noisy_explanations | 80.36% | 2.09 [1.29, 2.91] | 2.02 [1.19, 2.86] | 0.10 [0.04, 0.17] |
| partial_explanations | 78.33% | 0.78 [0.37, 1.26] | 0.78 [0.37, 1.26] | 0.08 [0.03, 0.15] |
| missing_factor | 53.54% | 0.00 [0.00, 0.00] | 0.00 [0.00, 0.00] | 0.00 [0.00, 0.00] |
| changing_taste | 74.07% | 0.25 [0.04, 0.51] | 0.33 [0.10, 0.60] | 0.10 [0.03, 0.18] |
| exceptions | 72.20% | 1.25 [0.77, 1.87] | 1.05 [0.78, 1.31] | 0.27 [0.13, 0.40] |
| persistent_noise | 71.70% | 1.70 [1.03, 2.39] | 1.47 [0.56, 2.44] | 0.16 [0.05, 0.30] |
| conflicting_evidence | 57.26% | 0.62 [0.32, 1.06] | 0.62 [0.32, 1.06] | 0.10 [0.03, 0.18] |
| consistent_misleading | 60.11% | 0.80 [-0.04, 1.73] | 0.84 [0.04, 1.75] | 0.14 [0.00, 0.32] |
| weak_ratings | 74.55% | 1.64 [1.07, 2.33] | 1.64 [1.07, 2.33] | 0.26 [0.13, 0.40] |


## Question cost

| Policy | Broad questions | Follow-ups | Pending | Withdrawn |
| --- | --- | --- | --- | --- |
| current | 7.46 | 0.00 | 0.00 | 0.00 |
| scoped | 7.46 | 0.00 | 0.00 | 0.00 |
| guarded | 7.46 | 0.00 | 0.21 | 0.00 |
| reviewed | 7.30 | 0.17 | 0.03 | 0.04 |
| impact_guarded | 7.46 | 0.00 | 0.21 | 0.00 |
| impact_reviewed | 7.30 | 0.17 | 0.03 | 0.04 |
| impact_ranked | 7.30 | 0.17 | 0.03 | 0.04 |

Question counts are means per session. Every policy uses at most eight total questions.

## Evidence and limits

Only supplied ratings, utterances, and public film descriptions reach the application.
The biased-library group simulates misleading evidence selection. Held-out ratings never enter scoring or question selection.
All policies preserve ordinary recommendation defaults. Each branch checks encrypted export and import.
Title and comparison control trials use rated titles. Quality paths receive only general feedback.
Known film candidates, candidate-pool composition, synthetic response patterns, and score publication limit these conclusions.

[Executive decision](impact-correction-analysis-v1.md) explains the project recommendation.
[Protocol guide](../docs/impact-correction-experiment.md) explains the frozen procedure.
[Lossless traces](impact-correction-v1.json.gz) preserve previews, questions, profiles, scores, and correction trials.
