<script lang="ts">
  import { onMount } from "svelte";
  import { posterUrl } from "$lib/poster";
  import type { TmdbItem } from "$lib/types";
  import IconXBold from "phosphor-icons-svelte/IconXBold.svelte";
  import IconBookmarkSimpleFill from "phosphor-icons-svelte/IconBookmarkSimpleFill.svelte";
  import IconProhibitRegular from "phosphor-icons-svelte/IconProhibitRegular.svelte";
  import IconThumbsUpFill from "phosphor-icons-svelte/IconThumbsUpFill.svelte";
  import IconThumbsDownFill from "phosphor-icons-svelte/IconThumbsDownFill.svelte";
  import IconEyeSlashRegular from "phosphor-icons-svelte/IconEyeSlashRegular.svelte";
  import { glassPointer, motionPress, motionReveal } from "$lib/design/motion";

  export type ModalActionKind =
    | "like"
    | "watchlist"
    | "skip"
    | "not_interested"
    | "dislike";

  let {
    item,
    onClose,
    onLike,
    onWatchlist,
    onSkip,
    onIgnore,
    onDislike,
    onLeaveAsIs,
    onAction,
    excludeActions = []
  }: {
    item: TmdbItem;
    onClose: () => void;
    onLike?: (item: TmdbItem) => void | Promise<void>;
    onWatchlist?: (item: TmdbItem) => void | Promise<void>;
    onSkip?: (item: TmdbItem) => void | Promise<void>;
    onIgnore?: (item: TmdbItem) => void | Promise<void>;
    onDislike?: (item: TmdbItem) => void | Promise<void>;
    onLeaveAsIs?: (item: TmdbItem) => void | Promise<void>;
    onAction?: (item: TmdbItem, completion: Promise<void>) => void;
    excludeActions?: ModalActionKind[];
  } = $props();

  // Start from the (possibly coarse) list item, enrich with the full
  // detail fetch (keywords, runtime, full overview) when it arrives.
  let detail = $state<TmdbItem | null>(null);
  let modalRef = $state<HTMLElement | null>(null);
  const current = $derived(detail ?? item);
  let loadError = $state<string | null>(null);

  const poster = $derived(posterUrl(current.posterPath, "w500"));
  const rating = $derived(current.voteAverage ? current.voteAverage.toFixed(1) : null);

  function run(handler: ((i: TmdbItem) => void | Promise<void>) | undefined): void {
    if (!handler) return;
    let completion: Promise<void>;
    try {
      completion = Promise.resolve(handler(current));
    } catch (err) {
      completion = Promise.reject(err);
    }
    if (onAction) onAction(current, completion);
    else onClose();
    void completion.catch(() => {});
  }

  const showLike = $derived(!!onLike && !excludeActions.includes("like"));
  const showWatchlist = $derived(!!onWatchlist && !excludeActions.includes("watchlist"));
  const showSkip = $derived(!!onSkip && !excludeActions.includes("skip"));
  const showIgnore = $derived(!!onIgnore && !excludeActions.includes("not_interested"));
  const showDislike = $derived(!!onDislike && !excludeActions.includes("dislike"));

  function handleKey(e: KeyboardEvent): void {
    if (e.repeat) return;
    if (e.key === "Escape") { e.preventDefault(); onClose(); }
    else if (e.key === "ArrowRight") { e.preventDefault(); run(onLike); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); run(onDislike); }
    else if (e.key === "ArrowUp") { e.preventDefault(); run(onWatchlist); }
    else if (e.key === "ArrowDown") { e.preventDefault(); run(onIgnore); }
    else if (e.key === " " || e.code === "Space") { e.preventDefault(); run(onSkip); }
    else if (e.key === "Enter" && !(e.target instanceof HTMLButtonElement)) { e.preventDefault(); run(onLeaveAsIs); }
  }

  onMount(() => {
    modalRef?.focus();
    void window.dossier?.tmdb
      ?.detail(item.medium, item.id)
      .then((d) => { detail = d; })
      .catch((err) => {
        loadError = err instanceof Error ? err.message : String(err);
      });

  });
</script>

<div
  class="backdrop"
  role="presentation"
  onclick={onClose}
>
  <div
    class="modal"
    bind:this={modalRef}
    style={poster ? `--modal-art:url("${poster}")` : ""}
    role="dialog"
    tabindex="-1"
    aria-modal="true"
    aria-labelledby="movie-modal-title"
    onclick={(e) => e.stopPropagation()}
    onkeydown={handleKey}
  >
    <div class="art-field" aria-hidden="true"></div>
    <button class="close" aria-label="Close" onclick={onClose}>
      <IconXBold class="icon-16" />
    </button>

    <div class="layout">
      <div class="poster-col">
        {#if poster}
          <img class="poster" src={poster} alt="" />
        {:else}
          <div class="poster poster-empty"></div>
        {/if}
      </div>

      <div class="info">
        <div class="copy" use:motionReveal={{ delay: .08 }}>
          <h2 class="title" id="movie-modal-title">{current.title}</h2>
          <p class="meta">
            {#if current.year}<span>{current.year}</span>{/if}
            {#if rating}<span class="dot">·</span><span>★ {rating}</span>{/if}
            {#if current.runtime}<span class="dot">·</span><span>{current.runtime} min</span>{/if}
          </p>

          {#if current.genres.length > 0}
            <p class="genres">{current.genres.join(" · ")}</p>
          {/if}

          {#if loadError}
            <p class="error">Couldn't load full details: {loadError}</p>
          {/if}
          {#if current.overview}
            <p class="story">{current.overview}</p>
          {/if}
        </div>

        <div class="actions" use:glassPointer>
          {#if showLike}
            <button class="action like" use:motionPress onclick={() => run(onLike)} aria-label="Like">
              <IconThumbsUpFill class="icon-16" />
              <span>Like</span>
              <kbd>→</kbd>
            </button>
          {/if}
          {#if showWatchlist}
            <button class="action watchlist" use:motionPress onclick={() => run(onWatchlist)} aria-label="Add to watchlist">
              <IconBookmarkSimpleFill class="icon-16" />
              <span>Add to watchlist</span>
              <kbd>↑</kbd>
            </button>
          {/if}
          {#if showSkip}
            <button class="action skip" use:motionPress onclick={() => run(onSkip)} aria-label="Haven't seen">
              <IconEyeSlashRegular class="icon-16" />
              <span>Haven't seen</span>
              <kbd>Space</kbd>
            </button>
          {/if}
          {#if showIgnore}
            <button class="action ignore" use:motionPress onclick={() => run(onIgnore)} aria-label="Not interested">
              <IconProhibitRegular class="icon-16" />
              <span>Not interested</span>
              <kbd>↓</kbd>
            </button>
          {/if}
          {#if showDislike}
            <button class="action dislike" use:motionPress onclick={() => run(onDislike)} aria-label="Dislike">
              <IconThumbsDownFill class="icon-16" />
              <span>Dislike</span>
              <kbd>←</kbd>
            </button>
          {/if}
          {#if onLeaveAsIs}
            <button class="action leave" use:motionPress onclick={() => run(onLeaveAsIs)} aria-label="Leave as is">
              <span>Leave as is</span>
              <kbd>Enter</kbd>
            </button>
          {/if}
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background:rgba(8,9,11,.74);
    display: flex;
    align-items: center;
    justify-content: center;
    padding:clamp(18px,3vw,46px);
    z-index: 500;
    backdrop-filter:blur(10px) saturate(.78);
    -webkit-backdrop-filter:blur(10px) saturate(.78);
  }
  .modal {
    position: relative;
    isolation:isolate;
    background:#111317;
    border:1px solid rgba(255,255,255,.18);
    border-radius:24px;
    box-shadow:0 32px 100px rgba(0,0,0,.48),inset 0 1px 0 rgba(255,255,255,.18);
    max-width:1080px;
    width: 100%;
    min-height:min(620px,82vh);
    max-height:min(88vh,720px);
    overflow: hidden;
    animation:modal-in 360ms cubic-bezier(.16,1,.3,1);
  }
  @keyframes modal-in {
    from { opacity:0; transform:translateY(18px) scale(.975); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
  .art-field {
    position:absolute;
    inset:-52px;
    z-index:-3;
    background-image:var(--modal-art);
    background-size:cover;
    background-position:center 28%;
    filter:blur(42px) saturate(1.34) contrast(1.06);
    opacity:.72;
    transform:scale(1.13);
  }
  .modal::before {
    content:"";
    position:absolute;
    inset:0;
    z-index:-2;
    background:
      linear-gradient(90deg,rgba(10,11,14,.2),rgba(10,11,14,.66) 47%,rgba(10,11,14,.92) 78%),
      linear-gradient(0deg,rgba(10,11,14,.72),rgba(10,11,14,.08) 68%);
  }
  .modal::after {
    content:"";
    position:absolute;
    inset:0;
    z-index:-1;
    background:radial-gradient(500px circle at 74% 28%,rgba(255,255,255,.08),transparent 68%);
    pointer-events:none;
  }
  .close {
    position: absolute;
    top:18px;
    right:18px;
    width:42px;
    height:42px;
    border-radius:999px;
    background:rgba(20,22,26,.36);
    border:1px solid rgba(255,255,255,.2);
    color:rgba(255,255,255,.8);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    z-index:4;
    backdrop-filter:blur(18px) saturate(1.35);
    -webkit-backdrop-filter:blur(18px) saturate(1.35);
    transition:background 160ms var(--ease-out),color 160ms var(--ease-out),transform 160ms var(--ease-out);
  }
  .close:hover { background:rgba(255,255,255,.15);color:white;transform:rotate(2deg) scale(1.04); }
  .layout {
    position:relative;
    display:grid;
    grid-template-columns:minmax(250px,330px) minmax(0,1fr);
    align-items:center;
    gap:clamp(34px,5vw,68px);
    min-height:inherit;
    padding:clamp(28px,4vw,48px);
    padding-right:clamp(54px,5vw,72px);
  }
  .poster-col {
    position:relative;
    align-self:center;
    display:flex;
    filter:drop-shadow(0 24px 38px rgba(0,0,0,.42));
  }
  .poster-col::after {
    content:"";
    position:absolute;
    inset:9% -10% -8%;
    z-index:-1;
    background-image:var(--modal-art);
    background-size:cover;
    filter:blur(28px) saturate(1.3);
    opacity:.45;
  }
  .poster {
    width: 100%;
    aspect-ratio: 2 / 3;
    object-fit: cover;
    border-radius:16px;
    background:#24272d;
    display: block;
    box-shadow:inset 0 0 0 1px rgba(255,255,255,.12);
  }
  .poster-empty { background:linear-gradient(145deg,#292c32,#15171b); }
  .info {
    min-width:0;
    min-height:430px;
    display:flex;
    flex-direction:column;
    justify-content:space-between;
    gap:28px;
    color:white;
  }
  .copy { display:flex;flex-direction:column;gap:12px;max-width:640px; }
  .title {
    font-family: var(--font-display);
    font-size:clamp(2.15rem,4.2vw,3.8rem);
    line-height:.98;
    letter-spacing:-.025em;
    color:white;
    margin: 0;
    text-wrap:balance;
  }
  .meta { color:rgba(255,255,255,.76);margin:2px 0 0;font-size:1rem;display:flex;gap:9px;align-items:center;flex-wrap:wrap;font-variant-numeric:tabular-nums; }
  .dot { color:rgba(255,255,255,.34); }
  .genres { color:rgba(255,255,255,.5);margin:0;font-size:.88rem; }
  .story {
    color:rgba(255,255,255,.86);
    line-height:1.58;
    margin:10px 0 0;
    max-width:58ch;
    font-size:.98rem;
    display:-webkit-box;
    -webkit-line-clamp:6;
    line-clamp:6;
    -webkit-box-orient:vertical;
    overflow:hidden;
  }
  .error { color:#ffb4ac;font-size:.82rem; }

  .actions {
    position:relative;
    isolation:isolate;
    align-self:flex-start;
    display:flex;
    flex-wrap:wrap;
    gap:7px;
    padding:7px;
    border:1px solid rgba(255,255,255,.16);
    border-radius:18px;
    background:rgba(15,17,21,.3);
    box-shadow:inset 0 1px 0 rgba(255,255,255,.12),0 14px 32px rgba(0,0,0,.18);
    backdrop-filter:blur(22px) saturate(1.35);
    -webkit-backdrop-filter:blur(22px) saturate(1.35);
  }
  .actions::before {
    content:"";
    position:absolute;
    inset:0;
    z-index:-1;
    border-radius:inherit;
    background:radial-gradient(150px circle at var(--glass-x,50%) var(--glass-y,50%),rgba(255,255,255,.14),transparent 70%);
    pointer-events:none;
  }
  .action {
    display: inline-flex;
    align-items: center;
    gap:8px;
    min-height:42px;
    padding:0 11px;
    border-radius:12px;
    border:1px solid transparent;
    background:rgba(255,255,255,.055);
    color:rgba(255,255,255,.84);
    font-size:.78rem;
    cursor: pointer;
    transition:background 160ms var(--ease-out),border-color 160ms var(--ease-out),color 160ms var(--ease-out);
  }
  .action:hover,.action:focus-visible { background:rgba(255,255,255,.13);border-color:rgba(255,255,255,.16);color:white; }
  .action.like:hover,.action.like:focus-visible { color:#9ce4ba; }
  .action.dislike:hover,.action.dislike:focus-visible { color:#ffaaa3; }
  .action.watchlist:hover,.action.watchlist:focus-visible { color:#ffc2a7; }
  .action kbd { margin-left:2px;padding:2px 5px;border:1px solid rgba(255,255,255,.14);border-radius:6px;background:rgba(0,0,0,.18);color:rgba(255,255,255,.44);font-family:var(--font-mono);font-size:.56rem;line-height:1.2;box-shadow:none; }

  @media (max-width:640px) {
    .backdrop{padding:0;background:#111317;align-items:stretch;backdrop-filter:none}
    .modal{width:100%;height:100dvh;min-height:0;max-width:none;max-height:none;border:0;border-radius:0;box-shadow:none;background:#111317;animation:none}
    .art-field{inset:-30px;opacity:.56;filter:blur(32px) saturate(1.25)}
    .modal::before{background:linear-gradient(0deg,#111317 38%,rgba(17,19,23,.5) 66%,rgba(17,19,23,.08))}
    .close{position:fixed;top:max(12px,env(safe-area-inset-top));right:max(12px,env(safe-area-inset-right));z-index:4;background:rgba(18,19,22,.52);border-color:rgba(255,255,255,.2);color:white}
    .layout{display:flex;flex-direction:column;gap:0;min-height:0;height:100%;padding:0;overflow-y:auto;overscroll-behavior-y:contain;-webkit-overflow-scrolling:touch;scroll-padding-bottom:calc(90px + env(safe-area-inset-bottom))}
    .poster-col{width:100%;height:min(52dvh,460px);flex:none;background:#15171a;filter:none}
    .poster-col::after{display:none}
    .poster{height:100%;aspect-ratio:auto;border-radius:0;object-fit:cover;object-position:center 22%;box-shadow:none}
    .info{min-height:0;padding:20px 18px calc(104px + env(safe-area-inset-bottom));gap:18px;justify-content:flex-start;color:white;background:linear-gradient(180deg,rgba(17,19,23,.88),#111317 34%)}
    .copy{gap:9px}
    .title{font-size:1.7rem;line-height:1.04;padding-right:38px}
    .meta{font-size:.84rem}.genres{font-size:.78rem}
    .story{font-size:.88rem;line-height:1.48;margin-top:5px;-webkit-line-clamp:4;line-clamp:4}
    .actions{position:fixed;z-index:3;left:0;right:0;bottom:0;margin:0;padding:9px 9px calc(9px + env(safe-area-inset-bottom));display:grid;grid-template-columns:repeat(auto-fit,minmax(58px,1fr));gap:6px;border:0;border-top:1px solid rgba(255,255,255,.12);border-radius:16px 16px 0 0;background:rgba(17,19,23,.78);box-shadow:0 -10px 30px rgba(0,0,0,.2);backdrop-filter:blur(24px) saturate(1.3);-webkit-backdrop-filter:blur(24px) saturate(1.3)}
    .actions::before{display:none}
    .action{min-width:0;min-height:50px;padding:7px 4px;flex-direction:column;justify-content:center;gap:3px;border-radius:11px;background:rgba(255,255,255,.06);font-size:.61rem;line-height:1.1;text-align:center;color:rgba(255,255,255,.78)}
    .action span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
    .action kbd{display:none}
  }

  @media (max-width:880px) and (min-width:641px) {
    .modal{max-width:760px;min-height:540px}
    .layout{grid-template-columns:230px 1fr;gap:34px;padding:30px 54px 30px 30px}
    .info{min-height:380px}.title{font-size:2.35rem}.story{-webkit-line-clamp:5;line-clamp:5}
    .action kbd{display:none}
  }

  @media (prefers-reduced-motion:reduce) {
    .modal{animation:none}.close{transition:none}
  }
</style>
