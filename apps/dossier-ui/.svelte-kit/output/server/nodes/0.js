

export const index = 0;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/_layout.svelte.js')).default;
export const universal = {
  "ssr": false
};
export const universal_id = "src/routes/+layout.ts";
export const imports = ["_app/immutable/nodes/0.sJy9EywW.js","_app/immutable/chunks/BruAzle-.js","_app/immutable/chunks/TUqvhoEA.js","_app/immutable/chunks/uOhD1TE6.js","_app/immutable/chunks/DRtqEIUf.js","_app/immutable/chunks/BTksbenU.js","_app/immutable/chunks/Bjc-uUWC.js","_app/immutable/chunks/Cp8Eapde.js","_app/immutable/chunks/zmE2Fxne.js","_app/immutable/chunks/BkXOSPJC.js","_app/immutable/chunks/VDRMNlXv.js","_app/immutable/chunks/CUcTEjDM.js","_app/immutable/chunks/q8CBg6Re.js","_app/immutable/chunks/B1ZVZY15.js","_app/immutable/chunks/DAlWl-TX.js","_app/immutable/chunks/CvFk6Yxa.js"];
export const stylesheets = ["_app/immutable/assets/0.BVJucj0v.css"];
export const fonts = [];
