# Test when personal ratings justify an override

Use this experiment to decide whether a protection rule can improve the fixed reviews-plus-tags candidate for unusual tastes.

## Read the decision

Open `reports/observed-rating-override-v1.html`. The report states whether the rule earns further use, who loses, and which learning failures remain.

Public reviews, the unchanged 75/25 candidate, and current Dossier appear in every comparison. Product defaults stay unchanged.

The primary comparison uses 40 supplied ratings. The experiment also reports results after one, three, five, 10, and 20 ratings.

## Run the experiment

From the repository root, run:

```sh
pnpm lab:override
```

The command builds the CLI, runs the rating sessions, and writes the HTML report and JSON results.

The outputs are:

- `reports/observed-rating-override-v1.html`: the standalone executive report.
- `reports/observed-rating-override-v1.json`: individual decisions, scores, evidence, claims, and failure traces.
- `reports/observed-rating-override-decision-v1.json`: report data with the attached verification results.

The fixture, candidate, and rule hashes appear in `apps/dossier-cli/benchmarks/override-v1-protocol.json`. The runner refuses changes to those files.

The runner also requires the original model fingerprint. A later model experiment needs a new protocol version with explicit comparisons.

## Understand the protection rule

The rule normally uses the unchanged candidate: 75% public reviews and 25% genre and keyword matching.

It considers current Dossier only after 20 supplied ratings, with at least six clear likes and six clear dislikes.

Public reviews must order those supplied preferences poorly: at most 60% of liked-versus-disliked pairs in the correct order.

The rule temporarily hides one-third of supplied ratings and rebuilds Dossier from the remaining ratings. It repeats this process across three splits.

Three different split orders test whether the advantage persists. These temporary validation ratings come from supplied evidence, not the experiment's hidden answers.

Dossier must beat both public reviews and the candidate by five ranking points in every split order.

A separate uncertainty check resamples rated titles. Both estimated lower bounds must stay positive. Repeated splits do not count as independent viewers.

The rule chooses a ranking method using supplied ratings only. It does not receive viewer IDs, hidden ratings, or descriptions of hidden tastes.

This rule tests selection between existing methods. It does not repair Dossier's film descriptions, grouping, claims, or dislike penalties.

## Preserve the regression cases

The run includes the earlier 31 viewers and 47 confirmation viewers. Their current Dossier scores must match the saved sessions.

The eight unusual-taste viewers remain an explicit group. Viewers 82 and 484 must retain the advantages current Dossier previously showed.

The five worst learning failures replay through the CLI after every rating. Their original 10-rating and 40-rating scores must reproduce exactly.

For each failure, the protected ranking must improve the final score by three points. Its learning decline must stay within three points.

No single added rating after the first 10 can reduce the protected score by more than five points.

These thresholds are decision aids. Passing them does not establish safety for every person or authorize a product release.

## Keep hidden answers separate

The new fixture includes every eligible viewer outside both previous cohorts. Eligibility requires 80 matched ratings, 12 clear likes, and 12 clear dislikes.

Each of the 30 new viewers has 40 hidden films. The fixed selection includes eight likes, eight dislikes, and 24 further films.

Only training films and supplied ratings reach the CLI. The protection rule receives only supplied evidence.

The evaluator reveals hidden ratings after the ranking decision. It then measures benefits, losses, useful overrides, and missed opportunities.

The new viewers come from the same MovieLens archive and TMDB catalogue. This experiment does not measure an independent population or film retrieval.

After scoring, this cohort becomes a regression cohort. Do not call it untouched in later tuning experiments.

## Keep the next decision narrow

Keep the candidate weights unchanged. Report individual losses against both public reviews and current Dossier.

Use the executive report to accept or reject the frozen protection rule. Do not search for favourable thresholds after reading hidden outcomes.

If the rule fails, state the missed users and remaining learning failures. Define a separate hypothesis before another experiment.
