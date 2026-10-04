# Experiment 4.5: question coverage and confirmed claims

Decision: **do_not_promote**. Broader personal-lens questions do not pass every fresh sealed discovery, learning, and control gate.

The replay contains 438 people and 876 sessions. Only fresh synthetic sealed cohorts support confirmation gates.

## Understand the comparison

Experiment 4 found strong synthetic gains, but book-rule recovery reached only 40%. Its personal features also outweighed native confirmed claims.

Experiment 4.5 asks supported-pattern questions without a cosine eligibility threshold. Native and matched-strength controls separate discovery, feedback authority, and score strength.

| Arm | Behavior |
| --- | --- |
| inferred | Current scorer and inferred claims after 40 ratings. |
| narrow_personal | Experiment 4 queue and personal contribution. |
| broad_personal | Broad queue and personal contribution. |
| broad_native_claims | Same broad answers; confirm only claims already inferred. |
| broad_authored_claims | Same answers; add missing claims through the existing claim language and native scoring. |
| broad_shared | Personal contribution for predicates with identical claim semantics. |
| broad_claims_equal_strength | Existing claim matching with the same contribution and cap as broad_shared. |

Shared predicates exclude decades and axes. Claims cannot represent decades; their axis threshold is 0.3 rather than 0.35.

All broad arms receive identical questions and answers. Rejection does not imply missing metadata; only an unknown-factor answer creates a limitation.

## Read the frozen gates

Broader questions must improve recovery by ten percentage points and pass learning, efficiency, protection, correction, and portability gates in both fresh sealed domains.

- synthetic_movies_sealed: broaderLearning.
- synthetic_books_sealed: correction.

## Fresh sealed learning

Gain intervals use a viewer bootstrap after averaging both sessions per person. Scores compare with current inferred claims.

| Domain | Arm | AUC | Gain (points) | Gain over narrow (points) | Worst tenth | nDCG10 |
| --- | --- | --- | --- | --- | --- | --- |
| synthetic_movies_sealed | inferred | 64.25% | +0.00 [+0.00, +0.00] | -20.48 [-27.10, -13.92] | 47.21% | 0.6884 |
| synthetic_movies_sealed | narrow_personal | 84.73% | +20.48 [+13.93, +27.13] | +0.00 [+0.00, +0.00] | 54.65% | 0.8501 |
| synthetic_movies_sealed | broad_personal | 86.35% | +22.10 [+15.34, +29.07] | +1.62 [+0.00, +4.11] | 54.65% | 0.8710 |
| synthetic_movies_sealed | broad_shared | 78.82% | +14.57 [+8.29, +21.12] | -5.91 [-11.97, -0.94] | 47.38% | 0.8097 |
| synthetic_movies_sealed | broad_native_claims | 65.11% | +0.86 [+0.50, +1.26] | -19.62 [-26.08, -13.27] | 47.38% | 0.6972 |
| synthetic_movies_sealed | broad_authored_claims | 65.11% | +0.86 [+0.50, +1.26] | -19.62 [-26.08, -13.27] | 47.38% | 0.6972 |
| synthetic_movies_sealed | broad_claims_equal_strength | 78.82% | +14.57 [+8.29, +21.12] | -5.91 [-11.97, -0.94] | 47.38% | 0.8097 |
| synthetic_books_sealed | inferred | 61.64% | +0.00 [+0.00, +0.00] | -11.80 [-18.80, -5.35] | 48.53% | 0.7002 |
| synthetic_books_sealed | narrow_personal | 73.44% | +11.80 [+5.38, +18.81] | +0.00 [+0.00, +0.00] | 48.53% | 0.7804 |
| synthetic_books_sealed | broad_personal | 91.39% | +29.75 [+22.19, +37.46] | +17.95 [+9.38, +27.32] | 54.40% | 0.8998 |
| synthetic_books_sealed | broad_shared | 80.21% | +18.57 [+11.18, +26.30] | +6.77 [+1.53, +13.44] | 48.53% | 0.8278 |
| synthetic_books_sealed | broad_native_claims | 63.24% | +1.60 [+0.98, +2.31] | -10.20 [-16.73, -4.08] | 48.53% | 0.7184 |
| synthetic_books_sealed | broad_authored_claims | 63.27% | +1.63 [+1.01, +2.32] | -10.17 [-16.72, -4.06] | 48.53% | 0.7201 |
| synthetic_books_sealed | broad_claims_equal_strength | 80.21% | +18.57 [+11.18, +26.30] | +6.77 [+1.53, +13.44] | 48.53% | 0.8278 |

## Separate feedback from language expansion

Native existing claims retain their evidence confidence and scoring caps. The authored control bypasses the inference cutoff but retains the existing claim language.

Matched-strength claims use 0.3 contributions capped at 0.6. Their shared predicates must reproduce shared personal scores exactly.

| Domain | Personal gain over native authored | Personal gain over shared | Matched-strength scores equal | Language-expansion gate |
| --- | --- | --- | --- | --- |
| synthetic_movies_sealed | +21.24 [+14.65, +28.05] | +7.53 [+1.90, +14.34] | true | true |
| synthetic_books_sealed | +28.12 [+20.73, +35.82] | +11.19 [+3.81, +19.91] | true | true |

The language-expansion gate requires positive lower bounds against both controls and at least two points over the shared arm.

## Inspect discovery and interaction cost

The personal arm receives 40 ratings and at most ten prompts. The separate rating control receives 50 ratings when training evidence permits.

| Cohort | People | Broad recovery | Narrow recovery | Mean broad prompts | Gain over 50 ratings | Native applied/unavailable |
| --- | --- | --- | --- | --- | --- | --- |
| original | 31 | unknown | unknown | 9.52 | -1.22 [-2.80, +0.31] | 0/0 |
| confirmation | 47 | unknown | unknown | 7.02 | -0.61 [-1.76, +0.52] | 0/0 |
| override | 30 | unknown | unknown | 6.83 | -0.25 [-1.50, +1.01] | 0/0 |
| hard | 18 | unknown | unknown | 7.78 | -3.09 [-6.46, -0.39] | 0/0 |
| refine_regression | 72 | unknown | unknown | 10.00 | -1.33 [-1.95, -0.71] | 0/0 |
| questions_regression | 72 | unknown | unknown | 9.93 | -0.91 [-1.45, -0.43] | 0/0 |
| lens4_movies_regression | 36 | 90.00% | 78.33% | 2.42 | +22.97 [+17.33, +28.90] | 40/14 |
| lens4_books_regression | 36 | 100.00% | 40.00% | 2.50 | +29.42 [+23.19, +36.06] | 45/15 |
| synthetic_movies_development | 24 | 100.00% | 77.50% | 2.50 | +22.27 [+15.08, +29.65] | 28/12 |
| synthetic_movies_sealed | 24 | 100.00% | 77.50% | 2.50 | +21.98 [+15.11, +28.96] | 28/12 |
| synthetic_books_development | 24 | 97.50% | 40.00% | 2.48 | +27.09 [+19.61, +35.14] | 31/8 |
| synthetic_books_sealed | 24 | 100.00% | 40.00% | 2.50 | +30.34 [+22.07, +38.75] | 30/10 |

Recorded people with fewer than 50 training ratings do not enter equal-budget comparisons. Unknown-factor people do not enter represented-rule recovery.

## Inspect fresh rule types

The rule-type table combines fresh development and sealed people. Use it to diagnose coverage, not to claim independent confirmation.

| Rule | People | Broad recovery | Narrow recovery | AUC gain |
| --- | --- | --- | --- | --- |
| tag | 16 | 100.00% | 100.00% | +36.53 [+34.80, +38.06] |
| interaction | 16 | 100.00% | 100.00% | +31.70 [+29.14, +34.16] |
| creator | 16 | 96.88% | 50.00% | +30.58 [+23.23, +38.67] |
| decade | 16 | 100.00% | 43.75% | +47.35 [+41.07, +53.84] |
| axis | 16 | 100.00% | 0.00% | +7.50 [+4.75, +9.99] |
| unknown | 16 | unknown | unknown | +0.00 [+0.00, +0.00] |

## Inspect correction and portability

Correction reverses the first confirmed feature. The source-pair test scores aliases with identical metadata because rated items leave recommendation lists.

| Cohort | Scoring arm | Corrected pairs reversed | Direction improved | Unrelated scores stable |
| --- | --- | --- | --- | --- |
| synthetic_movies_sealed | broad_personal | 36/40 | 40/40 | true |
| synthetic_movies_sealed | broad_shared | 24/24 | 24/24 | true |
| synthetic_movies_sealed | broad_native_claims | 9/28 | 13/28 | true |
| synthetic_movies_sealed | broad_authored_claims | 9/32 | 14/32 | true |
| synthetic_movies_sealed | broad_claims_equal_strength | 24/24 | 24/24 | true |
| synthetic_books_sealed | broad_personal | 26/40 | 40/40 | true |
| synthetic_books_sealed | broad_shared | 18/24 | 24/24 | true |
| synthetic_books_sealed | broad_native_claims | 8/30 | 14/30 | true |
| synthetic_books_sealed | broad_authored_claims | 8/32 | 14/32 | true |
| synthetic_books_sealed | broad_claims_equal_strength | 18/24 | 24/24 | true |

Every broad profile exports through the encrypted dossier codec. Imported profiles must reproduce feedback and scores in every broad arm.

- original: encrypted roundtrip true; matched-strength equality true; limitation cap true.
- confirmation: encrypted roundtrip true; matched-strength equality true; limitation cap true.
- override: encrypted roundtrip true; matched-strength equality true; limitation cap true.
- hard: encrypted roundtrip true; matched-strength equality true; limitation cap true.
- refine_regression: encrypted roundtrip true; matched-strength equality true; limitation cap true.
- questions_regression: encrypted roundtrip true; matched-strength equality true; limitation cap true.
- lens4_movies_regression: encrypted roundtrip true; matched-strength equality true; limitation cap true.
- lens4_books_regression: encrypted roundtrip true; matched-strength equality true; limitation cap true.
- synthetic_movies_development: encrypted roundtrip true; matched-strength equality true; limitation cap true.
- synthetic_movies_sealed: encrypted roundtrip true; matched-strength equality true; limitation cap true.
- synthetic_books_development: encrypted roundtrip true; matched-strength equality true; limitation cap true.
- synthetic_books_sealed: encrypted roundtrip true; matched-strength equality true; limitation cap true.

## Confidence and coverage

Confidence remains an uncalibrated proxy. Error burden measures confident misorders among all positive-negative held-out pairs.

| Cohort | Inferred error burden | Broad error burden | Inferred confident coverage | Broad confident coverage |
| --- | --- | --- | --- | --- |
| original | 4.24% | 4.24% | 10.53% | 10.53% |
| confirmation | 10.79% | 10.79% | 26.03% | 26.03% |
| override | 14.62% | 14.62% | 30.56% | 30.56% |
| hard | 4.15% | 4.15% | 19.47% | 19.47% |
| refine_regression | 1.97% | 1.97% | 26.56% | 26.56% |
| questions_regression | 1.77% | 1.77% | 26.09% | 26.09% |
| lens4_movies_regression | 6.55% | 1.41% | 15.87% | 29.20% |
| lens4_books_regression | 1.70% | 0.12% | 3.21% | 13.62% |
| synthetic_movies_development | 4.41% | 1.53% | 21.16% | 36.81% |
| synthetic_movies_sealed | 5.50% | 1.79% | 21.36% | 39.80% |
| synthetic_books_development | 0.29% | 0.05% | 1.09% | 8.16% |
| synthetic_books_sealed | 0.24% | 0.13% | 0.83% | 9.57% |

## Preserve interpretation limits

- Synthetic confirmers have exact knowledge of one causal rule and no response noise.
- Invented metadata collisions are a targeted stress test, not a representative catalogue.
- No new human confirmation cohort; real users cannot supply causal rule labels.
- Unknown preferences are absent from metadata and cannot be recovered.
- Confidence is a proxy, not a probability.
- Frozen-catalogue ranking does not test retrieval.
- The generic rule language supports at most two predicates and a bounded additive contribution.
- Exact synthetic explanations cannot establish human benefit.
- Threshold differences prevent clean axis attribution; shared controls exclude axes.
- Native existing-claim availability can limit its control, so a native authored-claim arm tests the same language without the inference cutoff.
- The study retains one main synthetic rule and does not establish robustness to misleading confirmations.

Synthetic people know an exact causal rule. Their answers do not establish whether real people understand, trust, or reliably confirm the questions.

Recorded cohorts answer none because causal explanations are unavailable. Their results provide regressions rather than evidence of human benefit.

## Reproduce experiment 4.5

Run `pnpm lab:personal-lens-45` from the repository root. The original experiment 4 protocol and reports remain intact.

Protocol SHA-256: `baa773918929824eae321f51c98759779ddbfb1b97c40ff63b179d6f353d495f`.

Model SHA-256: `1f6734fb54aaf5f7c03f27c1730bf3cb66e52675ef55ef221088101a2aca0f38`.

Evaluator SHA-256: `44b0c3cc07c96278d745b95cb76c611e6b7eb6a02aa105abd28381b368d81cd7`.
