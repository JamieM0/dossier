import { readFileSync } from "node:fs";

const css = readFileSync(new URL("./hard-report.css", import.meta.url), "utf8");
const esc = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");
const pct = (value) => `${(value * 100).toFixed(1)}%`;
const points = (value) => `${value >= 0 ? "+" : "−"}${Math.abs(value * 100).toFixed(1)} points`;
const duration = (value) => value < 1000 ? `${value.toFixed(1)} ms` : `${(value / 1000).toFixed(2)} s`;
const labels = {
  greedy: "Current Dossier",
  canonical_greedy: "Stable anchors",
  canonical_complete_link: "Strict stable groups"
};
const gateLabels = {
  exactOrderInvariance: "Same profile and scores for every rating order",
  positiveMeanGain: "Positive lower confidence bound on average ordering gain",
  worstDecileNotWorse: "Worst tenth of viewers does not regress",
  knownFailuresImprove: "All five known failures improve by at least three points",
  knownFailureDeclines: "All five known failures stay within a three-point learning loss",
  singleStepSafety: "No added rating causes a loss over five points"
};

function decisionCopy(report) {
  if (report.decision.status === "promote_for_confirmation") {
    return {
      title: `${labels[report.decision.selected]} earns an independent confirmation.`,
      summary: "It passed every frozen gate. This result supports another test, not a product-default change."
    };
  }
  return {
    title: "Stable grouping does not yet earn a product change.",
    summary: "Neither deterministic strategy passed every frozen gate. Current Dossier remains unchanged."
  };
}

export function renderGeometryHtml(report) {
  const decision = decisionCopy(report);
  const final = report.learning[40];
  const strategyRows = report.protocol.strategies.map((strategy) => {
    const row = final[strategy];
    const order = report.order[strategy];
    return `<tr${strategy === report.decision.selected ? ' class="focus-row"' : ""}><th>${labels[strategy]}</th><td>${pct(row.auc.mean)}</td><td>${pct(row.ndcg10.mean)}</td><td>${(row.precision10.mean * 10).toFixed(2)} of 10</td><td>${points(row.gainCurrent.mean)}</td><td>${order.exactScoreViewers} of ${order.viewers}</td></tr>`;
  }).join("");
  const checkpointRows = report.protocol.checkpoints.map((count) => `<tr><th>${count}</th>${report.protocol.strategies.map((strategy) => `<td>${pct(report.learning[count][strategy].auc.mean)}</td>`).join("")}</tr>`).join("");
  const candidateBlocks = report.candidates.map((candidate) => `<article><h3>${labels[candidate.strategy]}</h3><p><b>${candidate.passed ? "Passed every gate." : "Did not pass every gate."}</b></p><ul>${Object.entries(candidate.gates).map(([name, passed]) => `<li>${passed ? "Passed" : "Not met"}: ${gateLabels[name]}.</li>`).join("")}</ul></article>`).join("");
  const failureRows = report.failures.map((failure) => `<tr><th>Viewer ${esc(failure.viewer.split("-").at(-1))}<small>Order ${failure.seed}</small></th>${report.protocol.strategies.map((strategy) => { const row = failure.strategies[strategy]; return `<td>${pct(row.auc10)} → ${pct(row.auc40)}<small>${points(row.change)} while learning; ${points(row.gainCurrent40)} against current at 40</small></td>`; }).join("")}</tr>`).join("");
  const runtimeRows = Object.entries(report.runtime).map(([count, rows]) => `<tr><th>${Number(count).toLocaleString("en-GB")}</th>${report.protocol.strategies.map((strategy) => `<td>${duration(rows[strategy].milliseconds)}<small>${rows[strategy].clusters} groups</small></td>`).join("")}</tr>`).join("");
  const individualRows = report.viewerResults.map((viewer) => `<tr><th>${esc(viewer.viewer)}</th><td>${esc(viewer.cohort)}</td>${report.protocol.strategies.map((strategy) => `<td>${pct(viewer.checkpoints[40][strategy].auc)}<small>order spread ${points(viewer.order[strategy].aucSpread)}</small></td>`).join("")}</tr>`).join("");
  const data = JSON.stringify(report).replaceAll("<", "\\u003c");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Dossier experiment: stable taste geometry</title><style>${css}
header{padding-bottom:30px}header h1{font-size:clamp(2.7rem,5.5vw,5rem);max-width:1100px}.section{padding:34px 0}.section h2{font-size:clamp(2rem,3.6vw,3.2rem);max-width:1050px}.decision{background:#17252b;color:#f2efe8;padding:24px 28px;margin:20px 0}.decision p{margin:10px 0 0}.cards{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin:22px 0}.cards article{border:1px solid var(--line);background:var(--panel);padding:20px 24px}.cards h3{font:700 1rem 'Avenir Next',sans-serif;letter-spacing:normal;margin:0 0 12px}.cards li{margin:.5rem 0}table small{display:block;font-size:.8rem;margin-top:.25rem}.nav{overflow-x:auto;white-space:nowrap;flex-wrap:nowrap}p{max-width:78ch}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:.78rem}@media(max-width:720px){.cards{grid-template-columns:1fr}}
</style></head><body><header><div class="topline"><strong>DOSSIER / EXPERIMENT 1</strong><span>STABLE TASTE GEOMETRY · FROZEN TEST</span></div><h1>${esc(decision.title)}</h1><p>${report.viewers} viewers. ${report.permutations} rating orders each. Three frozen cohorts. Product defaults remain unchanged.</p></header><main><nav class="nav"><a href="#decision">Decision</a><a href="#order">Order</a><a href="#learning">Learning</a><a href="#failures">Known failures</a><a href="#evidence">Evidence</a></nav>
<section id="decision" class="section"><span class="eyebrow">The decision in one minute</span><h2>${esc(decision.title)}</h2><div class="decision"><strong>${esc(decision.summary)}</strong><p>${esc(report.decision.reason)}</p></div><div class="table-wrap"><table><thead><tr><th>After 40 ratings</th><th>Liked before disliked</th><th>Top-ten ranking quality</th><th>Likes among ten</th><th>Change from current</th><th>Exactly stable viewers</th></tr></thead><tbody>${strategyRows}</tbody></table></div><p><b>Higher is better.</b> The primary ordering score is the share of liked-versus-disliked pairs placed in the correct order. Chance is 50%.</p><div class="cards">${candidateBlocks}</div><p class="note">A gate that is not met rejects that candidate. The test does not trade a known personal loss for a better group average.</p></section>
<section id="order" class="section"><span class="eyebrow">The mechanism under test</span><h2>Rating order currently changes the inferred person</h2><p>Current Dossier greedily forms taste groups in insertion order. The experiment supplies the same 40 ratings in ${report.permutations} deterministic orders for each viewer.</p><div class="cards">${report.protocol.strategies.map((strategy) => { const row = report.order[strategy]; return `<article><h3>${labels[strategy]}</h3><p><b>${row.exactProfileViewers} of ${row.viewers}</b> viewers have one identical profile across every order. <b>${row.exactScoreViewers} of ${row.viewers}</b> have one identical score list.</p><p>Mean ordering-score spread: ${points(row.meanAucSpread)}. Largest spread: ${points(row.maxAucSpread)}.</p></article>`; }).join("")}</div><p>Stable anchors sort evidence by rating strength and item key before using the current greedy merge. Strict stable groups also require a new item to resemble every member of a group.</p></section>
<section id="learning" class="section"><span class="eyebrow">Personalisation as evidence accumulates</span><h2>Stability must preserve useful learning</h2><div class="table-wrap"><table><thead><tr><th>Supplied ratings</th>${report.protocol.strategies.map((strategy) => `<th>${labels[strategy]}</th>`).join("")}</tr></thead><tbody>${checkpointRows}</tbody></table></div><p>Each value averages the ordering score over all rating orders, then over viewers. The 40-rating comparison drives the quality gates.</p></section>
<section id="failures" class="section"><span class="eyebrow">Do not hide the hard people</span><h2>The five backwards-learning sessions remain explicit</h2><div class="table-wrap"><table><thead><tr><th>Frozen session</th>${report.protocol.strategies.map((strategy) => `<th>${labels[strategy]}</th>`).join("")}</tr></thead><tbody>${failureRows}</tbody></table></div><p>Each session replays through the CLI after every rating from 10 to 40. The current endpoints must reproduce the saved diagnosis before either candidate is judged.</p></section>
<section id="evidence" class="section"><span class="eyebrow">Supporting evidence</span><h2>Method, costs, and limits</h2><details><summary>Runtime as libraries grow</summary><div class="table-wrap"><table><thead><tr><th>Ratings</th>${report.protocol.strategies.map((strategy) => `<th>${labels[strategy]}</th>`).join("")}</tr></thead><tbody>${runtimeRows}</tbody></table></div><p>These timings compare geometry construction on this machine. They are directional, not a cross-device latency guarantee.</p></details><details><summary>Every viewer after 40 ratings</summary><div class="table-wrap"><table><thead><tr><th>Viewer</th><th>Cohort</th>${report.protocol.strategies.map((strategy) => `<th>${labels[strategy]}</th>`).join("")}</tr></thead><tbody>${individualRows}</tbody></table></div></details><details><summary>Frozen design and limits</summary><ul>${report.protocol.limits.map((limit) => `<li>${esc(limit)}</li>`).join("")}</ul><p>The same candidate catalogue and hidden ratings score every strategy. Only supplied ratings reach the CLI. The test changes grouping, claim reconciliation, and resulting scores together because those parts form one taste representation.</p><p>The protocol records fixture hashes, evaluator hashes, thresholds, checkpoints, and decision gates. A changed fixture requires a new protocol version.</p><pre>${esc(JSON.stringify({ protocol: report.protocol, modelFingerprint: report.modelFingerprint, evaluatorFingerprint: report.evaluatorFingerprint }, null, 2))}</pre></details><button id="download">Download results as JSON</button><p>The report contains its data and works without internet access.</p></section></main><script type="application/json" id="report-data">${data}</script><script>document.getElementById('download').addEventListener('click',()=>{const blob=new Blob([JSON.stringify(JSON.parse(document.getElementById('report-data').textContent),null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='stable-geometry-v1.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)});</script></body></html>`;
}
