# Experiment 4.5 analysis

Experiment 4.5 returns **do_not_promote**. Broader discovery succeeds, but movie ranking uncertainty and book correction failures prevent promotion.

The CLI replay covers 438 people and 876 sessions. Fresh confirmation contains 24 movie people and 24 book people.

Previously inspected people provide regressions. Product defaults and experiment 4's protocol and reports remain unchanged.

## Read the fresh confirmation results

The comparisons use the same supplied ratings within each person. Both sessions average within each person before bootstrap uncertainty estimates.

| Measure | Movies | Books |
| --- | --- | --- |
| Current inferred-claim AUC | 64.25% | 61.64% |
| Narrow personal-lens AUC | 84.73% | 73.44% |
| Broad personal-lens AUC | 86.35% | 91.39% |
| Broad gain over current, 95% interval | +22.10 [+15.34, +29.07] points | +29.75 [+22.19, +37.46] points |
| Broad gain over narrow, 95% interval | +1.62 [0.00, +4.11] points | +17.95 [+9.38, +27.32] points |
| Represented-rule recovery: narrow | 77.5% | 40% |
| Represented-rule recovery: broad | 100% | 100% |
| Mean distinction prompts: narrow | 6.65 | 3.96 |
| Mean distinction prompts: broad | 2.50 | 2.50 |
| Broad gain over 50 ratings | +21.98 [+15.11, +28.96] points | +30.34 [+22.07, +38.75] points |
| Broad corrected source pairs reversed | 36/40 | 26/40 |

Represented-rule recovery excludes unknown-factor people. Each fresh domain contains 20 people with expressible rules and four with absent factors.

The movie ranking interval touches zero. The frozen gate requires a positive lower bound, so the broader-learning gate fails.

Book corrections reverse 65% of source pairs. The frozen gate requires 90%, so the correction gate fails.

Every other frozen discovery, learning, control, and portability gate passes in both fresh domains. No thresholds change after the replay.

## Separate question coverage from recommendation quality

Broader questions recover creator, decade, and axis rules that the narrow queue often misses. They also retire contrasts that confirmed rules already explain.

A recovered rule can improve the inspectable profile even when the existing geometry already ranks those items correctly.

That distinction matters for Dossier. The person gains an editable account of their preference, with an explicit record of their confirmation.

The movie result does not establish a reliable additional ranking gain. The book result establishes a strong gain within this targeted simulation.

The queue offers one supported pattern per prompt. The narrow queue offers eight possible distinctions around a similar pair.

Their prompt counts compare interruptions, not identical mental effort. Human comprehension and response time remain unmeasured.

## Identify the source of the scoring gains

The controls share exactly the same broad questions and answers. Their only differences concern claim availability, predicate semantics, and scoring.

| Scoring arm | Movie AUC | Book AUC |
| --- | --- | --- |
| Current inferred claims | 64.25% | 61.64% |
| Native confirmation of existing claims | 65.11% | 63.24% |
| Native scoring with missing claims authored | 65.11% | 63.27% |
| Shared personal predicates | 78.82% | 80.21% |
| Matched-strength existing claim predicates | 78.82% | 80.21% |
| Full personal predicate language | 86.35% | 91.39% |

Shared personal and matched-strength claim controls produce identical item scores in every replay. Existing claim matching can reproduce those personal contributions.

Native claims retain their confidence-weighted contribution of at most `0.06` each. Personal features contribute `0.3`, with a combined cap of `0.6`.

Native confirmation also replaces an inferred contribution rather than adding the full personal term. Its marginal change can therefore remain small.

Claim availability contributes little to these aggregate results. Authoring missing claims changes book AUC by only 0.03 points and leaves movie AUC unchanged.

On the 12 people with shared predicates in each fresh sealed domain, stronger scoring gains 27.42 movie points and 34.35 book points.

Those intervals are [+22.38, +32.47] and [+31.21, +37.61] points. This subset diagnoses contribution strength without decade or axis differences.

This is an analysis of the protocol's shared-predicate subset. It does not add a promotion gate or validate a production weight.

## Identify the value of additional predicates

The full language exceeds the shared arm by 7.53 movie points and 11.19 book points. Both intervals have positive lower bounds.

The frozen attribution gate passes in both domains. Additional predicate coverage contributes beyond the matched-strength shared language in this simulation.

Decades introduce a predicate kind absent from existing claims. Personal and native axes also use different thresholds: `0.35` and `0.3`.

The pooled fresh decade cohort gains 47.35 points over the shared arm. The pooled axis cohort gains 7.50 points.

These pooled cohorts combine development and reserved people. Use them to diagnose the mechanism rather than claim separate confirmation.

The evidence supports testing broader claim vocabulary and stronger explicit feedback. A new latent taste geometry remains untested.

## Repair correction authority before promotion

All 80 fresh broad corrections move affected scores in the requested direction. Only 62 reverse the requested source-pair ordering.

Scores outside the corrected predicate remain unchanged. Stable locality therefore does not guarantee effective user control.

Movie failures concern axis preferences. Book failures concern creators, axes, and one decade preference.

One movie correction reduces the source-pair margin from `1.574` to `0.974`. The old rating geometry still outweighs the corrected feature.

Native authored claims reverse only 9/32 movie pairs and 8/32 book pairs. The existing feedback path gives even weaker control.

A new protocol should test explicit correction authority against contradictory stored ratings. It should define when user feedback overrides inferred evidence.

Increasing every contribution without a control policy can move many recommendations. Retain bounded scope, removal, collateral movement, and prompt-safety measurements.

Do not promote the current `0.3` contribution merely because it improves the synthetic ranking. It still fails the user-control requirement.

## Align confidence with observable behavior

Broad personal error burden falls from 5.50% to 1.79% for movies. Confident-pair coverage rises from 21.36% to 39.80%.

Book error burden falls from 0.24% to 0.13%. Confident-pair coverage rises from 0.83% to 9.57%.

Native authored controls increase error burden to 6.92% for movies and 1.44% for books. Their proxy confidence rises after confirmation despite weak score influence.

Confidence must reflect the behavior of the scoring arm. Confirmed predicate confidence alone does not establish confidence in the final recommendation ordering.

Rejecting a proposed pattern no longer creates a metadata limitation. An explicit unknown-factor answer still caps confidence near its examples.

Unknown-factor people receive ten prompts without ranking gains. The broader policy still needs an interruption rule for acknowledged limitations.

## Preserve ownership and evidence limits

Every broad profile survives encrypted export and CLI import with identical feedback and scores in all five broad scoring arms.

Removal deletes the explicit feature and its explanation. The controls preserve original inferred claims outside the experimental feedback view.

Default hard, TMDB, confirmation, and override outcomes match saved baselines. The original synthetic regression also completes successfully.

The synthetic people know one exact causal rule. Their confirmations contain no mistakes, and the catalogue deliberately creates representation collisions.

The large gains demonstrate mechanisms under these assumptions. They do not predict gains for real viewers or book readers.

Recorded people supply no causal confirmations. Their sessions cannot establish human benefit from the new questions.

The next work should focus on correction authority and confidence consistency, with broader predicates retained as an experimental direction.

## Inspect the evidence

Read the [complete experiment 4.5 report](personal-lens-45-v1.md) for every cohort and gate.

Read the [experiment reference](../docs/personal-lens-45-experiment.md) for CLI actions and reproducible commands.

The [lossless session traces](personal-lens-45-v1.json.gz) preserve every question and outcome. The CLI regenerates the readable JSON.

The [default regression report](personal-lens-45-regression-v1.json) records baseline preservation and the override compatibility replay.
