<script lang="ts">
  let {
    requests,
    onAllow,
    onDecline,
    onDeclineAll
  } = $props<{
    requests: { id: string; serviceName: string; summary: string }[];
    onAllow: (id: string) => void;
    onDecline: (id: string) => void;
    onDeclineAll: () => void;
  }>();

  let declineAllBtn = $state<HTMLButtonElement | null>(null);

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      event.preventDefault();
      onDeclineAll();
    }
  }

  function handleBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      onDeclineAll();
    }
  }

  $effect(() => {
    declineAllBtn?.focus();
  });
</script>

<svelte:window on:keydown={handleKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="consent-backdrop" onclick={handleBackdropClick}>
  <div
    class="batched-modal"
    role="dialog"
    aria-modal="true"
    aria-labelledby="batched-consent-title"
  >
    <h2 id="batched-consent-title" class="modal-title">
      Pending access requests
      <span class="count-badge">{requests.length}</span>
    </h2>

    <div class="requests-list">
      {#each requests as request (request.id)}
        <article class="request-card">
          <div class="request-info">
            <h3 class="request-service">{request.serviceName}</h3>
            <p class="request-summary">{request.summary}</p>
          </div>
          <div class="request-actions">
            <button class="btn-secondary-sm" onclick={() => onDecline(request.id)}>
              Decline
            </button>
            <button class="btn-primary-sm" onclick={() => onAllow(request.id)}>
              Allow
            </button>
          </div>
        </article>
      {/each}
    </div>

    <button class="btn-danger" bind:this={declineAllBtn} onclick={onDeclineAll}>
      Decline all
    </button>
  </div>
</div>

<style>
  .consent-backdrop {
    position: fixed;
    inset: 0;
    display: grid;
    place-items: center;
    background: color-mix(in srgb, var(--text-primary) 30%, transparent);
    backdrop-filter: var(--blur-backdrop);
    -webkit-backdrop-filter: var(--blur-backdrop);
    z-index: 100;
    animation: backdrop-enter var(--duration-spring) var(--ease-out);
  }

  @keyframes backdrop-enter {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .batched-modal {
    max-width: 640px;
    width: calc(100% - var(--space-8));
    background: var(--base);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: var(--space-8);
    box-shadow: var(--shadow-xl);
    animation: modal-enter var(--duration-spring) var(--ease-spring);
  }

  @keyframes modal-enter {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  .modal-title {
    font-family: var(--font-display);
    font-size: 1.25rem;
    font-weight: 600;
    line-height: 1.3;
    color: var(--text-primary);
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-bottom: var(--space-4);
  }

  .count-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 24px;
    height: 24px;
    padding: 0 var(--space-2);
    border-radius: var(--radius-full);
    background: var(--secondary-accent);
    color: var(--secondary-accent-text);
    font-family: var(--font-body);
    font-size: 0.75rem;
    font-weight: 600;
  }

  .requests-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    max-height: 60vh;
    overflow-y: auto;
    margin-bottom: var(--space-6);
  }

  .request-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    padding: var(--space-6);
    background: var(--base-secondary);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-sm);
    transition: box-shadow var(--duration-standard) var(--ease-out),
                border-color var(--duration-standard) var(--ease-out);
  }

  .request-card:hover {
    box-shadow: var(--shadow-md);
    border-color: var(--border);
  }

  .request-info {
    flex: 1;
    min-width: 0;
  }

  .request-service {
    font-family: var(--font-body);
    font-size: 1.0625rem;
    font-weight: 500;
    line-height: 1.6;
    color: var(--text-primary);
  }

  .request-summary {
    font-family: var(--font-body);
    font-size: 0.8125rem;
    line-height: 1.4;
    color: var(--text-secondary);
    margin-top: var(--space-1);
  }

  .request-actions {
    display: flex;
    gap: var(--space-2);
    flex-shrink: 0;
  }

  .btn-primary-sm,
  .btn-secondary-sm {
    min-height: 36px;
    padding: var(--space-1) var(--space-3);
    border-radius: var(--radius-sm);
    font-family: var(--font-body);
    font-size: 0.8125rem;
    font-weight: 600;
    transition: background-color var(--duration-standard) var(--ease-out);
  }

  .btn-primary-sm {
    background: var(--primary-accent);
    color: var(--primary-accent-text);
  }

  .btn-primary-sm:hover {
    background: var(--primary-accent-hover);
  }

  .btn-secondary-sm {
    background: transparent;
    color: var(--text-primary);
    border: 1px solid var(--border);
  }

  .btn-secondary-sm:hover {
    background: var(--base-tertiary);
  }

  .btn-danger {
    width: 100%;
    min-height: 40px;
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius-sm);
    background: var(--error);
    color: #ffffff;
    font-family: var(--font-body);
    font-size: 0.9375rem;
    font-weight: 600;
    box-shadow: var(--shadow-sm);
    transition: background-color var(--duration-standard) var(--ease-out);
  }

  .btn-danger:hover {
    background: color-mix(in srgb, var(--error) 85%, #000);
  }
</style>
