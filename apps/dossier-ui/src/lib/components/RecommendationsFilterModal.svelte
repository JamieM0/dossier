<script lang="ts">
  import { onMount } from "svelte";
  import IconXBold from "phosphor-icons-svelte/IconXBold.svelte";

  export type RecommendationFilters = {
    /** Inclusive decade range, e.g. [1980, 2020] means films from 1980–2029. */
    decadeRange: [number, number] | null;
  };

  let {
    filters,
    decadeOptions,
    onApply,
    onClose
  }: {
    filters: RecommendationFilters;
    /** Sorted ascending list of decades present in the catalogue (e.g. [1920, 1930, …, 2020]). */
    decadeOptions: number[];
    onApply: (next: RecommendationFilters) => void;
    onClose: () => void;
  } = $props();

  const defaultMin = decadeOptions[0] ?? 1900;
  const defaultMax = decadeOptions[decadeOptions.length - 1] ?? 2020;

  let minDecade = $state<number>(filters.decadeRange?.[0] ?? defaultMin);
  let maxDecade = $state<number>(filters.decadeRange?.[1] ?? defaultMax);

  // Keep min <= max as the user fiddles with the selects.
  $effect(() => {
    if (minDecade > maxDecade) maxDecade = minDecade;
  });

  function apply(): void {
    const isDefault = minDecade === defaultMin && maxDecade === defaultMax;
    onApply({ decadeRange: isDefault ? null : [minDecade, maxDecade] });
    onClose();
  }

  function reset(): void {
    minDecade = defaultMin;
    maxDecade = defaultMax;
  }

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
    class="modal"
    role="dialog"
    aria-modal="true"
    aria-labelledby="filter-modal-title"
    tabindex="-1"
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.stopPropagation()}
  >
    <header class="head">
      <h2 id="filter-modal-title">Filters</h2>
      <button class="close" aria-label="Close" onclick={onClose}>
        <IconXBold class="icon-16" />
      </button>
    </header>

    <div class="body">
      <section class="group">
        <h3>Release decade</h3>
        <p class="sub">Limit recommendations to films released within a decade range.</p>
        <div class="range">
          <label>
            <span>From</span>
            <select bind:value={minDecade}>
              {#each decadeOptions as d}
                <option value={d}>{d}s</option>
              {/each}
            </select>
          </label>
          <span class="dash">–</span>
          <label>
            <span>To</span>
            <select bind:value={maxDecade}>
              {#each decadeOptions as d}
                <option value={d} disabled={d < minDecade}>{d}s</option>
              {/each}
            </select>
          </label>
        </div>
      </section>
    </div>

    <footer class="foot">
      <button class="btn ghost" onclick={reset}>Reset</button>
      <div class="spacer"></div>
      <button class="btn" onclick={onClose}>Cancel</button>
      <button class="btn primary" onclick={apply}>Apply</button>
    </footer>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-5);
    z-index: 100;
    animation: backdrop-in 180ms var(--ease-out);
  }
  @keyframes backdrop-in { from { opacity: 0; } to { opacity: 1; } }
  .modal {
    background: var(--base-secondary);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    max-width: 520px;
    width: 100%;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    animation: modal-in 200ms var(--ease-out);
  }
  @keyframes modal-in {
    from { opacity: 0; transform: translateY(8px) scale(0.98); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-4) var(--space-5);
    border-bottom: 1px solid var(--border-subtle);
  }
  .head h2 {
    font-family: var(--font-display);
    font-size: 1.1rem;
    color: var(--text-primary);
    margin: 0;
  }
  .close {
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
    padding: var(--space-5);
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }
  .group { display: flex; flex-direction: column; gap: var(--space-2); }
  .group h3 {
    font-family: var(--font-display);
    font-size: 0.95rem;
    color: var(--text-primary);
    margin: 0;
  }
  .sub {
    color: var(--text-secondary);
    font-size: 0.85rem;
    margin: 0;
  }
  .range {
    display: flex;
    align-items: flex-end;
    gap: var(--space-3);
    margin-top: var(--space-2);
  }
  .range label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 0.8rem;
    color: var(--text-tertiary);
  }
  .range select {
    padding: 6px 10px;
    border-radius: var(--radius-md);
    border: 1px solid var(--border-subtle);
    background: var(--base);
    color: var(--text-primary);
    font-size: 0.9rem;
    min-width: 110px;
  }
  .dash { color: var(--text-tertiary); padding-bottom: 8px; }
  .foot {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-4) var(--space-5);
    border-top: 1px solid var(--border-subtle);
  }
  .spacer { flex: 1; }
  .btn {
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius-md);
    border: 1px solid var(--border-subtle);
    background: var(--base);
    color: var(--text-primary);
    font-size: 0.88rem;
    cursor: pointer;
    transition: background var(--duration-standard) var(--ease-out),
                transform var(--duration-quick) var(--ease-out);
  }
  .btn:hover { background: var(--base-tertiary); transform: translateY(-1px); }
  .btn.ghost { background: transparent; color: var(--text-secondary); border-color: transparent; }
  .btn.ghost:hover { background: var(--base-tertiary); color: var(--text-primary); }
  .btn.primary {
    background: var(--accent);
    color: var(--accent-contrast, white);
    border-color: var(--accent);
  }
  .btn.primary:hover { filter: brightness(1.05); background: var(--accent); }
</style>
