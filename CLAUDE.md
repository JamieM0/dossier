# Claude Instructions for Dossier

This repository is a desktop-only app. Treat visual QA as desktop-only unless the user explicitly asks for mobile.

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
