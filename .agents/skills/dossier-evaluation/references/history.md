# Historical comparisons

## Select history before judging the result

Keep one `run.json` manifest per primary execution in `reports/evaluations/<run-id>/`.
Assign a monotonically increasing `sequence` before examining outcomes. Preserve creation time, source hashes and exact source paths.

Import existing result sets once when the registry is empty. Preserve their original JSON and record file hashes.
Use recorded dates or documented experiment dependencies to establish their sequence. Record that evidence as `chronologyBasis`.
Leave `completedAt` null for an import whose original completion date is unknown. Never substitute file modification time.
Do not invent a second historical run when only one exists.

The two highest earlier sequences are the two most recent valid result sets. Show them separately, even when a particular metric is absent.
The older-history mean uses all remaining compatible result sets. State the number used and list exclusions.
Exclude discarded trials, verification repeats and incomplete runs from the primary history. Keep their records available for audit.

An imported historical result can cover fewer families than the new full run. Its absent metrics remain unavailable.
Never describe a used viewer group as new confirmation after its first evaluation.

## Comparison boundary

Compare a metric only when these fields match:

- benchmark and cohort identity, including hidden-film selection;
- public metadata snapshot and evidence orders;
- evaluator and metric definition;
- method identity, including fixed candidate weights;
- evidence checkpoint, unit and improvement direction.

Model fingerprints may differ: testing that change is the purpose of the comparison.
Scoring or catalogue changes create a new comparison series. Explain the break and measure a shared frozen condition when possible.

The 31-, 47- and 30-viewer studies are different cohorts. Their headline averages cannot form one historical improvement trend.
A single run can contain separate comparison series for each cohort and method.

Average rating orders within each person first. Average people equally within each result set.
Then average the older result-set means equally. Report the result-set count and avoid pooling repeated sessions into extra people.

For individual changes, compare identical viewer IDs within an identical cohort. Retain every viewer and flag the worst losses.
Keep the eight unusual-taste cases and five fixed failure sessions identifiable across runs.

## Manifest schema

The helper accepts normalized, independently checked measurements. Populate them from raw results rather than rounded HTML text.

```json
{
  "schemaVersion": 1,
  "runId": "20261003T120000Z-working-tree",
  "sequence": 6,
  "completedAt": "2026-10-03T12:00:00Z",
  "chronologyBasis": "Primary execution registered before scoring",
  "role": "primary",
  "status": "complete",
  "source": {
    "gitHead": "commit-id",
    "dirty": true,
    "snapshotHash": "sha256",
    "files": [{"path": "tmdb.json", "sha256": "sha256"}]
  },
  "families": [{"id": "tmdb", "status": "completed", "result": "tmdb.json"}],
  "metrics": [{
    "benchmark": "tmdb-study-v1",
    "cohortHash": "sha256-of-viewers-and-hidden-split",
    "metadataHash": "sha256-of-public-film-details",
    "evidenceHash": "sha256-of-seeds-and-evidence-orders",
    "evaluatorHash": "sha256-of-evaluator",
    "definition": "clear-liked-disliked-pair-auc-v1",
    "method": "current-dossier",
    "checkpoint": 20,
    "metric": "ordering",
    "unit": "fraction",
    "direction": "higher",
    "value": 0.61,
    "viewers": {"viewer-1": 0.60, "viewer-2": 0.62},
    "modelFingerprint": "sha256"
  }]
}
```

Allowed history roles are `primary` and `historical-import`. Other roles remain excluded.
A `complete` manifest records a completed result set. The new full programme also requires every family to complete before claiming a complete evaluation.
Use `partial` if any required family fails or remains blocked. A partial latest run can report available metrics without entering the full-run historical average.

`viewers` contains one measurement per person after averaging their sessions. Recalculate `value` from those person values.
Existing reports sometimes round their aggregate and person means separately. Preserve the original figures in the source evidence.
The helper checks that the normalized person mean matches `value`.
Omit `viewers` for a genuine scalar, such as a single fixed failure-session measurement. Encode the session identity in `benchmark`.
Store fractions on a zero-to-one scale. Store liked-films-per-ten on a zero-to-ten scale.
Use `higher` or `lower` to state the improvement direction. Keep outcome denominators beside the raw evidence.

For each benchmark, include all available learning checkpoints, recommendation counts, coverage, belief revision, question benefit and damage effects.
Also record correction eligibility, unusual-taste results, losses after added evidence, useful overrides and missed opportunities.
Keep original component scores, rating traces and claims in the evidence bundle.

## Produce the comparisons

```sh
python3 scripts/compare_history.py \
  --latest /absolute/path/to/new-run/run.json \
  --history /absolute/path/to/reports/evaluations \
  --output /absolute/path/to/new-run/history-comparison.json
```

Resolve the helper path relative to this skill, not the repository root.
It selects the two most recent earlier manifests before comparing any metric. It never substitutes an older favourable run for a missing recent result.
It reports raw deltas, person-level deltas, older-history means, contributor IDs and incompatibility reasons.

Interpret small changes using paired person-level uncertainty from the raw evidence. The helper does not calculate significance from historical run averages.
Do not treat repeatable deterministic output as proof that a small gain generalizes to new people.
