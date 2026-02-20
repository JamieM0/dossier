import { b as attributes, a as ensure_array_like, c as attr_class, f as stringify, e as escape_html, d as attr } from "../../../chunks/index.js";
import { I as IconCheckCircleRegular } from "../../../chunks/IconCheckCircleRegular.js";
function IconPaperPlaneRightRegular($$renderer, $$props) {
  const { $$slots, $$events, ...p } = $$props;
  $$renderer.push(`<svg${attributes(
    {
      ...p,
      "data-phosphor-icon": "paper-plane-right",
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
  )}><path d="m231.87 114-168-95.89a16 16 0 0 0-22.95 19.23L71.55 128l-30.63 90.67A16 16 0 0 0 56 240a16.15 16.15 0 0 0 7.93-2.1l167.92-96.05a16 16 0 0 0 .05-27.89ZM56 224a.6.6 0 0 0 0-.12L85.74 136H144a8 8 0 0 0 0-16H85.74L56.06 32.16A.5.5 0 0 0 56 32l168 95.83Z"></path></svg>`);
}
function _page($$renderer) {
  let input = "";
  let messages = [
    {
      id: "1",
      role: "system",
      text: "Tell me what to store, and I will propose profile updates for your review."
    }
  ];
  $$renderer.push(`<section class="chat-view svelte-23dtxz"><div class="chat-content svelte-23dtxz"><h1 class="chat-title svelte-23dtxz">Chat</h1> <div class="chat-log svelte-23dtxz"><!--[-->`);
  const each_array = ensure_array_like(messages);
  for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
    let message = each_array[$$index];
    $$renderer.push(`<article${attr_class(`message ${stringify(message.role)}`, "svelte-23dtxz")}><div${attr_class(`bubble ${stringify(message.role)}`, "svelte-23dtxz")}>${escape_html(message.text)}</div> `);
    if (message.dataUpdate) {
      $$renderer.push("<!--[-->");
      $$renderer.push(`<div class="data-update-card svelte-23dtxz">`);
      IconCheckCircleRegular($$renderer, { class: "icon-16" });
      $$renderer.push(`<!----> <span>${escape_html(message.dataUpdate)}</span></div>`);
    } else {
      $$renderer.push("<!--[!-->");
    }
    $$renderer.push(`<!--]--></article>`);
  }
  $$renderer.push(`<!--]--></div> <div class="chat-input-area svelte-23dtxz"><div class="input-wrapper svelte-23dtxz"><textarea class="chat-textarea svelte-23dtxz" placeholder="Ask Dossier to propose profile updates" rows="3">`);
  const $$body = escape_html(input);
  if ($$body) {
    $$renderer.push(`${$$body}`);
  }
  $$renderer.push(`</textarea> <button class="send-btn svelte-23dtxz"${attr("disabled", !input.trim(), true)} aria-label="Send message">`);
  IconPaperPlaneRightRegular($$renderer, { class: "icon-18" });
  $$renderer.push(`<!----></button></div></div></div></section>`);
}
export {
  _page as default
};
