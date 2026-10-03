# Test stable taste geometry

Use this experiment to test whether Dossier should infer the same taste structure from the same evidence, regardless of rating order.

## Read the decision

Open `reports/stable-geometry-v1.html`. The report states whether either deterministic grouping strategy earns an independent confirmation.

The experiment compares current Dossier with stable anchors and strict stable groups. It does not change the product default.

Neither candidate passed the frozen gates. Both removed rating-order dependence, but neither showed a reliable average gain or preserved the lower-performing tenth of viewers. Neither protected all five known backwards-learning sessions.

## Run the experiment

From the repository root, run:

```sh
pnpm lab:geometry
```

The command builds the CLI, replays the frozen rating sessions, and writes these files:

- `reports/stable-geometry-v1.html`: standalone decision report.
- `reports/stable-geometry-v1.json`: aggregate and per-viewer results.

The protocol is `apps/dossier-cli/benchmarks/stable-geometry-v1-protocol.json`. It fixes fixture hashes, strategies, evidence levels, rating-order count, and decision gates.

## Understand the comparison

Current Dossier builds taste groups in stored rating order. A rating joins the nearest existing group when it meets the similarity threshold.

Stable anchors first sort ratings by strength and stable item key. They then use the current greedy merge.

Strict stable groups use the same stable sort. A rating can join a group only when it meets the similarity threshold with every group member.

These strategies use only the user's ratings and Dossier's existing item representation. They do not use public reviews or add an external recommendation system.

## Preserve personalisation

The test supplies the same 40 ratings in 24 orders for each of 108 viewers. It requires identical taste profiles and candidate scores across all orders.

Stability alone is not enough. A candidate must also improve average hidden-rating order with a positive lower confidence bound. It must preserve the worst tenth of viewers.

All five known backwards-learning sessions replay after every added rating. Each candidate must improve their final scores, limit the total learning decline, and avoid a large single-rating loss.

The report also compares geometry construction at 40, 500, and 5,000 ratings.

## Keep the decision narrow

Passing every gate supports an independent confirmation. It does not authorize a product-default change.

Failing any gate rejects that candidate for now. Do not relax a threshold after reading the hidden outcomes.

The cohorts use recorded MovieLens ratings and a frozen TMDB catalogue. The experiment measures ranking among known items, not catalogue retrieval or a new population.
