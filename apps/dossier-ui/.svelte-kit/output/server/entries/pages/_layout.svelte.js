import { e as escape_html, a as ensure_array_like, g as getContext, b as attributes, c as attr_class, d as attr, s as store_get, f as stringify, h as unsubscribe_stores, i as derived } from "../../chunks/index.js";
import { I as IconCheckRegular } from "../../chunks/IconCheckRegular.js";
import "@sveltejs/kit/internal";
import "../../chunks/exports.js";
import "../../chunks/utils2.js";
import "@sveltejs/kit/internal/server";
import "../../chunks/root.js";
import "../../chunks/state.svelte.js";
import { u as uiSettings } from "../../chunks/ui-settings.svelte.js";
function BatchedConsentView($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { requests } = $$props;
    $$renderer2.push(`<div class="consent-backdrop svelte-197qvbs"><div class="batched-modal svelte-197qvbs" role="dialog" aria-modal="true" aria-labelledby="batched-consent-title"><h2 id="batched-consent-title" class="modal-title svelte-197qvbs">Pending access requests <span class="count-badge svelte-197qvbs">${escape_html(requests.length)}</span></h2> <div class="requests-list svelte-197qvbs"><!--[-->`);
    const each_array = ensure_array_like(requests);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let request = each_array[$$index];
      $$renderer2.push(`<article class="request-card svelte-197qvbs"><div class="request-info svelte-197qvbs"><h3 class="request-service svelte-197qvbs">${escape_html(request.serviceName)}</h3> <p class="request-summary svelte-197qvbs">${escape_html(request.summary)}</p></div> <div class="request-actions svelte-197qvbs"><button class="btn-secondary-sm svelte-197qvbs">Decline</button> <button class="btn-primary-sm svelte-197qvbs">Allow</button></div></article>`);
    }
    $$renderer2.push(`<!--]--></div> <button class="btn-danger svelte-197qvbs">Decline all</button></div></div>`);
  });
}
function ConsentModal($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { serviceName, requestedItems } = $$props;
    $$renderer2.push(`<div class="consent-backdrop svelte-ys4ql"><div class="consent-modal svelte-ys4ql" role="dialog" aria-modal="true" aria-labelledby="consent-title" aria-describedby="consent-desc"><h2 id="consent-title" class="modal-title svelte-ys4ql">${escape_html(
      // Focus the decline button by default (spec: inaction = decline)
      serviceName
    )}</h2> <p id="consent-desc" class="modal-desc svelte-ys4ql">${escape_html(serviceName)} is requesting access to the following data:</p> <ul class="requested-items svelte-ys4ql"><!--[-->`);
    const each_array = ensure_array_like(requestedItems);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let item = each_array[$$index];
      $$renderer2.push(`<li class="requested-item svelte-ys4ql">`);
      IconCheckRegular($$renderer2, { class: "icon-16" });
      $$renderer2.push(`<!----> <span>${escape_html(item)}</span></li>`);
    }
    $$renderer2.push(`<!--]--></ul> <div class="modal-actions svelte-ys4ql"><button class="btn-secondary svelte-ys4ql">Decline</button> <button class="btn-primary svelte-ys4ql">Allow</button></div></div></div>`);
  });
}
const getStores = () => {
  const stores$1 = getContext("__svelte__");
  return {
    /** @type {typeof page} */
    page: {
      subscribe: stores$1.page.subscribe
    },
    /** @type {typeof navigating} */
    navigating: {
      subscribe: stores$1.navigating.subscribe
    },
    /** @type {typeof updated} */
    updated: stores$1.updated
  };
};
const page = {
  subscribe(fn) {
    const store = getStores().page;
    return store.subscribe(fn);
  }
};
function IconChatRegular($$renderer, $$props) {
  const { $$slots, $$events, ...p } = $$props;
  $$renderer.push(`<svg${attributes(
    {
      ...p,
      "data-phosphor-icon": "chat",
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
  )}><path d="M216 48H40a16 16 0 0 0-16 16v160a15.84 15.84 0 0 0 9.25 14.5A16.05 16.05 0 0 0 40 240a15.9 15.9 0 0 0 10.25-3.78l.09-.07L83 208h133a16 16 0 0 0 16-16V64a16 16 0 0 0-16-16m0 144H80a8 8 0 0 0-5.23 1.95L40 224V64h176Z"></path></svg>`);
}
function IconGearSixRegular($$renderer, $$props) {
  const { $$slots, $$events, ...p } = $$props;
  $$renderer.push(`<svg${attributes(
    {
      ...p,
      "data-phosphor-icon": "gear-six",
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
  )}><path d="M128 80a48 48 0 1 0 48 48 48.05 48.05 0 0 0-48-48m0 80a32 32 0 1 1 32-32 32 32 0 0 1-32 32m109.94-52.79a8 8 0 0 0-3.89-5.4l-29.83-17-.12-33.62a8 8 0 0 0-2.83-6.08 111.9 111.9 0 0 0-36.72-20.67 8 8 0 0 0-6.46.59L128 41.85 97.88 25a8 8 0 0 0-6.47-.6 112.1 112.1 0 0 0-36.68 20.75 8 8 0 0 0-2.83 6.07l-.15 33.65-29.83 17a8 8 0 0 0-3.89 5.4 106.5 106.5 0 0 0 0 41.56 8 8 0 0 0 3.89 5.4l29.83 17 .12 33.62a8 8 0 0 0 2.83 6.08 111.9 111.9 0 0 0 36.72 20.67 8 8 0 0 0 6.46-.59L128 214.15 158.12 231a7.9 7.9 0 0 0 3.9 1 8.1 8.1 0 0 0 2.57-.42 112.1 112.1 0 0 0 36.68-20.73 8 8 0 0 0 2.83-6.07l.15-33.65 29.83-17a8 8 0 0 0 3.89-5.4 106.5 106.5 0 0 0-.03-41.52m-15 34.91-28.57 16.25a8 8 0 0 0-3 3c-.58 1-1.19 2.06-1.81 3.06a7.94 7.94 0 0 0-1.22 4.21l-.15 32.25a95.9 95.9 0 0 1-25.37 14.3L134 199.13a8 8 0 0 0-3.91-1h-3.83a8.1 8.1 0 0 0-4.1 1l-28.84 16.1A96 96 0 0 1 67.88 201l-.11-32.2a8 8 0 0 0-1.22-4.22c-.62-1-1.23-2-1.8-3.06a8.1 8.1 0 0 0-3-3.06l-28.6-16.29a90.5 90.5 0 0 1 0-28.26l28.52-16.28a8 8 0 0 0 3-3c.58-1 1.19-2.06 1.81-3.06a7.94 7.94 0 0 0 1.22-4.21l.15-32.25a95.9 95.9 0 0 1 25.37-14.3L122 56.87a8 8 0 0 0 4.1 1h3.64a8.1 8.1 0 0 0 4.1-1l28.84-16.1A96 96 0 0 1 188.12 55l.11 32.2a8 8 0 0 0 1.22 4.22c.62 1 1.23 2 1.8 3.06a8.1 8.1 0 0 0 3 3.06l28.6 16.29a90.5 90.5 0 0 1 .05 28.29Z"></path></svg>`);
}
function IconLinkSimpleRegular($$renderer, $$props) {
  const { $$slots, $$events, ...p } = $$props;
  $$renderer.push(`<svg${attributes(
    {
      ...p,
      "data-phosphor-icon": "link-simple",
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
  )}><path d="M165.66 90.34a8 8 0 0 1 0 11.32l-64 64a8 8 0 0 1-11.32-11.32l64-64a8 8 0 0 1 11.32 0M215.6 40.4a56 56 0 0 0-79.2 0l-30.06 30.05a8 8 0 0 0 11.32 11.32l30.06-30a40 40 0 0 1 56.57 56.56l-30.07 30.06a8 8 0 0 0 11.31 11.32l30.07-30.11a56 56 0 0 0 0-79.2m-77.26 133.82-30.06 30.06a40 40 0 1 1-56.56-56.57l30.05-30.05a8 8 0 0 0-11.32-11.32L40.4 136.4a56 56 0 0 0 79.2 79.2l30.06-30.07a8 8 0 0 0-11.32-11.31"></path></svg>`);
}
function IconQuestionRegular($$renderer, $$props) {
  const { $$slots, $$events, ...p } = $$props;
  $$renderer.push(`<svg${attributes(
    {
      ...p,
      "data-phosphor-icon": "question",
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
  )}><path d="M140 180a12 12 0 1 1-12-12 12 12 0 0 1 12 12M128 72c-22.06 0-40 16.15-40 36v4a8 8 0 0 0 16 0v-4c0-11 10.77-20 24-20s24 9 24 20-10.77 20-24 20a8 8 0 0 0-8 8v8a8 8 0 0 0 16 0v-.72c18.24-3.35 32-17.9 32-35.28 0-19.85-17.94-36-40-36m104 56A104 104 0 1 1 128 24a104.11 104.11 0 0 1 104 104m-16 0a88 88 0 1 0-88 88 88.1 88.1 0 0 0 88-88"></path></svg>`);
}
function IconSidebarSimpleRegular($$renderer, $$props) {
  const { $$slots, $$events, ...p } = $$props;
  $$renderer.push(`<svg${attributes(
    {
      ...p,
      "data-phosphor-icon": "sidebar-simple",
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
  )}><path d="M216 40H40a16 16 0 0 0-16 16v144a16 16 0 0 0 16 16h176a16 16 0 0 0 16-16V56a16 16 0 0 0-16-16M40 56h40v144H40Zm176 144H96V56h120z"></path></svg>`);
}
function IconUserRegular($$renderer, $$props) {
  const { $$slots, $$events, ...p } = $$props;
  $$renderer.push(`<svg${attributes(
    {
      ...p,
      "data-phosphor-icon": "user",
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
  )}><path d="M230.92 212c-15.23-26.33-38.7-45.21-66.09-54.16a72 72 0 1 0-73.66 0c-27.39 8.94-50.86 27.82-66.09 54.16a8 8 0 1 0 13.85 8c18.84-32.56 52.14-52 89.07-52s70.23 19.44 89.07 52a8 8 0 1 0 13.85-8M72 96a56 56 0 1 1 56 56 56.06 56.06 0 0 1-56-56"></path></svg>`);
}
function Sidebar($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let { pendingCount = 0, categories = [] } = $$props;
    const nav = [
      { href: "/profile", label: "Profile", icon: IconUserRegular },
      {
        href: "/connections",
        label: "Connections",
        icon: IconLinkSimpleRegular
      },
      {
        href: "/settings",
        label: "Settings",
        icon: IconGearSixRegular
      }
    ];
    let isProfileActive = derived(() => store_get($$store_subs ??= {}, "$page", page).url.pathname.startsWith("/profile"));
    $$renderer2.push(`<aside${attr_class("sidebar svelte-129hoe0", void 0, { "collapsed": uiSettings.sidebarCollapsed })} aria-label="Primary navigation"><div class="sidebar-inner svelte-129hoe0"><div class="sidebar-header svelte-129hoe0"><div class="sidebar-header-row svelte-129hoe0"><span class="wordmark svelte-129hoe0">Dossier</span> <button class="icon-button svelte-129hoe0"${attr("aria-label", uiSettings.sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar")}>`);
    IconSidebarSimpleRegular($$renderer2, { class: "icon-20" });
    $$renderer2.push(`<!----></button></div> <a class="chat-button svelte-129hoe0" href="/chat">`);
    IconChatRegular($$renderer2, { class: "icon-20" });
    $$renderer2.push(`<!----> <span>Chat</span></a></div> <div class="sidebar-divider svelte-129hoe0"></div> <nav class="sidebar-nav svelte-129hoe0"><!--[-->`);
    const each_array = ensure_array_like(nav);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let item = each_array[$$index];
      const active = store_get($$store_subs ??= {}, "$page", page).url.pathname.startsWith(item.href);
      const Icon = item.icon;
      $$renderer2.push(`<a${attr_class("nav-item svelte-129hoe0", void 0, { "active": active })}${attr("href", item.href)}${attr("aria-current", active ? "page" : void 0)}>`);
      if (Icon) {
        $$renderer2.push("<!--[-->");
        Icon($$renderer2, { class: "icon-20" });
        $$renderer2.push("<!--]-->");
      } else {
        $$renderer2.push("<!--[!-->");
        $$renderer2.push("<!--]-->");
      }
      $$renderer2.push(` <span class="nav-label svelte-129hoe0">${escape_html(item.label)}</span> `);
      if (item.href === "/profile" && pendingCount > 0) {
        $$renderer2.push("<!--[-->");
        $$renderer2.push(`<span class="pending-dot svelte-129hoe0"${attr("aria-label", `${stringify(pendingCount)} pending inferences`)}></span>`);
      } else {
        $$renderer2.push("<!--[!-->");
      }
      $$renderer2.push(`<!--]--></a>`);
    }
    $$renderer2.push(`<!--]--> `);
    if (isProfileActive() && categories.length > 0) {
      $$renderer2.push("<!--[-->");
      $$renderer2.push(`<div class="category-subnav svelte-129hoe0"><!--[-->`);
      const each_array_1 = ensure_array_like(categories);
      for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
        let category = each_array_1[$$index_1];
        $$renderer2.push(`<a${attr_class("category-item svelte-129hoe0", void 0, { "active": false })}${attr("href", `/profile#${stringify(category.id)}`)}><span class="svelte-129hoe0">${escape_html(category.label)}</span> `);
        if (category.hasPending) {
          $$renderer2.push("<!--[-->");
          $$renderer2.push(`<span class="pending-dot svelte-129hoe0"></span>`);
        } else {
          $$renderer2.push("<!--[!-->");
        }
        $$renderer2.push(`<!--]--></a>`);
      }
      $$renderer2.push(`<!--]--></div>`);
    } else {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]--></nav> <footer class="sidebar-footer svelte-129hoe0"><a class="nav-item svelte-129hoe0" href="/help">`);
    IconQuestionRegular($$renderer2, { class: "icon-20" });
    $$renderer2.push(`<!----> <span class="nav-label svelte-129hoe0">Help</span></a></footer></div></aside>`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
function _layout($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { children } = $$props;
    let pendingCount = 0;
    let consentQueue = [];
    const categories = [
      { id: "personal", label: "Personal", hasPending: false },
      { id: "professional", label: "Professional", hasPending: false },
      { id: "interests", label: "Interests", hasPending: false },
      {
        id: "communication",
        label: "Communication",
        hasPending: false
      }
    ];
    $$renderer2.push(`<div class="app-shell svelte-12qhfyh">`);
    Sidebar($$renderer2, { pendingCount, categories });
    $$renderer2.push(`<!----> `);
    if (uiSettings.sidebarCollapsed) {
      $$renderer2.push("<!--[-->");
      $$renderer2.push(`<button class="sidebar-reopen svelte-12qhfyh" aria-label="Open sidebar">`);
      IconSidebarSimpleRegular($$renderer2, { class: "icon-20" });
      $$renderer2.push(`<!----></button>`);
    } else {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]--> <main class="content-area svelte-12qhfyh">`);
    children?.($$renderer2);
    $$renderer2.push(`<!----></main></div> `);
    if (consentQueue.length === 1 && consentQueue[0]) {
      $$renderer2.push("<!--[-->");
      ConsentModal($$renderer2, {
        serviceName: consentQueue[0].serviceName,
        requestedItems: consentQueue[0].requestedItems
      });
    } else if (consentQueue.length > 1) {
      $$renderer2.push("<!--[1-->");
      BatchedConsentView($$renderer2, {
        requests: consentQueue.map((entry) => ({
          id: entry.id,
          serviceName: entry.serviceName,
          summary: `${entry.requestedItems.length} items requested`
        }))
      });
    } else {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]-->`);
  });
}
export {
  _layout as default
};
