# Experiment 5: contextual taste

Decision: **do_not_promote**. The shared context candidate fails at least one frozen confirmation gate. Retain experiment status.

The CLI replay covers 534 people and 1068 sessions. Repeated sessions average within each person before bootstrap uncertainty estimates.

Protocol: `contextual-taste-v1`. Model fingerprint: `688b45ec5db8ad6d66901470cfabc4a8b39ea5c65a09a635715416db73c2f7c6`.

## Compare context ranking

AUC measures positive-versus-negative held-out ordering. Context results average four contexts within each person. Values use percentage points.

| Cohort | People | Global | Recency | Separate | Shared | Shared gain over global, 95% interval |
| --- | --- | --- | --- | --- | --- | --- |
| original | 31 | 57.50 | 57.50 | 57.50 | 57.50 | 0.00 [0.00, 0.00] |
| confirmation | 47 | 60.94 | 60.94 | 60.94 | 60.94 | 0.00 [0.00, 0.00] |
| override | 30 | 56.23 | 56.23 | 56.23 | 56.23 | 0.00 [0.00, 0.00] |
| hard | 18 | 77.48 | 77.48 | 77.48 | 77.48 | 0.00 [0.00, 0.00] |
| refine_regression | 72 | 87.49 | 87.49 | 87.49 | 87.49 | 0.00 [0.00, 0.00] |
| questions_regression | 72 | 88.85 | 88.85 | 88.85 | 88.85 | 0.00 [0.00, 0.00] |
| lens4_regression | 72 | 59.69 | 59.69 | 59.69 | 59.69 | 0.00 [0.00, 0.00] |
| synthetic_movies_development | 24 | 77.21 | 75.97 | 85.35 | 75.01 | -2.19 [-9.22, 4.59] |
| synthetic_movies_sealed | 24 | 76.71 | 76.70 | 84.45 | 73.91 | -2.79 [-9.39, 2.61] |
| synthetic_books_development | 24 | 71.24 | 69.49 | 77.36 | 81.39 | 10.15 [5.82, 14.86] |
| synthetic_books_sealed | 24 | 72.13 | 70.52 | 77.94 | 82.05 | 9.93 [5.94, 14.34] |
| lens45_regression | 96 | 62.38 | 62.38 | 62.38 | 62.38 | 0.00 [0.00, 0.00] |

## Compare mechanisms

Mechanism summaries pool fresh development and sealed people. They explain behavior without providing separate confirmation.

| Type | People | Global | Recency | Separate | Shared | Shared gain over separate, 95% interval |
| --- | --- | --- | --- | --- | --- | --- |
| axis_switch | 16 | 73.06 | 71.25 | 93.03 | 90.31 | -2.72 [-10.40, 3.60] |
| interaction_switch | 16 | 51.70 | 51.28 | 75.45 | 61.43 | -14.02 [-20.83, -8.16] |
| stable | 16 | 98.26 | 95.63 | 93.93 | 98.92 | 4.99 [3.06, 6.95] |
| drift | 16 | 91.46 | 94.23 | 90.88 | 77.51 | -13.37 [-24.60, -3.94] |
| sparse | 16 | 70.38 | 66.76 | 77.51 | 79.21 | 1.71 [-5.28, 7.84] |
| hidden_switch | 16 | 61.05 | 59.87 | 56.84 | 61.17 | 4.32 [3.00, 5.71] |

## Inspect confirmation gates

Each fresh sealed domain must pass every gate. Failed gates retain the candidate as an experiment.

| Gate | Movies | Books |
| --- | --- | --- |
| contextGain | false | true |
| beatsRecency | true | true |
| worstDecile | true | true |
| stableTaste | true | true |
| sparseTransfer | false | true |
| updateSafety | false | false |
| correction | true | true |
| claimPrecision | true | false |
| roundtrip | true | true |
| globalClaimsStable | true | true |
| scopeIsolation | true | true |
| clearRestores | true | true |
| removeRestores | true | true |
| deterministic | true | true |
| globalDefaultStable | true | true |

## Inspect learning and protection

These checkpoints count ratings per context. Sparse people can supply fewer ratings; terminal profiles remain at later checkpoints.

| Cohort | Ratings per context | Shared AUC | nDCG@10 | Shared p10 | Individual losses against global |
| --- | --- | --- | --- | --- | --- |
| synthetic_movies_sealed | 0 | 65.68 | 45.75 | 39.66 | 0 |
| synthetic_movies_sealed | 1 | 65.68 | 45.75 | 39.66 | 15 |
| synthetic_movies_sealed | 3 | 66.64 | 46.68 | 40.39 | 13 |
| synthetic_movies_sealed | 5 | 67.43 | 46.93 | 46.17 | 12 |
| synthetic_movies_sealed | 10 | 70.45 | 50.18 | 51.30 | 13 |
| synthetic_movies_sealed | 20 | 73.91 | 54.67 | 52.57 | 11 |
| synthetic_books_sealed | 0 | 61.46 | 43.08 | 28.40 | 0 |
| synthetic_books_sealed | 1 | 61.46 | 43.08 | 28.40 | 11 |
| synthetic_books_sealed | 3 | 63.89 | 46.86 | 33.43 | 9 |
| synthetic_books_sealed | 5 | 66.85 | 49.84 | 40.50 | 9 |
| synthetic_books_sealed | 10 | 74.17 | 58.56 | 61.15 | 7 |
| synthetic_books_sealed | 20 | 82.05 | 69.67 | 63.21 | 3 |

## Inspect user control

Claims carry explicit global or context scope. Confidence remains an uncalibrated claim proxy. Recommendation evidence reports no probability.

| Cohort | Largest single-rating decline | Directional corrections | Scoped claim precision | Export/import | Scope isolation |
| --- | --- | --- | --- | --- | --- |
| synthetic_movies_sealed | -6.25 | 48/48 | 68.45 | true | true |
| synthetic_books_sealed | -6.23 | 48/48 | 55.49 | true | true |

## Preserve evidence limits

- Fresh cohorts provide synthetic confirmation only.
- Synthetic movies reuse the existing descriptive lens; books use invented vectors.
- Residuals cannot learn metadata interactions or absent factors.
- Contexts are supplied correctly; context discovery and prompt cost are not tested.
- Global anchoring deliberately trades pooled learning for scope stability.
- Recorded people have no context labels; they support no-context regressions only.

Shared taste uses explicitly global ratings as its base. Context ratings change only their own residual and scoped claims.

A new context inherits the shared base. Separate profiles provide no recommendations before they contain a positive rating.

The residual uses ridge regression over the existing axes. It does not add the rejected geometry, Refine, question, or personal-lens candidates.

Public scores remain absent from every experimental scoring arm. Recorded people provide no-context regression evidence only.

Read the JSON for every checkpoint, supplied rating, claim, correction, and portability result. Product defaults remain unchanged.
