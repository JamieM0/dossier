<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { preferences } from "$lib/state/preferences.svelte";
  import { ratingKind, ratingWeight, type RatingEntry, type TasteClaim } from "$lib/types";
  import { buildTasteSpace, projectTasteSpace2D, tasteClaimId, type TasteProjectionPoint } from "@dossier/domain";
  import { motionPress, motionReveal, motionStaggerChildren, glassPointer } from "$lib/design/motion";
  import IconArrowRightRegular from "phosphor-icons-svelte/IconArrowRightRegular.svelte";
  import IconCheckRegular from "phosphor-icons-svelte/IconCheckRegular.svelte";
  import IconXRegular from "phosphor-icons-svelte/IconXRegular.svelte";

  let selected = $state<TasteClaim | null>(null);
  let feedbackBusy = $state(false);

  onMount(() => void preferences.hydrate());

  const entries = $derived(preferences.entries());
  const claims = $derived(preferences.tasteClaims);
  const activeClaims = $derived(claims.filter((claim) => claim.active));
  const tasteSpace = $derived(buildTasteSpace(entries));
  const projection = $derived(projectTasteSpace2D(tasteSpace, activeClaims));
  const confirmed = $derived(activeClaims.filter((claim) => claim.provenance === "user_confirmed"));
  const patterns = $derived(activeClaims.filter((claim) => claim.provenance === "inferred" && claim.confidence >= .55));
  const hypotheses = $derived(activeClaims.filter((claim) => claim.provenance === "inferred" && claim.confidence < .55));
  const corrections = $derived(claims.filter((claim) => !claim.active));
  const liked = $derived(entries.filter((entry) => ratingKind(entry.rating) === "like").length);
  const disliked = $derived(entries.filter((entry) => ratingKind(entry.rating) === "dislike").length);

  function evidenceFor(keys: string[]): RatingEntry[] {
    const wanted = new Set(keys);
    return entries.filter((entry) => wanted.has(entry.item.key));
  }
  function claimSubject(claim: TasteClaim): string {
    return claim.conditions.map((condition) => condition.label.toLowerCase()).join(" and ");
  }
  function claimStatement(claim: TasteClaim): string {
    return `${claim.effect === "positive" ? "Drawn to" : "Usually avoids"} ${claimSubject(claim)}`;
  }
  function origin(claim: TasteClaim): string {
    return claim.provenance === "user_confirmed" ? "You confirmed" : claim.provenance === "explicitly_rejected" ? "You rejected" : claim.provenance === "corrected" ? "You corrected" : "Inferred from ratings";
  }
  function evidenceSummary(claim: TasteClaim): string {
    const count = claim.evidence.counterexampleItemKeys.length;
    return `${claim.evidence.supportingItemKeys.length} supporting · ${count} counterexample${count === 1 ? "" : "s"}`;
  }
  function selectPoint(point: TasteProjectionPoint): void {
    const id = point.claimId ?? point.regionId;
    const claim = id ? claims.find((candidate) => candidate.id === id) : undefined;
    if (claim) selected = claim;
  }
  async function feedback(claim: TasteClaim, provenance: "user_confirmed" | "explicitly_rejected" | "corrected"): Promise<void> {
    if (feedbackBusy) return;
    feedbackBusy = true;
    try {
      await preferences.setClaimFeedback(claim, provenance);
      selected = preferences.tasteClaims.find((candidate) => candidate.id === claim.id) ?? null;
    } finally { feedbackBusy = false; }
  }
  async function correctDirection(claim: TasteClaim): Promise<void> {
    if (feedbackBusy) return;
    feedbackBusy = true;
    try {
      await preferences.setClaimFeedback(claim, "corrected");
      const effect = claim.effect === "positive" ? "negative" : "positive";
      const opposite: TasteClaim = {
        ...claim,
        id: tasteClaimId(effect, claim.conditions), effect,
        evidence: { ...claim.evidence,
          supportingItemKeys: [...claim.evidence.counterexampleItemKeys],
          counterexampleItemKeys: [...claim.evidence.supportingItemKeys],
          supportingWeight: claim.evidence.counterexampleWeight,
          counterexampleWeight: claim.evidence.supportingWeight },
        provenance: "user_confirmed", active: true
      };
      await preferences.setClaimFeedback(opposite, "user_confirmed");
      selected = preferences.tasteClaims.find((candidate) => candidate.id === opposite.id) ?? null;
    } finally { feedbackBusy = false; }
  }
  function handleKey(event: KeyboardEvent): void { if (event.key === "Escape") selected = null; }
</script>

<svelte:window on:keydown={handleKey} />
<svelte:head><title>Your taste model · Dossier</title></svelte:head>

<section class="dossier-screen">
  <header class="dossier-cover" use:motionReveal>
    <div><span class="screen-kicker">Your Dossier · inspectable local model</span><h1 class="editorial-title">What Dossier currently believes, and why.</h1><p class="editorial-lede">Inspect patterns from your ratings and the preferences you confirmed. Supporting ratings and counterexamples show the evidence behind each statement.</p></div>
    <div class="ledger glass-panel"><span><strong>{entries.length}</strong> responses</span><span><strong>{liked}</strong> positive</span><span><strong>{disliked}</strong> negative</span><small>{activeClaims.length} active claims · stored on this device</small></div>
  </header>

  {#if !preferences.loaded}
    <p class="muted">Opening your taste model…</p>
  {:else if entries.length === 0}
    <section class="empty glass-panel"><span class="screen-kicker">Blank, by design</span><h2>Dossier does not invent a person before you provide evidence.</h2><p>Teach it a handful of things you know, then return to inspect the first cautious patterns.</p><button class="primary-action" onclick={() => goto('/teach')}>Teach Dossier</button></section>
  {:else}
    <section class="map-section glass-panel" aria-label="Local two-dimensional taste projection">
      <header><div><span class="screen-kicker">TasteSpace projection</span><h2>Evidence, clusters, claims, and weak boundaries</h2></div><p>Positions are a deterministic 2D view of the ten-axis model. Moving a point here never changes a prediction.</p></header>
      <div class="projection">
        <div class="axis x"></div><div class="axis y"></div>
        {#each projection as point (point.id)}
          {#if point.kind === "claim" || (point.kind === "weak_region" && point.regionId?.startsWith("claim:"))}
            <button class:claim-point={point.kind === "claim"} class:weak-point={point.kind === "weak_region"} class:negative={point.polarity === "disliked"} class="map-point interactive" style={`--x:${50 + point.x * 43}%;--y:${50 - point.y * 43}%;--confidence:${point.confidence}`} aria-label={point.kind === "claim" ? "Inspect claim" : "Inspect weak claim boundary"} onclick={() => selectPoint(point)}></button>
          {:else}
            <span class:cluster-point={point.kind === "cluster"} class:evidence-point={point.kind === "evidence"} class:weak-point={point.kind === "weak_region"} class:negative={point.polarity === "disliked"} class="map-point" style={`--x:${50 + point.x * 43}%;--y:${50 - point.y * 43}%;--confidence:${point.confidence}`}></span>
          {/if}
        {/each}
      </div>
      <div class="legend"><span class="liked">Evidence</span><span class="negative">Negative evidence</span><span class="cluster">Cluster</span><span class="claim">Claim</span><span class="weak">Weak boundary</span></div>
    </section>

    <div class="layers" use:motionStaggerChildren>
      <section class="layer paper-layer">
        <header><div><span class="layer-index">01</span><span class="screen-kicker">User-confirmed</span></div><h2>Preferences you confirmed</h2><p>You confirmed these preferences. They influence recommendations, but may not override patterns from your ratings.</p></header>
        <div class="claim-list">
          {#each confirmed as claim}<button class="claim-row" onclick={() => selected = claim} use:motionPress><span><strong>{claimStatement(claim)}.</strong><small>{evidenceSummary(claim)}</small></span><span class="evidence-summary">{origin(claim)}</span><IconArrowRightRegular class="icon-16" /></button>{/each}
          {#if confirmed.length === 0}<div class="layer-empty"><strong>No confirmed claims yet.</strong><span>Inferred patterns stay provisional until you approve one.</span></div>{/if}
        </div>
      </section>

      <section class="layer">
        <header><div><span class="layer-index">02</span><span class="screen-kicker">Repeated patterns</span></div><h2>Useful, not identity</h2><p>Dossier inferred these patterns from your ratings. They remain open to correction.</p></header>
        <div class="claim-grid">
          {#each patterns as claim}<button class="claim-card glass-panel" use:glassPointer onclick={() => selected = claim}><span class="claim-status">{claim.conditions.length === 2 ? "Conjunction" : claim.conditions[0].kind.replace("_", " ")} · {claim.evidence.supportingItemKeys.length} supports</span><strong>{claimStatement(claim)}</strong><span class="evidence-summary">{evidenceSummary(claim)}</span></button>{/each}
          {#if patterns.length === 0}<div class="layer-empty"><strong>No settled patterns yet.</strong><span>Dossier needs more repeated, consistent evidence.</span></div>{/if}
        </div>
      </section>

      <section class="layer hypothesis-layer">
        <header><div><span class="layer-index">03</span><span class="screen-kicker">Weak regions</span></div><h2>Claims worth trying to break</h2><p>These tentative patterns need more evidence. Inspect the ratings, or ask Dossier to look for counterexamples.</p></header>
        <div class="claim-grid">{#each hypotheses as claim}<button class="claim-card glass-panel tentative" use:glassPointer onclick={() => selected = claim}><span class="claim-status">Hypothesis · {claim.evidence.counterexampleItemKeys.length} counterexamples</span><strong>{claimStatement(claim)}</strong><span class="evidence-summary">{evidenceSummary(claim)}</span></button>{/each}</div>
        {#if hypotheses.length}<button class="secondary-action" onclick={() => goto(`/rate?focus=${encodeURIComponent(hypotheses[0].conditions[0].label)}`)}>Probe the weakest claim</button>{/if}
      </section>

      {#if corrections.length}
        <section class="layer correction-layer"><header><div><span class="layer-index">04</span><span class="screen-kicker">Corrections</span></div><h2>Authority Dossier remembers</h2><p>Rejected and corrected claims remain as tombstones so they cannot silently regenerate.</p></header><div class="claim-list muted-list">{#each corrections as claim}<button class="claim-row" onclick={() => selected = claim}><span><strong>{claimStatement(claim)}.</strong><small>{claim.provenance.replaceAll("_", " ")}</small></span><span class="claim-status">inactive</span><IconArrowRightRegular class="icon-16" /></button>{/each}</div></section>
      {/if}
    </div>
  {/if}
</section>

{#if selected}
  <div class="inspector-backdrop" onclick={(event) => event.currentTarget === event.target && (selected = null)} role="presentation">
    <div class="inspector glass-panel" role="dialog" aria-modal="true" aria-label={`Evidence for ${claimSubject(selected)}`} use:motionReveal>
      <button class="close" aria-label="Close evidence" onclick={() => selected = null}><IconXRegular class="icon-20" /></button><span class="screen-kicker">Claim and provenance</span><h2>{claimStatement(selected)}</h2>
      <div class="status-line"><span>{origin(selected)}</span><span>{evidenceSummary(selected)}</span><span>{selected.conditions.length} condition{selected.conditions.length === 1 ? "" : "s"}</span></div>
      <p>These ratings support or challenge this statement. Evidence counts do not measure its chance of being correct.</p>
      <h3>Supporting evidence</h3><div class="evidence-list">{#each evidenceFor(selected.evidence.supportingItemKeys) as entry}<div><span><strong>{entry.item.title}</strong><small>{entry.item.medium === "movie" ? "Film" : "Series"} · {entry.item.year ?? "Year unknown"}</small></span><b>{ratingWeight(entry.rating) > 0 ? "+" : ""}{ratingWeight(entry.rating)}</b></div>{/each}</div>
      <h3>Counterexamples</h3>
      {#if selected.evidence.counterexampleItemKeys.length}<div class="evidence-list counterexamples">{#each evidenceFor(selected.evidence.counterexampleItemKeys) as entry}<div><span><strong>{entry.item.title}</strong><small>Contrary explicit rating</small></span><b class:negative={ratingWeight(entry.rating) < 0}>{ratingWeight(entry.rating) > 0 ? "+" : ""}{ratingWeight(entry.rating)}</b></div>{/each}</div>{:else}<p class="muted">No recorded counterexamples. This does not establish that the statement is correct.</p>{/if}
      <div class="metrics"><span><b>{selected.evidence.supportingItemKeys.length}</b>supporting ratings</span><span><b>{selected.evidence.counterexampleItemKeys.length}</b>counterexamples</span><span><b>{selected.evidence.tasteSpaceClusterIds.length}</b>linked clusters</span></div>
      {#if selected.active}<div class="claim-controls">{#if selected.provenance === "inferred"}<button class="confirm" disabled={feedbackBusy} onclick={() => void feedback(selected!, "user_confirmed")}><IconCheckRegular class="icon-16" /> Confirm this claim</button>{/if}<button disabled={feedbackBusy} onclick={() => void correctDirection(selected!)}>The opposite is true</button><button class="reject" disabled={feedbackBusy} onclick={() => void feedback(selected!, "explicitly_rejected")}>Reject this interpretation</button></div>{:else}<p class="authority-note">This correction is authoritative. Identical inferred evidence will remain inactive unless you explicitly confirm it later.</p>{/if}
    </div>
  </div>
{/if}

<style>
  .dossier-screen{max-width:1320px;margin:auto;padding:clamp(24px,4vw,64px);display:flex;flex-direction:column;gap:42px}.dossier-cover{display:grid;grid-template-columns:minmax(0,1fr) 310px;gap:48px;align-items:end}.dossier-cover h1{max-width:15ch;margin:10px 0 16px}.dossier-cover p{max-width:70ch}.ledger{padding:18px;display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.ledger span{display:flex;flex-direction:column;font-size:.7rem;color:var(--text-tertiary)}.ledger strong{font-family:var(--font-display);font-size:1.5rem;color:var(--text-primary)}.ledger small{grid-column:1/-1;border-top:1px solid var(--border-subtle);padding-top:11px;color:var(--text-tertiary)}
  .map-section{padding:22px}.map-section>header{display:flex;justify-content:space-between;gap:24px;align-items:end}.map-section h2{font-family:var(--font-display);font-size:1.2rem;margin-top:6px}.map-section header p{max-width:48ch;color:var(--text-tertiary);font-size:.76rem;line-height:1.5}.projection{height:360px;position:relative;overflow:hidden;margin-top:20px;border:1px solid var(--border-subtle);border-radius:var(--radius-md);background:radial-gradient(circle at 50% 50%,color-mix(in srgb,var(--accent) 5%,transparent),transparent 55%),linear-gradient(color-mix(in srgb,var(--border-subtle) 48%,transparent) 1px,transparent 1px),linear-gradient(90deg,color-mix(in srgb,var(--border-subtle) 48%,transparent) 1px,transparent 1px);background-size:auto,40px 40px,40px 40px}.axis{position:absolute;background:var(--border-default);opacity:.5}.axis.x{left:0;right:0;top:50%;height:1px}.axis.y{top:0;bottom:0;left:50%;width:1px}.map-point{--size:7px;position:absolute;left:var(--x);top:var(--y);width:var(--size);height:var(--size);transform:translate(-50%,-50%);border-radius:50%;border:0;background:var(--success);opacity:calc(.35 + var(--confidence) * .65)}.map-point.negative{background:var(--danger)}.map-point.cluster-point{--size:24px;border:2px solid color-mix(in srgb,var(--text-primary) 70%,transparent);background:color-mix(in srgb,var(--accent) 40%,transparent);box-shadow:0 0 0 7px color-mix(in srgb,var(--accent) 8%,transparent)}.map-point.claim-point{--size:15px;border-radius:4px;rotate:45deg;background:var(--accent);border:2px solid var(--base)}.map-point.weak-point{--size:28px;background:transparent;border:1px dashed var(--warning,#b47d2b)}.map-point.interactive{cursor:pointer;z-index:3}.map-point.interactive:hover{scale:1.18}.legend{display:flex;gap:18px;flex-wrap:wrap;margin-top:12px;color:var(--text-tertiary);font-size:.68rem}.legend span::before{content:"";display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--success);margin-right:6px}.legend .negative::before{background:var(--danger)}.legend .cluster::before{width:12px;height:12px;background:color-mix(in srgb,var(--accent) 45%,transparent);border:1px solid var(--text-tertiary)}.legend .claim::before{border-radius:2px;background:var(--accent);rotate:45deg}.legend .weak::before{width:12px;height:12px;background:transparent;border:1px dashed var(--warning,#b47d2b)}
  .layers{display:flex;flex-direction:column;gap:68px}.layer{display:grid;grid-template-columns:280px minmax(0,1fr);column-gap:50px;row-gap:22px}.layer>header{grid-row:1/3}.layer header>div{display:flex;gap:10px;align-items:center}.layer-index{font-family:var(--font-mono);font-size:.65rem;color:var(--text-tertiary)}.layer h2{font-family:var(--font-display);font-size:1.35rem;margin:10px 0 8px}.layer header p{font-size:.82rem;line-height:1.5;color:var(--text-secondary);margin:0}.paper-layer{padding:28px;background:color-mix(in srgb,var(--base-secondary) 76%,transparent);border:1px solid var(--border-subtle);border-radius:var(--radius-lg)}.claim-list{display:flex;flex-direction:column}.claim-row{display:grid;grid-template-columns:1fr auto 20px;align-items:center;gap:16px;padding:18px 0;border:0;border-bottom:1px solid var(--border-subtle);background:transparent;text-align:left;color:var(--text-primary);cursor:pointer}.claim-row:first-child{padding-top:0}.claim-row span:first-child{display:flex;flex-direction:column;gap:5px}.claim-row small{color:var(--text-tertiary)}.muted-list{opacity:.72}.claim-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.claim-card{min-height:150px;padding:18px;border:1px solid var(--glass-border);color:var(--text-primary);text-align:left;cursor:pointer;display:flex;flex-direction:column;justify-content:space-between;align-items:flex-start}.claim-card strong{font-family:var(--font-display);font-size:1.02rem}.claim-status{text-transform:uppercase;letter-spacing:.08em;font-size:.62rem;color:var(--text-tertiary)}.claim-card.tentative{border-style:dashed}.layer-empty{grid-column:1/-1;border:1px dashed var(--border-subtle);border-radius:var(--radius-md);padding:20px;display:flex;flex-direction:column;gap:5px;color:var(--text-secondary);font-size:.8rem}.layer-empty strong{font-family:var(--font-display);color:var(--text-primary);font-size:.95rem}.evidence-summary{font-size:.7rem;line-height:1.5;color:var(--text-secondary);max-width:100%}.empty{padding:32px;max-width:640px}.empty h2{font-family:var(--font-display)}
  .inspector-backdrop{position:fixed;inset:0;background:rgba(20,18,15,.34);backdrop-filter:blur(8px);z-index:200;display:flex;justify-content:flex-end}.inspector{height:100%;width:min(560px,100%);border-radius:28px 0 0 28px;padding:34px;overflow:auto}.close{float:right;border:0;background:var(--glass-fill);color:var(--text-primary);width:38px;height:38px;border-radius:14px;display:grid;place-items:center;cursor:pointer}.inspector h2{font-family:var(--font-display);font-size:1.6rem;margin:14px 0}.inspector>p{color:var(--text-secondary);font-size:.86rem;line-height:1.55}.status-line{display:flex;gap:8px;flex-wrap:wrap}.status-line span{padding:6px 9px;border:1px solid var(--border-subtle);border-radius:999px;font-size:.68rem;color:var(--text-secondary)}.inspector h3{font-size:.7rem;text-transform:uppercase;letter-spacing:.1em;margin-top:22px}.evidence-list{display:flex;flex-direction:column}.evidence-list>div{display:flex;justify-content:space-between;gap:14px;border-bottom:1px solid var(--border-subtle);padding:9px 0}.evidence-list span{display:flex;flex-direction:column;gap:3px}.evidence-list small{color:var(--text-tertiary)}.evidence-list b{color:var(--success);font-family:var(--font-mono)}.evidence-list b.negative{color:var(--danger)}.counterexamples{border-left:2px solid color-mix(in srgb,var(--warning,#b47d2b) 55%,transparent);padding-left:14px}.metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:18px 0}.metrics span{padding:12px;border:1px solid var(--border-subtle);border-radius:var(--radius-sm);font-size:.67rem;color:var(--text-tertiary)}.metrics b{display:block;font:1rem var(--font-display);color:var(--text-primary)}.claim-controls{position:sticky;bottom:-34px;display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:18px 0 34px;border-top:1px solid var(--border-subtle);background:linear-gradient(transparent 0,var(--base-secondary) 14px)}.claim-controls button{padding:11px;border:1px solid var(--border-default);border-radius:var(--radius-sm);background:var(--base-secondary);color:var(--text-primary);cursor:pointer}.claim-controls .confirm{grid-column:1/-1;display:flex;justify-content:center;gap:7px;background:var(--accent);border-color:var(--accent);color:var(--accent-contrast,#fff)}.claim-controls .reject{color:var(--danger)}.claim-controls button:disabled{opacity:.5}.authority-note{padding:14px;border-radius:var(--radius-sm);background:color-mix(in srgb,var(--warning,#b47d2b) 9%,transparent)}
  @media(max-width:900px){.dossier-cover{grid-template-columns:1fr}.ledger{max-width:420px}.layer{grid-template-columns:1fr}.layer>header{grid-row:auto}.paper-layer{padding:22px}.map-section>header{align-items:start;flex-direction:column}.projection{height:300px}}
  @media(max-width:720px){.dossier-screen{padding:24px 14px 115px;gap:32px}.dossier-cover{gap:24px}.dossier-cover h1{font-size:2rem}.layers{gap:46px}.claim-grid{grid-template-columns:1fr}.claim-row{grid-template-columns:1fr auto 18px}.evidence-summary{font-size:.68rem}.projection{height:260px}.inspector{border-radius:24px 24px 0 0;height:90%;margin-top:auto;padding:24px}.metrics{grid-template-columns:1fr}.claim-controls{bottom:-24px;padding-bottom:24px}}
</style>
