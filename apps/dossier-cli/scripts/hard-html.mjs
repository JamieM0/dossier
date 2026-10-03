import { readFileSync } from "node:fs";

const css = readFileSync(new URL("./hard-report.css", import.meta.url), "utf8");
const escape = (value) => String(value ?? "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const percent = (value) => `${(value * 100).toFixed(1)}%`;
const outOfTen = (value) => `${(value * 10).toFixed(1)} of 10`;
const points = (value) => `${Math.abs(value * 100).toFixed(1)} points ${value < 0 ? "lower" : "higher"}`;
const signedPoints = (value) => `${value >= 0 ? "+" : "−"}${Math.abs(value * 100).toFixed(1)} points`;
const changeText = (value) => Math.abs(value) < .00005 ? "no change" : points(value);

const people = {
  split_extremes: ["Two very different favourites", "Loves slow, thoughtful science fiction and loud space action, but little in between."],
  horror_exceptions: ["Selective horror fan", "Usually dislikes horror, but loves sincere haunted stories without much gore."],
  franchise_loyal: ["Series fan", "Follows one fictional film series even when its films belong to different genres."],
  director_loyal: ["Director fan", "Loves films by one fictional director even when the films have little else in common."],
  distant_favourites: ["Wide-ranging favourites", "Loves films from unrelated genres, so there is no single obvious style to follow."],
  near_neighbour: ["Subtle difference", "Loves sincere films but dislikes very similar films that feel insincere."],
  broad_taste: ["Likes almost everything", "Likes most films, but strongly dislikes gore."],
  selective: ["Very selective viewer", "Likes only a few films that meet a high standard for craft."],
  noisy_rater: ["Inconsistent rater", "Has a steady underlying taste but sometimes gives ratings that contradict it."],
  misleading_start: ["Misleading first ratings", "Early science-fiction likes make this person look broader in taste than they are."],
  claim_narrowing: ["Quiet science-fiction fan", "Likes quiet science fiction and dislikes action-heavy science fiction."],
  franchise_exception: ["Series with exceptions", "Likes one fictional film series except entries with bleak endings."],
  director_exception: ["Director with exceptions", "Likes one director except when their films are gory or bleak."],
  ending_sensitive: ["Ending matters", "Likes or dislikes similar films depending on how their stories end."],
  era_preference: ["Older-film fan", "Usually likes films from before 1999, whatever the genre."],
  dry_comedy: ["Dry-comedy fan", "Usually dislikes comedy, but likes sincere, dry character stories."],
  opposite_clusters: ["Opposite tastes", "Likes eerie horror as well as broad comedy and adventure."],
  craft_over_genre: ["Craft-first viewer", "Judges films by their craft more than by genre or style."]
};

const methods = {
  dossier: ["Dossier", "Dossier's current way of ordering films."],
  popularity: ["Popularity only", "Puts the most popular films first."],
  genre: ["Genre only", "Favours genres the person rated well."],
  vector: ["Average style", "Averages the style clues from films the person rated."],
  nearest: ["Similar film", "Looks for films like ones the person liked, and avoids ones like their dislikes."],
  random: ["Random order", "Shuffles films in the same repeatable way each time."]
};

const ratingWords = {
  "-3": "Hated (−3)", "-2": "Disliked (−2)", "-1": "Mildly disliked (−1)",
  0: "Neutral (0)", 1: "Mildly liked (+1)", 2: "Liked (+2)", 3: "Loved (+3)"
};
const rating = (value) => ratingWords[value] ?? String(value);
const personName = (id) => people[id]?.[0] ?? id.replaceAll("_", " ");
const personDescription = (id, fallback) => people[id]?.[1] ?? fallback;

function conditionText(condition) {
  if (condition.kind === "director") {
    const letter = Number(condition.value) - 6000;
    return letter >= 0 && letter < 26 ? `films by fictional Director ${String.fromCharCode(65 + letter)}` : `films by director ${condition.value}`;
  }
  if (condition.kind === "collection") {
    const letter = Number(condition.value) - 8000;
    return letter >= 0 && letter < 26 ? `films in fictional Series ${String.fromCharCode(65 + letter)}` : `films in series ${condition.value}`;
  }
  if (condition.kind === "genre") return `${condition.value.toLowerCase()} films`;
  if (condition.kind === "tag") return `films tagged “${condition.label}”`;
  const simpler = {
    "slower pacing": "slower films", "faster pacing": "faster films",
    "broad scope": "large-scale stories", "complex storytelling": "complex stories",
    "realistic settings": "realistic stories", "weighty themes": "serious themes",
    "lighter themes": "lighter themes", "lighter tone": "lighter films",
    "darker tone": "darker films", "emotional intensity": "emotional films",
    "unusual structure": "unusually structured stories", "moral ambiguity": "morally ambiguous stories"
  };
  return simpler[condition.label] ?? condition.label;
}

function belief(claim) {
  const conditions = claim.conditions.map(conditionText);
  const subject = conditions.length === 1 ? conditions[0] : `films with all of these clues: ${conditions.join(", ")}`;
  return `Dossier thinks this person ${claim.effect === "positive" ? "likes" : "dislikes"} ${subject}`;
}

function outcome(entry) {
  const names = {
    correctly_removed: "Dropped the broad guess",
    correctly_narrowed: "Made the guess more specific",
    correctly_replaced: "Changed to a different guess",
    failed_to_update: "Kept the guess despite contrary ratings",
    overcorrected: "Changed its mind, then ranked films worse",
    no_false_claim_formed: "No broad wrong guess appeared",
    not_eligible: "This case could not be tested"
  };
  return names[entry.outcome] ?? entry.outcome.replaceAll("_", " ");
}

function reason(failure) {
  const exact = {
    director_loyal: "Dossier notices some director evidence but still places many of this director's films near the bottom.",
    era_preference: "This person follows release year across genres. Dossier's guesses focus on style instead of age.",
    craft_over_genre: "The hidden preference depends on craft, which the public film descriptions do not state directly.",
    distant_favourites: "The person's liked films look unlike one another, so one simple taste pattern misses some of them.",
    selective: "Very few films qualify as likes, making a strong recommendation harder to find.",
    director_exception: "The director matters, but bleak endings and gore create exceptions.",
    franchise_exception: "The series matters, but some entries are exceptions.",
    noisy_rater: "Some ratings disagree with the person's underlying preference."
  };
  return exact[failure.id] ?? "The ratings do not reveal this person's taste clearly enough yet.";
}

function evidenceTable(entries) {
  return `<div class="table-wrap"><table><thead><tr><th>Film</th><th>Dossier saw</th><th>Underlying preference</th></tr></thead><tbody>${entries.map((entry) =>
    `<tr><td>${escape(entry.title)}</td><td>${escape(rating(entry.suppliedRating))}</td><td>${escape(rating(entry.hiddenRating))}</td></tr>`
  ).join("")}</tbody></table></div>`;
}

function beliefsList(claims) {
  const active = claims.filter((claim) => claim.active);
  return active.length
    ? `<ul class="claim-list">${active.map((claim) => `<li>${escape(belief(claim))} <span class="muted">Dossier strength: ${percent(claim.confidence)}</span></li>`).join("")}</ul>`
    : "<p>Dossier kept no active guesses.</p>";
}

function truthList(items, test) {
  const chosen = items.filter((item) => test(item.hiddenRating));
  return `<ul class="truth-list">${chosen.map((item) => `<li>${escape(item.title)}: ${escape(rating(item.hiddenRating))}</li>`).join("")}</ul>`;
}

function chart(report) {
  const counts = [1, 3, 5, 10, 20, 40];
  const series = [
    ["Dossier", "dossier", "#d14a2d"], ["Genre only", "genre", "#3e7567"],
    ["Similar film", "nearest", "#5a718f"], ["Average style", "vector", "#a47b43"],
    ["Popularity only", "popularity", "#8b8c85"], ["Random order", "random", "#c3bfb5"]
  ];
  const left = 55, top = 20, width = 690, height = 280;
  const x = (index) => left + index * width / 5;
  const y = (value) => top + (1 - value) * height;
  const grid = [0, .25, .5, .75, 1].map((value) =>
    `<line x1="${left}" y1="${y(value)}" x2="${left + width}" y2="${y(value)}" stroke="#d8d3c9"/><text x="${left - 12}" y="${y(value) + 4}" text-anchor="end">${Math.round(value * 100)}%</text>`
  ).join("");
  const lines = series.map(([, id, color]) => {
    const values = counts.map((count, index) => `${x(index)},${y(report.learning[count][id].auc.mean)}`).join(" ");
    return `<polyline points="${values}" fill="none" stroke="${color}" stroke-width="${id === "dossier" ? 4 : 2}" stroke-linecap="round" stroke-linejoin="round"/><g fill="${color}">${counts.map((count, index) =>
      `<circle cx="${x(index)}" cy="${y(report.learning[count][id].auc.mean)}" r="${id === "dossier" ? 5 : 3}"/>`
    ).join("")}</g>`;
  }).join("");
  const ticks = counts.map((count, index) =>
    `<text x="${x(index)}" y="${top + height + 26}" text-anchor="middle">${count}</text>`
  ).join("");
  return `<svg role="img" aria-label="How often liked films rank ahead of disliked films after one, three, five, ten, twenty, and forty ratings. Higher is better." viewBox="0 0 790 345" class="curve"><g class="chart-labels">${grid}${ticks}</g>${lines}</svg><div class="legend">${series.map(([label, , color]) =>
    `<span><i style="background:${color}"></i>${escape(label)}</span>`
  ).join("")}</div>`;
}

function smallChart(person) {
  const counts = [1, 3, 5, 10, 20, 40];
  const values = counts.map((count, index) => `${index * 23},${28 - person.byCheckpoint[count].auc.mean * 26}`).join(" ");
  return `<svg viewBox="0 0 115 32" aria-label="Score as more ratings are added. A line rising toward the right is better." class="spark"><polyline points="${values}" fill="none" stroke="#d14a2d" stroke-width="2.5" stroke-linecap="round"/></svg>`;
}

function revisionCard(entry) {
  const difference = entry.after && entry.before ? entry.after.auc - entry.before.auc : 0;
  const firstBelief = entry.originalClaim ? belief(entry.originalClaim) : "Dossier made no testable broad guess.";
  const support = entry.originalClaim?.evidence.supportingItemKeys ?? [];
  const supportNames = support.map((id) => entry.initialEvidence?.find((item) => item.id === id)?.title ?? id);
  const afterText = difference >= .00005
    ? `Its film-ordering score rose by ${(difference * 100).toFixed(1)} points.`
    : difference <= -.00005
      ? `Its film-ordering score fell by ${Math.abs(difference * 100).toFixed(1)} points.`
      : "Its film-ordering score did not change.";
  const meaning = entry.outcome === "overcorrected"
    ? "The new ratings corrected a broad belief but also made the recommendations worse."
    : difference > .00005
      ? "The tested broad guess disappeared, and Dossier ranked unseen films better."
      : "The tested broad guess disappeared without a large drop in recommendation quality.";
  return `<article class="revision">
    <div><span class="eyebrow">${escape(personName(entry.person))}</span><h3>${escape(outcome(entry))}</h3>
      <p><b>First guess:</b> ${escape(firstBelief)}.</p>
      <p>${afterText} ${meaning}</p>
    </div>
    <div class="revision-stats">
      <span>Correct ordering before <b>${entry.before ? percent(entry.before.auc) : "—"}</b></span>
      <span>After new ratings <b>${entry.after ? percent(entry.after.auc) : "—"}</b></span>
      <span>Same films in first ten <b>${entry.recommendationOverlap ?? "—"} of 10</b></span>
    </div>
    <details><summary>Show the ratings and beliefs behind this result</summary>
      <p>Dossier gave its first guess a strength of ${entry.originalClaim ? percent(entry.originalClaim.confidence) : "—"}. This is Dossier's own strength score, not the chance that the guess is true.</p>
      <p><b>Films behind the first guess:</b> ${escape(supportNames.join(", ") || "none")}.</p>
      <p>Ratings run from “hated” (−3) to “loved” (+3). “Dossier saw” is the rating entered. “Underlying preference” is the answer used to score the test.</p>
      <div class="two-col"><div><h4>First five ratings</h4>${evidenceTable(entry.initialEvidence ?? [])}</div>
      <div><h4>Ratings that challenged the guess</h4>${evidenceTable(entry.contradictoryEvidence ?? [])}</div></div>
      <h4>What Dossier still believes after the new ratings</h4>
      <p>These are Dossier's guesses, not facts about the person.</p>${beliefsList(entry.resultingClaims ?? [])}
    </details>
  </article>`;
}

function failureCard(failure) {
  const mistakes = failure.biggestErrors.map((item) =>
    `<tr><td>${escape(item.title)}</td><td>${item.rank} of ${failure.heldoutCount}</td><td>${escape(rating(item.hiddenRating))}</td></tr>`
  ).join("");
  const positive = failure.heldoutItems.filter((item) => item.hiddenRating > 0).length;
  const negative = failure.heldoutItems.filter((item) => item.hiddenRating < 0).length;
  return `<article class="failure">
    <div class="failure-head"><span class="eyebrow">${escape(personName(failure.id))}</span><strong>${percent(failure.aucAt20)} correct ordering</strong></div>
    <h3>${escape(personDescription(failure.id, failure.description))}</h3>
    <p>After 20 ratings, Dossier put liked films ahead of disliked films in about ${Math.round(failure.aucAt20 * 100)} of 100 comparisons. ${failure.aucAt20 < .55 ? "That is close to random ordering." : "A higher score would put more good matches ahead of bad ones."}</p>
    <p><b>Possible reason:</b> ${escape(reason(failure))} This is a clue from this case, not a proven cause.</p>
    <p><b>Simple comparison:</b> ${escape(methods[failure.bestBaseline.name]?.[0] ?? failure.bestBaseline.name)} scored ${percent(failure.bestBaseline.auc)} for this person.</p>
    <details><summary>Show what Dossier saw, missed, and believed</summary>
      <p>This card's score averages four orders of ratings. The film lists show one of those runs. The person liked ${positive} of the ${failure.heldoutCount} secret films and disliked ${negative}.</p>
      <div class="two-col">
        <div><h4>The 20 ratings Dossier saw</h4>${evidenceTable(failure.receivedEvidence)}</div>
        <div><h4>The most striking ordering mistakes</h4>
          <p>Dossier put a disliked film near place 1. It buried a liked film near place ${failure.heldoutCount}.</p>
          <div class="table-wrap"><table><thead><tr><th>Film</th><th>Place</th><th>Person's preference</th></tr></thead><tbody>${mistakes}</tbody></table></div>
        </div>
      </div>
      <h4>What Dossier believed</h4><p>These guesses may be wrong. A strength percentage is Dossier's internal rating, not measured accuracy.</p>
      ${beliefsList(failure.inferredClaims)}
      <details><summary>Show all ${failure.heldoutCount} secret film ratings</summary>
        <div class="truth-grid"><div><h4>Films this person liked</h4>${truthList(failure.heldoutItems, (value) => value > 0)}</div>
        <div><h4>Films this person disliked</h4>${truthList(failure.heldoutItems, (value) => value < 0)}</div></div>
      </details>
    </details>
  </article>`;
}

export function renderHtml(report) {
  const at20 = report.learning[20];
  const at40 = report.learning[40];
  const bestMethod = ["popularity", "genre", "vector", "nearest", "random"]
    .map((id) => ({ id, score: at20[id].auc.mean }))
    .sort((a, b) => b.score - a.score)[0];
  const losesToPersonalBest = report.personas.filter((person) => person.baselineGapAt20 < -.0001).length;
  const beatsPersonalBest = report.personas.filter((person) => person.baselineGapAt20 > .0001).length;
  const correctBeliefs = report.belief.filter((entry) => entry.outcome.startsWith("correctly_")).length;
  const overcorrected = report.belief.filter((entry) => entry.outcome === "overcorrected").length;
  const questionAt20 = report.calibration.byCount[20].pairedDelta.mean;
  const questionAt40 = report.calibration.byCount[40].pairedDelta.mean;
  const leadAt20 = at20.dossier.auc.mean - bestMethod.score;
  const weakestThree = report.personas.slice(0, 3);
  const scoreRuns = report.sessions.length;
  const strongWrongRuns = (count) => report.sessions.filter((session) =>
    session.snapshots[count].highConfidenceClaimErrors > 0
  ).length;

  const learningRows = [1, 3, 5, 10, 20, 40].map((count) => {
    const row = report.learning[count].dossier;
    return `<tr><th>${count}</th><td class="num">${percent(row.auc.mean)}</td>
      <td class="num">${percent(row.auc.p10)}–${percent(row.auc.p90)}</td>
      <td class="num">${outOfTen(row.precision10.mean)}</td>
      <td class="num">${percent(row.ndcg10.mean)}</td>
      <td class="num">${percent(row.coverage.mean)}</td>
      <td class="num">${strongWrongRuns(count)} of ${scoreRuns}</td></tr>`;
  }).join("");

  const baselineRows = ["dossier", "popularity", "genre", "vector", "nearest", "random"].map((id) => {
    const row = at20[id];
    return `<tr class="${id === "dossier" ? "focus-row" : ""}">
      <th>${escape(methods[id][0])}<small>${escape(methods[id][1])}</small></th>
      <td class="num">${percent(row.auc.mean)}</td>
      <td class="num">${percent(row.auc.p10)}–${percent(row.auc.p90)}</td>
      <td class="num">${outOfTen(row.precision10.mean)}</td>
      <td class="num">${percent(row.ndcg10.mean)}</td></tr>`;
  }).join("");

  const personRows = report.personas.map((person) => {
    const own = report.sessions.filter((session) => session.person === person.id);
    const wrongRuns = own.filter((session) => session.snapshots[20].highConfidenceClaimErrors > 0).length;
    const gap = person.baselineGapAt20;
    const gapText = Math.abs(gap) < .0001 ? "same score" : `${Math.abs(gap * 100).toFixed(1)} points ${gap < 0 ? "worse" : "better"}`;
    return `<tr data-persona="${escape(person.id)}">
      <td><b>${escape(personName(person.id))}</b><small>${escape(personDescription(person.id, person.description))}</small></td>
      <td>${smallChart(person)}</td>
      <td class="num">${percent(person.byCheckpoint[3].auc.mean)}</td>
      <td class="num">${percent(person.dossierAt20)}</td>
      <td class="num ${gap < 0 ? "bad" : "good"}">${gapText}</td>
      <td class="num">${wrongRuns} of 4</td>
      <td class="num">${person.evidenceHurt} of 4</td></tr>`;
  }).join("");

  const questionRows = [5, 10, 20, 40].map((count) => {
    const row = report.calibration.byCount[count];
    return `<tr><th>${count}</th>
      <td class="num">${percent(row.active.mean)}</td>
      <td class="num">${percent(row.reasonableRandom.mean)}</td>
      <td class="num ${row.pairedDelta.mean >= 0 ? "good" : "bad"}">${escape(changeText(row.pairedDelta.mean))}</td>
      <td class="num">${signedPoints(row.pairedDelta.p10)} to ${signedPoints(row.pairedDelta.p90)}</td></tr>`;
  }).join("");

  const damageNames = {
    reversed_half: "Flip half the ratings",
    randomized: "Shuffle ratings among films",
    important_removed: "Remove the strongest ratings",
    contradiction: "Turn up to five likes into dislikes",
    five_ratings: "Give only five ratings"
  };
  const damageRows = Object.entries(report.damage.summary).map(([id, row]) =>
    `<tr><th>${escape(damageNames[id] ?? id)}</th>
      <td class="num">${Math.abs(row.deltaAuc.mean * 100).toFixed(1)} points</td>
      <td class="num">${row.materiallyWorse} of ${report.personaCount}</td>
      <td class="num">${row.unchangedOrBetter} of ${report.personaCount}</td></tr>`
  ).join("");

  const comparison = report.comparison ? `<section id="regression" class="section">
    <div class="section-intro"><span class="eyebrow">Compared with the saved version</span>
      <h2>Did this version actually improve?</h2>
      <p>Positive changes in film ordering, first-ten picks, and corrected beliefs are good. A positive change in the question result means Dossier's questions helped more than before.</p></div>
    <div class="stat-grid">
      <div class="stat"><span>Film ordering after 20 ratings</span><b>${escape(changeText(report.comparison.deltaMeanAuc20))}</b></div>
      <div class="stat"><span>Film ordering after three ratings</span><b>${escape(changeText(report.comparison.deltaColdAuc3))}</b></div>
      <div class="stat"><span>Good films in first ten</span><b>${escape(changeText(report.comparison.deltaHit10At20))}</b></div>
      <div class="stat"><span>Broad wrong beliefs corrected</span><b>${escape(changeText(report.comparison.deltaBeliefCorrectionRate))}</b></div>
    </div>
    <p>For the six people who were hardest in the saved version, film ordering changed by ${escape(changeText(report.comparison.deltaHardestSixAuc20))}. For the six easiest, it changed by ${escape(changeText(report.comparison.deltaEasiestSixAuc20))}. This shows whether an apparent gain reaches difficult people.</p>
    <p>${report.comparison.improved.length} people improved by more than three points; ${report.comparison.regressed.length} worsened by more than three points. ${report.comparison.baselineOvertakesDossier.length
      ? `These simple methods now beat Dossier overall: ${escape(report.comparison.baselineOvertakesDossier.map((id) => methods[id]?.[0] ?? id).join(", "))}.`
      : "No simple method beats Dossier's overall film-ordering score."}</p>
  </section>` : "";

  const old = report.legacyInvestigation;
  const embedded = JSON.stringify(report).replaceAll("<", "\\u003c");
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Dossier taste test: results in plain language</title>
<style>${css}
.score-explanation{background:#e8ede8;border-left:4px solid var(--green);padding:20px 24px;margin:28px 0}
.score-explanation p:last-child{margin-bottom:0}
.table-wrap small{display:block;font:normal .82rem/1.4 "Avenir Next","Trebuchet MS",sans-serif;letter-spacing:normal;text-transform:none;color:var(--muted);margin-top:4px}
.table-wrap th{max-width:330px}
.claim-list,.truth-list{margin:0 0 18px;padding-left:22px}
.claim-list li,.truth-list li{padding:4px 0}
.claim-list .muted{display:block;font-size:.82rem}
.truth-grid{display:grid;grid-template-columns:1fr 1fr;gap:25px}
.revision p,.failure p{max-width:1000px}
.revision-stats span{max-width:160px}
.stat-grid .stat p{margin:12px 0 0;font-size:.9rem}
.reading-key{font-size:.9rem;color:var(--muted)}
.leadership-summary{background:#e9e5db;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
.leadership-summary .section-intro{margin-bottom:22px}
.leadership-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:15px}
.leadership-grid article{background:var(--panel);border:1px solid var(--line);padding:22px 24px}
.leadership-grid h3{font:700 .82rem/1.3 ui-monospace,SFMono-Regular,Consolas,monospace;letter-spacing:.06em;text-transform:uppercase;color:var(--red);margin:0 0 10px}
.leadership-grid p{margin:0;max-width:none}
.leadership-summary .decision{margin:22px 0 0;padding:19px 24px;background:var(--ink);color:var(--paper);max-width:none}
.section{scroll-margin-top:76px}
@media(max-width:900px){.truth-grid{grid-template-columns:1fr}}
@media(max-width:560px){.failure-head{gap:10px}.failure-head strong{text-align:right;font-size:.95rem}.table-controls{flex-wrap:wrap}.table-controls input{max-width:100%;width:100%}.leadership-grid{grid-template-columns:1fr}.nav{flex-wrap:nowrap;overflow-x:auto;white-space:nowrap;scrollbar-width:none}.nav::-webkit-scrollbar{display:none}}
</style></head>
<body>
<header>
  <div class="topline"><strong>DOSSIER / TASTE TEST</strong><span>SAME PEOPLE AND FILMS ON EVERY RUN</span></div>
  <span class="eyebrow">Results for the current version</span>
  <h1>Is Dossier learning what someone likes?</h1>
  <p>We give Dossier a few film ratings, then check whether it puts unseen films this person would like ahead of films they would dislike.</p>
  <div class="hero-stats">
    <div><span>Made-up people tested</span><b>${report.personaCount}</b></div>
    <div><span>Secret films per person</span><b>${report.holdoutCount}</b></div>
    <div><span>Good films ranked ahead after 20 ratings</span><b>${percent(at20.dossier.auc.mean)}</b></div>
    <div><span>Best simple method on this measure</span><b>${percent(bestMethod.score)}</b></div>
  </div>
</header>
<main>
<nav class="nav">
  <a href="#at-a-glance">Key findings</a><a href="#verdict">Summary</a><a href="#learning">More ratings</a><a href="#people">Different people</a>
  <a href="#revision">Wrong guesses</a><a href="#calibration">Questions</a><a href="#damage">Bad evidence</a>
  <a href="#failures">Worst cases</a><a href="#investigation">Old results</a>
  <a href="#weaknesses">What to improve</a><a href="#methods">How to read this</a>
  ${report.comparison ? '<a href="#regression">Version change</a>' : ""}
</nav>

<section id="at-a-glance" class="section leadership-summary">
  <div class="section-intro"><span class="eyebrow">Read this first · one minute</span>
    <h2>What this test tells us now</h2>
    <p>Dossier learns more from additional ratings in this controlled test. Its advantage over a simple recommendation method is small, and this test uses invented films.</p>
  </div>
  <div class="leadership-grid">
    <article><h3>Learning improves</h3><p>After one rating, Dossier puts a liked film ahead of a disliked one in ${percent(report.learning[1].dossier.auc.mean)} of comparisons. After 40 ratings, it reaches ${percent(at40.dossier.auc.mean)}. Higher is better. The one-rating result is close to the 50% chance level, and only ${percent(report.learning[1].dossier.coverage.mean)} of first-ten recommendation slots are filled.</p></article>
    <article><h3>The advantage is not established</h3><p>After 20 ratings, Dossier scores ${percent(at20.dossier.auc.mean)}. The strongest simple method, ${escape(methods[bestMethod.id][0].toLowerCase())}, scores ${percent(bestMethod.score)}. The ${Math.abs(leadAt20 * 100).toFixed(1)}-point ${leadAt20 >= 0 ? "lead" : "deficit"} is too small to claim a reliable difference here. About ${outOfTen(at20.dossier.precision10.mean)} of Dossier's first ten picks are liked.</p></article>
    <article><h3>Corrections work unevenly</h3><p>Dossier corrected ${correctBeliefs} of ${report.belief.length} deliberately broad wrong guesses. In the other ${overcorrected}, it changed the guess but made its film ordering worse. Choosing its own rating questions improved ordering by only ${signedPoints(questionAt20)} after 20 ratings, compared with random reasonable questions.</p></article>
    <article><h3>Some people remain poorly served</h3><p>For the ${escape(weakestThree.map((person) => personName(person.id).toLowerCase()).join(", "))} cases, the 20-rating scores are ${escape(weakestThree.map((person) => percent(person.dossierAt20)).join(", "))}. Scores near 50% mean Dossier can barely distinguish liked from disliked films for these people.</p></article>
  </div>
  <p class="decision"><b>Decision:</b> Keep this as a repeatable check on the current code. Do not use it as evidence that Dossier works well with real films or viewers. The next test needs real film details and ratings that were recorded independently of Dossier.</p>
</section>

<section id="verdict" class="section">
  <div class="section-intro"><span class="eyebrow">The short answer</span>
    <h2>More ratings help. A simple method is still close.</h2>
    <p>After 20 ratings, Dossier puts a film this person likes ahead of one they dislike in about ${Math.round(at20.dossier.auc.mean * 100)} of 100 comparisons. The best simple method, “${escape(methods[bestMethod.id][0])},” scores ${percent(bestMethod.score)}. Dossier leads by ${Math.abs((at20.dossier.auc.mean - bestMethod.score) * 100).toFixed(1)} points.</p>
    <p>Among the first ten recommendations, Dossier finds about ${outOfTen(at20.dossier.precision10.mean)} liked films. The similar-film method finds ${outOfTen(at20.nearest.precision10.mean)}. That is a more direct measure of what a person would see on the screen.</p>
    <p>Dossier beats each person's strongest simple method for ${beatsPersonalBest} of ${report.personaCount} people and loses for ${losesToPersonalBest}. We pick that strongest method after seeing the secret answers, so this is a demanding comparison rather than a method Dossier could use in practice.</p>
  </div>
  <div class="score-explanation"><p><b>How to read the main score:</b> 50% is roughly random ordering; 100% means every liked film beats every disliked film. Higher is better because good matches appear earlier. ${percent(at20.dossier.auc.mean)} does <em>not</em> mean ${percent(at20.dossier.auc.mean)} of recommendations are liked.</p></div>
  <div class="stat-grid">
    <div class="stat"><span>After one rating</span><b>${percent(report.learning[1].dossier.auc.mean)}</b><p>Almost random. Most runs produced no recommendation list yet.</p></div>
    <div class="stat"><span>After 40 ratings</span><b>${percent(at40.dossier.auc.mean)}</b><p>Dossier places more good films earlier.</p></div>
    <div class="stat"><span>Broad wrong guesses corrected</span><b>${correctBeliefs} of ${report.belief.length}</b><p>${overcorrected} cases changed too far and made film ordering worse.</p></div>
    <div class="stat"><span>Benefit of Dossier's questions</span><b>${escape(changeText(questionAt20))}</b><p>Compared with random reasonable questions after 20 ratings. This is too small to show a useful advantage here.</p></div>
  </div>
  <div class="note"><b>What this test can say:</b> It compares changes on the same made-up people and films. Names such as “Philosophical signal 4” identify one of 12 generated films in a category. They are test labels, not real film titles. This test cannot tell us how well Dossier works for real viewers. Two test people are still too predictable and reach an almost perfect score.</div>
</section>

<section id="learning" class="section">
  <div class="section-intro"><span class="eyebrow">More ratings</span>
    <h2>Does Dossier improve as it gets to know someone?</h2>
    <p>Yes overall: the ordering score rises from ${percent(report.learning[1].dossier.auc.mean)} after one rating to ${percent(at40.dossier.auc.mean)} after 40. The chart compares Dossier with five simple ways to order films. Higher lines mean liked films are more often placed ahead of disliked films.</p>
    <p>Early on, simpler methods can do better. At 20 ratings, Dossier narrowly leads on overall ordering. The similar-film method still puts more liked films in the first ten.</p>
    <p>After 20 ratings, most test runs score between ${percent(at20.dossier.auc.p10)} and ${percent(at20.dossier.auc.p90)}. That wide range means some people get almost random results while others get nearly perfect ordering. The average hides those failures.</p>
    <p>The test finds strong wrong guesses in ${strongWrongRuns(10)} of ${scoreRuns} runs at 10 ratings and ${strongWrongRuns(40)} of ${scoreRuns} at 40 ratings. Better recommendations do not guarantee that every stated belief is right.</p>
  </div>
  <div class="grid-two learning-layout">
    <div class="panel">${chart(report)}</div>
    <div class="panel"><h3>Results after each number of ratings</h3>
      <p class="reading-key">Higher is better in every column except “strong wrong guesses.” More lists mean more people have something to browse. Fewer strong wrong guesses mean fewer misleading beliefs about a person. If Dossier returned no list, the first-ten score counts zero liked films.</p>
      <div class="table-wrap"><table><thead><tr>
        <th>Ratings given</th><th>Liked films ranked ahead</th><th>Range for most runs</th>
        <th>Liked films in first ten</th><th>First ten versus the best possible</th><th>A list appeared</th><th>Runs with strong wrong guesses</th>
      </tr></thead><tbody>${learningRows}</tbody></table></div>
      <p class="reading-key">“Range for most runs” excludes the weakest and strongest tenth of runs. A high low-end score means fewer people get poor results. The first-ten score reaches 100% only if Dossier puts the person's favourite unseen films first.</p>
    </div>
  </div>
  <h3>What the simple methods achieve after 20 ratings</h3>
  <p>The simple methods see the same ratings as Dossier. The first-ten column is the clearest check of how many good films a viewer would actually see.</p>
  <div class="table-wrap"><table><thead><tr><th>Method</th><th>Liked films ranked ahead</th><th>Range for most runs</th><th>Liked films in first ten</th><th>First ten versus the best possible</th></tr></thead><tbody>${baselineRows}</tbody></table></div>
</section>

<section id="people" class="section">
  <div class="section-intro"><span class="eyebrow">Person by person</span>
    <h2>Who is Dossier learning, and who is it missing?</h2>
    <p>Each row shows the same person tested four times with ratings in different orders. People with the weakest 20-rating results come first. Higher ordering scores are better.</p>
    <p>“Versus best simple method” shows whether Dossier adds value. “Worse with more ratings” counts how often 40 ratings scored lower than 10.</p>
  </div>
  <div class="table-controls"><span class="mono">${report.personaCount} made-up people</span><input id="persona-search" type="search" placeholder="Find a kind of viewer" aria-label="Find a kind of viewer"></div>
  <div class="table-wrap"><table><thead><tr>
    <th>What this person likes</th><th>As ratings grow</th><th>After 3 ratings</th><th>After 20 ratings</th>
    <th>Versus best simple method</th><th>Strong wrong guesses</th><th>Worse with more ratings</th>
  </tr></thead><tbody id="persona-rows">${personRows}</tbody></table></div>
  <p class="reading-key">The “best simple method” is chosen separately for each person after revealing the secret answers. That makes it a comparison target, not a usable recommendation plan.</p>
</section>

<section id="revision" class="section">
  <div class="section-intro"><span class="eyebrow">Changing its mind</span>
    <h2>When an early guess is too broad, does Dossier let go?</h2>
    <p>For each case, Dossier first sees five ratings that support a broad guess. We then give it eight ratings that challenge that same guess. The person's unseen film ratings tell us whether the original guess was too broad.</p>
    <p>In ${correctBeliefs} of ${report.belief.length} cases, Dossier drops the tested broad guess without a large loss in film ordering. In ${overcorrected}, it changes its mind but becomes much worse at ordering unseen films. A better result would keep useful parts of the person's taste while dropping only the false generalisation.</p>
    <p>The same ten films can remain on the recommendation list even when their order and the broader film ranking get worse. The score before and after tells us more than list overlap alone.</p>
  </div>
  ${report.belief.map(revisionCard).join("")}
</section>

<section id="calibration" class="section">
  <div class="section-intro"><span class="eyebrow">Choosing what to ask</span>
    <h2>Do Dossier's questions help it learn faster?</h2>
    <p>We start two copies of each person with the same five ratings. One copy rates films Dossier asks about. The other rates randomly selected, reasonably familiar films. We check both against the same secret films. A larger positive difference would mean Dossier needs fewer questions to learn the person.</p>
    <p>After 20 ratings, Dossier's choices score ${escape(changeText(questionAt20))} than random choices. After 40 ratings, they score ${escape(changeText(questionAt40))}. These small and mixed results do not show a clear advantage for Dossier's question choice.</p>
  </div>
  <div class="table-wrap"><table><thead><tr>
    <th>Total ratings</th><th>Dossier chose next films</th><th>Reasonably familiar films chosen at random</th>
    <th>Difference for Dossier</th><th>Range of differences across runs</th>
  </tr></thead><tbody>${questionRows}</tbody></table></div>
  <p class="reading-key">All percentages in this table mean “liked films ranked ahead of disliked films.” Higher is better. The two approaches start with identical first ratings.</p>
</section>

<section id="damage" class="section">
  <div class="section-intro"><span class="eyebrow">A check on the test itself</span>
    <h2>Does the score fall when we give Dossier bad evidence?</h2>
    <p>Yes. We change the first 20 ratings in ways that should make learning harder. A large drop means the test notices bad input; if the score stayed the same, this benchmark would be suspect.</p>
    <p>Flipping half the ratings lowers the ordering score by ${Math.abs(report.damage.summary.reversed_half.deltaAuc.mean * 100).toFixed(1)} points on average. Shuffling ratings among films lowers it by ${Math.abs(report.damage.summary.randomized.deltaAuc.mean * 100).toFixed(1)} points. More truthful evidence usually helps, though some individual people remain exceptions.</p>
  </div>
  <div class="table-wrap"><table><thead><tr><th>What we changed</th><th>Average drop in film ordering</th><th>People who lost at least 5 points</th><th>People with no clear drop</th></tr></thead><tbody>${damageRows}</tbody></table></div>
  <p class="reading-key">A larger drop is good evidence that the test can tell useful ratings from misleading ones. It is bad news for a viewer who actually gives those misleading ratings.</p>
</section>

<section id="failures" class="section">
  <div class="section-intro"><span class="eyebrow">The difficult people</span>
    <h2>Who would get the weakest recommendations?</h2>
    <p>These eight people have the lowest film-ordering scores after 20 ratings. Their cards show what Dossier saw, what the person really liked among the secret films, and which films Dossier placed badly. The possible reasons are explanations to investigate, not proven causes.</p>
  </div>
  ${report.failures.map(failureCard).join("")}
</section>

<section id="investigation" class="section">
  <div class="section-intro"><span class="eyebrow">Checking the earlier test</span><h2>Why did the first test look almost perfect?</h2></div>
  <div class="grid-two">
    <div class="panel"><h3>One rating gave too much away</h3>
      <p>In the older, easier test, Dossier scored ${percent(old.oneRating.dossierAuc)} after seeing just one liked film. A simple method that copied the taste clues from that one film scored ${percent(old.oneRating.simpleCosineAuc)} and also filled the first ten places with liked films.</p>
      <p>That person and the secret films matched the same obvious style clues. The result showed that the test was too predictable. It did not show that Dossier understood a person after one rating.</p>
    </div>
    <div class="panel"><h3>Why the Avengers rating left the top ten unchanged</h3>
      <p>After a contrary rating for <em>Avengers: Infinity War</em>, Dossier kept one fewer taste guess. Its assessment of that film moved from ${old.avengersContradiction.explanationScoreBefore.toFixed(3)} to ${old.avengersContradiction.explanationScoreAfter.toFixed(3)}, which is less negative. Dossier already had a rating for that film, so it left the film out of recommendations.</p>
      <p>Other films' scores moved, but none crossed into or out of the first ten. A stable top-ten list alone therefore did not mean Dossier ignored the new rating.</p>
    </div>
  </div>
  <div class="note">The old test had 24 liked films among 48 secret films, and many films came from very similar groups. Even the simple one-film method got ten liked films in its first ten. The new test includes people whose preferences cut across those predictable groups.</div>
</section>

<section id="weaknesses" class="section">
  <div class="section-intro"><span class="eyebrow">What the results point to</span><h2>Three things Dossier needs to do better</h2></div>
  <div class="stat-grid weakness-grid">
    <div class="stat"><span>1 / Follow a taste across different films</span><b>${percent(report.personas.find((person) => person.id === "director_loyal").dossierAt20)}</b>
      <p>For the director fan, film ordering is about as good as random. If this rose, Dossier would put more unseen films by the loved director ahead of unrelated dislikes.</p></div>
    <div class="stat"><span>2 / Ask more useful questions</span><b>${escape(changeText(questionAt20))}</b>
      <p>Dossier's chosen films barely improve learning over random reasonable films after 20 ratings. A larger gain would mean fewer ratings before good recommendations appear.</p></div>
    <div class="stat"><span>3 / Correct a guess without swinging too far</span><b>${overcorrected} of ${report.belief.length}</b>
      <p>In these cases, contrary ratings removed a broad guess but hurt film ordering by over five points. A better correction would preserve the person's genuine likes.</p></div>
  </div>
  <p class="reading-key">These are patterns in this test, not proof of which part of Dossier's code caused them.</p>
</section>
${comparison}

<section id="methods" class="section">
  <div class="section-intro"><span class="eyebrow">What these numbers mean</span><h2>How to read and trust this test</h2>
    <h3>What Dossier did</h3>
    <p>The test uses ${report.personaCount} made-up people and ${report.itemCount} invented films. For each person, ${report.trainingCount} films can supply ratings. Another ${report.holdoutCount} films stay secret until scoring. Each person likes at least five and dislikes at least five of the secret films.</p>
    <p>Dossier receives only public film details and the ratings we choose to reveal. It never receives the person's hidden taste description, the secret ratings, or the extra rules used to make them. The test calls Dossier through the same CLI actions used outside the lab.</p>
    <h3>What “correct ordering” means</h3>
    <p>Take one secret film the person likes and one they dislike. Does Dossier put the liked film first? The score counts how often it does, with ties counting as half-right. The statistical name in the downloaded data is “AUC.” A score of 50% is chance; 100% is perfect.</p>
    <p>Higher means better ordering. It does not tell you what share of the first ten films the person likes. “Liked films in first ten” answers that question. A run with no list scores zero in that column.</p>
    <p>When Dossier returns no list, the test records 50% for film ordering. That means there was no ordering to judge; it does not count as a successful recommendation.</p>
    <p>“First ten versus the best possible” also rewards putting the strongest likes near the top. It reaches 100% when those films appear in the best order. Higher is better for both first-ten measures.</p>
    <h3>What Dossier believes</h3>
    <p>A “strong wrong guess” has an internal strength score of at least 75%. The person's average rating for at least three matching secret films points the other way. Dossier's strength score is not a tested chance that the guess is right. Fewer wrong guesses are better.</p>
    <p>The five change-of-mind trials choose early guesses that are too broad. At least four secret films, and at least 40% of matching secret films, contradict each guess. New ratings then challenge it. A correction counts only if Dossier changes the guess without making its film ordering much worse.</p>
    <h3>What the test cannot tell us</h3>
    <p>Dossier gives films an order, not a predicted personal star rating. That is why this report measures ordering and good films near the top instead of an error in predicted stars.</p>
    <p>The numbered film names are placeholders. The generator made 24 categories with 12 films each so we could repeat the same test and control which film traits differ. Each film also has invented genre, keywords, director, series, and popularity. A name like “Animated wonder 2” identifies a test case; it does not refer to an actual film.</p>
    <p>This design makes the result easier to reproduce, but it leaves out the messy differences between real films. Repeated categories may also make some tastes easier to learn. We invented the people too, and their preferences follow fixed rules about genre, director, series, endings, and craft. Two people still reach an almost perfect score after 20 ratings. Use this test to compare Dossier versions on these same cases. It does not predict results for real viewers or a real film catalogue.</p>
    <p>We show each person's ratings in ${report.seeds.length} different orders. For one person, a change under three points calls for closer inspection. It is not a decisive win or loss.</p>
    <button id="download">Download all numbers as JSON</button>
    <p class="reading-key">This HTML file contains the complete results and works without a server or internet connection.</p>
  </div>
  <details class="footer"><summary>Exact IDs for repeating this test</summary>
    <p>If one of these IDs changes, the test data, scoring code, or Dossier model changed.</p>
    Test people and films: ${escape(report.fixtureHash)}<br>
    Test procedure: ${escape(report.evaluatorFingerprint)}<br>
    Dossier model: ${escape(report.modelFingerprint)}
  </details>
</section>
</main>
<script type="application/json" id="report-data">${embedded}</script>
<script>
const report = JSON.parse(document.getElementById("report-data").textContent);
document.getElementById("persona-search").addEventListener("input", (event) => {
  const query = event.target.value.toLowerCase();
  document.querySelectorAll("#persona-rows tr").forEach((row) => {
    row.hidden = !row.textContent.toLowerCase().includes(query);
  });
});
document.getElementById("download").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "dossier-hard-benchmark.json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
});
</script>
</body></html>`;
}
