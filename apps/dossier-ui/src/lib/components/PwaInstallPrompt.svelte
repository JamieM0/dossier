<script lang="ts">
  import { onMount } from "svelte";
  import IconDownloadSimpleRegular from "phosphor-icons-svelte/IconDownloadSimpleRegular.svelte";
  import IconDotsThreeRegular from "phosphor-icons-svelte/IconDotsThreeRegular.svelte";
  import IconExportRegular from "phosphor-icons-svelte/IconExportRegular.svelte";
  import IconPlusSquareRegular from "phosphor-icons-svelte/IconPlusSquareRegular.svelte";

  type BeforeInstallPromptEvent = Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
  };

  let { onClose } = $props<{ onClose: () => void }>();

  let deferredPrompt = $state<BeforeInstallPromptEvent | null>(null);
  let installing = $state(false);
  const isIos = typeof navigator !== "undefined" && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
  const isAndroid = typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);

  function onBeforeInstallPrompt(event: Event): void {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
  }

  async function install(): Promise<void> {
    if (!deferredPrompt) return;
    installing = true;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    deferredPrompt = null;
    installing = false;
    if (choice.outcome === "accepted") onClose();
  }

  onMount(() => {
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    const onInstalled = () => onClose();
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  });
</script>

<div class="backdrop" role="presentation" onclick={(event) => event.target === event.currentTarget && onClose()}>
  <dialog class="prompt" open aria-labelledby="pwa-install-title">
    <span class="icon"><IconDownloadSimpleRegular class="icon-24" /></span>
    <p class="eyebrow">Device approved</p>
    <h2 id="pwa-install-title">Install Dossier</h2>
    {#if isIos}
      <p>Keep your library one tap away. In Safari:</p>
      <ol class="steps">
        <li><span class="step-icon"><IconDotsThreeRegular /></span><span>Tap <strong>More</strong> (<strong>•••</strong>), then <span class="inline-icon"><IconExportRegular /></span> <strong>Share</strong>. If Share is already in the toolbar, tap it directly.</span></li>
        <li><span class="step-icon"><IconPlusSquareRegular /></span><span>Choose <strong>Add to Home Screen</strong>.</span></li>
        <li><span class="step-number">3</span><span>Turn on <strong>Open as Web App</strong>, then tap <strong>Add</strong>.</span></li>
      </ol>
    {:else if deferredPrompt}
      <p>Keep your private library one tap away, with a full-screen experience that feels at home on your phone.</p>
    {:else if isAndroid}
      <p>In Chrome, tap <strong>More</strong> (<strong>⋮</strong>), then <strong>Add to home screen</strong> → <strong>Install</strong>.</p>
    {:else}
      <p>Use your browser’s <strong>Install app</strong> or <strong>Add to home screen</strong> command to keep Dossier one tap away.</p>
    {/if}
    <div class="actions">
      <button class="secondary" onclick={onClose}>Not now</button>
      {#if !isIos}
        {#if deferredPrompt}<button class="primary" onclick={() => void install()} disabled={installing}>{installing ? "Installing…" : "Install app"}</button>{:else}<button class="primary" onclick={onClose}>Got it</button>{/if}
      {:else}
        <button class="primary" onclick={onClose}>Got it</button>
      {/if}
    </div>
  </dialog>
</div>

<style>
  .backdrop { position: fixed; inset: 0; display: grid; place-items: end center; padding: var(--space-4); background: color-mix(in srgb, var(--text-primary) 28%, transparent); backdrop-filter: var(--blur-backdrop); -webkit-backdrop-filter: var(--blur-backdrop); z-index: 130; }
  .prompt { width: min(100%, 420px); margin: 0; padding: var(--space-6); border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--base); box-shadow: var(--shadow-xl); animation: enter var(--duration-spring) var(--ease-spring); }
  .icon { width: 44px; height: 44px; display: grid; place-items: center; border-radius: var(--radius-md); color: var(--primary-accent-text); background: var(--primary-accent); }
  .eyebrow { margin-top: var(--space-4); color: var(--success); font-size: .75rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
  h2 { margin-top: var(--space-1); font-family: var(--font-display); font-size: 1.5rem; line-height: 1.2; }
  p:not(.eyebrow) { margin-top: var(--space-3); color: var(--text-secondary); line-height: 1.55; }
  .steps { display: flex; flex-direction: column; gap: var(--space-3); margin-top: var(--space-4); }
  .steps li { display: grid; grid-template-columns: 30px minmax(0, 1fr); align-items: start; gap: var(--space-3); color: var(--text-secondary); line-height: 1.5; }
  .step-icon, .step-number { width: 30px; height: 30px; display: grid; place-items: center; border-radius: 9px; background: var(--base-secondary); color: var(--primary-accent); font-weight: 700; }
  .step-icon :global(svg), .inline-icon :global(svg) { width: 18px; height: 18px; }
  .inline-icon { display: inline-flex; vertical-align: -.23em; }
  .actions { display: flex; justify-content: flex-end; gap: var(--space-3); margin-top: var(--space-6); }
  button { min-height: 44px; padding: var(--space-2) var(--space-4); border-radius: var(--radius-sm); font: 650 .9375rem var(--font-body); }
  .primary { background: var(--primary-accent); color: var(--primary-accent-text); }
  .primary:disabled { opacity: .55; }
  .secondary { color: var(--text-primary); border: 1px solid var(--border); background: transparent; }
  @keyframes enter { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
</style>
