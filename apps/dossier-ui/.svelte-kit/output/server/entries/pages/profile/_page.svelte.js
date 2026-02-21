import { k as ssr_context, d as attributes, e as escape_html, a as attr_class, l as clsx, c as attr, b as ensure_array_like, m as bind_props, i as derived, f as stringify } from "../../../chunks/index.js";
/* empty css                                                          */
import { I as IconCheckRegular, a as IconUserRegular } from "../../../chunks/IconCheckRegular.js";
import { I as IconSparkleRegular } from "../../../chunks/IconSparkleRegular.js";
import { u as uiSettings } from "../../../chunks/ui-settings.svelte.js";
function onDestroy(fn) {
  /** @type {SSRContext} */
  ssr_context.r.on_destroy(fn);
}
function IconChatCircleRegular($$renderer, $$props) {
  const { $$slots, $$events, ...p } = $$props;
  $$renderer.push(`<svg${attributes(
    {
      ...p,
      "data-phosphor-icon": "chat-circle",
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
  )}><path d="M128 24a104 104 0 0 0-91.82 152.88l-11.35 34.05a16 16 0 0 0 20.24 20.24l34.05-11.35A104 104 0 1 0 128 24m0 192a87.87 87.87 0 0 1-44.06-11.81 8 8 0 0 0-6.54-.67L40 216l12.47-37.4a8 8 0 0 0-.66-6.54A88 88 0 1 1 128 216"></path></svg>`);
}
function ConfirmDialog($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      title,
      message,
      confirmLabel = "Confirm",
      cancelLabel = "Cancel",
      danger = false
    } = $$props;
    $$renderer2.push(`<div class="dialog-backdrop svelte-7e0w24" role="presentation"><div class="dialog-modal svelte-7e0w24" role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-desc"><h2 id="confirm-dialog-title" class="dialog-title svelte-7e0w24">${escape_html(title)}</h2> <p id="confirm-dialog-desc" class="dialog-message svelte-7e0w24">${escape_html(message)}</p> <div class="dialog-actions svelte-7e0w24"><button class="btn-secondary svelte-7e0w24">${escape_html(cancelLabel)}</button> <button${attr_class(clsx(danger ? "btn-danger" : "btn-primary"), "svelte-7e0w24")}>${escape_html(confirmLabel)}</button></div></div></div>`);
  });
}
function IconXRegular($$renderer, $$props) {
  const { $$slots, $$events, ...p } = $$props;
  $$renderer.push(`<svg${attributes(
    {
      ...p,
      "data-phosphor-icon": "x",
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
  )}><path d="M205.66 194.34a8 8 0 0 1-11.32 11.32L128 139.31l-66.34 66.35a8 8 0 0 1-11.32-11.32L116.69 128 50.34 61.66a8 8 0 0 1 11.32-11.32L128 116.69l66.34-66.35a8 8 0 0 1 11.32 11.32L139.31 128Z"></path></svg>`);
}
function IconSpinnerRegular($$renderer, $$props) {
  const { $$slots, $$events, ...p } = $$props;
  $$renderer.push(`<svg${attributes(
    {
      ...p,
      "data-phosphor-icon": "spinner",
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
  )}><path d="M136 32v32a8 8 0 0 1-16 0V32a8 8 0 0 1 16 0m37.25 58.75a8 8 0 0 0 5.66-2.35l22.63-22.62a8 8 0 0 0-11.32-11.32L167.6 77.09a8 8 0 0 0 5.65 13.66M224 120h-32a8 8 0 0 0 0 16h32a8 8 0 0 0 0-16m-45.09 47.6a8 8 0 0 0-11.31 11.31l22.62 22.63a8 8 0 0 0 11.32-11.32ZM128 184a8 8 0 0 0-8 8v32a8 8 0 0 0 16 0v-32a8 8 0 0 0-8-8m-50.91-16.4-22.63 22.62a8 8 0 0 0 11.32 11.32l22.62-22.63a8 8 0 0 0-11.31-11.31M72 128a8 8 0 0 0-8-8H32a8 8 0 0 0 0 16h32a8 8 0 0 0 8-8m-6.22-73.54a8 8 0 0 0-11.32 11.32L77.09 88.4A8 8 0 0 0 88.4 77.09Z"></path></svg>`);
}
function AlternativesPanel($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { text } = $$props;
    $$renderer2.push(`<div class="alternatives-panel svelte-1u1lg4q"><div class="panel-header svelte-1u1lg4q"><h3 class="panel-title svelte-1u1lg4q">Alternative phrasings</h3> <button class="close-btn svelte-1u1lg4q" aria-label="Close alternatives">`);
    IconXRegular($$renderer2, { class: "icon-16" });
    $$renderer2.push(`<!----></button></div> <p class="original-text svelte-1u1lg4q">Original: "${escape_html(text)}"</p> `);
    {
      $$renderer2.push("<!--[-->");
      $$renderer2.push(`<div class="loading svelte-1u1lg4q">`);
      IconSpinnerRegular($$renderer2, { class: "icon-16 spin" });
      $$renderer2.push(`<!----> <span>Generating alternatives...</span></div>`);
    }
    $$renderer2.push(`<!--]--></div>`);
  });
}
function CommentPopout($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { itemText, provenance } = $$props;
    let comment = "";
    $$renderer2.push(`<aside class="comment-popout svelte-hrx4fk" role="dialog" aria-label="Add comment to inference"><p class="popout-item-text svelte-hrx4fk">${escape_html(itemText)}</p> <p class="popout-provenance svelte-hrx4fk">${escape_html(provenance)}</p> <textarea class="comment-input svelte-hrx4fk" placeholder="Add a correction or note..." rows="3">`);
    const $$body = escape_html(comment);
    if ($$body) {
      $$renderer2.push(`${$$body}`);
    }
    $$renderer2.push(`</textarea> <div class="popout-actions svelte-hrx4fk"><button class="btn-primary svelte-hrx4fk">Submit</button></div></aside>`);
  });
}
function IconPencilSimpleRegular($$renderer, $$props) {
  const { $$slots, $$events, ...p } = $$props;
  $$renderer.push(`<svg${attributes(
    {
      ...p,
      "data-phosphor-icon": "pencil-simple",
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
  )}><path d="m227.31 73.37-44.68-44.69a16 16 0 0 0-22.63 0L36.69 152A15.86 15.86 0 0 0 32 163.31V208a16 16 0 0 0 16 16h44.69a15.86 15.86 0 0 0 11.31-4.69L227.31 96a16 16 0 0 0 0-22.63M92.69 208H48v-44.69l88-88L180.69 120ZM192 108.68 147.31 64l24-24L216 84.68Z"></path></svg>`);
}
function IconTrashRegular($$renderer, $$props) {
  const { $$slots, $$events, ...p } = $$props;
  $$renderer.push(`<svg${attributes(
    {
      ...p,
      "data-phosphor-icon": "trash",
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
  )}><path d="M216 48h-40v-8a24 24 0 0 0-24-24h-48a24 24 0 0 0-24 24v8H40a8 8 0 0 0 0 16h8v144a16 16 0 0 0 16 16h128a16 16 0 0 0 16-16V64h8a8 8 0 0 0 0-16M96 40a8 8 0 0 1 8-8h48a8 8 0 0 1 8 8v8H96Zm96 168H64V64h128Zm-80-104v64a8 8 0 0 1-16 0v-64a8 8 0 0 1 16 0m48 0v64a8 8 0 0 1-16 0v-64a8 8 0 0 1 16 0"></path></svg>`);
}
function ItemDetailPanel($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    $$renderer2.push(`<div class="detail-overlay svelte-1fr8x2w" role="dialog" aria-label="Item detail"><div class="detail-panel svelte-1fr8x2w"><div class="detail-header svelte-1fr8x2w"><h2 class="detail-title svelte-1fr8x2w">Item detail</h2> <button class="close-btn svelte-1fr8x2w" aria-label="Close detail panel">`);
    IconXRegular($$renderer2, { class: "icon-18" });
    $$renderer2.push(`<!----></button></div> `);
    {
      $$renderer2.push("<!--[-->");
      $$renderer2.push(`<div class="loading svelte-1fr8x2w">`);
      IconSpinnerRegular($$renderer2, { class: "icon-16 spin" });
      $$renderer2.push(`<!----> <span>Loading...</span></div>`);
    }
    $$renderer2.push(`<!--]--></div></div>`);
  });
}
function ConfirmedItem($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      text,
      itemType,
      categoryName = null,
      compartmentNames = [],
      isTopicBlocked = false,
      updatedAt,
      focused = false,
      onEdit,
      onDelete,
      onDetail,
      onFocus
    } = $$props;
    let flashing = false;
    let showDetails = derived(() => focused);
    function flash() {
      flashing = true;
      setTimeout(
        () => {
          flashing = false;
        },
        400
      );
    }
    function formatDate(iso) {
      try {
        return new Date(iso).toLocaleDateString(void 0, { month: "short", day: "numeric", year: "numeric" });
      } catch {
        return iso;
      }
    }
    $$renderer2.push(`<article${attr_class("confirmed-item svelte-icfiwe", void 0, { "show-details": showDetails(), "flashing": flashing })} role="listitem" tabindex="0"${attr("aria-label", `${stringify(text)}. Confirmed. Press E to edit.`)} data-profile-item=""><div class="item-content svelte-icfiwe">`);
    if (onDetail) {
      $$renderer2.push("<!--[-->");
      $$renderer2.push(`<button class="item-text clickable svelte-icfiwe">${escape_html(text)}</button>`);
    } else {
      $$renderer2.push("<!--[!-->");
      $$renderer2.push(`<span class="item-text svelte-icfiwe">${escape_html(text)}</span>`);
    }
    $$renderer2.push(`<!--]--> `);
    if (showDetails()) {
      $$renderer2.push("<!--[-->");
      $$renderer2.push(`<div class="item-meta svelte-icfiwe"><span class="meta-date svelte-icfiwe">Confirmed ${escape_html(formatDate(updatedAt))}</span> `);
      if (categoryName) {
        $$renderer2.push("<!--[-->");
        $$renderer2.push(`<span class="meta-badge svelte-icfiwe">${escape_html(categoryName)}</span>`);
      } else {
        $$renderer2.push("<!--[!-->");
      }
      $$renderer2.push(`<!--]--> <span class="meta-badge svelte-icfiwe">${escape_html(itemType)}</span> `);
      if (isTopicBlocked) {
        $$renderer2.push("<!--[-->");
        $$renderer2.push(`<span class="meta-badge blocked svelte-icfiwe">Blocked</span>`);
      } else {
        $$renderer2.push("<!--[!-->");
      }
      $$renderer2.push(`<!--]--> <!--[-->`);
      const each_array = ensure_array_like(compartmentNames);
      for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
        let name = each_array[$$index];
        $$renderer2.push(`<span class="meta-badge svelte-icfiwe">${escape_html(name)}</span>`);
      }
      $$renderer2.push(`<!--]--></div>`);
    } else {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]--></div> `);
    if (showDetails()) {
      $$renderer2.push("<!--[-->");
      $$renderer2.push(`<div class="actions svelte-icfiwe"><button class="ghost-action svelte-icfiwe" title="Edit (E)">`);
      IconPencilSimpleRegular($$renderer2, { class: "icon-14" });
      $$renderer2.push(`<!----> <span>Edit</span></button> <button class="ghost-action delete svelte-icfiwe" title="Delete">`);
      IconTrashRegular($$renderer2, { class: "icon-14" });
      $$renderer2.push(`<!----> <span>Delete</span></button></div>`);
    } else {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]--></article>`);
    bind_props($$props, { flash });
  });
}
function IconArrowsSplitRegular($$renderer, $$props) {
  const { $$slots, $$events, ...p } = $$props;
  $$renderer.push(`<svg${attributes(
    {
      ...p,
      "data-phosphor-icon": "arrows-split",
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
  )}><path d="m229.66 189.66-32 32a8 8 0 0 1-11.32 0l-32-32a8 8 0 0 1 11.32-11.32L184 196.69v-57.38l-56-56-56 56v57.38l18.34-18.35a8 8 0 0 1 11.32 11.32l-32 32a8 8 0 0 1-11.32 0l-32-32a8 8 0 0 1 11.32-11.32L56 196.69V136a8 8 0 0 1 2.34-5.66L120 68.69V24a8 8 0 0 1 16 0v44.69l61.66 61.65A8 8 0 0 1 200 136v60.69l18.34-18.35a8 8 0 0 1 11.32 11.32"></path></svg>`);
}
function IconInfoRegular($$renderer, $$props) {
  const { $$slots, $$events, ...p } = $$props;
  $$renderer.push(`<svg${attributes(
    {
      ...p,
      "data-phosphor-icon": "info",
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
  )}><path d="M128 24a104 104 0 1 0 104 104A104.11 104.11 0 0 0 128 24m0 192a88 88 0 1 1 88-88 88.1 88.1 0 0 1-88 88m16-40a8 8 0 0 1-8 8 16 16 0 0 1-16-16v-40a8 8 0 0 1 0-16 16 16 0 0 1 16 16v40a8 8 0 0 1 8 8m-32-92a12 12 0 1 1 12 12 12 12 0 0 1-12-12"></path></svg>`);
}
function InferenceItem($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      text,
      provenance,
      why = null,
      confidence = null,
      focused = false,
      onAlternatives
    } = $$props;
    let showActions = derived(() => focused);
    $$renderer2.push(`<article${attr_class("inference-item svelte-1yq06j8", void 0, { "show-details": showActions() })} role="listitem" tabindex="0"${attr("aria-label", `Pending inference: ${stringify(text)}. Press Y to confirm, D to dismiss, C to comment.`)} data-profile-item=""><div class="item-content svelte-1yq06j8"><div class="item-text svelte-1yq06j8">`);
    IconSparkleRegular($$renderer2, { class: "sparkle-icon icon-16" });
    $$renderer2.push(`<!----> <span>${escape_html(text)}</span></div> `);
    if (showActions()) {
      $$renderer2.push("<!--[-->");
      $$renderer2.push(`<p class="provenance svelte-1yq06j8">`);
      IconInfoRegular($$renderer2, { class: "icon-14" });
      $$renderer2.push(`<!----> <span>${escape_html(provenance)}</span></p> `);
      if (why) {
        $$renderer2.push("<!--[-->");
        $$renderer2.push(`<p class="provenance svelte-1yq06j8"><span>Why:</span> <span>${escape_html(why)}</span></p>`);
      } else {
        $$renderer2.push("<!--[!-->");
      }
      $$renderer2.push(`<!--]--> `);
      if (confidence !== null) {
        $$renderer2.push("<!--[-->");
        $$renderer2.push(`<p class="provenance svelte-1yq06j8"><span>Confidence:</span> <span>${escape_html(Math.round(confidence * 100))}%</span></p>`);
      } else {
        $$renderer2.push("<!--[!-->");
      }
      $$renderer2.push(`<!--]-->`);
    } else {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]--></div> `);
    if (showActions()) {
      $$renderer2.push("<!--[-->");
      $$renderer2.push(`<div class="actions svelte-1yq06j8"><button class="ghost-action confirm svelte-1yq06j8" title="Confirm (Y)">`);
      IconCheckRegular($$renderer2, { class: "icon-14" });
      $$renderer2.push(`<!----> <span>Confirm</span></button> <button class="ghost-action dismiss svelte-1yq06j8" title="Dismiss (D)">`);
      IconXRegular($$renderer2, { class: "icon-14" });
      $$renderer2.push(`<!----> <span>Dismiss</span></button> <button class="ghost-action svelte-1yq06j8" title="Comment (C)">`);
      IconChatCircleRegular($$renderer2, { class: "icon-14" });
      $$renderer2.push(`<!----> <span>Comment</span></button> `);
      if (onAlternatives) {
        $$renderer2.push("<!--[-->");
        $$renderer2.push(`<button class="ghost-action svelte-1yq06j8" title="Alternatives">`);
        IconArrowsSplitRegular($$renderer2, { class: "icon-14" });
        $$renderer2.push(`<!----> <span>Alternatives</span></button>`);
      } else {
        $$renderer2.push("<!--[!-->");
      }
      $$renderer2.push(`<!--]--></div>`);
    } else {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]--></article>`);
  });
}
function NotificationBanner($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { count = 0, onReviewAll } = $$props;
    let visible = derived(() => count > 0 && true);
    if (visible()) {
      $$renderer2.push("<!--[-->");
      $$renderer2.push(`<section class="notification-banner svelte-i4s023" aria-live="polite"><p class="banner-text svelte-i4s023">${escape_html(count)} ${escape_html(count === 1 ? "inference is" : "inferences are")} waiting for review.</p> <div class="banner-actions svelte-i4s023">`);
      if (onReviewAll) {
        $$renderer2.push("<!--[-->");
        $$renderer2.push(`<button class="review-btn svelte-i4s023">Review all</button>`);
      } else {
        $$renderer2.push("<!--[!-->");
      }
      $$renderer2.push(`<!--]--> <button class="close-btn svelte-i4s023" aria-label="Dismiss notification">`);
      IconXRegular($$renderer2, { class: "icon-16" });
      $$renderer2.push(`<!----></button></div></section>`);
    } else {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]-->`);
  });
}
function IconPlusRegular($$renderer, $$props) {
  const { $$slots, $$events, ...p } = $$props;
  $$renderer.push(`<svg${attributes(
    {
      ...p,
      "data-phosphor-icon": "plus",
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
  )}><path d="M224 128a8 8 0 0 1-8 8h-80v80a8 8 0 0 1-16 0v-80H40a8 8 0 0 1 0-16h80V40a8 8 0 0 1 16 0v80h80a8 8 0 0 1 8 8"></path></svg>`);
}
function IconUploadSimpleRegular($$renderer, $$props) {
  const { $$slots, $$events, ...p } = $$props;
  $$renderer.push(`<svg${attributes(
    {
      ...p,
      "data-phosphor-icon": "upload-simple",
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
  )}><path d="M224 144v64a8 8 0 0 1-8 8H40a8 8 0 0 1-8-8v-64a8 8 0 0 1 16 0v56h160v-56a8 8 0 0 1 16 0M93.66 77.66 120 51.31V144a8 8 0 0 0 16 0V51.31l26.34 26.35a8 8 0 0 0 11.32-11.32l-40-40a8 8 0 0 0-11.32 0l-40 40a8 8 0 0 0 11.32 11.32"></path></svg>`);
}
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const ITEM_TYPES = [
      "preference",
      "communication",
      "interest",
      "professional",
      "fact",
      "constraint"
    ];
    let items = [];
    let categories = [];
    let compartments = [];
    let editTargetId = null;
    let editText = "";
    let editType = "preference";
    let editCategoryId = null;
    let editCompartmentIds = [];
    let deleteTargetId = null;
    let commentTarget = null;
    let alternativesTarget = null;
    let detailTargetId = null;
    let focusedIndex = -1;
    const confirmedItems = derived(() => items.filter((item) => item.state === "CONFIRMED").sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at)));
    const pendingInferences = derived(() => items.filter((item) => item.state === "INFERENCE_PENDING").sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)));
    const pendingCount = derived(() => pendingInferences().length);
    const categoryById = derived(() => new Map(categories.map((c) => [c.category_id, c])));
    const compartmentById = derived(() => new Map(compartments.map((c) => [c.compartment_id, c])));
    const itemsByCategory = derived(() => () => {
      const groups = /* @__PURE__ */ new Map();
      const uncategorized = { confirmed: [], pending: [] };
      for (const category of categories) {
        groups.set(category.category_id, { confirmed: [], pending: [] });
      }
      for (const item of items) {
        const key = item.category_id ?? "__uncategorized__";
        const group = groups.get(key) ?? uncategorized;
        if (item.state === "CONFIRMED") {
          group.confirmed.push(item);
        } else if (item.state === "INFERENCE_PENDING") {
          group.pending.push(item);
        }
      }
      return { groups, uncategorized };
    });
    const allProfileItems = derived(() => [...pendingInferences(), ...confirmedItems()]);
    function compartmentNames(item) {
      return item.compartment_ids.map((id) => compartmentById().get(id)?.name).filter((name) => Boolean(name));
    }
    function categoryIdOrNull(value) {
      return value === "" ? null : value;
    }
    function startEdit(item) {
      editTargetId = item.item_id;
      editText = item.text;
      editType = item.item_type;
      editCategoryId = item.category_id ?? null;
      editCompartmentIds = [...item.compartment_ids];
    }
    onDestroy(() => {
      uiSettings.showingWelcome = false;
    });
    $$renderer2.push(`<section class="profile-view svelte-maq4gq"><div class="profile-content svelte-maq4gq">`);
    {
      $$renderer2.push("<!--[!-->");
      const grouped = itemsByCategory()();
      NotificationBanner($$renderer2, {
        count: pendingCount(),
        onReviewAll: () => document.getElementById("pending-inferences")?.scrollIntoView({ behavior: "smooth", block: "start" })
      });
      $$renderer2.push(`<!----> `);
      {
        $$renderer2.push("<!--[!-->");
      }
      $$renderer2.push(`<!--]--> `);
      {
        $$renderer2.push("<!--[!-->");
      }
      $$renderer2.push(`<!--]--> <div class="profile-actions-bar svelte-maq4gq"><button class="action-btn svelte-maq4gq">`);
      IconPlusRegular($$renderer2, { class: "icon-18" });
      $$renderer2.push(`<!----> <span>Add item</span></button> <button class="action-btn svelte-maq4gq">`);
      IconUploadSimpleRegular($$renderer2, { class: "icon-18" });
      $$renderer2.push(`<!----> <span>Import</span></button></div> `);
      {
        $$renderer2.push("<!--[!-->");
      }
      $$renderer2.push(`<!--]--> `);
      {
        $$renderer2.push("<!--[!-->");
      }
      $$renderer2.push(`<!--]--> `);
      {
        $$renderer2.push("<!--[!-->");
      }
      $$renderer2.push(`<!--]--> `);
      if (pendingInferences().length > 0) {
        $$renderer2.push("<!--[-->");
        $$renderer2.push(`<section id="pending-inferences"><h2 class="category-heading svelte-maq4gq">Pending inferences</h2> <div role="list"><!--[-->`);
        const each_array_4 = ensure_array_like(pendingInferences());
        for (let i = 0, $$length = each_array_4.length; i < $$length; i++) {
          let inference = each_array_4[i];
          $$renderer2.push(`<div class="item-wrap svelte-maq4gq"${attr("data-profile-item", i)}>`);
          InferenceItem($$renderer2, {
            text: inference.text,
            provenance: inference.provenance?.source_label ?? "System inference",
            why: inference.provenance?.why_dossier_thinks_this ?? null,
            confidence: inference.provenance?.confidence ?? null,
            focused: focusedIndex === i,
            onAlternatives: () => {
              alternativesTarget = inference;
            }
          });
          $$renderer2.push(`<!----> `);
          if (commentTarget?.item_id === inference.item_id) {
            $$renderer2.push("<!--[-->");
            $$renderer2.push(`<div class="comment-anchor svelte-maq4gq">`);
            CommentPopout($$renderer2, {
              itemText: commentTarget.text,
              provenance: commentTarget.provenance?.source_label ?? "System inference"
            });
            $$renderer2.push(`<!----></div>`);
          } else {
            $$renderer2.push("<!--[!-->");
          }
          $$renderer2.push(`<!--]--> `);
          if (alternativesTarget?.item_id === inference.item_id) {
            $$renderer2.push("<!--[-->");
            AlternativesPanel($$renderer2, {
              text: alternativesTarget.text,
              itemType: alternativesTarget.item_type,
              why: alternativesTarget.provenance?.why_dossier_thinks_this
            });
          } else {
            $$renderer2.push("<!--[!-->");
          }
          $$renderer2.push(`<!--]--></div>`);
        }
        $$renderer2.push(`<!--]--></div></section>`);
      } else {
        $$renderer2.push("<!--[!-->");
      }
      $$renderer2.push(`<!--]--> <!--[-->`);
      const each_array_5 = ensure_array_like(categories);
      for (let $$index_9 = 0, $$length = each_array_5.length; $$index_9 < $$length; $$index_9++) {
        let category = each_array_5[$$index_9];
        const grouped2 = itemsByCategory()();
        const group = grouped2.groups.get(category.category_id);
        if (group && group.confirmed.length > 0) {
          $$renderer2.push("<!--[-->");
          $$renderer2.push(`<section${attr("id", `category-${stringify(category.category_id)}`)}><h2 class="category-heading svelte-maq4gq">${escape_html(category.name)}</h2> <div role="list"><!--[-->`);
          const each_array_6 = ensure_array_like(group.confirmed.sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at)));
          for (let $$index_8 = 0, $$length2 = each_array_6.length; $$index_8 < $$length2; $$index_8++) {
            let item = each_array_6[$$index_8];
            const itemIndex = allProfileItems().findIndex((p) => p.item_id === item.item_id);
            $$renderer2.push(`<div${attr("data-profile-item", itemIndex)}>`);
            if (editTargetId === item.item_id) {
              $$renderer2.push("<!--[-->");
              $$renderer2.push(`<div class="edit-panel svelte-maq4gq"><input class="text-input edit-input svelte-maq4gq"${attr("value", editText)}/> <div class="form-row svelte-maq4gq">`);
              $$renderer2.select(
                { class: "text-input", value: editType },
                ($$renderer3) => {
                  $$renderer3.push(`<!--[-->`);
                  const each_array_7 = ensure_array_like(ITEM_TYPES);
                  for (let $$index_5 = 0, $$length3 = each_array_7.length; $$index_5 < $$length3; $$index_5++) {
                    let itemType = each_array_7[$$index_5];
                    $$renderer3.option({ value: itemType }, ($$renderer4) => {
                      $$renderer4.push(`${escape_html(itemType)}`);
                    });
                  }
                  $$renderer3.push(`<!--]-->`);
                },
                "svelte-maq4gq"
              );
              $$renderer2.push(` `);
              $$renderer2.select(
                {
                  class: "text-input",
                  value: editCategoryId ?? "",
                  onchange: (event) => {
                    editCategoryId = categoryIdOrNull(event.currentTarget.value);
                  }
                },
                ($$renderer3) => {
                  $$renderer3.option({ value: "" }, ($$renderer4) => {
                    $$renderer4.push(`No category`);
                  });
                  $$renderer3.push(`<!--[-->`);
                  const each_array_8 = ensure_array_like(categories);
                  for (let $$index_6 = 0, $$length3 = each_array_8.length; $$index_6 < $$length3; $$index_6++) {
                    let cat = each_array_8[$$index_6];
                    $$renderer3.option({ value: cat.category_id }, ($$renderer4) => {
                      $$renderer4.push(`${escape_html(cat.name)}`);
                    });
                  }
                  $$renderer3.push(`<!--]-->`);
                },
                "svelte-maq4gq"
              );
              $$renderer2.push(`</div> `);
              if (compartments.length > 0) {
                $$renderer2.push("<!--[-->");
                $$renderer2.push(`<div class="compartment-pills svelte-maq4gq"><!--[-->`);
                const each_array_9 = ensure_array_like(compartments);
                for (let $$index_7 = 0, $$length3 = each_array_9.length; $$index_7 < $$length3; $$index_7++) {
                  let compartment = each_array_9[$$index_7];
                  $$renderer2.push(`<label class="compartment-pill svelte-maq4gq"><input type="checkbox"${attr("checked", editCompartmentIds.includes(compartment.compartment_id), true)}/> <span>${escape_html(compartment.name)}</span></label>`);
                }
                $$renderer2.push(`<!--]--></div>`);
              } else {
                $$renderer2.push("<!--[!-->");
              }
              $$renderer2.push(`<!--]--> <div class="panel-actions svelte-maq4gq"><button class="btn-secondary svelte-maq4gq">Cancel</button> <button class="btn-primary svelte-maq4gq">Save</button></div></div>`);
            } else {
              $$renderer2.push("<!--[!-->");
              ConfirmedItem($$renderer2, {
                text: item.text,
                itemType: item.item_type,
                categoryName: categoryById().get(item.category_id ?? "")?.name ?? null,
                compartmentNames: compartmentNames(item),
                isTopicBlocked: item.topic?.is_topic_blocked ?? false,
                updatedAt: item.updated_at,
                focused: focusedIndex === itemIndex,
                onEdit: () => startEdit(item),
                onDelete: () => {
                  deleteTargetId = item.item_id;
                },
                onDetail: () => {
                  detailTargetId = item.item_id;
                },
                onFocus: () => {
                  focusedIndex = itemIndex;
                }
              });
            }
            $$renderer2.push(`<!--]--></div>`);
          }
          $$renderer2.push(`<!--]--></div></section>`);
        } else {
          $$renderer2.push("<!--[!-->");
        }
        $$renderer2.push(`<!--]-->`);
      }
      $$renderer2.push(`<!--]-->  `);
      if (grouped.uncategorized.confirmed.length > 0) {
        $$renderer2.push("<!--[-->");
        $$renderer2.push(`<section id="category-uncategorized"><h2 class="category-heading svelte-maq4gq">Uncategorized</h2> <div role="list"><!--[-->`);
        const each_array_10 = ensure_array_like(grouped.uncategorized.confirmed.sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at)));
        for (let $$index_13 = 0, $$length = each_array_10.length; $$index_13 < $$length; $$index_13++) {
          let item = each_array_10[$$index_13];
          const itemIndex = allProfileItems().findIndex((p) => p.item_id === item.item_id);
          $$renderer2.push(`<div${attr("data-profile-item", itemIndex)}>`);
          if (editTargetId === item.item_id) {
            $$renderer2.push("<!--[-->");
            $$renderer2.push(`<div class="edit-panel svelte-maq4gq"><input class="text-input edit-input svelte-maq4gq"${attr("value", editText)}/> <div class="form-row svelte-maq4gq">`);
            $$renderer2.select(
              { class: "text-input", value: editType },
              ($$renderer3) => {
                $$renderer3.push(`<!--[-->`);
                const each_array_11 = ensure_array_like(ITEM_TYPES);
                for (let $$index_10 = 0, $$length2 = each_array_11.length; $$index_10 < $$length2; $$index_10++) {
                  let itemType = each_array_11[$$index_10];
                  $$renderer3.option({ value: itemType }, ($$renderer4) => {
                    $$renderer4.push(`${escape_html(itemType)}`);
                  });
                }
                $$renderer3.push(`<!--]-->`);
              },
              "svelte-maq4gq"
            );
            $$renderer2.push(` `);
            $$renderer2.select(
              {
                class: "text-input",
                value: editCategoryId ?? "",
                onchange: (event) => {
                  editCategoryId = categoryIdOrNull(event.currentTarget.value);
                }
              },
              ($$renderer3) => {
                $$renderer3.option({ value: "" }, ($$renderer4) => {
                  $$renderer4.push(`No category`);
                });
                $$renderer3.push(`<!--[-->`);
                const each_array_12 = ensure_array_like(categories);
                for (let $$index_11 = 0, $$length2 = each_array_12.length; $$index_11 < $$length2; $$index_11++) {
                  let cat = each_array_12[$$index_11];
                  $$renderer3.option({ value: cat.category_id }, ($$renderer4) => {
                    $$renderer4.push(`${escape_html(cat.name)}`);
                  });
                }
                $$renderer3.push(`<!--]-->`);
              },
              "svelte-maq4gq"
            );
            $$renderer2.push(`</div> `);
            if (compartments.length > 0) {
              $$renderer2.push("<!--[-->");
              $$renderer2.push(`<div class="compartment-pills svelte-maq4gq"><!--[-->`);
              const each_array_13 = ensure_array_like(compartments);
              for (let $$index_12 = 0, $$length2 = each_array_13.length; $$index_12 < $$length2; $$index_12++) {
                let compartment = each_array_13[$$index_12];
                $$renderer2.push(`<label class="compartment-pill svelte-maq4gq"><input type="checkbox"${attr("checked", editCompartmentIds.includes(compartment.compartment_id), true)}/> <span>${escape_html(compartment.name)}</span></label>`);
              }
              $$renderer2.push(`<!--]--></div>`);
            } else {
              $$renderer2.push("<!--[!-->");
            }
            $$renderer2.push(`<!--]--> <div class="panel-actions svelte-maq4gq"><button class="btn-secondary svelte-maq4gq">Cancel</button> <button class="btn-primary svelte-maq4gq">Save</button></div></div>`);
          } else {
            $$renderer2.push("<!--[!-->");
            ConfirmedItem($$renderer2, {
              text: item.text,
              itemType: item.item_type,
              categoryName: null,
              compartmentNames: compartmentNames(item),
              isTopicBlocked: item.topic?.is_topic_blocked ?? false,
              updatedAt: item.updated_at,
              focused: focusedIndex === itemIndex,
              onEdit: () => startEdit(item),
              onDelete: () => {
                deleteTargetId = item.item_id;
              },
              onFocus: () => {
                focusedIndex = itemIndex;
              }
            });
          }
          $$renderer2.push(`<!--]--></div>`);
        }
        $$renderer2.push(`<!--]--></div></section>`);
      } else {
        $$renderer2.push("<!--[!-->");
      }
      $$renderer2.push(`<!--]--> `);
      if (items.length === 0) {
        $$renderer2.push("<!--[-->");
        $$renderer2.push(`<div class="empty-state svelte-maq4gq">`);
        IconUserRegular($$renderer2, { class: "icon-32" });
        $$renderer2.push(`<!----> <p class="empty-heading svelte-maq4gq">Your profile is empty</p> <p class="empty-desc svelte-maq4gq">Add items manually or import data to get started.</p></div>`);
      } else {
        $$renderer2.push("<!--[!-->");
      }
      $$renderer2.push(`<!--]-->`);
    }
    $$renderer2.push(`<!--]--></div></section> `);
    if (deleteTargetId) {
      $$renderer2.push("<!--[-->");
      ConfirmDialog($$renderer2, {
        title: "Delete item",
        message: "This permanently deletes the item and cannot be undone.",
        confirmLabel: "Delete permanently",
        danger: true
      });
    } else {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (detailTargetId) {
      $$renderer2.push("<!--[-->");
      ItemDetailPanel($$renderer2);
    } else {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]-->`);
  });
}
export {
  _page as default
};
