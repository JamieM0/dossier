<script lang="ts">
  import { onMount } from "svelte";

  let {
    itemText,
    provenance,
    onSubmit,
    onClose
  } = $props<{
    itemText: string;
    provenance: string;
    onSubmit: (comment: string) => void;
    onClose: () => void;
  }>();

  let comment = $state("");
  let popoutRef = $state<HTMLElement | null>(null);

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
    }
  }

  function handleClickOutside(event: MouseEvent): void {
    if (popoutRef && !popoutRef.contains(event.target as Node)) {
      onClose();
    }
  }

  onMount(() => {
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  });
</script>

<svelte:window on:keydown={handleKeydown} />

<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
<aside
  class="comment-popout"
  bind:this={popoutRef}
  role="dialog"
  aria-label="Add comment to inference"
>
  <p class="popout-item-text">{itemText}</p>
  <p class="popout-provenance">{provenance}</p>

  <textarea
    class="comment-input"
    bind:value={comment}
    placeholder="Add a correction or note..."
    rows="3"
  ></textarea>

  <div class="popout-actions">
    <button class="btn-primary" onclick={() => onSubmit(comment)}>Submit</button>
  </div>
</aside>

<style>
  .comment-popout {
    width: 320px;
    background: var(--base-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-md);
    padding: var(--space-5);
    animation: popout-enter var(--duration-moderate) var(--ease-out);
    z-index: 20;
  }

  @keyframes popout-enter {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .popout-item-text {
    font-family: var(--font-body);
    font-size: 0.8125rem;
    line-height: 1.4;
    color: var(--text-secondary);
    margin-bottom: var(--space-2);
  }

  .popout-provenance {
    font-family: var(--font-body);
    font-size: 0.8125rem;
    line-height: 1.4;
    color: var(--text-tertiary);
    margin-bottom: var(--space-4);
  }

  .comment-input {
    width: 100%;
    min-height: 60px;
    padding: var(--space-3) var(--space-4);
    font-family: var(--font-body);
    font-size: 0.9375rem;
    line-height: 1.5;
    color: var(--text-primary);
    background: var(--base-tertiary);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    resize: vertical;
  }

  .comment-input::placeholder {
    color: var(--text-tertiary);
  }

  .comment-input:focus {
    outline: none;
    border-color: var(--primary-accent);
    background: var(--base);
  }

  .popout-actions {
    display: flex;
    justify-content: flex-end;
    margin-top: var(--space-4);
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

  .btn-primary:active {
    box-shadow: var(--shadow-sm);
    transform: translateY(1px);
  }
</style>
