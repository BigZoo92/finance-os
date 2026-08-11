---
name: finance-os-browser-qa
description: Verify Finance-OS user flows in a real browser with Playwright and repository scripts. Use for E2E regressions, visual interaction checks, SSR/hydration issues, responsive QA, or console/network debugging.
---

# Browser QA

Use the existing Playwright configuration and deterministic demo mode. Do not invent Python browser harnesses or call live finance providers.

## Workflow

1. Define the exact route, mode, viewport, precondition, and observable outcome.
2. Prefer stable roles, labels, and test IDs over CSS structure or timing sleeps.
3. Start with `pnpm test:e2e`; install Chromium with `pnpm test:e2e:install` only when missing.
4. Capture console errors, failed requests, redirects, and screenshots/traces for failures.
5. Check desktop and a narrow mobile viewport for UI changes; include keyboard and reduced-motion checks when relevant.
6. Keep tests deterministic: mock/fix time and network data through repo fixtures; never depend on provider uptime or production state.

## High-value scenarios

- Public demo boot with no cookies or provider/DB traffic.
- Admin login/logout and cache isolation.
- SSR navigation without hydration warnings or auth flash.
- Loading, empty, degraded, error, and retry surfaces.
- API proxy and request-ID continuity where observable.

Do not "fix" product failures by weakening assertions, adding arbitrary waits, or hiding console errors. Report the first causal failure and retain artifacts needed to reproduce it.
