<script lang="ts">
  const isMac = typeof navigator !== "undefined" && navigator.platform.toUpperCase().includes("MAC");
  const mod = isMac ? "Cmd" : "Ctrl";

  type Shortcut = { keys: string[]; description: string };
  type ShortcutGroup = { title: string; shortcuts: Shortcut[] };

  const groups: ShortcutGroup[] = [
    {
      title: "Global",
      shortcuts: [
        { keys: [mod, "/"], description: "Toggle sidebar" },
        { keys: [mod, "1"], description: "Navigate to Profile" },
        { keys: [mod, "2"], description: "Navigate to Connections" },
        { keys: [mod, "3"], description: "Navigate to Settings" },
        { keys: [mod, "Shift", "C"], description: "Navigate to Chat" },
        { keys: ["?"], description: "Open Help" }
      ]
    },
    {
      title: "Profile View",
      shortcuts: [
        { keys: ["J", "↓"], description: "Move to next item" },
        { keys: ["K", "↑"], description: "Move to previous item" },
        { keys: ["N"], description: "Jump to next pending inference" },
        { keys: ["P"], description: "Jump to previous pending inference" },
        { keys: ["Y", "A"], description: "Confirm focused inference" },
        { keys: ["D"], description: "Dismiss focused inference" },
        { keys: ["C"], description: "Comment on focused inference" },
        { keys: ["E"], description: "Edit focused confirmed item" },
        { keys: ["Enter", "Space"], description: "Expand/collapse complex inference" },
        { keys: ["Escape"], description: "Close popout or cancel edit" }
      ]
    },
    {
      title: "Chat",
      shortcuts: [
        { keys: ["Enter"], description: "Send message" },
        { keys: ["Shift", "Enter"], description: "New line" },
        { keys: [mod, "Enter"], description: "Send message (always)" },
        { keys: ["Escape"], description: "Blur input (if empty)" }
      ]
    },
    {
      title: "Consent Modal",
      shortcuts: [
        { keys: ["Tab"], description: "Move between Decline and Allow" },
        { keys: ["Enter"], description: "Activate focused button" },
        { keys: ["Escape"], description: "Decline and close" }
      ]
    }
  ];

  let activeTab = $state<"shortcuts" | "getting-started" | "about">("shortcuts");
</script>

<section class="help-view">
  <div class="help-content">
    <h1 class="page-heading">Help</h1>

    <div class="help-tabs" role="tablist">
      <button
        class="tab"
        class:active={activeTab === "shortcuts"}
        onclick={() => (activeTab = "shortcuts")}
        role="tab"
        id="tab-shortcuts"
        aria-selected={activeTab === "shortcuts"}
        aria-controls="panel-shortcuts"
      >
        Keyboard Shortcuts
      </button>
      <button
        class="tab"
        class:active={activeTab === "getting-started"}
        onclick={() => (activeTab = "getting-started")}
        role="tab"
        id="tab-getting-started"
        aria-selected={activeTab === "getting-started"}
        aria-controls="panel-getting-started"
      >
        Getting Started
      </button>
      <button
        class="tab"
        class:active={activeTab === "about"}
        onclick={() => (activeTab = "about")}
        role="tab"
        id="tab-about"
        aria-selected={activeTab === "about"}
        aria-controls="panel-about"
      >
        About Dossier
      </button>
    </div>

    {#if activeTab === "shortcuts"}
      <div class="shortcuts-view" role="tabpanel" id="panel-shortcuts" aria-labelledby="tab-shortcuts">
        {#each groups as group}
          <section class="shortcut-group">
            <h3 class="group-heading">{group.title}</h3>
            <div class="shortcut-list">
              {#each group.shortcuts as shortcut}
                <div class="shortcut-row">
                  <div class="shortcut-keys">
                    {#each shortcut.keys as key, i}
                      {#if i > 0}<span class="key-separator">/</span>{/if}
                      <kbd>{key}</kbd>
                    {/each}
                  </div>
                  <span class="shortcut-desc">{shortcut.description}</span>
                </div>
              {/each}
            </div>
          </section>
        {/each}
      </div>
    {:else if activeTab === "getting-started"}
      <div class="prose-section" role="tabpanel" id="panel-getting-started" aria-labelledby="tab-getting-started">
        <h3 class="section-title">Welcome to Dossier</h3>
        <p>
          Dossier is a privacy-first identity platform that stores structured personal context
          to personalise AI interactions. It learns about your goals, preferences, risk tolerance,
          communication style, and topic boundaries.
        </p>
        <h3 class="section-title">How it works</h3>
        <p>
          Start by importing data (like Google Takeout) or chatting with Dossier directly.
          The system generates inferences about you that appear in your Profile as pending items.
          Review each inference: confirm what's accurate, dismiss what's not, and add comments
          to refine what Dossier understands about you.
        </p>
        <h3 class="section-title">Your data stays yours</h3>
        <p>
          All data is stored locally and encrypted. When external services request access to
          parts of your profile, you approve or decline each request individually. Nothing
          is shared without your explicit consent.
        </p>
      </div>
    {:else}
      <div class="prose-section" role="tabpanel" id="panel-about" aria-labelledby="tab-about">
        <h3 class="section-title">About</h3>
        <p>
          Dossier is an open-source privacy-first identity platform. Your profile data is
          encrypted locally and never leaves your device without your consent.
        </p>
        <div class="about-meta">
          <div class="meta-row">
            <span class="meta-label">Version</span>
            <span class="meta-value mono">0.1.0</span>
          </div>
        </div>
      </div>
    {/if}
  </div>
</section>

<style>
  .help-view {
    min-height: 100vh;
    background: var(--base);
  }

  .help-content {
    max-width: var(--content-max-width);
    margin: 0 auto;
    padding: var(--space-10) var(--space-8) var(--space-16);
  }

  .page-heading {
    font-family: var(--font-display);
    font-size: 1.5rem;
    font-weight: 600;
    line-height: 1.3;
    letter-spacing: -0.01em;
    color: var(--text-primary);
    margin-bottom: var(--space-6);
  }

  .help-tabs {
    display: flex;
    gap: var(--space-1);
    margin-bottom: var(--space-8);
    border-bottom: 1px solid var(--border-subtle);
  }

  .tab {
    padding: var(--space-3) var(--space-4);
    font-family: var(--font-body);
    font-size: 0.9375rem;
    font-weight: 400;
    color: var(--text-secondary);
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    transition: color var(--duration-standard) var(--ease-out),
                border-color var(--duration-standard) var(--ease-out);
  }

  .tab:hover {
    color: var(--text-primary);
  }

  .tab.active {
    color: var(--text-primary);
    font-weight: 500;
    border-bottom-color: var(--primary-accent);
  }

  .shortcuts-view {
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
  }

  .group-heading {
    font-family: var(--font-display);
    font-size: 0.75rem;
    font-weight: 600;
    line-height: 1.3;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-tertiary);
    margin-bottom: var(--space-4);
  }

  .shortcut-list {
    display: flex;
    flex-direction: column;
  }

  .shortcut-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    padding: var(--space-2) 0;
    border-bottom: 1px solid var(--border-subtle);
  }

  .shortcut-row:last-child {
    border-bottom: none;
  }

  .shortcut-keys {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    flex-shrink: 0;
  }

  .key-separator {
    font-family: var(--font-body);
    font-size: 0.75rem;
    color: var(--text-tertiary);
    padding: 0 2px;
  }

  .shortcut-desc {
    font-family: var(--font-body);
    font-size: 0.9375rem;
    line-height: 1.5;
    color: var(--text-secondary);
    text-align: right;
  }

  .prose-section {
    max-width: 560px;
  }

  .section-title {
    font-family: var(--font-display);
    font-size: 1.25rem;
    font-weight: 600;
    line-height: 1.3;
    color: var(--text-primary);
    margin-bottom: var(--space-3);
    margin-top: var(--space-8);
  }

  .section-title:first-child {
    margin-top: 0;
  }

  .prose-section p {
    font-family: var(--font-body);
    font-size: 0.9375rem;
    line-height: 1.6;
    color: var(--text-secondary);
    margin-bottom: var(--space-4);
  }

  .about-meta {
    margin-top: var(--space-6);
    padding: var(--space-4);
    background: var(--base-secondary);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
  }

  .meta-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .meta-label {
    font-family: var(--font-body);
    font-size: 0.8125rem;
    color: var(--text-tertiary);
  }

  .meta-value {
    font-family: var(--font-body);
    font-size: 0.8125rem;
    color: var(--text-primary);
  }

  .meta-value.mono {
    font-family: var(--font-mono);
  }
</style>
