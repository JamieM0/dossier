<script lang="ts">
  import { onMount } from "svelte";
  import IconXBold from "phosphor-icons-svelte/IconXBold.svelte";
  import IconArrowCounterClockwiseRegular from "phosphor-icons-svelte/IconArrowCounterClockwiseRegular.svelte";
  import IconMagnifyingGlassRegular from "phosphor-icons-svelte/IconMagnifyingGlassRegular.svelte";
  import { rateDials } from "$lib/state/rate-dials.svelte";

  let { onClose }: { onClose: () => void } = $props();

  // Search filters the tag list. Empty query shows every tag (the set
  // is open-ended but bounded by what the user has actually rated, so
  // there's no artificial cap to render). Substring, case-insensitive.
  let query = $state("");

  // Filter once per keystroke; cheap because the tag set is at most a
  // few hundred entries for a heavy rater.
  const visibleTags = $derived.by(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rateDials.tags;
    return rateDials.tags.filter((t) => t.toLowerCase().includes(q));
  });

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
    aria-labelledby="rate-dials-panel-title"
    tabindex="-1"
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.stopPropagation()}
  >
    <header class="head">
      <div>
        <h2 id="rate-dials-panel-title">Rate Dials</h2>
        <p class="sub">Turn a genre or tag up to see more of it while rating, or down to see less. Left neutral, it's unaffected.</p>
      </div>
      <button class="close" aria-label="Close" onclick={onClose}>
        <IconXBold class="icon-16" />
      </button>
    </header>

    <div class="body">
      <section class="group">
        <h3 class="group-title">Genres</h3>
        <div class="rows two-col">
          {#each rateDials.genres as genre (genre)}
            <div class="row">
              <div class="row-head">
                <span class="label">{genre}</span>
                <span class="value">{rateDials.valueFor(genre)}</span>
              </div>
              <input
                class="slider"
                type="range"
                min="1"
                max="100"
                step="1"
                value={rateDials.valueFor(genre)}
                oninput={(e) => rateDials.set(genre, Number(e.currentTarget.value))}
                onchange={() => rateDials.persist()}
                aria-label={`${genre} genre dial`}
              />
            </div>
          {/each}
        </div>
      </section>

      {#if rateDials.tags.length > 0}
        <section class="group">
          <div class="group-head">
            <h3 class="group-title">Tags</h3>
            <span class="group-meta">{rateDials.tags.length} from your library</span>
          </div>

          <label class="search">
            <IconMagnifyingGlassRegular class="icon-16 search-icon" />
            <input
              type="text"
              class="search-input"
              placeholder="Search tags"
              value={query}
              oninput={(e) => (query = e.currentTarget.value)}
            />
          </label>

          {#if visibleTags.length === 0}
            <p class="empty">No tags match "{query}".</p>
          {:else}
            <div class="rows two-col">
              {#each visibleTags as tag (tag)}
                <div class="row">
                  <div class="row-head">
                    <span class="label">{tag}</span>
                    <span class="value">{rateDials.tagValueFor(tag)}</span>
                  </div>
                  <input
                    class="slider"
                    type="range"
                    min="1"
                    max="100"
                    step="1"
                    value={rateDials.tagValueFor(tag)}
                    oninput={(e) => rateDials.setTag(tag, Number(e.currentTarget.value))}
                    onchange={() => rateDials.persist()}
                    aria-label={`${tag} tag dial`}
                  />
                </div>
              {/each}
            </div>
          {/if}
        </section>
      {/if}
    </div>

    <footer class="foot">
      <button
        class="btn ghost"
        disabled={rateDials.isDefault}
        onclick={() => { rateDials.reset(); void rateDials.persist(); }}
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
    width: 480px;
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
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }
  .group {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .group-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-2);
  }
  .group-title {
    font-family: var(--font-display);
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-secondary);
    margin: 0;
  }
  .group-meta {
    font-size: 0.7rem;
    color: var(--text-tertiary, var(--text-secondary));
  }
  .search {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: 0 var(--space-2);
    background: var(--base-tertiary);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    color: var(--text-secondary); /* icon inherits via currentColor */
  }
  .search:focus-within {
    border-color: var(--accent);
  }
  .search-input {
    flex: 1;
    background: transparent;
    border: 0;
    outline: 0;
    color: var(--text-primary);
    font-size: 0.85rem;
    padding: var(--space-2) 0;
    font-family: inherit;
  }
  .search-input::placeholder { color: var(--text-secondary); }
  .empty {
    color: var(--text-secondary);
    font-size: 0.82rem;
    padding: var(--space-3) 0;
    text-align: center;
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
  .label {
    font-size: 0.82rem;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: calc(100% - 3ch);
  }
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
