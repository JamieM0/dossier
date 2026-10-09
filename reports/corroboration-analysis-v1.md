# Corroboration decision

Keep Dossier's current scoring baseline. Do not adopt the tested supporting-evidence guards.
Jamie remains the only real product user. This decision uses synthetic people and historical regression evidence.

## Experiment and outcome

Experiment ten tests whether other supporting ratings can limit harmful generalization from one rating.
It compares seven policies across 160 fresh synthetic people and 320 sessions.
The cohort separates 32 development people, 64 selection people, and 64 independent confirmation people.
Confirmation uses different people from the same invented film catalogue.
Each session supplies sixty ratings under an equal evidence budget.

The policies guard matching alone or matching and inferred preferences, with and without recency.
The actors include accurate ratings, isolated mistakes, repeated mistakes, biased evidence, changing taste, and missing information.
Present-taste scoring compares both sides of each update against the same target.
Final adaptation remains a separate measurement.

| Policy | Selection gain, points | Confirmation gain, points | Confirmation large-loss frequency |
| --- | --- | --- | --- |
| Current | Reference | Reference | 0.92% |
| Local matching | +1.02 | +0.80 | 0.67% |
| Recent matching | +3.06 | +2.70 | 1.64% |
| Supported matching | +0.35 | +0.60 | 1.06% |
| Supported recent matching | +2.72 | +1.93 | 2.34% |
| Supported matching and claims | +0.27 | +0.58 | 1.11% |
| Supported recent matching and claims | +2.75 | +1.94 | 2.58% |

Accuracy measures how often a liked hidden film ranks ahead of a disliked film.
Large losses exceed five ranking points after the tenth rating, measured against contemporaneous taste.
These gains concern this cohort. They are not additive to experiment nine's gains.

Every supported candidate fails adoption in both reserved cohorts.
The guards generally reduce quality and increase disruptive updates against their unguarded counterparts.
No supported candidate repairs every historical failure or meets the single-update protection requirement.
The matching controls also exceed the update-loss limit and fail historical protection.

## What remains useful

Recency's adaptation benefit reproduces. Recent matching gains 15.87 points on changing confirmation people, with an interval from +7.29 to +26.43.
Timeless local matching reduces large-loss frequency against current scoring, but its worst confirmation update still loses 17.95 points.
Neither benefit establishes safe generalization.

The claim guard adds almost no average quality benefit over guarded matching alone.
Its confirmation increment for recent matching is 0.01 points, with an interval from minus 0.27 to +0.29.
The joint recent guard also loses 1.87 points on stable confirmation people, with an interval from minus 3.72 to minus 0.19.
Protecting useful stable preferences remains necessary alongside adaptation.

## Correct ratings can still disrupt learning

An exploratory replay diagnoses the joint timeless guard's largest confirmation loss.
The supplied rating is accurate, eight observations after an earlier injected mistake.

| Replay state | Accuracy |
| --- | --- |
| Before the correct rating | 80.00% |
| Add the title while retaining earlier evidence weights and effective claims | 71.05% |
| Recompute all evidence weights while retaining earlier effective claims | 61.92% |
| Apply the new effective claims | 61.81% |

Both direct matching and reweighting earlier evidence contribute substantially in this replay path.
The effective claim change contributes little to this selected loss.
Preserving earlier weights alone would still exceed the five-point protection limit.
This replay diagnoses one failure. It does not validate a replacement policy or establish a general causal split.

## Preserved controls

All explicit ratings, overwrite, removal, original timestamps, and encrypted portability checks pass.
The six local policies restore their published scores in all 320 sessions without resetting the original claims.
Stored claim records change in 269 sessions; those changes alone do not establish recommendation failures.
The current scorer's restored scores differ in 147 sessions, reflecting its existing order sensitivity.
All supported candidates produce identical scores across the eight storage-order permutations.
The product scorer and earlier complete traces remain unchanged.

## Project decision

Close this corroboration trial with a rejection decision. Retain its candidates and traces for comparison.
Use timeless matching as the continuity comparison and recent matching as the adaptation comparison.
Focus the next model investigation on how an accurate rating generalizes and changes the influence of previous evidence.
Use accurate novel preferences and metadata-matched liked and disliked titles to diagnose the matching representation.
Preserve exact ratings, reversibility, stable preferences, and independent confirmation in any later adoption trial.
Use fresh reserved people for a changed policy; do not tune this version against its completed cohorts.
Keep question selection and shared contexts deferred until a model earns a new baseline.
The current baseline remains a reference with known failures, rather than a completed learning solution.

Read the [complete results](corroboration-v1.md), [exploratory diagnostics](corroboration-diagnostics-v1.json), and [experiment guide](../docs/corroboration-experiment.md).
Read the [verification record](corroboration-verification-v1.json) and [default regressions](corroboration-regression-v1.json) for completed checks.
