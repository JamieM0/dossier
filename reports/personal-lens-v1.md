# Personal lens: experiment 4

Decision: **do_not_promote**. The personal lens did not pass every frozen learning, control, and coverage gate in both sealed domains.

The CLI replay contains 342 people and 684 sessions. Product defaults retain the current geometry, scorer, and question queue.

## Earlier experiments

Experiment 1 removed rating-order dependence, but both candidates failed quality and viewer-protection gates.

Experiment 2 found no reliable gain from learned comparison weights. Correction often moved scores without reversing the requested order.

Experiment 3 found no question policy that passed every learning, protection, and stopping gate. Its uncertainty proxies missed representation limits.

Experiment 4 therefore retains the current model. It adds explicit personal distinctions rather than promoting any earlier candidate.

## Frozen decision gates

Both sealed domains must pass every gate. A passing experiment supports human confirmation; it does not authorize a default change.

- synthetic_movies_sealed: all gates passed.
- synthetic_books_sealed: ruleRecovery.

## Learning after ten distinction prompts

Repeated sessions average within each person before the viewer bootstrap. Gains compare with current inferred claims after 40 ratings.

| Cohort | People | Arm | AUC | Gain, 95% interval (points) | Worst tenth | nDCG10 | Individual losses |
| --- | --- | --- | --- | --- | --- | --- | --- |
| original | 31 | fixed | 55.98% | -1.51 [-2.54, -0.52] | 42.09% | 0.3589 | 23 |
| original | 31 | inferred | 57.49% | +0.00 [+0.00, +0.00] | 46.59% | 0.3788 | 0 |
| original | 31 | personal | 57.49% | +0.00 [+0.00, +0.00] | 46.59% | 0.3788 | 0 |
| confirmation | 47 | fixed | 60.13% | -0.81 [-1.51, -0.17] | 47.43% | 0.4294 | 28 |
| confirmation | 47 | inferred | 60.94% | +0.00 [+0.00, +0.00] | 46.03% | 0.4329 | 0 |
| confirmation | 47 | personal | 60.94% | +0.00 [+0.00, +0.00] | 46.03% | 0.4329 | 0 |
| override | 30 | fixed | 55.00% | -1.19 [-2.68, +0.04] | 39.59% | 0.4157 | 14 |
| override | 30 | inferred | 56.20% | +0.00 [+0.00, +0.00] | 42.58% | 0.4305 | 0 |
| override | 30 | personal | 56.20% | +0.00 [+0.00, +0.00] | 42.58% | 0.4305 | 0 |
| hard | 18 | fixed | 74.90% | -2.32 [-4.19, -0.70] | 40.59% | 0.5201 | 13 |
| hard | 18 | inferred | 77.23% | +0.00 [+0.00, +0.00] | 43.42% | 0.5480 | 0 |
| hard | 18 | personal | 77.23% | +0.00 [+0.00, +0.00] | 43.42% | 0.5480 | 0 |
| refine_regression | 72 | fixed | 85.82% | -1.67 [-2.21, -1.14] | 74.38% | 0.6048 | 57 |
| refine_regression | 72 | inferred | 87.49% | +0.00 [+0.00, +0.00] | 76.79% | 0.6327 | 0 |
| refine_regression | 72 | personal | 87.49% | +0.00 [+0.00, +0.00] | 76.79% | 0.6327 | 0 |
| questions_regression | 72 | fixed | 87.23% | -1.62 [-2.18, -1.09] | 79.01% | 0.6257 | 56 |
| questions_regression | 72 | inferred | 88.85% | +0.00 [+0.00, +0.00] | 80.71% | 0.6401 | 0 |
| questions_regression | 72 | personal | 88.85% | +0.00 [+0.00, +0.00] | 80.71% | 0.6401 | 0 |
| synthetic_movies_development | 24 | fixed | 54.72% | -4.81 [-7.86, -2.06] | 30.39% | 0.5954 | 15 |
| synthetic_movies_development | 24 | inferred | 59.53% | +0.00 [+0.00, +0.00] | 39.19% | 0.6532 | 0 |
| synthetic_movies_development | 24 | personal | 82.45% | +22.91 [+15.79, +30.20] | 50.00% | 0.8940 | 0 |
| synthetic_movies_sealed | 12 | fixed | 53.94% | -5.58 [-8.73, -2.59] | 24.51% | 0.5351 | 8 |
| synthetic_movies_sealed | 12 | inferred | 59.52% | +0.00 [+0.00, +0.00] | 29.04% | 0.6547 | 0 |
| synthetic_movies_sealed | 12 | personal | 82.09% | +22.57 [+12.54, +33.13] | 47.44% | 0.8544 | 0 |
| synthetic_books_development | 24 | fixed | 55.60% | -4.24 [-7.00, -1.60] | 42.80% | 0.5658 | 15 |
| synthetic_books_development | 24 | inferred | 59.84% | +0.00 [+0.00, +0.00] | 44.43% | 0.5977 | 0 |
| synthetic_books_development | 24 | personal | 72.24% | +12.40 [+5.95, +19.97] | 44.43% | 0.7100 | 0 |
| synthetic_books_sealed | 12 | fixed | 54.81% | -5.21 [-8.58, -1.96] | 39.84% | 0.5558 | 9 |
| synthetic_books_sealed | 12 | inferred | 60.02% | +0.00 [+0.00, +0.00] | 40.73% | 0.6062 | 0 |
| synthetic_books_sealed | 12 | personal | 71.92% | +11.90 [+2.93, +21.20] | 40.73% | 0.7018 | 0 |

## Interaction cost and personal control

The rating control receives 50 ratings. The personal arm receives 40 ratings and at most ten distinction prompts.

| Cohort | Mean prompts | Mean confirmed features | Gain over 50 ratings (points) | Rule recovery | Corrected pairs reversed | Largest prompt loss (points) |
| --- | --- | --- | --- | --- | --- | --- |
| original | 0.92 | 0.00 | -1.22 [-2.80, +0.31] | unknown | 0/0 | +0.00 |
| confirmation | 0.90 | 0.00 | -0.61 [-1.76, +0.52] | unknown | 0/0 | +0.00 |
| override | 0.98 | 0.00 | -0.25 [-1.50, +1.01] | unknown | 0/0 | +0.00 |
| hard | 2.58 | 0.00 | -3.09 [-6.46, -0.39] | unknown | 0/0 | +0.00 |
| refine_regression | 1.19 | 0.00 | -1.33 [-1.95, -0.71] | unknown | 0/0 | +0.00 |
| questions_regression | 1.38 | 0.00 | -0.91 [-1.45, -0.43] | unknown | 0/0 | +0.00 |
| synthetic_movies_development | 7.25 | 0.67 | +22.24 [+15.23, +29.62] | 80.00% | 32/32 | +0.00 |
| synthetic_movies_sealed | 6.96 | 0.63 | +22.87 [+12.92, +33.52] | 75.00% | 15/15 | +0.00 |
| synthetic_books_development | 3.77 | 0.33 | +12.01 [+5.43, +19.06] | 40.00% | 16/16 | +0.00 |
| synthetic_books_sealed | 4.04 | 0.33 | +11.15 [+3.01, +20.02] | 40.00% | 8/8 | +0.00 |

Recorded viewers with fewer than 50 training ratings do not enter equal-budget comparisons. The JSON records eligible person counts.

## Representation and rule recovery

Each new synthetic person has one main causal preference. Recovery requires confirmation of its exact predicate and effect.

| Rule type | People | AUC gain (points) | Rule recovery | Question coverage | Mean features |
| --- | --- | --- | --- | --- | --- |
| tag | 12 | +36.94 [+35.62, +38.20] | 100.00% | 100.00% | 1.00 |
| interaction | 12 | +31.18 [+28.07, +34.08] | 100.00% | 100.00% | 1.00 |
| creator | 12 | +20.47 [+8.26, +33.73] | 45.83% | 45.83% | 0.46 |
| decade | 12 | +16.52 [+7.07, +26.27] | 50.00% | 50.00% | 0.50 |
| axis | 12 | +0.00 [+0.00, +0.00] | 0.00% | 0.00% | 0.00 |
| unknown | 12 | +0.00 [+0.00, +0.00] | unknown | 100.00% | 0.00 |

## Confidence and explanations

Confidence is an uncalibrated proxy. Choosing none caps confidence near the rated pair without changing its recommendation scores.

Error burden counts misordered positive-negative pairs among all held-out pairs. Coverage counts pairs where both items receive high confidence.

Reduced error burden can result from withholding confidence. Read it together with coverage and AUC.

| Cohort | Inferred error burden | Personal error burden | Inferred confident coverage | Personal confident coverage | Mean personal confidence |
| --- | --- | --- | --- | --- | --- |
| original | 4.24% | 4.24% | 10.53% | 10.53% | 0.698 |
| confirmation | 10.79% | 10.74% | 26.03% | 25.92% | 0.762 |
| override | 14.62% | 14.60% | 30.56% | 30.53% | 0.768 |
| hard | 4.15% | 4.15% | 19.47% | 19.47% | 0.799 |
| refine_regression | 1.97% | 1.97% | 26.56% | 26.52% | 0.788 |
| questions_regression | 1.77% | 1.76% | 26.09% | 26.04% | 0.779 |
| synthetic_movies_development | 5.31% | 1.25% | 15.78% | 25.37% | 0.744 |
| synthetic_movies_sealed | 9.04% | 2.68% | 16.07% | 26.39% | 0.757 |
| synthetic_books_development | 1.71% | 1.56% | 2.87% | 5.61% | 0.689 |
| synthetic_books_sealed | 1.67% | 1.59% | 3.87% | 5.62% | 0.686 |

Every reported feature explanation names a predicate that matches the item. This tests mechanical fidelity, not human comprehension.

Recorded users cannot supply causal explanations. Their evaluator answers none; unchanged ranking does not establish benefit for real users.

## Portability and verification

Every session exports an encrypted dossier and imports it through the CLI. The evaluator requires identical personal features, limitations, and scores.

- original: encrypted roundtrip true; limitation cap true; tested removal false; explanation precision 100.00%.
- confirmation: encrypted roundtrip true; limitation cap true; tested removal false; explanation precision 100.00%.
- override: encrypted roundtrip true; limitation cap true; tested removal false; explanation precision 100.00%.
- hard: encrypted roundtrip true; limitation cap true; tested removal false; explanation precision 97.22%.
- refine_regression: encrypted roundtrip true; limitation cap true; tested removal false; explanation precision 100.00%.
- questions_regression: encrypted roundtrip true; limitation cap true; tested removal false; explanation precision 100.00%.
- synthetic_movies_development: encrypted roundtrip true; limitation cap true; tested removal true; explanation precision 100.00%.
- synthetic_movies_sealed: encrypted roundtrip true; limitation cap true; tested removal true; explanation precision 100.00%.
- synthetic_books_development: encrypted roundtrip true; limitation cap true; tested removal true; explanation precision 100.00%.
- synthetic_books_sealed: encrypted roundtrip true; limitation cap true; tested removal true; explanation precision 100.00%.

Removal tests run only when a feature exists. A cohort with no features reports false for tested removal.

## Interpretation limits

- Synthetic confirmers have exact knowledge of one causal rule and no response noise.
- Invented metadata collisions are a targeted stress test, not a representative catalogue.
- No new human confirmation cohort; real users cannot supply causal rule labels.
- Unknown preferences are absent from metadata and cannot be recovered.
- Confidence is a proxy, not a probability.
- Frozen-catalogue ranking does not test retrieval.
- The generic rule language supports at most two predicates and a bounded additive contribution.

Synthetic users identify exact offered rules. Real people may give incomplete, mistaken, or changing explanations.

The invented books domain uses generic predicates and vectors through an offline CLI adapter. It does not implement books in the product.

None records a limitation around feature similarity. Broad caps can reduce useful confidence across unrelated metadata distinctions.

## Reproduce the experiment

Run `pnpm lab:personal-lens` from the repository root. The frozen protocol records fixture hashes, budgets, candidate settings, and gates.

Protocol SHA-256: `5be200ef8e6d87a658d4f40de2f3f3f3855f09aa6623bebdc90070c4795cb40d`.

Model SHA-256: `e4c4e7e848c3395b16b5070de7ad12850edc89dfbfe9b145d62a716719f75f35`.

Evaluator SHA-256: `805eb1b7630318f4d44c75cfdcf4b497106b5f77bde1dfc407fa90454e57f7ed`.
