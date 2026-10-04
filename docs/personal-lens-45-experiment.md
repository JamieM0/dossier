# Test question coverage and confirmed claims

Use experiment 4.5 to compare broader personal questions with confirmed existing claims while preserving user control and portability.

## Understand the experiment 4.5 hypothesis

Experiment 4 improves targeted synthetic rankings but fails the book-rule recovery gate. Its similarity threshold prevents some useful questions.

Experiment 4 also compares personal contributions of `0.3` with inferred claims. Native confirmed claims contribute at most `0.06` each.

Experiment 4.5 separates question coverage, explicit confirmation, score strength, and predicate language. It retains experiment 4's protocol and reports.

## Run experiment 4.5

To build the CLI and replay the frozen protocol, run:

```sh
pnpm lab:personal-lens-45
```

The command writes `reports/personal-lens-45-v1.json` and `reports/personal-lens-45-v1.md`.

The JSON records questions, answers, profiles, controls, and every session. The repository stores a lossless compressed copy for report audits.

To run a limited check without replacing the complete report, run:

```sh
pnpm lab:personal-lens-45 -- --max-viewers 2 --output /tmp/lens45-smoke.json
```

Limited runs return `smoke_only`. A `--cohort synthetic_books_development` filter also forces `smoke_only`.

## Compare the scoring arms

Every arm starts from the same 40 ratings and inferred claims. All broad arms share identical question answers.

| Arm | Behavior |
| --- | --- |
| `inferred` | Score from ratings and current inferred claims. |
| `narrow_personal` | Use experiment 4's queue and personal contribution. |
| `broad_personal` | Use broader questions and personal contribution. |
| `broad_native_claims` | Confirm matching claims already present in the inferred profile. |
| `broad_authored_claims` | Add missing claims through the existing language and native scoring. |
| `broad_shared` | Use personal contributions only for predicates with identical claim semantics. |
| `broad_claims_equal_strength` | Match existing claim predicates with the same contribution and cap as `broad_shared`. |

Native claims retain their evidence confidence and existing score caps. A missing inferred claim does not become available in `broad_native_claims`.

The authored control bypasses the inference cutoff without extending the claim language. It derives confidence from the current person's supplied ratings.

Claims cannot express decades. Their axis threshold is `0.3`; personal rules use `0.35`.

Shared controls exclude decades and axes. Their scores must match exactly, isolating score strength for predicates with identical semantics.

A separate control receives 50 ratings. People with fewer than 50 available training ratings do not enter equal-budget comparisons.

## Ask broader questions

The broader queue proposes supported patterns across all rated items. It removes the cosine eligibility threshold.

Each pattern has one or two predicates. It requires at least three supporting and three contrasting rated items.

The queue ranks patterns by smoothed polarity separation. It penalizes conjunctions and resolves ties by stable predicate identity.

Each prompt offers one pattern. This differs from experiment 4's shortlist of eight distinctions around a similar pair.

Confirmed features retire rated contrasts that they already explain. Rejected patterns remain recorded so the queue does not ask them again.

The queue memoizes descriptive evidence and confirmed features. This cache preserves question order and contains no hidden outcomes or public scores.

## Distinguish rejection from missing information

The `none` answer rejects the proposed pattern. It does not state that descriptive metadata lacks the important factor.

The `unknown` answer records an absent factor. Nearby candidates receive the same confidence cap as experiment 4.

Fresh synthetic people confirm only their exact causal predicate and effect. Missing-factor people answer `unknown`.

Recorded people answer `none` because their ratings do not reveal causal explanations. Their sessions provide regressions rather than human confirmation.

## Inspect the experimental CLI

Experiment 4.5 feedback lives in `settings.experimentalPersonalLens45`. It does not mutate the profile's baseline inferred claims.

| Action | Required arguments | Behavior |
| --- | --- | --- |
| `lens45.queue` | None | List supported-pattern questions. |
| `lens45.inspect` | None | Inspect features, rejections, and limitations. |
| `lens45.answer` | `id`, `answer`, `expectedRevision` | Supply `confirm`, `none`, or `unknown`. |
| `lens45.correct` | `id`, `effect`, `expectedRevision` | Supply `positive` or `negative`. |
| `lens45.remove` | `id`, `expectedRevision` | Remove a confirmed feature. |

Use the optional `experiment45` argument with `suggest.list`. Accepted values are the five broad scoring arms in the comparison table.

For example, run:

```sh
pnpm cli suggest --experiment45 broad_native_claims --limit 10 --json
```

Recommendation rows include `lens45Evidence`. This object records matching feedback, score adjustment, unavailable claims, confidence, and known limitations.

Experimental scoring disables public-score, popularity, and random contributions. It rejects combined geometry, Refine, or personal-lens experiment flags.

Omit the flag to retain default scoring. The CLI profile reset clears experiment 4.5 feedback.

## Preserve confirmation boundaries

Experiment 4.5 introduces 96 synthetic people. Each domain contains 24 development people and 24 reserved people.

Only the 48 reserved people support fresh confirmation gates. Previously inspected experiment 4 people provide regressions.

The protocol is `apps/dossier-cli/benchmarks/personal-lens-45-v1-protocol.json`. It records fixture hashes, candidate settings, budgets, and decision gates.

The generator refuses to replace frozen fixtures. The runner requires identical model and evaluator fingerprints throughout the replay.

Broader questions must improve recovery, ranking, interaction efficiency, and personal control in both reserved domains. Passing supports human confirmation only.

A separate attribution gate tests whether gains justify expanding beyond the existing claim language. It requires gains over native authored claims and shared personal predicates.

Synthetic people know exact causal rules. This study does not establish reliable human explanations or robustness to misleading confirmations.

## Run default regressions

To replay default synthetic, hard, TMDB, confirmation, and override behavior, run:

```sh
pnpm lab:personal-lens-45-regressions
```

The command writes `reports/personal-lens-45-regression-v1.json`. Earlier reports remain unchanged.

The override compatibility replay omits only its old model-identity guard. It retains fixture checks and requires unchanged baseline outcomes.
