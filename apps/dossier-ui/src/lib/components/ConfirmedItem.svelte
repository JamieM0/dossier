<script lang="ts">
  let {
    text,
    updatedAt,
    onEdit
  } = $props<{
    text: string;
    updatedAt: string;
    onEdit: () => void;
  }>();

  let hovered = $state(false);
  let editing = $state(false);
  let editValue = $state("");
  let flashing = $state(false);

  function startEdit(): void {
    editValue = text;
    editing = true;
  }

  function cancelEdit(): void {
    editing = false;
    editValue = text;
  }

  function saveEdit(): void {
    editing = false;
    onEdit();
  }

  function handleEditKeydown(event: KeyboardEvent): void {
    if (event.key === "Enter") {
      event.preventDefault();
      saveEdit();
    } else if (event.key === "Escape") {
      event.preventDefault();
      cancelEdit();
    }
  }

  function handleItemKeydown(event: KeyboardEvent): void {
    if (event.key === "e" && !editing) {
      event.preventDefault();
      startEdit();
    } else if (event.key === "Escape" && editing) {
      event.preventDefault();
      cancelEdit();
    }
  }

  const formattedDate = $derived(
    new Date(updatedAt).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric"
    })
  );
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex a11y_no_noninteractive_element_interactions -->
<article
  class="confirmed-item"
  class:hovered
  class:flashing
  role="listitem"
  tabindex="0"
  aria-label="{text}. Confirmed. Press E to edit."
  onmouseenter={() => (hovered = true)}
  onmouseleave={() => (hovered = false)}
  onkeydown={handleItemKeydown}
>
  <div class="item-content">
    {#if editing}
      <input
        class="inline-edit"
        type="text"
        bind:value={editValue}
        onkeydown={handleEditKeydown}
        onblur={saveEdit}
      />
    {:else}
      <p class="item-text">{text}</p>
    {/if}

    {#if hovered && !editing}
      <p class="metadata">Confirmed {formattedDate}</p>
    {/if}
  </div>

  {#if hovered && !editing}
    <div class="actions">
      <button class="ghost-action" onclick={startEdit}>Edit</button>
    </div>
  {:else if editing}
    <div class="actions">
      <button class="ghost-action save" onclick={saveEdit}>Save</button>
      <button class="ghost-action" onclick={cancelEdit}>Cancel</button>
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

  .confirmed-item.hovered {
    background: var(--base-tertiary);
    border-bottom-color: var(--border-subtle);
  }

  .confirmed-item:focus-visible {
    outline: 2px solid var(--primary-accent);
    outline-offset: 2px;
    border-radius: var(--radius-sm);
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

  .metadata {
    margin-top: var(--space-1);
    font-family: var(--font-body);
    font-size: 0.8125rem;
    line-height: 1.4;
    color: var(--text-tertiary);
    animation: entrance-fade-up var(--duration-standard) var(--ease-out);
  }

  .inline-edit {
    width: 100%;
    font-family: var(--font-body);
    font-size: 1.0625rem;
    line-height: 1.6;
    color: var(--text-primary);
    background: transparent;
    border: 1px solid var(--primary-accent);
    border-radius: var(--radius-sm);
    padding: var(--space-1);
  }

  .inline-edit:focus {
    outline: none;
    border-color: var(--primary-accent);
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

  .ghost-action.save {
    background: var(--primary-accent);
    color: var(--primary-accent-text);
    font-weight: 600;
    padding: var(--space-1) var(--space-3);
  }

  .ghost-action.save:hover {
    background: var(--primary-accent-hover);
  }
</style>
