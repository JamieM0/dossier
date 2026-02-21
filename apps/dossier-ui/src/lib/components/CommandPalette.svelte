<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { goto } from "$app/navigation";
  import IconMagnifyingGlassRegular from "phosphor-icons-svelte/IconMagnifyingGlassRegular.svelte";
  import IconUserRegular from "phosphor-icons-svelte/IconUserRegular.svelte";
  import IconChatCircleRegular from "phosphor-icons-svelte/IconChatCircleRegular.svelte";
  import IconGearRegular from "phosphor-icons-svelte/IconGearRegular.svelte";
  import IconPlugsConnectedRegular from "phosphor-icons-svelte/IconPlugsConnectedRegular.svelte";
  import IconClockCounterClockwiseRegular from "phosphor-icons-svelte/IconClockCounterClockwiseRegular.svelte";
  import type { ProfileItemView } from "$lib/types";

  let { onClose } = $props<{ onClose: () => void }>();

  type CommandEntry = {
    id: string;
    label: string;
    description?: string;
    icon: "profile" | "chat" | "settings" | "connections" | "audit" | "item";
    action: () => void;
  };

  let query = $state("");
  let selectedIndex = $state(0);
  let inputRef = $state<HTMLInputElement | null>(null);
  let profileItems = $state<ProfileItemView[]>([]);

  const navCommands: CommandEntry[] = [
    { id: "nav-profile", label: "Go to Profile", icon: "profile", action: () => navigate("/profile") },
    { id: "nav-chat", label: "Go to Chat", icon: "chat", action: () => navigate("/chat") },
    { id: "nav-settings", label: "Go to Settings", icon: "settings", action: () => navigate("/settings") },
    { id: "nav-connections", label: "Go to Connections", icon: "connections", action: () => navigate("/connections") },
    { id: "nav-audit", label: "Go to Audit Log", icon: "audit", action: () => navigate("/audit") }
  ];

  const filteredEntries = $derived<CommandEntry[]>(() => {
    const q = query.toLowerCase().trim();
    const results: CommandEntry[] = [];

    // Navigation commands
    for (const cmd of navCommands) {
      if (!q || cmd.label.toLowerCase().includes(q)) {
        results.push(cmd);
      }
    }

    // Profile items (fuzzy search)
    if (q.length >= 2) {
      for (const item of profileItems) {
        if (item.text.toLowerCase().includes(q)) {
          results.push({
            id: `item-${item.item_id}`,
            label: item.text,
            description: `${item.item_type} — ${item.state === "CONFIRMED" ? "Confirmed" : "Pending"}`,
            icon: "item",
            action: () => {
              onClose();
              void goto("/profile");
            }
          });
        }
        if (results.length >= 20) break;
      }
    }

    return results;
  });

  function navigate(path: string): void {
    onClose();
    void goto(path);
  }

  function handleKeydown(event: KeyboardEvent): void {
    const entries = filteredEntries();
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, entries.length - 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const entry = entries[selectedIndex];
      entry?.action();
    }
  }

  function handleBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement)?.classList.contains("palette-backdrop")) {
      onClose();
    }
  }

  $effect(() => {
    // Reset selection when query changes
    query;
    selectedIndex = 0;
  });

  onMount(() => {
    inputRef?.focus();
    void loadItems();
  });

  async function loadItems(): Promise<void> {
    profileItems = await window.dossier?.profile.listItems() ?? [];
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div class="palette-backdrop" role="dialog" aria-label="Command palette" onclick={handleBackdropClick} onkeydown={handleKeydown}>
  <div class="palette-container">
    <div class="palette-input-area">
      <IconMagnifyingGlassRegular class="icon-18 search-icon" />
      <input
        class="palette-input"
        bind:this={inputRef}
        bind:value={query}
        placeholder="Search items or navigate..."
        type="text"
        autocomplete="off"
        spellcheck="false"
      />
    </div>

    {#if filteredEntries().length > 0}
      <div class="palette-results" role="listbox">
        {#each filteredEntries() as entry, i (entry.id)}
          <button
            class="palette-entry"
            class:selected={i === selectedIndex}
            role="option"
            aria-selected={i === selectedIndex}
            onclick={() => entry.action()}
            onmouseenter={() => { selectedIndex = i; }}
          >
            <span class="entry-icon">
              {#if entry.icon === "profile" || entry.icon === "item"}
                <IconUserRegular class="icon-16" />
              {:else if entry.icon === "chat"}
                <IconChatCircleRegular class="icon-16" />
              {:else if entry.icon === "settings"}
                <IconGearRegular class="icon-16" />
              {:else if entry.icon === "connections"}
                <IconPlugsConnectedRegular class="icon-16" />
              {:else if entry.icon === "audit"}
                <IconClockCounterClockwiseRegular class="icon-16" />
              {/if}
            </span>
            <div class="entry-text">
              <span class="entry-label">{entry.label}</span>
              {#if entry.description}
                <span class="entry-desc">{entry.description}</span>
              {/if}
            </div>
          </button>
        {/each}
      </div>
    {:else}
      <div class="palette-empty">
        <span>No results found</span>
      </div>
    {/if}

    <div class="palette-footer">
      <kbd>↑↓</kbd> navigate
      <kbd>↵</kbd> select
      <kbd>esc</kbd> close
    </div>
  </div>
</div>

<style>
  .palette-backdrop {
    position: fixed;
    inset: 0;
    z-index: 100;
    background: rgba(0, 0, 0, 0.3);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 15vh;
    animation: fade-in var(--duration-standard) var(--ease-out);
  }

  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .palette-container {
    width: 560px;
    max-width: calc(100vw - var(--space-8));
    max-height: 60vh;
    background: var(--base);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: entrance-fade-up var(--duration-moderate) var(--ease-out);
  }

  .palette-input-area {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-4) var(--space-5);
    border-bottom: 1px solid var(--border-subtle);
  }

  .palette-input-area :global(.search-icon) {
    color: var(--text-tertiary);
    flex-shrink: 0;
  }

  .palette-input {
    flex: 1;
    border: none;
    background: transparent;
    font-family: var(--font-body);
    font-size: 1rem;
    line-height: 1.5;
    color: var(--text-primary);
    outline: none;
  }

  .palette-input::placeholder {
    color: var(--text-tertiary);
  }

  .palette-results {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-2) 0;
  }

  .palette-entry {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    width: 100%;
    padding: var(--space-2) var(--space-5);
    text-align: left;
    background: transparent;
    border: none;
    color: var(--text-primary);
    transition: background-color var(--duration-standard) var(--ease-out);
  }

  .palette-entry.selected {
    background: var(--base-secondary);
  }

  .entry-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: var(--radius-sm);
    background: var(--base-tertiary);
    color: var(--text-secondary);
    flex-shrink: 0;
  }

  .entry-text {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .entry-label {
    font-family: var(--font-body);
    font-size: 0.9375rem;
    line-height: 1.4;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .entry-desc {
    font-family: var(--font-body);
    font-size: 0.8125rem;
    line-height: 1.4;
    color: var(--text-tertiary);
  }

  .palette-empty {
    padding: var(--space-6) var(--space-5);
    text-align: center;
    font-family: var(--font-body);
    font-size: 0.9375rem;
    color: var(--text-tertiary);
  }

  .palette-footer {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-2) var(--space-5);
    border-top: 1px solid var(--border-subtle);
    font-family: var(--font-body);
    font-size: 0.75rem;
    color: var(--text-tertiary);
  }

  .palette-footer kbd {
    display: inline-block;
    padding: 1px var(--space-1);
    background: var(--base-tertiary);
    border: 1px solid var(--border-subtle);
    border-radius: 3px;
    font-family: inherit;
    font-size: 0.6875rem;
  }
</style>
