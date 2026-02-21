<script lang="ts">
  import { page } from "$app/stores";
  import IconChatRegular from "phosphor-icons-svelte/IconChatRegular.svelte";
  import IconGearSixRegular from "phosphor-icons-svelte/IconGearSixRegular.svelte";
  import IconListMagnifyingGlassRegular from "phosphor-icons-svelte/IconListMagnifyingGlassRegular.svelte";
  import IconLinkSimpleRegular from "phosphor-icons-svelte/IconLinkSimpleRegular.svelte";
  import IconQuestionRegular from "phosphor-icons-svelte/IconQuestionRegular.svelte";
  import IconSidebarSimpleRegular from "phosphor-icons-svelte/IconSidebarSimpleRegular.svelte";
  import IconUserRegular from "phosphor-icons-svelte/IconUserRegular.svelte";
  import { uiSettings } from "$lib/state/ui-settings.svelte";

  let {
    pendingCount = 0,
    categories = []
  } = $props<{
    pendingCount?: number;
    categories?: { id: string; label: string; hasPending: boolean }[];
  }>();

  const nav = [
    { href: "/profile", label: "Profile", icon: IconUserRegular },
    { href: "/connections", label: "Connections", icon: IconLinkSimpleRegular },
    { href: "/audit", label: "Audit", icon: IconListMagnifyingGlassRegular },
    { href: "/settings", label: "Settings", icon: IconGearSixRegular }
  ] as const;

  let isProfileActive = $derived($page.url.pathname.startsWith("/profile"));
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

      <a class="chat-button" href="/chat">
        <IconChatRegular class="icon-20" />
        <span>Chat</span>
      </a>
    </div>

    <div class="sidebar-divider"></div>

    <nav class="sidebar-nav">
      {#each nav as item}
        {@const active = $page.url.pathname.startsWith(item.href)}
        {@const Icon = item.icon}
        <a
          class="nav-item"
          class:active
          href={item.href}
          aria-current={active ? "page" : undefined}
        >
          <Icon class="icon-20" />
          <span class="nav-label">{item.label}</span>
          {#if item.href === "/profile" && pendingCount > 0}
            <span class="pending-dot" aria-label="{pendingCount} pending inferences"></span>
          {/if}
        </a>
      {/each}

      {#if isProfileActive && categories.length > 0}
        <div class="category-subnav">
          {#each categories as category}
            <a
              class="category-item"
              href="/profile#category-{category.id}"
              class:active={false}
            >
              <span>{category.label}</span>
              {#if category.hasPending}
                <span class="pending-dot"></span>
              {/if}
            </a>
          {/each}
        </div>
      {/if}
    </nav>

    <footer class="sidebar-footer">
      <a class="nav-item" href="/help">
        <IconQuestionRegular class="icon-20" />
        <span class="nav-label">Help</span>
      </a>
    </footer>
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

  .chat-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    min-height: 44px;
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

  .chat-button:hover {
    background: var(--primary-accent-hover);
    box-shadow: var(--shadow-md);
  }

  .chat-button:active {
    box-shadow: var(--shadow-sm);
    transform: translateY(1px);
  }

  .sidebar-divider {
    height: 1px;
    background: var(--border-subtle);
    margin: 0 0 var(--space-3);
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

  .pending-dot {
    width: 8px;
    height: 8px;
    border-radius: var(--radius-full);
    background: var(--secondary-accent);
    flex-shrink: 0;
  }

  .category-subnav {
    padding: var(--space-1) 0;
  }

  .category-item {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-4);
    padding-left: var(--space-8);
    color: var(--text-secondary);
    font-family: var(--font-body);
    font-size: 0.8125rem;
    font-weight: 400;
    border-left: 3px solid transparent;
    transition: background-color var(--duration-standard) var(--ease-out),
                color var(--duration-standard) var(--ease-out);
    text-decoration: none;
  }

  .category-item:hover {
    background: var(--base-tertiary);
    color: var(--text-primary);
  }

  .category-item.active {
    color: var(--text-primary);
    border-left-color: var(--primary-accent);
  }

  .category-item span:first-child {
    flex: 1;
  }

  .sidebar-footer {
    border-top: 1px solid var(--border-subtle);
    padding: var(--space-3) 0;
  }
</style>
