# Guarded correction experiment

Experiment seven tests protection against misleading broad preferences while preserving exact title and comparison controls.
Jamie is the only real product user. Synthetic lab evidence decides model eligibility without a recruitment requirement.
Ordinary Dossier recommendations remain unchanged during this experiment.

## Frozen question

Can rating evidence and follow-up review reduce misleading-feedback losses while preserving accurate-feedback gains and effective corrections?
Experiment six shows that precise control can coexist with poor ranking outcomes.
The new experiment retains its quality, correction, scope, removal, restoration, and portability requirements.

The cohort contains 160 fresh synthetic people, a fresh film catalogue, and two sessions per person.
The reserved group contains 80 people and three-rule combinations absent from the development group.
Each group includes multiple preferences, independent noise, partial explanations, missing factors, changing taste, title exceptions, persistent noise, and conflicting evidence.
Persistent-noise people repeat their misleading main answer during review.
Conflicting-evidence people have stronger unrepresented title factors, so honest broad preferences can conflict with ratings.

## Compared policies

| Policy | General preference behavior | Exact title and comparison behavior |
| --- | --- | --- |
| Current | Stores feedback without applying it | Unchanged scorer |
| Bounded | Adds the previous fixed contributions | Previous bounded controls |
| Scoped | Gives broad preferences priority within scope | Previous scoped controls |
| Guarded | Defers unsupported or conflicting preferences | Scoped controls |
| Reviewed | Asks a follow-up for deferred preferences | Scoped controls |

A preference needs review when fewer than four nonneutral matching ratings exist.
It also needs review when at least one quarter of matching nonneutral ratings contradict its effect.
The preview lists supporting titles, counterexamples, and reasons. Evidence counts do not represent confidence probabilities.
Supported preferences apply directly. Guarded preferences that need review remain pending.
Reviewed preferences that need review require an explicit apply, withdraw, or defer answer.

Review approval binds to the exact proposal and matching rating evidence.
Changing either invalidates approval. Withdrawal retains the proposal for inspection and removes its scoring influence.
Pending and withdrawn preferences must leave scores unchanged. Removal and restoration must preserve exact scores.
General effects apply only to matching descriptions. Title exceptions apply to one title; comparisons apply to their endpoints.

## Equal question budgets

Each policy has at most eight turns. A broad question or a follow-up consumes one turn.
The policies share a deterministic broad-question stream. Reviews do not expose additional ratings or hidden evaluation titles.
The reviewed policy can receive fewer broad answers because follow-ups consume its budget.
The report records both question types, active preferences, pending preferences, and withdrawals.

The actor can abstain or give a wrong review answer.
Independent-noise review answers use a separate deterministic random stream. Persistent-noise reviews repeat a misleading main answer.
Private preferences produce utterances only. No hidden ratings, private rules, or utilities reach scoring, preview, or question selection.

## Adoption requirements

Each candidate needs at least two ranking points of mean gain and a positive lower uncertainty bound.
The worst-performing tenth must stay within one point of current scoring.
Both noisy groups need a lower gain bound of at least minus one point.
No observed answer may lose more than five ranking points.
At least half the reserved people must have active supplied feedback.

At least 90 percent of each tested correction type must produce its promised effect.
Reviewed general correction trials deliberately approve both effects, exercising the actual review action.
Guarded trials receive no bypass. Deferred reversals count as ineffective control.
Title and comparison reversals remain identical across policies.

Each candidate must preserve at least 80 percent of scoped gain for accurate multiple preferences when that gain is positive.
Every scope, pending-score, removal, restoration, encrypted portability, ordinary-default, and rating-overwrite check must pass.
Passing earns an adoption review. It never changes product defaults automatically.
Reserved outcomes cannot become fresh confirmation evidence after tuning.

## Run and inspect

To build and run the complete experiment, run:

```sh
pnpm lab:guarded-correction
```

The command writes full JSON traces, a lossless compressed archive, and a Markdown report.
To check the development replay without deciding adoption, run:

```sh
pnpm lab:guarded-correction -- --max-viewers 2 --output /tmp/guarded-smoke.json
```

A limited replay reports `smoke_only`.
The [protocol](../apps/dossier-cli/benchmarks/guarded-correction-v1-protocol.json) records candidates, cohorts, and requirements.
The [reference](../apps/dossier-cli/benchmarks/guarded-correction-v1-reference.json) protects experiment six outcomes and the new inputs.

## Experimental CLI actions

The CLI stores general proposals through the existing `correction.set` action.
It adds these actions without changing ordinary `suggest.list` behavior:

| Action | Arguments | Output |
| --- | --- | --- |
| `correction.preview` | Required string `id`, identifying a stored general preference | Supporting titles, counterexamples, reasons, and signature |
| `correction.review` | Required strings `id`, `decision`, and `signature`; required integer `expectedRevision` | Reviews and new revision |
| `correction.suggest` | Required string `arm`; optional `includeRated`, `medium`, `limit`, and `cursor` | Experimental ranking |

`decision` accepts `apply`, `withdraw`, or `defer`. It has no default.
Use the exact signature from the latest preview. A changed preview rejects the review.
Review state supports at most 50 entries. Signatures support at most 100,000 characters.
Experimental ranking accepts `guarded` and `reviewed` in addition to the previous arms.
Resetting the profile clears proposals and reviews. Removing a proposal clears its review.
Encrypted export and import preserve proposals, approvals, withdrawals, and pending state.

To inspect a stored heist preference, run:

```sh
pnpm cli correction preview --id heist
pnpm cli correction suggest --arm reviewed
```

The preview explains why a general preference needs review. The ranking identifies pending, withdrawn, and applied proposals.
A stale preview or profile revision rejects a review; inspect the latest preview and revision before retrying.

## Evidence limits

The experiment evaluates known film candidates, rather than retrieval, television, response time, or human comprehension.
Simulated preview approval does not establish real usability. Jamie can review that separately.
Exact title and comparison controls use rated titles in diagnostic pools.
Hidden-film ranking gains therefore measure broad preferences, rather than transfer from those narrow controls.
