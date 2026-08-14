<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { preferences } from "$lib/state/preferences.svelte";
  import { tasteSnapshot } from "$lib/calibration";
  import { ratingKind, ratingWeight, type RatingEntry } from "$lib/types";
  import { motionPress, motionReveal, motionStaggerChildren, glassPointer } from "$lib/design/motion";
  import IconPencilSimpleRegular from "phosphor-icons-svelte/IconPencilSimpleRegular.svelte";
  import IconArrowRightRegular from "phosphor-icons-svelte/IconArrowRightRegular.svelte";
  import IconXRegular from "phosphor-icons-svelte/IconXRegular.svelte";

  type Claim = { name:string; layer:"pattern"|"hypothesis"|"confirmed"; direction:string; confidence:number; entries:RatingEntry[]; explanation:string };
  let selected = $state<Claim | null>(null);
  let correction = $state<Claim | null>(null);

  onMount(() => void preferences.hydrate());

  const entries = $derived(preferences.entries());
  const snapshot = $derived(tasteSnapshot(entries));
  const claims = $derived.by<Claim[]>(() => snapshot.slice(0, 10).map((area) => {
    const evidence = entries.filter((entry) => entry.item.genres.includes(area.name));
    const pull = evidence.reduce((sum, entry) => sum + ratingWeight(entry.rating), 0);
    const settled = area.status === "strong";
    return {
      name: area.name,
      layer: settled ? (evidence.length >= 10 ? "confirmed" : "pattern") : "hypothesis",
      direction: pull > .5 ? "drawn to" : pull < -.5 ? "usually avoids" : "responds selectively to",
      confidence: Math.min(94, settled ? 62 + evidence.length * 3 : 28 + evidence.length * 4),
      entries: evidence.sort((a,b) => Math.abs(ratingWeight(b.rating))-Math.abs(ratingWeight(a.rating))),
      explanation: area.why
    };
  }));
  const confirmed = $derived(claims.filter((claim) => claim.layer === "confirmed"));
  const patterns = $derived(claims.filter((claim) => claim.layer === "pattern"));
  const hypotheses = $derived(claims.filter((claim) => claim.layer === "hypothesis"));
  const liked = $derived(entries.filter((entry) => ratingKind(entry.rating) === "like").length);
  const disliked = $derived(entries.filter((entry) => ratingKind(entry.rating) === "dislike").length);

  function openClaim(claim: Claim) { selected = claim; }
  function handleKey(event: KeyboardEvent): void {
    if (event.key !== "Escape") return;
    if (correction) correction = null;
    else selected = null;
  }
  function teachCorrection(): void {
    if (!correction) return;
    const focus = correction.name;
    correction = null;
    selected = null;
    void goto(`/rate?focus=${encodeURIComponent(focus)}`);
  }
</script>

<svelte:window on:keydown={handleKey} />

<svelte:head><title>Your Dossier</title></svelte:head>

<section class="dossier-screen">
  <header class="dossier-cover" use:motionReveal>
    <div>
      <span class="screen-kicker">Your Dossier · living document</span>
      <h1 class="editorial-title">What Dossier currently believes about you.</h1>
      <p class="editorial-lede">Every statement is provisional, inspectable, and yours to correct. Today this is built from film and television; future media will join the same evidence trail.</p>
    </div>
    <div class="ledger glass-panel">
      <span><strong>{entries.length}</strong> responses</span>
      <span><strong>{liked}</strong> positive</span>
      <span><strong>{disliked}</strong> negative</span>
      <small>Stored on this device</small>
    </div>
  </header>

  {#if !preferences.loaded}
    <p class="muted">Opening your dossier…</p>
  {:else if entries.length === 0}
    <section class="empty glass-panel"><span class="screen-kicker">Blank, by design</span><h2>Dossier does not invent a person before you provide evidence.</h2><p>Teach it a handful of things you know, then return to inspect the first cautious patterns.</p><button class="primary-action" onclick={() => goto('/teach')}>Teach Dossier</button></section>
  {:else}
    <div class="layers" use:motionStaggerChildren>
      <section class="layer paper-layer">
        <header><div><span class="layer-index">01</span><span class="screen-kicker">Durable knowledge</span></div><h2>Confirmed by repetition</h2><p>Stable patterns supported by several consistent responses. Still correctable.</p></header>
        <div class="claim-list">
          {#each confirmed.length ? confirmed : patterns.slice(0,2) as claim}
            <button class="claim-row" onclick={() => openClaim(claim)} use:motionPress><span><strong>You are {claim.direction} {claim.name.toLowerCase()}.</strong><small>{claim.explanation}</small></span><span class="confidence"><i style={`--confidence:${claim.confidence}%`}></i>{claim.confidence}%</span><IconArrowRightRegular class="icon-16" /></button>
          {/each}
          {#if confirmed.length === 0 && patterns.length === 0}<div class="layer-empty"><strong>Nothing promoted here yet.</strong><span>Dossier will not call a pattern durable until your evidence repeats consistently.</span></div>{/if}
        </div>
      </section>

      <section class="layer">
        <header><div><span class="layer-index">02</span><span class="screen-kicker">Patterns</span></div><h2>Useful, but not identity</h2><p>Repeated signals that help recommendations. Dossier will keep testing their boundaries.</p></header>
        <div class="claim-grid">
          {#each patterns.slice(confirmed.length ? 0 : 2, 6) as claim}
            <button class="claim-card glass-panel" use:glassPointer onclick={() => openClaim(claim)}><span class="claim-status">Pattern · {claim.entries.length} signals</span><strong>{claim.direction} {claim.name.toLowerCase()}</strong><span class="confidence"><i style={`--confidence:${claim.confidence}%`}></i>{claim.confidence}%</span></button>
          {/each}
          {#if patterns.length === 0}<div class="layer-empty"><strong>No settled patterns yet.</strong><span>Your current evidence remains in hypotheses below.</span></div>{/if}
        </div>
      </section>

      <section class="layer hypothesis-layer">
        <header><div><span class="layer-index">03</span><span class="screen-kicker">Hypotheses</span></div><h2>Ideas Dossier has not earned yet</h2><p>Mixed or sparse evidence. These never become facts silently.</p></header>
        <div class="claim-grid">
          {#each hypotheses.slice(0,6) as claim}
            <button class="claim-card glass-panel tentative" use:glassPointer onclick={() => openClaim(claim)}><span class="claim-status">Hypothesis · needs evidence</span><strong>You may be {claim.direction} {claim.name.toLowerCase()}.</strong><span class="confidence"><i style={`--confidence:${claim.confidence}%`}></i>{claim.confidence}%</span></button>
          {/each}
        </div>
        {#if hypotheses.length}<button class="secondary-action" onclick={() => goto(`/rate?focus=${encodeURIComponent(hypotheses[0].name)}`)}>Investigate the weakest area</button>{/if}
      </section>
    </div>
  {/if}
</section>

{#if selected}
  <div class="inspector-backdrop" onclick={(event) => event.currentTarget === event.target && (selected = null)} role="presentation">
    <div class="inspector glass-panel" role="dialog" aria-modal="true" aria-label={`Evidence for ${selected.name}`} use:motionReveal>
      <button class="close" aria-label="Close evidence" onclick={() => selected = null}><IconXRegular class="icon-20" /></button>
      <span class="screen-kicker">Evidence inspector</span>
      <h2>{selected.direction} {selected.name.toLowerCase()}</h2>
      <div class="status-line"><span>{selected.layer}</span><span>{selected.confidence}% confidence</span><span>{selected.entries.length} signals</span></div>
      <p>{selected.explanation} Confidence describes the evidence Dossier has, not certainty about who you are.</p>
      <h3>Signals used</h3>
      <div class="evidence-list">
        {#each selected.entries.slice(0,8) as entry}
          <div><span><strong>{entry.item.title}</strong><small>{entry.item.medium === "movie" ? "Film" : "Series"} · {entry.item.year ?? "Year unknown"}</small></span><b class:negative={ratingWeight(entry.rating) < 0}>{ratingWeight(entry.rating) > 0 ? "+" : ""}{ratingWeight(entry.rating)}</b></div>
        {/each}
      </div>
      <button class="correction" onclick={() => correction = selected}><IconPencilSimpleRegular class="icon-16" /> Correct this interpretation</button>
    </div>
  </div>
{/if}

{#if correction}
  <div class="inspector-backdrop" role="presentation">
    <div class="correction-card glass-panel" role="dialog" aria-modal="true" aria-label="Correction preview" use:motionReveal>
      <span class="screen-kicker">Propagation preview</span><h2>Before Dossier changes this</h2>
      <p>Correcting <strong>“{correction.direction} {correction.name.toLowerCase()}”</strong> will weaken this claim and recommendations that cite it. Your original ratings remain untouched as provenance.</p>
      <div class="impact"><span><b>{correction.entries.length}</b> evidence links stay visible</span><span><b>1</b> profile claim is weakened</span><span><b>Future</b> questions test the correction</span></div>
      <div class="correction-actions"><button class="secondary-action" onclick={() => correction = null}>Cancel</button><button class="primary-action" onclick={teachCorrection}>Teach the correction</button></div>
    </div>
  </div>
{/if}

<style>
  .dossier-screen{max-width:1320px;margin:auto;padding:clamp(24px,4vw,64px);display:flex;flex-direction:column;gap:52px}.dossier-cover{display:grid;grid-template-columns:minmax(0,1fr) 290px;gap:48px;align-items:end}.dossier-cover h1{max-width:14ch;margin:10px 0 16px}.dossier-cover p{max-width:66ch}
  .ledger{padding:18px;display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.ledger span{display:flex;flex-direction:column;font-size:.7rem;color:var(--text-tertiary)}.ledger strong{font-family:var(--font-display);font-size:1.5rem;color:var(--text-primary)}.ledger small{grid-column:1/-1;border-top:1px solid var(--border-subtle);padding-top:11px;color:var(--text-tertiary)}
  .layers{display:flex;flex-direction:column;gap:72px}.layer{display:grid;grid-template-columns:280px minmax(0,1fr);column-gap:50px;row-gap:22px}.layer>header{grid-row:1/3}.layer header>div{display:flex;gap:10px;align-items:center}.layer-index{font-family:var(--font-mono);font-size:.65rem;color:var(--text-tertiary)}.layer h2{font-family:var(--font-display);font-size:1.35rem;margin:10px 0 8px}.layer header p{font-size:.82rem;line-height:1.5;color:var(--text-secondary);margin:0}
  .paper-layer{padding:28px;background:color-mix(in srgb,var(--base-secondary) 76%,transparent);border:1px solid var(--border-subtle);border-radius:var(--radius-lg)}.claim-list{display:flex;flex-direction:column}.claim-row{display:grid;grid-template-columns:1fr 150px 20px;align-items:center;gap:16px;padding:18px 0;border:0;border-bottom:1px solid var(--border-subtle);background:transparent;text-align:left;color:var(--text-primary);cursor:pointer}.claim-row:first-child{padding-top:0}.claim-row span:first-child{display:flex;flex-direction:column;gap:5px}.claim-row small{color:var(--text-tertiary)}
  .claim-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.claim-card{min-height:150px;padding:18px;border:1px solid var(--glass-border);color:var(--text-primary);text-align:left;cursor:pointer;display:flex;flex-direction:column;justify-content:space-between;align-items:flex-start}.claim-card strong{font-family:var(--font-display);font-size:1.02rem}.claim-status{text-transform:uppercase;letter-spacing:.08em;font-size:.62rem;color:var(--text-tertiary)}.claim-card.tentative{border-style:dashed}
  .layer-empty{grid-column:1/-1;border:1px dashed var(--border-subtle);border-radius:var(--radius-md);padding:20px;display:flex;flex-direction:column;gap:5px;color:var(--text-secondary);font-size:.8rem}.layer-empty strong{font-family:var(--font-display);color:var(--text-primary);font-size:.95rem}
  .confidence{display:flex;align-items:center;gap:8px;font:600 .68rem var(--font-mono);color:var(--text-tertiary)}.confidence i{width:90px;height:3px;border-radius:3px;background:linear-gradient(90deg,var(--accent) var(--confidence),var(--border-subtle) var(--confidence));transition:background .3s}.empty{padding:32px;max-width:640px}.empty h2{font-family:var(--font-display)}
  .inspector-backdrop{position:fixed;inset:0;background:rgba(20,18,15,.34);backdrop-filter:blur(8px);z-index:200;display:flex;justify-content:flex-end}.inspector{height:100%;width:min(520px,100%);border-radius:28px 0 0 28px;padding:34px;overflow:auto}.close{float:right;border:0;background:var(--glass-fill);color:var(--text-primary);width:38px;height:38px;border-radius:14px;display:grid;place-items:center;cursor:pointer}.inspector h2,.correction-card h2{font-family:var(--font-display);font-size:1.6rem;margin:14px 0}.inspector>p{color:var(--text-secondary);font-size:.86rem;line-height:1.55}.status-line{display:flex;gap:8px;flex-wrap:wrap}.status-line span{padding:6px 9px;border:1px solid var(--border-subtle);border-radius:999px;font-size:.68rem;color:var(--text-secondary)}.inspector h3{font-size:.75rem;text-transform:uppercase;letter-spacing:.08em;margin-top:30px}.evidence-list{display:flex;flex-direction:column}.evidence-list>div{display:flex;justify-content:space-between;gap:14px;border-bottom:1px solid var(--border-subtle);padding:13px 0}.evidence-list span{display:flex;flex-direction:column;gap:3px}.evidence-list small{color:var(--text-tertiary)}.evidence-list b{color:var(--success);font-family:var(--font-mono)}.evidence-list b.negative{color:var(--danger)}.correction{width:100%;margin-top:28px;padding:12px;display:flex;justify-content:center;gap:8px;border:1px solid var(--border-strong);border-radius:var(--radius-md);background:transparent;color:var(--text-primary);cursor:pointer}
  .correction-card{margin:auto;width:min(620px,calc(100% - 28px));padding:30px}.correction-card>p{color:var(--text-secondary);line-height:1.55}.impact{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:24px 0}.impact span{padding:14px;border:1px solid var(--border-subtle);border-radius:var(--radius-md);font-size:.75rem;color:var(--text-secondary)}.impact b{display:block;font-family:var(--font-display);font-size:1.15rem;color:var(--text-primary)}.correction-actions{display:flex;justify-content:flex-end;gap:10px}
  @media(max-width:900px){.dossier-cover{grid-template-columns:1fr}.ledger{max-width:380px}.layer{grid-template-columns:1fr}.layer>header{grid-row:auto}.paper-layer{padding:22px}}
  @media(max-width:720px){.dossier-screen{padding:24px 14px 115px;gap:38px}.dossier-cover{gap:24px}.dossier-cover h1{font-size:2rem}.layers{gap:48px}.claim-grid{grid-template-columns:1fr}.claim-row{grid-template-columns:1fr auto 18px}.confidence i{width:50px}.inspector{border-radius:24px 24px 0 0;height:88%;margin-top:auto;padding:24px}.impact{grid-template-columns:1fr}.correction-actions{flex-direction:column-reverse}.correction-actions button{width:100%}}
</style>
