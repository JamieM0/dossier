# Check reviews plus tags on new viewers

Use this experiment to decide whether the fixed candidate merits further work. Its mandatory comparison is public reviews.

## Read the decision

Open `reports/reviews-plus-tags-decision.html`. The report leads with the decision, average benefit, individual losses, and the next action.

The main comparison uses 20 training ratings and 60 hidden films per viewer. Higher ordering scores are better; chance scores 50%.

The candidate keeps its original 75% public-review and 25% tag-matching weights. The experiment does not search for better weights or add inference rules.

## Repeat the experiment

From the repository root, run:

```sh
pnpm lab:confirm
```

The command builds the CLI, repeats the confirmation sessions, reproduces the five frozen failures, and writes the executive report.

The output files are:

- `reports/reviews-plus-tags-decision.html`: the standalone decision report.
- `reports/reviews-plus-tags-decision.json`: the report data, including individual results and diagnoses.
- `reports/reviews-plus-tags-confirmation-v1.json`: complete learning sessions and primary scores.
- `reports/backwards-learning-diagnosis-v1.json`: rating traces, score contributions, and diagnostic interventions.

The confirmation cohort contains 47 viewers excluded from the earlier 31. Every eligible new viewer participates. Each viewer supplies ratings in four fixed orders.

The fixture and candidate hashes appear in `apps/dossier-cli/benchmarks/confirmation-v1-protocol.json`. The checks fail if either changes.

This cohort is now used. Repeating it checks regression and reproducibility. Use a separately frozen cohort for the next confirmation after method selection or tuning.

## Keep the TMDB reference frozen

Run the original TMDB regression benchmark with:

```sh
pnpm lab:tmdb --output reports/tmdb-regression-current.json
```

The reference is `apps/dossier-cli/benchmarks/tmdb-study-v1-reference.json`. It contains the original scores and hashes for the data and evaluation procedure.

The command refuses changes to the fixture or scoring procedure. Model changes remain allowed and produce comparisons with the original results.

The original HTML and result stay unchanged. The older `lab:study` command now writes files with a `dossier-learning-study-current` prefix.

## Interpret individual losses

The report compares each viewer with public reviews and current Dossier. A gain against one method can hide a loss against the other.

The unusual-taste group uses training ratings only. Public reviews score at most 60% on those training preferences. Hidden answers do not select the group.

The group contains eight viewers. Its uncertainty remains wide. Do not infer protection for every unusual taste from its average.

Individual flags mark losses over three ranking points or one liked film per ten suggestions, averaged across orders. Flags guide investigation; they do not block development automatically.

## Diagnose backwards learning

The diagnostic replay uses the five largest declines from the frozen TMDB report. It checks recommendations after every rating.

The replay reconstructs each returned score from liked-film matching, dislike penalties, public reviews, and claims. It then changes one contribution at a time.

Eight combinations of earlier and later contributions account for interactions. Separate tests keep film descriptions, group strength, or existing claims fixed.

Twelve reordered libraries keep the same 40 ratings and claims. Differences then come from the grouping code's dependence on order.

These tests identify mechanisms in specific failures. They do not supply a deployable safeguard. The original model must reproduce the frozen endpoints for this diagnostic run.

Keep new inference rules paused. Validate a targeted correction or a safeguard without hidden answers before changing that boundary.

## Write reports for decisions

Start each experiment report with a recommendation and the evidence that supports it. State the benefit, uncertainty, individual losses, and the next action.

Use public reviews as the mandatory comparison. Explain each metric in terms of recommendation outcomes. Keep methods, all-user tables, and diagnostics in collapsed supporting sections.

Do not present a mean improvement as protection for every viewer. Name unresolved risks and separate measured mechanisms from proposed fixes.

## Source and limits

The viewers come from the same pinned MovieLens archive and frozen TMDB catalogue. They are new individuals, not a new external population.

The source records films viewers chose to rate. The experiment does not measure all unseen films or candidate retrieval.

We average sessions within each viewer before calculating uncertainty. Repeated orders do not count as independent people.

Before inspecting new outcomes, an arithmetic correction made the candidate exactly match all 7,440 original scores checked. No weight changed. We discarded the preliminary run.

MovieLens use conditions appear in the report and `apps/dossier-cli/benchmarks/MOVIELENS-README.txt`. TMDB attribution also appears in the report.

## Test protection for unusual tastes

Use the [override experiment](override-experiment.md) to test whether supplied ratings justify a more personal ranking. The candidate weights stay fixed.
