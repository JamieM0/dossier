import { a as attr_class, c as attr, b as ensure_array_like, e as escape_html } from "../../../chunks/index.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const EVENT_LABELS = {
      CONSENT_DECIDED: "Consent decided",
      DISCLOSURE_SENT: "Data shared",
      DISCLOSURE_BLOCKED_ITEM_OVERRIDDEN: "Blocked item override",
      OUTPUT_USED_ITEM: "Item used internally",
      INFERENCE_CREATED: "Inference created",
      INFERENCE_CONFIRMED: "Inference confirmed",
      INFERENCE_SUPPRESSED: "Inference suppressed"
    };
    let activeView = "shared";
    let events = [];
    let services = [];
    let isLoading = false;
    let status = "";
    let serviceFilter = "";
    let itemFilter = "";
    let dateFrom = "";
    let dateTo = "";
    function humanizeEventType(raw) {
      return EVENT_LABELS[raw] ?? raw.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
    }
    function formatTimestamp(iso) {
      try {
        const date = new Date(iso);
        const now = /* @__PURE__ */ new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffHours = diffMs / (1e3 * 60 * 60);
        if (diffHours < 1) {
          const diffMinutes = Math.floor(diffMs / (1e3 * 60));
          return diffMinutes <= 1 ? "Just now" : `${diffMinutes} minutes ago`;
        }
        if (diffHours < 24) {
          return `${Math.floor(diffHours)} hours ago`;
        }
        if (diffHours < 48) {
          return "Yesterday";
        }
        return date.toLocaleDateString(void 0, {
          month: "short",
          day: "numeric",
          year: date.getFullYear() !== now.getFullYear() ? "numeric" : void 0,
          hour: "2-digit",
          minute: "2-digit"
        });
      } catch {
        return iso;
      }
    }
    function formatDetails(json) {
      if (!json || typeof json !== "object") return [];
      const entries = [];
      for (const [key, value] of Object.entries(json)) {
        const label = key.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
        entries.push({
          key: label,
          value: typeof value === "string" ? value : JSON.stringify(value)
        });
      }
      return entries;
    }
    $$renderer2.push(`<section class="audit-view svelte-1qyu7y8"><div class="audit-content svelte-1qyu7y8"><h1 class="page-heading svelte-1qyu7y8">Audit</h1> <div class="tab-row svelte-1qyu7y8" role="tablist" aria-label="Audit view"><button${attr_class("tab svelte-1qyu7y8", void 0, { "active": activeView === "shared" })} role="tab"${attr("aria-selected", activeView === "shared")} id="tab-shared" aria-controls="panel-shared">Shared externally</button> <button${attr_class("tab svelte-1qyu7y8", void 0, { "active": activeView === "used" })} role="tab"${attr("aria-selected", activeView === "used")} id="tab-used" aria-controls="panel-used">Used by Dossier</button></div> <div class="filters svelte-1qyu7y8">`);
    $$renderer2.select(
      { class: "text-input", value: serviceFilter },
      ($$renderer3) => {
        $$renderer3.option({ value: "" }, ($$renderer4) => {
          $$renderer4.push(`All services`);
        });
        $$renderer3.push(`<!--[-->`);
        const each_array = ensure_array_like(services);
        for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
          let service = each_array[$$index];
          $$renderer3.option({ value: service.service_id }, ($$renderer4) => {
            $$renderer4.push(`${escape_html(service.display_name)}`);
          });
        }
        $$renderer3.push(`<!--]-->`);
      },
      "svelte-1qyu7y8"
    );
    $$renderer2.push(` <input class="text-input svelte-1qyu7y8"${attr("value", itemFilter)} placeholder="Item text filter"/> <input class="text-input svelte-1qyu7y8" type="date"${attr("value", dateFrom)} aria-label="Date from"/> <input class="text-input svelte-1qyu7y8" type="date"${attr("value", dateTo)} aria-label="Date to"/> <button class="btn-secondary svelte-1qyu7y8"${attr("disabled", isLoading, true)}>Apply</button></div> <p class="status-text svelte-1qyu7y8">${escape_html(status)}</p> <div class="events svelte-1qyu7y8" role="tabpanel"${attr("id", "panel-shared")}${attr("aria-labelledby", "tab-shared")}>`);
    if (events.length === 0 && !isLoading) {
      $$renderer2.push("<!--[-->");
      $$renderer2.push(`<p class="empty svelte-1qyu7y8">No matching audit events.</p>`);
    } else {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]--> <!--[-->`);
    const each_array_1 = ensure_array_like(events);
    for (let $$index_2 = 0, $$length = each_array_1.length; $$index_2 < $$length; $$index_2++) {
      let event = each_array_1[$$index_2];
      $$renderer2.push(`<article class="event-card svelte-1qyu7y8"><header class="svelte-1qyu7y8"><h2 class="event-type svelte-1qyu7y8">${escape_html(humanizeEventType(event.event_type))}</h2> <time class="event-time svelte-1qyu7y8">${escape_html(formatTimestamp(event.timestamp))}</time></header> <div class="event-meta svelte-1qyu7y8"><span><strong>Actor:</strong> ${escape_html(event.actor)}</span> `);
      if (event.service_id) {
        $$renderer2.push("<!--[-->");
        $$renderer2.push(`<span><strong>Service:</strong> ${escape_html(services.find((s) => s.service_id === event.service_id)?.display_name ?? event.service_id)}</span>`);
      } else {
        $$renderer2.push("<!--[!-->");
      }
      $$renderer2.push(`<!--]--> `);
      if (event.item_id) {
        $$renderer2.push("<!--[-->");
        $$renderer2.push(`<span><strong>Item:</strong> ${escape_html(event.item_id)}</span>`);
      } else {
        $$renderer2.push("<!--[!-->");
      }
      $$renderer2.push(`<!--]--></div> `);
      if (event.details_json) {
        $$renderer2.push("<!--[-->");
        const details = formatDetails(event.details_json);
        if (details.length > 0) {
          $$renderer2.push("<!--[-->");
          $$renderer2.push(`<div class="event-details svelte-1qyu7y8"><!--[-->`);
          const each_array_2 = ensure_array_like(details);
          for (let $$index_1 = 0, $$length2 = each_array_2.length; $$index_1 < $$length2; $$index_1++) {
            let detail = each_array_2[$$index_1];
            $$renderer2.push(`<div class="detail-row svelte-1qyu7y8"><span class="detail-key svelte-1qyu7y8">${escape_html(detail.key)}</span> <span class="detail-value svelte-1qyu7y8">${escape_html(detail.value)}</span></div>`);
          }
          $$renderer2.push(`<!--]--></div>`);
        } else {
          $$renderer2.push("<!--[!-->");
        }
        $$renderer2.push(`<!--]-->`);
      } else {
        $$renderer2.push("<!--[!-->");
      }
      $$renderer2.push(`<!--]--></article>`);
    }
    $$renderer2.push(`<!--]--></div></div></section>`);
  });
}
export {
  _page as default
};
