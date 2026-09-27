<script lang="ts">
  import { toasts } from "$lib/state/toast.svelte";
  import { processing } from "$lib/state/processing.svelte";
  import IconXBold from "phosphor-icons-svelte/IconXBold.svelte";
  import IconSpinnerGapRegular from "phosphor-icons-svelte/IconSpinnerGapRegular.svelte";

  async function runAction(id: number, run: () => void | Promise<void>): Promise<void> {
    try {
      await run();
    } finally {
      toasts.dismiss(id);
    }
  }
</script>

<div class="toaster" role="region" aria-live="polite" aria-label="Notifications">
  {#each toasts.items as t (t.id)}
    <div class="toast" role="status">
      <span class="message">{t.message}</span>
      {#if t.action}
        <button class="action" onclick={() => void runAction(t.id, t.action!.run)}>
          {t.action.label}
        </button>
      {/if}
      <button class="close" aria-label="Dismiss" onclick={() => toasts.dismiss(t.id)}>
        <IconXBold class="icon-12" />
      </button>
    </div>
  {/each}
  {#if processing.pending > 0}
    <div class="processing" role="status" aria-live="polite" aria-label="Processing changes">
      <IconSpinnerGapRegular class="spinner icon-16" />
      <span>Processing</span>
    </div>
  {/if}
</div>

<style>
  .toaster {
    position: fixed;
    right: var(--space-4);
    bottom: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    z-index: 700;
    pointer-events: none;
  }
  .toast {
    pointer-events: auto;
    display: inline-flex;
    align-items: center;
    gap: var(--space-3);
    background: var(--base-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-md);
    padding: var(--space-2) var(--space-3);
    box-shadow: var(--shadow-lg);
    font-size: 0.85rem;
    min-width: 280px;
    max-width: 460px;
    animation: toast-in 200ms var(--ease-out);
  }
  .processing{pointer-events:none;align-self:flex-end;display:inline-flex;align-items:center;gap:8px;min-height:36px;padding:0 12px;border:1px solid var(--border-strong);border-radius:999px;background:var(--base-secondary);color:var(--text-secondary);box-shadow:var(--shadow-lg);font-size:.72rem;font-weight:600;letter-spacing:.02em;animation:toast-in 160ms var(--ease-out)}
  .processing :global(.spinner){color:var(--accent);animation:processing-spin .8s linear infinite}
  @keyframes processing-spin{to{transform:rotate(360deg)}}
  @keyframes toast-in {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .message { flex: 1; }
  .action {
    background: transparent;
    border: none;
    color: var(--accent);
    font-weight: 600;
    cursor: pointer;
    font-size: 0.85rem;
    padding: 2px 6px;
    border-radius: var(--radius-sm);
  }
  .action:hover { background: var(--base-tertiary); }
  .close {
    background: transparent;
    border: none;
    color: var(--text-tertiary);
    cursor: pointer;
    width: 24px;
    height: 24px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-sm);
  }
  .close:hover { background: var(--base-tertiary); color: var(--text-primary); }
  @media(max-width:760px){
    .toaster{left:12px;right:12px;bottom:calc(78px + env(safe-area-inset-bottom))}
    .toast{width:100%;min-width:0;max-width:none;overflow-wrap:anywhere}
  }
  @media(prefers-reduced-motion:reduce){.processing :global(.spinner){animation-duration:1.8s}}
</style>
