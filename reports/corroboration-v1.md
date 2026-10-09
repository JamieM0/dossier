# Corroboration results

Decision: **do_not_promote**. No candidate passes every requirement in both reserved cohorts.

The experiment covers 160 fresh synthetic people and 320 sessions.
Jamie remains the only real product user. The product recommendation baseline remains unchanged.
The two reserved cohorts each contain 64 people. Confirmation people are independent of selection people.

## Measured outcomes

Accuracy measures how often a liked hidden film ranks ahead of a disliked film.
Update losses evaluate both sides against the same contemporaneous taste, including the preference-change boundary.
Intervals resample people after averaging their two sessions. Large losses exceed five ranking points after ten ratings.

### Selection people

| Policy | Final accuracy | Gain interval, points | Present-taste gain, points | Largest update loss, points | Large losses |
| --- | --- | --- | --- | --- | --- |
| Current | 81.95% | 0.00 [0.00, 0.00] | 0.00 [0.00, 0.00] | 35.18 | 1.08% |
| Local matching | 82.97% | 1.02 [0.13, 1.86] | 0.55 [-0.22, 1.29] | 21.47 | 0.97% |
| Recent matching | 85.01% | 3.06 [1.33, 5.20] | 1.25 [0.31, 2.28] | 33.84 | 2.13% |
| Supported matching | 82.30% | 0.35 [-0.75, 1.37] | 0.13 [-0.79, 1.08] | 23.67 | 1.09% |
| Supported recent matching | 84.67% | 2.72 [0.98, 4.86] | 0.90 [-0.13, 1.99] | 36.44 | 2.69% |
| Supported matching and claims | 82.22% | 0.27 [-0.87, 1.36] | 0.08 [-0.89, 1.07] | 22.58 | 1.11% |
| Supported recent matching and claims | 84.70% | 2.75 [0.84, 5.10] | 0.93 [-0.24, 2.20] | 29.51 | 3.11% |

| Candidate | Failed frozen requirements |
| --- | --- |
| Supported matching | meanGain, positiveLowerBound, worstTenth, stable_axes, changing_taste, biased_noise, adaptation40, adaptationRetention, singleRatingSafety, largeLossFrequency, historicalGain, historicalDecline, historicalStep |
| Supported recent matching | worstTenth, stable_axes, isolated_noise, biased_noise, singleRatingSafety, largeLossFrequency, historicalGain, historicalDecline, historicalStep |
| Supported matching and claims | meanGain, positiveLowerBound, worstTenth, stable_axes, changing_taste, biased_noise, adaptation40, adaptationRetention, singleRatingSafety, largeLossFrequency, historicalGain, historicalDecline, historicalStep |
| Supported recent matching and claims | worstTenth, stable_axes, isolated_noise, biased_noise, singleRatingSafety, largeLossFrequency, historicalGain, historicalDecline, historicalStep |

| Taste group | Current accuracy | Supported claim gain, points | Recent supported claim gain, points |
| --- | --- | --- | --- |
| stable axes | 90.69% | 0.18 [-1.45, 1.87] | 0.40 [-1.75, 2.74] |
| interactions | 83.79% | 0.91 [-1.43, 3.44] | 1.03 [-2.12, 4.36] |
| missing factor | 50.76% | -1.12 [-4.78, 2.31] | -1.12 [-5.08, 1.99] |
| isolated noise | 88.73% | 0.43 [-0.73, 1.46] | -0.45 [-1.65, 0.87] |
| repeated noise | 90.25% | 2.49 [0.23, 5.70] | 2.36 [-0.03, 5.87] |
| biased noise | 86.49% | 0.43 [-1.77, 2.40] | 0.91 [-1.37, 3.10] |
| changing taste | 72.30% | -1.78 [-7.74, 3.80] | 18.94 [9.03, 28.75] |
| weak ratings | 92.63% | 0.60 [-0.88, 2.48] | -0.11 [-1.53, 1.61] |

### Confirmation people

| Policy | Final accuracy | Gain interval, points | Present-taste gain, points | Largest update loss, points | Large losses |
| --- | --- | --- | --- | --- | --- |
| Current | 82.01% | 0.00 [0.00, 0.00] | 0.00 [0.00, 0.00] | 30.77 | 0.92% |
| Local matching | 82.81% | 0.80 [0.11, 1.53] | 0.65 [-0.08, 1.36] | 17.95 | 0.67% |
| Recent matching | 84.71% | 2.70 [1.05, 4.74] | 1.42 [0.54, 2.39] | 25.23 | 1.64% |
| Supported matching | 82.61% | 0.60 [-0.12, 1.38] | 0.30 [-0.45, 1.07] | 17.11 | 1.06% |
| Supported recent matching | 83.94% | 1.93 [0.21, 4.01] | 0.84 [-0.27, 2.07] | 28.74 | 2.34% |
| Supported matching and claims | 82.59% | 0.58 [-0.20, 1.42] | 0.21 [-0.57, 0.98] | 18.19 | 1.11% |
| Supported recent matching and claims | 83.95% | 1.94 [0.03, 4.20] | 0.74 [-0.50, 2.17] | 24.80 | 2.58% |

| Candidate | Failed frozen requirements |
| --- | --- |
| Supported matching | meanGain, positiveLowerBound, stable_axes, repeated_noise, adaptation40, adaptationRetention, singleRatingSafety, largeLossFrequency, historicalGain, historicalDecline, historicalStep |
| Supported recent matching | meanGain, stable_axes, singleRatingSafety, largeLossFrequency, historicalGain, historicalDecline, historicalStep |
| Supported matching and claims | meanGain, positiveLowerBound, stable_axes, repeated_noise, adaptation40, adaptationRetention, singleRatingSafety, largeLossFrequency, historicalGain, historicalDecline, historicalStep |
| Supported recent matching and claims | meanGain, stable_axes, singleRatingSafety, largeLossFrequency, historicalGain, historicalDecline, historicalStep |

| Taste group | Current accuracy | Supported claim gain, points | Recent supported claim gain, points |
| --- | --- | --- | --- |
| stable axes | 88.54% | -0.88 [-2.05, 0.55] | -1.87 [-3.72, -0.19] |
| interactions | 89.45% | -0.84 [-2.51, 0.82] | -2.59 [-6.06, 0.26] |
| missing factor | 49.03% | 1.93 [-1.11, 5.48] | 2.54 [-0.65, 6.21] |
| isolated noise | 90.89% | 0.34 [-0.02, 0.72] | 0.13 [-0.63, 0.86] |
| repeated noise | 91.22% | 0.64 [-1.08, 2.52] | 0.85 [-0.72, 2.84] |
| biased noise | 85.69% | 2.84 [0.53, 5.37] | 2.28 [-0.47, 5.12] |
| changing taste | 75.17% | 1.63 [-0.50, 3.45] | 16.29 [7.24, 27.17] |
| weak ratings | 86.10% | -1.04 [-3.70, 1.76] | -2.13 [-5.23, 1.11] |

## Historical failures

| Viewer and order | Policy | Final gain, points | Ten-to-forty change, points | Largest update loss, points |
| --- | --- | --- | --- | --- |
| movielens-21, 83 | Current | 0.00 | -29.55 | 16.56 |
| movielens-21, 83 | Local matching | -2.76 | -17.05 | 15.75 |
| movielens-21, 83 | Recent matching | -6.49 | -23.21 | 20.46 |
| movielens-21, 83 | Supported matching | -2.60 | -4.88 | 15.26 |
| movielens-21, 83 | Supported recent matching | 1.30 | -12.01 | 17.04 |
| movielens-21, 83 | Supported matching and claims | -3.24 | -5.52 | 16.23 |
| movielens-21, 83 | Supported recent matching and claims | 0.81 | -12.50 | 15.09 |
| movielens-177, 11 | Current | 0.00 | -23.90 | 10.78 |
| movielens-177, 11 | Local matching | -14.84 | -19.84 | 7.50 |
| movielens-177, 11 | Recent matching | -17.03 | -18.28 | 9.37 |
| movielens-177, 11 | Supported matching | -22.03 | -6.87 | 5.32 |
| movielens-177, 11 | Supported recent matching | -23.28 | -7.50 | 6.25 |
| movielens-177, 11 | Supported matching and claims | -20.31 | -6.40 | 7.81 |
| movielens-177, 11 | Supported recent matching and claims | -22.97 | -9.53 | 8.90 |
| movielens-483, 83 | Current | 0.00 | -22.86 | 16.67 |
| movielens-483, 83 | Local matching | 4.42 | -13.76 | 12.24 |
| movielens-483, 83 | Recent matching | 5.31 | -12.50 | 14.02 |
| movielens-483, 83 | Supported matching | -2.27 | -21.97 | 13.89 |
| movielens-483, 83 | Supported recent matching | 6.19 | -13.64 | 20.33 |
| movielens-483, 83 | Supported matching and claims | -3.28 | -23.23 | 13.38 |
| movielens-483, 83 | Supported recent matching and claims | 2.53 | -19.19 | 18.44 |
| movielens-21, 11 | Current | 0.00 | -22.40 | 22.08 |
| movielens-21, 11 | Local matching | 11.68 | -13.80 | 14.61 |
| movielens-21, 11 | Recent matching | 13.47 | -11.36 | 18.83 |
| movielens-21, 11 | Supported matching | 21.26 | 4.71 | 24.68 |
| movielens-21, 11 | Supported recent matching | 23.86 | 11.85 | 24.35 |
| movielens-21, 11 | Supported matching and claims | 24.18 | 2.43 | 26.78 |
| movielens-21, 11 | Supported recent matching and claims | 25.16 | 7.96 | 29.22 |
| movielens-603, 29 | Current | 0.00 | -21.43 | 6.94 |
| movielens-603, 29 | Local matching | 5.71 | -14.90 | 7.15 |
| movielens-603, 29 | Recent matching | -3.06 | -24.39 | 8.27 |
| movielens-603, 29 | Supported matching | -3.16 | -19.08 | 9.59 |
| movielens-603, 29 | Supported recent matching | -6.12 | -23.87 | 14.90 |
| movielens-603, 29 | Supported matching and claims | 0.31 | -17.04 | 9.79 |
| movielens-603, 29 | Supported recent matching and claims | -4.59 | -23.77 | 13.37 |

## Controls and evidence limits

Every supplied rating, overwrite, removal, and original timestamp remains exact in the stored library.
Stored preferences remain inspectable and unchanged by scoring. Guard previews identify supporting titles, counters, and effective influence.
The experiment checks encrypted portability and score restoration while preserving original claims for scorer isolation.
Eight storage-order permutations retain timestamps and stored claims. They isolate score-order sensitivity.

- Jamie is the only real product user.
- Synthetic film ranking does not establish retrieval quality, television behavior, recognition, or question effort.
- Different titles are not statistically independent; metadata density is a proxy for duplicate evidence.
- Simulated two-day timing does not establish an optimal half-life.
- Unavailable preferences cannot be reconstructed from metadata.
- Reserved outcomes cannot tune this version or relax its requirements.

Read the [experiment guide](../docs/corroboration-experiment.md) for the frozen requirements and reproduction commands.
Read the [compressed traces](corroboration-v1.jsonl.gz) for every rating, score, preference preview, and measurement.
