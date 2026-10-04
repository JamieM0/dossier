# Personal-lens analysis: experiment 4

Experiment 4 returns **do_not_promote** under its frozen protocol. The candidate passes every sealed movie gate but fails book-rule recovery.

The study runs 342 people and 684 sessions through CLI actions. It uses personal ratings, local descriptive metadata, and explicit simulated confirmations.

## Read the result

The new sealed cohorts contain 12 movie people and 12 book people. Repeated sessions average within each person before the bootstrap.

| Measure | Sealed movies | Sealed books |
| --- | --- | --- |
| Current inferred-claim AUC | 59.52% | 60.02% |
| Personal-lens AUC | 82.09% | 71.92% |
| AUC gain, 95% interval | +22.57 [+12.54, +33.13] points | +11.90 [+2.93, +21.20] points |
| Gain over 50 ratings | +22.87 [+12.92, +33.52] points | +11.15 [+3.01, +20.02] points |
| Represented-rule recovery | 75% | 40% |
| Required recovery | 50% | 50% |
| Corrected source pairs reversed | 15/15 | 8/8 |
| Individual losses against inferred claims | 0/12 | 0/12 |

Every sealed correction leaves scores unchanged for items outside the corrected predicate. Matching items can move substantially in rank.

All 684 sessions preserve features, limitations, and recommendation scores through an encrypted export and CLI import.

No default scorer, desktop interaction, or question policy changes. The candidate remains available through experimental CLI actions.

## Review the earlier implementations

Experiment 1 canonicalizes the greedy grouping order. Its stricter candidate incrementally requires similarity with every member of a group.

That stricter candidate does not implement agglomerative clustering or stable medoids. Both candidates fail their frozen quality and viewer-protection gates.

Experiment 1 also retains the default public-score contribution. Experiments 2, 3, and 4 remove public scores at the catalogue boundary.

Experiment 2 fits positive axis weights, with optional group multipliers. It rebuilds the fit after corrections and limits comparisons to equal rating buckets.

The recorded queues supply too few comparison answers for strong interaction-efficiency evidence. Regularized weight changes often fail to reverse the requested ordering.

Experiment 3 bootstraps rating histories inside the same fixed representation. Its counterfactual policy estimates ranking disagreement while holding claims fixed.

That policy can measure uncertainty within the lens. It cannot recover a distinction that the lens merges or omits.

Experiment 4 therefore retains all three product defaults. Its new contribution is an inspectable, confirmed metadata predicate outside the fixed geometry.

## Separate useful control from complete discovery

Tag and two-tag interaction preferences recover in every new synthetic session. Their pooled AUC gains are 36.94 and 31.18 points.

Creator recovery reaches 45.83%; decade recovery reaches 50%. Axis recovery reaches zero.

In the books fixture, each near-identical group shares its creator, decade, and axis vector. Those preferences differ across groups.

The queue requires opposite ratings within cosine similarity `0.97`. It therefore cannot ask about those distinctions in the invented books catalogue.

The failure concerns question coverage. The generic predicate language can express the missing creator, decade, and axis preferences.

A new protocol should compare counterexample questions with questions about supported metadata patterns across more distant items.

It should also test direct user-authored predicates. A person should not need a particular geometric contradiction before stating an important preference.

## Interpret confidence carefully

Unknown-factor people confirm no features. Their ranking stays unchanged while `none` records a limitation around the example pair.

Sealed movie error burden falls from 9.04% to 2.68%. Confident-pair coverage rises from 16.07% to 26.39%.

Sealed book error burden falls from 1.67% to 1.59%. Coverage rises from 3.87% to 5.62%.

These figures describe a confidence proxy, not calibrated probabilities. They do not establish that a real person trusts the explanations.

The queue can keep asking after a confirmed feature already explains other counterexamples. Later `none` answers can cap confidence across broad regions.

A new protocol should remove explained pairs from the queue. It should distinguish an absent causal factor from an unhelpful shortlist.

## Keep the claims within the evidence

Existing inferred claims already express many tested predicates. This study combines explicit confirmation with a separate bounded score contribution.

It does not isolate representation expansion from stronger authoritative feedback. A new protocol should include user-confirmed existing claims as an additional control.

The new people know one exact causal rule. The evaluator selects that rule only when the shortlist offers its exact predicate and effect.

The catalogue deliberately creates fixed-vector collisions. It makes explicit metadata distinctions unusually valuable and creates large synthetic gains.

These gains support a mechanism test. They do not predict a 22-point improvement for real movie viewers.

Recorded users answer `none` because their ratings do not reveal causal explanations. Their ranking stays unchanged; this does not confirm human benefit.

The invented book domain tests reuse of generic vectors and predicates. It does not validate a book lens or add books to Dossier.

The next personal-lens protocol should add imperfect explanations, multiple simultaneous rules, contradictory confirmations, and changes in preference.

Preserve user control, removal, portability, and uncertainty measures alongside recommendation quality. These properties serve Dossier's wider purpose.

## Inspect the evidence

Read the [complete results](personal-lens-v1.md) for every cohort and gate.

Read the [experiment reference](../docs/personal-lens-experiment.md) for CLI actions and reproducible commands.

The lossless [session traces](personal-lens-v1.json.gz) record every question and model outcome. The CLI regenerates the readable JSON.

The [default regression result](personal-lens-regression-v1.json) reports unchanged hard, TMDB, confirmation, and override outcomes.
