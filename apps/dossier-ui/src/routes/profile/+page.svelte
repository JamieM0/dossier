<script lang="ts">
  import ConfirmedItem from "$lib/components/ConfirmedItem.svelte";
  import CommentPopout from "$lib/components/CommentPopout.svelte";
  import InferenceItem from "$lib/components/InferenceItem.svelte";
  import NotificationBanner from "$lib/components/NotificationBanner.svelte";
  import ProcessingFeed from "$lib/components/ProcessingFeed.svelte";
  import type { ProfileItem } from "$lib/types";

  type ViewInference = ProfileItem & { provenance: string };
  type Category = {
    id: string;
    label: string;
    confirmed: ProfileItem[];
    inferences: ViewInference[];
  };

  let allConfirmed = $state<ProfileItem[]>([]);
  let allInferences = $state<ViewInference[]>([]);
  let newItemText = $state("");
  let importPath = $state("");
  let commentTarget = $state<ViewInference | null>(null);
  let focusedIndex = $state(-1);
  let isImporting = $state(false);

  let discoveries = $state([
    { id: "1", text: "Analysing import patterns...", complete: false },
    { id: "2", text: "Generating inference proposals...", complete: false },
    { id: "3", text: "Waiting for your review.", complete: false }
  ]);

  // Group items into categories for display
  let categories = $derived<Category[]>([
    {
      id: "personal",
      label: "Personal",
      confirmed: allConfirmed.filter((i) => i.item_type === "preference" || i.item_type === "fact"),
      inferences: allInferences
    },
    {
      id: "professional",
      label: "Professional",
      confirmed: allConfirmed.filter((i) => i.item_type === "professional"),
      inferences: []
    },
    {
      id: "interests",
      label: "Interests",
      confirmed: allConfirmed.filter((i) => i.item_type === "interest"),
      inferences: []
    },
    {
      id: "communication",
      label: "Communication",
      confirmed: allConfirmed.filter((i) => i.item_type === "communication"),
      inferences: []
    }
  ]);

  // Only show categories that have items, plus the first one always
  let visibleCategories = $derived(
    categories.filter((c, i) => i === 0 || c.confirmed.length > 0 || c.inferences.length > 0)
  );

  let totalPending = $derived(allInferences.length);
  let showProcessingFeed = $derived(isImporting || discoveries.some((d) => !d.complete));

  async function refresh(): Promise<void> {
    const items: ProfileItem[] = (await window.dossier?.profile.listItems()) ?? [];
    allConfirmed = items.filter((item) => item.state === "CONFIRMED");
    allInferences = items
      .filter((item) => item.state === "INFERENCE_PENDING")
      .map((item) => ({ ...item, provenance: "Inferred from Google Takeout patterns." }));

    if (allInferences.length > 0) {
      discoveries = discoveries.map((entry, index) => ({
        ...entry,
        complete: index < 2
      }));
    }
  }

  async function addItem(): Promise<void> {
    if (!newItemText.trim()) return;

    await window.dossier?.profile.createManualItem({
      text: newItemText,
      itemType: "preference",
      categoryId: null
    });

    newItemText = "";
    await refresh();
  }

  async function runImport(): Promise<void> {
    if (!importPath.trim()) return;
    isImporting = true;
    await window.dossier?.data.runTakeoutImport(importPath.trim());
    isImporting = false;
    await refresh();
  }

  function confirmInference(item: ViewInference): void {
    allConfirmed = [{ ...item, state: "CONFIRMED" }, ...allConfirmed];
    allInferences = allInferences.filter((c) => c.item_id !== item.item_id);
  }

  function dismissInference(item: ViewInference): void {
    allInferences = allInferences.filter((c) => c.item_id !== item.item_id);
  }

  function submitComment(_comment: string): void {
    commentTarget = null;
  }

  function handleProfileKeydown(event: KeyboardEvent): void {
    const el = document.activeElement;
    if (el?.tagName === "INPUT" || el?.tagName === "TEXTAREA") return;

    if (event.key === "n") {
      event.preventDefault();
      // Jump to next pending inference
      const items = document.querySelectorAll<HTMLElement>("[data-inference]");
      const current = focusedIndex;
      for (let i = current + 1; i < items.length; i++) {
        items[i]?.focus();
        focusedIndex = i;
        return;
      }
      items[0]?.focus();
      focusedIndex = 0;
    }
  }

  $effect(() => {
    void refresh();
  });
</script>

<svelte:window on:keydown={handleProfileKeydown} />

<section class="profile-view">
  <div class="profile-content">
    <NotificationBanner count={totalPending} />

    {#if showProcessingFeed}
      <ProcessingFeed {discoveries} isComplete={!isImporting && discoveries.every((d) => d.complete)} />
    {/if}

    {#each visibleCategories as category (category.id)}
      <section class="category-section" id={category.id}>
        <h2 class="category-heading">{category.label}</h2>

        {#if category.id === "personal"}
          <div class="add-item-row">
            <input
              class="text-input"
              type="text"
              bind:value={newItemText}
              placeholder="Add a confirmed profile item"
              aria-label="Add item"
              onkeydown={(e) => { if (e.key === "Enter") void addItem(); }}
            />
            <button class="btn-primary" onclick={addItem}>Add item</button>
          </div>

          <div class="import-row">
            <input
              class="text-input"
              type="text"
              bind:value={importPath}
              placeholder="Google Takeout folder path"
              aria-label="Google Takeout path"
            />
            <button class="btn-secondary" onclick={runImport}>Run import</button>
          </div>
        {/if}

        <div class="items-list" role="list">
          {#each category.inferences as inference (inference.item_id)}
            <div class="item-wrapper" data-inference>
              <InferenceItem
                text={inference.text}
                provenance={inference.provenance}
                onConfirm={() => confirmInference(inference)}
                onDismiss={() => dismissInference(inference)}
                onComment={() => (commentTarget = inference)}
              />
              {#if commentTarget?.item_id === inference.item_id}
                <div class="comment-anchor">
                  <CommentPopout
                    itemText={commentTarget.text}
                    provenance={commentTarget.provenance}
                    onSubmit={submitComment}
                    onClose={() => (commentTarget = null)}
                  />
                </div>
              {/if}
            </div>
          {/each}

          {#each category.confirmed as item (item.item_id)}
            <ConfirmedItem
              text={item.text}
              updatedAt={item.updated_at}
              onEdit={() => undefined}
            />
          {/each}

          {#if category.confirmed.length === 0 && category.inferences.length === 0 && category.id !== "personal"}
            <div class="empty-state">
              <p class="empty-text">No {category.label.toLowerCase()} information yet</p>
            </div>
          {/if}
        </div>
      </section>
    {/each}
  </div>
</section>

<style>
  .profile-view {
    min-height: 100vh;
    background: var(--base);
  }

  .profile-content {
    max-width: var(--content-max-width);
    margin: 0 auto;
    padding: var(--space-10) var(--space-8) var(--space-16);
  }

  .category-section {
    margin-bottom: var(--space-8);
  }

  .category-heading {
    font-family: var(--font-display);
    font-size: 1.5rem;
    font-weight: 600;
    line-height: 1.3;
    letter-spacing: -0.01em;
    color: var(--text-primary);
    margin-top: var(--space-12);
    margin-bottom: var(--space-6);
  }

  .category-section:first-of-type .category-heading {
    margin-top: 0;
  }

  .add-item-row,
  .import-row {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: var(--space-4);
    margin-bottom: var(--space-4);
  }

  .text-input {
    min-height: 44px;
    padding: var(--space-3) var(--space-4);
    font-family: var(--font-body);
    font-size: 0.9375rem;
    line-height: 1.5;
    color: var(--text-primary);
    background: var(--base-tertiary);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    transition: border-color var(--duration-standard) var(--ease-out),
                background-color var(--duration-standard) var(--ease-out);
  }

  .text-input::placeholder {
    color: var(--text-tertiary);
  }

  .text-input:focus {
    outline: none;
    border-color: var(--primary-accent);
    background: var(--base);
  }

  .btn-primary,
  .btn-secondary {
    min-height: 40px;
    min-width: 80px;
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius-sm);
    font-family: var(--font-body);
    font-size: 0.9375rem;
    font-weight: 600;
    border: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    transition: background-color var(--duration-standard) var(--ease-out),
                box-shadow var(--duration-standard) var(--ease-out);
  }

  .btn-primary {
    background: var(--primary-accent);
    color: var(--primary-accent-text);
    box-shadow: var(--shadow-sm);
  }

  .btn-primary:hover {
    background: var(--primary-accent-hover);
    box-shadow: var(--shadow-md);
  }

  .btn-primary:active {
    box-shadow: var(--shadow-sm);
    transform: translateY(1px);
  }

  .btn-secondary {
    background: transparent;
    color: var(--text-primary);
    border: 1px solid var(--border);
    font-weight: 500;
  }

  .btn-secondary:hover {
    background: var(--base-tertiary);
  }

  .items-list {
    display: flex;
    flex-direction: column;
  }

  .item-wrapper {
    position: relative;
  }

  .comment-anchor {
    position: absolute;
    right: calc(-1 * (320px + var(--space-4)));
    top: 50%;
    transform: translateY(-50%);
    z-index: 20;
  }

  .empty-state {
    padding: var(--space-8) var(--space-4);
    text-align: center;
  }

  .empty-text {
    font-family: var(--font-body);
    font-size: 1.0625rem;
    line-height: 1.6;
    color: var(--text-secondary);
  }
</style>
