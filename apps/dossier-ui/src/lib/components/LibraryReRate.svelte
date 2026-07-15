<script lang="ts">
  import { preferences } from "$lib/state/preferences.svelte";
  import { posterUrl } from "$lib/poster";
  import { RATING_NOT_INTERESTED, RATING_WATCHLIST, type Rating, type TmdbItem } from "$lib/types";
  import IconXBold from "phosphor-icons-svelte/IconXBold.svelte";
  import IconEyeSlashRegular from "phosphor-icons-svelte/IconEyeSlashRegular.svelte";

  let { title, items, onClose }: { title:string; items:TmdbItem[]; onClose:()=>void } = $props();
  let index=$state(0), busy=$state(false), error=$state<string|null>(null);
  const current=$derived(items[index] ?? null);
  const existing=$derived(current ? preferences.ratingFor(current.medium,current.id) : undefined);
  const stops=[-3,-2,-1,0,1,2,3] as const;
  const labels:Record<number,string>={"-3":"Extremely negative","-2":"Fairly negative","-1":"Slightly negative","0":"Neutral","1":"Slightly positive","2":"Fairly positive","3":"Extremely positive"};

  function next():void { index += 1; }
  async function choose(rating:Rating|null):Promise<void> {
    if (!current || busy) return;
    if (rating === existing) { next(); return; }
    busy=true; error=null;
    try {
      if (rating === null) { await preferences.clearRating(`${current.medium}:${current.id}`); await preferences.skip(current.medium,current.id); }
      else await preferences.setRating(current,rating);
      next();
    } catch(err) { error=err instanceof Error?err.message:String(err); }
    finally { busy=false; }
  }
  function onKeydown(event:KeyboardEvent):void {
    if(event.key==="Escape"){event.preventDefault();onClose();return;}
    if(event.repeat||busy||!current)return;
    if(event.key>="1"&&event.key<="7"){event.preventDefault();void choose(stops[Number(event.key)-1]);}
    else if(event.key===" "){event.preventDefault();void choose(null);}
  }
</script>

<svelte:window onkeydown={onKeydown} />

<div class="rerate" role="dialog" aria-modal="true" aria-labelledby="rerate-title">
  <header><div><span>Library · Re-rate</span><h1 id="rerate-title">{title}</h1></div><p>{Math.min(index+1,items.length)} of {items.length}</p><button class="close" aria-label="Close re-rate" onclick={onClose}><IconXBold class="icon-18" /></button></header>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  {#if !current}
    <div class="done"><h2>Carousel reviewed.</h2><p>Your Library now reflects those corrections.</p><button onclick={onClose}>Back to Library</button></div>
  {:else}
    <main>
      <div class="poster-frame">{#if posterUrl(current.posterPath,"w500")}<img src={posterUrl(current.posterPath,"w500")} alt="" />{:else}<div class="poster-empty"></div>{/if}</div>
      <section class="info"><span class="position">Previously filed as {title}</span><h2>{current.title}</h2><p>{current.year ?? ""}{current.keywords.length ? ` · ${current.keywords.slice(0,3).join(" · ")}` : ""}</p>
        <div class="scale" role="group" aria-label="Re-rate this title">
          {#each stops as stop}<button class:keep={existing===stop} disabled={busy} onclick={()=>void choose(stop)}><strong>{stop<0?"−".repeat(-stop):stop>0?"+".repeat(stop):"•"}</strong><span>{existing===stop?"Keep as is":labels[stop]}</span></button>{/each}
        </div>
        <div class="secondary">
          <button class:keep={existing===RATING_WATCHLIST} disabled={busy} onclick={()=>void choose(RATING_WATCHLIST)}>{existing===RATING_WATCHLIST?"Keep as is":"Add to my Watchlist"}</button>
          <button disabled={busy} onclick={()=>void choose(null)}><IconEyeSlashRegular class="icon-18" /> I haven't seen it</button>
          <button class:keep={existing===RATING_NOT_INTERESTED} disabled={busy} onclick={()=>void choose(RATING_NOT_INTERESTED)}>{existing===RATING_NOT_INTERESTED?"Keep as is":"I don't care about it"}</button>
        </div>
      </section>
    </main>
  {/if}
</div>

<style>
  .rerate{position:fixed;inset:0;z-index:100;background:var(--base);display:flex;flex-direction:column;padding:var(--space-6);color:var(--text-primary)}
  header{display:grid;grid-template-columns:1fr auto auto;align-items:center;gap:var(--space-4);border-bottom:1px solid var(--border-subtle);padding-bottom:var(--space-3)} header span,.position{font-size:.7rem;text-transform:uppercase;letter-spacing:.08em;color:var(--accent)} h1{font:1.35rem var(--font-display);margin:2px 0 0} header p{color:var(--text-tertiary);font-size:.8rem}.close{width:36px;height:36px;border:1px solid var(--border-subtle);border-radius:999px;background:var(--base-secondary);color:inherit;cursor:pointer}
  main{flex:1;min-height:0;display:grid;grid-template-columns:minmax(230px,38vh) minmax(500px,760px);justify-content:center;align-items:center;gap:clamp(28px,6vw,90px);padding:var(--space-5) 0}.poster-frame{border-radius:var(--radius-lg);overflow:hidden;box-shadow:0 22px 55px rgba(0,0,0,.35)}.poster-frame img,.poster-empty{display:block;width:100%;aspect-ratio:2/3;object-fit:cover;background:var(--base-tertiary)}.info h2{font:clamp(1.8rem,3vw,3.2rem) var(--font-display);margin:var(--space-2) 0}.info>p{color:var(--text-secondary);margin:0 0 var(--space-5)}
  .scale{display:grid;grid-template-columns:repeat(7,1fr);gap:var(--space-2)}.scale button,.secondary button,.done button{min-height:68px;border:1px solid var(--border-subtle);border-radius:var(--radius-md);background:var(--base-secondary);color:inherit;padding:var(--space-2);cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px}.scale strong{font:1rem var(--font-display)}.scale span{font-size:.67rem}.scale button:hover,.secondary button:hover{border-color:var(--accent)}button.keep{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 12%,var(--base-secondary))}.secondary{display:grid;grid-template-columns:repeat(3,1fr);gap:var(--space-2);margin-top:var(--space-3)}.secondary button{min-height:48px;flex-direction:row;font-size:.8rem}.done{margin:auto;text-align:center}.done h2{font-family:var(--font-display)}.error{color:var(--danger)}
  @media(max-width:850px){main{grid-template-columns:minmax(160px,240px) 1fr;gap:var(--space-4)}.scale{grid-template-columns:repeat(4,1fr)}.secondary{grid-template-columns:1fr}.rerate{padding:var(--space-4)}}
</style>
