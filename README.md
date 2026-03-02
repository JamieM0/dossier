# Dossier

Dossier MVP monorepo implementing:
- Tauri desktop shell
- Svelte 5 + SvelteKit renderer (no React)
- Local policy server on `127.0.0.1:34250`
- Encrypted local store with erasure ledger semantics
- Google Takeout connector (offline)
- Perspectives-style external service simulator
- Acceptance-test aligned test scaffolding

## Workspace layout

- `apps/dossier-desktop`: Tauri shell + backend daemon bridge
- `apps/dossier-ui`: SvelteKit renderer and design system
- `packages/domain`: Canonical model, schemas, state machines, policy filters
- `packages/store`: Encrypted persistence + backup/restore + erasure ledger
- `packages/local-server`: Loopback REST API + consent/pairing/disclosure
- `packages/connectors-google-takeout`: Offline connector and inference generation
- `apps/external-service-simulator`: Local simulator client for consent flows
- `tests/e2e`: Playwright suites A-M

## Quick start

```bash
pnpm install
pnpm dev
```

## Notes

- UI stack is strictly Svelte/SvelteKit.
- Rust toolchain `>=1.88.0` is required for the Tauri desktop workspace.
- Tauri capability allowlist is enforced for renderer-to-native access.
- Local API enforces loopback bind, CORS allowlist, bearer auth, origin validation, nonce replay checks, and rate limiting.
- Desktop builds support self-updating via GitHub Releases (see `docs/auto-updates.md`).
