<script lang="ts">
  import IconXRegular from "phosphor-icons-svelte/IconXRegular.svelte";

  let {
    count = 0,
    onReviewAll,
    onDismiss
  } = $props<{
    count: number;
    onReviewAll?: () => void;
    onDismiss?: () => void;
  }>();

  let dismissed = $state(false);
  let visible = $derived(count > 0 && !dismissed);

  function handleDismiss(): void {
    dismissed = true;
    onDismiss?.();
  }

  $effect(() => {
    if (count > 0) {
      dismissed = false;
    }
  });
</script>

{#if visible}
  <section class="notification-banner" aria-live="polite">
    <p class="banner-text">
      {count} {count === 1 ? "inference is" : "inferences are"} waiting for review.
    </p>
    <div class="banner-actions">
      {#if onReviewAll}
        <button class="review-btn" onclick={onReviewAll}>Review all</button>
      {/if}
      <button
        class="close-btn"
        onclick={handleDismiss}
        aria-label="Dismiss notification"
      >
        <IconXRegular class="icon-16" />
      </button>
    </div>
  </section>
{/if}

<style>
  .notification-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    padding: var(--space-3) var(--space-4);
    background: var(--primary-accent);
    color: var(--primary-accent-text);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-sm);
    margin-bottom: var(--space-6);
    animation: entrance-fade-up var(--duration-moderate) var(--ease-out);
  }

  .banner-text {
    font-family: var(--font-body);
    font-size: 0.9375rem;
    font-weight: 500;
    line-height: 1.5;
  }

  .banner-actions {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-shrink: 0;
  }

  .review-btn {
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-sm);
    font-family: var(--font-body);
    font-size: 0.8125rem;
    font-weight: 500;
    color: inherit;
    background: transparent;
    transition: background-color var(--duration-standard) var(--ease-out);
  }

  .review-btn:hover {
    background: color-mix(in srgb, var(--primary-accent-text) 15%, transparent);
  }

  .close-btn {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-sm);
    color: inherit;
    background: transparent;
    opacity: 0.8;
    transition: opacity var(--duration-standard) var(--ease-out),
                background-color var(--duration-standard) var(--ease-out);
  }

  .close-btn:hover {
    opacity: 1;
    background: color-mix(in srgb, var(--primary-accent-text) 15%, transparent);
  }
</style>
