<script lang="ts">
  import IconPencilSimpleRegular from "phosphor-icons-svelte/IconPencilSimpleRegular.svelte";
  import IconTrashRegular from "phosphor-icons-svelte/IconTrashRegular.svelte";

  let {
    text,
    itemType,
    categoryName = null,
    compartmentNames = [],
    isTopicBlocked = false,
    updatedAt,
    focused = false,
    onEdit,
    onDelete,
    onFocus
  } = $props<{
    text: string;
    itemType: string;
    categoryName?: string | null;
    compartmentNames?: string[];
    isTopicBlocked?: boolean;
    updatedAt: string;
    focused?: boolean;
    onEdit: () => void;
    onDelete: () => void;
    onFocus?: () => void;
  }>();

  let hovered = $state(false);
  let flashing = $state(false);
  let showDetails = $derived(hovered || focused);

  export function flash(): void {
    flashing = true;
    setTimeout(() => { flashing = false; }, 400);
  }

  function formatDate(iso: string): string {
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric"
      });
    } catch {
      return iso;
    }
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === "e") {
      event.preventDefault();
      onEdit();
    }
  }
</script>

<article
  class="confirmed-item"
  class:show-details={showDetails}
  class:flashing
  role="listitem"
  tabindex="0"
  aria-label="{text}. Confirmed. Press E to edit."
  data-profile-item
  onmouseenter={() => (hovered = true)}
  onmouseleave={() => (hovered = false)}
  onfocus={() => onFocus?.()}
  onkeydown={handleKeydown}
>
  <div class="item-content">
    <span class="item-text">{text}</span>

    {#if showDetails}
      <div class="item-meta">
        <span class="meta-date">Confirmed {formatDate(updatedAt)}</span>
        {#if categoryName}
          <span class="meta-badge">{categoryName}</span>
        {/if}
        <span class="meta-badge">{itemType}</span>
        {#if isTopicBlocked}
          <span class="meta-badge blocked">Blocked</span>
        {/if}
        {#each compartmentNames as name}
          <span class="meta-badge">{name}</span>
        {/each}
      </div>
    {/if}
  </div>

  {#if showDetails}
    <div class="actions">
      <button class="ghost-action" onclick={onEdit} title="Edit (E)">
        <IconPencilSimpleRegular class="icon-14" />
        <span>Edit</span>
      </button>
      <button class="ghost-action delete" onclick={onDelete} title="Delete">
        <IconTrashRegular class="icon-14" />
        <span>Delete</span>
      </button>
    </div>
  {/if}
</article>

<style>
  .confirmed-item {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-4);
    padding: var(--space-3) var(--space-4);
    border-bottom: 1px solid transparent;
    cursor: default;
    transition: background-color var(--duration-standard) var(--ease-out),
                border-bottom-color var(--duration-standard) var(--ease-out);
  }

  .confirmed-item.show-details {
    background: var(--base-tertiary);
    border-bottom-color: var(--border-subtle);
  }

  .confirmed-item:focus-visible {
    outline: 2px solid var(--primary-accent);
    outline-offset: 2px;
    border-radius: var(--radius-sm);
    background: var(--base-tertiary);
    border-bottom-color: var(--border-subtle);
  }

  .confirmed-item.flashing {
    animation: confirmed-flash 400ms var(--ease-out);
  }

  .item-content {
    flex: 1;
    min-width: 0;
  }

  .item-text {
    font-family: var(--font-body);
    font-size: 1.0625rem;
    line-height: 1.6;
    color: var(--text-primary);
  }

  .item-meta {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-top: var(--space-1);
    animation: entrance-fade-up var(--duration-standard) var(--ease-out);
  }

  .meta-date {
    font-family: var(--font-body);
    font-size: 0.8125rem;
    line-height: 1.4;
    color: var(--text-tertiary);
  }

  .meta-badge {
    font-family: var(--font-body);
    font-size: 0.75rem;
    line-height: 1.4;
    padding: 0 var(--space-2);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-full);
    color: var(--text-tertiary);
  }

  .meta-badge.blocked {
    border-color: var(--error);
    color: var(--error);
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

  .ghost-action.delete {
    color: var(--error);
  }

  .ghost-action.delete:hover {
    color: var(--error);
    background: var(--error-subtle);
  }
</style>
