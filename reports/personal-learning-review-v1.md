# Personal learning review

Dossier now learns signed distinctions from personal ratings, descriptive metadata, and saved comparisons.
Ordinary recommendations use those distinctions alongside existing taste clusters.
A bounded recent-feedback adjustment activates only after it predicts subsequent observed feedback better than older evidence.
The changes preserve Dossier's purpose: learn a person through their choices.

This report records the October 9, 2026 review, experiments, adoption judgment, and limitations.
Jamie remains the only real product user.
No release or installation occurs in this task.

## What the existing system missed

The previous default groups liked and disliked titles through ten shared lens axes.
It rewards similarity to liked clusters and penalizes the strongest disliked-cluster match.
Saved Refine comparisons affect ordinary recommendations only through an experimental flag.
That leaves useful personal evidence outside the default learner.

Jamie's GUI library contains 115 likes, 16 dislikes, 172 watchlist entries, 462 exclusions, and one neutral entry.
It also contains 99 saved comparisons.
Exclusions mean expected dislike, as Jamie confirmed. Their existing negative weight remains intact.
Watchlist evidence retains its existing weak positive weight of 0.15.
Public ratings retain their existing default weight of 0.05.

Removing exclusions improves the old scorer's held-out accuracy, despite discarding evidence Jamie wants it to learn.
That result diagnoses a scoring problem. It does not justify removing negative feedback.
The new learner improves accuracy while retaining that evidence.

Metadata refreshes previously wrote ratings again and replaced their timestamps.
One saved minute contains 240 entries. This pattern makes chronological inference unreliable.
Refreshes now preserve rating values and timestamps, and reject stale updates after feedback changes or clears.

The lens assigns higher realism-axis values to fantastical settings.
Display labels now respect that direction, including claims saved by older builds.
Historical inference labels remain intact for reproducible experiments; display conversion preserves claim IDs and evidence.

## What earlier experiments established

The historical studies did not adopt a new product baseline.
Their failures remain recorded in the original reports.

| Experiment | Result and implication |
| --- | --- |
| [Recommendation review](recommendation-progress-v1.md) | Accuracy varies substantially across real historical viewers. More feedback can worsen rankings. |
| [Refine signal](refine-signal-v1.md) | Axis-metric comparisons add about 0.14 points; cluster-metric comparisons lose about 0.13 points. Correction authority remains weak. |
| [Question selection](question-policy-v1.md) | Targeted questions perform worse than random questions and narrow coverage. |
| [Personal lens](personal-lens-v1.md) | Explicit metadata distinctions show large gains, but recovery and protection requirements fail. |
| [Broader personal lens](personal-lens-45-v1.md) | Represented preferences can transfer. Corrections still lack dependable authority. |
| [Shared contexts](contextual-taste-v1.md) | Context separation helps, but shared learning retains failures. |
| [Effective corrections](effective-correction-v1.md) | Broad corrections trade useful control for collateral damage. |
| [Guarded corrections](guarded-correction-v1.md) | Stronger guards restrict control without removing all damage. |
| [Impact corrections](impact-correction-v1.md) | Scaling correction influence adds about 1.1 points, short of the frozen target. |
| [Learning stability](learning-stability-v1.md) | Local learning improves averages but retains large losses. Recent evidence helps adaptation. |
| [Corroboration](corroboration-v1.md) | Support guards worsen some update disruption. |
| [Rating influence](rating-influence-v1.md) | Narrow matching, exceptions, and additive evidence fail confirmation. The report recommends supervised axes and tags. |

These findings support learning distinguishing signals from observed feedback.
They do not support increasing public-rating influence or assuming generic popularity reflects Jamie's taste.

## The adopted learner

The learner fits ten signed lens axes, recurrent genres, and recurrent tags against personal rating weights.
Its vocabulary comes from training entries, with at least three supporting observations and at most 96 tags.
Public ratings and recommendation candidates never enter the fit.
Regularization limits unstable coefficients. Stored ratings remain authoritative and unchanged.

Saved comparisons add difference examples between observed titles.
The latest corrected choice replaces the earlier choice for that pair.
Removing feedback removes its contribution when the learner rebuilds.
The comparison-aware version sacrifices a small average gain against the ratings-only version to support transferable Refine feedback.

Balanced positive and negative evidence controls the learner's influence beside the existing clusters.
Neutral actions cannot inflate that influence.
Clusters retain distinct taste areas while the learned distinctions acquire support.
Existing public-rating, discovery, and claim adjustments remain separate terms.
Explicit temporal dials retain the historical cluster-decay policy.

Automatic recent learning uses the latest 12 watched ratings.
It requires recent feedback, at least 30 days of history, and observations across at least four days.
Training and validation halves each require positive and negative feedback.
The recent fit must reduce error on subsequent observed feedback by at least 20%.
Its adjustment reaches at most 25% influence. It never asks for a mood declaration.

This mechanism detects supported preference departures. It does not establish an emotional state or read an unexpressed mood.
Jamie's existing history leaves it inactive because the last observed feedback is stale.

## Results from Jamie's held-out feedback

The private audit runs three shuffled, stratified five-fold replays through the CLI.
Each replay hides watched ratings and comparisons involving those titles.
Inferred claims rebuild from training alone. Saved confirmations do not enter these replays.
The learner scores candidates from their public descriptions.
The audit imports temporary encrypted exports and verifies that the original GUI library remains byte-identical.

| Method | Pair-weighted held-out accuracy |
| --- | ---: |
| Previous clusters, all evidence | 59.39% |
| Signed axes | 65.44% |
| Descriptive distinctions | 71.23% |
| Balanced descriptive distinctions | 71.05% |
| Balanced comparisons, adopted enduring component | 70.09% |

The adopted enduring component gains 10.70 percentage points over the previous default.
A separate replay through the actual default CLI path reproduces 70.09%, across 150 CLI actions.
The audit uses known watched titles that Jamie selected. They do not measure acceptance of unseen recommendations.
Repeated folds from one person are not independent people. No population confidence interval follows from this audit.
Private titles, preference weights, and decrypted data remain outside repository reports.

## Fresh synthetic and historical results

Each experiment uses separate catalogues and people for development, selection, and confirmation.
Each reserved cohort contains 60 people and 120 sessions.
Training and recommendation titles are disjoint.
Fixtures include conflicting ratings, sparse evidence, novel tastes, duplicate metadata, changing preferences, and unavailable private factors.
Sources, settings, fixtures, and criteria freeze before reserved results.
Lossless compressed traces retain every step and score.

Accuracy measures how often a held-out positive title outranks a held-out negative title.
Reported gains use percentage points. Bootstrap intervals aggregate sessions within each person.

| Frozen candidate | Selection gain | Confirmation gain | Frozen gate |
| --- | ---: | ---: | --- |
| Direct descriptive fit | +4.19 | +3.20 | Fails largest-update requirement |
| Balanced comparison fit | +3.26 | +2.86 | Fails largest update; confirmation also fails weakest-tenth requirement |
| Automatic recent comparison fit | +4.45 | +5.48 | Passes both fresh temporal cohorts |

The balanced comparison fit reduces large-loss frequency in both cohorts, but its worst update is sharper than the old scorer.
Confirmation weakest-tenth accuracy falls 2.32 points. Missing private factors account for substantial weakness.
Jamie explicitly authorized experimental judgment instead of rigid theoretical loss preferences.
Adoption rests on personal held-out gains, repeated average gains, and useful comparison transfer.
The conservative failures remain failures in the frozen reports.
An initial development replay placed novel feedback too late. Its preserved trace does not support adoption.
Corrected development runs precede the frozen reserved trials.

The temporal cohorts provide additional fresh evidence for the adopted combined method.
The combined method's weakest tenth improves 3.21 and 3.24 points against the old scorer.
Its largest losses are smaller than the old scorer's in both temporal cohorts.
It causes more large updates than the enduring component alone, but fewer than the old scorer.

During the early changing-taste window, recent adaptation adds 2.25 points in selection and 1.38 points in confirmation.
These gains compare against the balanced comparison fit, rather than the old scorer.
This window analysis is diagnostic and does not replace the frozen endpoint criteria.

All five archived failure endpoints improve under the balanced comparison fit, averaging 9.09 points.
The largest historical loss improves from 22.08 to 19.48 points.
Some histories still deteriorate as ratings accumulate. Historical recovery remains incomplete.
Unavailable private preferences cannot follow from identical public metadata.
The fitted weights describe conditional associations, rather than demonstrated causes.

## Evidence and reproduction

Read the compressed [direct-fit selection](learned-taste-v1-selection.json.gz) and [confirmation](learned-taste-v1-confirmation.json.gz) traces.
Read the [balanced selection](learned-taste-v2-selection.json.gz) and [confirmation](learned-taste-v2-confirmation.json.gz) traces.
Read the [temporal selection](recent-taste-v1-selection.json.gz) and [confirmation](recent-taste-v1-confirmation.json.gz) traces.
The [historical replay](balanced-taste-v2-historical.json) records the five earlier failures.

Frozen references and exact source archives live under `apps/dossier-cli/benchmarks`.
Replay a frozen experiment with its archived sources in a separate checkout.
The runners reject changed source hashes and existing output paths.
Inflate compressed development traces when reproducing their original reference paths.
Do not replace completed reports or reuse reserved results for tuning.

The private audit script is `apps/dossier-cli/scripts/personal-evidence-audit.mjs`.
Run it with `--learned --balanced --output /private/tmp/NEW_REPORT.json` from the repository root.
It requires read-only access to the GUI library's existing Keychain key.
It preserves the original encrypted file and deletes temporary encrypted exports.
Use `--base` to compare ordinary default recommendations against the historical cluster baseline.

The work exercises more than 280,000 CLI actions across the new synthetic trials.
Tests cover comparison correction, encrypted round trips, evidence removal, deterministic fitting, public weights, and stale metadata updates.
Independent new-trace audits reconstruct 43,200 supplied ratings, 144,000 ranking measurements, and 574,860 sampled scores.
Build checks include TypeScript and the native Rust command bridge.
Desktop Playwright checks capture full and focused screenshots, with structured clipping audits.
The [desktop capture](qa/personal-learning-v1/personal-recommendations-desktop.png) and [saved-claim capture](qa/personal-learning-v1/realism-display-card.png) contain synthetic QA fixtures.
A synthetic performance run scores 200 candidates against 766 ratings in 33 milliseconds median, with a 64-millisecond maximum.

Historical tests explicitly select the frozen cluster baseline where parity requires it.
The approved stability audit validates the exact archived CLI dispatcher against its original frozen hash.
Current CLI integration tests validate the adopted default.

Final validation passes 175 unit tests, 70 historical and new-trace audits, and 16 distinct desktop Playwright checks.
TypeScript checks, production builds, and the offline native Rust check pass.
Documentation checks report zero errors and warnings. The encrypted GUI library remains byte-identical.
