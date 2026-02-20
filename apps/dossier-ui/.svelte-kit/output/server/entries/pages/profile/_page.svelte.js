import { c as attr_class, d as attr, e as escape_html, f as stringify, b as attributes, i as derived, a as ensure_array_like, ae as attr_style } from "../../../chunks/index.js";
import { I as IconCheckRegular } from "../../../chunks/IconCheckRegular.js";
import { I as IconCheckCircleRegular } from "../../../chunks/IconCheckCircleRegular.js";
function ConfirmedItem($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { text } = $$props;
    let hovered = false;
    let flashing = false;
    $$renderer2.push(`<article${attr_class("confirmed-item svelte-icfiwe", void 0, { "hovered": hovered, "flashing": flashing })} role="listitem" tabindex="0"${attr("aria-label", `${stringify(text)}. Confirmed. Press E to edit.`)}><div class="item-content svelte-icfiwe">`);
    {
      $$renderer2.push("<!--[!-->");
      $$renderer2.push(`<p class="item-text svelte-icfiwe">${escape_html(text)}</p>`);
    }
    $$renderer2.push(`<!--]--> `);
    {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]--></div> `);
    {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]--></article>`);
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
function IconSparkleRegular($$renderer, $$props) {
  const { $$slots, $$events, ...p } = $$props;
  $$renderer.push(`<svg${attributes(
    {
      ...p,
      "data-phosphor-icon": "sparkle",
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
  )}><path d="M197.58 129.06 146 110l-19-51.62a15.92 15.92 0 0 0-29.88 0L78 110l-51.62 19a15.92 15.92 0 0 0 0 29.88L78 178l19 51.62a15.92 15.92 0 0 0 29.88 0L146 178l51.62-19a15.92 15.92 0 0 0 0-29.88ZM137 164.22a8 8 0 0 0-4.74 4.74L112 223.85 91.78 169a8 8 0 0 0-4.78-4.78L32.15 144 87 123.78a8 8 0 0 0 4.78-4.78L112 64.15 132.22 119a8 8 0 0 0 4.74 4.74L191.85 144ZM144 40a8 8 0 0 1 8-8h16V16a8 8 0 0 1 16 0v16h16a8 8 0 0 1 0 16h-16v16a8 8 0 0 1-16 0V48h-16a8 8 0 0 1-8-8m104 48a8 8 0 0 1-8 8h-8v8a8 8 0 0 1-16 0v-8h-8a8 8 0 0 1 0-16h8v-8a8 8 0 0 1 16 0v8h8a8 8 0 0 1 8 8"></path></svg>`);
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
function InferenceItem($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      text,
      provenance,
      focused = false
    } = $$props;
    let showActions = derived(() => focused);
    $$renderer2.push(`<article${attr_class("inference-item svelte-1yq06j8", void 0, { "show-details": showActions() })} role="listitem" tabindex="0"${attr("aria-label", `Pending inference: ${stringify(text)}. Press Y to confirm, D to dismiss, C to comment.`)}><div class="item-content svelte-1yq06j8"><div class="item-text svelte-1yq06j8">`);
    IconSparkleRegular($$renderer2, { class: "sparkle-icon icon-16" });
    $$renderer2.push(`<!----> <span>${escape_html(text)}</span></div> `);
    if (showActions()) {
      $$renderer2.push("<!--[-->");
      $$renderer2.push(`<p class="provenance svelte-1yq06j8">`);
      IconInfoRegular($$renderer2, { class: "icon-14" });
      $$renderer2.push(`<!----> <span>${escape_html(provenance)}</span></p>`);
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
      $$renderer2.push(`<!----> <span>Comment</span></button></div>`);
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
function IconCircleNotchRegular($$renderer, $$props) {
  const { $$slots, $$events, ...p } = $$props;
  $$renderer.push(`<svg${attributes(
    {
      ...p,
      "data-phosphor-icon": "circle-notch",
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
  )}><path d="M232 128a104 104 0 0 1-208 0c0-41 23.81-78.36 60.66-95.27a8 8 0 0 1 6.68 14.54C60.15 61.59 40 93.27 40 128a88 88 0 0 0 176 0c0-34.73-20.15-66.41-51.34-80.73a8 8 0 0 1 6.68-14.54C208.19 49.64 232 87 232 128"></path></svg>`);
}
function ProcessingFeed($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { discoveries, isComplete = false } = $$props;
    let allComplete = derived(() => discoveries.every((d) => d.complete));
    $$renderer2.push(`<section class="processing-feed svelte-1w20hx9" aria-live="polite"><h3 class="feed-heading svelte-1w20hx9">Processing your import</h3> `);
    if (!allComplete()) {
      $$renderer2.push("<!--[-->");
      $$renderer2.push(`<div class="progress-track svelte-1w20hx9"><div${attr_class("progress-fill svelte-1w20hx9", void 0, { "complete": isComplete })}></div></div>`);
    } else {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]--> <div class="feed-items svelte-1w20hx9"><!--[-->`);
    const each_array = ensure_array_like(discoveries);
    for (let index = 0, $$length = each_array.length; index < $$length; index++) {
      let discovery = each_array[index];
      $$renderer2.push(`<div class="feed-item svelte-1w20hx9"${attr_style(`animation-delay: ${stringify(index * 80)}ms`)}${attr("aria-label", discovery.complete ? `Completed: ${discovery.text}` : discovery.text)}>`);
      if (discovery.complete) {
        $$renderer2.push("<!--[-->");
        $$renderer2.push(`<span class="feed-icon success svelte-1w20hx9">`);
        IconCheckCircleRegular($$renderer2, { class: "icon-16" });
        $$renderer2.push(`<!----></span>`);
      } else {
        $$renderer2.push("<!--[!-->");
        $$renderer2.push(`<span class="feed-icon processing svelte-1w20hx9">`);
        IconCircleNotchRegular($$renderer2, { class: "icon-16" });
        $$renderer2.push(`<!----></span>`);
      }
      $$renderer2.push(`<!--]--> <span class="feed-text svelte-1w20hx9">${escape_html(discovery.text)}</span></div>`);
    }
    $$renderer2.push(`<!--]--></div></section>`);
  });
}
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let allConfirmed = [];
    let allInferences = [];
    let newItemText = "";
    let importPath = "";
    let commentTarget = null;
    let discoveries = [
      {
        id: "1",
        text: "Analysing import patterns...",
        complete: false
      },
      {
        id: "2",
        text: "Generating inference proposals...",
        complete: false
      },
      { id: "3", text: "Waiting for your review.", complete: false }
    ];
    let categories = derived(() => [
      {
        id: "personal",
        label: "Personal",
        confirmed: allConfirmed.filter((i) => i.item_type === "preference" || i.item_type === "fact"),
        inferences: allInferences
      },
      {
        id: "professional",
        label: "Professional",
        confirmed: allConfirmed.filter((i) => i.item_type === "professional"),
        inferences: []
      },
      {
        id: "interests",
        label: "Interests",
        confirmed: allConfirmed.filter((i) => i.item_type === "interest"),
        inferences: []
      },
      {
        id: "communication",
        label: "Communication",
        confirmed: allConfirmed.filter((i) => i.item_type === "communication"),
        inferences: []
      }
    ]);
    let visibleCategories = derived(() => categories().filter((c, i) => i === 0 || c.confirmed.length > 0 || c.inferences.length > 0));
    let totalPending = derived(() => allInferences.length);
    let showProcessingFeed = derived(() => discoveries.some((d) => !d.complete));
    $$renderer2.push(`<section class="profile-view svelte-maq4gq"><div class="profile-content svelte-maq4gq">`);
    NotificationBanner($$renderer2, { count: totalPending() });
    $$renderer2.push(`<!----> `);
    if (showProcessingFeed()) {
      $$renderer2.push("<!--[-->");
      ProcessingFeed($$renderer2, {
        discoveries,
        isComplete: discoveries.every((d) => d.complete)
      });
    } else {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]--> <!--[-->`);
    const each_array = ensure_array_like(visibleCategories());
    for (let $$index_2 = 0, $$length = each_array.length; $$index_2 < $$length; $$index_2++) {
      let category = each_array[$$index_2];
      $$renderer2.push(`<section class="category-section svelte-maq4gq"${attr("id", category.id)}><h2 class="category-heading svelte-maq4gq">${escape_html(category.label)}</h2> `);
      if (category.id === "personal") {
        $$renderer2.push("<!--[-->");
        $$renderer2.push(`<div class="add-item-row svelte-maq4gq"><input class="text-input svelte-maq4gq" type="text"${attr("value", newItemText)} placeholder="Add a confirmed profile item" aria-label="Add item"/> <button class="btn-primary svelte-maq4gq">Add item</button></div> <div class="import-row svelte-maq4gq"><input class="text-input svelte-maq4gq" type="text"${attr("value", importPath)} placeholder="Google Takeout folder path" aria-label="Google Takeout path"/> <button class="btn-secondary svelte-maq4gq">Run import</button></div>`);
      } else {
        $$renderer2.push("<!--[!-->");
      }
      $$renderer2.push(`<!--]--> <div class="items-list svelte-maq4gq" role="list"><!--[-->`);
      const each_array_1 = ensure_array_like(category.inferences);
      for (let $$index = 0, $$length2 = each_array_1.length; $$index < $$length2; $$index++) {
        let inference = each_array_1[$$index];
        $$renderer2.push(`<div class="item-wrapper svelte-maq4gq" data-inference="">`);
        InferenceItem($$renderer2, {
          text: inference.text,
          provenance: inference.provenance
        });
        $$renderer2.push(`<!----> `);
        if (commentTarget?.item_id === inference.item_id) {
          $$renderer2.push("<!--[-->");
          $$renderer2.push(`<div class="comment-anchor svelte-maq4gq">`);
          CommentPopout($$renderer2, {
            itemText: commentTarget.text,
            provenance: commentTarget.provenance
          });
          $$renderer2.push(`<!----></div>`);
        } else {
          $$renderer2.push("<!--[!-->");
        }
        $$renderer2.push(`<!--]--></div>`);
      }
      $$renderer2.push(`<!--]--> <!--[-->`);
      const each_array_2 = ensure_array_like(category.confirmed);
      for (let $$index_1 = 0, $$length2 = each_array_2.length; $$index_1 < $$length2; $$index_1++) {
        let item = each_array_2[$$index_1];
        ConfirmedItem($$renderer2, {
          text: item.text,
          updatedAt: item.updated_at
        });
      }
      $$renderer2.push(`<!--]--> `);
      if (category.confirmed.length === 0 && category.inferences.length === 0 && category.id !== "personal") {
        $$renderer2.push("<!--[-->");
        $$renderer2.push(`<div class="empty-state svelte-maq4gq"><p class="empty-text svelte-maq4gq">No ${escape_html(category.label.toLowerCase())} information yet</p></div>`);
      } else {
        $$renderer2.push("<!--[!-->");
      }
      $$renderer2.push(`<!--]--></div></section>`);
    }
    $$renderer2.push(`<!--]--></div></section>`);
  });
}
export {
  _page as default
};
