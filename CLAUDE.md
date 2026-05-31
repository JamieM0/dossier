# Claude Instructions for Dossier

This repository is a desktop-only app. Treat visual QA as desktop-only unless the user explicitly asks for mobile.

## Node backend bundling (read before adding backend modules)

The Tauri shell spawns a Node backend from `apps/dossier-desktop/src/*.ts`, compiled by `tsc` to `apps/dossier-desktop/dist/*.js`. At runtime `dist/backend.js` `import`s its sibling modules (e.g. `./tmdb.js` → `./lens.js`) by relative path, so **every** compiled module must be shipped inside the packaged app, not just `backend.js`.

These modules are copied into the bundle via `bundle.resources` in `apps/dossier-desktop/src-tauri/tauri.conf.json`. That entry is a glob — `"../dist/*.js"` — specifically so new backend modules are picked up automatically. **Do not narrow it back to a hand-listed file** (it was previously `"../dist/backend.js"`, which is exactly what broke the v0.1.14 DMG: `tmdb.js`/`lens.js` were missing at launch).

Rules when touching the Node backend:
- Adding a new `src/*.ts` backend module needs no config change — the `../dist/*.js` glob already covers it. Just confirm it lands in `dist/` after `pnpm run build`.
- Test files (`src/**/*.test.ts`) are excluded from the build emit (see `tsconfig.json` `exclude`) so they never reach the production bundle. Keep that exclude in place.
- If you ever change resource paths, verify a packaged build actually launches — a missing sibling module fails at app start, not at build time.

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

### Using the version-bump Script

Claude should **always use `version-bump` without parameters**:

```bash
python scripts/version-bump.py
```

This script automatically:
- Bumps the patch version (X.Y.Z → X.Y.Z+1)
- Updates all three version files simultaneously:
  - `apps/dossier-desktop/src-tauri/tauri.conf.json`
  - `apps/dossier-desktop/src-tauri/Cargo.toml`
  - `apps/dossier-desktop/package.json`
- Verifies all three versions are in sync

**The script does not touch git at all.** After running it, you must manually stage, commit, and push the changes.

**Do not manually edit version files.** Always use the script.

### Tagging and Pushing a Release

After running the version-bump script:

1. Stage and commit the version changes:
   ```bash
   git add apps/dossier-desktop/src-tauri/tauri.conf.json apps/dossier-desktop/src-tauri/Cargo.toml apps/dossier-desktop/package.json
   git commit -m "Bump version to X.Y.Z"
   git push origin main
   ```

2. Create and push the version tag:
   ```bash
   git tag v<VERSION> && git push origin v<VERSION>
   ```

3. This triggers the `.github/workflows/publish.yml` CI/CD pipeline which:
   - Builds macOS and Windows releases
   - Generates the updater manifest (`latest.json`)
   - Creates a draft release in the `dossier-builds` repository

4. Go to `github.com/JamieM0/dossier-builds/releases` and **publish the draft release manually**

5. Users receive the update on next app launch (via `tauri-plugin-updater v2`)

### Release Checklist

- [ ] Run `python scripts/version-bump.py`
- [ ] Verify all 3 version files were updated (check git diff)
- [ ] Commit and push the version changes to main
- [ ] Create and push the version tag: `git tag v<VERSION> && git push origin v<VERSION>`
- [ ] Wait ~15 minutes for CI to complete
- [ ] Publish the draft release in `dossier-builds` repo

### Key Release Files

- `.github/workflows/publish.yml` — CI/CD pipeline that builds and creates draft releases
- `.github/scripts/generate-latest-json.mjs` — generates Tauri updater manifest
- `apps/dossier-desktop/src-tauri/tauri.conf.json` — Tauri config (version, pubkey, endpoint)
- `apps/dossier-desktop/src-tauri/src/main.rs` — Rust main with auto-update logic
- `scripts/version-bump.py` — automated version bumping script

## Inference pipeline rules

Never add deterministic or rule-based fallback paths to the inference pipeline. If the LLM is not configured or fails to load, fail with a clear, user-visible error (`InferenceConfigError`). Silent degradation that produces low-quality output is worse than no output.
