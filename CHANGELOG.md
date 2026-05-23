# Changelog

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
