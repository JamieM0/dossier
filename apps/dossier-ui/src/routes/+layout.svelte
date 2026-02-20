<script lang="ts">
  import "../app.css";
  import BatchedConsentView from "$lib/components/BatchedConsentView.svelte";
  import ConsentModal from "$lib/components/ConsentModal.svelte";
  import Sidebar from "$lib/components/Sidebar.svelte";
  import { uiSettings } from "$lib/state/ui-settings.svelte";
  import { goto } from "$app/navigation";
  import type { ProfileItem } from "$lib/types";
  import IconSidebarSimpleRegular from "phosphor-icons-svelte/IconSidebarSimpleRegular.svelte";

  let { children } = $props();
  let pendingCount = $state(0);
  let consentQueue = $state<{ id: string; serviceName: string; requestedItems: string[] }[]>([]);

  const categories = [
    { id: "personal", label: "Personal", hasPending: false },
    { id: "professional", label: "Professional", hasPending: false },
    { id: "interests", label: "Interests", hasPending: false },
    { id: "communication", label: "Communication", hasPending: false }
  ];

  async function refreshPending(): Promise<void> {
    const items: ProfileItem[] = (await window.dossier?.profile.listItems()) ?? [];
    pendingCount = items.filter((item) => item.state === "INFERENCE_PENDING").length;
  }

  function isMod(event: KeyboardEvent): boolean {
    const isMac = navigator.platform.toUpperCase().includes("MAC");
    return isMac ? event.metaKey : event.ctrlKey;
  }

  function isInTextInput(): boolean {
    const el = document.activeElement;
    if (!el) return false;
    const tag = el.tagName.toLowerCase();
    return tag === "input" || tag === "textarea" || (el as HTMLElement).isContentEditable;
  }

  function handleGlobalKeydown(event: KeyboardEvent): void {
    if (isMod(event) && event.key === "/") {
      event.preventDefault();
      uiSettings.toggleSidebar();
      return;
    }

    if (isMod(event) && event.key === "1") {
      event.preventDefault();
      void goto("/profile");
      return;
    }

    if (isMod(event) && event.key === "2") {
      event.preventDefault();
      void goto("/connections");
      return;
    }

    if (isMod(event) && event.key === "3") {
      event.preventDefault();
      void goto("/settings");
      return;
    }

    if (isMod(event) && event.shiftKey && event.key.toLowerCase() === "c") {
      event.preventDefault();
      void goto("/chat");
      return;
    }

    if (event.key === "?" && !isInTextInput()) {
      event.preventDefault();
      void goto("/help");
      return;
    }
  }

  $effect(() => {
    void uiSettings.hydrateFromDesktop();
    void refreshPending();

    const unsubscribe = window.dossier?.consent.onRequest((request) => {
      const payload = request as { consent_request_id: string; preview_items?: { text: string }[] };
      consentQueue = [
        ...consentQueue,
        {
          id: payload.consent_request_id,
          serviceName: "Perspectives",
          requestedItems: payload.preview_items?.map((item) => item.text) ?? []
        }
      ];
      void refreshPending();
    });

    return () => {
      unsubscribe?.();
    };
  });
</script>

<svelte:window on:keydown={handleGlobalKeydown} />

<div class="app-shell">
  <Sidebar {pendingCount} {categories} />

  {#if uiSettings.sidebarCollapsed}
    <button
      class="sidebar-reopen"
      onclick={() => uiSettings.toggleSidebar()}
      aria-label="Open sidebar"
    >
      <IconSidebarSimpleRegular class="icon-20" />
    </button>
  {/if}

  <main class="content-area">
    {@render children?.()}
  </main>
</div>

{#if consentQueue.length === 1 && consentQueue[0]}
  <ConsentModal
    serviceName={consentQueue[0].serviceName}
    requestedItems={consentQueue[0].requestedItems}
    onAllow={() => (consentQueue = consentQueue.filter((entry) => entry.id !== consentQueue[0]?.id))}
    onDecline={() => (consentQueue = consentQueue.filter((entry) => entry.id !== consentQueue[0]?.id))}
  />
{:else if consentQueue.length > 1}
  <BatchedConsentView
    requests={consentQueue.map((entry) => ({
      id: entry.id,
      serviceName: entry.serviceName,
      summary: `${entry.requestedItems.length} items requested`
    }))}
    onAllow={(id: string) => (consentQueue = consentQueue.filter((entry) => entry.id !== id))}
    onDecline={(id: string) => (consentQueue = consentQueue.filter((entry) => entry.id !== id))}
    onDeclineAll={() => (consentQueue = [])}
  />
{/if}

<style>
  .app-shell {
    display: flex;
    min-height: 100vh;
  }

  .content-area {
    flex: 1;
    min-width: 0;
    background: var(--base);
    min-height: 100vh;
    position: relative;
  }

  .sidebar-reopen {
    position: fixed;
    top: var(--space-5);
    left: var(--space-4);
    z-index: 9;
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-sm);
    background: var(--base-secondary);
    color: var(--text-secondary);
    border: 1px solid var(--border-subtle);
    box-shadow: var(--shadow-sm);
    transition: background-color var(--duration-standard) var(--ease-out),
                color var(--duration-standard) var(--ease-out);
  }

  .sidebar-reopen:hover {
    background: var(--base-tertiary);
    color: var(--text-primary);
  }
</style>
