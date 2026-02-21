<script lang="ts">
  import IconCheckRegular from "phosphor-icons-svelte/IconCheckRegular.svelte";
  import type { ConsentDecisionPayload, ConsentRequestView } from "$lib/types";

  let {
    serviceName,
    request,
    onAllow,
    onDecline
  } = $props<{
    serviceName: string;
    request: ConsentRequestView;
    onAllow: (payload: ConsentDecisionPayload) => void;
    onDecline: () => void;
  }>();

  let declineBtn = $state<HTMLButtonElement | null>(null);
  let modalRef = $state<HTMLElement | null>(null);
  let backdropRef = $state<HTMLElement | null>(null);
  let selectedAllowedIds = $state<string[]>([]);
  let blockedOverrides = $state<string[]>([]);
  let isExiting = $state(false);

  const blockedIds = $derived(new Set(request.preview_items.filter((item) => item.is_topic_blocked).map((item) => item.item_id)));

  $effect(() => {
    selectedAllowedIds = request.preview_items
      .filter((item) => item.default_allowed)
      .map((item) => item.item_id);
    blockedOverrides = [];
    declineBtn?.focus();
  });

  function isSelected(itemId: string): boolean {
    return selectedAllowedIds.includes(itemId);
  }

  function toggleSelected(itemId: string): void {
    selectedAllowedIds = selectedAllowedIds.includes(itemId)
      ? selectedAllowedIds.filter((candidate) => candidate !== itemId)
      : [...selectedAllowedIds, itemId];

    if (!selectedAllowedIds.includes(itemId)) {
      blockedOverrides = blockedOverrides.filter((candidate) => candidate !== itemId);
    }
  }

  function toggleOverride(itemId: string): void {
    blockedOverrides = blockedOverrides.includes(itemId)
      ? blockedOverrides.filter((candidate) => candidate !== itemId)
      : [...blockedOverrides, itemId];
  }

  function animateExit(callback: () => void): void {
    isExiting = true;
    setTimeout(callback, 200);
  }

  function submitAllow(): void {
    const allowed = selectedAllowedIds.filter((itemId) => {
      if (!blockedIds.has(itemId)) {
        return true;
      }
      return blockedOverrides.includes(itemId);
    });

    animateExit(() => {
      onAllow({
        decision: "ALLOW",
        allowed_item_ids: allowed,
        blocked_item_overrides: blockedOverrides.filter((itemId) => allowed.includes(itemId))
      });
    });
  }

  function handleDecline(): void {
    animateExit(onDecline);
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      event.preventDefault();
      handleDecline();
      return;
    }

    if (event.key === "Tab" && modalRef) {
      const focusable = modalRef.querySelectorAll<HTMLElement>("button, input[type='checkbox']");
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
      handleDecline();
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div
  class="consent-backdrop"
  class:exiting={isExiting}
  bind:this={backdropRef}
  onclick={handleBackdropClick}
>
  <div
    class="consent-modal"
    class:exiting={isExiting}
    bind:this={modalRef}
    role="dialog"
    aria-modal="true"
    aria-labelledby="consent-title"
    aria-describedby="consent-desc"
  >
    <h2 id="consent-title" class="modal-title">{serviceName}</h2>
    <p id="consent-desc" class="modal-desc">
      {serviceName} requests access for: {request.purpose}
    </p>

    <ul class="requested-items">
      {#each request.preview_items as item}
        <li class="requested-item" class:blocked={item.is_topic_blocked}>
          <label class="item-main">
            <input
              type="checkbox"
              checked={isSelected(item.item_id)}
              onchange={() => {
                toggleSelected(item.item_id);
              }}
            />
            <span>{item.text}</span>
            {#if item.is_topic_blocked}
              <span class="pill">Blocked</span>
            {/if}
          </label>

          {#if item.is_topic_blocked && isSelected(item.item_id)}
            <label class="override-row">
              <input
                type="checkbox"
                checked={blockedOverrides.includes(item.item_id)}
                onchange={() => {
                  toggleOverride(item.item_id);
                }}
              />
              <span>Share anyway this time (one-time override)</span>
            </label>
          {/if}
        </li>
      {/each}
    </ul>

    <div class="modal-actions">
      <button
        class="btn-secondary"
        bind:this={declineBtn}
        onclick={handleDecline}
      >
        Decline
      </button>
      <button class="btn-primary" onclick={submitAllow}>
        <IconCheckRegular class="icon-16" />
        <span>Allow selected</span>
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
    transition: opacity 200ms var(--ease-out);
  }

  .consent-backdrop.exiting {
    opacity: 0;
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
    transition: opacity 200ms var(--ease-out), transform 200ms var(--ease-out);
  }

  .consent-modal.exiting {
    opacity: 0;
    transform: scale(0.95);
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
    margin-bottom: var(--space-3);
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
    max-height: 45vh;
    overflow-y: auto;
  }

  .requested-item {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    border: 1px solid var(--border-subtle);
    background: var(--base-secondary);
    border-radius: var(--radius-sm);
    padding: var(--space-3);
  }

  .requested-item.blocked {
    border-color: var(--error);
  }

  .item-main {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-family: var(--font-body);
    font-size: 0.9rem;
    line-height: 1.5;
    color: var(--text-primary);
    cursor: pointer;
  }

  .pill {
    font-size: 0.7rem;
    border: 1px solid var(--error);
    color: var(--error);
    border-radius: var(--radius-full);
    padding: 0 var(--space-2);
  }

  .override-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    color: var(--text-secondary);
    font-size: 0.8rem;
    cursor: pointer;
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-3);
  }

  .btn-primary {
    min-height: 44px;
    min-width: 80px;
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius-sm);
    background: var(--primary-accent);
    color: var(--primary-accent-text);
    font-family: var(--font-body);
    font-size: 0.9375rem;
    font-weight: 600;
    box-shadow: var(--shadow-sm);
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    transition: background-color var(--duration-standard) var(--ease-out),
                box-shadow var(--duration-standard) var(--ease-out);
  }

  .btn-primary:hover {
    background: var(--primary-accent-hover);
    box-shadow: var(--shadow-md);
  }

  .btn-secondary {
    min-height: 44px;
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
