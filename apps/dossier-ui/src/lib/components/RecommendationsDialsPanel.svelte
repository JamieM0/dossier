<script lang="ts">
  import { onMount } from "svelte";
  import IconXBold from "phosphor-icons-svelte/IconXBold.svelte";
  import IconArrowCounterClockwiseRegular from "phosphor-icons-svelte/IconArrowCounterClockwiseRegular.svelte";
  import {
    DIAL_DEFS,
    DIAL_GROUP_LABELS,
    recommendationDials,
    type DialGroup
  } from "$lib/state/recommendation-dials.svelte";

  let { onClose }: { onClose: () => void } = $props();

  const groups: DialGroup[] = ["core", "discovery", "axis"];
  const defsByGroup = $derived(
    groups.map((g) => ({ group: g, defs: DIAL_DEFS.filter((d) => d.group === g) }))
  );

  onMount(() => {
    function handleKey(e: KeyboardEvent): void {
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  });
</script>

<div
  class="backdrop"
  role="presentation"
  onclick={onClose}
  onkeydown={(e) => { if (e.key === "Escape") onClose(); }}
>
  <div
    class="panel"
    role="dialog"
    aria-modal="true"
    aria-labelledby="dials-panel-title"
    tabindex="-1"
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.stopPropagation()}
  >
    <header class="head">
      <div>
        <h2 id="dials-panel-title">Recommendation Dials</h2>
        <p class="sub">Tune the inputs the ranking already uses — recommendations reorder instantly.</p>
      </div>
      <button class="close" aria-label="Close" onclick={onClose}>
        <IconXBold class="icon-16" />
      </button>
    </header>

    <div class="body">
      {#each defsByGroup as { group, defs } (group)}
        <section class="group">
          <h3>{DIAL_GROUP_LABELS[group]}</h3>
          <div class="rows" class:two-col={group === "axis"}>
            {#each defs as def (def.key)}
              <div class="row">
                <div class="row-head">
                  <span class="label">{def.label}</span>
                  <span class="value">{recommendationDials.values[def.key]}</span>
                </div>
                <input
                  class="slider"
                  type="range"
                  min="1"
                  max="100"
                  step="1"
                  value={recommendationDials.values[def.key]}
                  oninput={(e) => recommendationDials.set(def.key, Number(e.currentTarget.value))}
                  onchange={() => recommendationDials.persist()}
                  aria-label={def.label}
                />
                <p class="desc">{def.description}</p>
              </div>
            {/each}
          </div>
        </section>
      {/each}
    </div>

    <footer class="foot">
      <button
        class="btn ghost"
        disabled={recommendationDials.isDefault}
        onclick={() => { recommendationDials.reset(); void recommendationDials.persist(); }}
      >
        <IconArrowCounterClockwiseRegular class="icon-16" />
        Reset all
      </button>
      <div class="spacer"></div>
      <button class="btn primary" onclick={onClose}>Done</button>
    </footer>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    justify-content: flex-end;
    z-index: 100;
    animation: backdrop-in 180ms var(--ease-out);
  }
  @keyframes backdrop-in { from { opacity: 0; } to { opacity: 1; } }
  .panel {
    background: var(--base-secondary);
    border-left: 1px solid var(--border-subtle);
    box-shadow: var(--shadow-lg);
    width: 560px;
    max-width: 92vw;
    height: 100%;
    display: flex;
    flex-direction: column;
    animation: panel-in 220ms var(--ease-out);
  }
  @keyframes panel-in {
    from { opacity: 0; transform: translateX(24px); }
    to { opacity: 1; transform: translateX(0); }
  }
  .head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-4) var(--space-5);
    border-bottom: 1px solid var(--border-subtle);
  }
  .head h2 {
    font-family: var(--font-display);
    font-size: 1.05rem;
    color: var(--text-primary);
    margin: 0;
  }
  .head .sub {
    color: var(--text-secondary);
    font-size: 0.78rem;
    margin: 2px 0 0;
  }
  .close {
    flex: 0 0 auto;
    width: 30px;
    height: 30px;
    border-radius: var(--radius-sm);
    background: var(--base-tertiary);
    border: 1px solid var(--border-subtle);
    color: var(--text-secondary);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .close:hover { background: var(--base); color: var(--text-primary); }

  .body {
    padding: var(--space-4) var(--space-5);
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    flex: 1;
  }
  .group { display: flex; flex-direction: column; gap: var(--space-2); }
  .group h3 {
    font-family: var(--font-display);
    font-size: 0.75rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-tertiary);
    margin: 0;
    padding-bottom: var(--space-1);
    border-bottom: 1px solid var(--border-subtle);
  }
  .rows { display: flex; flex-direction: column; gap: var(--space-3); }
  .rows.two-col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    column-gap: var(--space-4);
    row-gap: var(--space-3);
  }
  .row { display: flex; flex-direction: column; gap: 3px; }
  .row-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-2);
  }
  .label { font-size: 0.82rem; color: var(--text-primary); }
  .value {
    font-variant-numeric: tabular-nums;
    font-size: 0.75rem;
    color: var(--text-secondary);
    min-width: 2ch;
    text-align: right;
  }
  .slider {
    width: 100%;
    accent-color: var(--accent);
    height: 4px;
    cursor: pointer;
  }
  .desc {
    font-size: 0.72rem;
    line-height: 1.35;
    color: var(--text-tertiary);
    margin: 0;
  }

  .foot {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-5);
    border-top: 1px solid var(--border-subtle);
  }
  .spacer { flex: 1; }
  .btn {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius-md);
    border: 1px solid var(--border-subtle);
    background: var(--base);
    color: var(--text-primary);
    font-size: 0.85rem;
    cursor: pointer;
    transition: background var(--duration-standard) var(--ease-out),
                transform var(--duration-quick) var(--ease-out);
  }
  .btn:hover { background: var(--base-tertiary); transform: translateY(-1px); }
  .btn:disabled { opacity: 0.5; cursor: default; transform: none; }
  .btn.ghost { background: transparent; color: var(--text-secondary); border-color: transparent; }
  .btn.ghost:hover:not(:disabled) { background: var(--base-tertiary); color: var(--text-primary); }
  .btn.primary {
    background: var(--accent);
    color: var(--accent-contrast, white);
    border-color: var(--accent);
  }
  .btn.primary:hover { filter: brightness(1.05); background: var(--accent); }
</style>
