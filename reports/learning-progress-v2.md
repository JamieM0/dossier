# Dossier learning progress

The recommended immediate work is complete. Keep the current scoring baseline and reject the tested corroboration guards.
Jamie remains the only real product user. The synthetic lab supplies the primary evidence.

## Completed actions

| Recommended action | Status | Result |
| --- | --- | --- |
| Test supporting evidence before broad generalization | Complete | Four guarded policies fail adoption in both reserved cohorts |
| Preserve exact explicit ratings and inspectable preferences | Complete | Stored values remain exact; scoring leaves stored claims unchanged |
| Separate present taste from adaptation | Complete | Both sides of an update use the same present-taste target; the evaluator measures adaptation separately |
| Include accurate, isolated, repeated, and genuine-change controls | Complete | Eight actor types, 160 fresh people, and 320 sessions |
| Require independent confirmation | Complete | 64 selection people and 64 different confirmation people |
| Adopt a successful new baseline | Not earned | No candidate meets every frozen requirement |
| Defer questions and contexts until that decision | Applied | Later features remain deferred |

## Decision-making findings

Direct local matching continues to improve average ranking and removes scorer order sensitivity.
Recent matching continues to improve adaptation, but increases disruptive updates.
The tested supporting-evidence guards reduce those average gains and generally increase disruptive updates further.

On confirmation people, recent matching gains 2.70 ranking points against current scoring.
The joint supporting-evidence guard reduces that gain to 1.94 points.
Its large-loss frequency reaches 2.58%, against 1.64% for unguarded recent matching and 0.92% for current scoring.
Large losses exceed five ranking points after the tenth rating.

An accurate rating can still cause a severe loss.
The diagnosed replay implicates both direct matching and changes to earlier evidence weights, with little additional loss from effective claims.
The project still needs a model that generalizes useful evidence without destabilizing existing preferences.

## Next priority

Investigate the spread of influence from accurate novel ratings and the matching representation that links them to other titles.
Keep timeless matching and recent matching as separate comparisons for continuity and adaptation.
Preserve explicit ratings and restoration, and require fresh confirmation before adopting a changed policy.
Keep broader question and context work deferred.

## Verification and limits

Independent reconstruction checks 19,200 ratings, 268,800 ranking measurements, over nine million policy scores, and 155 historical checkpoints.
Domain, CLI, and UI unit tests pass. Shared type checks report no errors or warnings.
The 65 experiment and policy checks pass. Ordinary recommendation regressions remain identical.
One development person repeats exactly; this does not claim two complete runs.
The recorded output amendment changes serialization only and preserves the original evaluator source.
The desktop LAN-pairing timeout remains an earlier unresolved limitation; this work does not change that component.
GitHub project access remains unavailable. The rejected command did not add a planning draft.

Read the [corroboration decision](corroboration-analysis-v1.md) for outcomes, controls, and the remaining model problem.
Read the [commit review](recommendation-progress-v1.md) for earlier recommendations and the commits that satisfy them.
