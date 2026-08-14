<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import IconCompassRegular from "phosphor-icons-svelte/IconCompassRegular.svelte";
  import IconFingerprintRegular from "phosphor-icons-svelte/IconFingerprintRegular.svelte";
  import IconGraduationCapRegular from "phosphor-icons-svelte/IconGraduationCapRegular.svelte";
  import IconBooksRegular from "phosphor-icons-svelte/IconBooksRegular.svelte";
  import IconHeartRegular from "phosphor-icons-svelte/IconHeartRegular.svelte";
  import IconScalesRegular from "phosphor-icons-svelte/IconScalesRegular.svelte";
  import IconWaveformRegular from "phosphor-icons-svelte/IconWaveformRegular.svelte";
  import IconGearSixRegular from "phosphor-icons-svelte/IconGearSixRegular.svelte";
  import IconMagnifyingGlassRegular from "phosphor-icons-svelte/IconMagnifyingGlassRegular.svelte";
  import IconArrowRightRegular from "phosphor-icons-svelte/IconArrowRightRegular.svelte";
  import { motionReveal } from "$lib/design/motion";

  let { onClose }: { onClose: () => void } = $props();
  let input: HTMLInputElement;
  let query = $state("");
  let selected = $state(0);

  const actions = [
    { label: "Discover", detail: "Find something chosen for you", href: "/", icon: IconCompassRegular, group: "Go to" },
    { label: "Teach Dossier", detail: "Choose how you want to teach", href: "/teach", icon: IconGraduationCapRegular, group: "Go to" },
    { label: "Your Dossier", detail: "Inspect what Dossier currently believes", href: "/dossier", icon: IconFingerprintRegular, group: "Go to" },
    { label: "Library", detail: "Everything you have told Dossier", href: "/library", icon: IconBooksRegular, group: "Go to" },
    { label: "Rate some titles", detail: "A seven-point rating session", href: "/rate", icon: IconHeartRegular, group: "Teach" },
    { label: "Rank similar favourites", detail: "Put closely rated titles in order", href: "/refine", icon: IconScalesRegular, group: "Teach" },
    { label: "Challenge Dossier", detail: "Test a prediction Dossier may have wrong", href: "/rate?mode=challenge", icon: IconWaveformRegular, group: "Teach" },
    { label: "Settings", detail: "Appearance, mobile access and local data", href: "/settings", icon: IconGearSixRegular, group: "Application" }
  ];

  const filtered = $derived(actions.filter((action) => `${action.label} ${action.detail} ${action.group}`.toLowerCase().includes(query.toLowerCase().trim())));

  $effect(() => {
    query;
    selected = 0;
  });

  async function choose(index = selected) {
    const action = filtered[index];
    if (!action) return;
    onClose();
    await goto(action.href);
  }

  function handleKey(event: KeyboardEvent) {
    if (event.key === "Escape") { event.preventDefault(); onClose(); }
    else if (event.key === "ArrowDown") { event.preventDefault(); selected = Math.min(filtered.length - 1, selected + 1); }
    else if (event.key === "ArrowUp") { event.preventDefault(); selected = Math.max(0, selected - 1); }
    else if (event.key === "Enter") { event.preventDefault(); void choose(); }
  }

  onMount(() => input?.focus());
</script>

<svelte:window on:keydown={handleKey} />

<div class="palette-backdrop" role="presentation" onclick={(event) => event.currentTarget === event.target && onClose()}>
  <div class="palette glass-panel" role="dialog" aria-modal="true" aria-label="Search Dossier" use:motionReveal>
    <div class="search-row">
      <IconMagnifyingGlassRegular class="icon-20" />
      <input bind:this={input} bind:value={query} placeholder="Search actions and places…" aria-label="Search actions and places" />
      <kbd>Esc</kbd>
    </div>
    <div class="results" role="listbox" aria-label="Dossier actions">
      {#if filtered.length === 0}
        <div class="empty">No matching action. Library title search remains available inside Library.</div>
      {:else}
        {#each filtered as action, index (action.href)}
          {@const Icon = action.icon}
          <button class:selected={selected === index} role="option" aria-selected={selected === index} onmouseenter={() => (selected = index)} onclick={() => void choose(index)}>
            <span class="result-icon"><Icon class="icon-20" /></span>
            <span class="result-copy"><strong>{action.label}</strong><small>{action.detail}</small></span>
            <span class="group">{action.group}</span>
            <IconArrowRightRegular class="icon-16 arrow" />
          </button>
        {/each}
      {/if}
    </div>
    <footer><span><kbd>↑</kbd><kbd>↓</kbd> choose</span><span><kbd>↵</kbd> open</span><span>Your data stays on this device.</span></footer>
  </div>
</div>

<style>
  .palette-backdrop { position:fixed; inset:0; z-index:190; display:flex; justify-content:center; align-items:flex-start; padding:clamp(56px,10vh,110px) 18px 18px; background:color-mix(in srgb,var(--text-primary) 22%,transparent); backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px); }
  .palette { width:min(620px,100%); max-height:min(670px,76vh); border-radius:22px; overflow:hidden; background:color-mix(in srgb,var(--base-secondary) 84%,transparent); box-shadow:inset 0 1px 0 color-mix(in srgb,white 50%,transparent),0 32px 90px color-mix(in srgb,var(--text-primary) 24%,transparent); }
  .search-row { display:grid; grid-template-columns:auto 1fr auto; align-items:center; gap:12px; padding:16px 17px; border-bottom:1px solid var(--border-subtle); color:var(--text-tertiary); }
  input { width:100%; border:0; outline:0; background:transparent; color:var(--text-primary); font-size:1rem; }
  input::placeholder { color:var(--text-tertiary); }
  .results { padding:8px; overflow-y:auto; max-height:520px; }
  .results button { width:100%; display:grid; grid-template-columns:auto 1fr auto auto; align-items:center; gap:11px; min-height:58px; padding:8px 10px; border-radius:15px; text-align:left; color:var(--text-secondary); }
  .results button.selected { background:linear-gradient(115deg,color-mix(in srgb,var(--primary-accent) 12%,var(--base)),color-mix(in srgb,var(--base) 64%,transparent)); color:var(--text-primary); box-shadow:inset 0 1px 0 color-mix(in srgb,white 30%,transparent); }
  .result-icon { width:38px; height:38px; display:grid; place-items:center; border-radius:12px; background:color-mix(in srgb,var(--base-tertiary) 72%,transparent); border:1px solid var(--border-subtle); }
  .result-copy { display:flex; flex-direction:column; min-width:0; }
  .result-copy strong { font-size:.86rem; }
  .result-copy small { color:var(--text-tertiary); font-size:.72rem; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
  .group { color:var(--text-tertiary); font-size:.63rem; text-transform:uppercase; letter-spacing:.08em; }
  :global(.arrow) { opacity:0; transform:translateX(-4px); transition:opacity 140ms var(--ease-out),transform 140ms var(--ease-out); }
  button.selected :global(.arrow) { opacity:1; transform:none; }
  .empty { padding:34px 18px; text-align:center; color:var(--text-tertiary); font-size:.82rem; }
  footer { display:flex; align-items:center; gap:16px; padding:10px 16px; border-top:1px solid var(--border-subtle); color:var(--text-tertiary); font-size:.65rem; }
  footer span { display:flex; align-items:center; gap:4px; }
  footer span:last-child { margin-left:auto; }
  footer kbd { padding:1px 4px; font-size:.58rem; }
  @media(max-width:600px){ .palette-backdrop{padding:14px;align-items:flex-start}.palette{margin-top:max(10px,env(safe-area-inset-top));max-height:82dvh}.group{display:none}.results button{grid-template-columns:auto 1fr auto}footer span:last-child{display:none} }
</style>
