# Learning stability experiment

Use experiment nine to decide whether direct local evidence repairs unstable rating updates.
Jamie is the only real product user. The synthetic lab supplies the primary model evidence.
Ordinary recommendation defaults remain unchanged during the experiment.

## Frozen question

Can local evidence preserve recommendation quality while reducing large update losses and rating-order sensitivity?
The experiment also asks whether recency preserves adaptation when preferences change.
It follows the completed preparation and correction experiments, which did not earn a new scoring baseline.

## Compared policies

| Policy | Matching behavior | Inferred claims |
| --- | --- | --- |
| Current | Existing greedy taste groups | Existing history |
| Stable anchors | Earlier deterministic greedy candidate | Reconciled against candidate groups |
| Strict stable groups | Earlier deterministic strict candidate | Reconciled against candidate groups |
| Local evidence | Direct similarity to individual ratings | Existing history |
| Recent local evidence | Direct similarity with a thirty-day half-life | Existing history |

Local policies use positive cosine similarity raised to the fourth power.
Each contribution uses the rating's existing strength and sign.
The score divides signed evidence by local evidence weight plus a prior of two.
This avoids moving group centroids and changing the number of groups in an average.
The experiment keeps inferred claim contributions to expose remaining inference instability.
It does not fit parameters or apply the rejected correction candidates.

## Synthetic people

The frozen catalogue contains 180 invented films. Each person reserves 80 films for evaluation.
The cohort contains 120 people: 60 development people and 60 reserved people.
Each partition includes stable axis preferences, interactions, missing factors, noisy ratings, changing taste, and weak ratings.
Reserved people combine three axis preferences; development people combine two.
The private utility uses a median-centered preference scale to provide liked and disliked films.
Hidden utilities and evaluation ratings never enter Dossier or choose model settings.

Each person supplies two sessions of 60 ratings in fixed orders.
Noisy people reverse 15 percent of supplied ratings. Missing preferences remain outside the film descriptions.
Changing people supply earlier preferences for thirty ratings, then current preferences for thirty ratings.
The hidden target remains current taste throughout the learning curve.
Observation timestamps advance by two days per rating under a fixed laboratory clock.
The lab replaces action timestamps immediately after rating; it preserves the application's rating and claim transitions.

This experiment concerns rating updates. Earlier correction experiments separately test inaccurate and incomplete explanations.
It does not measure recognition, question effort, or skipped questions.

## Adoption requirements

Freeze inputs, candidates, evaluator, and requirements before examining reserved outcomes.
A candidate needs a mean gain of two ranking points and a positive lower uncertainty bound.
It must preserve the worst-performing tenth within one point.
Stable and changing-taste groups each need a lower gain bound of at least minus one point.

After ten ratings, no observed rating may lose more than five ranking points.
The frequency of larger losses must fall by at least half against current scoring.
Eight permutations of the final library must produce identical published scores.
Those permutations retain the same timestamps and stored claims; they isolate scorer order dependence.

All five historical severe failures must improve final accuracy by three points.
Their decline from ten to forty ratings must remain within three points.
No historical step may lose more than five points.
The unchanged scorer must reproduce the original failure endpoints exactly.

Overwrite, clearing, scorer restoration, encrypted portability, CLI parity, and read-only scoring must pass.
Scorer restoration retains original claims and timestamps. Complete inference-history restoration remains a separate measurement.
Historical defaults and protected experiment archives must remain unchanged.
Passing earns an adoption review. It does not automatically change the product scorer.

## Run the experiment

From the repository root, run:

```sh
pnpm lab:learning-stability
```

The command writes complete JSON traces, a compressed archive, and a readable results report.
The frozen reference refuses changed model output, source files, historical inputs, or protocol files.
Use a new version for changed candidates or requirements.

To run a development check without replacing the complete report, run:

```sh
pnpm lab:learning-stability -- --max-viewers 2 --output /tmp/stability-smoke.json
```

A limited or partitioned run reports `smoke_only` and cannot decide adoption.

To reconstruct the supplied evidence, local contributions, and ranking measurements, run:

```sh
node apps/dossier-cli/scripts/learning-stability.check.mjs
```

To compare ordinary recommendation defaults with historical outcomes, run:

```sh
pnpm lab:learning-stability-regressions
```

The override check uses the documented historical fingerprint compatibility replay.
It retains fixture and scorer checks and compares the original outcomes.

## Experimental CLI use

To inspect a local profile with timeless local evidence, run:

```sh
pnpm cli suggest --local-evidence timeless
```

Use `recent` for the recency policy. Recent scoring uses stored observation timestamps and the current time.
The action rejects combined experiment flags and unsupported matching dials.
Ordinary `suggest` retains its current behavior.
The offline catalogue adapter accepts larger batches to avoid rescoring repeated laboratory pages.
Live CLI recommendations retain their existing page limit.

## Evidence and limits

Read the [frozen protocol](../apps/dossier-cli/benchmarks/learning-stability-v1-protocol.json) for the candidates and requirements.
Read the [frozen reference](../apps/dossier-cli/benchmarks/learning-stability-v1-reference.json) for implementation and historical input hashes.
The protocol uses known synthetic film candidates. It does not establish retrieval quality or television performance.
The simulated timing does not establish an optimal recency half-life.
Local matching cannot recover preferences absent from metadata.
Jamie can inspect usability without treating that inspection as additional independent model evidence.

## Recorded outcome

Neither local candidate passes every frozen adoption requirement. Ordinary recommendation defaults remain unchanged.
Both improve reserved ranking accuracy and remove scorer order dependence.
Large update losses and historical failure protection remain unresolved.
Read the [executive decision](../reports/learning-stability-analysis-v1.md) and [complete results](../reports/learning-stability-v1.md) for measured outcomes.
The [exploratory diagnostics](../reports/learning-stability-diagnostics-v1.json) distinguish final-taste accuracy from the taste supplying each rating.
Those diagnostics do not alter the recorded decision or select another candidate.
