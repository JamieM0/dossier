# Automatic updates (GitHub Releases)

Dossier Desktop ships a built-in self-updater using Tauri's updater plugin. On app launch (release builds), it checks GitHub Releases for `latest.json`, downloads a signed update bundle, installs it, and restarts the app.

## Trust model

- Updates are verified with an embedded public key (`pubkey`) in `apps/dossier-desktop/src-tauri/tauri.conf.json`.
- Release artifacts must be signed with the matching private key.
- If you lose the private key, existing installs cannot receive future updates.

## Configuration

Update feed endpoint (static JSON):

- `apps/dossier-desktop/src-tauri/tauri.conf.json`
  - `plugins.updater.endpoints`: set to `https://github.com/JamieM0/dossier/releases/latest/download/latest.json`
  - `plugins.updater.pubkey`: the updater public key (already embedded if you generated it locally)

Disable auto-updates (for local troubleshooting):

- Set `DOSSIER_DISABLE_AUTO_UPDATE=1`

Disable auto-updates (user setting, no update server traffic):

- Settings -> System -> Automatic updates

## Key generation

Generate a signing keypair (do NOT commit the private key):

```bash
pnpm --filter @dossier/dossier-desktop exec tauri signer generate -w "$HOME/.tauri/dossier-updater.key"
```

This creates:

- Private key: `~/.tauri/dossier-updater.key`
- Public key: `~/.tauri/dossier-updater.key.pub`

Copy the *contents* of the `.pub` file into `plugins.updater.pubkey` in `apps/dossier-desktop/src-tauri/tauri.conf.json`.

## GitHub release pipeline

This repo includes a GitHub Actions workflow that builds installers for macOS / Windows / Linux, signs updater artifacts, and uploads them to a draft GitHub Release (including `latest.json`).

Required repository secrets:

- `TAURI_SIGNING_PRIVATE_KEY`: the private key content (or set `TAURI_SIGNING_PRIVATE_KEY_PATH` instead)
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: optional (only if your key is password-protected)

Release flow:

1. Bump the desktop app version in `apps/dossier-desktop/src-tauri/tauri.conf.json` (and any other places you version).
2. Create and push a git tag (e.g. `v0.1.1`).
3. The workflow builds and creates/updates a draft GitHub Release for that tag.
4. Publish the release.
5. Next time a user opens Dossier, it updates automatically.

## Notes

- The updater requires HTTPS endpoints in production builds.
- On Windows, installers may force the app to exit during install; Dossier attempts to shut down its background backend before restarting.
