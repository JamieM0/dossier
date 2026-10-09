# Recommendation progress

Use this review to decide which work remains after the correction commits and completed learning experiments.
Jamie is the only real product user. The synthetic lab supplies the primary model evidence.

## Commit review

| Commits | Completed work | Recommendation satisfied |
| --- | --- | --- |
| `669fc82` | Evidence presentation, application rating replay, and frozen preparation reference | Clarify evidence, reproduce actual library behavior, and preserve the original baseline |
| `afae388`, `041dd4c` | Effective correction protocol, complete replay, and rejection decision | Test general preferences, title exceptions, and direct comparisons separately |
| `79e069d`, `e4b7289` | Evidence previews, follow-up review, fresh synthetic people, and rejection decision | Test protection against misleading explanations and preserve useful control |
| `6c4b37b`, `a40bb9b`, `09b3e82` | Limited influence, narrow controls, stress cases, and rejection | Test useful corrections alongside recommendation protection |

The typing correction in `a40bb9b` preserves the emitted scorer exactly.
The complete correction experiments retain ordinary recommendation defaults and previous experiment archives.

## What the correction results establish

Exact title and comparison controls work in the experimental policies.
Strong broad influence improves average ranking but permits severe losses after misleading explanations.
Scaled influence reduces observed losses and preserves control, but retains too little useful learning.
Experiment eight's scaled guard gains 1.10 ranking points, against the required two points.
Its largest observed answer loss falls to 2.48 points.
No correction candidate earns adoption under its frozen requirements.

The strengthened synthetic people include interacting rules, exceptions, missing information, inaccurate explanations, weak ratings, and changing taste.
They also include persistent misleading explanations and biased evidence that appears convincing.
Question recognition and human effort remain separate limits.
Historical MovieLens records supply additional evidence. Those participants did not use Dossier.

## New work completed

The reviewed commits omit the separate learning-stability experiment.
Experiment nine tests direct local evidence and recency against current scoring and both earlier deterministic grouping candidates.
The complete replay covers 120 synthetic people and 240 sessions, including 60 reserved people.
Local evidence gains 2.63 ranking points. Recent local evidence gains 5.10 points.
Both remove scorer order dependence, but neither passes update protection and all historical failure requirements.
The original recommendation defaults remain unchanged.
Its reserved requirements cover quality, large update losses, rating-order sensitivity, changing taste, and the five historical failures.
The experiment retains current inferred claims and measures their contribution to update losses separately.
A phase-aware diagnostic distinguishes correct learning of earlier taste from disagreement with future taste.
It preserves the frozen decision and identifies noisy updates as a continuing problem.

A new model baseline remains conditional on a successful candidate.
Combining successful correction and stability repairs also requires its own comparison before adoption.
Question selection and context work follow that decision, as originally recommended.
A failed stability candidate does not justify building later work on it.

Read the [stability protocol guide](../docs/learning-stability-experiment.md) for the new comparison.
Read the [impact correction decision](impact-correction-analysis-v1.md) for the latest completed correction outcome.

## Next decision

Experiment ten completes the recommended supporting-evidence investigation with 160 fresh synthetic people and 320 sessions.
It separates present taste and final adaptation, preserves explicit ratings, and includes 64 independent confirmation people.
The tested guards fail adoption in both reserved cohorts and generally increase disruptive updates against unguarded matching.
No new product baseline earns adoption.

Investigate how accurate novel ratings generalize and change the influence of previous evidence.
Keep timeless matching as the continuity comparison and recent matching as the adaptation comparison.
Preserve exact ratings, inspectable preferences, restoration, and historical failure checks.
Question selection and shared contexts remain deferred.

Read the [stability executive decision](learning-stability-analysis-v1.md) and [complete results](learning-stability-v1.md) for the measured tradeoffs.
Read the [latest learning progress](learning-progress-v2.md) and [corroboration decision](corroboration-analysis-v1.md) for the completed recommended actions.
Read the [verification record](learning-stability-verification-v1.json) and [default regressions](learning-stability-regression-v1.json) for completed checks.

## Verification and limits

Independent audits reconstruct 14,400 supplied ratings, 72,000 ranking measurements, and over two million local score contributions.
A repeated development person produces identical session traces. This does not claim two complete runs.
Shared type checks report no errors or warnings. Domain, CLI, and UI unit tests pass.
All 57 existing experiment audits pass. Historical ordinary recommendation outcomes remain identical.
The unchanged desktop LAN-pairing test times out after twenty seconds, matching the earlier recorded limitation.
Earlier experiment archives remain unchanged. The new report stores complete traces in a compressed archive.

GitHub rejects the planning draft because the credential lacks project access. It did not add a planning item.
