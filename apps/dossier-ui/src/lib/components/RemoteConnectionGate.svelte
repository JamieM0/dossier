<script lang="ts">
  import { onDestroy, onMount, tick } from "svelte";
  import QrScanner from "qr-scanner";
  import IconCameraRegular from "phosphor-icons-svelte/IconCameraRegular.svelte";
  import IconWifiSlashRegular from "phosphor-icons-svelte/IconWifiSlashRegular.svelte";
  import IconArrowClockwiseRegular from "phosphor-icons-svelte/IconArrowClockwiseRegular.svelte";
  import IconXRegular from "phosphor-icons-svelte/IconXRegular.svelte";

  let { message, onRetry } = $props<{ message: string; onRetry: () => void | Promise<void> }>();

  let video = $state<HTMLVideoElement | null>(null);
  let scanner: QrScanner | null = null;
  let scanning = $state(false);
  let retrying = $state(false);
  let error = $state("");
  let manualUrl = $state("");
  let scannedUrl = $state<URL | null>(null);

  function parsePairingUrl(raw: string): URL {
    let url: URL;
    try { url = new URL(raw.trim()); }
    catch { throw new Error("That does not look like a Dossier pairing link."); }
    if (url.protocol !== "https:" || url.pathname !== "/pair" || !url.searchParams.get("code")) {
      throw new Error("Scan the phone-pairing QR shown by Dossier on the host PC.");
    }
    return url;
  }

  function found(raw: string): void {
    try {
      scannedUrl = parsePairingUrl(raw);
      error = "";
      stopScanner();
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    }
  }

  async function startScanner(): Promise<void> {
    error = "";
    scannedUrl = null;
    scanning = true;
    await tick();
    if (!video) return;
    scanner?.destroy();
    scanner = new QrScanner(video, (result) => found(result.data), {
      preferredCamera: "environment",
      highlightScanRegion: true,
      highlightCodeOutline: true,
      returnDetailedScanResult: true
    });
    try {
      await scanner.start();
    } catch (cause) {
      stopScanner();
      error = cause instanceof Error ? cause.message : "Dossier could not open the camera. You can take or choose a photo instead.";
    }
  }

  function stopScanner(): void {
    scanner?.destroy();
    scanner = null;
    scanning = false;
  }

  async function scanImage(event: Event): Promise<void> {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    error = "";
    try {
      const result = await QrScanner.scanImage(file, { returnDetailedScanResult: true });
      found(result.data);
    } catch {
      error = "No Dossier pairing QR was found in that image.";
    } finally {
      input.value = "";
    }
  }

  async function retry(): Promise<void> {
    if (retrying) return;
    retrying = true;
    error = "";
    try { await onRetry(); }
    catch (cause) { error = cause instanceof Error ? cause.message : String(cause); }
    finally { retrying = false; }
  }

  function connect(): void {
    if (scannedUrl) window.location.assign(scannedUrl.toString());
  }

  onDestroy(stopScanner);
  onMount(() => {
    const timer = window.setInterval(() => void retry(), 3_000);
    return () => window.clearInterval(timer);
  });
</script>

<main class="gate">
  <section class="card" aria-labelledby="connection-title">
    <span class="status-icon"><IconWifiSlashRegular /></span>
    <p class="eyebrow">Host unavailable</p>
    <h1 id="connection-title">Reconnect to Dossier</h1>
    <p class="intro">Your approved library is still private. Dossier will reconnect automatically when the host endpoint is ready.</p>

    {#if scanning}
      <div class="scanner-shell">
        <video bind:this={video} aria-label="Pairing QR camera preview"></video>
        <button class="close-scanner" aria-label="Close camera" onclick={stopScanner}><IconXRegular /></button>
        <span class="scanner-hint">Point at the phone-pairing QR on the host PC</span>
      </div>
    {:else if scannedUrl}
      <div class="confirmation">
        <span>Pair with</span>
        <strong>{scannedUrl.host}</strong>
        <small>The host PC must still approve this device before any library data is sent.</small>
        <div class="confirmation-actions"><button class="secondary" onclick={() => (scannedUrl = null)}>Scan again</button><button class="primary" onclick={connect}>Continue</button></div>
      </div>
    {:else}
      <div class="actions">
        <button class="primary camera" onclick={() => void startScanner()}><IconCameraRegular /> Scan a new pairing code</button>
        <label class="secondary file-button">Take or choose a QR photo<input type="file" accept="image/*" capture="environment" onchange={(event) => void scanImage(event)} /></label>
        <button class="secondary retry" onclick={() => void retry()} disabled={retrying}><IconArrowClockwiseRegular class={retrying ? "spin" : ""} /> {retrying ? "Checking…" : "Try the saved address again"}</button>
      </div>

      <details>
        <summary>Enter the pairing link instead</summary>
        <form onsubmit={(event) => { event.preventDefault(); found(manualUrl); }}>
          <input bind:value={manualUrl} inputmode="url" autocomplete="off" placeholder="https://…/pair?code=…" aria-label="Dossier pairing link" />
          <button class="secondary" type="submit">Check link</button>
        </form>
      </details>
    {/if}

    {#if error}<p class="error" role="alert">{error}</p>{/if}
    <p class="technical">{message}</p>
    <p class="privacy">Camera frames and QR images are decoded only on this device; Dossier does not upload them.</p>
  </section>
</main>

<style>
  .gate{min-height:100dvh;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at 50% 0%,color-mix(in srgb,var(--primary-accent) 10%,transparent),transparent 42%),var(--base);overflow-x:hidden}
  .card{width:min(100%,480px);padding:clamp(24px,6vw,38px);border:1px solid var(--border-subtle);border-radius:24px;background:var(--base-secondary);box-shadow:var(--shadow-xl);text-align:center}
  .status-icon{width:58px;height:58px;display:grid;place-items:center;margin:0 auto 16px;border-radius:18px;background:var(--base);color:var(--primary-accent);box-shadow:var(--shadow-sm)}
  .status-icon :global(svg){font-size:30px}.eyebrow{color:var(--secondary-accent);font-size:.7rem;font-weight:750;letter-spacing:.12em;text-transform:uppercase}h1{margin:5px 0 0;font:700 clamp(1.65rem,7vw,2.1rem)/1.1 var(--font-display)}
  .intro{margin:12px auto 22px;color:var(--text-secondary);line-height:1.55}.actions{display:flex;flex-direction:column;gap:10px}.primary,.secondary,.file-button{min-height:46px;display:inline-flex;align-items:center;justify-content:center;gap:8px;border-radius:11px;padding:10px 15px;font-weight:650;font-size:.88rem}.primary{background:var(--primary-accent);color:var(--primary-accent-text)}.secondary,.file-button{border:1px solid var(--border);color:var(--text-secondary);background:var(--base)}button:disabled{opacity:.6}.file-button{cursor:pointer}.file-button input{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}
  .scanner-shell{position:relative;width:100%;aspect-ratio:3/4;max-height:58dvh;overflow:hidden;border-radius:18px;background:#141414}.scanner-shell video{width:100%;height:100%;object-fit:cover}.close-scanner{position:absolute;top:12px;right:12px;width:42px;height:42px;display:grid;place-items:center;border-radius:50%;background:rgba(10,10,10,.72);color:white}.scanner-hint{position:absolute;left:12px;right:12px;bottom:12px;padding:10px 12px;border-radius:10px;background:rgba(10,10,10,.72);color:white;font-size:.75rem}
  .confirmation{display:flex;flex-direction:column;gap:5px;padding:18px;border:1px solid var(--border);border-radius:14px;background:var(--base)}.confirmation>span{font-size:.72rem;color:var(--text-tertiary)}.confirmation strong{font:1.05rem var(--font-mono);overflow-wrap:anywhere}.confirmation small{margin-top:5px;color:var(--text-secondary);line-height:1.45}.confirmation-actions{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:10px}
  details{margin-top:16px;color:var(--text-tertiary);font-size:.78rem;text-align:left}summary{cursor:pointer;text-align:center}form{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;margin-top:10px}form input{min-width:0;min-height:44px;padding:9px 11px;border:1px solid var(--border);border-radius:9px;background:var(--base);color:var(--text-primary)}
  .error{margin-top:14px;padding:10px 12px;border-radius:9px;background:var(--error-subtle);color:var(--error);font-size:.78rem;line-height:1.45}.technical{margin-top:16px;color:var(--text-tertiary);font-size:.7rem;line-height:1.4;overflow-wrap:anywhere}.privacy{margin-top:8px;color:var(--text-tertiary);font-size:.68rem;line-height:1.4}:global(svg.spin){animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}
  @media(max-width:520px){.gate{padding:0;place-items:stretch}.card{min-height:100dvh;width:100%;border:0;border-radius:0;padding:calc(28px + env(safe-area-inset-top)) 18px calc(24px + env(safe-area-inset-bottom));display:flex;flex-direction:column;justify-content:center}.scanner-shell{max-height:52dvh}form{grid-template-columns:1fr}form .secondary{width:100%}}
</style>
