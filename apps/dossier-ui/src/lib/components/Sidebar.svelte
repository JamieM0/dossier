<script lang="ts">
  import { page } from "$app/stores";
  import IconGearSixRegular from "phosphor-icons-svelte/IconGearSixRegular.svelte";
  import IconSidebarSimpleRegular from "phosphor-icons-svelte/IconSidebarSimpleRegular.svelte";
  import IconSparkleRegular from "phosphor-icons-svelte/IconSparkleRegular.svelte";
  import IconHeartRegular from "phosphor-icons-svelte/IconHeartRegular.svelte";
  import IconScalesRegular from "phosphor-icons-svelte/IconScalesRegular.svelte";
  import IconFilmReelRegular from "phosphor-icons-svelte/IconFilmReelRegular.svelte";
  import IconFilmStripRegular from "phosphor-icons-svelte/IconFilmStripRegular.svelte";
  import IconTelevisionRegular from "phosphor-icons-svelte/IconTelevisionRegular.svelte";
  import { uiSettings } from "$lib/state/ui-settings.svelte";
  import { catalogueMode, type CatalogueMode } from "$lib/state/catalogue-mode.svelte";

  const nav = [
    { href: "/", label: "Recommendations", icon: IconSparkleRegular, exact: true },
    { href: "/rate", label: "Rate", icon: IconHeartRegular, exact: false },
    { href: "/refine", label: "Refine", icon: IconScalesRegular, exact: false },
    { href: "/library", label: "Library", icon: IconFilmReelRegular, exact: false },
    { href: "/settings", label: "Settings", icon: IconGearSixRegular, exact: false }
  ] as const;
</script>

<aside
  class="sidebar"
  class:collapsed={uiSettings.sidebarCollapsed}
  aria-label="Primary navigation"
>
  <div class="sidebar-inner">
    <div class="sidebar-header">
      <div class="sidebar-header-row">
        <span class="wordmark">Dossier</span>
        <button
          class="icon-button"
          onclick={() => uiSettings.toggleSidebar()}
          aria-label={uiSettings.sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <IconSidebarSimpleRegular class="icon-20" />
        </button>
      </div>
    </div>

    <div class="sidebar-divider"></div>

    <div class="mode-switch" role="group" aria-label="Catalogue mode">
      {#each [
        { id: "movies" as CatalogueMode, label: "Movies", Icon: IconFilmStripRegular },
        { id: "tv" as CatalogueMode, label: "TV", Icon: IconTelevisionRegular }
      ] as opt}
        {@const isActive = catalogueMode.mode === opt.id}
        <button
          type="button"
          class="mode-btn"
          class:active={isActive}
          aria-label={opt.label}
          aria-pressed={isActive}
          title={opt.label}
          onclick={() => catalogueMode.set(opt.id)}
        >
          <opt.Icon class="icon-20" />
        </button>
      {/each}
    </div>

    <nav class="sidebar-nav">
      {#each nav as item}
        {@const active = item.exact ? $page.url.pathname === item.href : $page.url.pathname.startsWith(item.href)}
        {@const Icon = item.icon}
        <a
          class="nav-item"
          class:active
          href={item.href}
          aria-current={active ? "page" : undefined}
        >
          <Icon class="icon-20" />
          <span class="nav-label">{item.label}</span>
        </a>
      {/each}
    </nav>
  </div>
</aside>

<style>
  .sidebar {
    width: var(--sidebar-width);
    min-width: var(--sidebar-width);
    height: 100%;
    flex-shrink: 0;
    background: var(--base-secondary);
    border-right: 1px solid var(--border-subtle);
    transition: width var(--duration-moderate) var(--ease-in-out),
                min-width var(--duration-moderate) var(--ease-in-out);
    overflow: hidden;
    overscroll-behavior: none;
  }

  .sidebar.collapsed {
    width: 0;
    min-width: 0;
    border-right: none;
  }

  .sidebar-inner {
    width: var(--sidebar-width);
    height: 100%;
    display: flex;
    flex-direction: column;
    overscroll-behavior: none;
  }

  .sidebar-header {
    padding: var(--space-5);
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .sidebar-header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .wordmark {
    font-family: var(--font-display);
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--text-primary);
    user-select: none;
  }

  .icon-button {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-sm);
    color: var(--text-secondary);
    transition: background-color var(--duration-standard) var(--ease-out),
                color var(--duration-standard) var(--ease-out);
    padding: 4px;
  }

  .icon-button:hover {
    background: var(--base-tertiary);
    color: var(--text-primary);
  }

  .sidebar-divider {
    height: 1px;
    background: var(--border-subtle);
    margin: 0 0 var(--space-3);
  }

  .mode-switch {
    display: flex;
    gap: var(--space-2);
    padding: 0 var(--space-4) var(--space-3);
  }

  .mode-btn {
    width: 44px;
    height: 44px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-md);
    background: var(--base-tertiary);
    border: 1px solid var(--border-subtle);
    color: var(--text-secondary);
    cursor: pointer;
    transition: background-color var(--duration-standard) var(--ease-out),
                color var(--duration-standard) var(--ease-out),
                border-color var(--duration-standard) var(--ease-out);
  }

  .mode-btn:hover {
    color: var(--text-primary);
    background: var(--base);
  }

  .mode-btn.active {
    background: color-mix(in srgb, var(--primary-accent) 14%, var(--base-tertiary));
    border-color: var(--primary-accent);
    color: var(--primary-accent);
  }

  .sidebar-nav {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-2) 0;
    overscroll-behavior: none;
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    color: var(--text-secondary);
    font-family: var(--font-body);
    font-size: 0.9375rem;
    font-weight: 400;
    border-left: 3px solid transparent;
    transition: background-color var(--duration-standard) var(--ease-out),
                color var(--duration-standard) var(--ease-out);
    text-decoration: none;
  }

  .nav-item:hover {
    background: var(--base-tertiary);
    color: var(--text-primary);
  }

  .nav-item.active {
    background: var(--base-tertiary);
    color: var(--text-primary);
    border-left-color: var(--primary-accent);
    font-weight: 500;
  }

  .nav-label {
    flex: 1;
  }

  @media (max-width: 760px) {
    .sidebar {
      position: fixed;
      z-index: 80;
      inset: auto 0 0;
      width: 100%;
      min-width: 100%;
      height: calc(66px + env(safe-area-inset-bottom));
      border: 0;
      border-top: 1px solid color-mix(in srgb, var(--border) 72%, transparent);
      background: color-mix(in srgb, var(--base-secondary) 88%, transparent);
      backdrop-filter: blur(18px) saturate(1.25);
      -webkit-backdrop-filter: blur(18px) saturate(1.25);
      box-shadow: 0 -8px 28px color-mix(in srgb, var(--text-primary) 8%, transparent);
      padding-bottom: env(safe-area-inset-bottom);
    }
    .sidebar.collapsed { width: 100%; min-width: 100%; }
    .sidebar-inner { width: 100%; height: 66px; }
    .sidebar-header, .sidebar-divider, .mode-switch { display: none; }
    .sidebar-nav { display: grid; grid-template-columns: repeat(5, 1fr); padding: 5px 6px 4px; overflow: visible; }
    .nav-item { min-width: 0; height: 56px; padding: 0; justify-content: center; border: 0; border-radius: 13px; position: relative; color: var(--text-tertiary); }
    .nav-item :global(svg) { font-size: 23px; }
    .nav-item:hover { background: transparent; }
    .nav-item.active { background: color-mix(in srgb, var(--primary-accent) 10%, transparent); color: var(--primary-accent); border: 0; }
    .nav-item.active::after { content: ""; position: absolute; bottom: 4px; width: 4px; height: 4px; border-radius: 50%; background: currentColor; }
    .nav-label { display: none; }
  }
</style>
