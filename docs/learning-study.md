# Compare what helps Dossier learn taste

Use this study to locate model weaknesses before changing recommendation defaults. It repeats the same recorded ratings with two film metadata sources.

## Run the study

From the repository root, run:

```sh
pnpm lab:study
```

The command builds the CLI and runs both metadata conditions. Each condition contains 124 learning sessions and six evidence checkpoints. It also tests questions, belief correction, and damaged evidence.

The command writes these reports:

- `reports/dossier-learning-study-current.html`: a standalone report with decisions, scores, and failure examples.
- `reports/dossier-learning-study-current.json`: the combined results and recorded session measurements.
- `reports/dossier-learning-study-current-bundled.json`: detailed results with the original film descriptions.
- `reports/dossier-learning-study-current-tmdb.json`: detailed results with Dossier's usual TMDB metadata.

The HTML works without a server or internet connection. Its download button exports the combined results.

The original TMDB study is now frozen. Use the [confirmation experiment guide](confirmation-experiment.md) for its dedicated regression command.

## Compare a model change

Use the saved study reference to compare a change:

```sh
pnpm lab:study \
  --prefix reports/dossier-learning-study-candidate \
  --reference apps/dossier-cli/benchmarks/learning-study-reference.json
```

The comparison refuses different hidden ratings, evidence orders, or scoring procedures. It reports changes for each viewer, cold starts, belief correction, and questions.

Use public reviews as the minimum comparison. Show both average results and individual regressions. Treat small fluctuations as advisory.

The study tests 11 fixed ranking methods. These methods change claims, taste grouping, dislike penalties, review weights, or film similarity. Component scoring uses Dossier's exported scorer. Its unchanged scores must match CLI recommendations after normal rounding.

The component experiments do not change product defaults. Confirm a selected method on new viewers before adoption. Reusing these hidden answers to choose methods can inflate their apparent benefit.

## Keep the input fixed

Both fixtures contain the same 31 viewers and 60 hidden ratings per viewer. Training ratings remain separate from hidden ratings.

The original fixture uses bundled BestSimilar descriptions. The TMDB fixture uses full details through Dossier's metadata client. MovieLens links identify each title.

The TMDB snapshot contains director IDs for 1,735 films and collection membership for 477. Its public details contain no personal ratings.

One source entry, Band of Brothers, is a TV miniseries. The adapter uses its TV details and preserves the original evaluator key. It appears only among viewer 414's training candidates.

The adapter checks changed titles, release years, and moved identities against IMDb IDs. All 52 checked identities match. Evaluator film keys are local identifiers; do not use them as live TMDB IDs.

To create a new metadata snapshot, run:

```sh
node apps/dossier-cli/scripts/freeze-tmdb-benchmark.mjs \
  --movielens-zip /path/to/ml-latest-small.zip \
  --checkpoint /path/to/new-metadata-cache \
  --output /path/to/new-fixture.json
```

The command reads the saved CLI credential from Keychain. It writes public metadata only. Keep the frozen fixture unchanged for regression comparisons.

## Understand the limits

The main score measures how often a liked hidden film ranks ahead of a disliked hidden film. Higher is better; chance scores 50%.

The first-ten measure counts clearly liked films among ten suggestions. It does not estimate the success of recommendations across all unseen films.

MovieLens viewers selected the films they rated. The cohort includes frequent raters with many dislikes, so it does not represent every future user.

Current public reviews and popularity postdate these historical ratings. Candidate retrieval is outside this study. Real users may not recognise the titles a calibration strategy selects.

The uncertainty ranges resample viewers after averaging their sessions. Repeated sessions do not count as independent people. Multiple experimental methods make small winning margins exploratory.

Retain damaged-evidence checks even when their average passes the threshold. Damage can improve a session that already learns poorly. Threshold crossings alone do not establish trust.

## Source and attribution

MovieLens ratings come from GroupLens. The original conditions appear in `apps/dossier-cli/benchmarks/MOVIELENS-README.txt` and the HTML report.

The source archive, rating conversion, and selection rules remain those of the [real film benchmark](real-benchmark.md).

This product uses the TMDB API but is not endorsed or certified by TMDB. TMDB supplies the frozen public film details.
