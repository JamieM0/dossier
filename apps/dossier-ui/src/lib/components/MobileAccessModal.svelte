<script lang="ts">
  import { onMount } from "svelte";
  import IconShieldCheckRegular from "phosphor-icons-svelte/IconShieldCheckRegular.svelte";
  import IconGlobeHemisphereWestRegular from "phosphor-icons-svelte/IconGlobeHemisphereWestRegular.svelte";
  import IconWifiHighRegular from "phosphor-icons-svelte/IconWifiHighRegular.svelte";
  import IconArrowLeftRegular from "phosphor-icons-svelte/IconArrowLeftRegular.svelte";
  import IconCheckCircleRegular from "phosphor-icons-svelte/IconCheckCircleRegular.svelte";
  import IconSpinnerGapRegular from "phosphor-icons-svelte/IconSpinnerGapRegular.svelte";
  import IconDeviceMobileRegular from "phosphor-icons-svelte/IconDeviceMobileRegular.svelte";
  import IconCheckRegular from "phosphor-icons-svelte/IconCheckRegular.svelte";
  import IconXRegular from "phosphor-icons-svelte/IconXRegular.svelte";
  import IconCaretDownRegular from "phosphor-icons-svelte/IconCaretDownRegular.svelte";
  import type { RemoteAccessStatus, RemoteTransport } from "$lib/types";

  let { onConfigured, onClose } = $props<{
    onConfigured: (status: RemoteAccessStatus) => void;
    onClose: () => void;
  }>();

  const options = [
    { id: "lan" as const, title: "Local Network (LAN)", eyebrow: "Recommended", Icon: IconWifiHighRegular, summary: "Connect directly while both devices share a network.", pros: ["Quick and simple", "Free"], cons: ["Only works when both devices are connected to the same network"] },
    { id: "tailscale" as const, title: "Tailscale Funnel", eyebrow: "Away from home", Icon: IconShieldCheckRegular, summary: "Secure access through a private Tailscale endpoint.", pros: ["Works anywhere", "End-to-end encrypted"], cons: ["Tailscale setup and sign-in"] },
    { id: "direct" as const, title: "Direct HTTPS", eyebrow: "Advanced", Icon: IconGlobeHemisphereWestRegular, summary: "Connect through your own public domain and router.", pros: ["No relay provider", "Full transport control"], cons: ["Public DNS, certificates, and port forwarding"] }
  ];

  const tailscaleDnsUrl = "https://console.tailscale.com/admin/dns";
  const tailscaleNodeAttributesUrl = "https://console.tailscale.com/admin/acls/visual/node-attributes";
  const tailscaleMachinesUrl = "https://console.tailscale.com/admin/machines";

  let selected = $state<RemoteTransport | null>(null);
  let status = $state<RemoteAccessStatus | null>(null);
  let busy = $state(false);
  let localError = $state("");
  let qrSvg = $state("");
  let certificateQrSvg = $state("");
  let hostname = $state("");
  let email = $state("");
  let port = $state(48732);
  let advancedOpen = $state(false);
  let tailscaleGuideStep = $state<1 | 2>(1);
  let pollTimer: ReturnType<typeof setTimeout> | null = null;

  const selectedOption = $derived(options.find((option) => option.id === selected) ?? null);
  const isWorking = $derived(status && !["idle", "ready", "error", "verifying"].includes(status.phase));

  onMount(() => {
    void refresh();
    return () => { if (pollTimer) clearTimeout(pollTimer); };
  });

  $effect(() => {
    const url = status?.pairingUrl;
    if (!url) { qrSvg = ""; return; }
    void renderQr(url, 236).then((svg) => { qrSvg = svg; });
  });

  $effect(() => {
    const url = status?.certificateUrl;
    if (!url) { certificateQrSvg = ""; return; }
    void renderQr(url, 150).then((svg) => { certificateQrSvg = svg; });
  });

  async function renderQr(value: string, width: number): Promise<string> {
    const { toString } = await import("qrcode");
    return toString(value, { type: "svg", width, margin: 1, color: { dark: "#282522", light: "#ffffff" } });
  }

  async function refresh(): Promise<void> {
    if (!window.dossier?.remoteAccess) return;
    try {
      receive(await window.dossier.remoteAccess.status());
    } catch (error) {
      localError = message(error);
    }
  }

  function receive(next: RemoteAccessStatus): void {
    status = next;
    if (next.transport) selected = next.transport;
    if (next.phase === "ready") onConfigured(next);
    if (!["idle", "ready", "error"].includes(next.phase) || next.pendingDevices.length > 0 || Boolean(next.pairingUrl)) schedulePoll();
  }

  function schedulePoll(): void {
    if (pollTimer) clearTimeout(pollTimer);
    pollTimer = setTimeout(() => void refresh(), 1000);
  }

  async function start(): Promise<void> {
    if (!selected || !window.dossier?.remoteAccess) return;
    busy = true;
    localError = "";
    try {
      const options = selected === "direct" ? { hostname, email, port } : {};
      receive(await window.dossier.remoteAccess.start(selected, options));
    } catch (error) {
      localError = message(error);
    } finally {
      busy = false;
    }
  }

  async function openTailscalePage(url: string): Promise<void> {
    try {
      await window.dossier?.remoteAccess?.openAuthorizationUrl(url);
    } catch (error) {
      localError = message(error);
    }
  }

  function selectRoute(transport: RemoteTransport): void {
    selected = transport;
    if (transport === "tailscale") tailscaleGuideStep = 1;
  }

  function continueToFunnelPermission(): void {
    tailscaleGuideStep = 2;
  }

  async function verifyDirect(): Promise<void> {
    if (!window.dossier?.remoteAccess) return;
    busy = true;
    localError = "";
    try { receive(await window.dossier.remoteAccess.verify()); }
    catch (error) { localError = message(error); }
    finally { busy = false; }
  }

  async function approve(id: string): Promise<void> {
    if (!window.dossier?.remoteAccess) return;
    busy = true;
    try { receive(await window.dossier.remoteAccess.approve(id)); }
    catch (error) { localError = message(error); }
    finally { busy = false; }
  }

  async function revoke(id: string): Promise<void> {
    if (!window.dossier?.remoteAccess) return;
    busy = true;
    try { receive(await window.dossier.remoteAccess.revoke(id)); }
    catch (error) { localError = message(error); }
    finally { busy = false; }
  }

  async function newPairingCode(): Promise<void> {
    if (!window.dossier?.remoteAccess) return;
    busy = true;
    try { receive(await window.dossier.remoteAccess.newPairingCode()); }
    catch (error) { localError = message(error); }
    finally { busy = false; }
  }

  async function changeRoute(): Promise<void> {
    if (status && status.phase !== "idle") await window.dossier?.remoteAccess?.stop();
    status = null;
    selected = null;
    localError = "";
    qrSvg = "";
    tailscaleGuideStep = 1;
  }

  function message(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  function onKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape") onClose();
  }
</script>

<svelte:window onkeydown={onKeydown} />

<div class="backdrop" role="presentation" onclick={(event) => event.target === event.currentTarget && onClose()}>
  <div class="modal" role="dialog" aria-modal="true" aria-labelledby="mobile-access-title">
    {#if !selected || !selectedOption}
      <header>
        <p class="kicker">Mobile access</p>
        <h2 id="mobile-access-title">How should your phone reach this PC?</h2>
        <p class="intro">Your library stays on this computer. No route is enabled until Dossier has created and checked its endpoint.</p>
      </header>
      <div class="options">
        {#each options.filter((option) => option.id !== "direct") as option}
          <button class="option" class:recommended={option.id === "lan"} onclick={() => selectRoute(option.id)}>
            <span class="option-icon"><option.Icon class="icon-32" /></span>
            <span class="option-copy">
              <span class="option-top"><strong>{option.title}</strong><small>{option.eyebrow}</small></span>
              <span class="summary">{option.summary}</span>
              <span class="tradeoffs">
                {#each option.pros as benefit}<span class="tradeoff benefit"><IconCheckRegular /><span>{benefit}</span></span>{/each}
                {#each option.cons as limitation}<span class="tradeoff limitation"><IconXRegular /><span>{limitation}</span></span>{/each}
              </span>
            </span>
          </button>
        {/each}
      </div>
      <div class="advanced">
        <button class="advanced-toggle" aria-expanded={advancedOpen} onclick={() => (advancedOpen = !advancedOpen)}>
          <IconCaretDownRegular class={advancedOpen ? "open" : ""} /> Advanced
        </button>
        {#if advancedOpen}
          {@const option = options.find((candidate) => candidate.id === "direct")!}
          <button class="option advanced-option" onclick={() => selectRoute(option.id)}>
            <span class="option-icon"><option.Icon class="icon-32" /></span>
            <span class="option-copy"><span class="option-top"><strong>{option.title}</strong><small>{option.eyebrow}</small></span><span class="summary">{option.summary}</span><span class="tradeoffs">{#each option.pros as benefit}<span class="tradeoff benefit"><IconCheckRegular /><span>{benefit}</span></span>{/each}{#each option.cons as limitation}<span class="tradeoff limitation"><IconXRegular /><span>{limitation}</span></span>{/each}</span></span>
          </button>
        {/if}
      </div>
      <footer><span>New phones remain blocked until you approve them here on the host PC.</span><button class="secondary" onclick={onClose}>Cancel</button></footer>
    {:else}
      <button class="back" onclick={() => void changeRoute()} disabled={busy}><IconArrowLeftRegular /> Choose another route</button>
      <div class="route-heading"><span class="option-icon"><selectedOption.Icon class="icon-32" /></span><div><p class="kicker">{selectedOption.eyebrow}</p><h2 id="mobile-access-title">{selectedOption.title}</h2><p class="intro">{selectedOption.summary}</p></div></div>

      {#if !status || status.phase === "idle"}
        <section class="setup-panel">
          {#if selected === "tailscale"}
            <div class="guide-progress" aria-label="Tailscale setup progress">
              <span class:active={tailscaleGuideStep === 1}><b>1</b> DNS &amp; HTTPS</span>
              <i></i>
              <span class:active={tailscaleGuideStep === 2}><b>2</b> Funnel access</span>
              <i></i>
              <span><b>3</b> Authorize Dossier</span>
            </div>
            {#if tailscaleGuideStep === 1}
              <div class="guide-copy">
                <h3>Enable secure Tailscale addresses</h3>
                <p>Open Tailscale’s DNS settings, then enable both <strong>MagicDNS</strong> and <strong>HTTPS Certificates</strong>.</p>
              </div>
              <div class="guide-actions">
                <button class="secondary" onclick={() => void openTailscalePage(tailscaleDnsUrl)}>Open DNS settings again</button>
                <button class="primary" onclick={continueToFunnelPermission}>I’ve enabled both — continue</button>
              </div>
            {:else}
              <div class="guide-copy">
                <h3>Allow Dossier to use Funnel</h3>
                <p>Open <strong>Access controls → Node attributes</strong>. Add a node attribute targeting <strong>All users and devices</strong>, select the <strong>funnel</strong> attribute, then save it.</p>
              </div>
              <div class="guide-actions">
                <button class="secondary" onclick={() => void openTailscalePage(tailscaleNodeAttributesUrl)}>Open Node attributes</button>
                <button class="primary" onclick={() => void start()} disabled={busy}>{busy ? "Starting…" : "I’ve added Funnel — authorize Dossier"}</button>
              </div>
            {/if}
          {:else if selected === "lan"}
            <p>Dossier will start an HTTPS endpoint on this PC's private network and immediately show the phone pairing code.</p>
            <div class="notice"><strong>One-time certificate step</strong><span>Your phone must trust Dossier's local certificate before the PWA can install and behave as a secure native-style app.</span></div>
          {:else}
            <div class="fields"><label><span>Public hostname</span><input bind:value={hostname} placeholder="dossier.example.com" autocomplete="off" /></label><label><span>ACME email <small>(optional)</small></span><input bind:value={email} type="email" placeholder="you@example.com" autocomplete="email" /></label><label><span>Local HTTPS port</span><input bind:value={port} type="number" min="1024" max="65535" /></label></div>
            <p>Dossier obtains and renews the certificate. Point the hostname at your public IP and forward public TCP 443 to the local port above.</p>
          {/if}
          {#if selected !== "tailscale"}<button class="primary" onclick={() => void start()} disabled={busy || (selected === "direct" && !hostname.trim())}>{busy ? "Starting…" : selected === "direct" ? "Start Direct HTTPS" : "Start local access"}</button>{/if}
        </section>
      {:else if status.phase === "ready"}
        <section class="ready-grid">
          <div class="qr-panel">
            <div class="success"><IconCheckCircleRegular /><span><strong>Endpoint ready</strong><small>{status.origin}</small></span></div>
            {#if status.certificateUrl && certificateQrSvg}<div class="certificate-step"><strong>1. Trust this PC</strong><div class="certificate-qr" aria-label="LAN certificate QR code">{@html certificateQrSvg}</div><span>Scan, install “Dossier LAN Root”, then enable full trust in your phone's certificate settings.</span></div>{/if}
            {#if qrSvg && status.pairingUrl}<strong class="pair-label">{status.certificateUrl ? "2. Pair the phone" : "Pair the phone"}</strong><div class="qr" aria-label="Phone pairing QR code">{@html qrSvg}</div><p class="scan">Scan with your phone's camera.</p>{:else if status.pendingDevices.length > 0}<div class="paired"><IconDeviceMobileRegular /><strong>Approval requested</strong><span>Approve the waiting phone on this host PC.</span></div>{:else}<div class="paired"><IconDeviceMobileRegular /><strong>Phone approved</strong><span>Create a fresh, single-use code to add another phone.</span><button class="secondary compact" onclick={() => void newPairingCode()} disabled={busy}>Add another device</button></div>{/if}
          </div>
          <div class="approval-panel">
            <h3>Device approval</h3>
            {#if status.pendingDevices.length === 0}<p>Waiting for the phone to scan the code…</p>{:else}{#each status.pendingDevices as device}<div class="device"><span><strong>{device.name}</strong><small>{device.browser} · requesting access now</small></span><button class="primary compact" onclick={() => void approve(device.id)} disabled={busy}>Approve</button></div>{/each}{/if}
            {#if status.devices.length > 0}<h3>Approved devices</h3>{#each status.devices as device}<div class="device approved"><span><strong>{device.name}</strong><small>{device.browser}</small></span><button class="secondary compact" onclick={() => void revoke(device.id)} disabled={busy}>Revoke</button></div>{/each}{/if}
          </div>
        </section>
      {:else}
        <section class="progress-panel">
          <IconSpinnerGapRegular class="spinner" />
          <div><h3>{status.phase === "error" ? "Setup stopped" : status.phase === "verifying" ? "Verify the endpoint" : "Setting up the route"}</h3><p>{status.message}</p></div>
          {#if status.authUrl || status.approvalUrl}<button class="secondary" onclick={() => void window.dossier?.remoteAccess?.openAuthorizationUrl(status.approvalUrl ?? status.authUrl!)}>Open Tailscale again</button>{/if}
          {#if selected === "tailscale" && status.phase === "enabling_funnel"}
            <div class="notice troubleshooting"><strong>Dossier is checking automatically</strong><span>You can leave this screen open. If Tailscale labels the Dossier machine “Duplicate node key”, close every other Dossier instance and restart this setup.</span></div>
            <button class="secondary troubleshooting-action" onclick={() => void openTailscalePage(tailscaleMachinesUrl)}>Open Tailscale Machines</button>
          {/if}
          {#if selected === "direct" && status.phase === "verifying"}<div class="notice"><strong>Router target</strong><span>Forward public TCP 443 to this PC on port {status.localPort}.</span></div><button class="primary" onclick={() => void verifyDirect()} disabled={busy}>{busy ? "Checking…" : "Verify and show pairing code"}</button>{/if}
        </section>
      {/if}

      {#if localError || status?.error}<p class="error" role="alert">{localError || status?.error}</p>{/if}
      <footer class="route-footer"><span>{status?.phase === "ready" ? "The route is active only while Dossier is running on this PC." : "Dossier will not mark this route active until its endpoint is ready."}</span><button class="secondary" onclick={onClose}>{status?.phase === "ready" ? "Done" : "Close"}</button></footer>
    {/if}
  </div>
</div>

<style>
  .backdrop{position:fixed;inset:0;z-index:120;display:grid;place-items:center;padding:24px;background:color-mix(in srgb,var(--text-primary) 38%,transparent);backdrop-filter:blur(18px)}.modal{width:min(920px,100%);max-height:min(800px,calc(100dvh - 32px));overflow:auto;background:var(--base);border:1px solid var(--border);border-radius:22px;box-shadow:var(--shadow-xl);padding:32px}header{max-width:680px}.kicker{color:var(--secondary-accent);text-transform:uppercase;letter-spacing:.14em;font-size:.7rem;font-weight:700;margin-bottom:8px}h2{font-family:var(--font-display);font-size:clamp(1.5rem,3vw,2.1rem);line-height:1.12;letter-spacing:-.025em}.intro{color:var(--text-secondary);margin-top:10px;line-height:1.55}.options{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:28px 0 24px}.option{min-width:0;text-align:left;display:flex;flex-direction:column;gap:16px;padding:20px;border:1px solid var(--border-subtle);border-radius:16px;background:var(--base-secondary);color:var(--text-primary);transition:transform 160ms,border-color 160ms}.option:hover{transform:translateY(-3px);border-color:var(--primary-accent)}.option.recommended{background:linear-gradient(150deg,color-mix(in srgb,var(--primary-accent) 10%,var(--base-secondary)),var(--base-secondary));border-color:color-mix(in srgb,var(--primary-accent) 45%,var(--border))}.option-icon{width:52px;height:52px;display:grid;place-items:center;border-radius:14px;background:var(--base);color:var(--primary-accent);box-shadow:var(--shadow-sm);flex:0 0 auto}.option-copy,.option-top,.tradeoffs{display:flex;flex-direction:column}.option-copy{gap:10px}.option-top{gap:3px}.option-top strong{font-family:var(--font-display);font-size:1.05rem}.option-top small{color:var(--secondary-accent);font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em}.summary{color:var(--text-secondary);font-size:.86rem;line-height:1.45}.tradeoffs{gap:7px;color:var(--text-tertiary);font-size:.72rem;line-height:1.45}.tradeoffs span{display:flex;flex-direction:column}footer{display:flex;align-items:center;justify-content:space-between;gap:24px;border-top:1px solid var(--border-subtle);padding-top:18px;color:var(--text-tertiary);font-size:.75rem}.secondary,.primary{border-radius:9px;padding:10px 15px;font-size:.84rem;font-weight:600}.secondary{border:1px solid var(--border);color:var(--text-secondary)}.primary{background:var(--primary-accent);color:var(--primary-accent-text)}button:disabled{opacity:.5}.back{display:inline-flex;align-items:center;gap:7px;color:var(--text-secondary);font-size:.8rem;margin-bottom:25px}.route-heading{display:flex;align-items:flex-start;gap:18px;max-width:680px}.route-heading .kicker{margin:1px 0 6px}.setup-panel,.progress-panel{margin:26px 0;display:flex;flex-direction:column;align-items:flex-start;gap:16px;padding:22px;border:1px solid var(--border-subtle);border-radius:16px;background:var(--base-secondary)}.setup-panel>p,.progress-panel p{color:var(--text-secondary);line-height:1.55;max-width:720px}.guide-progress{display:grid;grid-template-columns:auto 1fr auto 1fr auto;align-items:center;gap:10px;width:100%;color:var(--text-tertiary);font-size:.7rem}.guide-progress span{display:flex;align-items:center;gap:6px;white-space:nowrap}.guide-progress b{width:22px;height:22px;display:grid;place-items:center;border-radius:50%;background:var(--base);border:1px solid var(--border);font-size:.65rem}.guide-progress .active{color:var(--text-primary);font-weight:650}.guide-progress .active b{background:var(--primary-accent);border-color:var(--primary-accent);color:var(--primary-accent-text)}.guide-progress i{height:1px;background:var(--border)}.guide-copy{display:flex;flex-direction:column;gap:6px;max-width:720px}.guide-copy h3{font-family:var(--font-display);font-size:1rem}.guide-copy p{color:var(--text-secondary);line-height:1.55}.guide-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.notice{display:flex;flex-direction:column;gap:4px;padding:13px 15px;border-radius:10px;background:var(--info-subtle);color:var(--info);font-size:.79rem}.notice span{line-height:1.45}.fields{display:grid;grid-template-columns:2fr 2fr 1fr;gap:12px;width:100%}.fields label{display:flex;flex-direction:column;gap:7px;font-size:.74rem;color:var(--text-secondary)}.fields input{min-height:42px;padding:8px 11px;border:1px solid var(--border);border-radius:8px;background:var(--base);color:var(--text-primary)}:global(.spinner){font-size:28px;color:var(--primary-accent);animation:spin 900ms linear infinite}@keyframes spin{to{transform:rotate(360deg)}}.progress-panel{display:grid;grid-template-columns:auto 1fr auto;align-items:center}.progress-panel .notice,.progress-panel>.primary,.progress-panel>.troubleshooting,.progress-panel>.troubleshooting-action{grid-column:2/-1}.ready-grid{display:grid;grid-template-columns:360px 1fr;gap:16px;margin:26px 0}.qr-panel,.approval-panel{border:1px solid var(--border-subtle);border-radius:16px;background:var(--base-secondary);padding:20px}.success{display:flex;gap:10px;align-items:center;color:var(--success,#2e8b57)}.success :global(svg){font-size:24px}.success span{display:flex;flex-direction:column}.success small{color:var(--text-tertiary);font-size:.68rem;word-break:break-all}.certificate-step{display:grid;grid-template-columns:150px 1fr;gap:6px 12px;align-items:center;margin:18px 0;padding-bottom:18px;border-bottom:1px solid var(--border-subtle)}.certificate-step>strong{grid-column:1/-1;font-family:var(--font-display);font-size:.82rem}.certificate-step>span{color:var(--text-tertiary);font-size:.7rem;line-height:1.5}.certificate-qr{width:150px;height:150px;border-radius:9px;overflow:hidden;background:white}.certificate-qr :global(svg){display:block;width:100%;height:100%}.pair-label{display:block;font-family:var(--font-display);font-size:.82rem}.qr{width:236px;height:236px;margin:12px auto 8px;border-radius:12px;overflow:hidden;background:white}.qr :global(svg){display:block;width:100%;height:100%}.scan{text-align:center;color:var(--text-secondary);font-size:.78rem}.approval-panel{display:flex;flex-direction:column;gap:12px}.approval-panel h3,.progress-panel h3{font-family:var(--font-display);font-size:.95rem}.approval-panel p{color:var(--text-tertiary);font-size:.8rem}.device{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px;border:1px solid var(--border-subtle);border-radius:10px;background:var(--base)}.device span{display:flex;flex-direction:column;gap:3px}.device small{color:var(--text-tertiary);font-size:.7rem}.compact{padding:7px 10px}.paired{min-height:236px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:8px;color:var(--text-secondary)}.paired :global(svg){font-size:42px;color:var(--primary-accent)}.paired span{font-size:.76rem}.error{margin:0 0 18px;padding:12px 14px;border-radius:9px;background:color-mix(in srgb,var(--danger,#c33) 10%,var(--base));color:var(--danger,#c33);font-size:.8rem;line-height:1.45}.route-footer{margin-top:8px}
  .options{grid-template-columns:repeat(2,minmax(0,1fr));margin-bottom:14px}
  .tradeoffs{gap:6px}
  .tradeoffs .tradeoff{display:grid;grid-template-columns:16px minmax(0,1fr);align-items:start;gap:7px;color:var(--text-secondary)}
  .tradeoffs .tradeoff>span{display:block}
  .tradeoffs .tradeoff :global(svg){width:14px;height:14px;margin-top:1px}
  .tradeoffs .benefit :global(svg){color:var(--success)}
  .tradeoffs .limitation :global(svg){color:var(--text-tertiary)}
  .advanced{display:flex;flex-direction:column;align-items:stretch;gap:10px;margin-bottom:24px}
  .advanced-toggle{align-self:flex-start;display:inline-flex;align-items:center;gap:7px;min-height:40px;color:var(--text-secondary);font-size:.78rem;font-weight:650}
  .advanced-toggle :global(svg){transition:transform 160ms ease}
  .advanced-toggle :global(svg.open){transform:rotate(180deg)}
  .advanced-option{display:grid;grid-template-columns:52px minmax(0,1fr);width:100%;padding:16px;gap:14px}
  @media(max-width:760px){.backdrop{padding:0;align-items:end}.modal{width:100%;border-radius:22px 22px 0 0;padding:24px 18px max(20px,env(safe-area-inset-bottom));max-height:94dvh;overflow-x:hidden}.options{grid-template-columns:1fr}.option{display:grid;grid-template-columns:48px minmax(0,1fr);gap:14px;padding:16px}.option-icon{width:48px;height:48px}.tradeoffs{display:flex}.fields{grid-template-columns:1fr}.ready-grid{grid-template-columns:1fr}.progress-panel{grid-template-columns:auto minmax(0,1fr)}.progress-panel>.secondary{grid-column:2}.guide-progress{grid-template-columns:1fr}.guide-progress i{display:none}.guide-progress span{white-space:normal}.certificate-step{grid-template-columns:1fr}.certificate-step>span{text-align:center}.certificate-qr{margin:auto}.qr{width:min(236px,100%);height:auto;aspect-ratio:1}.route-footer{align-items:flex-end}.route-footer span{max-width:65%}}
</style>
