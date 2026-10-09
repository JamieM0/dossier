# Corroboration experiment

Use experiment ten to decide whether supporting ratings can prevent disruptive generalization without blocking useful learning.
Jamie remains the only real product user. The synthetic lab supplies the primary model evidence.
This experiment follows the [learning stability decision](../reports/learning-stability-analysis-v1.md).
Product recommendation defaults remain unchanged throughout the experiment.

## Compared policies

| Policy | Local evidence | Inferred preferences |
| --- | --- | --- |
| Current | Existing taste groups | Existing claims |
| Local matching | Individual ratings | Existing claims |
| Recent matching | Individual ratings with a thirty-day half-life | Existing claims |
| Supported matching | Supporting ratings limit generalization | Existing claims |
| Supported recent matching | Supporting ratings and recency | Existing claims |
| Supported matching and claims | Supporting ratings limit generalization | Supporting ratings also limit inferred influence |
| Supported recent matching and claims | Supporting ratings and recency | Supporting ratings also limit inferred influence |

The four supported policies remain laboratory candidates. They do not add a product setting or change the stored profile.
Controls retain experiment nine's similarity power, prior, and recency interval.
Candidate settings remain fixed before reserved evaluation. This version does not tune them using previous reserved people.

## Corroborating evidence

Each rating needs other ratings with similar film descriptions and the same polarity to support its broader influence.
Opposing evidence reduces that influence. A title cannot corroborate itself.
The policy divides same-polarity near-duplicate evidence by its local density, using a fixed cosine threshold of 0.95.
This discount applies to supporting evidence and final recommendation contributions.
Different titles alone do not establish statistical independence; metadata similarity supplies a limited proxy.

The matching guard uses supporting weight divided by the prior plus supporting and opposing weight.
The claim guard applies only to active inferred preferences.
It removes the strongest supporting contribution before computing the claim's effective influence.
User-confirmed preferences retain their authority. Rejected and corrected preferences remain inactive.

The scorer preserves each exact stored rating and every stored claim.
Trace previews list supporting titles, counterexamples, and effective influence.
These previews explain experimental scoring; they do not rewrite Dossier's inspectable preferences.

## Fresh synthetic people

The fixture contains 180 fresh invented films and 160 people.
It separates 32 development people, 64 selection people, and 64 independent confirmation people.
Each person reserves eighty films and supplies two sessions of sixty ratings.
The evaluator keeps hidden preferences, future taste, and error labels outside every scorer.

The eight types cover accurate axis preferences, interactions, missing factors, isolated mistakes, repeated mistakes, biased mistakes, changing taste, and weak ratings.
Isolated mistakes occur at observation 14. Repeated mistakes occur at observations 14 through 18.
Biased mistakes reverse ratings for one genre between observations 11 and 30.
Changing people supply earlier preferences through observation 30, then current preferences.
Reserved people add a third axis preference to the development configuration.
Metadata duplicates test whether apparent corroboration receives excessive weight.
Every policy receives the same evidence budget and chronological observations.

## Present taste and adaptation

Final ranking measures current preferences. Present-taste ranking measures the preference supplying each observation.
Both sides of an update use the same present-taste target, including the preference-change boundary.
This avoids treating correct earlier learning as a harmful update solely because later preferences differ.
The experiment reports adaptation at observations 40 and 60 separately.
Observation timestamps advance by two simulated days, preserving experiment nine's recency comparison.
Historical replays use that same cadence rather than original viewing dates.

## Frozen adoption requirements

Each supported policy must pass every requirement separately in selection and confirmation.
Final mean accuracy must improve two ranking points, with a positive lower uncertainty bound.
The worst-performing tenth must remain within one point of current scoring.
Stable, changing, isolated-noise, repeated-noise, and biased-noise groups each need lower gain bounds within minus one point.
Present-taste mean gain also needs a lower bound within minus one point.

After ten ratings, no update may lose more than five ranking points against contemporaneous taste.
The frequency of larger losses must fall by at least half against current scoring.
Changing-taste final gain must retain eighty percent of any positive unrestricted recency gain.
Adaptation at observation 40 needs a lower gain bound within minus one point against current scoring.

Eight permutations of the final library must produce identical published scores.
They preserve timestamps and stored claims to isolate scorer order sensitivity.
Explicit ratings, overwrite, clearing, scorer restoration, encrypted portability, CLI control parity, and read-only scoring must pass.
The existing scorer can retain its known order sensitivity; the supported candidates must remove it.

All five historical severe failures must improve final accuracy by three points.
Their decline from ten to forty ratings must remain within three points.
No historical step may lose more than five points.
The unchanged scorer must reproduce each original failure endpoint exactly.
Independent reconstruction and ordinary baseline regressions must pass before any adoption decision.
Passing earns an adoption review. A failed candidate remains experimental.

## Reproduce the experiment

From the repository root, run:

```sh
pnpm lab:corroboration
```

The command writes complete traces, a compressed archive, and a readable report.
The archive index references compressed shards with one JSON record per person, avoiding a single oversized JSON string.
Keep the index and its five trace shards together. The index verifies each shard's content hash.
Frozen hashes reject changed candidates, evaluator sources, previous evidence, or product model output.
Use a new version for changed candidates or requirements.

To run a development check without replacing complete results, run:

```sh
pnpm lab:corroboration -- --max-viewers 1 --output /tmp/corroboration-smoke.json
```

A limited run reports `smoke_only` and cannot decide adoption.

To reconstruct ratings, both taste targets, and policy scores, run:

```sh
node apps/dossier-cli/scripts/corroboration.check.mjs
```

To check the policy controls, run:

```sh
node --test apps/dossier-cli/scripts/corroboration-policy.check.mjs
```

To compare ordinary defaults with historical outcomes, run:

```sh
pnpm lab:corroboration-regressions
```

The override replay uses the documented historical fingerprint compatibility procedure and retains fixture, scorer, and outcome checks.

## Evidence and limits

Read the [frozen protocol](../apps/dossier-cli/benchmarks/corroboration-v1-protocol.json) for complete requirements.
Read the [frozen reference](../apps/dossier-cli/benchmarks/corroboration-v1-reference.json) for implementation and earlier evidence hashes.
The [output amendment](../apps/dossier-cli/benchmarks/corroboration-v1-output-amendment.json) records a mechanical serialization change before result inspection.
It preserves the original evaluator source and leaves candidates, inputs, measurements, and adoption requirements unchanged.
The experiment measures ranking over known film candidates. It does not establish retrieval quality, television behavior, recognition, or question effort.
Simulated timing does not establish an optimal half-life. Missing preferences remain unrecoverable when metadata lacks the relevant information.
Jamie can inspect usability without treating that inspection as independent model evidence.

## Recorded outcome

The complete replay covers 160 people and 320 sessions. No supported candidate passes adoption in both reserved cohorts.
The tested guards generally reduce quality and increase large-loss frequency against their unguarded matching controls.
Explicit ratings, read-only scoring, portability, and experimental score restoration pass. Product recommendation defaults remain unchanged.
Read the [executive decision](../reports/corroboration-analysis-v1.md) and [learning progress](../reports/learning-progress-v2.md) for the project implications.
Read the [complete results](../reports/corroboration-v1.md) and [verification record](../reports/corroboration-verification-v1.json) for measured outcomes and completed checks.
