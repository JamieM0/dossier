<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { preferences } from "$lib/state/preferences.svelte";
  import { ratingKind } from "$lib/types";
  import { motionHoverLift, motionPress, motionReveal, motionStaggerChildren, glassPointer } from "$lib/design/motion";
  import IconCardsThreeRegular from "phosphor-icons-svelte/IconCardsThreeRegular.svelte";
  import IconScalesRegular from "phosphor-icons-svelte/IconScalesRegular.svelte";
  import IconWaveformRegular from "phosphor-icons-svelte/IconWaveformRegular.svelte";

  onMount(() => void preferences.hydrate());

  const rated = $derived(preferences.ratingCount());
  const pairwise = $derived(preferences.pairwise.length);
  const positive = $derived(preferences.entries().filter((entry) => ratingKind(entry.rating) === "like").length);
  const negative = $derived(preferences.entries().filter((entry) => ratingKind(entry.rating) === "dislike").length);

  const modes = $derived([
    {
      title: "Rate what you know",
      label: "Broad learning",
      body: "Respond to familiar films and series. Every answer says what it changes before Dossier moves on.",
      meta: `${rated} responses · keys 1–7`,
      href: "/rate",
      icon: IconCardsThreeRegular,
      tone: "amber"
    },
    {
      title: "Refine close calls",
      label: "Fine distinctions",
      body: "Choose between things you rated similarly. This teaches the difference between ‘good’ and ‘you’.",
      meta: `${pairwise} comparisons resolved`,
      href: "/refine",
      icon: IconScalesRegular,
      tone: "blue"
    },
    {
      title: "Challenge its assumptions",
      label: "Dissonance",
      body: "Test confident negative predictions. Surprising answers weaken the assumption instead of being explained away.",
      meta: `${positive} positive · ${negative} negative signals`,
      href: "/rate?mode=challenge",
      icon: IconWaveformRegular,
      tone: "rose"
    }
  ]);
</script>

<svelte:head><title>Teach Dossier</title></svelte:head>

<section class="teach-screen">
  <header class="intro" use:motionReveal>
    <h1 class="editorial-title">Teach Dossier</h1>
    <p class="editorial-lede">Choose how you want to add or correct evidence.</p>
  </header>

  <div class="mode-grid" use:motionStaggerChildren>
    {#each modes as mode}
      <button class="mode-card glass-panel {mode.tone}" use:motionHoverLift use:motionPress use:glassPointer onclick={() => goto(mode.href)}>
        <span class="mode-icon"><mode.icon class="icon-24" /></span>
        <span class="mode-copy">
          <span class="mode-label">{mode.label}</span>
          <strong>{mode.title}</strong>
          <span class="mode-body">{mode.body}</span>
        </span>
        <span class="mode-meta">{mode.meta}<i aria-hidden="true">→</i></span>
      </button>
    {/each}
  </div>

</section>

<style>
  .teach-screen{min-height:100%;padding:clamp(24px,4vw,64px);display:flex;flex-direction:column;gap:clamp(26px,4vw,48px);max-width:1120px;margin:auto}
  .intro{max-width:720px}.intro h1{margin:0 0 8px}.intro p{max-width:54ch}
  .mode-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}
  .mode-card{position:relative;overflow:hidden;min-height:250px;padding:22px;border:1px solid color-mix(in srgb,var(--border) 55%,transparent);border-radius:18px;background:color-mix(in srgb,var(--base-secondary) 74%,transparent);text-align:left;color:var(--text-primary);cursor:pointer;display:flex;flex-direction:column;align-items:flex-start;justify-content:space-between}
  .mode-card::after{content:"";position:absolute;width:220px;height:220px;border-radius:50%;right:-90px;top:-100px;background:var(--glow);filter:blur(2px);opacity:.7;transition:transform .5s cubic-bezier(.16,1,.3,1)}
  .mode-card:hover::after{transform:scale(1.3) translate(-8px,10px)}
  .amber{--glow:radial-gradient(circle,rgba(205,133,61,.28),transparent 68%)}.blue{--glow:radial-gradient(circle,rgba(91,136,166,.26),transparent 68%)}.rose{--glow:radial-gradient(circle,rgba(172,88,88,.24),transparent 68%)}
  .mode-icon{width:48px;height:48px;border-radius:16px;display:grid;place-items:center;background:color-mix(in srgb,var(--base) 70%,transparent);border:1px solid var(--glass-border);box-shadow:var(--shadow-sm)}
  .mode-copy{display:flex;flex-direction:column;gap:10px;position:relative;z-index:1}.mode-label{font-size:.68rem;letter-spacing:.1em;text-transform:uppercase;color:var(--text-tertiary)}.mode-copy strong{font-family:var(--font-display);font-size:1.5rem}.mode-body{font-size:.9rem;line-height:1.55;color:var(--text-secondary);max-width:34ch}
  .mode-meta{width:100%;display:flex;justify-content:space-between;align-items:center;font-size:.75rem;color:var(--text-tertiary);position:relative;z-index:1}.mode-meta i{font-style:normal;font-size:1.3rem;color:var(--text-primary)}
  @media(max-width:880px){.mode-grid{grid-template-columns:1fr}.mode-card{min-height:190px}}
  @media(max-width:720px){.teach-screen{padding:22px 14px 24px;gap:22px}.intro h1{font-size:1.8rem}.mode-grid{gap:10px}.mode-card{min-height:154px;padding:16px}.mode-icon{width:40px;height:40px;border-radius:13px}.mode-copy{gap:6px}.mode-copy strong{font-size:1.18rem}.mode-body{font-size:.8rem;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}}
</style>
