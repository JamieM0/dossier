# Learning stability decision

Retain Dossier's current recommendation model. Local evidence earns further investigation, but neither new candidate meets every frozen adoption requirement.
Jamie is the only real product user. This decision uses the synthetic lab and historical regression evidence.

## Main outcomes

Experiment nine covers 120 synthetic people and 240 sessions. The adoption decision uses 60 reserved people.
Each session supplies sixty ratings, tests eight evidence orders, and checks overwrite, clearing, restoration, and encrypted portability.

| Policy | Reserved ranking accuracy | Gain and 95% interval, points | Largest measured update loss | Large-loss frequency |
| --- | --- | --- | --- | --- |
| Current | 76.35% | Reference | 16.86 points | 1.62% |
| Local evidence | 78.97% | +2.63 [+1.32, +4.07] | 13.20 points | 0.72% |
| Recent local evidence | 81.45% | +5.10 [+3.05, +7.73] | 17.79 points | 2.37% |

Ranking accuracy measures how often a liked hidden film ranks ahead of a disliked film.
Large losses exceed five ranking points after the tenth rating.
Intervals resample people after averaging their two sessions.

Both local candidates remove scorer order dependence and preserve the worst-performing tenth.
Timeless local evidence more than halves large-loss frequency, but its changing-taste protection remains uncertain.
Recent local evidence gains 19.52 points on changing people, with an interval from +11.67 to +28.92.
That adaptation also increases large-loss frequency across the full reserved cohort.

The earlier stable grouping candidates again fail adoption. Their gains reach 0.41 and 1.13 points.
Order independence alone does not establish useful learning or stable updates.

## Historical failures remain

The unchanged scorer reproduces all five original failure endpoints exactly.
Timeless local evidence improves three final endpoints but worsens two.
Recent local evidence improves two final endpoints but worsens three.
Neither repairs every known learning decline or meets the historical update-loss requirement.
These results prevent adoption independently of the changing-taste measurement limitation.

## Interpret changing taste correctly

The frozen learning curve evaluates the person's final taste throughout the session.
Changing people supply their earlier taste for thirty ratings, then their current taste.
Consequently, an accurate early rating can reduce agreement with a future preference.
This metric measures progress toward final taste, rather than satisfaction at every moment.

The largest timeless loss occurs at rating 21, before the simulated change.
Accuracy against final taste falls from 50.15% to 36.95%.
Accuracy against the taste supplying that rating rises from 80.08% to 83.81%.
Calling this particular update harmful to the person's current taste would misinterpret the evidence.

The recorded decision and requirements remain unchanged.
An exploratory audit scores every reserved update against the taste supplying its evidence.
It compares both sides of each update against the same target, including the preference-change boundary.
Timeless large-loss frequency then falls from the current scorer's 1.28% to 0.37%.
Its largest loss still reaches 10.68 points. Recent local evidence still loses 17.79 points in its worst update.
The next protocol should measure contemporaneous taste and final adaptation separately.
It should distinguish a genuine change from a noisy rating without penalizing correct learning of earlier preferences.

## Diagnose the remaining noisy update

Recent local evidence's largest loss concerns a noisy rating at the fourteenth observation.
Accuracy falls from 82.39% to 64.60%.
Keeping the earlier claims while updating local evidence reaches 71.36%.
Updating claims while retaining earlier local evidence reaches 79.64%.
Both contributions affect the loss; claim changes alone do not explain it.
Recency time advance belongs to the local evidence component in these exploratory swaps.

These two selected failures support mechanism diagnosis only.
They do not establish a general repair or independent confirmation of a new policy.
Historical recency replays use the same simulated cadence, rather than original viewing dates.
Read the [diagnostic replays](learning-stability-diagnostics-v1.json) for the complete component swaps.

## Profile history remains distinct from scorer stability

Rerating, clearing, and restoring one title changes stored claims in 193 of 240 sessions.
Both local policies restore their published scores in all 240 sessions without resetting the original claims.
The changed claim records alone do not establish a recommendation failure.
The noisy-update diagnosis still warrants measuring evidence and claim contributions separately.

## Next project decision

Keep the current scorer as the product baseline and retain both local candidates experimentally.
Use timeless local evidence as the continuity comparison and recent local evidence as the adaptation comparison.
Test evidence-dependent generalization before increasing recent evidence influence or combining correction policies.
Preserve the exact stored rating while limiting unsupported changes to inferred preferences.
Include accurate updates, isolated mistakes, repeated mistakes, and genuine preference changes under equal evidence budgets.

Score the person's current taste at each update and final taste after adaptation.
Keep the historical failures, order checks, exact controls, and independent confirmation requirement.
Do not select a new strength or relax the recorded requirements using this reserved cohort.
Question selection and shared contexts remain later work until the core learning behavior earns a baseline decision.

Read the [complete results](learning-stability-v1.md), [compressed traces](learning-stability-v1.json.gz), and [experiment guide](../docs/learning-stability-experiment.md).
Read the [recommendation review](recommendation-progress-v1.md) for the commit mapping and outstanding decisions.
Read the [verification record](learning-stability-verification-v1.json) and [default regression record](learning-stability-regression-v1.json) for completed checks.
