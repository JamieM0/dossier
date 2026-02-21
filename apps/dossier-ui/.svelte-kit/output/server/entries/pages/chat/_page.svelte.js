import { d as attributes, b as ensure_array_like, a as attr_class, f as stringify, e as escape_html, c as attr, i as derived } from "../../../chunks/index.js";
import { I as IconSparkleRegular } from "../../../chunks/IconSparkleRegular.js";
import { u as uiSettings } from "../../../chunks/ui-settings.svelte.js";
function IconCheckCircleRegular($$renderer, $$props) {
  const { $$slots, $$events, ...p } = $$props;
  $$renderer.push(`<svg${attributes(
    {
      ...p,
      "data-phosphor-icon": "check-circle",
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
  )}><path d="M173.66 98.34a8 8 0 0 1 0 11.32l-56 56a8 8 0 0 1-11.32 0l-24-24a8 8 0 0 1 11.32-11.32L112 148.69l50.34-50.35a8 8 0 0 1 11.32 0M232 128A104 104 0 1 1 128 24a104.11 104.11 0 0 1 104 104m-16 0a88 88 0 1 0-88 88 88.1 88.1 0 0 0 88-88"></path></svg>`);
}
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
function IconWarningRegular($$renderer, $$props) {
  const { $$slots, $$events, ...p } = $$props;
  $$renderer.push(`<svg${attributes(
    {
      ...p,
      "data-phosphor-icon": "warning",
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
  )}><path d="M236.8 188.09 149.35 36.22a24.76 24.76 0 0 0-42.7 0L19.2 188.09a23.51 23.51 0 0 0 0 23.72A24.35 24.35 0 0 0 40.55 224h174.9a24.35 24.35 0 0 0 21.33-12.19 23.51 23.51 0 0 0 .02-23.72m-13.87 15.71a8.5 8.5 0 0 1-7.48 4.2H40.55a8.5 8.5 0 0 1-7.48-4.2 7.59 7.59 0 0 1 0-7.72l87.45-151.87a8.75 8.75 0 0 1 15 0l87.45 151.87a7.59 7.59 0 0 1-.04 7.72M120 144v-40a8 8 0 0 1 16 0v40a8 8 0 0 1-16 0m20 36a12 12 0 1 1-12-12 12 12 0 0 1 12 12"></path></svg>`);
}
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let input = "";
    let messages = [
      {
        id: "1",
        role: "system",
        text: "Tell me about yourself, and I'll help build your profile. I can extract preferences, interests, and facts from our conversation."
      }
    ];
    let isSending = false;
    const hasLlm = derived(() => Boolean(uiSettings.localModelEndpoint && uiSettings.localModelName));
    $$renderer2.push(`<section class="chat-view svelte-23dtxz"><div class="chat-content svelte-23dtxz"><h1 class="page-heading svelte-23dtxz">Chat</h1> `);
    if (!hasLlm()) {
      $$renderer2.push("<!--[-->");
      $$renderer2.push(`<div class="warning-banner svelte-23dtxz">`);
      IconWarningRegular($$renderer2, { class: "icon-16" });
      $$renderer2.push(`<!----> <span>No AI model configured. Chat will store messages directly as inferences. Configure a model in Settings for conversational AI.</span></div>`);
    } else {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]--> <div class="chat-log svelte-23dtxz" aria-live="polite" aria-relevant="additions"><!--[-->`);
    const each_array = ensure_array_like(messages);
    for (let $$index_1 = 0, $$length = each_array.length; $$index_1 < $$length; $$index_1++) {
      let message = each_array[$$index_1];
      $$renderer2.push(`<article${attr_class(`message ${stringify(message.role)}`, "svelte-23dtxz")}><div${attr_class(`bubble ${stringify(message.role)}`, "svelte-23dtxz")}>${escape_html(message.text)}</div> `);
      if (message.proposals && message.proposals.length > 0) {
        $$renderer2.push("<!--[-->");
        $$renderer2.push(`<div class="proposals-list svelte-23dtxz"><!--[-->`);
        const each_array_1 = ensure_array_like(message.proposals);
        for (let $$index = 0, $$length2 = each_array_1.length; $$index < $$length2; $$index++) {
          let proposal = each_array_1[$$index];
          $$renderer2.push(`<div class="proposal-card svelte-23dtxz"><div class="proposal-header svelte-23dtxz">`);
          IconSparkleRegular($$renderer2, { class: "icon-14" });
          $$renderer2.push(`<!----> <span class="proposal-type svelte-23dtxz">${escape_html(proposal.itemType)}</span> `);
          if (proposal.confidence !== null) {
            $$renderer2.push("<!--[-->");
            $$renderer2.push(`<span class="proposal-confidence svelte-23dtxz">${escape_html(Math.round(proposal.confidence * 100))}%</span>`);
          } else {
            $$renderer2.push("<!--[!-->");
          }
          $$renderer2.push(`<!--]--></div> <p class="proposal-text svelte-23dtxz">${escape_html(proposal.text)}</p> `);
          if (proposal.why) {
            $$renderer2.push("<!--[-->");
            $$renderer2.push(`<p class="proposal-why svelte-23dtxz">${escape_html(proposal.why)}</p>`);
          } else {
            $$renderer2.push("<!--[!-->");
          }
          $$renderer2.push(`<!--]--></div>`);
        }
        $$renderer2.push(`<!--]--></div>`);
      } else {
        $$renderer2.push("<!--[!-->");
      }
      $$renderer2.push(`<!--]--> `);
      if (message.dataUpdate) {
        $$renderer2.push("<!--[-->");
        $$renderer2.push(`<div class="data-update-card svelte-23dtxz">`);
        IconCheckCircleRegular($$renderer2, { class: "icon-16" });
        $$renderer2.push(`<!----> <span>${escape_html(message.dataUpdate)}</span></div>`);
      } else {
        $$renderer2.push("<!--[!-->");
      }
      $$renderer2.push(`<!--]--></article>`);
    }
    $$renderer2.push(`<!--]--></div> <div class="chat-input-area svelte-23dtxz"><div class="input-wrapper svelte-23dtxz"><textarea class="chat-textarea svelte-23dtxz"${attr("placeholder", hasLlm() ? "Tell Dossier about yourself..." : "Describe a profile update to propose")} rows="3"${attr("disabled", isSending, true)}>`);
    const $$body = escape_html(input);
    if ($$body) {
      $$renderer2.push(`${$$body}`);
    }
    $$renderer2.push(`</textarea> <button class="send-btn svelte-23dtxz"${attr("disabled", !input.trim() || isSending, true)} aria-label="Send message">`);
    IconPaperPlaneRightRegular($$renderer2, { class: "icon-18" });
    $$renderer2.push(`<!----></button></div></div></div></section>`);
  });
}
export {
  _page as default
};
