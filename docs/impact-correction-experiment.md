# Impact correction experiment

Experiment eight tests limited broad influence while retaining exact title and comparison controls.
Jamie is the only real product user. The synthetic lab supplies the model evidence; recruitment is not a requirement.
Ordinary Dossier recommendations remain unchanged during this experiment.

## Frozen question

Can limits prevent harmful broad updates without losing useful learning or effective correction?
Experiment seven shows that evidence-based deferral helps, but consistent examples and repeated approval still permit large losses.
The new experiment retains every prior adoption threshold and adds checks on declared limits and populated preference scope.

The cohort contains 200 fresh people, 200 fresh films, and two sessions per person.
The reserved group contains 100 people with three-rule combinations absent from development.
Each partition contains ten people in each of ten taste types.
The eight earlier types remain: multiple preferences, independent noise, partial explanations, missing factors, changing taste, exceptions, persistent noise, and conflicting evidence.

The consistent-misleading type supplies a biased library favoring high-tone dislikes and lower-tone likes.
It then confirms unrelated axis descriptions and repeats them during review.
The weak-rating type uses ratings of plus or minus one without changing underlying preferences.
These types test apparently convincing explanations and dependence on score scale.

Each session reveals 40 titles and rerates an earlier title through the application transition.
Eighty candidate titles remain hidden. Hidden ratings never train a model or select a question.

## Compared policies

| Policy | Broad preferences | Title and comparison controls |
| --- | --- | --- |
| Current | No experimental influence | Ordinary scorer |
| Scoped | Previous priority behavior | Original scoped behavior |
| Guarded | Previous evidence-based deferral | Original scoped behavior |
| Reviewed | Previous deferral and approval | Original scoped behavior |
| Impact guarded | Deferral plus scaled influence | Original scoped behavior |
| Impact reviewed | Review plus scaled influence | Original scoped behavior |
| Impact ranked | Review plus scaled influence and relation cap | Original scoped behavior |

Every experimental scorer disables public-quality, popularity, and serendipity contributions, matching the earlier experiments.
The new policies use the previous evidence guard and exact review signatures.
Follow-ups count against the same eight-question budget. New reviewed policies use the reviewed control's question schedule.
Approval never removes a limit.

## Influence limits

Scaled influence adds one signed contribution equal to ten percent of the baseline interquartile score spread.
The minimum spread is 0.001. The most specific active preference wins; equally specific opposing preferences abstain.
Matching preferences cannot stack past the limit. Their effect changes scores in the requested direction without promising universal ranking priority.

The ranked policy also limits changed ordering relationships to three per candidate film.
It checks raw scores and scores published by the CLI at three decimal places.
A change from a tie to an ordering counts as a changed relationship.
The policy halves all broad contributions until they fit, with at most 24 halvings.
If they still exceed the budget, it gives broad preferences zero influence and reports the limitation.

Rank checks compare against a baseline that retains the same exact title exceptions and comparisons.
They therefore include any propagated score changes through existing comparisons.
Explicit title and comparison changes retain their full authority and do not consume the broad budget.
Contradictory comparison cycles retain preceding scores and expose conflicts.

A shared ranking cap can attenuate older broad preferences when a new preference changes the budget.
The populated-profile scope trial measures this collateral effect. It remains an adoption failure if unrelated scores change.
The cap is a candidate mechanism, rather than an exemption from scope requirements.

Candidate-pool composition affects the spread and relation budget. Removal, restoration, and portability compare identical candidate pools.
A relation limit does not guarantee the accuracy loss bound for every possible distribution of hidden likes and dislikes.
The lab measures that bound separately.

## Adoption requirements

Each candidate needs at least two ranking points of mean gain and a positive lower uncertainty bound.
The worst-performing tenth must remain within one point of current scoring.
The independent-noise, persistent-noise, and consistent-misleading groups each need a lower gain bound of at least minus one point.
No observed answer may lose more than five ranking points.
At least half the reserved people must have active supplied feedback.

At least 90 percent of each correction type must produce its promised effect.
Reviewed trials deliberately approve both general effects through the actual CLI review action.
Guarded trials receive no bypass. Caps that block correction count as ineffective control.
Score changes that disappear at CLI precision also count as ineffective control.

Every candidate must retain at least 80 percent of scoped gain for accurate multiple preferences when that gain is positive.
All scope, pending-score, removal, restoration, encrypted portability, ordinary-default, and rating-overwrite checks must pass.
Scope trials include isolated corrections and corrections within populated multi-preference profiles.
New candidates must also obey their declared influence limits.
Passing earns adoption review without automatically changing defaults.
Reserved outcomes cannot become fresh confirmation evidence after tuning.

## Run and inspect

To build and run the complete experiment, run:

```sh
pnpm lab:impact-correction
```

The command writes full JSON traces, a lossless compressed archive, and a Markdown report.
To replay development people without deciding adoption, run:

```sh
pnpm lab:impact-correction -- --max-viewers 2 --output /tmp/impact-smoke.json
```

A limited replay reports `smoke_only`.
Read the [protocol](../apps/dossier-cli/benchmarks/impact-correction-v1-protocol.json) for frozen candidates, inputs, and requirements.
Read the [reference](../apps/dossier-cli/benchmarks/impact-correction-v1-reference.json) for protected earlier evidence and new inputs.

## Experimental CLI use

Existing proposal, preview, review, removal, and encrypted portability actions remain available.
The experimental `correction.suggest` action adds these `arm` values:

| Arm | Guard | Approval | Limit |
| --- | --- | --- | --- |
| `impact_guarded` | Existing evidence guard | No bypass | Scaled contribution |
| `impact_reviewed` | Existing evidence guard | Exact signed receipt | Scaled contribution |
| `impact_ranked` | Existing evidence guard | Exact signed receipt | Scaled contribution and changed relations |

To score an existing experimental profile with the new ranking cap, run:

```sh
pnpm cli correction suggest --arm impact_ranked
```

The output includes applied feedback, conflicts, review status, scale, attenuation, changed relation counts, and broad contributions.
It reports no confidence probability. A zero contribution can reflect a cap, pending review, or conflicting preferences.
Read the [review workflow](guarded-correction-experiment.md#experimental-cli-actions) for proposal signatures and allowed review decisions.

## Evidence limits

The experiment tests known synthetic film candidates, rather than retrieval, television, human comprehension, or response time.
The actor models limited error and sampling patterns. Approval does not establish explanation truth.
Title and comparison controls use rated diagnostic films. Hidden-film quality paths receive broad feedback only.
Published score precision and tied scores can block an otherwise directional change.

## Recorded outcome

No candidate passes every frozen adoption requirement. Ordinary recommendation defaults remain unchanged.
Scaled influence reduces observed losses and preserves control, but its gain falls short of the required two ranking points.
The shared ranking cap also fails correction and populated-profile scope requirements.
Read the [executive decision](../reports/impact-correction-analysis-v1.md) for the project recommendation.
Read the [measured results](../reports/impact-correction-v1.md) and [verification record](../reports/impact-correction-verification-v1.json) for evidence.
