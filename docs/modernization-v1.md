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
| P6 | Node 24.21 / Bun 1.4.2 / Python 3.12 / pnpm 11.28 (catalog, `allowBuilds`, supply-chain policy), Biome 2.5 (replaced after P19 by oxlint and oxfmt), Playwright 1.63, Moon 2.5 Stage A. |
| P7–P8 | Explicit ambient types per project, test-tree typechecks, TypeScript 7.0.2 as the canonical compiler. |
| P9 | Pinned TanStack Start cohort, runtime `/api` proxy (`API_INTERNAL_URL` read per request), rolldown-vite bridge validated. |
| P10 | Vite 8.3.1 on Rolldown/Oxc, `@vitejs/plugin-react` 6 with the React Compiler through `@rolldown/plugin-babel`, Vitest 4.1.11, devtools gated out of production. Superseded after P19 by the Oxc toolchain (see below). |
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
- **Toolchain beyond the plan.** The plan stopped at the React Compiler
  through Babel, Vitest 4.1.11 and Biome. After P19 the web toolchain moved
  to Oxc end to end, experimental options included, each measured before
  being kept (see [Oxc toolchain](#oxc-toolchain-after-p19)).
- **Effect scope.** Effect is used for the provider policy only; it is not
  spread into domain code, and Effect 4 is not adopted.
- **Migration snapshot.** The journal had no snapshot since 0036; migration
  0038 ships with a full schema snapshot so the drift check is exact from
  here on.
- **Login E2E assertion.** The "panel does not move" assertion tolerates
  0.5px of transform noise from the reveal animation; it failed
  intermittently before the migration.
- **Zod 4 everywhere, env schema verified differentially.** The env schema
  moved last: first to `zod/v3` inside the single zod 4 dependency, then to
  the v4 API (`z.url()`, `z.email()`, `z.flattenError()`, a transform with
  `ctx.issues` and `z.NEVER` instead of `superRefine` plus a duplicate
  transform). Before the switch, the Zod 3 schema was frozen and both
  versions were run over 258 variables × 65 probe values (33,540 cases per
  service). Every behavioural difference falls in one of three intended
  Zod 4 tightenings: integers beyond 2^53 rejected, `Infinity` rejected (a
  budget set to `Infinity` no longer removes its cap), padded URLs trimmed
  (a padded `APP_URL` no longer yields `" https://…/api"`). Built-in error
  messages changed wording; a required URL now says "is required" when
  absent. `zod/v3` and `zod/v4` imports are forbidden by oxlint
  (`no-restricted-imports`).
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
| A boot error echoed the first 18 characters of an invalid `AUTH_*PASSWORD_HASH` value (a misplaced plaintext password) | Pre-existing | The message names the variable only; test asserts the value never appears |
| A fresh install (CI, Docker) failed with `ERR_PNPM_IGNORED_BUILDS` for esbuild and protobufjs | Modernization (P6 `allowBuilds` list written against an already built local `node_modules`) | Both reviewed and listed as `false` (optional install scripts); validated by `check:ci` in a clean worktree without `.env` |
| The demo transactions fixture test needed a complete API environment and failed wherever no `.env` exists, as in CI | Pre-existing | The route passes the two demo settings to the fixture, which no longer reads the API environment |
| Unhandled promises, unknown values stringified as `[object Object]`, refs written during render, state reset synchronously inside effects | Pre-existing, surfaced by oxlint's type-aware and React rules | Promises awaited or explicitly voided, typed text helpers, `useSyncExternalStore` for client-only state, refs refreshed in layout effects |

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

## Oxc toolchain (after P19)

The web toolchain now runs on Oxc and Rolldown from lint to build. The
options marked experimental are experimental upstream; each one was
measured on this repository and kept only when it held up.

Adopted:

- **Vitest 5.0.3** for the web and UI suites. The new defaults (`clearMocks`
  on, stricter `vi.mock` hoisting) required no test change.
- **React Compiler in Oxc** (experimental): `@vitejs/plugin-react` 6
  `react({ compiler })` with `oxc-transform-react` runs the compiler,
  TypeScript, JSX and Fast Refresh in one pass. Babel,
  `@rolldown/plugin-babel` and `babel-plugin-react-compiler` are gone. The
  options live in `apps/web/react-compiler.config.ts`, shared by the build
  and Vitest. The plugin compiles client environments only; SSR renders the
  same markup uncompiled.
- **oxlint**, type-aware through `oxlint-tsgolint` on TypeScript 7, replaces
  Biome's linter. Correctness and suspicious rules are errors, warnings fail
  the run, and unused disable directives are errors. Every remaining
  `oxlint-disable-next-line` carries its reason.
- **oxfmt** replaces Biome's formatter with the same style (migrated
  options), plus experimental import sorting and `package.json` key
  sorting. The repository was reformatted in a commit of its own. CI now
  checks formatting (`pnpm format:check`), which it never did with Biome.
- **Vite `resolve.tsconfigPaths`**: the `@/` alias has a single source,
  `tsconfig.json`, for the build and the tests.
- **Rolldown `experimental.lazyBarrel`** on the client and Nitro bundles.
- **Vitest `experimental.preParse`**.

Measured and not adopted:

| Option | Result |
|---|---|
| Rolldown `nativeMagicString` | No gain measured: production builds emit no sourcemaps |
| Rolldown `inlineConst` in `all` mode | +0.8 kB raw, same build time |
| `sideEffects: false` on `@finance-os/ui` | 59 → 76 client chunks |
| Vitest `isolate: false` | 3.5× faster, but per-file `vi.mock` leaked into other files |
| Vitest `experimental.viteModuleRunner: false` | Needs Node's native type stripping (Node ≥ 22.18; local Node is 22.17) |
| Vite `configLoader: 'native'` | Needs `--experimental-strip-types` on the local Node 22.17 |
| Vite bundled dev mode (`vite dev --experimentalBundle`) | The dev server starts with TanStack Start, but requests to it could not be exercised in this environment |

| Measurement | Value |
|---|---|
| Web production build, React Compiler through Babel | 11.3 s |
| Web production build, React Compiler in Oxc (same machine, same session) | 6.5–7.3 s |
| Compiled components | identical: 494 memo-cache sentinels in 22 chunks with either compiler |
| oxlint, type-aware, whole repository | 4.4 s |
| oxfmt `--check` (1,123 files) | 0.3 s |
| Client bundle | 887.6 kB gzip JS (887 kB before the switch) |

Validated on 2026-10-02 at the head of the branch:

- `pnpm check:ci`, `pnpm moon:ci` and the E2E suite also pass in a clean
  worktree with a fresh install and no `.env`, as CI runs them.
- `pnpm check:ci` passed every step, including the new format check.
  Tests: api 774, web 477, worker 114, provider-runtime 77,
  external-investments 67, ui 64, ai 48, finance-engine 39, env 30,
  provider-contract 16, redis 12, api-contract 8, powens 4, db 3, Python
  25 + 78.
- E2E: 65 passed. Visual regression: 48 screenshots, no difference above
  tolerance. The mobile-dark trading lab baseline was re-recorded once,
  for the intended single-column `minmax(0, 1fr)` chart track.

## Remaining limits

- Local validation ran on Node 22.17 and Bun 1.3.13 (the sandbox denies
  runtime downloads); CI runs the pinned Node 24.21 / Bun 1.4.2.
- The desktop shell build was not run locally (see the matrix).
- Vite's bundled dev mode stays off until a browser session confirms it
  serves the app; it can be tried with
  `pnpm --filter @finance-os/web exec vite dev --experimentalBundle`.
- Visual baselines are local (font rendering is machine specific) and
  follow the local `.env` build flags (`VITE_*`). The run pins the clock on
  both sides of SSR (`e2e/support`), so relative labels do not drift;
  re-record only when a rendering change is intended.
- Panda's `_hover` is a plain `:hover`, whereas Tailwind 4 wrapped `hover:`
  in `@media (hover: hover)`; on touch devices a tapped control can keep its
  hover style until the next tap elsewhere. A `hover` condition override in
  the preset would restore the old behavior.
