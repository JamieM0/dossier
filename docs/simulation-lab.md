# Run the simulation lab

The simulation lab measures how the Dossier CLI learns from synthetic film ratings. It runs offline with a fixed catalogue.

## Run a trial

From the repository root, run the lab:

```sh
pnpm lab -- --output ./lab-report.json
```

The command writes a JSON report and prints a short metrics summary. It uses 48 people by default.

The macOS CLI zip also includes `./bin/dossier-lab.js`. Run it with the same flags after extraction.

To check that the evaluator responds to damaged evidence, run one person through five conditions:

```sh
pnpm lab -- --sensitivity --output ./lab-sensitivity.json
```

The conditions use one rating, three coherent ratings, 10 coherent ratings, 10 ratings with five reversed, and 20 coherent ratings. The evaluator scores 20 held-out titles. `heldoutAuc` measures whether Dossier scores liked titles higher than disliked titles. A value of 0.5 is chance. The command also reports top-10 hits and `ndcg10`. Dossier never receives the held-out ratings.

To run all 24 designed people and 240 variations, use:

```sh
pnpm lab -- --users 264 --variations 10 --seed 42 --clones 4 --output ./lab-report.json
```

The lab uses the CLI action handler for `profile.create`, `rate.set`, `rate.queue`, `suggest.list`, and claim inspection. Each trial starts with an empty profile. The harness supplies only title metadata to Dossier. The hidden rating function stays in the evaluator.

The lab injects a fixed catalogue at the CLI's TMDB boundary. It reserves 48 titles for recommendations and asks ratings from the other 144. It does not need a TMDB credential or write to your CLI profiles.

## Read the report

The `metrics.coldStart` object reports results after 3, 5, 10, 20, and 40 ratings. `hit10` is the share of recommended titles that the hidden person likes. An empty list scores zero. `ndcg10` gives higher weight to liked titles near the top. `randomBaseline` is the share of liked titles in the held-out catalogue. `recommendationCoverage` is the share of people who receive 10 recommendations.

`metrics.calibrationAt20` compares Dossier's active rating queue with random selection. Both arms start with the same five ratings. The metric measures recommendation quality after 20 total ratings.

The correction trial finds a genre with liked and disliked titles. It gives Dossier five liked titles first, then up to 10 disliked titles. `claimCorrectionRate` measures whether wrong early claims become inactive or lose at least 0.2 confidence. `correctionEligibleUsers` counts people with enough titles for this trial.

The clone trial gives each person several different rating sets. Each clone receives recommendations from the same held-out titles. `cloneTop10Overlap` measures pairwise overlap among top 10 lists after 20 ratings. `cloneHit10Range` measures the mean pairwise difference in hit rate.

`designedProfiles` groups each design with its variations. `worstUsers` lists low-scoring people and their hidden ratings. The `users` array keeps each person's checkpoint results, active prompts, claims, and recommended title IDs.

## Interpret the limits

The catalogue contains 192 invented titles with fixed genres, tags, and feature vectors. Hidden preferences use those fields plus a few interaction rules. One profile changes preferences between rating blocks to test mood shifts. This makes the score reproducible, but it can overstate performance on real titles and real people. The generated variations share their designed profile's basic preferences. Treat changes between runs as local regression evidence, not a population estimate.

One representative rating can produce a high score for a single person. Use several people and evidence orders to assess cold-start learning.

Keep the same seed, catalogue, and people when comparing code revisions. A changed fixture or scoring rule creates a new benchmark. The report includes a schema version, seed, catalogue size, and person count.
