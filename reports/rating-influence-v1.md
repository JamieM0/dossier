# Rating influence adoption experiment

Retain current product defaults. No candidate passes synthetic selection or independent confirmation.
The trial tests three demonstrated mechanisms with 220 fresh synthetic people and 440 sessions.
Development contains 44 people. Selection and confirmation contain 88 people each, using separate catalogues.
Every session supplies sixty ratings. Candidates, settings, evaluator, and requirements freeze before reserved evaluation.
No tuning follows selection or confirmation. Jamie remains the only real product user.

Read the [mechanism report](rating-influence-mechanisms-v1.md) and [protocol guide](../docs/rating-influence-experiment.md).

## Average quality and immediate damage

| Cohort | Scorer | Final accuracy | Gain against current, points | Person interval, points | Worst update loss, points | Large-loss frequency |
| --- | --- | ---: | ---: | --- | ---: | ---: |
| Selection | current | 78.65% | 0.00 | 0.00 to 0.00 | 37.47 | 1.39% |
| Selection | local | 79.13% | 0.48 | -0.38 to 1.44 | 30.16 | 1.09% |
| Selection | local_recent | 79.84% | 1.19 | -0.27 to 2.83 | 30.25 | 2.44% |
| Selection | narrow_recent | 79.49% | 0.84 | -0.54 to 2.39 | 31.14 | 2.09% |
| Selection | exception_recent | 79.24% | 0.59 | -0.93 to 2.20 | 24.21 | 1.90% |
| Selection | additive_recent | 78.68% | 0.04 | -1.74 to 1.92 | 30.38 | 3.19% |
| Confirmation | current | 80.97% | 0.00 | 0.00 to 0.00 | 30.98 | 1.18% |
| Confirmation | local | 81.08% | 0.10 | -0.73 to 0.98 | 20.59 | 1.01% |
| Confirmation | local_recent | 81.41% | 0.44 | -0.77 to 2.00 | 24.35 | 2.22% |
| Confirmation | narrow_recent | 81.14% | 0.16 | -1.00 to 1.60 | 24.55 | 2.19% |
| Confirmation | exception_recent | 81.05% | 0.08 | -1.14 to 1.58 | 19.49 | 1.80% |
| Confirmation | additive_recent | 80.20% | -0.78 | -2.21 to 0.90 | 24.01 | 3.15% |

Large losses exceed five ranking points after ten observations. Both endpoints use the same contemporaneous taste.
Intervals resample people after averaging their two sessions. Update counts do not represent independent people.

Rounding applies separately to accuracy and paired gains.

This synthetic cohort changes both catalogue and actor mix. Its gains do not add to earlier trial gains.

## Direct comparison with matching controls

| Cohort | Candidate | Gain against timeless, points | Gain against recent, points |
| --- | --- | ---: | ---: |
| sealed | narrow_recent | 0.36 | -0.35 |
| sealed | exception_recent | 0.11 | -0.60 |
| sealed | additive_recent | -0.45 | -1.15 |
| confirmation | narrow_recent | 0.06 | -0.28 |
| confirmation | exception_recent | -0.03 | -0.36 |
| confirmation | additive_recent | -0.88 | -1.22 |

## Vulnerable groups

| Cohort | Group | Narrow gain | Exception gain | Additive gain |
| --- | --- | ---: | ---: | ---: |
| sealed | stable_axes | -0.81 | -1.40 | -3.21 |
| sealed | interactions | -1.18 | -1.44 | -2.74 |
| sealed | missing_factor | 1.16 | 2.89 | 3.14 |
| sealed | isolated_noise | -3.17 | -3.95 | -4.39 |
| sealed | repeated_noise | 0.78 | 1.15 | -0.38 |
| sealed | biased_noise | 2.39 | 2.67 | 2.59 |
| sealed | changing_taste | 14.02 | 13.20 | 16.03 |
| sealed | weak_ratings | -0.11 | -0.18 | -2.33 |
| sealed | novel_preference | -4.09 | -5.76 | -8.09 |
| sealed | duplicate_evidence | 0.08 | 0.46 | -0.68 |
| sealed | metadata_matched | 0.21 | -1.15 | 0.48 |
| confirmation | stable_axes | -0.63 | -0.71 | -1.87 |
| confirmation | interactions | -0.76 | -0.52 | -2.62 |
| confirmation | missing_factor | -0.91 | 0.08 | 0.47 |
| confirmation | isolated_noise | -0.29 | -0.27 | -0.60 |
| confirmation | repeated_noise | -0.78 | -1.91 | -1.62 |
| confirmation | biased_noise | -0.58 | -1.10 | -2.47 |
| confirmation | changing_taste | 10.68 | 11.36 | 11.94 |
| confirmation | weak_ratings | -0.02 | -0.47 | -0.85 |
| confirmation | novel_preference | -3.65 | -5.05 | -7.36 |
| confirmation | duplicate_evidence | 0.38 | -0.21 | -1.03 |
| confirmation | metadata_matched | -1.66 | -0.34 | -2.52 |

Group gains use ranking points against current scoring. The JSON summaries also contain each group interval and worst update.

## Learning and adaptation

| Cohort | Scorer | Novel-region learning, points | Other-title ranking change, points | Changing-taste final gain, points | Adaptation at forty, points |
| --- | --- | ---: | ---: | ---: | ---: |
| sealed | current | 17.48 | -5.23 | 0.00 | 0.00 |
| sealed | local | 12.19 | -4.19 | 1.85 | 1.50 |
| sealed | local_recent | 8.95 | -10.21 | 15.35 | 11.14 |
| sealed | narrow_recent | 10.65 | -8.30 | 14.02 | 9.36 |
| sealed | exception_recent | 9.10 | -9.50 | 13.20 | 7.27 |
| sealed | additive_recent | 6.37 | -11.58 | 16.03 | 13.50 |
| confirmation | current | 6.56 | -7.71 | 0.00 | 0.00 |
| confirmation | local | 4.19 | -10.28 | 4.36 | -0.21 |
| confirmation | local_recent | 5.33 | -12.45 | 11.75 | 11.34 |
| confirmation | narrow_recent | 7.64 | -11.81 | 10.68 | 8.34 |
| confirmation | exception_recent | 5.31 | -12.47 | 11.36 | 5.62 |
| confirmation | additive_recent | 3.63 | -12.91 | 11.94 | 12.24 |

Novel-region learning measures ranking pairs involving the previously unobserved tag between observations thirty and sixty.
Other-title ranking change measures pairs without that tag. Both measurements use unchanged contemporaneous taste.
Changing-taste final gain compares final recommendations against the new taste; adaptation at forty measures earlier recovery.
These measures distinguish useful new learning from stability purchased by ignoring new evidence.

## Worst failures and frozen gates

- sealed/narrow_recent: influence-sealed-biased_noise-0, seed 97, observation 14, mistaken rating, loss 31.14 points.
  Failed requirements: meanGain, positiveLowerBound, contemporaneousTaste, stable_axes, interactions, isolated_noise, repeated_noise, weak_ratings, novel_preference, duplicate_evidence, metadata_matched, singleRatingSafety, largeLossFrequency, legacyHistoricalVerified, historicalGain, historicalDecline, historicalStep.
- sealed/exception_recent: influence-sealed-biased_noise-0, seed 97, observation 14, mistaken rating, loss 24.21 points.
  Failed requirements: meanGain, positiveLowerBound, stable_axes, interactions, isolated_noise, weak_ratings, novel_preference, duplicate_evidence, metadata_matched, singleRatingSafety, largeLossFrequency, legacyHistoricalVerified, historicalGain, historicalDecline, historicalStep.
- sealed/additive_recent: influence-sealed-duplicate_evidence-3, seed 53, observation 11, accurate rating, loss 30.38 points.
  Failed requirements: meanGain, positiveLowerBound, contemporaneousTaste, stable_axes, interactions, isolated_noise, repeated_noise, weak_ratings, novel_preference, duplicate_evidence, metadata_matched, singleRatingSafety, largeLossFrequency, novelLearning, legacyHistoricalVerified, historicalGain, historicalDecline, historicalStep.
- confirmation/narrow_recent: influence-confirmation-duplicate_evidence-4, seed 97, observation 22, accurate rating, loss 24.55 points.
  Failed requirements: meanGain, positiveLowerBound, contemporaneousTaste, stable_axes, interactions, missing_factor, isolated_noise, repeated_noise, biased_noise, weak_ratings, novel_preference, duplicate_evidence, metadata_matched, singleRatingSafety, largeLossFrequency, novelLearning, legacyHistoricalVerified, historicalGain, historicalDecline, historicalStep.
- confirmation/exception_recent: influence-confirmation-changing_taste-6, seed 53, observation 33, accurate rating, loss 19.49 points.
  Failed requirements: meanGain, positiveLowerBound, contemporaneousTaste, stable_axes, interactions, missing_factor, isolated_noise, repeated_noise, biased_noise, weak_ratings, novel_preference, duplicate_evidence, metadata_matched, singleRatingSafety, largeLossFrequency, novelLearning, legacyHistoricalVerified, historicalGain, historicalDecline, historicalStep.
- confirmation/additive_recent: influence-confirmation-changing_taste-6, seed 53, observation 33, accurate rating, loss 24.01 points.
  Failed requirements: meanGain, positiveLowerBound, worstTenth, contemporaneousTaste, stable_axes, interactions, missing_factor, isolated_noise, repeated_noise, biased_noise, weak_ratings, novel_preference, duplicate_evidence, metadata_matched, singleRatingSafety, largeLossFrequency, novelLearning, legacyHistoricalVerified, historicalGain, historicalDecline, historicalStep.

Every candidate fails measured synthetic requirements independently of the pending legacy historical check.
Five archived synthetic histories test historical mechanisms with the previous numerical protection thresholds.
Their replay override leaves mistake labels as placeholders. The diagnostic record restores original labels and independently checks every historical ranking measurement.
They do not replace the existing five historical real-data failures. Candidate protection on those histories remains unverified under the synthetic-only scope.
That requirement remains mandatory before adoption. Existing product regressions check prior frozen outcomes without changing earlier records.

## Representation limits and verification

The [diagnostic record](rating-influence-v1-diagnostics.json) lists feature collisions, full metadata collisions, and novel-region intervals.
Opposite preferences on identical non-identity metadata require unavailable information for unseen titles.
Narrow matching cannot separate those titles. Feature collisions with different metadata can instead indicate information lost by the representation.
Missing-factor outcomes remain in the overall averages and group requirements.

- [development trace manifest](rating-influence-v1-development.json) and [independent verification](rating-influence-v1-development-verification.json).
- [sealed trace manifest](rating-influence-v1-sealed.json) and [independent verification](rating-influence-v1-sealed-verification.json).
- [confirmation trace manifest](rating-influence-v1-confirmation.json) and [independent verification](rating-influence-v1-confirmation-verification.json).
- [Unchanged default regressions](rating-influence-regression-v1.json).

Independent reconstruction reproduces every supplied rating, published score, ranking measurement, ordering check, and adoption decision.
Encrypted round trips, overwrite, removal, original timestamps, read-only scoring, and candidate restoration pass.
The current scorer retains its known storage-order and restoration sensitivity. Candidate verification does not conceal that baseline limitation.
No candidate enters the shared domain scorer. No new baseline replaces the preserved corroboration records.

## Next bounded investigation

Test whether cosine matching misses preference direction in public metadata before adding further evidence guards.
Develop one small supervised map from existing axes and public tags to observed ratings, with fixed regularization.
Use synthetic matched pairs with one public distinguishing signal, plus pairs whose difference remains private.
Measure accurate novel learning and damage to existing preferences separately, including claim-only and matching-only replays.
Develop the representation on fresh development people, then freeze any candidate before another independent adoption trial.
Keep question selection and shared contexts deferred.
