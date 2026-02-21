<script lang="ts">
  import { onMount } from "svelte";
  import IconCheckRegular from "phosphor-icons-svelte/IconCheckRegular.svelte";
  import IconXRegular from "phosphor-icons-svelte/IconXRegular.svelte";
  import IconSpinnerRegular from "phosphor-icons-svelte/IconSpinnerRegular.svelte";
  import type { AlternativeOption } from "$lib/types";

  let {
    text,
    itemType,
    why,
    onSelect,
    onClose
  } = $props<{
    text: string;
    itemType: string;
    why?: string | null;
    onSelect: (selectedText: string) => void;
    onClose: () => void;
  }>();

  let alternatives = $state<AlternativeOption[]>([]);
  let loading = $state(true);
  let error = $state("");

  onMount(() => {
    void loadAlternatives();
  });

  async function loadAlternatives(): Promise<void> {
    loading = true;
    error = "";
    try {
      const result = await window.dossier?.llm.alternatives(text, itemType, why ?? undefined);
      alternatives = result?.alternatives ?? [];
      if (alternatives.length === 0) {
        error = "No alternatives generated. Try again or edit manually.";
      }
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to generate alternatives";
    } finally {
      loading = false;
    }
  }
</script>

<div class="alternatives-panel">
  <div class="panel-header">
    <h3 class="panel-title">Alternative phrasings</h3>
    <button class="close-btn" onclick={onClose} aria-label="Close alternatives">
      <IconXRegular class="icon-16" />
    </button>
  </div>

  <p class="original-text">Original: "{text}"</p>

  {#if loading}
    <div class="loading">
      <IconSpinnerRegular class="icon-16 spin" />
      <span>Generating alternatives...</span>
    </div>
  {:else if error}
    <p class="error-text">{error}</p>
  {:else}
    <div class="alternatives-list">
      {#each alternatives as alt, i}
        <button class="alternative-card" onclick={() => onSelect(alt.text)}>
          <div class="alt-content">
            <p class="alt-text">{alt.text}</p>
            <p class="alt-reason">{alt.reason}</p>
          </div>
          <span class="select-action">
            <IconCheckRegular class="icon-14" />
            <span>Select</span>
          </span>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .alternatives-panel {
    background: var(--base-secondary);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    padding: var(--space-5);
    animation: entrance-fade-up var(--duration-moderate) var(--ease-out);
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-3);
  }

  .panel-title {
    font-family: var(--font-display);
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .close-btn {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-sm);
    color: var(--text-tertiary);
    transition: background-color var(--duration-standard) var(--ease-out),
                color var(--duration-standard) var(--ease-out);
  }

  .close-btn:hover {
    background: var(--base-tertiary);
    color: var(--text-primary);
  }

  .original-text {
    font-family: var(--font-body);
    font-size: 0.8125rem;
    color: var(--text-tertiary);
    margin-bottom: var(--space-4);
    font-style: italic;
  }

  .loading {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-4) 0;
    font-family: var(--font-body);
    font-size: 0.9375rem;
    color: var(--text-secondary);
  }

  .loading :global(.spin) {
    animation: spin 1s linear infinite;
  }

  .error-text {
    font-family: var(--font-body);
    font-size: 0.9375rem;
    color: var(--text-secondary);
    padding: var(--space-3) 0;
  }

  .alternatives-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .alternative-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    padding: var(--space-3) var(--space-4);
    background: var(--base);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    text-align: left;
    transition: border-color var(--duration-standard) var(--ease-out),
                background-color var(--duration-standard) var(--ease-out);
  }

  .alternative-card:hover {
    border-color: var(--secondary-accent);
    background: var(--base-tertiary);
  }

  .alt-content {
    flex: 1;
    min-width: 0;
  }

  .alt-text {
    font-family: var(--font-body);
    font-size: 0.9375rem;
    line-height: 1.5;
    color: var(--text-primary);
  }

  .alt-reason {
    font-family: var(--font-body);
    font-size: 0.8125rem;
    line-height: 1.4;
    color: var(--text-tertiary);
    margin-top: var(--space-1);
  }

  .select-action {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    font-family: var(--font-body);
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--success);
    flex-shrink: 0;
    opacity: 0;
    transition: opacity var(--duration-standard) var(--ease-out);
  }

  .alternative-card:hover .select-action {
    opacity: 1;
  }
</style>
