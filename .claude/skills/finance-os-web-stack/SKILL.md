---
name: finance-os-web-stack
description: Implement or refactor Finance-OS React and TanStack Start/Router/Query code using the repository's actual SSR and data patterns. Use for routes, loaders, query factories, component composition, caching, or web performance.
---

# Web stack

Read `apps/web/AGENTS.md`; load `finance-os-web-auth` as well when auth or SSR mode resolution is involved.

## Workflow

1. Locate the existing route, query-option factory, API DTO, and deterministic fixture before creating abstractions.
2. Keep server data in TanStack Query and route state in Router search params/loaders; do not mirror either into ad-hoc global state.
3. Build query keys and freshness/refetch behavior per domain contract. Poll only while an operation is active.
4. Parallelize independent loader work and avoid request waterfalls; keep browser-only code outside SSR evaluation.
5. Prefer composition and small domain components over boolean-prop matrices or duplicated page shells.
6. Keep serialized loader/query payloads minimal and secret-free.
7. Measure before adding memoization, virtualization, code splitting, or cache layers.
8. Preserve `exactOptionalPropertyTypes` by conditionally spreading optional fields.

## Performance and failure

- Do not make analytics, animation, or prefetch delivery an execution dependency.
- Give each remote surface explicit pending, empty, degraded, error, and retry behavior as applicable.
- Avoid barrel imports on hot client paths when direct imports materially reduce bundles.
- Honor reduced motion and keep interactions usable before nonessential JavaScript finishes.

## Verification

Test loaders/query factories and view models before component snapshots. Add hydration, navigation/search-param, retry, and mode-transition coverage where behavior changed; then run the web tests, typecheck, and build.
