import { b as ensure_array_like, a as attr_class, c as attr, f as stringify, o as attr_style, e as escape_html } from "../../../chunks/index.js";
import "@sveltejs/kit/internal";
import "../../../chunks/exports.js";
import "../../../chunks/utils2.js";
import "@sveltejs/kit/internal/server";
import "../../../chunks/root.js";
import "../../../chunks/state.svelte.js";
import { u as uiSettings, T as THEMES } from "../../../chunks/ui-settings.svelte.js";
/* empty css                                                          */
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let topicRules = [];
    let topicPattern = "";
    let showExport = false;
    let showImport = false;
    let showBackups = false;
    let showDelete = false;
    $$renderer2.push(`<section class="settings-view svelte-1i19ct2"><div class="settings-content svelte-1i19ct2"><h1 class="page-heading svelte-1i19ct2">Settings</h1> `);
    {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]--> <div class="settings-sections svelte-1i19ct2"><section class="settings-section svelte-1i19ct2"><h2 class="section-heading svelte-1i19ct2">Appearance</h2> <div class="setting-group svelte-1i19ct2"><span class="setting-label svelte-1i19ct2">Theme</span> <div class="theme-grid svelte-1i19ct2"><!--[-->`);
    const each_array = ensure_array_like(THEMES);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let theme = each_array[$$index];
      $$renderer2.push(`<button${attr_class("theme-swatch svelte-1i19ct2", void 0, { "active": uiSettings.theme === theme.name })}${attr("aria-label", `Use ${stringify(theme.name)} theme`)}${attr("title", theme.name)}${attr_style(` --sw-base: ${stringify(theme.base)}; --sw-base2: ${stringify(theme["base-secondary"])}; --sw-primary: ${stringify(theme["primary-accent"])}; --sw-secondary: ${stringify(theme["secondary-accent"])}; --sw-border-color: ${stringify(theme.border)}; `)}><div class="sw-bar svelte-1i19ct2"><span class="sw-dots svelte-1i19ct2"><i class="svelte-1i19ct2"></i><i class="svelte-1i19ct2"></i><i class="svelte-1i19ct2"></i></span></div> <div class="sw-content svelte-1i19ct2"><span class="sw-line l1 svelte-1i19ct2"></span> <span class="sw-line l2 svelte-1i19ct2"></span></div> <div class="sw-footer svelte-1i19ct2"></div> `);
      if (uiSettings.theme === theme.name) {
        $$renderer2.push("<!--[-->");
        $$renderer2.push(`<div class="sw-check-badge svelte-1i19ct2"></div>`);
      } else {
        $$renderer2.push("<!--[!-->");
      }
      $$renderer2.push(`<!--]--></button>`);
    }
    $$renderer2.push(`<!--]--></div></div> <div class="setting-group svelte-1i19ct2"><div class="setting-row svelte-1i19ct2"><div class="setting-info svelte-1i19ct2"><span class="setting-label svelte-1i19ct2" id="dyslexia-label">Dyslexia-friendly font</span> <span class="setting-desc svelte-1i19ct2">Replace default fonts with OpenDyslexic</span></div> <button${attr_class("toggle svelte-1i19ct2", void 0, { "active": uiSettings.dyslexiaMode })} role="switch"${attr("aria-checked", uiSettings.dyslexiaMode)} aria-labelledby="dyslexia-label"><span class="toggle-thumb svelte-1i19ct2"></span></button></div></div></section> <section class="settings-section svelte-1i19ct2"><h2 class="section-heading svelte-1i19ct2">Privacy &amp; Security</h2> <div class="setting-group svelte-1i19ct2"><div class="setting-row svelte-1i19ct2"><div class="setting-info svelte-1i19ct2"><span class="setting-label svelte-1i19ct2" id="hifi-label">High-fidelity mode</span> <span class="setting-desc svelte-1i19ct2">When OFF, raw artifacts are erased and cannot be recovered from live data.</span></div> <button${attr_class("toggle svelte-1i19ct2", void 0, { "active": uiSettings.highFidelityEnabled })} role="switch"${attr("aria-checked", uiSettings.highFidelityEnabled)} aria-labelledby="hifi-label"><span class="toggle-thumb svelte-1i19ct2"></span></button></div></div> <div class="setting-group svelte-1i19ct2"><span class="setting-label svelte-1i19ct2">Blocked topics</span> <div class="topic-rule-row svelte-1i19ct2"><input class="text-input svelte-1i19ct2" type="text"${attr("value", topicPattern)} placeholder="Add blocked topic"/> <button class="btn-secondary svelte-1i19ct2">Add</button></div> <div class="topic-rule-list svelte-1i19ct2">`);
    if (topicRules.length === 0) {
      $$renderer2.push("<!--[-->");
      $$renderer2.push(`<p class="setting-desc svelte-1i19ct2">No blocked topics configured.</p>`);
    } else {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]--> <!--[-->`);
    const each_array_1 = ensure_array_like(topicRules);
    for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
      let rule = each_array_1[$$index_1];
      $$renderer2.push(`<div class="topic-rule-item svelte-1i19ct2"><span>${escape_html(rule.pattern)}</span> <div class="topic-rule-actions svelte-1i19ct2"><button class="btn-secondary-sm svelte-1i19ct2">${escape_html(rule.is_enabled ? "Disable" : "Enable")}</button> <button class="btn-danger-sm svelte-1i19ct2">Remove</button></div></div>`);
    }
    $$renderer2.push(`<!--]--></div></div> <div class="setting-group svelte-1i19ct2"><span class="setting-label svelte-1i19ct2">Data lifecycle</span> <p class="setting-desc lifecycle-warning svelte-1i19ct2">Exports and backups can reveal your profile if passphrases are weak or shared.
            Use unique passphrases and store artifacts offline.</p> <div class="lifecycle-actions svelte-1i19ct2"><button${attr_class("lifecycle-toggle svelte-1i19ct2", void 0, { "open": showExport })}>Encrypted export <span${attr_class("chevron svelte-1i19ct2", void 0, { "open": showExport })}></span></button> `);
    {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]--> <button${attr_class("lifecycle-toggle svelte-1i19ct2", void 0, { "open": showImport })}>Encrypted import <span${attr_class("chevron svelte-1i19ct2", void 0, { "open": showImport })}></span></button> `);
    {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]--> <button${attr_class("lifecycle-toggle svelte-1i19ct2", void 0, { "open": showBackups })}>Local backups <span${attr_class("chevron svelte-1i19ct2", void 0, { "open": showBackups })}></span></button> `);
    {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]--></div></div> <div class="setting-group danger-zone svelte-1i19ct2"><button${attr_class("lifecycle-toggle danger svelte-1i19ct2", void 0, { "open": showDelete })}>Irreversible profile deletion <span${attr_class("chevron svelte-1i19ct2", void 0, { "open": showDelete })}></span></button> `);
    {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]--></div></section> <section class="settings-section svelte-1i19ct2"><h2 class="section-heading svelte-1i19ct2">System</h2> <div class="setting-group svelte-1i19ct2"><div class="setting-row svelte-1i19ct2"><div class="setting-info svelte-1i19ct2"><span class="setting-label svelte-1i19ct2" id="startup-label">Start on login</span> <span class="setting-desc svelte-1i19ct2">Launch Dossier automatically after OS sign-in</span></div> <button${attr_class("toggle svelte-1i19ct2", void 0, { "active": uiSettings.startOnLogin })} role="switch"${attr("aria-checked", uiSettings.startOnLogin)} aria-labelledby="startup-label"><span class="toggle-thumb svelte-1i19ct2"></span></button></div></div> <div class="setting-group svelte-1i19ct2"><span class="setting-label svelte-1i19ct2">Local model setup</span> <div class="local-model-grid svelte-1i19ct2"><input class="text-input svelte-1i19ct2"${attr("value", uiSettings.localModelEndpoint)} placeholder="http://127.0.0.1:11434/v1"/> <input class="text-input svelte-1i19ct2"${attr("value", uiSettings.localModelName)} placeholder="Model name (e.g. llama3.1)"/> <button class="btn-secondary svelte-1i19ct2">Save local model</button></div> `);
    {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]--></div></section></div></div></section> `);
    {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]-->`);
  });
}
export {
  _page as default
};
