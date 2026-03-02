<script lang="ts">
  let {
    currentVersion,
    nextVersion,
    onUpdateNow,
    onNotNow,
    onSkipVersion
  } = $props<{
    currentVersion: string;
    nextVersion: string;
    onUpdateNow: () => void;
    onNotNow: () => void;
    onSkipVersion: (version: string) => void;
  }>();

  let primaryBtn = $state<HTMLButtonElement | null>(null);
  let modalRef = $state<HTMLElement | null>(null);

  $effect(() => {
    primaryBtn?.focus();
  });

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      event.preventDefault();
      onNotNow();
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
      onNotNow();
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="dialog-backdrop" onclick={handleBackdropClick} role="presentation">
  <div
    class="dialog-modal"
    bind:this={modalRef}
    role="dialog"
    aria-modal="true"
    aria-labelledby="update-dialog-title"
    aria-describedby="update-dialog-desc"
  >
    <h2 id="update-dialog-title" class="dialog-title">Update available</h2>
    <p id="update-dialog-desc" class="dialog-message">
      Dossier {nextVersion} is ready to install. You're currently on {currentVersion}.
      Updating downloads from GitHub Releases and verifies the update signature.
    </p>

    <div class="dialog-actions">
      <button class="btn-secondary" onclick={onNotNow}>Not now</button>
      <button class="btn-secondary" onclick={() => onSkipVersion(nextVersion)}>
        Skip this version
      </button>
      <button class="btn-primary" bind:this={primaryBtn} onclick={onUpdateNow}>
        Restart and update
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
    z-index: 120;
    animation: backdrop-enter var(--duration-spring) var(--ease-out);
  }

  @keyframes backdrop-enter {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .dialog-modal {
    max-width: 520px;
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
      transform: translateY(6px) scale(0.98);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .dialog-title {
    font-family: var(--font-display);
    font-size: 1.25rem;
    font-weight: 650;
    line-height: 1.3;
    color: var(--text-primary);
    margin-bottom: var(--space-3);
  }

  .dialog-message {
    font-family: var(--font-body);
    font-size: 0.9375rem;
    line-height: 1.55;
    color: var(--text-secondary);
    margin-bottom: var(--space-8);
  }

  .dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-3);
    flex-wrap: wrap;
  }

  .btn-primary {
    min-height: 44px;
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius-sm);
    background: var(--primary-accent);
    color: var(--primary-accent-text);
    font-family: var(--font-body);
    font-size: 0.9375rem;
    font-weight: 650;
    box-shadow: var(--shadow-sm);
    transition: background-color var(--duration-standard) var(--ease-out),
      box-shadow var(--duration-standard) var(--ease-out);
  }

  .btn-primary:hover {
    background: var(--primary-accent-hover);
    box-shadow: var(--shadow-md);
  }

  .btn-secondary {
    min-height: 44px;
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text-primary);
    font-family: var(--font-body);
    font-size: 0.9375rem;
    font-weight: 550;
    border: 1px solid var(--border);
    transition: background-color var(--duration-standard) var(--ease-out);
  }

  .btn-secondary:hover {
    background: var(--base-tertiary);
  }
</style>
