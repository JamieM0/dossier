<script lang="ts">
  import { page } from "$app/stores";
  import IconCompassRegular from "phosphor-icons-svelte/IconCompassRegular.svelte";
  import IconFingerprintRegular from "phosphor-icons-svelte/IconFingerprintRegular.svelte";
  import IconGraduationCapRegular from "phosphor-icons-svelte/IconGraduationCapRegular.svelte";
  import IconBooksRegular from "phosphor-icons-svelte/IconBooksRegular.svelte";
  import IconGearSixRegular from "phosphor-icons-svelte/IconGearSixRegular.svelte";
  import IconMagnifyingGlassRegular from "phosphor-icons-svelte/IconMagnifyingGlassRegular.svelte";
  import IconSidebarSimpleRegular from "phosphor-icons-svelte/IconSidebarSimpleRegular.svelte";
  import { uiSettings } from "$lib/state/ui-settings.svelte";
  import { motionPress } from "$lib/design/motion";

  const nav = [
    { href: "/", label: "Discover", icon: IconCompassRegular, exact: true },
    { href: "/teach", label: "Teach", icon: IconGraduationCapRegular, exact: false, aliases: ["/rate", "/refine"] },
    { href: "/dossier", label: "Your Dossier", icon: IconFingerprintRegular, exact: false },
    { href: "/library", label: "Library", icon: IconBooksRegular, exact: false }
  ] as const;

  function isActive(item: (typeof nav)[number], path: string): boolean {
    if (item.exact && path === item.href) return true;
    if (!item.exact && path.startsWith(item.href)) return true;
    return "aliases" in item && item.aliases.some((alias) => path.startsWith(alias));
  }
</script>

<aside class="sidebar" class:collapsed={uiSettings.sidebarCollapsed} aria-label="Primary navigation">
  <div class="sidebar-inner glass-panel">
    <header class="sidebar-header">
      <a class="brand" href="/" aria-label="Dossier home">
        <span class="brand-mark" aria-hidden="true">D</span>
        <span class="brand-copy"><strong>Dossier</strong><small>Private by design</small></span>
      </a>
      <button
        class="icon-button collapse-button"
        use:motionPress
        onclick={() => uiSettings.toggleSidebar()}
        aria-label="Collapse sidebar"
        title="Collapse sidebar (⌘/)"
      ><IconSidebarSimpleRegular class="icon-20" /></button>
    </header>

    <button class="search-trigger glass-control" use:motionPress onclick={() => window.dispatchEvent(new CustomEvent("dossier:command"))}>
      <IconMagnifyingGlassRegular class="icon-18" />
      <span>Search Dossier</span>
      <kbd>⌘K</kbd>
    </button>

    <nav class="sidebar-nav">
      <span class="nav-eyebrow">Your Dossier</span>
      {#each nav as item}
        {@const active = isActive(item, $page.url.pathname)}
        {@const Icon = item.icon}
        <a class="nav-item" class:active href={item.href} aria-current={active ? "page" : undefined} use:motionPress>
          <span class="active-lens" aria-hidden="true"></span>
          <Icon class="icon-20" />
          <span class="nav-label">{item.label}</span>
        </a>
      {/each}
      <a
        class="nav-item mobile-settings"
        class:active={$page.url.pathname.startsWith("/settings")}
        href="/settings"
        aria-current={$page.url.pathname.startsWith("/settings") ? "page" : undefined}
        use:motionPress
      >
        <span class="active-lens" aria-hidden="true"></span>
        <IconGearSixRegular class="icon-20" />
        <span class="nav-label">Settings</span>
      </a>
    </nav>

    <footer class="sidebar-footer">
      <a class="settings-link" href="/settings" class:active={$page.url.pathname.startsWith("/settings")} use:motionPress>
        <IconGearSixRegular class="icon-20" /><span>Settings</span>
      </a>
    </footer>
  </div>
</aside>

<style>
  .sidebar {
    width: var(--sidebar-width);
    min-width: var(--sidebar-width);
    height: 100%;
    padding: 10px 0 10px 10px;
    flex-shrink: 0;
    transition: width 260ms var(--ease-in-out), min-width 260ms var(--ease-in-out), padding 260ms var(--ease-in-out);
    overflow: hidden;
    position: relative;
    z-index: 30;
  }
  .sidebar.collapsed { width: 0; min-width: 0; padding-inline: 0; }
  .sidebar-inner {
    width: calc(var(--sidebar-width) - 10px);
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border-radius: 20px;
    border: 1px solid color-mix(in srgb, var(--border) 62%, transparent);
    background: color-mix(in srgb, var(--base-secondary) 78%, transparent);
    box-shadow: inset 0 1px 0 color-mix(in srgb, white 46%, transparent), 0 18px 45px color-mix(in srgb, var(--text-primary) 7%, transparent);
    backdrop-filter: blur(24px) saturate(1.35);
    -webkit-backdrop-filter: blur(24px) saturate(1.35);
  }
  .sidebar-header { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:18px 16px 14px; }
  .brand { display:flex; align-items:center; gap:10px; min-width:0; }
  .brand-mark { width:34px; height:34px; border-radius:12px; display:grid; place-items:center; font-family:var(--font-display); font-weight:700; color:var(--primary-accent-text); background:linear-gradient(145deg,var(--primary-accent),color-mix(in srgb,var(--primary-accent) 72%,var(--secondary-accent))); box-shadow:inset 0 1px 0 color-mix(in srgb,white 36%,transparent),var(--shadow-sm); }
  .brand-copy { display:flex; flex-direction:column; min-width:0; }
  .brand-copy strong { font-family:var(--font-display); font-size:1.02rem; line-height:1.1; }
  .brand-copy small { color:var(--text-tertiary); font-size:.62rem; letter-spacing:.03em; margin-top:3px; }
  .icon-button { width:36px; height:36px; display:grid; place-items:center; border-radius:11px; color:var(--text-secondary); }
  .icon-button:hover { background:color-mix(in srgb,var(--base) 52%,transparent); color:var(--text-primary); }
  .search-trigger { margin:4px 12px 14px; min-height:42px; padding:0 11px; display:flex; align-items:center; gap:9px; border-radius:13px; border:1px solid color-mix(in srgb,var(--border) 56%,transparent); background:color-mix(in srgb,var(--base) 54%,transparent); color:var(--text-secondary); text-align:left; }
  .search-trigger span { flex:1; font-size:.78rem; }
  .search-trigger kbd { font-size:.58rem; padding:2px 5px; color:var(--text-tertiary); background:color-mix(in srgb,var(--base-secondary) 72%,transparent); }
  .sidebar-nav { flex:1; overflow-y:auto; padding:8px 9px; }
  .nav-eyebrow { display:block; padding:0 10px 8px; color:var(--text-tertiary); text-transform:uppercase; letter-spacing:.11em; font-size:.61rem; font-weight:600; }
  .nav-item { position:relative; display:flex; align-items:center; gap:11px; min-height:46px; padding:0 12px; border-radius:14px; color:var(--text-secondary); font-size:.88rem; margin-bottom:3px; isolation:isolate; }
  .nav-item :global(svg), .nav-label { position:relative; z-index:1; }
  .nav-item:hover { color:var(--text-primary); }
  .nav-item:hover .active-lens { opacity:.6; }
  .active-lens { position:absolute; inset:0; border-radius:inherit; background:color-mix(in srgb,var(--base) 62%,transparent); border:1px solid color-mix(in srgb,var(--border) 42%,transparent); opacity:0; box-shadow:inset 0 1px 0 color-mix(in srgb,white 36%,transparent); transition:opacity 160ms var(--ease-out); }
  .nav-item.active { color:var(--text-primary); font-weight:600; }
  .nav-item.active .active-lens { opacity:1; background:linear-gradient(120deg,color-mix(in srgb,var(--primary-accent) 11%,var(--base) 66%),color-mix(in srgb,var(--base) 58%,transparent)); border-color:color-mix(in srgb,var(--primary-accent) 28%,var(--border)); }
  .nav-item.active::before { content:""; position:absolute; left:4px; width:3px; height:18px; border-radius:3px; background:var(--primary-accent); z-index:2; box-shadow:0 0 12px color-mix(in srgb,var(--primary-accent) 55%,transparent); }
  .mobile-settings { display:none; }
  .sidebar-footer { padding:10px; border-top:1px solid color-mix(in srgb,var(--border-subtle) 74%,transparent); }
  .settings-link { display:flex; align-items:center; gap:10px; padding:10px 11px; border-radius:12px; color:var(--text-secondary); font-size:.82rem; }
  .settings-link:hover,.settings-link.active { color:var(--text-primary); background:color-mix(in srgb,var(--base) 54%,transparent); }

  @media (max-width:760px) {
    .sidebar { position:fixed; z-index:80; inset:auto 0 0; width:100%; min-width:100%; height:calc(58px + env(safe-area-inset-bottom)); padding:0; pointer-events:none; }
    .sidebar.collapsed { width:100%; min-width:100%; padding:0; }
    .sidebar-inner { width:100%; height:calc(58px + env(safe-area-inset-bottom)); padding-bottom:env(safe-area-inset-bottom); border-radius:18px 18px 0 0; border-inline:0; border-bottom:0; pointer-events:auto; background:color-mix(in srgb,var(--base-secondary) 84%,transparent); box-shadow:inset 0 1px 0 color-mix(in srgb,white 42%,transparent),0 -8px 26px color-mix(in srgb,var(--text-primary) 8%,transparent); }
    .sidebar-header,.search-trigger,.nav-eyebrow,.sidebar-footer { display:none; }
    .sidebar-nav { display:grid; grid-template-columns:repeat(5,1fr); gap:2px; padding:4px max(5px,env(safe-area-inset-left)); overflow:visible; }
    .nav-item { min-width:0; height:50px; min-height:50px; padding:3px 2px 2px; margin:0; flex-direction:column; justify-content:center; gap:1px; border-radius:14px; font-size:.57rem; font-weight:500; color:var(--text-tertiary); }
    .mobile-settings { display:flex; }
    .nav-item :global(svg) { font-size:20px; }
    .nav-item.active::before { left:50%; top:auto; bottom:1px; width:16px; height:2px; transform:translateX(-50%); }
    .nav-item.active .active-lens { background:color-mix(in srgb,var(--primary-accent) 10%,var(--base) 54%); }
  }
</style>
