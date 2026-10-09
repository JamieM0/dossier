# Learning stability results

Decision: **do_not_promote**. No candidate passes every frozen requirement.

The replay covers 120 synthetic people and 240 sessions.
Jamie is the only real product user. Historical MovieLens failures supply regression evidence.

## Reserved people

Ranking accuracy measures how often a liked hidden film ranks ahead of a disliked film. Chance scores 50 percent.
Intervals resample people after averaging their sessions. Repeated sessions do not count as independent people.

| Policy | Accuracy | Gain interval, points | Largest loss, points | Large losses | Order spread, points |
| --- | --- | --- | --- | --- | --- |
| Current | 76.35% | 0.00 [0.00, 0.00] | 16.86 | 1.62% | 35.77 |
| Stable anchors | 76.76% | 0.41 [-0.18, 1.02] | 16.86 | 1.58% | 0.00 |
| Strict stable groups | 77.48% | 1.13 [0.34, 1.99] | 17.14 | 1.43% | 0.00 |
| Local evidence | 78.97% | 2.63 [1.32, 4.07] | 13.20 | 0.72% | 0.00 |
| Recent local evidence | 81.45% | 5.10 [3.05, 7.73] | 17.79 | 2.37% | 0.00 |

## Requirements

| Policy | Failed frozen requirements |
| --- | --- |
| Stable anchors | meanGain, positiveLowerBound, singleRatingSafety, largeLossFrequency, historicalGain, historicalDecline, historicalStep |
| Strict stable groups | meanGain, singleRatingSafety, largeLossFrequency, historicalGain, historicalDecline, historicalStep |
| Local evidence | changingTaste, singleRatingSafety, historicalGain, historicalDecline, historicalStep |
| Recent local evidence | singleRatingSafety, largeLossFrequency, historicalGain, historicalDecline, historicalStep |

## Taste groups

| Group | Current accuracy | Local gain, points | Recent local gain, points |
| --- | --- | --- | --- |
| stable axes | 87.91% | 2.59 [0.62, 5.30] | 1.46 [-0.17, 3.43] |
| interactions | 86.70% | 3.03 [1.18, 4.88] | 2.51 [0.71, 4.42] |
| missing factor | 52.02% | 3.10 [0.25, 5.94] | 1.97 [0.04, 3.63] |
| noisy ratings | 80.00% | 5.15 [2.17, 8.03] | 5.10 [2.38, 7.85] |
| changing taste | 65.69% | 1.43 [-3.39, 7.78] | 19.52 [11.67, 28.92] |
| weak ratings | 85.76% | 0.46 [-1.60, 2.32] | 0.05 [-2.68, 2.49] |

## Historical failures

| Viewer and order | Policy | Gain at forty ratings, points | Change from ten to forty, points | Largest step loss, points |
| --- | --- | --- | --- | --- |
| movielens-21, 83 | Current | 0.00 | -29.55 | 16.56 |
| movielens-21, 83 | Stable anchors | 5.85 | -23.70 | 19.15 |
| movielens-21, 83 | Strict stable groups | 3.57 | -25.98 | 15.10 |
| movielens-21, 83 | Local evidence | -2.76 | -17.05 | 15.75 |
| movielens-21, 83 | Recent local evidence | -6.49 | -23.21 | 20.46 |
| movielens-177, 11 | Current | 0.00 | -23.90 | 10.78 |
| movielens-177, 11 | Stable anchors | -0.63 | -24.53 | 10.94 |
| movielens-177, 11 | Strict stable groups | -13.75 | -37.65 | 11.41 |
| movielens-177, 11 | Local evidence | -14.84 | -19.84 | 7.50 |
| movielens-177, 11 | Recent local evidence | -17.03 | -18.28 | 9.37 |
| movielens-483, 83 | Current | 0.00 | -22.86 | 16.67 |
| movielens-483, 83 | Stable anchors | 5.68 | -17.18 | 16.67 |
| movielens-483, 83 | Strict stable groups | 3.16 | -19.70 | 16.67 |
| movielens-483, 83 | Local evidence | 4.42 | -13.76 | 12.24 |
| movielens-483, 83 | Recent local evidence | 5.31 | -12.50 | 14.02 |
| movielens-21, 11 | Current | 0.00 | -22.40 | 22.08 |
| movielens-21, 11 | Stable anchors | 7.14 | -15.26 | 8.27 |
| movielens-21, 11 | Strict stable groups | 7.14 | -15.26 | 8.27 |
| movielens-21, 11 | Local evidence | 11.68 | -13.80 | 14.61 |
| movielens-21, 11 | Recent local evidence | 13.47 | -11.36 | 18.83 |
| movielens-603, 29 | Current | 0.00 | -21.43 | 6.94 |
| movielens-603, 29 | Stable anchors | 0.92 | -20.51 | 7.66 |
| movielens-603, 29 | Strict stable groups | 5.92 | -15.51 | 7.34 |
| movielens-603, 29 | Local evidence | 5.71 | -14.90 | 7.15 |
| movielens-603, 29 | Recent local evidence | -3.06 | -24.39 | 8.27 |

## Profile continuity

Intervening reratings and clearing change stored claims in 193 sessions.
Both local policies restore their published scores in every session without resetting the original claims. Changed claim records alone do not establish a recommendation failure.
Order tests permute the same final library while retaining timestamps and stored claims.
Experimental reads preserve library state. Encrypted export and import preserve state and checkpoint scores.

## Evidence limits

- Synthetic ranking on known film candidates, not retrieval or television.
- Noisy ratings differ from noisy explanations; previous correction experiments cover explanation errors.
- Recency uses simulated two-day intervals; no optimal half-life claim.
- Order tests hold claims and timestamps fixed and do not claim inference history independence.
- Local similarity cannot recover factors absent from metadata.
- Jamie remains the only real product user.

Read the [experiment guide](../docs/learning-stability-experiment.md) for the frozen requirements and reproduction commands.
Read the [compressed traces](learning-stability-v1.json.gz) for every rating, score, and measurement.
