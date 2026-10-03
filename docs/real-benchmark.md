# Run the real film benchmark

Use this benchmark to compare Dossier versions on the same recorded film ratings. It uses anonymous MovieLens viewers and real film records from Dossier's bundled catalogue.

## Recreate the fixed cohort

The frozen cohort is in `apps/dossier-cli/src/lab/real-v1.json`. You do not need to download MovieLens to run it. To rebuild the cohort from its source, download the [2018 MovieLens small archive](https://files.grouplens.org/datasets/movielens/ml-latest-small.zip) and run:

```sh
python3 apps/dossier-cli/scripts/generate-real-benchmark.py \
  --movielens-zip /path/to/ml-latest-small.zip
```

The generator checks the archive's SHA-256 hash. It matches films by normalized title and exact release year. It excludes ambiguous matches.

The cohort includes every viewer with at least 150 matched ratings, 40 clear likes, and 40 clear dislikes. Each viewer has 60 ratings held back for scoring. The split stays fixed across runs.

## Run the benchmark

From the repository root, run:

```sh
pnpm lab:real --output reports/dossier-real-v1-baseline.json \
  --html reports/dossier-real-v1-baseline.html
```

The command builds the CLI and runs the lab through its action handler. It writes a JSON result and a standalone HTML report.

To compare a model change with the saved result, run:

```sh
pnpm lab:real --reference apps/dossier-cli/benchmarks/real-v1-reference.json \
  --output reports/dossier-real-v1-new.json \
  --html reports/dossier-real-v1-new.html
```

The comparison refuses a different cohort, test procedure, or evidence order. Keep the `real-v1` fixture fixed. Create a new version if you change the film match, viewer selection, or scoring rules.

## Read the result

The main score asks whether Dossier ranks a clearly liked hidden film above a clearly disliked hidden film. Chance scores 50%. Higher is better. The report also counts clear likes among the first ten suggestions.

The benchmark maps MovieLens stars to Dossier ratings. Four or more stars count as a clear like. At most 2.5 stars count as a clear dislike. Three and 3.5 stars count as neutral in the main score.

Each viewer supplies ratings in four fixed random orders. The report shows scores after 1, 3, 5, 10, 20, and 40 ratings. It compares Dossier with public film rating, popularity, genre preference, average film style, similarity to rated films, and random order. A separate method uses ratings from other MovieLens viewers. That method has information Dossier does not have.

The report also tests claim revision, Dossier's rating questions, and damaged evidence. It lists the viewers with the lowest scores and the films Dossier placed badly.

The report also checks film pairs whose public review scores differ by at most 0.5 out of 10. This helps separate personal taste from public reputation. Its uncertainty ranges resample viewers after averaging their sessions, so repeated sessions do not count as independent people.

## Understand the limits

MovieLens viewers chose which films to rate. The hidden films are a sample of those rated films, not of every film they might watch. Dossier's catalogue matches only some MovieLens films. The bundled film records lack director and series fields. These limits can change the ranking task.

This benchmark uses bundled BestSimilar film descriptions instead of live TMDB descriptions. The adapter translates `Sci-Fi` to `Science Fiction` and `Musical` to `Music`. The ratings come from historical viewing records and can include changes in taste.

The CLI receives public film details and selected training ratings. It does not receive held-out ratings, the viewer's MovieLens ID, or other viewers' ratings. The evaluator keeps those values for scoring.

The MovieLens data comes from GroupLens. Read its [dataset description and conditions](https://files.grouplens.org/datasets/movielens/ml-latest-small-README.html) before sharing derived ratings. GroupLens requires attribution, disallows claims of endorsement, and requires permission for commercial use. The report does not imply GroupLens endorsement.

The original dataset conditions and attribution are in `apps/dossier-cli/benchmarks/MOVIELENS-README.txt`. The standalone HTML report includes them.
