---
name: dossier-evaluation
description: Run Dossier's full taste-learning evaluation programme and produce a concise standalone HTML decision report with historical comparisons. Use when explicitly invoked for Dossier evaluation.
---

# Dossier evaluation

Run this skill only after the user explicitly invokes `$dossier-evaluation` or asks to run this named skill.

Answer: **Does this Dossier version learn a person's taste better from limited ratings?**

## Run the programme

1. Locate the Dossier repository and read its agent instructions. Inspect the current working tree, including uncommitted changes.
2. Read [execution.md](references/execution.md). Create an isolated snapshot of that working tree and a new dated result directory.
3. Record the source state, model fingerprints, fixture hashes, scoring hashes, protocols, seeds and exact commands before scoring.
4. Execute every test family in the execution reference. Record completed, failed or blocked status for each family.
5. Check deterministic replay, held-out separation and independently calculated scores. Investigate failed checks before judging model quality.
6. Normalize the results using [history.md](references/history.md). Run `scripts/compare_history.py` against the preserved run manifests.
7. Write `executive-summary.html` using [report.md](references/report.md). Keep the visible summary short and put full evidence in expandable sections.
8. Open the HTML locally. Check its layout, figures, historical comparisons and offline operation. Return its clickable file link.

## Preserve the experiment

- Test the current working tree. Keep product code and product defaults unchanged during this evaluation.
- Preserve the fixed TMDB study, fixture splits, evidence orders, scoring rules and public metadata.
- Keep the 75% public reviews / 25% tags candidate unchanged. Compare every tested method with public reviews and current Dossier.
- Preserve all eight unusual-taste cases and all five known backwards-learning sessions.
- Give Dossier only public film details and revealed training ratings. Keep hidden ratings and persona descriptions inside the evaluator.
- Select calibration titles and protection decisions from revealed evidence only. Use hidden answers after each decision to score it.
- Treat every previously scored cohort as a regression cohort. Freeze genuinely new evidence before testing a newly chosen method.
- Preserve raw results and old reports. Publish new results under a unique run ID instead of replacing a baseline.
- Record missing or incompatible evidence explicitly. A skipped test does not pass, and a replay does not become new confirmation.

## Completion

The report must account for every test family, even when a runner cannot test the current model.

Show the two most recent result sets separately and the average of the remaining compatible history.
Keep failed checks, individual losses and test limitations visible when they affect the decision.

The deliverable is the HTML decision report and its reproducible evidence bundle. Model tuning belongs to a separate task.
