<script lang="ts">
  import "../app.css";
  import { onMount } from "svelte";
  import Sidebar from "$lib/components/Sidebar.svelte";
  import Toaster from "$lib/components/Toaster.svelte";
  import TmdbKeyGate from "$lib/components/TmdbKeyGate.svelte";
  import WebUnlockGate from "$lib/components/WebUnlockGate.svelte";
  import UpdateAvailableDialog from "$lib/components/UpdateAvailableDialog.svelte";
  import EnrichmentProgressModal from "$lib/components/EnrichmentProgressModal.svelte";
  import PwaInstallPrompt from "$lib/components/PwaInstallPrompt.svelte";
  import RemoteConnectionGate from "$lib/components/RemoteConnectionGate.svelte";
  import { installBridge } from "$lib/desktop/bridge";
  import { uiSettings } from "$lib/state/ui-settings.svelte";
  import { updateCheck } from "$lib/state/update-check.svelte";
  import { recommendationDials } from "$lib/state/recommendation-dials.svelte";
  import { tmdbState } from "$lib/state/tmdb.svelte";
  import { migrateLegacyRatings } from "$lib/migrate-legacy";
  import { upgradeExistingRatings } from "$lib/enrich-ratings";
  import { preferences } from "$lib/state/preferences.svelte";
  import { goto } from "$app/navigation";
  import IconSidebarSimpleRegular from "phosphor-icons-svelte/IconSidebarSimpleRegular.svelte";
  import { listen } from "@tauri-apps/api/event";
  import QrScanner from "qr-scanner";

  let { children } = $props();
  /** Becomes true once TMDB is configured AND any legacy migration has
   *  finished — only then do we mount the app screens. */
  let migrationDone = $state(false);
  let migrating = $state(false);
  let showPwaInstallPrompt = $state(false);
  let remoteConnectionError = $state<string | null>(null);

  installBridge();

  /** In the web build the library is passphrase-locked: nothing can be
   * hydrated until the user unlocks it (WebUnlockGate). The desktop app has
   * no such gate, so it starts "unlocked". */
  const isWeb = typeof window !== "undefined" && window.dossier?.platform === "web";
  const isRemote = typeof window !== "undefined" && window.dossier?.platform === "remote";
  let webUnlocked = $state(!isWeb);

  const appReady = $derived(webUnlocked && tmdbState.configured === true && migrationDone);

  /** Hydrate settings + TMDB status. Deferred until the web library is
   * unlocked (or runs immediately on the desktop app). */
  async function bootHydrate(): Promise<void> {
    try {
      if (isRemote) {
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 5_000);
        try {
          const response = await fetch("/health", { cache: "no-store", credentials: "same-origin", signal: controller.signal });
          const payload = response.ok ? await response.json().catch(() => null) as { ok?: boolean } | null : null;
          if (!payload?.ok) throw new Error(`Host endpoint returned ${response.status}`);
        } finally {
          window.clearTimeout(timeout);
        }
      }
      await uiSettings.hydrateFromDesktop();
      await recommendationDials.hydrateFromDesktop();
      await tmdbState.refresh();
      remoteConnectionError = null;
    } catch (error) {
      if (!isRemote) throw error;
      remoteConnectionError = error instanceof Error ? error.message : String(error);
    }
  }

  async function warmOfflineQrScanner(): Promise<void> {
    try {
      await navigator.serviceWorker.ready;
      const engine = await QrScanner.createQrEngine();
      if (engine instanceof Worker) engine.terminate();
    } catch {
      // Reconnect still offers retry/manual entry if offline scanner warming
      // is unavailable in this browser.
    }
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

  // Once the screens are up and preferences have hydrated (whichever
  // route mounts first triggers that), kick off the ratings enrichment
  // backfill once per launch. Runs every launch (cheap no-op after the
  // first time, since detail() is disk-cached) — it always runs silently
  // in the background, and the progress modal only surfaces once we know
  // at least one rating actually needs (or got) richer data, so a launch
  // where everything's already up to date stays silent.
  let enrichmentStarted = false;
  let enrichmentVisible = $state(false);
  let enrichmentDone = $state(false);
  let enrichmentProcessed = $state(0);
  let enrichmentTotal = $state(0);
  let enrichmentUpgraded = $state(0);

  $effect(() => {
    if (appReady && preferences.loaded && !enrichmentStarted) {
      enrichmentStarted = true;
      void upgradeExistingRatings(6, (processed, total, upgraded) => {
        enrichmentProcessed = processed;
        enrichmentTotal = total;
        enrichmentUpgraded = upgraded;
        if (upgraded > 0) enrichmentVisible = true;
      }).then((result) => {
        enrichmentUpgraded = result.upgraded;
        enrichmentDone = true;
        if (result.upgraded > 0) enrichmentVisible = true;
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

    if (window.dossier?.platform !== "app" && "serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/service-worker.js").then(() => {
        if (isRemote) void warmOfflineQrScanner();
      });
    }

    const installRequested = new URLSearchParams(window.location.search).get("install-pwa") === "1";
    const isInstalled = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (window.__DOSSIER_REMOTE__ && installRequested && !isInstalled) showPwaInstallPrompt = true;

    // The auto-updater event only exists in the Tauri app.
    if (window.dossier?.platform !== "app") return;

    const unlistenUpdate = listen<{ version: string; current_version: string }>("update:available", (event) => {
      if (!uiSettings.autoUpdatesEnabled) return;
      const nextVersion = event.payload?.version;
      const currentVersion = event.payload?.current_version;
      if (!nextVersion || !currentVersion) return;
      if (uiSettings.skippedUpdateVersion && uiSettings.skippedUpdateVersion === nextVersion) return;
      updateCheck.available = { currentVersion, nextVersion };
    });

    return () => {
      void unlistenUpdate.then((fn) => fn());
    };
  });
</script>

<svelte:window on:keydown={handleGlobalKeydown} />

{#if remoteConnectionError}
  <RemoteConnectionGate message={remoteConnectionError} onRetry={bootHydrate} />
{:else if isWeb && !webUnlocked}
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

{#if updateCheck.available}
  <UpdateAvailableDialog
    currentVersion={updateCheck.available.currentVersion}
    nextVersion={updateCheck.available.nextVersion}
    variant={window.dossier?.platform === "web" ? "download" : "install"}
    onUpdateNow={() => {
      if (window.dossier?.platform === "web") {
        window.open("https://github.com/JamieM0/dossier/releases/latest", "_blank", "noopener");
        return;
      }
      void window.dossier?.updater.installAndRestart();
    }}
    onNotNow={async () => {
      updateCheck.dismiss();
    }}
    onSkipVersion={async (version) => {
      uiSettings.skippedUpdateVersion = version;
      await uiSettings.persist();
      updateCheck.dismiss();
    }}
  />
{/if}

{#if enrichmentVisible}
  <EnrichmentProgressModal
    processed={enrichmentProcessed}
    total={enrichmentTotal}
    done={enrichmentDone}
    upgraded={enrichmentUpgraded}
    onClose={() => (enrichmentVisible = false)}
  />
{/if}

{#if showPwaInstallPrompt}
  <PwaInstallPrompt onClose={() => {
    showPwaInstallPrompt = false;
    const url = new URL(window.location.href);
    url.searchParams.delete("install-pwa");
    window.history.replaceState({}, "", url);
  }} />
{/if}

<style>
  .app-shell {
    display: flex;
    width: 100%;
    max-width: 100vw;
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
    width: 100%;
    max-width: 100%;
    min-width: 0;
    background: var(--base);
    height: 100%;
    overflow-y: auto;
    overflow-x: hidden;
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

  @media (max-width: 760px) {
    .app-shell { height: 100dvh; }
    .content-area { padding-bottom: calc(66px + env(safe-area-inset-bottom)); }
    .sidebar-reopen { display: none; }
  }
</style>
