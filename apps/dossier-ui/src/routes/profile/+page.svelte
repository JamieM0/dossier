<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import CommentPopout from "$lib/components/CommentPopout.svelte";
  import ConfirmDialog from "$lib/components/ConfirmDialog.svelte";
  import ConfirmedItem from "$lib/components/ConfirmedItem.svelte";
  import InferenceItem from "$lib/components/InferenceItem.svelte";
  import NotificationBanner from "$lib/components/NotificationBanner.svelte";
  import PromptDialog from "$lib/components/PromptDialog.svelte";
  import IconPlusRegular from "phosphor-icons-svelte/IconPlusRegular.svelte";
  import IconUploadSimpleRegular from "phosphor-icons-svelte/IconUploadSimpleRegular.svelte";
  import IconFolderOpenRegular from "phosphor-icons-svelte/IconFolderOpenRegular.svelte";
  import IconUserRegular from "phosphor-icons-svelte/IconUserRegular.svelte";
  import type { Category, Compartment, ProfileItemView, TopicRule } from "$lib/types";
  import { uiSettings } from "$lib/state/ui-settings.svelte";

  const ITEM_TYPES = ["preference", "communication", "interest", "professional", "fact", "constraint"];
  const TOPIC_PRESETS = ["politics", "religion", "health", "finance", "trauma"];

  let items = $state<ProfileItemView[]>([]);
  let categories = $state<Category[]>([]);
  let compartments = $state<Compartment[]>([]);
  let topicRules = $state<TopicRule[]>([]);

  let statusMessage = $state("");
  let errorMessage = $state("");
  let statusTimer = $state<ReturnType<typeof setTimeout> | null>(null);

  let showWelcome = $state(false);
  let topicsHandled = $state(false);
  let importHandled = $state(false);
  let setupSelectedTopics = $state<string[]>([]);
  let setupCustomTopic = $state("");

  let showAddItem = $state(false);
  let newItemText = $state("");
  let newItemType = $state("preference");
  let newItemCategoryId = $state<string | null>(null);
  let newItemCompartmentIds = $state<string[]>([]);

  let importPath = $state("");
  let isImporting = $state(false);
  let showImport = $state(false);

  let editTargetId = $state<string | null>(null);
  let editText = $state("");
  let editType = $state("preference");
  let editCategoryId = $state<string | null>(null);
  let editCompartmentIds = $state<string[]>([]);

  let deleteTargetId = $state<string | null>(null);
  let commentTarget = $state<ProfileItemView | null>(null);

  let focusedIndex = $state(-1);
  let itemRefs = $state<HTMLElement[]>([]);

  const confirmedItems = $derived(
    items
      .filter((item) => item.state === "CONFIRMED")
      .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at))
  );

  const pendingInferences = $derived(
    items
      .filter((item) => item.state === "INFERENCE_PENDING")
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
  );

  const pendingCount = $derived(pendingInferences.length);

  const categoryById = $derived(new Map(categories.map((c) => [c.category_id, c])));
  const compartmentById = $derived(new Map(compartments.map((c) => [c.compartment_id, c])));

  const itemsByCategory = $derived(() => {
    const groups = new Map<string, { confirmed: ProfileItemView[]; pending: ProfileItemView[] }>();
    const uncategorized = { confirmed: [] as ProfileItemView[], pending: [] as ProfileItemView[] };

    for (const category of categories) {
      groups.set(category.category_id, { confirmed: [], pending: [] });
    }

    for (const item of items) {
      const key = item.category_id ?? "__uncategorized__";
      const group = groups.get(key) ?? uncategorized;
      if (item.state === "CONFIRMED") {
        group.confirmed.push(item);
      } else if (item.state === "INFERENCE_PENDING") {
        group.pending.push(item);
      }
    }

    return { groups, uncategorized };
  });

  const allProfileItems = $derived([...pendingInferences, ...confirmedItems]);

  function compartmentNames(item: ProfileItemView): string[] {
    return item.compartment_ids
      .map((id) => compartmentById.get(id)?.name)
      .filter((name): name is string => Boolean(name));
  }

  function toggleId(current: string[], id: string): string[] {
    return current.includes(id) ? current.filter((c) => c !== id) : [...current, id];
  }

  function categoryIdOrNull(value: string): string | null {
    return value === "" ? null : value;
  }

  function setStatus(message: string): void {
    statusMessage = message;
    errorMessage = "";
    if (statusTimer) clearTimeout(statusTimer);
    statusTimer = setTimeout(() => { statusMessage = ""; }, 4000);
  }

  function setError(error: unknown): void {
    errorMessage = error instanceof Error ? error.message : "Something went wrong.";
    statusMessage = "";
  }

  function isInTextInput(): boolean {
    const el = document.activeElement;
    if (!el) return false;
    const tag = el.tagName.toLowerCase();
    return tag === "input" || tag === "textarea" || (el as HTMLElement).isContentEditable;
  }

  async function refresh(): Promise<void> {
    const [nextItems, nextCategories, nextCompartments, nextRules, nextSettings] = await Promise.all([
      window.dossier?.profile.listItems() ?? Promise.resolve([]),
      window.dossier?.categories.list() ?? Promise.resolve([]),
      window.dossier?.compartments.list() ?? Promise.resolve([]),
      window.dossier?.topicRules.list() ?? Promise.resolve([]),
      window.dossier?.settings.get() ?? Promise.resolve({})
    ]);

    items = nextItems;
    categories = nextCategories;
    compartments = nextCompartments;
    topicRules = nextRules;

    const setupComplete = Boolean((nextSettings as Record<string, unknown>).blockedTopicsSetupComplete);
    const nextShowWelcome = !setupComplete;
    if (nextShowWelcome && !showWelcome) {
      // Entering welcome fresh (e.g. after profile deletion) — reset step states
      topicsHandled = false;
      importHandled = false;
    }
    showWelcome = nextShowWelcome;
    uiSettings.showingWelcome = showWelcome;
  }

  async function addItem(): Promise<void> {
    if (!newItemText.trim()) return;
    errorMessage = "";

    try {
      const created = await window.dossier?.profile.createManualItem({
        text: newItemText.trim(),
        itemType: newItemType,
        categoryId: newItemCategoryId
      });

      if (created && newItemCompartmentIds.length > 0) {
        await window.dossier?.profile.setItemCompartments(created.item_id, newItemCompartmentIds);
      }

      newItemText = "";
      newItemCompartmentIds = [];
      showAddItem = false;
      setStatus("Item saved.");
      await refresh();
    } catch (error) {
      setError(error);
    }
  }

  async function browseForImport(): Promise<void> {
    try {
      const result = await window.dossier?.data.browseFolder?.();
      if (result) {
        importPath = result;
      }
    } catch {
      // Fall back to manual path entry
    }
  }

  async function runImport(): Promise<void> {
    if (!importPath.trim()) return;
    errorMessage = "";
    isImporting = true;

    try {
      const result = await window.dossier?.data.runTakeoutImport(importPath.trim());
      const cast = (result ?? {}) as {
        artifactsScanned?: number;
        inferencesCreated?: number;
        inferencesSuppressed?: number;
      };
      setStatus(`Import complete. ${cast.artifactsScanned ?? 0} artifacts scanned, ${cast.inferencesCreated ?? 0} inferences created, ${cast.inferencesSuppressed ?? 0} suppressed.`);
      showImport = false;
      importPath = "";
      if (showWelcome) {
        importHandled = true;
        await closeWelcomeIfComplete();
      }
      await refresh();
    } catch (error) {
      setError(error);
    } finally {
      isImporting = false;
    }
  }

  function startEdit(item: ProfileItemView): void {
    editTargetId = item.item_id;
    editText = item.text;
    editType = item.item_type;
    editCategoryId = item.category_id ?? null;
    editCompartmentIds = [...item.compartment_ids];
  }

  function cancelEdit(): void {
    editTargetId = null;
    editText = "";
    editType = "preference";
    editCategoryId = null;
    editCompartmentIds = [];
  }

  async function saveEdit(itemId: string): Promise<void> {
    if (!editText.trim()) return;

    try {
      await window.dossier?.profile.updateItem(itemId, {
        text: editText.trim(),
        itemType: editType,
        categoryId: editCategoryId
      });
      await window.dossier?.profile.setItemCompartments(itemId, editCompartmentIds);
      setStatus("Item updated.");
      cancelEdit();
      await refresh();
    } catch (error) {
      setError(error);
    }
  }

  async function deleteItem(itemId: string): Promise<void> {
    try {
      await window.dossier?.profile.deleteItem(itemId);
      deleteTargetId = null;
      if (editTargetId === itemId) cancelEdit();
      setStatus("Item deleted permanently.");
      await refresh();
    } catch (error) {
      setError(error);
    }
  }

  async function confirmInference(itemId: string): Promise<void> {
    try {
      await window.dossier?.profile.inferenceConfirm(itemId);
      setStatus("Inference confirmed.");
      await refresh();
    } catch (error) {
      setError(error);
    }
  }

  async function dismissInference(itemId: string): Promise<void> {
    try {
      await window.dossier?.profile.inferenceDismiss(itemId);
      if (commentTarget?.item_id === itemId) commentTarget = null;
      setStatus("Inference dismissed and suppressed from re-suggestion.");
      await refresh();
    } catch (error) {
      setError(error);
    }
  }

  async function submitCorrection(comment: string): Promise<void> {
    if (!commentTarget) return;
    const editedText = comment.trim();
    if (!editedText) {
      commentTarget = null;
      return;
    }

    try {
      await window.dossier?.profile.inferenceEditConfirm(commentTarget.item_id, editedText);
      commentTarget = null;
      setStatus("Inference edited and confirmed.");
      await refresh();
    } catch (error) {
      setError(error);
    }
  }

  async function closeWelcomeIfComplete(): Promise<void> {
    if (topicsHandled && importHandled) {
      await window.dossier?.settings.set({ blockedTopicsSetupComplete: true });
      showWelcome = false;
      uiSettings.showingWelcome = false;
    }
  }

  async function completeTopicSetup(): Promise<void> {
    const setupRules = [...setupSelectedTopics];
    if (setupCustomTopic.trim()) {
      setupRules.push(setupCustomTopic.trim());
    }

    for (const pattern of new Set(setupRules)) {
      await window.dossier?.topicRules.create({
        pattern: pattern.trim(),
        matchMode: "KEYWORD",
        scope: "STORAGE_AND_SHARING",
        isEnabled: true
      });
    }

    topicsHandled = true;
    setupSelectedTopics = [];
    setupCustomTopic = "";
    await closeWelcomeIfComplete();
    await refresh();
  }

  async function skipTopicSetup(): Promise<void> {
    topicsHandled = true;
    setStatus("You can configure blocked topics anytime in Settings.");
    await closeWelcomeIfComplete();
  }

  function handleProfileKeydown(event: KeyboardEvent): void {
    if (isInTextInput()) return;
    if (editTargetId || deleteTargetId || commentTarget || showAddItem || showImport) return;

    const total = allProfileItems.length;
    if (total === 0) return;

    if (event.key === "j" || event.key === "ArrowDown") {
      event.preventDefault();
      focusedIndex = Math.min(focusedIndex + 1, total - 1);
      focusItem(focusedIndex);
    } else if (event.key === "k" || event.key === "ArrowUp") {
      event.preventDefault();
      focusedIndex = Math.max(focusedIndex - 1, 0);
      focusItem(focusedIndex);
    } else if (event.key === "n") {
      event.preventDefault();
      const nextPending = findNextPendingIndex(focusedIndex + 1);
      if (nextPending >= 0) {
        focusedIndex = nextPending;
        focusItem(focusedIndex);
      }
    } else if (event.key === "p") {
      event.preventDefault();
      const prevPending = findPrevPendingIndex(focusedIndex - 1);
      if (prevPending >= 0) {
        focusedIndex = prevPending;
        focusItem(focusedIndex);
      }
    }
  }

  function findNextPendingIndex(startFrom: number): number {
    for (let i = startFrom; i < allProfileItems.length; i++) {
      if (allProfileItems[i]?.state === "INFERENCE_PENDING") return i;
    }
    return -1;
  }

  function findPrevPendingIndex(startFrom: number): number {
    for (let i = startFrom; i >= 0; i--) {
      if (allProfileItems[i]?.state === "INFERENCE_PENDING") return i;
    }
    return -1;
  }

  function focusItem(index: number): void {
    const el = document.querySelector(`[data-profile-item="${index}"]`) as HTMLElement | null;
    el?.focus();
  }

  onMount(() => {
    void refresh();
  });

  onDestroy(() => {
    uiSettings.showingWelcome = false;
  });
</script>

<svelte:window on:keydown={handleProfileKeydown} />

<section class="profile-view">
  <div class="profile-content">

    {#if showWelcome}
      <!-- Welcome / First-time Setup -->
      <div class="welcome-section">
        <div class="welcome-header">
          <h1 class="welcome-title">Welcome to Dossier</h1>
          <p class="welcome-desc">
            Dossier learns about your goals, preferences, and boundaries to personalise AI interactions.
            Everything stays on your device. Let's start by setting up some privacy boundaries.
          </p>
        </div>

        {#if topicsHandled}
          <div class="welcome-card welcome-card-done">
            <div class="welcome-done-row">
              <h2 class="section-heading">Block sensitive topics</h2>
              <span class="done-badge">Done</span>
            </div>
          </div>
        {:else}
          <div class="welcome-card">
            <h2 class="section-heading">Block sensitive topics</h2>
            <p class="section-desc">
              Choose topics you'd like to keep private. Matching inferences will be suppressed,
              and blocked items require explicit consent overrides to share.
            </p>

            <div class="chips">
              {#each TOPIC_PRESETS as preset}
                <button
                  class="chip"
                  class:active={setupSelectedTopics.includes(preset)}
                  onclick={() => {
                    setupSelectedTopics = toggleId(setupSelectedTopics, preset);
                  }}
                >
                  {preset}
                </button>
              {/each}
            </div>

            <input
              class="text-input"
              bind:value={setupCustomTopic}
              placeholder="Add a custom blocked topic"
              onkeydown={(event) => {
                if (event.key === "Enter" && setupCustomTopic.trim()) {
                  setupSelectedTopics = [...setupSelectedTopics, setupCustomTopic.trim()];
                  setupCustomTopic = "";
                }
              }}
            />

            <div class="welcome-actions">
              <button class="btn-secondary" onclick={() => void skipTopicSetup()}>Skip for now</button>
              <button class="btn-primary" onclick={() => void completeTopicSetup()}>Continue</button>
            </div>
          </div>
        {/if}

        {#if importHandled}
          <div class="welcome-card welcome-card-done">
            <div class="welcome-done-row">
              <h2 class="section-heading">Import your data</h2>
              <span class="done-badge">Done</span>
            </div>
          </div>
        {:else}
          <div class="welcome-card">
            <h2 class="section-heading">Import your data</h2>
            <p class="section-desc">
              Import a Google Takeout export to discover what Dossier can learn about you.
              Or skip this and add items manually.
            </p>
            <div class="import-row">
              <button class="btn-secondary import-browse" onclick={() => void browseForImport()}>
                <IconFolderOpenRegular class="icon-18" />
                <span>Choose folder</span>
              </button>
              {#if importPath}
                <span class="import-path">{importPath}</span>
              {/if}
            </div>
            {#if importPath}
              <button class="btn-primary" onclick={() => void runImport()} disabled={isImporting}>
                {isImporting ? "Importing..." : "Run import"}
              </button>
            {/if}
            <div class="welcome-actions">
              <button class="btn-secondary" onclick={() => { importHandled = true; void closeWelcomeIfComplete(); }}>
                Skip — I'll add items manually
              </button>
            </div>
          </div>
        {/if}
      </div>
    {:else}
      <!-- Main Profile View -->
      <NotificationBanner
        count={pendingCount}
        onReviewAll={() => document.getElementById("pending-inferences")?.scrollIntoView({ behavior: "smooth", block: "start" })}
      />

      {#if statusMessage}
        <p class="status ok" aria-live="polite">{statusMessage}</p>
      {/if}
      {#if errorMessage}
        <p class="status err" role="alert">{errorMessage}</p>
      {/if}

      <!-- Profile Actions Bar -->
      <div class="profile-actions-bar">
        <button class="action-btn" onclick={() => { showAddItem = !showAddItem; showImport = false; }}>
          <IconPlusRegular class="icon-18" />
          <span>Add item</span>
        </button>
        <button class="action-btn" onclick={() => { showImport = !showImport; showAddItem = false; }}>
          <IconUploadSimpleRegular class="icon-18" />
          <span>Import</span>
        </button>
      </div>

      <!-- Collapsible Add Item Panel -->
      {#if showAddItem}
        <section class="inline-panel">
          <h3 class="panel-heading">Add a confirmed item</h3>
          <input
            class="text-input"
            type="text"
            bind:value={newItemText}
            placeholder="What would you like Dossier to know about you?"
            onkeydown={(event) => {
              if (event.key === "Enter") void addItem();
              if (event.key === "Escape") showAddItem = false;
            }}
          />
          <div class="form-row">
            <select class="text-input" bind:value={newItemType}>
              {#each ITEM_TYPES as itemType}
                <option value={itemType}>{itemType}</option>
              {/each}
            </select>
            <select
              class="text-input"
              value={newItemCategoryId ?? ""}
              onchange={(event) => {
                newItemCategoryId = categoryIdOrNull((event.currentTarget as HTMLSelectElement).value);
              }}
            >
              <option value="">No category</option>
              {#each categories as category}
                <option value={category.category_id}>{category.name}</option>
              {/each}
            </select>
          </div>
          {#if compartments.length > 0}
            <div class="compartment-pills">
              {#each compartments as compartment}
                <label class="compartment-pill">
                  <input
                    type="checkbox"
                    checked={newItemCompartmentIds.includes(compartment.compartment_id)}
                    onchange={() => {
                      newItemCompartmentIds = toggleId(newItemCompartmentIds, compartment.compartment_id);
                    }}
                  />
                  <span>{compartment.name}</span>
                </label>
              {/each}
            </div>
          {/if}
          <div class="panel-actions">
            <button class="btn-secondary" onclick={() => { showAddItem = false; }}>Cancel</button>
            <button class="btn-primary" onclick={() => void addItem()} disabled={!newItemText.trim()}>Save item</button>
          </div>
        </section>
      {/if}

      <!-- Collapsible Import Panel -->
      {#if showImport}
        <section class="inline-panel">
          <h3 class="panel-heading">Google Takeout import</h3>
          <div class="import-row">
            <button class="btn-secondary import-browse" onclick={() => void browseForImport()}>
              <IconFolderOpenRegular class="icon-18" />
              <span>Choose folder</span>
            </button>
            <input class="text-input flex-1" bind:value={importPath} placeholder="Or paste the folder path" />
          </div>
          <div class="panel-actions">
            <button class="btn-secondary" onclick={() => { showImport = false; }}>Cancel</button>
            <button class="btn-primary" onclick={() => void runImport()} disabled={isImporting || !importPath.trim()}>
              {isImporting ? "Importing..." : "Run import"}
            </button>
          </div>
        </section>
      {/if}

      <!-- Pending Inferences Section -->
      {#if pendingInferences.length > 0}
        <section id="pending-inferences">
          <h2 class="category-heading">Pending inferences</h2>
          <div role="list">
            {#each pendingInferences as inference, i (inference.item_id)}
              <div class="item-wrap" data-profile-item={i}>
                <InferenceItem
                  text={inference.text}
                  provenance={inference.provenance?.source_label ?? "System inference"}
                  why={inference.provenance?.why_dossier_thinks_this ?? null}
                  confidence={inference.provenance?.confidence ?? null}
                  focused={focusedIndex === i}
                  onConfirm={() => void confirmInference(inference.item_id)}
                  onDismiss={() => void dismissInference(inference.item_id)}
                  onComment={() => { commentTarget = inference; }}
                  onFocus={() => { focusedIndex = i; }}
                />

                {#if commentTarget?.item_id === inference.item_id}
                  <div class="comment-anchor">
                    <CommentPopout
                      itemText={commentTarget.text}
                      provenance={commentTarget.provenance?.source_label ?? "System inference"}
                      onSubmit={(comment) => void submitCorrection(comment)}
                      onClose={() => { commentTarget = null; }}
                    />
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        </section>
      {/if}

      <!-- Category-grouped Confirmed Items -->
      {#each categories as category (category.category_id)}
        {@const grouped = itemsByCategory()}
        {@const group = grouped.groups.get(category.category_id)}
        {#if group && group.confirmed.length > 0}
          <section id="category-{category.category_id}">
            <h2 class="category-heading">{category.name}</h2>
            <div role="list">
              {#each group.confirmed.sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at)) as item (item.item_id)}
                {@const itemIndex = allProfileItems.findIndex((p) => p.item_id === item.item_id)}
                <div data-profile-item={itemIndex}>
                  {#if editTargetId === item.item_id}
                    <div class="edit-panel">
                      <input class="text-input edit-input" bind:value={editText} onkeydown={(event) => {
                        if (event.key === "Enter") void saveEdit(item.item_id);
                        if (event.key === "Escape") cancelEdit();
                      }} />
                      <div class="form-row">
                        <select class="text-input" bind:value={editType}>
                          {#each ITEM_TYPES as itemType}
                            <option value={itemType}>{itemType}</option>
                          {/each}
                        </select>
                        <select
                          class="text-input"
                          value={editCategoryId ?? ""}
                          onchange={(event) => {
                            editCategoryId = categoryIdOrNull((event.currentTarget as HTMLSelectElement).value);
                          }}
                        >
                          <option value="">No category</option>
                          {#each categories as cat}
                            <option value={cat.category_id}>{cat.name}</option>
                          {/each}
                        </select>
                      </div>
                      {#if compartments.length > 0}
                        <div class="compartment-pills">
                          {#each compartments as compartment}
                            <label class="compartment-pill">
                              <input
                                type="checkbox"
                                checked={editCompartmentIds.includes(compartment.compartment_id)}
                                onchange={() => {
                                  editCompartmentIds = toggleId(editCompartmentIds, compartment.compartment_id);
                                }}
                              />
                              <span>{compartment.name}</span>
                            </label>
                          {/each}
                        </div>
                      {/if}
                      <div class="panel-actions">
                        <button class="btn-secondary" onclick={cancelEdit}>Cancel</button>
                        <button class="btn-primary" onclick={() => void saveEdit(item.item_id)}>Save</button>
                      </div>
                    </div>
                  {:else}
                    <ConfirmedItem
                      text={item.text}
                      itemType={item.item_type}
                      categoryName={categoryById.get(item.category_id ?? "")?.name ?? null}
                      compartmentNames={compartmentNames(item)}
                      isTopicBlocked={item.topic?.is_topic_blocked ?? false}
                      updatedAt={item.updated_at}
                      focused={focusedIndex === itemIndex}
                      onEdit={() => startEdit(item)}
                      onDelete={() => { deleteTargetId = item.item_id; }}
                      onFocus={() => { focusedIndex = itemIndex; }}
                    />
                  {/if}
                </div>
              {/each}
            </div>
          </section>
        {/if}
      {/each}

      <!-- Uncategorized Confirmed Items -->
      {@const grouped = itemsByCategory()}
      {#if grouped.uncategorized.confirmed.length > 0}
        <section id="category-uncategorized">
          <h2 class="category-heading">Uncategorized</h2>
          <div role="list">
            {#each grouped.uncategorized.confirmed.sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at)) as item (item.item_id)}
              {@const itemIndex = allProfileItems.findIndex((p) => p.item_id === item.item_id)}
              <div data-profile-item={itemIndex}>
                {#if editTargetId === item.item_id}
                  <div class="edit-panel">
                    <input class="text-input edit-input" bind:value={editText} onkeydown={(event) => {
                      if (event.key === "Enter") void saveEdit(item.item_id);
                      if (event.key === "Escape") cancelEdit();
                    }} />
                    <div class="form-row">
                      <select class="text-input" bind:value={editType}>
                        {#each ITEM_TYPES as itemType}
                          <option value={itemType}>{itemType}</option>
                        {/each}
                      </select>
                      <select
                        class="text-input"
                        value={editCategoryId ?? ""}
                        onchange={(event) => {
                          editCategoryId = categoryIdOrNull((event.currentTarget as HTMLSelectElement).value);
                        }}
                      >
                        <option value="">No category</option>
                        {#each categories as cat}
                          <option value={cat.category_id}>{cat.name}</option>
                        {/each}
                      </select>
                    </div>
                    {#if compartments.length > 0}
                      <div class="compartment-pills">
                        {#each compartments as compartment}
                          <label class="compartment-pill">
                            <input
                              type="checkbox"
                              checked={editCompartmentIds.includes(compartment.compartment_id)}
                              onchange={() => {
                                editCompartmentIds = toggleId(editCompartmentIds, compartment.compartment_id);
                              }}
                            />
                            <span>{compartment.name}</span>
                          </label>
                        {/each}
                      </div>
                    {/if}
                    <div class="panel-actions">
                      <button class="btn-secondary" onclick={cancelEdit}>Cancel</button>
                      <button class="btn-primary" onclick={() => void saveEdit(item.item_id)}>Save</button>
                    </div>
                  </div>
                {:else}
                  <ConfirmedItem
                    text={item.text}
                    itemType={item.item_type}
                    categoryName={null}
                    compartmentNames={compartmentNames(item)}
                    isTopicBlocked={item.topic?.is_topic_blocked ?? false}
                    updatedAt={item.updated_at}
                    focused={focusedIndex === itemIndex}
                    onEdit={() => startEdit(item)}
                    onDelete={() => { deleteTargetId = item.item_id; }}
                    onFocus={() => { focusedIndex = itemIndex; }}
                  />
                {/if}
              </div>
            {/each}
          </div>
        </section>
      {/if}

      <!-- Empty State -->
      {#if items.length === 0}
        <div class="empty-state">
          <IconUserRegular class="icon-32" />
          <p class="empty-heading">Your profile is empty</p>
          <p class="empty-desc">Add items manually or import data to get started.</p>
        </div>
      {/if}
    {/if}
  </div>
</section>

<!-- Delete Confirmation Dialog -->
{#if deleteTargetId}
  <ConfirmDialog
    title="Delete item"
    message="This permanently deletes the item and cannot be undone."
    confirmLabel="Delete permanently"
    danger={true}
    onConfirm={() => {
      if (deleteTargetId) void deleteItem(deleteTargetId);
    }}
    onCancel={() => { deleteTargetId = null; }}
  />
{/if}

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

  /* Welcome / Onboarding */
  .welcome-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
  }

  .welcome-header {
    text-align: center;
    padding: var(--space-8) 0;
  }

  .welcome-title {
    font-family: var(--font-display);
    font-size: 2rem;
    font-weight: 700;
    line-height: 1.2;
    letter-spacing: -0.01em;
    color: var(--text-primary);
    margin-bottom: var(--space-4);
  }

  .welcome-desc {
    font-family: var(--font-body);
    font-size: 0.9375rem;
    line-height: 1.6;
    color: var(--text-secondary);
    max-width: 480px;
    margin: 0 auto;
  }

  .welcome-card {
    border: 1px solid var(--border-subtle);
    background: var(--base-secondary);
    border-radius: var(--radius-md);
    padding: var(--space-6);
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .welcome-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-3);
    margin-top: var(--space-2);
  }

  .welcome-card-done {
    opacity: 0.6;
  }

  .welcome-done-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .done-badge {
    font-family: var(--font-body);
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--success);
    background: var(--success-subtle);
    border-radius: var(--radius-full);
    padding: var(--space-1) var(--space-3);
  }

  .section-heading {
    font-family: var(--font-display);
    font-size: 1.25rem;
    font-weight: 600;
    line-height: 1.3;
    color: var(--text-primary);
  }

  .section-desc {
    font-family: var(--font-body);
    font-size: 0.9375rem;
    line-height: 1.5;
    color: var(--text-secondary);
  }

  /* Chips */
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .chip {
    padding: var(--space-1) var(--space-3);
    border-radius: var(--radius-full);
    border: 1px solid var(--border);
    background: transparent;
    color: var(--text-primary);
    font-family: var(--font-body);
    font-size: 0.9375rem;
    transition: background-color var(--duration-standard) var(--ease-out),
                border-color var(--duration-standard) var(--ease-out);
  }

  .chip.active {
    background: var(--secondary-accent);
    color: var(--secondary-accent-text);
    border-color: var(--secondary-accent);
  }

  /* Status */
  .status {
    margin: 0 0 var(--space-4);
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-sm);
    font-family: var(--font-body);
    font-size: 0.9rem;
    animation: entrance-fade-up var(--duration-moderate) var(--ease-out);
  }

  .status.ok {
    color: var(--success);
    background: var(--success-subtle);
  }

  .status.err {
    color: var(--error);
    background: var(--error-subtle);
  }

  /* Profile Actions Bar */
  .profile-actions-bar {
    display: flex;
    gap: var(--space-2);
    margin-bottom: var(--space-6);
  }

  .action-btn {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 36px;
    padding: var(--space-1) var(--space-3);
    border-radius: var(--radius-sm);
    font-family: var(--font-body);
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--text-secondary);
    border: 1px solid var(--border-subtle);
    transition: background-color var(--duration-standard) var(--ease-out),
                color var(--duration-standard) var(--ease-out);
  }

  .action-btn:hover {
    background: var(--base-tertiary);
    color: var(--text-primary);
  }

  /* Inline Panels */
  .inline-panel {
    border: 1px solid var(--border-subtle);
    background: var(--base-secondary);
    border-radius: var(--radius-md);
    padding: var(--space-5);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    margin-bottom: var(--space-6);
    animation: entrance-fade-up var(--duration-moderate) var(--ease-out);
  }

  .panel-heading {
    font-family: var(--font-display);
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .panel-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
  }

  /* Form Elements */
  .text-input {
    min-height: 44px;
    border: 1px solid var(--border-subtle);
    background: var(--base-tertiary);
    color: var(--text-primary);
    border-radius: var(--radius-sm);
    padding: var(--space-3) var(--space-4);
    font-family: var(--font-body);
    font-size: 0.9375rem;
    line-height: 1.5;
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

  .flex-1 {
    flex: 1;
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3);
  }

  .import-row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .import-browse {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    white-space: nowrap;
  }

  .import-path {
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    color: var(--text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }

  .edit-input {
    width: 100%;
  }

  .compartment-pills {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .compartment-pill {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-1) var(--space-2);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-full);
    background: var(--base);
    font-family: var(--font-body);
    font-size: 0.82rem;
  }

  /* Buttons */
  .btn-primary {
    min-height: 44px;
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

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-secondary {
    min-height: 44px;
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: transparent;
    color: var(--text-primary);
    font-family: var(--font-body);
    font-size: 0.9375rem;
    font-weight: 500;
    transition: background-color var(--duration-standard) var(--ease-out);
  }

  .btn-secondary:hover {
    background: var(--base-tertiary);
  }

  /* Category Headings */
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

  .category-heading:first-of-type {
    margin-top: 0;
  }

  /* Item Wrap */
  .item-wrap {
    position: relative;
  }

  .comment-anchor {
    position: absolute;
    right: calc(-1 * (320px + var(--space-4)));
    top: 50%;
    transform: translateY(-50%);
    z-index: 20;
  }

  /* Edit Panel (inline) */
  .edit-panel {
    padding: var(--space-4);
    background: var(--base-tertiary);
    border-bottom: 1px solid var(--border-subtle);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    animation: entrance-fade-up var(--duration-standard) var(--ease-out);
  }

  /* Empty State */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-16) 0;
    color: var(--text-tertiary);
  }

  .empty-heading {
    font-family: var(--font-body);
    font-size: 1.0625rem;
    color: var(--text-secondary);
  }

  .empty-desc {
    font-family: var(--font-body);
    font-size: 0.9375rem;
    color: var(--text-tertiary);
  }

  @media (max-width: 1060px) {
    .comment-anchor {
      position: static;
      transform: none;
      margin-top: var(--space-2);
    }
  }

  @media (max-width: 860px) {
    .form-row {
      grid-template-columns: 1fr;
    }

    .import-row {
      flex-direction: column;
      align-items: stretch;
    }
  }
</style>
