# Dossier

Dossier MVP monorepo implementing:
- Electron desktop shell
- Svelte 5 + SvelteKit renderer (no React)
- Local policy server on `127.0.0.1:34250`
- Encrypted local store with erasure ledger semantics
- Google Takeout connector (offline)
- Perspectives-style external service simulator
- Acceptance-test aligned test scaffolding

## Workspace layout

- `apps/dossier-desktop`: Electron main/preload integration
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
- Electron security flags are enabled (`contextIsolation`, `sandbox`, `nodeIntegration: false`).
- Local API enforces loopback bind, CORS allowlist, bearer auth, origin validation, nonce replay checks, and rate limiting.
