# Test contextual taste

Use experiment 5 to test whether explicit contexts explain situated preferences while preserving user control, global claims, and portability.

## Review the earlier experiments

Experiments 1 through 4.5 each return `do_not_promote`. Experiment 5 retains their product defaults and frozen reports.

Experiment 1 removes rating-order dependence without passing ranking or viewer-protection gates. Experiment 2 learns Refine weights but fails correction and efficiency gates.

Experiment 3 estimates uncertainty inside the fixed representation. Its targeted questions underperform recognition-balanced random selection on fresh synthetic people.

Experiment 4 improves synthetic ranking with confirmed predicates, but its narrow question queue misses book preferences.

Experiment 4.5 broadens discovery and recovers every represented rule. Its scoring contribution still fails correction authority for some source pairs.

Experiment 5 therefore measures scoped control and evidence limitations alongside ranking. It does not combine the rejected candidates.

## Run the frozen protocol

To build the CLI and run experiment 5, use:

```sh
pnpm lab:contexts
```

The command writes `reports/contextual-taste-v1.json` and `reports/contextual-taste-v1.md`. The report states the decision and every confirmation gate.

The repository stores the lossless JSON as `reports/contextual-taste-v1.json.gz`. The command regenerates the readable JSON.

To run development checks without replacing the full report, use:

```sh
pnpm lab:contexts -- --cohort synthetic_movies_development --max-viewers 2 --output /tmp/contexts-smoke.json
```

Limited runs return `smoke_only`. They cannot promote a candidate, even when they include sealed people.

To replay default synthetic, hard, TMDB, confirmation, and override behavior, use:

```sh
pnpm lab:contexts-regressions
```

The regression command writes `reports/contextual-taste-regression-v1.json`. Successful default regressions report `passed: true`.

The historical override replay omits its old model-identity guard through a temporary compatibility copy. Fixture guards and outcome comparisons remain intact.

## Compare the four arms

Every fresh person supplies 20 explicitly global ratings and up to 20 ratings in each of four contexts.

| Arm | Behavior |
| --- | --- |
| `global` | Pool all ratings into the current scorer and reconcile claims over that evidence. |
| `recency` | Pool all ratings and apply the current maximum rating-recency decay. |
| `separate` | Score each context from its own ratings and claims. |
| `shared` | Retain the explicitly global scorer and fit a small residual from the requested context. |

A global query uses unscoped evidence for `shared` and `separate`. The pooled arms also use contextual evidence for global queries.

The shared residual fits normalized signed rating weights over the existing 10 axes and an intercept. Its targets subtract a global ridge prediction.

Both ridge fits use penalty six. Residuals require three actual ratings, shrink by `n / (n + 8)`, and stay within `±0.8`.

Watchlist and not-interested sentinels do not train the residual. Negative ratings remain normal learning evidence.

The global base uses explicitly unscoped evidence. Context ratings affect only their own residual and inferred claims.

This design tests a deliberate tradeoff: stable scope boundaries can sacrifice learning that pooled evidence would otherwise supply.

Separate profiles provide no recommendations until a positive rating exists. The shared arm inherits its global base immediately.

## Preserve the scoring boundary

The catalogue adapter supplies descriptive metadata only. Public scores, popularity, utilities, hidden factors, synthetic identities, and held-out answers never enter the scorer.

The domain scorer also removes public scores and popularity from candidates and rated snapshots. Public-score contributions remain disabled in every arm.

Recency uses the latest supplied evidence timestamp as its reference time. Wall-clock time cannot change experiment scores or encrypted roundtrip results.

Recorded people lack context labels. They provide regressions of unscoped behavior, rather than evidence for contextual preferences.

## Understand the fresh synthetic people

The new fixture contains 96 people: 48 development people and 48 sealed people. Each partition includes movies and invented books.

| Preference type | Purpose |
| --- | --- |
| `axis_switch` | Test preferences that reverse across situations along an existing axis. |
| `interaction_switch` | Test a metadata-and-axis interaction that the residual cannot directly express. |
| `stable` | Test whether contexts harm someone whose taste stays constant. |
| `drift` | Separate changes over time from changes across situations. |
| `sparse` | Test unequal context evidence and a completely unseen context. |
| `hidden_switch` | Test situated preferences driven by factors absent from the metadata. |

Contexts use `solo`, `family`, `comfort`, and `challenging`. The same title can receive conflicting ratings in different contexts.

Movie items reuse the existing lens. Book items use invented vectors and exercise the same generic residual mechanism.

Training items and held-out items remain disjoint. The same personal interaction budget supplies every arm.

Sessions vary evidence order through fixed seeds. Repeated sessions and contexts average within each person before bootstrap uncertainty estimates.

## Inspect user control

Experiment 5 stores context ratings in `settings.experimentalContexts`. Unscoped ratings retain the normal library representation.

The CLI supports these experimental actions. Mutations require the current `expectedRevision`.

| Action | Arguments | Behavior |
| --- | --- | --- |
| `context.create` | `context`, `name`, `expectedRevision` | Create a named context. |
| `context.rename` | `context`, `name`, `expectedRevision` | Replace the display name. |
| `context.rate` | `context`, `key`, `value`, `expectedRevision` | Set or correct a scoped rating. Use `global` for unscoped evidence. |
| `context.clear` | `context`, `key`, `expectedRevision` | Remove one contextual rating. |
| `context.remove` | `context`, `expectedRevision` | Remove a context and its ratings. |
| `context.inspect` | None | Inspect scoped ratings and inferred claims. |
| `context.suggest` | Optional `context`, `arm`, `medium`, `limit`, `cursor` | Get recommendations and residual evidence. |

Context IDs contain up to 40 lowercase letters, digits, underscores, or hyphens. They start with a letter; `global` remains reserved.

Display names contain one through 80 printable characters. Each profile supports at most 16 contexts.

Ratings accept Dossier's existing scale and sentinels. Item keys use `movie:ID` or `tv:ID`.

The optional `observedAt` argument on `context.rate` accepts a nonnegative integer timestamp in milliseconds. It defaults to the current time.

The `context.suggest` defaults are `shared`, movies, and 20 items. Omit `context` for a global query; `limit` accepts one through 100.

Recommendation evidence reports scope, evidence counts, base score, residual, shrinkage, and axis coefficients. Evidence status distinguishes global, unobserved, insufficient, and observed evidence.

Recommendation confidence remains `null`. Neither observed evidence nor a fitted coefficient establishes a calibrated preference probability.

The study corrects one contextual rating and measures score direction. It checks that another context and the global profile retain identical scores.

These checks do not test authoritative predicate correction or require every corrected item pair to reverse. Those limitations remain distinct from scope isolation.

The encrypted export preserves context identities, ratings, timestamps, and recommendation scores. Profile reset removes every experimental context.

## Preserve the decision gates

The protocol is `apps/dossier-cli/benchmarks/contextual-taste-v1-protocol.json`. It records fixture hashes, candidate settings, interaction budgets, and gates.

Each sealed domain must pass every gate independently. Context gains must exceed two AUC points against pooled global taste, with a positive lower interval bound.

The shared arm must beat recency on switching people and separate profiles on sparse people. Stable people require noninferiority within one AUC point.

Additional gates protect the worst decile, single-rating updates, correction direction, claim precision, scope isolation, removal, deterministic replay, and encrypted portability.

Scoped claim precision counts matching claim-item assertions. Claim confidence remains an uncalibrated proxy; these assertions can overlap on one item.

Passing supports human confirmation only. Failed gates retain the candidate behind experimental CLI actions and do not change product defaults.

Preserve the protocol after reading outcomes. A revised candidate or threshold requires a new version.

## Inspect the overwrite-baseline audit

The frozen pooled arms retain repeated rating observations. The current library instead replaces an earlier rating for the same title.

To reproduce the exploratory overwrite-baseline audit, run:

```sh
node apps/dossier-cli/scripts/contexts-diagnostics.mjs
```

The command writes `reports/contextual-taste-diagnostics-v1.json`. It records source hashes, session outcomes, and viewer-level intervals.

This audit does not change candidates, thresholds, or the frozen decision. Read it alongside the experiment results.
