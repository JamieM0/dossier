<script lang="ts">
  let {
    title,
    message,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    danger = false,
    onConfirm,
    onCancel
  } = $props<{
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    danger?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
  }>();

  let cancelBtn = $state<HTMLButtonElement | null>(null);
  let modalRef = $state<HTMLElement | null>(null);

  $effect(() => {
    cancelBtn?.focus();
  });

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
      return;
    }

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
      onCancel();
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<div
  class="dialog-backdrop"
  onclick={handleBackdropClick}
  onkeydown={handleKeydown}
  role="presentation"
>
  <div
    class="dialog-modal"
    bind:this={modalRef}
    role="alertdialog"
    aria-modal="true"
    aria-labelledby="confirm-dialog-title"
    aria-describedby="confirm-dialog-desc"
  >
    <h2 id="confirm-dialog-title" class="dialog-title">{title}</h2>
    <p id="confirm-dialog-desc" class="dialog-message">{message}</p>

    <div class="dialog-actions">
      <button
        class="btn-secondary"
        bind:this={cancelBtn}
        onclick={onCancel}
      >
        {cancelLabel}
      </button>
      <button
        class={danger ? "btn-danger" : "btn-primary"}
        onclick={onConfirm}
      >
        {confirmLabel}
      </button>
    </div>
  </div>
</div>

<style>
  .dialog-backdrop {
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

  .dialog-modal {
    max-width: 420px;
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

  .dialog-title {
    font-family: var(--font-display);
    font-size: 1.25rem;
    font-weight: 600;
    line-height: 1.3;
    color: var(--text-primary);
    margin-bottom: var(--space-3);
  }

  .dialog-message {
    font-family: var(--font-body);
    font-size: 0.9375rem;
    line-height: 1.5;
    color: var(--text-secondary);
    margin-bottom: var(--space-8);
  }

  .dialog-actions {
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
    transition: background-color var(--duration-standard) var(--ease-out),
                box-shadow var(--duration-standard) var(--ease-out);
  }

  .btn-primary:hover {
    background: var(--primary-accent-hover);
    box-shadow: var(--shadow-md);
  }

  .btn-danger {
    min-height: 44px;
    min-width: 80px;
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius-sm);
    background: var(--error);
    color: #ffffff;
    font-family: var(--font-body);
    font-size: 0.9375rem;
    font-weight: 600;
    box-shadow: var(--shadow-sm);
    transition: background-color var(--duration-standard) var(--ease-out),
                box-shadow var(--duration-standard) var(--ease-out);
  }

  .btn-danger:hover {
    background: color-mix(in srgb, var(--error) 85%, #000);
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
