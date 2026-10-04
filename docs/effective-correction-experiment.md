# Effective correction experiment

Use experiment six to decide whether explicit feedback earns stronger influence in Dossier.
Jamie is the only real product user. The synthetic lab supplies the primary model evidence.
The experiment leaves product recommendation defaults unchanged.

## Frozen question

Can Dossier honor general preferences, title exceptions, and direct comparisons without harming recommendation quality?
The preparation commit is `669fc82`. Its model remains the historical reference.

The frozen cohort contains 120 synthetic movie people and two sessions per person.
Half supply development results. Half supply reserved confirmation results with additional three-rule combinations.
Each partition includes multiple preferences, noisy explanations, partial explanations, missing factors, changing taste, and title exceptions.
The lab supplies 40 ratings and then replaces an earlier rating for the same title.
Only the latest rating trains the model, as in the app.

## Feedback meanings

| Feedback | Intended scope |
| --- | --- |
| General preference | Films matching the stated description |
| Title exception | One rated title |
| Direct comparison | Two rated titles |

The broad question queue uses supplied ratings and public descriptions.
Synthetic people can confirm, abstain, report an unknown factor, or give a misleading explanation.
Every scoring arm receives the same questions and supplied feedback.
Stored diagnostic feedback uses rated titles. Hidden evaluation ratings never enter a question or scorer.

## Scoring comparisons

| Arm | Behavior |
| --- | --- |
| Current | Stores experimental feedback without applying it |
| Native | Uses current claim feedback, rating replacement, and stored comparisons |
| Bounded | Adds small contributions, following the earlier personal-lens approach |
| Scoped | Gives explicit feedback priority within its stated scope |

Scoped scoring prioritizes direct comparisons, then title exceptions, then the most specific general preference.
Equally specific conflicting preferences retain the inferred score and expose the conflict.
Contradictory comparison graphs retain the preceding scores and expose the conflict.
General feedback promises directional influence, rather than universal ordering against every unrelated film.
Direct comparisons promise the requested ordering when both endpoints enter the candidate pool.

## Adoption requirements

Freeze all requirements before inspecting confirmation outcomes.
Each candidate needs a two-point mean ranking gain and a positive lower uncertainty bound.
The worst-performing tenth must remain within one ranking point of current scoring.
The noisy-explanation subgroup needs a lower gain bound of at least minus one point.
No observed feedback update may lose more than five ranking points.
At least half the confirmation people must supply accepted feedback.

At least 90 percent of each tested correction kind must produce its promised effect.
Scores outside its scope must remain unchanged.
Removal must restore inferred scores. Restoring the original feedback must restore its scores.
Encrypted export and import must preserve profiles and every arm's scores.
Product recommendations must remain identical before and after experimental feedback.

Passing supports an adoption review using the lab and Jamie's usability checks.
It does not automatically change product defaults. Failed requirements remain failures under this protocol.

## Run the experiment

To build and run the complete experiment, run:

```sh
pnpm lab:effective-correction
```

The command writes complete JSON traces and an executive Markdown report.
A limited replay cannot decide adoption:

```sh
pnpm lab:effective-correction -- --max-viewers 2 --output /tmp/effective-smoke.json
```

The [protocol](../apps/dossier-cli/benchmarks/effective-correction-v1-protocol.json) records hashes, candidates, and requirements.
The [preparation reference](preparation-baseline.md) preserves historical model and outcome comparisons.

## Experimental CLI actions

| Action | Arguments |
| --- | --- |
| `correction.inspect` | No arguments |
| `correction.set` | `id`, `kind`, the kind's fields, and `expectedRevision` |
| `correction.remove` | `id` and `expectedRevision` |
| `correction.suggest` | `arm`, optional `includeRated`, `limit`, and `cursor` |

General feedback uses `conditions` and a positive or negative `effect`.
Title feedback uses `key` and `effect`. Comparison feedback uses `winner` and `loser`.
Title feedback requires rated evidence. Reusing a target replaces its earlier feedback.
Resetting the profile clears experimental corrections.

To state a general preference in a CLI profile, run:

```sh
pnpm cli correction set --id heist --kind general --effect positive \
  --conditions '[{"kind":"tag","value":"heist"}]'
pnpm cli correction suggest --arm scoped
```

The first command stores feedback. The second returns experimental scores with applied feedback and any conflicts.
Existing `suggest list` output remains unchanged.

## Evidence limits

These are synthetic movies, not a population estimate or a book product test.
The evaluator tests known candidate films, rather than film retrieval.
Simulated explanations cover limited error patterns. They do not establish human response time or comprehension.
The control trials deliberately reverse feedback. They measure obedience, rather than whether the correction expresses true taste.
Correction scores report no confidence probability.

## Recorded outcome

No candidate passes every frozen requirement. Dossier retains its existing recommendation defaults.
Read the [executive decision](../reports/effective-correction-analysis-v1.md) for outcomes and the recommended next experiment.
Read the [measured results](../reports/effective-correction-v1.md) for policy comparisons and failed requirements.
