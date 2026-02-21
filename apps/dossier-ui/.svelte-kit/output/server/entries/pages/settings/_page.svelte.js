import { a as ensure_array_like, c as attr_class, d as attr, f as stringify, ae as attr_style } from "../../../chunks/index.js";
import { u as uiSettings, T as THEMES } from "../../../chunks/ui-settings.svelte.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    $$renderer2.push(`<section class="settings-view svelte-1i19ct2"><div class="settings-content svelte-1i19ct2"><h1 class="page-heading svelte-1i19ct2">Settings</h1> <div class="settings-sections svelte-1i19ct2"><section class="settings-section svelte-1i19ct2"><h2 class="section-heading svelte-1i19ct2">Appearance</h2> <div class="setting-group svelte-1i19ct2"><span class="setting-label svelte-1i19ct2">Theme</span> <div class="theme-grid svelte-1i19ct2"><!--[-->`);
    const each_array = ensure_array_like(THEMES);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let theme = each_array[$$index];
      $$renderer2.push(`<button${attr_class("theme-swatch svelte-1i19ct2", void 0, { "active": uiSettings.theme === theme.name })}${attr("aria-label", `Use ${stringify(theme.name)} theme`)}${attr("title", theme.name)}${attr_style(` --sw-base: ${stringify(theme.base)}; --sw-base2: ${stringify(theme["base-secondary"])}; --sw-primary: ${stringify(theme["primary-accent"])}; --sw-secondary: ${stringify(theme["secondary-accent"])}; --sw-border-color: ${stringify(theme.border)}; `)}><div class="sw-bar svelte-1i19ct2"><span class="sw-dots svelte-1i19ct2"><i class="svelte-1i19ct2"></i><i class="svelte-1i19ct2"></i><i class="svelte-1i19ct2"></i></span> <span class="sw-mode svelte-1i19ct2">`);
      if (theme.mode === "light") {
        $$renderer2.push("<!--[-->");
        $$renderer2.push(`<svg viewBox="0 0 12 12" fill="none" aria-hidden="true" class="svelte-1i19ct2"><circle cx="6" cy="6" r="2.2" fill="currentColor"></circle><line x1="6" y1="0.5" x2="6" y2="2.2" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"></line><line x1="6" y1="9.8" x2="6" y2="11.5" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"></line><line x1="0.5" y1="6" x2="2.2" y2="6" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"></line><line x1="9.8" y1="6" x2="11.5" y2="6" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"></line><line x1="2.05" y1="2.05" x2="3.27" y2="3.27" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"></line><line x1="8.73" y1="8.73" x2="9.95" y2="9.95" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"></line><line x1="9.95" y1="2.05" x2="8.73" y2="3.27" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"></line><line x1="3.27" y1="8.73" x2="2.05" y2="9.95" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"></line></svg>`);
      } else {
        $$renderer2.push("<!--[!-->");
        $$renderer2.push(`<svg viewBox="0 0 12 12" fill="none" aria-hidden="true" class="svelte-1i19ct2"><path d="M10.2 7C9.3 8.1 8 8.8 6.5 8.8C4 8.8 2 6.8 2 4.3C2 2.9 2.6 1.6 3.6 0.8C1.6 1.6 0.2 3.6 0.2 5.9C0.2 9 2.7 11.5 5.8 11.5C8.2 11.5 10.2 10 11 7.9C10.8 7.6 10.5 7.3 10.2 7Z" fill="currentColor"></path></svg>`);
      }
      $$renderer2.push(`<!--]--></span></div> <div class="sw-content svelte-1i19ct2"><span class="sw-line l1 svelte-1i19ct2"></span> <span class="sw-line l2 svelte-1i19ct2"></span></div> <div class="sw-footer svelte-1i19ct2"></div> `);
      if (uiSettings.theme === theme.name) {
        $$renderer2.push("<!--[-->");
        $$renderer2.push(`<div class="sw-check-badge svelte-1i19ct2"><svg viewBox="0 0 10 10" fill="none" aria-hidden="true" class="svelte-1i19ct2"><path d="M2 5.2L4.2 7.5L8.2 2.8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"></path></svg></div>`);
      } else {
        $$renderer2.push("<!--[!-->");
      }
      $$renderer2.push(`<!--]--></button>`);
    }
    $$renderer2.push(`<!--]--></div></div> <div class="setting-group svelte-1i19ct2"><div class="setting-row svelte-1i19ct2"><div class="setting-info svelte-1i19ct2"><span class="setting-label svelte-1i19ct2" id="dyslexia-label">Dyslexia-friendly font</span> <span class="setting-desc svelte-1i19ct2">Replace default fonts with OpenDyslexic</span></div> <button${attr_class("toggle svelte-1i19ct2", void 0, { "active": uiSettings.dyslexiaMode })} role="switch"${attr("aria-checked", uiSettings.dyslexiaMode)} aria-labelledby="dyslexia-label"><span class="toggle-thumb svelte-1i19ct2"></span></button></div></div></section> <section class="settings-section svelte-1i19ct2"><h2 class="section-heading svelte-1i19ct2">Privacy &amp; Security</h2> <div class="setting-group svelte-1i19ct2"><div class="setting-row svelte-1i19ct2"><div class="setting-info svelte-1i19ct2"><span class="setting-label svelte-1i19ct2" id="hifi-label">High-fidelity mode</span> <span class="setting-desc svelte-1i19ct2">Retain raw artifacts for richer analysis</span></div> <button${attr_class("toggle svelte-1i19ct2", void 0, { "active": uiSettings.highFidelityEnabled })} role="switch"${attr("aria-checked", uiSettings.highFidelityEnabled)} aria-labelledby="hifi-label"><span class="toggle-thumb svelte-1i19ct2"></span></button></div></div> <div class="setting-group svelte-1i19ct2"><div class="action-buttons svelte-1i19ct2"><button class="btn-secondary svelte-1i19ct2">Export profile (encrypted)</button> <button class="btn-secondary svelte-1i19ct2">Import encrypted profile</button> <button class="btn-danger svelte-1i19ct2">Delete profile data</button></div> `);
    {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]--></div></section> <section class="settings-section svelte-1i19ct2"><h2 class="section-heading svelte-1i19ct2">System</h2> <div class="setting-group svelte-1i19ct2"><div class="setting-row svelte-1i19ct2"><div class="setting-info svelte-1i19ct2"><span class="setting-label svelte-1i19ct2" id="startup-label">Start on login</span> <span class="setting-desc svelte-1i19ct2">Launch Dossier when you log in to your computer</span></div> <button${attr_class("toggle svelte-1i19ct2", void 0, { "active": uiSettings.startOnLogin })} role="switch"${attr("aria-checked", uiSettings.startOnLogin)} aria-labelledby="startup-label"><span class="toggle-thumb svelte-1i19ct2"></span></button></div></div></section></div></div></section>`);
  });
}
export {
  _page as default
};
