/** @dossier/domain — isomorphic core shared by the Node backend (desktop app)
 * and the browser (web build). Contains NO Node- or browser-specific APIs at
 * module top level so it can be bundled into the SvelteKit web build and also
 * loaded by the Node backend. */
export * from "./lens.js";
export * from "./tmdb/types.js";
export * from "./tmdb/client.js";
export * from "./store/model.js";
export * from "./codec/portable.js";
export * from "./taste-space.js";
export * from "./taste-claims.js";
export * from "./recommender.js";
export * from "./calibration.js";
export * from "./application.js";
export * from "./discovery.js";
export * from "./capabilities.js";
