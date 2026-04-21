# Testing Map (Deprecated)

This map moved to [testing-canonical.md](./testing-canonical.md). Keep this page as a compatibility redirect for one release cycle.

## Current Automated Coverage

- Canonical testing strategy: [testing-canonical.md](./testing-canonical.md)
- CI command entrypoint: [../../package.json](../../package.json)
- API smoke script: [../../scripts/smoke-api.mjs](../../scripts/smoke-api.mjs)

## Scope-Based Verification

- Production smoke script: [../../scripts/smoke-prod.mjs](../../scripts/smoke-prod.mjs)
- API runtime entrypoint: [../../apps/api/src/index.ts](../../apps/api/src/index.ts)
- Web runtime entrypoint: [../../apps/web/src/routes/__root.tsx](../../apps/web/src/routes/__root.tsx)

## Known Gaps

Refer to the maintained gap framing and evidence requirements in [testing-canonical.md](./testing-canonical.md).

## Manual Checks Worth Doing

- Dual-path policy bundle: [policy-verification-bundle.md](./policy-verification-bundle.md)
- UI guidance and matrix expectations: [design-guidance-canonical.md](./design-guidance-canonical.md)
