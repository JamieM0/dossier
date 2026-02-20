<script lang="ts">
  import IconCheckRegular from "phosphor-icons-svelte/IconCheckRegular.svelte";

  let {
    serviceName,
    requestedItems,
    onAllow,
    onDecline
  } = $props<{
    serviceName: string;
    requestedItems: string[];
    onAllow: () => void;
    onDecline: () => void;
  }>();

  let declineBtn = $state<HTMLButtonElement | null>(null);
  let modalRef = $state<HTMLElement | null>(null);

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      event.preventDefault();
      onDecline();
      return;
    }

    // Focus trap: Tab cycles between Decline and Allow
    if (event.key === "Tab" && modalRef) {
      const focusable = modalRef.querySelectorAll<HTMLElement>("button");
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  function handleBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      onDecline();
    }
  }

  // Focus the decline button by default (spec: inaction = decline)
  $effect(() => {
    declineBtn?.focus();
  });
</script>

<svelte:window on:keydown={handleKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="consent-backdrop" onclick={handleBackdropClick}>
  <div
    class="consent-modal"
    bind:this={modalRef}
    role="dialog"
    aria-modal="true"
    aria-labelledby="consent-title"
    aria-describedby="consent-desc"
  >
    <h2 id="consent-title" class="modal-title">{serviceName}</h2>
    <p id="consent-desc" class="modal-desc">
      {serviceName} is requesting access to the following data:
    </p>

    <ul class="requested-items">
      {#each requestedItems as item}
        <li class="requested-item">
          <IconCheckRegular class="icon-16" />
          <span>{item}</span>
        </li>
      {/each}
    </ul>

    <div class="modal-actions">
      <button class="btn-secondary" bind:this={declineBtn} onclick={onDecline}>
        Decline
      </button>
      <button class="btn-primary" onclick={onAllow}>
        Allow
      </button>
    </div>
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

  .consent-modal {
    max-width: 480px;
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
    margin-bottom: var(--space-4);
  }

  .modal-desc {
    font-family: var(--font-body);
    font-size: 0.9375rem;
    line-height: 1.5;
    color: var(--text-secondary);
  }

  .requested-items {
    margin: var(--space-4) 0 var(--space-8);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .requested-item {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-family: var(--font-body);
    font-size: 0.9375rem;
    line-height: 1.5;
    color: var(--text-primary);
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-3);
  }

  .btn-primary {
    min-height: 40px;
    min-width: 80px;
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius-sm);
    background: var(--primary-accent);
    color: var(--primary-accent-text);
    font-family: var(--font-body);
    font-size: 0.9375rem;
    font-weight: 600;
    box-shadow: var(--shadow-sm);
    transition: background-color var(--duration-standard) var(--ease-out),
                box-shadow var(--duration-standard) var(--ease-out);
  }

  .btn-primary:hover {
    background: var(--primary-accent-hover);
    box-shadow: var(--shadow-md);
  }

  .btn-primary:active {
    box-shadow: var(--shadow-sm);
    transform: translateY(1px);
  }

  .btn-secondary {
    min-height: 40px;
    min-width: 80px;
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text-primary);
    font-family: var(--font-body);
    font-size: 0.9375rem;
    font-weight: 500;
    border: 1px solid var(--border);
    transition: background-color var(--duration-standard) var(--ease-out);
  }

  .btn-secondary:hover {
    background: var(--base-tertiary);
  }
</style>
