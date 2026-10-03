# Run the hard taste benchmark

Use this benchmark to compare Dossier revisions on the same synthetic people. Run it from the repository root.

## Run the fixed benchmark

```sh
pnpm lab:hard --output /tmp/dossier-hard.json --html reports/dossier-hard.html
```

The command builds the CLI, runs the benchmark, and writes a JSON result and a standalone HTML report. The HTML contains the full result data and needs no server or network connection.

The benchmark uses 18 fixed people, 288 invented film titles, and 72 held-out titles per person. It tests four rating orders per person at 1, 3, 5, 10, 20, and 40 ratings. It also runs five claim revision trials, paired calibration sessions, and five damaged-evidence conditions.

The fixture lives in `apps/dossier-cli/src/lab/hard-v1.json`. Keep it fixed when comparing model revisions. If you change its people, titles, or rating rules, create a new benchmark version.

## Compare a new revision

Use the stored reference to measure changes from the current baseline:

```sh
pnpm lab:hard --reference apps/dossier-cli/benchmarks/hard-v1-reference.json \
  --output /tmp/dossier-hard-new.json --html reports/dossier-hard-new.html
```

The report compares overall AUC at 20 ratings, AUC after three ratings, claim correction, calibration, and each person. It rejects comparisons with different fixtures, evaluator code, or rating seeds. Model changes produce a different model fingerprint.

Treat changes smaller than three AUC points for one person as inconclusive. Use the full result distribution and failure records before changing the model.

## Read the measurements

The main score is AUC on titles Dossier did not rate. It asks whether Dossier ranks a title the person likes ahead of one they dislike. AUC excludes neutral ratings. Chance ranking scores 0.5. The report averages people and rating orders, so people with more positive titles do not get more weight.

The report also gives precision at 10, recall at 10, graded nDCG at 10, recommendation coverage, high-ranked disliked titles, and high-confidence claim mistakes. It shows the spread across people. Low coverage reduces the raw count of rank mistakes, so compare that count with coverage. Dossier scores are ranking scores, not predicted ratings, so the benchmark does not report rating MAE.

Five simple baselines use the same ratings and public title metadata. They rank by popularity, genre, average vector, nearest liked title, or seeded random order. They do not use hidden ratings.

The per-person gap uses the strongest baseline for that person after scoring. This forms a diagnostic ceiling and is not a strategy Dossier could choose without hidden ratings.

The active calibration trial shares five initial ratings between two arms. One arm rates titles from Dossier's `rate.queue` action. The other rates randomly chosen titles from the more popular 75% of the unseen training pool. The report compares their later AUC on the same held-out titles.

The belief trial selects an active claim with at least five matching held-out titles. At least four must contradict the claim, and counterexamples must make up at least 40% of those titles. The trial then adds matching counterexamples from the training pool and records the claim and ranking changes.

The damage trials reverse half the ratings, shuffle rating values, remove strong ratings, inject contradictions, or reduce 20 ratings to five. A healthy benchmark should show lower scores on average. Inspect the per-person exceptions too.

## Understand the boundary

The benchmark calls the CLI action handler for profile creation, ratings, recommendations, calibration questions, coverage, and claim inspection. It creates every profile with the same neutral name. Its catalogue adapter gives Dossier public title metadata. It rejects any attempt to rate a held-out title.

The frozen fixture stores hidden ratings and latent title properties outside that adapter. The adapter computes lens vectors from public genres, keywords, and overviews, as the live TMDB client does. The evaluator reads hidden ratings only to supply a selected training rating or to score a completed recommendation. This is an in-process boundary, so code review and the fixture checks remain necessary.

These people and titles are synthetic. Several hidden preferences use rules absent from Dossier's title metadata, such as a story's ending or the quality of its craft. This makes the test harder and exposes representation limits. It does not estimate performance on real users or real films.
