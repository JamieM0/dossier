# Changelog

## Unreleased — Phase 2: Content-based MVP

Preference elicitation, feature-vector recommendations, and a bundled
~2.5k-film catalogue scraped from BestSimilar.

### Added — offline catalogue tooling

`tools/catalogue-builder/` — developer-only Python pipeline. Not part
of the shipped app. Run by the developer at release time.

- `discover.py` — walks BestSimilar `/top/*` index pages (decades,
  genres, countries, moods) and writes a deduped URL list. The lists
  are hardcoded to bias toward breadth: every (era × genre × region)
  cell gets a chance to surface a film, so the catalogue is not just
  the IMDb top 250.
- `scrape.py` — fetches each film page with [Scrapling][], extracts
  title/year/rating/genre/country/duration/story/tags/similar-films,
  and writes one JSON file per film. Resumable; uses a small worker
  pool with per-worker jittered delay.
- `feature_schema.py` — 12 medium-agnostic axes (pacing, tone,
  ending warmth, emotional intensity, complexity, scope, realism,
  darkness, thematic weight, character focus, moral clarity,
  structure). Each axis lists positive/negative keyword sets matched
  against the scraped tag stream to derive a value in [-1, 1].
- `convert.py` — folds scraped records through `feature_schema` and
  writes the runtime catalogue: `apps/dossier-ui/static/catalogue/
  films/{id}.json` (one per film) plus `index.json` (lightweight
  manifest the runtime loads once on boot).

[Scrapling]: https://github.com/D4Vinci/Scrapling

### Added — runtime

- `packages/store` extended: `PersistedState` gains `ratings`,
  `pairwise`, `skipped`. New methods `getRatings/setRating/
  getPairwise/addPairwise/getSkipped/addSkipped/resetPreferences`.
  See **deviations** below for why this stays on the existing
  encrypted JSON store rather than introducing SQLite.
- `apps/dossier-desktop/src/backend.ts` — five new control endpoints:
  `GET /control/preferences`, `PUT /control/preferences/rating`,
  `POST /control/preferences/{pairwise,skip,reset}`.
- `apps/dossier-desktop/src-tauri/src/main.rs` — matching Tauri
  commands (`preferences_get`, `preferences_set_rating`,
  `preferences_add_pairwise`, `preferences_skip`,
  `preferences_reset`).
- `apps/dossier-ui/src/lib/catalogue.ts` — index and per-film
  loaders (cache-once, lazy detail).
- `apps/dossier-ui/src/lib/recommender.ts` — pure functions:
  `computeUserWeights` (rating-weighted mean of feature vectors,
  with capped pairwise nudges), `rankRecommendations` (cosine
  similarity, top-N), `buildRatingQueue` (round-robin by
  decade × genre cluster, popularity within cluster), and
  `buildPairwiseCandidates` (only ties between equally-rated films).
- `apps/dossier-ui/src/lib/state/preferences.svelte.ts` — Svelte 5
  state class that hydrates from the backend and writes through.
- Routes: `/` recommendations, `/rate` rating queue with thumbs +
  arrow-key swipe + spacebar skip, `/refine` pairwise duel with
  left/right arrow keys.
- Sidebar nav extended with Recommendations / Rate / Refine.

### Deviations from the original plan

The plan called for **local SQLite** for ratings/weights/app state.
We kept the existing AES-256-GCM encrypted-JSON store instead. With
expected dataset sizes (a few hundred ratings, low-thousands cap),
the encrypted JSON store is adequate, gives us encryption-at-rest
for free, and avoids introducing a native module that needs platform
builds. Migrating to SQLite later is an internal change behind
`DossierStoreService` if data volume ever justifies it.

The plan also mentioned **LLM-assisted tagging** at conversion time.
We implemented a deterministic keyword-mapping pass over the scraped
BestSimilar tag stream instead — reproducible, no API cost, and the
12-axis output is reasonable on spot-checked examples. An LLM-tagging
pass can be added later as a second-stage convert step if quality
demands.

---

## Unreleased — Phase 1: Cleanup for preference-based rework

Strip the project to a minimal app shell so phase 2 (preference-based film
recommendations) can be built on a coherent foundation. The previous Google
ingest → traitscape inference architecture did not work; rather than refactor
it, we delete it.

### Kept

- Tauri v2 desktop shell (`apps/dossier-desktop/src-tauri`), tray, window
  management, single-window IPC to the Node backend daemon.
- Auto-update pipeline: `tauri-plugin-updater` wiring in `src-tauri/src/main.rs`
  (`run_auto_update`, `update_install_and_restart`), the
  `UpdateAvailableDialog` Svelte component, and the `autoUpdatesEnabled` /
  `skippedUpdateVersion` settings that gate it.
- Version-bump tooling and CI: `scripts/version-bump.py`,
  `apps/dossier-desktop/src-tauri/tauri.conf.json`,
  `apps/dossier-desktop/scripts/check-version-sync.mjs`,
  `.github/workflows/publish.yml`,
  `.github/scripts/generate-latest-json.mjs`.
- Local-only storage primitives in `packages/store`: `crypto.ts` (AES-256-GCM),
  `key-manager.ts` (OS keychain via keytar), `encrypted-store.ts` (encrypted
  JSON file with quarantine-on-corrupt). `DossierStoreService` is reduced to a
  settings-only persistence shape; the schema and repository tied to the old
  domain are gone.
- SvelteKit shell: `+layout.svelte` (stripped), `+page.svelte` (placeholder
  landing), the design-token CSS, the theme system, `ConfirmDialog`,
  `PromptDialog`, `UpdateAvailableDialog`, and a gutted `Sidebar`.
- Minimal Settings page: theme, dyslexia font, start-on-login, automatic
  updates.

### Deleted

- `packages/connectors-google-takeout` — Google Takeout ingest pipeline.
- `packages/inference-engine` — LLM-driven traitscape and profile inference.
- `packages/domain` — old domain types (Item, Category, Compartment, Consent,
  ServicePairing, etc.).
- `packages/local-server` — external-facing HTTP server that brokered Consent
  requests from the Perspectives web app.
- `apps/external-service-simulator` — harness for the deleted external server.
- `packages/store/repository.ts`, `schema.ts`, `defaults.ts`, `migrations.ts`,
  `repository.test.ts` — all tied to the old PersistedState shape.
- UI routes `/audit`, `/chat`, `/connections`, `/profile`, `/help`.
- UI components `AlternativesPanel`, `BatchedConsentView`, `CommandPalette`,
  `CommentPopout`, `ConfirmedItem`, `ConsentModal`, `InferenceItem`,
  `ItemDetailPanel`, `LlmIntegrationPanel`, `ProcessingFeed`,
  `NotificationBanner`.
- `$lib/llm/providers.ts` and the LLM profile / endpoint plumbing on the
  settings model.
- All Tauri commands in `main.rs` for profile, inference, category,
  compartment, consent, services, audit, logs, takeout, LLM, backups, and
  irreversible profile deletion.
- All `/control/*` endpoints in `backend.ts` other than `/control/settings`,
  `/control/app/version`, and `/control/shutdown`.
- Playwright specs `acceptance.spec.ts`, `chat-markdown-review.spec.ts`,
  `welcome-llm-review.spec.ts`; replaced with a minimal `shell.spec.ts`.
- `marked` dependency from `apps/dossier-ui` (chat markdown rendering).

### Deliverable

A minimal, working Tauri app shell with auto-update, encrypted settings
persistence, and a Settings page. Nothing else. Phase 2 (curated film
catalogue + preference elicitation UI + content-based recommendation engine)
builds on top of this without any of the prior architecture to fight.
