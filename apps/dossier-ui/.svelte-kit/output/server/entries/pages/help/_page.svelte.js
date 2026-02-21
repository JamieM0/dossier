import { a as attr_class, c as attr, b as ensure_array_like, e as escape_html } from "../../../chunks/index.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const isMac = typeof navigator !== "undefined" && navigator.platform.toUpperCase().includes("MAC");
    const mod = isMac ? "Cmd" : "Ctrl";
    const groups = [
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
          {
            keys: ["P"],
            description: "Jump to previous pending inference"
          },
          { keys: ["Y", "A"], description: "Confirm focused inference" },
          { keys: ["D"], description: "Dismiss focused inference" },
          { keys: ["C"], description: "Comment on focused inference" },
          { keys: ["E"], description: "Edit focused confirmed item" },
          {
            keys: ["Enter", "Space"],
            description: "Expand/collapse complex inference"
          },
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
    let activeTab = "shortcuts";
    $$renderer2.push(`<section class="help-view svelte-1vby5nc"><div class="help-content svelte-1vby5nc"><h1 class="page-heading svelte-1vby5nc">Help</h1> <div class="help-tabs svelte-1vby5nc" role="tablist"><button${attr_class("tab svelte-1vby5nc", void 0, { "active": activeTab === "shortcuts" })} role="tab" id="tab-shortcuts"${attr("aria-selected", activeTab === "shortcuts")} aria-controls="panel-shortcuts">Keyboard Shortcuts</button> <button${attr_class("tab svelte-1vby5nc", void 0, { "active": activeTab === "getting-started" })} role="tab" id="tab-getting-started"${attr("aria-selected", activeTab === "getting-started")} aria-controls="panel-getting-started">Getting Started</button> <button${attr_class("tab svelte-1vby5nc", void 0, { "active": activeTab === "about" })} role="tab" id="tab-about"${attr("aria-selected", activeTab === "about")} aria-controls="panel-about">About Dossier</button></div> `);
    {
      $$renderer2.push("<!--[-->");
      $$renderer2.push(`<div class="shortcuts-view svelte-1vby5nc" role="tabpanel" id="panel-shortcuts" aria-labelledby="tab-shortcuts"><!--[-->`);
      const each_array = ensure_array_like(groups);
      for (let $$index_2 = 0, $$length = each_array.length; $$index_2 < $$length; $$index_2++) {
        let group = each_array[$$index_2];
        $$renderer2.push(`<section class="shortcut-group"><h3 class="group-heading svelte-1vby5nc">${escape_html(group.title)}</h3> <div class="shortcut-list svelte-1vby5nc"><!--[-->`);
        const each_array_1 = ensure_array_like(group.shortcuts);
        for (let $$index_1 = 0, $$length2 = each_array_1.length; $$index_1 < $$length2; $$index_1++) {
          let shortcut = each_array_1[$$index_1];
          $$renderer2.push(`<div class="shortcut-row svelte-1vby5nc"><div class="shortcut-keys svelte-1vby5nc"><!--[-->`);
          const each_array_2 = ensure_array_like(shortcut.keys);
          for (let i = 0, $$length3 = each_array_2.length; i < $$length3; i++) {
            let key = each_array_2[i];
            if (i > 0) {
              $$renderer2.push("<!--[-->");
              $$renderer2.push(`<span class="key-separator svelte-1vby5nc">/</span>`);
            } else {
              $$renderer2.push("<!--[!-->");
            }
            $$renderer2.push(`<!--]--> <kbd>${escape_html(key)}</kbd>`);
          }
          $$renderer2.push(`<!--]--></div> <span class="shortcut-desc svelte-1vby5nc">${escape_html(shortcut.description)}</span></div>`);
        }
        $$renderer2.push(`<!--]--></div></section>`);
      }
      $$renderer2.push(`<!--]--></div>`);
    }
    $$renderer2.push(`<!--]--></div></section>`);
  });
}
export {
  _page as default
};
