<script lang="ts">
  /** Shown once per app launch while upgradeExistingRatings() (enrich-ratings.ts)
   * walks the rated library fetching richer per-item taste data. Blocks
   * interaction and cannot be dismissed until the pass finishes — this is
   * a one-time background job the user explicitly asked to be able to see
   * (rather than a silent process they had no way to confirm had run). */
  let {
    processed,
    total,
    done,
    upgraded,
    onClose
  }: {
    processed: number;
    total: number;
    done: boolean;
    upgraded: number;
    onClose: () => void;
  } = $props();

  const percent = $derived(total === 0 ? 100 : Math.round((processed / total) * 100));

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      event.preventDefault();
      if (done) onClose();
    }
  }

  function handleBackdropClick(event: MouseEvent): void {
    if (done && event.target === event.currentTarget) onClose();
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="dialog-backdrop" onclick={handleBackdropClick} role="presentation">
  <div
    class="dialog-modal"
    role="dialog"
    aria-modal="true"
    aria-labelledby="enrich-dialog-title"
    aria-describedby="enrich-dialog-desc"
  >
    <h2 id="enrich-dialog-title" class="dialog-title">
      {done ? "Taste data refreshed" : "Refreshing your taste data…"}
    </h2>
    <p id="enrich-dialog-desc" class="dialog-message">
      {#if !done}
        Dossier is fetching richer per-title data for your ratings so recommendations can
        tell similar movies apart more precisely. This runs once — feel free to leave this
        open, it won't take long.
      {:else if total === 0}
        You don't have any rated titles yet, so there was nothing to refresh.
      {:else if upgraded > 0}
        Upgraded {upgraded} of {total} rated title{total === 1 ? "" : "s"} with richer data.
      {:else}
        All {total} rated title{total === 1 ? "" : "s"} already had the richer data — nothing to change.
      {/if}
    </p>

    <div class="progress-track" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
      <div class="progress-fill" style={`width: ${percent}%`}></div>
    </div>
    <p class="progress-label">
      {#if !done}
        {processed} / {total} ({percent}%)
      {:else}
        Done
      {/if}
    </p>

    {#if done}
      <div class="dialog-actions">
        <button class="btn-primary" onclick={onClose}>Close</button>
      </div>
    {/if}
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
    z-index: 130;
    animation: backdrop-enter var(--duration-spring) var(--ease-out);
  }

  @keyframes backdrop-enter {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .dialog-modal {
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
    from { opacity: 0; transform: translateY(6px) scale(0.98); }
    to { opacity: 1; transform: translateY(0) scale(1); }
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
    margin-bottom: var(--space-5);
  }

  .progress-track {
    width: 100%;
    height: 8px;
    border-radius: 999px;
    background: var(--base-tertiary);
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: var(--primary-accent);
    border-radius: 999px;
    transition: width var(--duration-standard) var(--ease-out);
  }

  .progress-label {
    margin-top: var(--space-2);
    font-family: var(--font-mono, var(--font-body));
    font-size: 0.8125rem;
    color: var(--text-tertiary);
    font-variant-numeric: tabular-nums;
  }

  .dialog-actions {
    display: flex;
    justify-content: flex-end;
    margin-top: var(--space-6);
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
</style>
