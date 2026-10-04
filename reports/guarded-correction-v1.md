# Guarded correction results

Decision: **do_not_promote**. No candidate meets every frozen requirement. Keep ordinary recommendation defaults.

160 fresh synthetic people supplied 320 sessions. Reserved confirmation includes 80 people.
Jamie is the only real product user. The synthetic lab supplies model decision evidence.

## Reserved outcomes

Ranking accuracy measures whether liked hidden films outrank disliked films. Chance scores 50 percent.
Gains and intervals use people after averaging their two sessions. All gains and losses use ranking percentage points.
The worst loss follows one answer.

| Policy | Accuracy | Gain, 95 percent interval | Worst loss | Broad questions | Follow-ups | Applied preferences | Pending | Withdrawn |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| current | 68.50% | 0.00 [0.00, 0.00] | 0.00 | 7.86 | 0.00 | 0.00 | 0.00 | 0.00 |
| bounded | 71.41% | 2.90 [1.04, 4.61] | -46.80 | 7.86 | 0.00 | 1.43 | 0.00 | 0.00 |
| scoped | 71.43% | 2.93 [0.61, 5.07] | -61.54 | 7.86 | 0.00 | 1.43 | 0.00 | 0.00 |
| guarded | 73.58% | 5.08 [3.68, 6.58] | -17.84 | 7.86 | 0.00 | 1.10 | 0.33 | 0.00 |
| reviewed | 72.57% | 4.07 [2.13, 5.86] | -70.09 | 7.58 | 0.28 | 1.27 | 0.03 | 0.09 |

Question and preference counts are means per session. Follow-ups consume the same eight-turn budget as broad questions.

## Control outcomes

| Policy | General correction | Title reversal | Pair reversal | Outside scope stable | Pending scores stable |
| --- | --- | --- | --- | --- | --- |
| current | 0/116 | 0/160 | 0/160 | true | true |
| bounded | 116/116 | 74/160 | 64/160 | true | true |
| scoped | 116/116 | 160/160 | 160/160 | true | true |
| guarded | 104/116 | 160/160 | 160/160 | true | true |
| reviewed | 116/116 | 160/160 | 160/160 | true | true |

Reviewed general trials deliberately approve both effects. Guarded trials receive no bypass; any ineffective reversal counts as failure.
These trials measure control. Hidden-film quality measures the truth and usefulness of feedback separately.

## Adoption requirements

Every requirement must pass. The gain and protection thresholds remain unchanged from experiment six.

| Requirement | Bounded | Scoped | Guarded | Reviewed |
| --- | --- | --- | --- | --- |
| minimumGain | true | true | true | true |
| positiveLowerBound | true | true | true | true |
| worstDecile | true | false | true | true |
| noisyProtection | false | false | true | false |
| singlePromptSafety | false | false | false | false |
| questionCoverage | true | true | true | true |
| correction | false | true | false | true |
| accurateGainRetention | true | true | true | true |
| pendingStable | true | true | true | true |
| removal | true | true | true | true |
| restoration | true | true | true | true |
| locality | true | true | true | true |
| portability | true | true | true | true |
| defaults | true | true | true | true |
| overwrite | true | true | true | true |

Both independent and persistent misleading explanations must pass protection requirements.
Accurate multiple preferences must retain at least 80 percent of the scoped policy gain when that gain is positive.

## Different synthetic tastes

| Type | Current accuracy | Bounded gain | Scoped gain | Guarded gain | Reviewed gain |
| --- | --- | --- | --- | --- | --- |
| multiple | 78.42% | 9.63 [6.20, 13.27] | 11.81 [7.55, 16.24] | 11.65 [7.40, 16.11] | 11.81 [7.55, 16.24] |
| noisy_explanations | 78.60% | -5.65 [-14.34, 2.39] | -9.22 [-20.33, 0.80] | 4.32 [0.48, 8.89] | 0.11 [-9.26, 7.35] |
| partial_explanations | 74.68% | 3.74 [1.27, 6.53] | 5.09 [1.66, 9.06] | 5.09 [1.66, 9.06] | 5.09 [1.66, 9.06] |
| missing_factor | 53.21% | 0.00 [0.00, 0.00] | 0.00 [0.00, 0.00] | 0.00 [0.00, 0.00] | 0.00 [0.00, 0.00] |
| changing_taste | 63.67% | 3.30 [0.68, 6.58] | 3.62 [0.85, 6.99] | 0.13 [-0.53, 0.73] | 3.62 [0.85, 6.99] |
| exceptions | 65.80% | 7.55 [3.61, 11.38] | 7.90 [3.72, 12.05] | 7.85 [3.61, 12.03] | 7.91 [3.72, 12.06] |
| persistent_noise | 72.68% | -0.13 [-5.63, 4.73] | -0.39 [-7.33, 5.97] | 7.15 [2.91, 11.73] | -0.62 [-7.76, 5.88] |
| conflicting_evidence | 60.96% | 4.77 [3.10, 6.49] | 4.63 [3.01, 6.29] | 4.45 [2.94, 5.98] | 4.63 [3.01, 6.29] |

## Evidence and limits

A new cohort and catalogue prevent reuse of experiment six confirmation evidence.
Only public descriptions, supplied ratings, and actual answers reach the application.
The actor can repeat a wrong explanation. Follow-up approval does not constitute measured confidence.
Ordinary recommendations remain unchanged. Each branch checks removal, restoration, pending scores, and encrypted portability.
Title and pair feedback applies to rated diagnostic films. Unseen-film ranking gains come from broad preferences.
The experiment tests known film candidates. Retrieval, human comprehension, and television remain outside its scope.

[Executive decision](guarded-correction-analysis-v1.md) explains the project implications and next hypothesis.
[Protocol guide](../docs/guarded-correction-experiment.md) explains the frozen procedure.
[Lossless traces](guarded-correction-v1.json.gz) preserve evidence, previews, answers, profiles, rankings, and control trials.
