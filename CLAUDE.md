# Claude Instructions for Dossier

This repository is a desktop-only app. Treat visual QA as desktop-only unless the user explicitly asks for mobile.

## Project purpose

The current build is a narrow, deliberately scoped slice of a much bigger idea — see `VISION.md` for the long-term purpose (a private, user-owned model of a person's taste, starting with entertainment). Don't reintroduce ingestion pipelines, consent/disclosure infrastructure, or LLM-based inference because old design docs described them — that architecture was tried and explicitly abandoned (see `CHANGELOG.md`, "Phase 1: Cleanup for preference-based rework"; the originals are in `archive/design_docs/`). When in doubt about whether a feature belongs in this project, `VISION.md` explains the framing to use.

## Subagents

Only use subagents (the Agent tool) for large tasks that genuinely require them — broad, open-ended exploration or independent parallel work. Don't spawn one for small or well-scoped tasks; do those directly.

A single `grep`/`Read` in this repo (finding a constant, a function definition, a config value) is never large enough to justify a subagent — just look it up yourself with Bash/Grep/Read. Default to doing the lookup directly; only reach for Agent when the task is genuinely broad or independent.

## Feature project (GitHub Projects)

Feature ideas live in the **"Dossier Planning"** GitHub Project — private, project `8`, owner `JamieM0`: https://github.com/users/JamieM0/projects/8

- Check it when discussing potential features, so we're not re-pitching something already captured.
- Add to it automatically whenever a feature or idea comes up in conversation. **Don't ask permission first** — just add it, then tell Jamie what was added.
- Add items as **draft issues only**, via `gh project item-create 8 --owner JamieM0 --title "..." --body "..."` (this command always creates a draft issue, which is project-only and never publicly visible — never use `gh issue create` for this).
- Write entries like a text to a coworker, not a spec: lead with the idea and why it's worth doing — the benefit should be obvious in the first line or two. If we discussed specifics of how it should *behave*, include those. Skip implementation/technical detail. Keep it short.

## Node backend bundling (read before adding backend modules)

The Tauri shell spawns a Node backend from `apps/dossier-desktop/src/*.ts`, compiled by `tsc` to `apps/dossier-desktop/dist/*.js`. `dist/backend.js` is the daemon. Any sibling `dist/*.js` it `import`s by relative path must also ship inside the packaged app, not just `backend.js`.

These modules are copied into the bundle via `bundle.resources` in `apps/dossier-desktop/src-tauri/tauri.conf.json`. That entry is a glob — `"../dist/*.js"` — specifically so new backend modules are picked up automatically. **Do not narrow it back to a hand-listed file** (it was previously `"../dist/backend.js"`, which is exactly what broke the v0.1.14 DMG when sibling modules were missing at launch).

Rules when touching the Node backend:
- Adding a new `src/*.ts` backend module needs no config change — the `../dist/*.js` glob already covers it. Just confirm it lands in `dist/` after `pnpm run build`.
- Test files (`src/**/*.test.ts`) are excluded from the build emit (see `tsconfig.json` `exclude`) so they never reach the production bundle. Keep that exclude in place.
- If you ever change resource paths, verify a packaged build actually launches — a missing module fails at app start, not at build time.
- The backend does **not** import `@dossier/store` or `@dossier/domain` as bare specifiers. It dynamically `import()`s `packages/store/dist/index.js` **by filesystem path** (`loadStoreModule`, keyed off `DOSSIER_PACKAGES_ROOT`). All TMDB / lens / library-export logic flows through that store module — `backend.ts` has no direct domain import.

## Shared isomorphic core: `@dossier/domain`

`packages/domain` holds logic shared by the Node backend **and** the browser (web build): the entertainment lens (`featureVector`), the TMDB types + transforms + cache-injectable `TmdbClient`, the persisted-library model (`PersistedState` etc.), and the passphrase `.dossier` export/import codec (`portable.ts`, WebCrypto). It must stay **isomorphic** — no `node:*` or browser-only API at module top level (WebCrypto via `globalThis.crypto`, `fetch` global). Node-only wiring (the fs TMDB disk cache, keychain) lives in `@dossier/store`, not here.

How it ships at runtime:
- **Backend / app:** `@dossier/store` imports `@dossier/domain` at runtime. `packages/store/scripts/copy-native-deps.mjs` copies `packages/domain/dist` into `packages/store/dist/node_modules/@dossier/domain` (same mechanism as keytar), so the bare import resolves via Node's node_modules walk from the store dist. The store dist already ships via `bundle.resources` (`packages/store/dist/**/*`), so the nested copy ships with it — **no tauri.conf change needed**. `build:deps` builds domain before store (`--filter "@dossier/store..."`).
- **Web build:** Vite resolves `@dossier/domain` via the workspace symlink + package `exports` and bundles it into the static output. Build domain before the UI build (the tauri `beforeBuildCommand` runs `build:deps` first).
- Because the backend resolves domain only through the store module, packaging risk is verified by the same packaged-launch smoke test as before.

## Web (no-backend) build

The same SvelteKit UI ships two ways: inside the Tauri app, and as a no-install static zip served by `npx http-server`. Which bridge populates `window.dossier` is chosen at runtime in `apps/dossier-ui/src/lib/desktop/bridge.ts` → `installBridge()`: Tauri runtime → `installDesktopApi()` (`platform: "app"`); plain browser → `installWebApi()` (`platform: "web"`, `lib/desktop/web/`). Both satisfy the identical `window.dossier` contract in `app.d.ts`; app-only surfaces (window controls, updater) are no-ops on web.

Principle: **only think about the app.** The web build is set-and-forget — it reuses the same UI, lens, recommender, and domain core. It must differ only at the explicit differentiator points, all gated on `window.dossier?.platform`:
- A passphrase-encrypted library in a user-picked folder (File System Access; Chromium-only) instead of the keychain-encrypted store. `WebUnlockGate.svelte`.
- TMDB called directly from the browser; posters from TMDB's image CDN; token stored in the encrypted web vault (not exported).
- `MigrationStepsModal.svelte` + Settings → Library export/import (both platforms) as the only data bridge.

When adding a feature, put shared logic in the UI or `@dossier/domain` so both platforms get it for free; reach for web-specific code only for genuine platform differences (credentials, file access, the migrate prompts).

The release zip (`Dossier-web-{version}.zip`) is produced by `version-bump.py` (`build_web_zip`) from the static `apps/dossier-ui/build` output and attached to the GitHub release alongside the DMG.

## Mandatory After Every Visual Change

When any UI, layout, style, spacing, typography, interaction copy, or visual behavior changes:

1. Run automated Playwright visual review.
2. Capture fresh artifacts (full-page + focused screenshots and structured audit output).
3. Review artifacts and list UI/UX issues by severity.
4. Fix every issue identified in that review by default.
5. Re-run the same visual review and verify issues are resolved.

Do not leave visual issues unfixed unless the user explicitly instructs otherwise.

### Default Command

Use:

```bash
pnpm --filter @dossier/e2e test -- specs/welcome-llm-review.spec.ts
```

If the scope changes, add/update Playwright specs so the affected UI is covered with the same review-fix-recheck loop.

## Version Bumps and Releases

Releases are built, signed, and published **entirely locally** — there is no
GitHub Actions release pipeline. Releases ship from the main `dossier` repo
(the old `dossier-builds` repo is no longer used now that the project is open
source). Builds are **macOS-only (aarch64)**; Windows is not built.

### Using the version-bump Script

Claude should **always use `version-bump` without parameters**:

```bash
python version-bump.py
```

This one script does the whole release. In order, it:
1. Runs pre-flight checks (on `main`; `gh`, `pnpm`, `node` present; `gh` is
   authenticated; the local updater signing key + password files exist).
2. Bumps the patch version (X.Y.Z → X.Y.Z+1) across all three version files:
   - `apps/dossier-desktop/src-tauri/tauri.conf.json`
   - `apps/dossier-desktop/src-tauri/Cargo.toml`
   - `apps/dossier-desktop/package.json`
3. **Builds + signs locally** (`tauri build --target aarch64-apple-darwin`),
   reading the signing key from `~/.tauri/dossier-updater.key` and its password
   from `~/.tauri/dossier-updater.password.txt`. **If the build fails, the
   script aborts before any commit/tag/push — a broken build can never ship.**
4. Collects the DMG + updater archive (`.app.tar.gz` + `.sig`) into `dist/`
   and generates `latest.json`.
5. Commits the version bump, tags `vX.Y.Z`, and pushes `main` + tag.
6. Creates a **published** GitHub release on `JamieM0/dossier` with the
   artifacts + `latest.json`.

Use `--minor` / `--major` to bump those parts, or pass a commit message as a
positional arg to fold all current working-tree changes into the bump commit.

**Do not manually edit version files.** Always use the script.

### Prerequisites (one-time)

- `gh auth login` — the script will refuse to run if `gh` is not authenticated.
- `~/.tauri/dossier-updater.key` and `~/.tauri/dossier-updater.password.txt`
  must be present (they hold the minisign key + its password).

### After the script runs

Users receive the update on next app launch (via `tauri-plugin-updater v2`).
The updater endpoint is the main repo:
`https://github.com/JamieM0/dossier/releases/latest/download/latest.json`.
There is no draft to publish manually — the release goes out live immediately.

### Key Release Files

- `version-bump.py` — local build-sign-publish release script (the only path)
- `.github/scripts/generate-latest-json.mjs` — generates the Tauri updater manifest (`latest.json`)
- `apps/dossier-desktop/src-tauri/tauri.conf.json` — Tauri config (version, pubkey, updater endpoint)
- `apps/dossier-desktop/src-tauri/src/main.rs` — Rust main with auto-update logic
