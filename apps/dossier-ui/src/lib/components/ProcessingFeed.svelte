<script lang="ts">
  import IconCheckCircleRegular from "phosphor-icons-svelte/IconCheckCircleRegular.svelte";
  import IconCircleNotchRegular from "phosphor-icons-svelte/IconCircleNotchRegular.svelte";

  let {
    discoveries,
    isComplete = false
  } = $props<{
    discoveries: { id: string; text: string; complete: boolean }[];
    isComplete?: boolean;
  }>();

  let allComplete = $derived(discoveries.every((d) => d.complete));
</script>

<section class="processing-feed" aria-live="polite">
  <h3 class="feed-heading">Processing your import</h3>

  {#if !allComplete}
    <div class="progress-track">
      <div class="progress-fill" class:complete={isComplete}></div>
    </div>
  {/if}

  <div class="feed-items">
    {#each discoveries as discovery, index (discovery.id)}
      <div
        class="feed-item"
        style="animation-delay: {index * 80}ms"
        aria-label={discovery.complete ? `Completed: ${discovery.text}` : discovery.text}
      >
        {#if discovery.complete}
          <span class="feed-icon success">
            <IconCheckCircleRegular class="icon-16" />
          </span>
        {:else}
          <span class="feed-icon processing">
            <IconCircleNotchRegular class="icon-16" />
          </span>
        {/if}
        <span class="feed-text">{discovery.text}</span>
      </div>
    {/each}
  </div>
</section>

<style>
  .processing-feed {
    background: var(--base-secondary);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-sm);
    padding: var(--space-6);
    margin-bottom: var(--space-6);
  }

  .feed-heading {
    font-family: var(--font-display);
    font-size: 1.25rem;
    font-weight: 600;
    line-height: 1.3;
    color: var(--text-primary);
    margin-bottom: var(--space-4);
  }

  .progress-track {
    width: 100%;
    height: 3px;
    background: var(--base-tertiary);
    border-radius: var(--radius-full);
    overflow: hidden;
    margin-bottom: var(--space-4);
  }

  .progress-fill {
    width: 40%;
    height: 100%;
    background: var(--primary-accent);
    border-radius: var(--radius-full);
    animation: progress-indeterminate 2s ease-in-out infinite;
  }

  .progress-fill.complete {
    width: 100%;
    animation: none;
    transition: width var(--duration-slow) var(--ease-out);
  }

  .feed-items {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .feed-item {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    animation: entrance-fade-up var(--duration-moderate) var(--ease-out) both;
  }

  .feed-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .feed-icon.success {
    color: var(--success);
  }

  .feed-icon.processing {
    color: var(--text-tertiary);
  }

  .feed-icon.processing :global(svg) {
    animation: spin 1s linear infinite;
  }

  .feed-text {
    font-family: var(--font-body);
    font-size: 0.9375rem;
    line-height: 1.5;
    color: var(--text-primary);
  }
</style>
