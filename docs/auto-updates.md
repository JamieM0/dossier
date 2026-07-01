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

## Release pipeline

There is no GitHub Actions release workflow — releases are built, signed,
and published **entirely locally** via `python version-bump.py` (repo root).
That script bumps the version, builds + signs the macOS (aarch64) app with
the local updater key, generates `latest.json`, commits/tags/pushes, and
publishes the GitHub release with the artifacts attached. See `CLAUDE.md`
("Version Bumps and Releases") for the full process and prerequisites
(`gh auth login`, `~/.tauri/dossier-updater.key` + password file).

An earlier CI-based version of this pipeline (a GitHub Actions workflow
building macOS/Windows/Linux installers from a pushed tag) was replaced by
the local script; see `archive/auto-updates-original.md` if you need the old
flow for reference.

## Notes

- The updater requires HTTPS endpoints in production builds.
- Desktop builds are currently macOS-only (aarch64); Windows is not built.
