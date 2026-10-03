import { readFileSync } from "node:fs";

const css = readFileSync(new URL("./hard-report.css", import.meta.url), "utf8");
const datasetReadme = readFileSync(new URL("../benchmarks/MOVIELENS-README.txt", import.meta.url), "utf8");
const datasetConditions = datasetReadme.slice(datasetReadme.indexOf("Usage License"), datasetReadme.indexOf("Further Information About GroupLens"));
const escape = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const percent = (value) => `${(value * 100).toFixed(1)}%`;
const points = (value) => `${value >= 0 ? "+" : "−"}${Math.abs(value * 100).toFixed(1)} points`;
const rating = (value) => ({ "-3": "strong dislike", "-2": "dislike", "-1": "mild dislike", 0: "neutral", 2: "like", 3: "strong like" })[value] ?? String(value);
const methodName = {
  dossier: "Dossier", public_rating: "Public film rating", popularity: "Popularity",
  genre: "Genre preference", vector: "Average film style", nearest: "Similar rated film",
  community: "Other viewers’ ratings", random: "Random order"
};
const methodDescription = {
  dossier: "Dossier’s current personalized ranking.",
  public_rating: "Highest public review score first; uses no personal ratings.",
  popularity: "Most popular films first; uses no personal ratings.",
  genre: "Favours genres the viewer rated well.",
  vector: "Combines rated films into one average style preference.",
  nearest: "Finds films like a liked title and avoids similarities to dislikes.",
  community: "Uses other MovieLens viewers’ ratings and excludes this viewer; extra information.",
  random: "Shuffles films without using the viewer’s taste."
};
const damageName = {
  reversed_half: "Reverse half the ratings", randomized: "Shuffle ratings among films",
  important_removed: "Remove the strongest ratings", contradiction: "Turn up to five likes into dislikes",
  five_ratings: "Give only five ratings"
};
const outcomeName = {
  correctly_removed: "Dropped the wrong claim", correctly_narrowed: "Narrowed the claim",
  correctly_replaced: "Replaced the claim", failed_to_update: "Kept the wrong claim",
  overcorrected: "Changed the claim but ranked films worse",
  no_false_claim_formed: "No qualifying wrong claim appeared", not_eligible: "No usable scenario"
};

export function claimText(claim) {
  if (!claim) return "No claim";
  const plainLabels = {
    "emotional intensity": "emotional stories", "character focus": "stories focused on individual characters",
    "slower pacing": "slower films", "faster pacing": "faster films", "broad scope": "large-scale stories",
    "intimate scope": "small, personal stories", "complex storytelling": "complex plots",
    "realistic settings": "realistic stories", "weighty themes": "serious topics", "lighter themes": "lighter topics",
    "lighter tone": "lighter films", "darker tone": "darker films", "unusual structure": "stories told in unusual ways",
    "moral ambiguity": "stories with complicated moral choices", "clear moral stakes": "stories with clear right and wrong"
  };
  const plainTags = { duringcreditsstinger: "an extra scene during the credits", aftercreditsstinger: "an extra scene after the credits" };
  const parts = claim.conditions.map((part) => part.kind === "genre" ? `${String(part.value).toLowerCase()} films`
    : part.kind === "tag" ? `films tagged “${plainTags[String(part.value).toLowerCase()] ?? part.label ?? part.value}”` : plainLabels[part.label] ?? part.label ?? `${part.kind}: ${part.value}`);
  const subject = parts.length === 1 ? parts[0] : `films matching all these clues: ${parts.join("; ")}`;
  return `Dossier thinks this viewer ${claim.effect === "positive" ? "likes" : "dislikes"} ${subject}`;
}

function evidenceTable(rows) {
  return `<div class="table-wrap"><table><thead><tr><th>Film</th><th>Original stars</th><th>Dossier received</th></tr></thead><tbody>${rows.map((row) =>
    `<tr><td>${escape(row.title)}</td><td>${escape(row.stars)} / 5</td><td>${escape(rating(row.suppliedRating))}</td></tr>`).join("")}</tbody></table></div>`;
}

export function renderRealHtml(report) {
  const at20 = report.learning[20];
  const at40 = report.learning[40];
  const sameInfo = ["public_rating", "popularity", "genre", "vector", "nearest", "random"]
    .map((id) => ({ id, value: at20[id].auc.mean })).sort((a, b) => b.value - a.value);
  const best = sameInfo[0];
  const edge = at20.dossier.auc.mean - best.value;
  const corrected = report.belief.filter((row) => row.outcome.startsWith("correctly_")).length;
  const eligible = report.belief.filter((row) => row.originalClaim).length;
  const hurt = report.viewers.filter((row) => row.evidenceHurt > 0).length;
  const top10 = at20.dossier.precision10.mean;
  const heldLikeShare = report.viewers.reduce((sum, row) => sum + row.heldOutLikes / report.heldOutPerViewer, 0) / report.viewerCount;
  const beatenBySimple = report.viewers.filter((row) => row.gapToBestFairBaseline < 0).length;
  const reducedEvidence = report.damage.summary.five_ratings;
  const correctedByRemoval = report.belief.filter((row) => row.outcome === "correctly_removed").length;
  const correctedByNarrowing = report.belief.filter((row) => row.outcome === "correctly_narrowed").length;
  const strongDamageSessions = report.damage.rows.filter((row) => row.scores.intact.auc > .65);
  const weakDamageSessions = report.damage.rows.filter((row) => row.scores.intact.auc <= .65);
  const meanDamage = (rows, name) => rows.length ? rows.reduce((sum, row) => sum + row.delta[name], 0) / rows.length : 0;
  const flaggedDamage = Object.entries(report.damage.summary).filter(([, row]) => row.benchmarkSensitivityFlag).map(([name]) => damageName[name]);
  const embedded = JSON.stringify(report).replaceAll("<", "\\u003c");

  const learningRows = [1, 3, 5, 10, 20, 40].map((count) => {
    const row = report.learning[count].dossier;
    return `<tr><th>${count}</th><td class="num">${percent(row.auc.mean)}</td><td class="num">${percent(row.auc.p10)}–${percent(row.auc.p90)}</td><td class="num">${(row.precision10.mean * 10).toFixed(1)} of 10</td><td class="num">${percent(row.coverage.mean)}</td></tr>`;
  }).join("");
  const baselineRows = ["dossier", "public_rating", "popularity", "genre", "vector", "nearest", "community", "random"].map((id) => {
    const row = at20[id];
    return `<tr class="${id === "dossier" ? "focus-row" : ""}"><th>${escape(methodName[id])}<small>${escape(methodDescription[id])}</small></th><td class="num">${percent(row.auc.mean)}</td><td class="num">${(row.precision10.mean * 10).toFixed(1)} of 10</td><td class="num">${percent(row.similarPublicRatingAuc.mean)}</td><td class="num">${percent(row.auc.p10)}–${percent(row.auc.p90)}</td></tr>`;
  }).join("");
  const viewerRows = report.viewers.map((row) => `<tr><th>${escape(row.id)}<small>${row.ratedFilms} matched film ratings; ${row.heldOutLikes} likes and ${row.heldOutDislikes} dislikes held back</small></th><td class="num">${percent(row.byCheckpoint[3].auc.mean)}</td><td class="num">${percent(row.dossierAt20)}</td><td class="num">${points(row.gapToBestFairBaseline)}</td><td class="num">${row.evidenceHurt} of 4</td></tr>`).join("");
  const calibrationRows = [5, 10, 20, 40].map((count) => {
    const row = report.calibration.byCount[count];
    return `<tr><th>${count}</th><td class="num">${percent(row.active.mean)}</td><td class="num">${percent(row.reasonableRandom.mean)}</td><td class="num">${points(row.pairedDelta.mean)}</td><td class="num">${points(row.pairedDelta.p10)} to ${points(row.pairedDelta.p90)}</td></tr>`;
  }).join("");
  const damageRows = Object.entries(report.damage.summary).map(([id, row]) => `<tr><th>${escape(damageName[id] ?? id)}</th><td class="num">${points(row.deltaAuc.mean)}</td><td class="num">${row.materiallyWorse} of ${report.viewerCount}</td><td class="num">${row.unchangedOrBetter} of ${report.viewerCount}</td><td>${row.benchmarkSensitivityFlag ? "Expected drop not established" : "Average drop exceeds three points"}</td></tr>`).join("");
  const beliefRows = report.belief.map((row) => `<details class="revision"><summary><b>${escape(row.viewer)}</b> · ${escape(outcomeName[row.outcome] ?? row.outcome)}${row.genre ? ` · ${escape(row.genre)}` : ""}</summary>
    ${row.originalClaim ? `<p><b>Early claim:</b> ${escape(claimText(row.originalClaim))} (${percent(row.originalClaim.confidence)} internal strength). ${row.originalClaim.evidence?.supportingItemKeys?.length ?? 0} supporting films and ${row.originalClaim.evidence?.counterexampleItemKeys?.length ?? 0} counterexamples were recorded.</p>
      <p><b>After contradictory ratings:</b> ${escape(row.resultingClaims?.map(claimText).join("; ") || "No active claim")}</p>
      <p>Film ordering: ${percent(row.before.auc)} → ${percent(row.after.auc)}. ${row.recommendationOverlap} of the first ten recommendations stayed the same.</p>
      <h3>Initial ratings</h3>${evidenceTable(row.initialEvidence)}<h3>Contradictory ratings</h3>${evidenceTable(row.contradictoryEvidence)}`
      : `<p>${row.outcome === "no_false_claim_formed" ? "The early ratings did not produce a claim that the hidden ratings clearly refute." : "This viewer lacked enough opposing ratings within one genre for this controlled trial."}</p>`}
  </details>`).join("");
  const failures = report.failures.map((row) => `<details class="failure"><summary><b>${escape(row.viewer)}</b> · ${percent(row.aucAt20)} correct ordering after 20 ratings</summary>
    <p>Best simple method for this viewer: ${escape(methodName[row.bestFairBaseline.name])}, ${percent(row.bestFairBaseline.auc)}. This person has ${row.heldOutRatings.filter((item) => item.rating > 0).length} clear likes and ${row.heldOutRatings.filter((item) => item.rating < 0).length} clear dislikes among the 60 hidden films.</p>
    <h3>Ratings Dossier saw</h3>${evidenceTable(row.receivedEvidence)}
    <h3>Biggest recommendation errors</h3><div class="table-wrap"><table><thead><tr><th>Film</th><th>Rank among 60</th><th>Actual stars</th><th>What happened</th></tr></thead><tbody>${row.biggestErrors.map((item) => `<tr><td>${escape(item.title)}</td><td>${item.rank}</td><td>${item.stars} / 5</td><td>${item.rank <= 10 ? "Recommended despite a dislike" : "Buried despite a like"}</td></tr>`).join("")}</tbody></table></div>
    <h3>Dossier’s active claims</h3><ul>${row.inferredClaims.map((claim) => `<li>${escape(claimText(claim))} (${percent(claim.confidence)} internal strength)</li>`).join("")}</ul>
    <h3>Clues to the failure</h3><p>${row.diagnosticClues.neutralTrainingRatings} of the 20 training ratings were neutral after conversion. ${row.diagnosticClues.conflictingStylePairCount} liked/disliked film pairs look almost identical in Dossier’s film-style representation. These similarity scores describe Dossier’s film representation and can miss differences viewers care about.</p>
    <ul>${row.diagnosticClues.conflictingStyleExamples.map((pair) => `<li>Liked <b>${escape(pair.liked)}</b>, disliked <b>${escape(pair.disliked)}</b>; Dossier’s style similarity is ${percent(pair.similarity)}.</li>`).join("")}</ul>
    ${row.diagnosticClues.contradictedClaims.length ? `<p>These claims also miss exceptions in the hidden ratings. This points to broad claims or the film representation as possible contributors:</p><ul>${row.diagnosticClues.contradictedClaims.map((entry) => `<li>${escape(claimText(entry.claim))}: ${entry.counterexampleCount} of ${entry.matchedCount} matching hidden films contradict it. Examples: ${escape(entry.counterexamples.map((item) => `${item.title} (${item.stars}/5)`).join(", "))}.</li>`).join("")}</ul>` : ""}
    <p>The downloaded data includes all 60 hidden ratings. These clues show associations; they do not establish which part of the code caused the errors.</p>
  </details>`).join("");
  const comparison = report.comparison ? `<section id="regression" class="section"><span class="eyebrow">Version comparison</span><h2>Did this version improve?</h2><p>Film ordering after 20 ratings changed by ${points(report.comparison.deltaAuc20)}. After three ratings, it changed by ${points(report.comparison.deltaAuc3)}. Liked films in the first ten changed by ${points(report.comparison.deltaTop10)}.</p><p>Claim correction changed by ${report.comparison.deltaBeliefCorrection == null ? "an unavailable amount" : points(report.comparison.deltaBeliefCorrection)}. The benefit of Dossier’s questions changed by ${points(report.comparison.deltaQuestionBenefit20)}.</p><p>${report.comparison.improved.length} viewers improved by more than three points; ${report.comparison.regressed.length} regressed by more than three points. Methods currently ahead of Dossier: ${escape(report.comparison.baselinesAhead.map((name) => methodName[name]).join(", ") || "none")}.</p></section>` : "";

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Dossier test with real films</title><style>${css}
.summary-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin:24px 0}.summary-grid article{padding:23px;background:#fcfaf5;border:1px solid #d7d0c4}.summary-grid h3{font:700 .8rem ui-monospace,SFMono-Regular,Consolas,monospace;color:#d14a2d;text-transform:uppercase;letter-spacing:.08em;margin:0 0 9px}.summary-grid p{margin:0}.summary-note{background:#17252b;color:#f2efe8;padding:21px 24px;max-width:none}.table-wrap small{display:block;font-size:.8rem;font-weight:400;color:#627074;margin-top:4px}.revision,.failure{border:1px solid #d7d0c4;background:#fcfaf5;margin:12px 0;padding:16px 20px}.revision summary,.failure summary{cursor:pointer}.revision h3,.failure h3{font:700 1rem/1.3 "Avenir Next",sans-serif;letter-spacing:normal;margin:25px 0 10px}.revision[open],.failure[open]{padding-bottom:25px}.failure ul{padding-left:22px}.source-note{background:#e8ede8;border-left:4px solid #3e7567;padding:20px 24px}.source-note p:last-child{margin-bottom:0}.section{scroll-margin-top:76px}@media(max-width:720px){.summary-grid{grid-template-columns:1fr}.nav{flex-wrap:nowrap;overflow-x:auto;white-space:nowrap;gap:20px;scrollbar-width:none}.nav::-webkit-scrollbar{display:none}}
</style></head><body>
<header><div class="topline"><strong>DOSSIER / REAL FILMS</strong><span>FIXED 2018 MOVIELENS SNAPSHOT</span></div><span class="eyebrow">First results · actual viewing histories</span><h1>Can Dossier learn from actual film ratings?</h1><p>We hide films that real viewers rated, give Dossier a few of their other ratings, and check whether it recommends the hidden likes ahead of dislikes.</p><div class="hero-stats"><div><span>Anonymous viewers</span><b>${report.viewerCount}</b></div><div><span>Real films matched</span><b>${report.filmCount}</b></div><div><span>Ratings hidden per viewer</span><b>${report.heldOutPerViewer}</b></div><div><span>Ordering after 20 ratings</span><b>${percent(at20.dossier.auc.mean)}</b></div></div></header>
<main><nav class="nav"><a href="#summary">Key findings</a><a href="#learning">Learning</a><a href="#baselines">Other methods</a><a href="#viewers">Viewers</a><a href="#beliefs">Claims</a><a href="#questions">Questions</a><a href="#damage">Damaged evidence</a><a href="#failures">Failures</a><a href="#method">How to read</a>${report.comparison ? '<a href="#regression">Version change</a>' : ""}</nav>
<section id="summary" class="section"><span class="eyebrow">Read this first · one minute</span><h2>What changed when the films were real</h2><p>This test uses real film descriptions and ratings that viewers gave independently of Dossier. It checks the current model against simple ways to rank the same hidden films.</p><div class="summary-grid">
<article><h3>Learning is weak and uneven</h3><p>Dossier’s ordering score rises from ${percent(report.learning[1].dossier.auc.mean)} after one rating to ${percent(at40.dossier.auc.mean)} after 40. A 50% score is chance; higher is better. ${hurt} of ${report.viewerCount} viewers have at least one rating order where more evidence makes the score worse. Cutting 20 ratings to five left the score almost unchanged or improved it for ${reducedEvidence.unchangedOrBetter} viewers.</p></article>
<article><h3>${edge < -.03 ? "A simple method wins" : edge > .03 ? "Dossier improves on a simple method" : "No clear advantage"}</h3><p>After 20 ratings, Dossier scores ${percent(at20.dossier.auc.mean)}. ${escape(methodName[best.id])} scores ${percent(best.value)}: a ${Math.abs(edge * 100).toFixed(1)}-point ${edge >= 0 ? "lead" : "gap"} for ${edge >= 0 ? "Dossier" : "the simple method"}. At least one simple method beats Dossier for ${beatenBySimple} of ${report.viewerCount} viewers. Other viewers’ ratings score ${percent(at20.community.auc.mean)}, but they provide extra information.</p></article>
<article><h3>What people would see</h3><p>About ${(top10 * 10).toFixed(1)} of Dossier’s first ten films are clear likes. The public-rating method finds ${(at20.public_rating.precision10.mean * 10).toFixed(1)}. ${percent(heldLikeShare)} of the hidden candidate films are clear likes, so the comparison has room to improve.</p></article>
<article><h3>Claims improve; questions do not clearly help</h3><p>Dossier corrected ${corrected} of ${eligible} deliberately selected wrong claims. Its chosen questions changed the 20-rating ordering score by ${points(report.calibration.byCount[20].pairedDelta.mean)} compared with random reasonable films. The difference varies widely across viewers.</p></article></div>
<p class="summary-note"><b>Decision:</b> The current recommender needs work before we can claim it learns real viewing histories well. This is a stronger test of taste because the ratings came from people. It still scores only films they chose to rate, and it uses Dossier’s bundled BestSimilar descriptions rather than the live TMDB descriptions.</p></section>
<section id="learning" class="section"><span class="eyebrow">Evidence</span><h2>How quickly does Dossier learn?</h2><p>Each viewer’s ratings arrive in four repeatable random orders. The score asks whether a liked hidden film ranks above a disliked hidden film. Chance is 50%; 100% is perfect.</p><div class="table-wrap"><table><thead><tr><th>Ratings shown</th><th>Correct ordering</th><th>Middle 80% of runs</th><th>Liked films in first ten</th><th>First-ten slots filled</th></tr></thead><tbody>${learningRows}</tbody></table></div></section>
<section id="baselines" class="section"><span class="eyebrow">Comparison</span><h2>Does Dossier beat simpler choices?</h2><p>All methods rank the same 60 hidden films for each viewer. The other-viewers method has extra ratings from outside that viewer’s history, so read it as a separate reference.</p><p>The “similarly reviewed films” column compares only a liked and disliked film whose public scores differ by at most 0.5 out of 10. It makes public reputation less useful and asks whether the ranking can find a personal preference. Higher remains better; 50% is chance.</p><div class="table-wrap"><table><thead><tr><th>Method after 20 ratings</th><th>Correct ordering</th><th>Liked films in first ten</th><th>Similarly reviewed films</th><th>Middle 80% of runs</th></tr></thead><tbody>${baselineRows}</tbody></table></div><p>Resampling the 31 viewers gives a 95% uncertainty range of ${points(report.uncertainty.gapToPublicRating20.lower)} to ${points(report.uncertainty.gapToPublicRating20.upper)} for Dossier’s gap to public film rating. We average each viewer’s four sessions before resampling, so the sessions do not count as separate people.</p></section>
<section id="viewers" class="section"><span class="eyebrow">Variation</span><h2>Who does Dossier miss?</h2><p>Rows run from the lowest to highest 20-rating score. The gap compares Dossier with the best simple method for that viewer, chosen after seeing the hidden answers. A negative gap means Dossier did worse.</p><div class="table-wrap"><table><thead><tr><th>Anonymous viewer</th><th>After 3 ratings</th><th>After 20 ratings</th><th>Gap to strongest simple method</th><th>More ratings hurt</th></tr></thead><tbody>${viewerRows}</tbody></table></div></section>
<section id="beliefs" class="section"><span class="eyebrow">Change of mind</span><h2>Does contrary evidence change a wrong claim?</h2><p>The trial starts with five liked films from one genre. It checks for an active claim contradicted by hidden ratings, then adds up to eight opposing ratings from that viewer. Only trials with a qualifying wrong claim count in the correction result. Dossier’s internal strength score reflects its own evidence weighting; it is not a measured chance that the claim is correct.</p><p>Of the ${corrected} successful corrections, ${correctedByRemoval} dropped the claim and ${correctedByNarrowing} made it more specific. Dropping an incorrect claim is useful, but it does not establish that Dossier discovered the viewer’s more precise preference. These trials deliberately choose wrong claims; their correction rate does not measure how often all Dossier claims are correct.</p>${beliefRows}</section>
<section id="questions" class="section"><span class="eyebrow">Rating questions</span><h2>Do Dossier’s questions teach it more?</h2><p>Both sessions start with the same five ratings. One then rates films Dossier asks about; the other rates randomly chosen films from the more popular three quarters of the training pool. Positive differences favour Dossier’s questions. Dossier supplied an eligible film for ${report.calibration.activeChosenAfterFive.mean.toFixed(1)} of the next 35 ratings per session on average; other slots fell back to the fixed rating order.</p><div class="table-wrap"><table><thead><tr><th>Ratings shown</th><th>Dossier’s questions</th><th>Random reasonable questions</th><th>Difference</th><th>Middle 80% of paired differences</th></tr></thead><tbody>${calibrationRows}</tbody></table></div><p>Across viewers, the 95% uncertainty range for the 20-rating benefit is ${points(report.uncertainty.questionBenefit20.lower)} to ${points(report.uncertainty.questionBenefit20.upper)}. A range crossing zero does not establish that Dossier’s questions help.</p></section>
<section id="damage" class="section"><span class="eyebrow">Check the test</span><h2>Does bad evidence hurt?</h2><p>Each damaged session starts from the same 20 training films as its intact session. Negative changes mean the damaged ratings made film ordering worse. “Almost unchanged or better” means a drop under one point or an increase.</p><div class="table-wrap"><table><thead><tr><th>Damage</th><th>Average score change</th><th>At least five points worse</th><th>Almost unchanged or better</th><th>Does the check work?</th></tr></thead><tbody>${damageRows}</tbody></table></div><p>${flaggedDamage.length ? `${flaggedDamage.length} checks did not reach the expected three-point average drop: ${escape(flaggedDamage.join("; "))}. Keep these flagged when interpreting learning gains.` : "Every damage check exceeded the expected three-point average drop."}</p><p>There is a measurable reason for the weak aggregate drops. In the ${strongDamageSessions.length} intact sessions scoring over 65%, injected contradictions changed the score by ${points(meanDamage(strongDamageSessions, "contradiction"))}; cutting to five ratings changed it by ${points(meanDamage(strongDamageSessions, "five_ratings"))}. In the ${weakDamageSessions.length} lower-scoring intact sessions, the changes were ${points(meanDamage(weakDamageSessions, "contradiction"))} and ${points(meanDamage(weakDamageSessions, "five_ratings"))}. Damaging a session that already learns poorly can therefore improve its ranking. This explains part of the result; it does not clear the flagged checks.</p></section>
<section id="failures" class="section"><span class="eyebrow">Inspect the misses</span><h2>The eight lowest-scoring viewers</h2><p>Open a viewer to see the ratings Dossier received, the largest recommendation errors, and the claims it made. These examples explain what happened; they do not prove why.</p>${failures}</section>
${comparison}
<section id="method" class="section"><span class="eyebrow">Scope and source</span><h2>What these results can and cannot tell us</h2><div class="source-note"><p><b>Ratings:</b> A frozen 2018 snapshot of the <a href="${escape(report.sources.ratings.url)}">MovieLens small dataset</a> from GroupLens. The <a href="${escape(report.sources.ratings.readme)}">dataset README</a> explains the source and use conditions. These are anonymous people’s recorded ratings. We include all 31 viewers with at least 150 matched ratings, 40 clear likes, and 40 clear dislikes. Their ratings span past years and may include changes in taste. The source is a development dataset; we pin its archive checksum for repeatable internal comparisons. This report does not imply GroupLens endorsement.</p><p><b>Film details:</b> Dossier’s bundled BestSimilar film records. We matched MovieLens entries by normalized title and exact year. We excluded ambiguous matches and translated genre names to Dossier’s vocabulary. The resulting ${report.filmCount} films have real titles, genres, descriptions, themes, public ratings, and popularity; the records lack director and series fields.</p><p><b>Hidden answers:</b> Each viewer has 60 hidden ratings. The CLI receives only chosen training ratings and public film details. We map 4 or more stars to a clear like, 2.5 or fewer to a clear dislike, and 3–3.5 to neutral. The same viewer never rates a held-out film during training.</p><p><b>Limit:</b> MovieLens viewers chose which films to rate. The held-out set therefore represents their rated films, not a random sample of all films. Our title matching covers only part of MovieLens, and the missing director and series details may limit what Dossier can learn. Use this to compare Dossier versions on the same cohort, not to predict the experience of every user.</p><p><b>Use conditions:</b> ${escape(report.sources.licenseNote)}</p></div>
${report.verification?.twoCompleteRunsMatchedExactly ? `<p><b>Repeatability checked:</b> Two complete runs matched in every result field. Each run included ${report.verification.learningSessionsPerRun} learning sessions, ${report.verification.calibrationPairsPerRun} paired question tests, ${report.verification.beliefTrialsPerRun} claim trials, and ${report.verification.damageConditionsPerRun} intact or damaged sessions.</p>` : ""}
<details class="footer"><summary>Original MovieLens use conditions and attribution</summary><pre style="white-space:pre-wrap;overflow-wrap:anywhere">${escape(datasetConditions)}</pre></details>
<button id="download">Download all results as JSON</button><p class="reading-key">The HTML contains the results and works without a server or internet connection. Film source links are optional.</p><details class="footer"><summary>Exact IDs for repeating this test</summary>Test data: ${escape(report.fixtureHash)}<br>Test procedure: ${escape(report.evaluatorFingerprint)}<br>Dossier model: ${escape(report.modelFingerprint)}</details></section>
</main><script type="application/json" id="report-data">${embedded}</script><script>document.getElementById("download").addEventListener("click",()=>{const blob=new Blob([JSON.stringify(JSON.parse(document.getElementById("report-data").textContent),null,2)],{type:"application/json"});const link=document.createElement("a");link.href=URL.createObjectURL(blob);link.download="dossier-real-v1-results.json";link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000)});</script></body></html>`;
}
