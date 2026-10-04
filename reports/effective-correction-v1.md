# Effective correction results

Decision: **do_not_promote**. No candidate passed every frozen gain, control, and protection requirement.

120 synthetic movie people supplied 240 sessions. Reserved confirmation contains 60 people.

Jamie is the only real product user. These results guide model decisions through the synthetic lab.

## Confirmation results

Ranking accuracy measures whether liked hidden films rank ahead of disliked films. Chance scores 50 percent.
Gain intervals resample people after averaging their two sessions. Repeated sessions do not count as independent people.
Large viewer losses count people losing more than three ranking points. Worst prompt loss reports the largest loss after one answer.

| Arm | Ranking accuracy | Gain, 95 percent interval in points | Large viewer losses | Worst prompt loss |
| --- | --- | --- | --- | --- |
| current | 71.07% | 0.00 [0.00, 0.00] | 0 | 0.00 |
| native | 70.84% | -0.24 [-0.68, 0.14] | 4 | -11.94 |
| bounded | 72.69% | 1.62 [-0.74, 3.90] | 8 | -41.52 |
| scoped | 72.50% | 1.42 [-1.41, 4.06] | 8 | -78.19 |

## Control outcomes

Diagnostic corrections reverse supplied feedback. They measure control, rather than the truth of that feedback.

| Arm | General direction | Title sign change | Comparison reversed | Unrelated scores stable |
| --- | --- | --- | --- | --- |
| current | 0/76 | 0/120 | 0/120 | true |
| native | 22/76 | 50/120 | 0/120 | false |
| bounded | 76/76 | 63/120 | 52/120 | true |
| scoped | 76/76 | 120/120 | 120/120 | true |

General preferences require directional influence. They do not promise universal ordering against films outside the preference.
Direct comparisons require the requested ordering before and after correction. Title exceptions require the requested score sign.
Unrelated score stability does not imply unchanged rank positions. A corrected film can move past an unrelated film.

## Requirements

Every requirement must pass before a candidate earns adoption review.

| Requirement | Native | Bounded | Scoped |
| --- | --- | --- | --- |
| minimumGain | false | false | false |
| positiveLowerBound | false | false | false |
| worstDecile | true | true | false |
| noisyProtection | false | false | false |
| singlePromptSafety | false | false | false |
| questionCoverage | true | true | true |
| correction | false | false | true |
| removal | true | true | true |
| restoration | true | true | true |
| locality | false | true | true |
| portability | true | true | true |
| defaults | true | true | true |
| overwrite | true | true | true |

## Different synthetic tastes

| Type | Current accuracy | Native gain | Bounded gain | Scoped gain |
| --- | --- | --- | --- | --- |
| multiple | 80.99% | 0.78 [0.56, 1.02] | 9.33 [7.06, 12.37] | 10.61 [7.82, 14.00] |
| noisy_explanations | 78.42% | -2.84 [-4.44, -1.26] | -12.59 [-18.50, -6.17] | -15.98 [-23.76, -7.85] |
| partial_explanations | 78.79% | 0.09 [0.00, 0.22] | 2.33 [0.48, 4.70] | 2.53 [0.47, 5.21] |
| missing_factor | 50.42% | 0.00 [0.00, 0.00] | 0.00 [0.00, 0.00] | 0.00 [0.00, 0.00] |
| changing_taste | 65.71% | 0.06 [-0.02, 0.16] | 1.67 [0.33, 3.44] | 1.86 [0.33, 4.02] |
| exceptions | 72.10% | 0.50 [0.14, 0.92] | 8.98 [5.60, 13.16] | 9.53 [6.10, 13.60] |

## Recommended decision

Keep product defaults unchanged while reviewing the failed requirements.
Distinguish effective control from recommendation quality. A policy can obey misleading feedback and reduce accuracy.
Use subgroup outcomes to define a new hypothesis. Do not adjust this experiment after inspecting reserved outcomes.

## Evidence and limits

Every scorer receives public descriptions and supplied ratings only.
The lab replaces repeated ratings through the application transition. Hidden ratings never train a model.
Every session checks default recommendations and encrypted export and import.
The experiment measures candidate ranking, rather than film retrieval or human comprehension.
Direct title and comparison feedback applies to rated titles in diagnostic pools. Their transfer to unseen films remains untested.
The current and native controls represent unchanged scoring and existing feedback behavior.
The native title control rerates a title. Its changes can affect recommendations outside that title.
The scoped policy uses fixed priorities. These priorities do not constitute measured confidence.

Protocol hash: `fc89acedbb8d16d83932917c6933844f38ee4fc20cab6e18eada23053b48a5f6`.

[Executive decision](effective-correction-analysis-v1.md) explains the project implications and recommended next experiment.
[Experiment guide](../docs/effective-correction-experiment.md) explains the frozen procedure.
[Lossless traces](effective-correction-v1.json.gz) preserve questions, supplied answers, profiles, rankings, and control trials.
