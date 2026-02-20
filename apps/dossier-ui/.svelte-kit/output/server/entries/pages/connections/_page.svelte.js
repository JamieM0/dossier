import { b as attributes } from "../../../chunks/index.js";
function IconArrowSquareOutRegular($$renderer, $$props) {
  const { $$slots, $$events, ...p } = $$props;
  $$renderer.push(`<svg${attributes(
    {
      ...p,
      "data-phosphor-icon": "arrow-square-out",
      "aria-hidden": "true",
      width: "1em",
      height: "1em",
      "pointer-events": "none",
      display: "inline-block",
      xmlns: "http://www.w3.org/2000/svg",
      fill: "currentColor",
      viewBox: "0 0 256 256"
    },
    void 0,
    void 0,
    void 0,
    3
  )}><path d="M224 104a8 8 0 0 1-16 0V59.32l-66.33 66.34a8 8 0 0 1-11.32-11.32L196.68 48H152a8 8 0 0 1 0-16h64a8 8 0 0 1 8 8Zm-40 24a8 8 0 0 0-8 8v72H48V80h72a8 8 0 0 0 0-16H48a16 16 0 0 0-16 16v128a16 16 0 0 0 16 16h128a16 16 0 0 0 16-16v-72a8 8 0 0 0-8-8"></path></svg>`);
}
function _page($$renderer) {
  $$renderer.push(`<section class="connections-view svelte-xxtt2y"><div class="connections-content svelte-xxtt2y"><h1 class="page-heading svelte-xxtt2y">Connected Services</h1> <div class="services-list svelte-xxtt2y"><article class="service-card svelte-xxtt2y"><div class="service-header svelte-xxtt2y"><div class="service-icon svelte-xxtt2y">`);
  IconArrowSquareOutRegular($$renderer, { class: "icon-20" });
  $$renderer.push(`<!----></div> <div class="service-info svelte-xxtt2y"><h3 class="service-name svelte-xxtt2y">Perspectives</h3> <span class="consent-badge svelte-xxtt2y">Always ask</span></div></div> <div class="service-access svelte-xxtt2y"><p class="access-label svelte-xxtt2y">Can access:</p> <ul class="access-items svelte-xxtt2y"><li class="svelte-xxtt2y">Communication preferences</li> <li class="svelte-xxtt2y">Topic boundaries</li></ul></div> <div class="service-actions svelte-xxtt2y"><button class="btn-secondary svelte-xxtt2y">Manage</button> <button class="btn-danger-sm svelte-xxtt2y">Revoke all access</button></div></article></div></div></section>`);
}
export {
  _page as default
};
