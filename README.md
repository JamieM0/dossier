# Dossier

A local-first movie/TV taste engine. Rate and rank films and shows you know,
and Dossier learns a model of your taste from that signal alone — no
external data ingestion, no LLM, nothing leaves your device unless you
export it. It ships two ways: a Tauri desktop app, and a no-install build
that runs entirely in the browser.

This is a deliberately narrow build of a much bigger idea — see
[`VISION.md`](VISION.md) for the long-term purpose this project exists to
serve, and `CHANGELOG.md` for why an earlier, broader attempt at it was
scrapped and rebuilt from here.

## How it works

- An **entertainment lens** (`packages/domain/src/lens.ts`) maps any TMDB
  title to a 10-axis feature vector (pacing, tone, complexity, scope,
  realism, etc.) from its genres, keywords, and overview — deterministic,
  on-device, no API cost beyond TMDB itself.
- A **weighted-kNN recommender** (`apps/dossier-ui/src/lib/recommender.ts`)
  scores candidates by similarity to your nearest *liked* titles (not a
  single averaged "ideal item" — that collapses split tastes into a mushy
  midpoint that matches neither).
- You calibrate it through **Rate** (a swipe queue of recognisable titles),
  **Refine** (pairwise duels between similarly-rated titles), and your
  **Library** — all backed by your own TMDB API token, stored in the OS
  keychain (desktop) or an encrypted in-browser vault (web).

## Workspace layout

- `apps/dossier-desktop`: Tauri shell + Node backend daemon
- `apps/dossier-ui`: SvelteKit renderer (shared by both the desktop app and
  the no-install web build)
- `packages/domain`: isomorphic core shared by the Node backend and the
  browser — the lens, TMDB client/types, persisted-library model, and the
  passphrase export/import codec
- `packages/store`: encrypted local persistence (AES-256-GCM), OS keychain
  access, the Node-only TMDB disk cache
- `tests/e2e`: Playwright suite, including the mandatory visual-review spec
  (see `CLAUDE.md`)
- `archive/`: superseded docs from the original architecture, kept for
  historical reference only — not current

## Quick start

```bash
pnpm install
pnpm dev          # desktop app (Tauri + backend daemon)
pnpm dev:ui       # UI only, in a browser
```

You'll need your own TMDB API Read Access Token (v4) — the app prompts for
it on first launch and stores it locally; nothing is bundled.

## Notes

- UI stack is strictly Svelte 5 / SvelteKit.
- Rust toolchain `>=1.88.0` is required for the Tauri desktop workspace.
- Desktop builds are macOS-only (aarch64) for now and self-update via GitHub
  Releases (see `docs/auto-updates.md`). The web build is a static zip
  attached to the same releases, runnable with no install.
- Releases are built, signed, and published entirely locally via
  `version-bump.py` — see `CLAUDE.md` for the full release process.
