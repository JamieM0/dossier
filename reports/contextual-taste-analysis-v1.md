# Experiment 5 analysis

Experiment 5 returns **do_not_promote**. Explicit contexts show promise, but the shared residual model fails learning, update-safety, and claim-quality requirements.

The CLI replay covers 534 people and 1,068 sessions. Fresh confirmation contains 24 movie people and 24 book people.

## Read the confirmation results

The ranking results average four contexts and two sessions within each person. Bootstrap intervals resample people, rather than individual ratings or contexts.

| Arm | Sealed movie AUC | Sealed book AUC |
| --- | --- | --- |
| Pooled global taste | 76.71% | 72.13% |
| Pooled recency decay | 76.70% | 70.52% |
| Separate context profiles | 84.45% | 77.94% |
| Global base with context residuals | 73.91% | 82.05% |

The shared arm changes movie AUC by −2.79 points, with a 95% interval from −9.39 to +2.61.

Its book gain reaches +9.93 points, with an interval from +5.94 to +14.34. These gains concern invented synthetic books.

Separate profiles gain +7.75 movie points and +5.82 book points over pooled global taste. Both intervals have positive lower bounds.

Separate profiles were comparison arms, without their own complete promotion protocol. Their ranking gains support another experiment, rather than an immediate product change.

## Read the frozen failures

The context-learning gates use switching people, rather than stable or drifting people. Each sealed domain contains 12 switching people.

Shared movie taste gains +2.61 points on switching people. Its interval spans −0.08 to +5.72, failing the positive-lower-bound requirement.

Shared book taste gains +13.88 points on switching people. Its interval spans +7.51 to +20.35, passing that requirement.

Movie sparse-transfer results remain uncertain. Four sealed sparse people gain +6.89 points over separate profiles after three ratings per context.

Their interval spans −18.94 to +32.72. Book sparse transfer passes with +8.07 points and an interval from +2.61 to +11.84.

Both domains fail the five-point single-rating safety gate. The largest declines reach 6.25 movie points and 6.23 book points.

Both largest losses occur at the twelfth rating in a context. Update risk remains after cold start.

Scoped claim precision reaches 68.45% for movies and 55.49% for books. Books fail the frozen 60% requirement.

Claim precision counts matching claim-item assertions. Several claims can refer to one item, so these counts do not represent unique mistaken titles.

## Separate contexts from changing taste

The shared arm preserves an explicitly global base. Context evidence cannot revise that base, even when the person's taste changes over time.

On four sealed movie drift people, shared AUC reaches 63.55%. Pooled global taste reaches 94.34%, and recency reaches 99.07%.

The shared loss against pooled global taste reaches 30.80 points. This small subgroup provides a mechanism diagnosis, rather than separate confirmation.

A fixed global base protects scope boundaries but can preserve stale beliefs. Dossier needs a policy for updating global taste, alongside situational differences.

Stable people pass the frozen noninferiority gate in both domains. Context residuals therefore do not harm every person whose taste remains constant.

The result rejects this anchored hierarchy. It does not establish that context-aware taste is ineffective.

## Preserve control without overstating authority

Every sealed correction moves the affected alias score in the requested direction: 48/48 movie checks and 48/48 book checks.

Other contexts and the global shared profile retain identical scores. Clearing and restoring a rating restores the original score.

Removing a context and recreating it empty restores the global fallback. Global claims remain unchanged after contextual feedback.

Every profile survives encrypted export and CLI import with identical context ratings, timestamps, recommendation scores, and residual evidence.

These are concrete improvements in evidence ownership. The same title can retain conflicting ratings across user-owned contexts.

The correction check concerns one scoped rating. It does not establish authoritative predicate correction or guarantee a requested pairwise ordering.

Experiments 2 and 4.5 expose those stronger control failures. Experiment 5 does not repair them.

Context claims remain inspectable, scoped inferences. The shared scorer uses its residual and global claims; it does not add contextual claim contributions.

Recommendation confidence remains `null`. Evidence counts and observed status do not establish calibrated certainty or detect an absent causal factor.

## Review the earlier implementations

Experiment 1 sorts ratings before greedy clustering. Its stricter arm requires similarity with each existing member, rather than performing agglomerative complete-link clustering.

Both geometry candidates remove order dependence but fail quality and viewer-protection gates. Experiment 1 also retains the default public-score contribution.

Experiment 2 refits positive axis weights and optional cluster multipliers from explicit comparisons. It limits fitting to identical non-neutral rating buckets.

Those fits often move scores without reversing the corrected ordering. Sparse recorded comparison queues also weaken interaction-efficiency evidence.

Experiment 3 bootstraps the current representation. Its counterfactual simulations hold claims fixed and estimate disagreement, rather than observed preference accuracy.

Targeted questions underperform random selection on fresh people. Stopping reduces prompts by sacrificing learning.

Experiment 4 adds explicitly confirmed metadata predicates. Its narrow cosine gate blocks discovery of some book preferences.

Experiment 4.5 removes that narrow eligibility gate and recovers every represented rule. Bounded score contributions still fail some correction reversals.

Experiment 5 retains these product defaults. It tests a new evidence scope and residual model without combining rejected candidates.

No public review score, popularity signal, other-person preference, or hidden evaluation answer enters experiment 5 scoring.

## Audit the current overwrite behavior

The exploratory overwrite audit replays the current library rule: a new rating replaces the earlier rating for that title.

The pooled protocol retains about 13 duplicate observations per fresh session. This slightly improves its baseline relative to actual overwrite behavior.

On sealed movies, the overwrite baseline reaches 76.22% AUC. Shared taste changes it by −2.31 points, with an interval from −8.56 to +2.92.

On sealed books, the overwrite baseline reaches 71.57% AUC. Shared taste gains +10.49 points, with an interval from +6.62 to +14.77.

These results preserve the broad interpretation: book gains remain promising, while movie gains remain unproven. The frozen decision remains unchanged.

The audit uses the same private evidence boundary and current scorer. It adds a baseline check without changing candidates or promotion thresholds.

Read the [overwrite-baseline diagnostics](contextual-taste-diagnostics-v1.json) for source hashes, session outcomes, and viewer-level intervals.

To reproduce the exploratory audit, run:

```sh
node apps/dossier-cli/scripts/contexts-diagnostics.mjs
```

## Choose the next work

Retain explicit contexts as an experimental evidence model. They preserve situated contradictions, scoped control, and portability without flattening every rating into timeless global taste.

Test a shared model that learns common preferences from contextual evidence while preserving explicit global confirmations and genuinely local corrections.

Compare that model with separate profiles and the actual current library behavior. Include changes over time, mistaken context labels, and preferences absent from the lens.

Require useful claim accuracy and effective correction authority alongside ranking. A scoped but misleading claim remains a poor account of the person.

Test update continuity separately. A bounded residual still causes losses greater than five AUC points after substantial context evidence.

Dossier should earn a richer profile through these checks. Context labels alone do not make the system understand a person better.

## Inspect validation and limits

The four report audits pass. They validate frozen fixtures, supplied evidence, reconstructed checkpoint rankings, viewer aggregation, and decision gates.

Core tests, CLI tests, UI unit tests, and all 57 browser tests pass. Repository-wide type checking reports no errors or warnings.

All 41 report audits pass across the experiment series. Documentation checks report no errors or warnings.

The full repository test command fails in the unchanged desktop LAN-pairing test. An isolated replay also times out after 20 seconds.

Experiment 5 does not modify the remote-access implementation. The experiment results and default recommendation regressions pass independently of that timeout.

Default synthetic, hard, TMDB, confirmation, and override regressions pass. Hard, TMDB, confirmation, and override outcomes match their saved baselines.

The override replay uses the documented compatibility copy for its historical model fingerprint. Product defaults remain unchanged.

Fresh cohorts provide synthetic confirmation only. The experiment assumes correct context labels and available ratings. It does not measure human prompt cost.

The synthetic book vectors exercise generic reuse. They do not establish a working book lens or add books to the product.

The frozen pooled arms retain repeated rating observations. Today's library instead overwrites an earlier rating for the same title.

Read the separate overwrite-baseline audit when interpreting that comparison. It does not change the candidate, thresholds, or frozen decision.

Read the [complete experiment 5 results](contextual-taste-v1.md) for cohort tables and gates.

Read the [experiment reference](../docs/contextual-taste-experiment.md) for reproducible commands and CLI actions.

The [lossless session traces](contextual-taste-v1.json.gz) preserve every supplied rating, checkpoint, claim, and contract result.

The [default regression report](contextual-taste-regression-v1.json) records baseline preservation and the override compatibility replay.
