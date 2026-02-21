<script lang="ts">
  import "../app.css";
  import { onMount } from "svelte";
  import BatchedConsentView from "$lib/components/BatchedConsentView.svelte";
  import ConsentModal from "$lib/components/ConsentModal.svelte";
  import Sidebar from "$lib/components/Sidebar.svelte";
  import { installDesktopApi } from "$lib/desktop/bridge";
  import { uiSettings } from "$lib/state/ui-settings.svelte";
  import { goto } from "$app/navigation";
  import type { Category, ConsentDecisionPayload, ConsentRequestView, ProfileItemView } from "$lib/types";
  import IconSidebarSimpleRegular from "phosphor-icons-svelte/IconSidebarSimpleRegular.svelte";

  let { children } = $props();
  let pendingCount = $state(0);
  let consentQueue = $state<{ id: string; serviceName: string; request: ConsentRequestView }[]>([]);
  let categories = $state<{ id: string; label: string; hasPending: boolean }[]>([]);

  installDesktopApi();

  async function refreshPending(): Promise<void> {
    const [items, cats] = await Promise.all([
      window.dossier?.profile.listItems() ?? Promise.resolve([]) as Promise<ProfileItemView[]>,
      window.dossier?.categories.list() ?? Promise.resolve([]) as Promise<Category[]>
    ]);

    pendingCount = items.filter((item: ProfileItemView) => item.state === "INFERENCE_PENDING").length;

    categories = (cats as Category[]).map((cat: Category) => {
      const hasPending = items.some(
        (item: ProfileItemView) => item.category_id === cat.category_id && item.state === "INFERENCE_PENDING"
      );
      return { id: cat.category_id, label: cat.name, hasPending };
    });
  }

  async function decideConsent(id: string, payload: ConsentDecisionPayload): Promise<void> {
    await window.dossier?.consent.decide(id, payload);
    consentQueue = consentQueue.filter((entry) => entry.id !== id);
    await refreshPending();
  }

  function defaultAllowPayload(request: ConsentRequestView): ConsentDecisionPayload {
    const allowed = request.preview_items
      .filter((item) => item.default_allowed)
      .map((item) => item.item_id);
    return {
      decision: "ALLOW",
      allowed_item_ids: allowed,
      blocked_item_overrides: []
    };
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

  onMount(() => {
    void uiSettings.hydrateFromDesktop();
    void refreshPending();

    const unsubscribe = window.dossier?.consent.onRequest((request) => {
      const payload = request as { consent_request_id?: string };
      const requestId = payload.consent_request_id;
      if (!requestId) return;

      void (async () => {
        const fullRequest = await window.dossier?.consent.get(requestId);
        if (!fullRequest) return;

        consentQueue = [
          ...consentQueue.filter((entry) => entry.id !== requestId),
          {
            id: requestId,
            serviceName: fullRequest.service?.display_name ?? "Perspectives",
            request: fullRequest
          }
        ];
        await refreshPending();
      })();
    });

    return () => {
      unsubscribe?.();
    };
  });
</script>

<svelte:window on:keydown={handleGlobalKeydown} />

<div class="app-shell">
  {#if !uiSettings.showingWelcome}
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
  {/if}

  <main class="content-area">
    {@render children?.()}
  </main>
</div>

{#if consentQueue.length === 1 && consentQueue[0]}
  <ConsentModal
    serviceName={consentQueue[0].serviceName}
    request={consentQueue[0].request}
    onAllow={(payload) => {
      const id = consentQueue[0]?.id;
      if (!id) return;
      void decideConsent(id, payload);
    }}
    onDecline={() => {
      const id = consentQueue[0]?.id;
      if (!id) return;
      void decideConsent(id, {
        decision: "DECLINE",
        allowed_item_ids: [],
        blocked_item_overrides: []
      });
    }}
  />
{:else if consentQueue.length > 1}
  <BatchedConsentView
    requests={consentQueue.map((entry) => ({
      id: entry.id,
      serviceName: entry.serviceName,
      summary: `${entry.request.preview_items.length} items requested`
    }))}
    onAllow={(id: string) => {
      const entry = consentQueue.find((candidate) => candidate.id === id);
      if (!entry) return;
      void decideConsent(id, defaultAllowPayload(entry.request));
    }}
    onDecline={(id: string) => void decideConsent(id, {
      decision: "DECLINE",
      allowed_item_ids: [],
      blocked_item_overrides: []
    })}
    onDeclineAll={() => {
      for (const entry of [...consentQueue]) {
        void decideConsent(entry.id, {
          decision: "DECLINE",
          allowed_item_ids: [],
          blocked_item_overrides: []
        });
      }
    }}
  />
{/if}

<style>
  .app-shell {
    display: flex;
    height: 100vh;
    overflow: hidden;
  }

  .content-area {
    flex: 1;
    min-width: 0;
    background: var(--base);
    height: 100%;
    overflow-y: auto;
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
