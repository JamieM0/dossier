<script lang="ts">
  import "../app.css";
  import { onMount } from "svelte";
  import Sidebar from "$lib/components/Sidebar.svelte";
  import Toaster from "$lib/components/Toaster.svelte";
  import UpdateAvailableDialog from "$lib/components/UpdateAvailableDialog.svelte";
  import { installDesktopApi } from "$lib/desktop/bridge";
  import { uiSettings } from "$lib/state/ui-settings.svelte";
  import { goto } from "$app/navigation";
  import IconSidebarSimpleRegular from "phosphor-icons-svelte/IconSidebarSimpleRegular.svelte";
  import { listen } from "@tauri-apps/api/event";

  let { children } = $props();
  let updateAvailable = $state<{ currentVersion: string; nextVersion: string } | null>(null);

  installDesktopApi();

  function isMod(event: KeyboardEvent): boolean {
    const isMac = navigator.platform.toUpperCase().includes("MAC");
    return isMac ? event.metaKey : event.ctrlKey;
  }

  function handleGlobalKeydown(event: KeyboardEvent): void {
    if (isMod(event) && event.key === "/") {
      event.preventDefault();
      uiSettings.toggleSidebar();
      return;
    }

    if (isMod(event) && event.key === ",") {
      event.preventDefault();
      void goto("/settings");
    }
  }

  onMount(() => {
    void uiSettings.hydrateFromDesktop();

    const unlistenUpdate = listen<{ version: string; current_version: string }>("update:available", (event) => {
      if (!uiSettings.autoUpdatesEnabled) return;
      const nextVersion = event.payload?.version;
      const currentVersion = event.payload?.current_version;
      if (!nextVersion || !currentVersion) return;
      if (uiSettings.skippedUpdateVersion && uiSettings.skippedUpdateVersion === nextVersion) return;
      updateAvailable = { currentVersion, nextVersion };
    });

    return () => {
      void unlistenUpdate.then((fn) => fn());
    };
  });
</script>

<svelte:window on:keydown={handleGlobalKeydown} />

<div class="app-shell">
  <Sidebar />

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

<Toaster />

{#if updateAvailable}
  <UpdateAvailableDialog
    currentVersion={updateAvailable.currentVersion}
    nextVersion={updateAvailable.nextVersion}
    onUpdateNow={() => {
      void window.dossier?.updater.installAndRestart();
    }}
    onNotNow={async () => {
      updateAvailable = null;
    }}
    onSkipVersion={async (version) => {
      uiSettings.skippedUpdateVersion = version;
      await uiSettings.persist();
      updateAvailable = null;
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
