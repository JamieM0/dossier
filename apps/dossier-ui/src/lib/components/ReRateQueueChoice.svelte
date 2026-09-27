<script lang="ts">
  import IconXBold from "phosphor-icons-svelte/IconXBold.svelte";

  let {
    title,
    completed,
    total,
    onContinue,
    onRestart,
    onClose
  } = $props<{
    title: string;
    completed: number;
    total: number;
    onContinue: () => void;
    onRestart: () => void;
    onClose: () => void;
  }>();

  let continueButton = $state<HTMLButtonElement | null>(null);
  let modal = $state<HTMLElement | null>(null);

  $effect(() => continueButton?.focus());

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab" || !modal) return;
    const buttons = modal.querySelectorAll<HTMLElement>("button");
    const first = buttons[0], last = buttons[buttons.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="backdrop" role="presentation" onclick={(event) => event.target === event.currentTarget && onClose()}>
  <div bind:this={modal} class="choice" role="dialog" aria-modal="true" aria-labelledby="rerate-choice-title">
    <button class="close" aria-label="Close" onclick={onClose}><IconXBold class="icon-14" /></button>
    <span class="kicker">Re-rate in queue</span>
    <h2 id="rerate-choice-title">Pick up {title}?</h2>
    <p>{completed} of {total} current {total === 1 ? "title has" : "titles have"} already been handled.</p>
    <div class="actions">
      <button class="restart" onclick={onRestart}>
        <strong>Start over</strong>
        <span>Review every current title again</span>
      </button>
      <button class="continue" bind:this={continueButton} onclick={onContinue}>
        <strong>Continue where you left off</strong>
        <span>Skip everything already handled</span>
      </button>
    </div>
  </div>
</div>

<style>
  .backdrop{position:fixed;inset:0;z-index:600;display:grid;place-items:center;padding:20px;background:rgba(8,9,11,.72);backdrop-filter:blur(12px) saturate(.8);-webkit-backdrop-filter:blur(12px) saturate(.8)}
  .choice{position:relative;width:min(560px,100%);padding:34px;border:1px solid var(--border-strong);border-radius:22px;background:color-mix(in srgb,var(--base) 94%,transparent);box-shadow:0 28px 90px rgba(0,0,0,.38);animation:choice-in 260ms var(--ease-out)}
  @keyframes choice-in{from{opacity:0;transform:translateY(12px) scale(.98)}to{opacity:1;transform:none}}
  .close{position:absolute;right:16px;top:16px;width:34px;height:34px;display:grid;place-items:center;border:1px solid var(--border-subtle);border-radius:999px;background:var(--base-secondary);color:var(--text-secondary);cursor:pointer}
  .kicker{color:var(--accent);font-size:.68rem;letter-spacing:.1em;text-transform:uppercase}
  h2{margin:8px 42px 8px 0;font:clamp(1.55rem,4vw,2.25rem)/1.05 var(--font-display);color:var(--text-primary)}
  p{margin:0;color:var(--text-secondary);font-size:.88rem}
  .actions{display:grid;grid-template-columns:1fr 1.2fr;gap:10px;margin-top:28px}
  .actions button{min-height:90px;padding:15px;text-align:left;border:1px solid var(--border-subtle);border-radius:14px;background:var(--base-secondary);color:var(--text-primary);cursor:pointer;display:flex;flex-direction:column;justify-content:center;gap:5px;transition:transform 150ms var(--ease-out),border-color 150ms var(--ease-out),background 150ms var(--ease-out)}
  .actions button:hover,.actions button:focus-visible{transform:translateY(-2px);border-color:var(--accent);outline:none}
  .actions .continue{background:color-mix(in srgb,var(--accent) 14%,var(--base-secondary));border-color:color-mix(in srgb,var(--accent) 44%,var(--border-subtle))}
  .actions strong{font-size:.86rem}.actions span{color:var(--text-tertiary);font-size:.7rem;line-height:1.35}
  @media(max-width:560px){.choice{padding:28px 20px 20px}.actions{grid-template-columns:1fr}.actions button{min-height:72px}}
  @media(prefers-reduced-motion:reduce){.choice{animation:none}.actions button{transition:none}}
</style>
