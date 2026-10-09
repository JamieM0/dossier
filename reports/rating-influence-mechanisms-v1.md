# Rating influence mechanisms

Accurate ratings can damage recommendations without any earlier mistake.
Broad transfer, cluster competition, inferred preferences, and evidence normalization each contribute.
No single replacement follows from this diagnosis. Product defaults remain unchanged.
Jamie remains the only real product user. All new analysis uses synthetic people.

## Scope and reproduction

This explanation covers all 15,555 accurate updates after ten ratings in the completed corroboration trial.
The analysis separates 10,335 clean-history updates from 5,220 updates following earlier mistakes.
It includes current scoring, timeless matching, and recent matching.

Run `node apps/dossier-cli/scripts/rating-influence-diagnosis.mjs` from the repository root.
The script reproduces 132 updates: two largest harms and benefits per scoring arm and history/type stratum.
Every replay checks its original endpoints against preserved scores.
The [replay record](rating-influence-mechanisms-v1.json) contains events, changed titles, claim transitions, and helped or harmed ranking pairs.

| Scorer | Clean harmful updates | Clean beneficial updates | Clean losses above five points | Earlier-mistake losses above five points |
| --- | ---: | ---: | ---: | ---: |
| Current | 3,928 | 4,711 | 71 | 35 |
| Timeless matching | 3,836 | 4,799 | 59 | 13 |
| Recent matching | 4,398 | 5,199 | 147 | 55 |

These counts describe repeated updates, rather than independent people or adoption evidence.
Changing-taste updates compare both endpoints against the same taste at that moment.

## Demonstrated mechanisms

**Cluster competition reaches unrelated titles.** Current scoring averages up to three positive cluster matches.
A new positive cluster can increase that divisor even where its similarity is small.
For `corroboration-sealed-stable_axes-2`, seed 89, rating 13, accuracy falls from 68.13% to 44.53%.
The new cluster alone loses 19.69 points while retaining earlier terms and their divisor.
Routing removes another five points through top-three membership and normalization.
Accuracy then reaches 43.44%; subsequent merging contributes zero in this replay.
Catalogue 101, which the person likes, falls from 0.060 to -0.020 despite similarity 0.135 to the new title.
Catalogue 107, which the person dislikes, rises from 0.055 to 0.168 with similarity 0.817.
Their order reverses. This clean history demonstrates both broad transfer and cluster competition.

**High similarity does not imply shared preference.** Timeless matching removes cluster competition but still transfers the wrong preference.
For `corroboration-development-stable_axes-0`, seed 89, rating 13, accuracy falls from 88.84% to 70.35%.
The accurate negative rating penalizes liked catalogue 105, whose cosine similarity is 0.913.
Its score falls from 0.160 to -0.181. Disliked catalogue 104 stays at -0.053 because similarity is negative.
The direct stage loses 18.81 points; normalization restores 2.03 points; inferred preferences lose another 1.71 points.
Narrower transfer must preserve accurate novel preferences and cannot assume that all close matches share taste.

**Normalization and stored-evidence reweighting differ.** Timeless and recent matching retain every earlier raw kernel weight.
Their new denominator changes the effective influence of earlier evidence on each matched title.
That stage helps in 27 of 44 timeless replays and hurts in 17.
Current scoring separately changes matching competition, centroids, and cluster confidence.
The earlier support guards also recompute duplicate densities and evidence gates, as the preserved corroboration replay demonstrates.
An additive candidate can test normalization without reintroducing those global gates.

**Inferred preferences are not negligible.** Claim transitions hurt in 23 current, 18 timeless, and 17 recent replays.
They help in 20, 19, and 22 respectively.
The small claim effect in the original support-guard replay does not generalize to all accurate updates.

**Recency is a separate influence.** Advancing the clock helps in 16 recent replays and hurts in 16.
Recent matching's clean-history large-loss count exceeds timeless matching's count.
Adaptation needs a separate requirement; reducing changes alone does not establish useful learning.

## Representation limits and next test

The replay record lists opposite preferences on identical feature vectors and identical non-identity metadata.
A vector collision can indicate lost metadata information. A full metadata collision requires an unavailable preference signal.
Title identity cannot establish that missing signal for an unseen title.
Report these failures separately instead of claiming that a smaller update repairs them.

Test at most three lab candidates: narrower transfer, an unusual rating with local influence, and additive evidence without normalization.
Each candidate must retain learning from accurate novel preferences and adaptation after genuine taste changes.
Use fresh development people before freezing selection and confirmation, with a separate confirmation catalogue.
Retain the earlier quality, update-damage, historical-failure, restoration, and portability requirements.
Keep question selection and shared contexts deferred.

Sequential stages diagnose these selected cases; their ranking changes depend on stage order.
They do not estimate independent causal effects across the population.
Preserved experiment records and existing work are checkpointed in commit `e345d5e`.
