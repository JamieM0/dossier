import { a as ensure_array_like, c as attr_class, d as attr, f as stringify, ae as attr_style } from "../../../chunks/index.js";
import { u as uiSettings, T as THEMES } from "../../../chunks/ui-settings.svelte.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    $$renderer2.push(`<section class="settings-view svelte-1i19ct2"><div class="settings-content svelte-1i19ct2"><h1 class="page-heading svelte-1i19ct2">Settings</h1> <div class="settings-sections svelte-1i19ct2"><section class="settings-section svelte-1i19ct2"><h2 class="section-heading svelte-1i19ct2">Appearance</h2> <div class="setting-group svelte-1i19ct2"><span class="setting-label svelte-1i19ct2">Theme</span> <div class="theme-grid svelte-1i19ct2"><!--[-->`);
    const each_array = ensure_array_like(THEMES);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let theme = each_array[$$index];
      $$renderer2.push(`<button${attr_class("theme-swatch svelte-1i19ct2", void 0, { "active": uiSettings.theme === theme.name })}${attr("aria-label", `Use ${stringify(theme.name)} theme`)}${attr("title", theme.name)}><span class="swatch-slice svelte-1i19ct2"${attr_style(`background:${stringify(theme.base)}`)}></span> <span class="swatch-slice svelte-1i19ct2"${attr_style(`background:${stringify(theme["primary-accent"])}`)}></span> <span class="swatch-slice svelte-1i19ct2"${attr_style(`background:${stringify(theme["secondary-accent"])}`)}></span></button>`);
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
