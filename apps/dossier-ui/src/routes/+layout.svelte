<script lang="ts">
  import "../app.css";
  import { onMount } from "svelte";
  import Sidebar from "$lib/components/Sidebar.svelte";
  import Toaster from "$lib/components/Toaster.svelte";
  import TmdbKeyGate from "$lib/components/TmdbKeyGate.svelte";
  import WebUnlockGate from "$lib/components/WebUnlockGate.svelte";
  import UpdateAvailableDialog from "$lib/components/UpdateAvailableDialog.svelte";
  import { installBridge } from "$lib/desktop/bridge";
  import { uiSettings } from "$lib/state/ui-settings.svelte";
  import { tmdbState } from "$lib/state/tmdb.svelte";
  import { migrateLegacyRatings } from "$lib/migrate-legacy";
  import { goto } from "$app/navigation";
  import IconSidebarSimpleRegular from "phosphor-icons-svelte/IconSidebarSimpleRegular.svelte";
  import { listen } from "@tauri-apps/api/event";

  let { children } = $props();
  let updateAvailable = $state<{ currentVersion: string; nextVersion: string } | null>(null);
  /** Becomes true once TMDB is configured AND any legacy migration has
   *  finished — only then do we mount the app screens. */
  let migrationDone = $state(false);
  let migrating = $state(false);

  installBridge();

  /** In the web build the library is passphrase-locked: nothing can be
   * hydrated until the user unlocks it (WebUnlockGate). The desktop app has
   * no such gate, so it starts "unlocked". */
  const isWeb = typeof window !== "undefined" && window.dossier?.platform === "web";
  let webUnlocked = $state(!isWeb);

  const appReady = $derived(webUnlocked && tmdbState.configured === true && migrationDone);

  /** Hydrate settings + TMDB status. Deferred until the web library is
   * unlocked (or runs immediately on the desktop app). */
  async function bootHydrate(): Promise<void> {
    await uiSettings.hydrateFromDesktop();
    await tmdbState.refresh();

    // The web build has no push-based updater event, so it checks GitHub
    // Releases itself once settings are hydrated (so autoUpdatesEnabled /
    // skippedUpdateVersion are known). Same opt-in/opt-out as the desktop app.
    if (window.dossier?.platform === "web") {
      void checkWebUpdate();
    }
  }

  async function checkWebUpdate(): Promise<void> {
    if (!uiSettings.autoUpdatesEnabled) return;
    const update = await window.dossier?.updater.checkForUpdate();
    if (!update) return;
    if (uiSettings.skippedUpdateVersion === update.version) return;
    updateAvailable = { currentVersion: update.currentVersion, nextVersion: update.version };
  }

  function onWebUnlocked(): void {
    webUnlocked = true;
    void bootHydrate();
  }

  // When TMDB becomes configured (first launch via the gate, or already
  // configured on boot), run the one-time legacy migration before the
  // screens mount and hydrate preferences.
  $effect(() => {
    if (webUnlocked && tmdbState.configured === true && !migrationDone && !migrating) {
      migrating = true;
      void migrateLegacyRatings()
        .catch(() => null)
        .finally(() => {
          migrationDone = true;
          migrating = false;
        });
    }
  });

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
    // Desktop: hydrate now. Web: wait for WebUnlockGate → onWebUnlocked().
    if (webUnlocked) void bootHydrate();

    // The auto-updater event only exists in the Tauri app.
    if (window.dossier?.platform !== "app") return;

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

{#if isWeb && !webUnlocked}
  <WebUnlockGate onUnlocked={onWebUnlocked} />
{:else if tmdbState.configured === false}
  <TmdbKeyGate />
{:else if !appReady}
  <div class="boot">
    <div class="spinner" aria-hidden="true"></div>
    <p>{migrating ? "Migrating your ratings…" : "Loading…"}</p>
  </div>
{:else}
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
{/if}

<Toaster />

{#if updateAvailable}
  <UpdateAvailableDialog
    currentVersion={updateAvailable.currentVersion}
    nextVersion={updateAvailable.nextVersion}
    variant={window.dossier?.platform === "web" ? "download" : "install"}
    onUpdateNow={() => {
      if (window.dossier?.platform === "web") {
        window.open("https://github.com/JamieM0/dossier/releases/latest", "_blank", "noopener");
        return;
      }
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

  .boot {
    height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-4);
    color: var(--text-tertiary);
    background: var(--base);
  }
  .spinner {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 3px solid var(--border-subtle);
    border-top-color: var(--accent);
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

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
