<script lang="ts">
  import IconChatCircleRegular from "phosphor-icons-svelte/IconChatCircleRegular.svelte";
  import IconCheckRegular from "phosphor-icons-svelte/IconCheckRegular.svelte";
  import IconInfoRegular from "phosphor-icons-svelte/IconInfoRegular.svelte";
  import IconSparkleRegular from "phosphor-icons-svelte/IconSparkleRegular.svelte";
  import IconXRegular from "phosphor-icons-svelte/IconXRegular.svelte";

  let {
    text,
    provenance,
    why = null,
    confidence = null,
    focused = false,
    onConfirm,
    onDismiss,
    onComment,
    onFocus
  } = $props<{
    text: string;
    provenance: string;
    why?: string | null;
    confidence?: number | null;
    focused?: boolean;
    onConfirm: () => void;
    onDismiss: () => void;
    onComment: () => void;
    onFocus?: () => void;
  }>();

  let hovered = $state(false);
  let showActions = $derived(hovered || focused);

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === "y" || event.key === "a") {
      event.preventDefault();
      onConfirm();
    } else if (event.key === "d") {
      event.preventDefault();
      onDismiss();
    } else if (event.key === "c") {
      event.preventDefault();
      onComment();
    }
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex a11y_no_noninteractive_element_interactions -->
<article
  class="inference-item"
  class:show-details={showActions}
  role="listitem"
  tabindex="0"
  aria-label="Pending inference: {text}. Press Y to confirm, D to dismiss, C to comment."
  data-profile-item
  onmouseenter={() => (hovered = true)}
  onmouseleave={() => (hovered = false)}
  onfocus={() => onFocus?.()}
  onkeydown={handleKeydown}
>
  <div class="item-content">
    <div class="item-text">
      <IconSparkleRegular class="sparkle-icon icon-16" />
      <span>{text}</span>
    </div>

    {#if showActions}
      <p class="provenance">
        <IconInfoRegular class="icon-14" />
        <span>{provenance}</span>
      </p>
      {#if why}
        <p class="provenance">
          <span>Why:</span>
          <span>{why}</span>
        </p>
      {/if}
      {#if confidence !== null}
        <p class="provenance">
          <span>Confidence:</span>
          <span>{Math.round(confidence * 100)}%</span>
        </p>
      {/if}
    {/if}
  </div>

  {#if showActions}
    <div class="actions">
      <button class="ghost-action confirm" onclick={onConfirm} title="Confirm (Y)">
        <IconCheckRegular class="icon-14" />
        <span>Confirm</span>
      </button>
      <button class="ghost-action dismiss" onclick={onDismiss} title="Dismiss (D)">
        <IconXRegular class="icon-14" />
        <span>Dismiss</span>
      </button>
      <button class="ghost-action" onclick={onComment} title="Comment (C)">
        <IconChatCircleRegular class="icon-14" />
        <span>Comment</span>
      </button>
    </div>
  {/if}
</article>

<style>
  .inference-item {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-4);
    padding: var(--space-3) var(--space-4);
    padding-left: calc(var(--space-4) - 3px);
    border-left: 3px solid var(--secondary-accent);
    border-bottom: 1px solid transparent;
    cursor: default;
    transition: background-color var(--duration-standard) var(--ease-out),
                border-bottom-color var(--duration-standard) var(--ease-out);
  }

  .inference-item.show-details {
    background: var(--base-tertiary);
    border-bottom-color: var(--border-subtle);
  }

  .inference-item:focus-visible {
    outline: 2px solid var(--primary-accent);
    outline-offset: 2px;
    border-radius: var(--radius-sm);
    background: var(--base-tertiary);
    border-bottom-color: var(--border-subtle);
  }

  .item-content {
    flex: 1;
    min-width: 0;
    opacity: var(--inference-opacity);
  }

  .item-text {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
    font-family: var(--font-body);
    font-size: 1.0625rem;
    line-height: 1.6;
    color: var(--text-primary);
  }

  .item-text :global(.sparkle-icon) {
    color: var(--secondary-accent);
    flex-shrink: 0;
    position: relative;
    top: 2px;
  }

  .provenance {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    margin-top: var(--space-1);
    font-family: var(--font-body);
    font-size: 0.8125rem;
    line-height: 1.4;
    color: var(--text-tertiary);
    animation: entrance-fade-up var(--duration-standard) var(--ease-out);
  }

  .actions {
    display: flex;
    gap: var(--space-2);
    flex-shrink: 0;
    animation: entrance-fade-up var(--duration-standard) var(--ease-out);
  }

  .ghost-action {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    min-height: 32px;
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-sm);
    font-family: var(--font-body);
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--text-secondary);
    transition: background-color var(--duration-standard) var(--ease-out),
                color var(--duration-standard) var(--ease-out);
  }

  .ghost-action:hover {
    background: color-mix(in srgb, var(--base-tertiary) 60%, var(--base));
    color: var(--text-primary);
  }

  .ghost-action.confirm {
    color: var(--success);
  }

  .ghost-action.confirm:hover {
    color: var(--success);
    background: var(--success-subtle);
  }

  .ghost-action.dismiss {
    color: var(--error);
  }

  .ghost-action.dismiss:hover {
    color: var(--error);
    background: var(--error-subtle);
  }
</style>
