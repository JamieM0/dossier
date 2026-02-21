import { d as attributes, b as ensure_array_like, e as escape_html, a as attr_class, c as attr } from "../../../chunks/index.js";
/* empty css                                                          */
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
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let services = [];
    $$renderer2.push(`<section class="connections-view svelte-xxtt2y"><div class="connections-content svelte-xxtt2y"><h1 class="page-heading svelte-xxtt2y">Connected Services</h1> `);
    {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]--> `);
    {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]--> <div class="services-list svelte-xxtt2y">`);
    if (services.length === 0) {
      $$renderer2.push("<!--[-->");
      $$renderer2.push(`<p class="empty svelte-xxtt2y">No registered services found.</p>`);
    } else {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]--> <!--[-->`);
    const each_array = ensure_array_like(services);
    for (let $$index_1 = 0, $$length = each_array.length; $$index_1 < $$length; $$index_1++) {
      let service = each_array[$$index_1];
      $$renderer2.push(`<article class="service-card svelte-xxtt2y"><div class="service-header svelte-xxtt2y"><div class="service-icon svelte-xxtt2y">`);
      IconArrowSquareOutRegular($$renderer2, { class: "icon-20" });
      $$renderer2.push(`<!----></div> <div class="service-info svelte-xxtt2y"><h3 class="service-name svelte-xxtt2y">${escape_html(service.display_name)}</h3> <span class="consent-badge svelte-xxtt2y">${escape_html(service.policy_mode === "ALWAYS_ASK" ? "Always ask" : service.policy_mode)}</span> <span${attr_class("status-pill svelte-xxtt2y", void 0, { "paired": service.status === "PAIRED" })}>${escape_html(service.status === "PAIRED" ? "Connected" : "Not connected")}</span></div></div> <div class="service-access svelte-xxtt2y"><p class="access-label svelte-xxtt2y">Allowed origins</p> `);
      if (service.allowed_origins_json.length === 0) {
        $$renderer2.push("<!--[-->");
        $$renderer2.push(`<p class="access-value svelte-xxtt2y">None</p>`);
      } else {
        $$renderer2.push("<!--[!-->");
        $$renderer2.push(`<ul class="access-items svelte-xxtt2y"><!--[-->`);
        const each_array_1 = ensure_array_like(service.allowed_origins_json);
        for (let $$index = 0, $$length2 = each_array_1.length; $$index < $$length2; $$index++) {
          let origin = each_array_1[$$index];
          $$renderer2.push(`<li>${escape_html(origin)}</li>`);
        }
        $$renderer2.push(`<!--]--></ul>`);
      }
      $$renderer2.push(`<!--]--></div> <div class="service-actions svelte-xxtt2y"><button class="btn-danger-sm svelte-xxtt2y"${attr("disabled", service.status !== "PAIRED", true)}>Revoke access</button></div></article>`);
    }
    $$renderer2.push(`<!--]--></div></div></section> `);
    {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]-->`);
  });
}
export {
  _page as default
};
