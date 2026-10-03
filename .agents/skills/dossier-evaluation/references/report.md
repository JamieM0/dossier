# Short executive HTML report

## Reader and purpose

Write for someone who knows Dossier and wants to decide what to do next. Assume no statistical or evaluation knowledge.
Use the revised leadership deck's direct phrasing as a guide. Keep familiar useful terms such as CLI, then define them once if needed.

The reader should understand whether learning improved, who benefits, who loses, how certain that is and the next action.

## Visible report

Aim for 400–650 words of visible prose, excluding numbers in tables. Keep five compact sections:

1. **Decision:** one sentence, followed by the strongest supporting evidence. Use “better”, “worse”, “mixed” or “not established”.
2. **Results:** one compact table showing latest, previous result, result before that and earlier average with run count.
3. **Who loses:** the largest individual losses, unusual-taste exceptions and the five fixed failure outcomes.
4. **What changed:** cold-start learning, corrected claims, question usefulness, damaged-evidence response and protection decisions.
5. **Next action:** the narrowest justified step and any unresolved limitation that could change the decision.

Put dates or run IDs in the history column headers. Show public reviews and current Dossier alongside the unchanged candidate or tested protection method.
A comparison can use separate small tables when one large table would mix cohorts or become unreadable.
Include absolute scores and changes. Separate different evidence checkpoints, especially the 20-rating confirmation and 40-rating protection tests.
Show “not comparable” or “not measured” instead of inventing a historical value.

Include every substantive finding somewhere in the HTML. Use expandable sections for full learning curves, all baselines and component methods.
Also include every person's results, claim evidence, damage exceptions, rating-order tests, score verification and provenance.
Preserve failed tests and unresolved failures in the visible summary when they affect the decision.

## Explain scores through outcomes

| Technical measure | Report wording |
|---|---|
| Ranking AUC | “Ordering score: how often a liked film ranks above a disliked one. Higher is better; 50% is chance.” |
| Precision at ten | “Liked films per ten suggestions. Higher means more recommendations this person enjoys.” |
| AUC difference | “Up 1.2 points.” Use percentage points, not relative percentage growth. |
| Viewer bootstrap interval | “The estimated gain is X to Y points. That range includes no improvement.” State the actual range. |
| Calibration | “Films Dossier chooses to ask you to rate.” |
| High-risk subgroup | “People whose ratings differ from public reviews.” |
| Path dependence | “The same ratings in a different order produced different recommendations.” |
| Override | “Choose Dossier's personal ranking when supplied ratings show it works better.” |
| Public reviews | “Average audience ratings.” |
| Tags | “Genres and keywords matched to the person's ratings.” |

Translate every reported result into its practical meaning. For example, a gain of 0.25 liked films per ten means roughly one extra per 40 suggestions.
Name the comparison that gain refers to. Keep “in this test” when the finding comes from historical rating records.
Avoid vague phrases such as “earns its complexity”, “material benefit”, “robust personalization” or “credible enough”. State the result and its consequence.
Use active sentences. Keep a metric's definition beside its figures. Explain why an average gain can still hurt a particular person.

## Interpretation

Different viewer groups, hidden-film pools and metadata sources can produce different scores without a model change.
Do not combine their means into an apparent improvement trend.

A change to eligibility can raise claim correction rates without correcting more claims. Show eligible and corrected counts.
Low recommendation coverage can reduce mistake counts by making fewer recommendations. Show coverage beside those counts.
Corrected claims do not prove better recommendations. A failed protection decision cannot disappear behind the average score.

Use objective hidden-answer results for the verdict. Use diagnostic interventions for causal explanations and label other explanations as hypotheses.
Show observed uncertainty without making tiny fluctuations an automatic development gate.
Keep product defaults unchanged unless the current user explicitly authorizes changing them in a separate task.

## Self-contained delivery

Produce one `executive-summary.html` that opens from disk without a server or network.
Inline CSS, scripts, chart data and required assets. Use system fonts and accessible HTML tables.
Use concise charts when they clarify a finding. Keep detailed evidence under native `details` elements.
Keep the main report readable on a laptop, phone and printed page. Avoid decorative dashboards that obscure the decision.

Embed the normalized manifest and historical comparison as safely escaped JSON. Escape HTML text and any closing script sequences in embedded data.
Include a download action for embedded summary data when useful. Keep large raw traces in the reproducible evidence bundle and summarize them inside the HTML.
Give every displayed result a source identifier in the supporting evidence section.
Retain MovieLens and TMDB attribution and relevant data conditions from the source reports.

Check that the HTML has no external dependencies. Open it locally and inspect the visible report and expanded evidence.
Verify displayed values against raw JSON, including rounding, denominators, comparison direction and historical contributor counts.
