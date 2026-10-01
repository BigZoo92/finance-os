# Modernization V1 — implementation notes

Companion to the modernization plan (P0–P19). This page records what was
built, where the implementation deliberately deviates from the plan, the
measurements taken along the way, and the limits that remain. It is the
durable record; the pull request description summarizes it.

## Phase map

| Phase | Outcome |
|---|---|
| P0–P1 | Baseline captured; toolchain runs unsandboxed only where the sandbox blocks pnpm/vite; explicit pathspecs for every commit. |
| P2 | Financial honesty: `null` is the only representation of an unknown value (engine, API DTOs, web types, AI prompts). |
| P3 | Internal service token (`x-internal-service-token`) enforced by the Python services; production requires it when they are enabled. |
| P4 | Owner-token Redis locks with compare-and-delete release and a lease `AbortSignal`. |
| P5 | Client bundle denylist (`pnpm check:client-bundle`), server-only token resolution in the SSR middleware. |
| P6 | Node 24.21 / Bun 1.4.2 / Python 3.12 / pnpm 11.28 (catalog, `allowBuilds`, supply-chain policy), Biome 2.5, Playwright 1.63, Moon 2.5 Stage A. |
| P7–P8 | Explicit ambient types per project, test-tree typechecks, TypeScript 7.0.2 as the canonical compiler. |
| P9 | Pinned TanStack Start cohort, runtime `/api` proxy (`API_INTERNAL_URL` read per request), rolldown-vite bridge validated. |
| P10 | Vite 8.3.1 on Rolldown/Oxc, `@vitejs/plugin-react` 6 with the React Compiler through `@rolldown/plugin-babel`, Vitest 4.1.11, devtools gated out of production. |
| P11 | `@finance-os/api-contract` (Zod 4) as the single source of the financial DTOs; closed root exports of `ai` and `external-investments`; prelude `./runtime` subpath. |
| P12 | Panda CSS 1.12 foundation: `packages/styled-system` (preset, single config, generated runtime), `panda-css` skill, visual regression harness. |
| P13 | Every shared component and screen migrated to Panda (`styled()`, recipes, patterns, style props); Tailwind, tw-animate-css, tailwind-merge, class-variance-authority, clsx and shadcn removed; vendored element reset and Panda `globalCss`. |
| P14 | Bounded dashboard modules with public barrels, use-case slices, repositories injected into HTTP routes, boundary test. |
| P15 | Effect 3.22 provider policy (`provider-runtime/policy`): timeout with real cancellation, transient-only bounded retry, lease cancellation. |
| P16 | One-shot `migrate` service, no startup migrations, schema drift check, PostgreSQL CI harness, DATA-01 nullable unknown valuations, REMOVE-01 legacy credential table dropped. |
| P17 | Moon Stage B: explicit tasks with inputs/outputs, cache replay, affected selection (`moon ci`), layer and tag constraints. |
| P18 | Web security headers, `server-timing` and slow-request logging, client bundle budget. |
| P19 | UI-0 audit removed, one Zod in the workspace, unused dependency declarations dropped, Docker worker image and GitNexus install fixed, skills projected, GitNexus refreshed, final validation matrix. |

## Deviations from the plan (and why)

- **Panda preset location.** The plan placed the preset in `packages/ui`
  and the generated output under `apps/web/styled-system`. Both the UI
  package and the web app consume the generated runtime, so a preset in
  `ui` would create a `ui <-> styled-system` cycle and an app-local output
  could not be imported by the package. The preset, the single config and
  the generated (gitignored) runtime live in `packages/styled-system`,
  imported through one export map (`@finance-os/styled-system/*`).
- **Coexistence cascade order.** During the migration Tailwind's preflight
  had to stay below Panda utilities (otherwise `* { padding: 0; border: 0 }`
  erased migrated components) while Tailwind utilities passed by
  not-yet-migrated consumers had to keep winning, as `twMerge` did. The
  layer order `properties, theme, base, panda_*, components, utilities` was
  pinned for that period; after the exit it is `preflight, reset, base,
  tokens, recipes, utilities` with Panda's default layer names.
- **Element reset.** Panda's preflight differs from Tailwind's in ways that
  move layouts (`body { height: 100% }`, `text-wrap: balance` on headings, a
  default selection color). Tailwind's `preflight.css` is vendored as
  `packages/ui/src/styles/preflight.css` (MIT, attributed in
  `docs/third-party-notices.md`) with the font lookups pointed at the Panda
  font tokens; Panda keeps `preflight: false` and owns the global styles
  through `globalCss`.
- **Style props on function components.** Panda resolves two atoms for
  the same property by their order in the generated sheet, which follows
  first-seen extraction order and changes when unrelated files change. A
  consumer `className={css({ color: 'foreground' })}` on `Amount` was
  therefore only accidentally winning over the component's own color. The
  shared function components (`Amount`, `Status`, `Progress`, `Panel`,
  `PageHeader`, `KpiTile`…) accept style props, merged into their own
  styles at the object level through `withStyleProps`
  (`@finance-os/ui/lib/style-props`), so overrides are deterministic and
  read like the `styled()` components' props.
- **Line heights as tokens.** Tailwind's `text-*` line heights are
  unitless ratios; Lightning CSS folds a bare `calc(1 / 0.75)` into
  `1.33333`, which made a 12px line box 15.98px tall and shifted whole
  screens. The ratios are `lineHeights` tokens referenced from the text
  styles so they stay CSS variables.
- **Rolldown.** Two upstream behaviors needed configuration rather than
  code changes: tslib's `node` import condition resolved to an ESM wrapper
  over an `__esModule` CommonJS build (`resolve.alias.tslib` to the pure
  ESM build, `nitro.noExternals: ['tslib']`), and Nitro's per-package
  server chunking captured a group's dependencies recursively, pulling
  `d3-array` into the client-only 3D graph chunk and evaluating
  `window.THREE` during SSR (`codeSplitting.includeDependenciesRecursively:
  false`).
- **React Compiler path.** The Vite 8 line runs the compiler through
  `@rolldown/plugin-babel` + `reactCompilerPreset()` so its output matches
  the Vite 7 line; the native Oxc compiler path stays a follow-up until it
  leaves experimental status.
- **Vitest 4, not 5.** Vitest 5.0 shipped days before the migration; the
  plan's 4.1.11 line was kept (its migration is documented and validated),
  with the 5.0 changes (`clearMocks` default, hoisting rules) noted for a
  later, isolated upgrade.
- **Effect scope.** Effect is used for the provider policy only; it is not
  spread into domain code, and Effect 4 is not adopted.
- **Migration snapshot.** The journal had no snapshot since 0036; migration
  0038 ships with a full schema snapshot so the drift check is exact from
  here on.
- **Login E2E assertion.** The "panel does not move" assertion tolerates
  0.5px of transform noise from the reveal animation; it failed
  intermittently before the migration.
- **Env schema on the Zod 3 API.** One zod (4.6.5) ships, but
  `@finance-os/env` imports `zod/v3` from it: its 1,300-line schema relies
  on Zod 3 `.default()` semantics (the default is parsed through the inner
  schema), which Zod 4 short-circuits. Parsing the production environment
  stays byte-for-byte the same; the v4 API migration of that schema is a
  separate, reviewed change.
- **Visual baselines for the trading lab.** The route was not in the
  original matrix. Its pre-migration screenshots were recorded from a
  detached worktree of the last Tailwind commit (with the same chart repair
  and the same build flags, see below), then compared with the Panda
  version. Lazy chart containers are masked in the capture because their
  canvases resize asynchronously during a full-page screenshot; their
  rendering is asserted by an E2E test instead.
- **PLAN.md.** The plan was supplied with the task and is not versioned in
  the repository; this page is the in-repo record of the deviations.

## Defects found and fixed along the way

| Defect | Origin | Fix |
|---|---|---|
| Trading lab charts always showed "Graphique indisponible" and leaked a half-created canvas | Pre-existing: written against the lightweight-charts v4 API (`addAreaSeries`) on v5 | `addSeries(AreaSeries, …)`, chart removed on failure, `data-chart-state`, `minmax(0, …)` grid tracks, E2E test |
| `panda codegen` wrote the runtime under `packages/styled-system/Users/…`; a fresh clone would have had none | Modernization (absolute `outdir`) | Relative `outdir`, anchored ignore rule |
| Worker image missed `provider-contract` and `provider-runtime` sources | Modernization (P15 made powens and the external-investment jobs import them) | Copied in the worker bundle and runtime stages; `pnpm docker:check` passes |
| GitNexus (CLI and MCP) failed with `ERR_DLOPEN_FAILED` after a reinstall | Modernization (P6 build policy skipped `@ladybugdb/core`'s copy-only install script) | Script reviewed and allowed |
| Two Zod majors shipped; the API and worker declared zod without importing it | Pre-existing | One zod, unused declarations removed |

## Measurements

| Measurement | Value |
|---|---|
| Web production build (client + SSR + Nitro), Vite 7 on Rollup | ≈ 8.1 s |
| Web production build, rolldown-vite 7.3.1 bridge | 7.9 s wall clock |
| Web production build, Vite 8.3.1 | 8.0 s wall clock |
| Client bundle with Tailwind (58 chunks) | 883 kB gzip JS, 2.9 MB raw; largest lazy chunk 347 kB gzip; CSS 27 kB gzip |
| Client bundle with Panda only (59 chunks) | 887 kB gzip JS, 3.0 MB raw; largest lazy chunk 346 kB gzip; CSS 21.1 kB gzip |
| `moon run :typecheck` (17 projects) | 11–12 s cold, 0.45 s fully cached |
| `moon run :test` (16 test tasks + cached typechecks) | 18 s |
| `moon ci` (57 actions, everything affected) | 48 s |
| Visual regression | 48 full-page screenshots (16 routes × 3 scenarios), pinned clock, 100-pixel tolerance |

## Final validation matrix

Run on 2026-10-01 at the head of the branch, each `check:ci` step on its
own so a failure would not hide the following ones.

| Check | Result |
|---|---|
| `pnpm install --frozen-lockfile`, Panda codegen | pass |
| Root tooling tests, skill projection, documentation links | pass |
| Root lint (Biome), workspace lint | pass |
| Docker workspace manifest | pass (after the worker image fix) |
| Moon graph and constraints, `moon ci` | pass |
| Typecheck (every workspace, TypeScript 7.0.2) | pass |
| Database schema drift check | pass |
| Tests | pass: api 773, web 477, worker 114, provider-runtime 77, external-investments 67, ui 64, ai 48, finance-engine 39, env 20, provider-contract 16, redis 12, api-contract 8, db 4 (+1 integration), powens 4, Python 78 |
| Production build, client bundle denylist, client bundle budget | pass |
| Migration journal on PostgreSQL 16 (`postgres:16-alpine`, throwaway container) | pass: 39 migrations applied, integration test green |
| E2E (Playwright, demo stack) | 65 passed |
| Visual regression | 48 screenshots, no difference above tolerance |
| GitNexus refresh | pass (7,528 nodes, 300 flows) |
| Desktop shell build (`pnpm desktop:build`) | not run: the Tauri CLI is not installed locally; the desktop code is unchanged (only a `moon.yml` was added) |

## Remaining limits

- Local validation ran on Node 22.17 and Bun 1.3.13 (the sandbox denies
  runtime downloads); CI runs the pinned Node 24.21 / Bun 1.4.2.
- The desktop shell build was not run locally (see the matrix).
- Visual baselines are local (font rendering is machine specific) and
  follow the local `.env` build flags (`VITE_*`). The run pins the clock on
  both sides of SSR (`e2e/support`), so relative labels do not drift;
  re-record only when a rendering change is intended.
- Panda's `_hover` is a plain `:hover`, whereas Tailwind 4 wrapped `hover:`
  in `@media (hover: hover)`; on touch devices a tapped control can keep its
  hover style until the next tap elsewhere. A `hover` condition override in
  the preset would restore the old behavior.
- `@finance-os/env` still uses the Zod 3 API (see the deviations).
