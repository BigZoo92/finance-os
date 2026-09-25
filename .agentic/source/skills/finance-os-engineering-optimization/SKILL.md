---
name: finance-os-engineering-optimization
description: Choose the simplest efficient modern implementation for Finance-OS TypeScript, React, Bun, module, async, and build code, and fix clearly suboptimal touched code within task scope. Use when creating or refactoring TypeScript, designing modules/imports, writing React or backend/worker code, orchestrating async or provider work, or working on runtime, bundle, code-splitting, or Vite build performance.
---

# Engineering optimization

## Decision rule

Use the least complex solution that fully satisfies the actual requirement: complexity must earn its place. Priority order: correctness, security and data integrity, repository and domain contracts, simplicity, runtime and user performance, maintainability, testability, developer experience, novelty. Newer, more abstract, or more sophisticated is not automatically better; constantly reduce accidental complexity, and optimize architecture and data flow before syntax.

## Version truth

- The installed toolchain is the source of truth: read the relevant `package.json`/lockfile before using any version-sensitive feature; never use syntax, options, or APIs the installed version lacks. Modern means using current supported capabilities when they improve the code, not adopting an API because it is newer.
- Current anchors: TypeScript 7 native compiler (`tsc` 7.0.x; strict, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax` everywhere except the Start web app, no `baseUrl`, no project references, no programmatic compiler API), React 19 + React Compiler, TanStack Start/Router/Query, Vite 7 on Rollup (`build.rollupOptions`; the future Vite 8/Rolldown migration renames it and replaces `manualChunks`, so treat new manual-chunk config as migration-sensitive), Bun runtime for api/worker/scripts, Biome, Vitest/`bun test`, Effect 3 (currently only in `packages/external-investments`; v4 not adopted — keep 3.x idioms such as `Effect.retry` + `Schedule`, `Effect.timeout`, `Effect.all` with `concurrency`).
- Ambient types are explicit per project: `config-ts/server.json` for Node/Bun servers, `config-ts/isomorphic.json` for packages that run in Node, Bun, and browsers (web-platform globals only), `config-ts/test.json` for Bun test trees (`tsconfig.test.json`). Do not reach for Node or Bun APIs in an isomorphic package. After a real migration, remove workarounds it obsoletes — never before understanding why each exists.
- Do not upgrade dependencies or add `latest`/prerelease pins inside unrelated tasks. Where the repo intentionally uses prereleases (`nitro-nightly`, `elysia@latest`), follow that local contract; do not "fix" it.

## Scoped boy-scout rule

When touched code clearly violates this skill, improve it in the same change if the problem is understood and the fix is local, safe, verifiable, and does not intentionally change behavior: remove obvious local duplication or dead code in the modified flow, replace a needless barrel import with a direct one, parallelize independent I/O, drop a useless type assertion or an empty abstraction, reuse an existing repository primitive, eliminate duplicated expensive computation, an obvious N+1, or a hand-rolled retry/poll an owned abstraction covers. Improve the smallest coherent local unit; do not turn normal implementation work into unsolicited architecture cleanup, and report larger opportunities separately. Net effect per change: leave the touched area at least as simple, safe, performant, typed, and maintainable as before — avoid adding new technical debt while opportunistically removing small amounts of existing debt.

## Simplicity and abstraction

- Prefer explicit over magical, obvious control flow over clever code, composition over unnecessary inheritance or abstraction, pure functions when side effects are unneeded, direct data flow over synchronized copies of state, local ownership over global state, concrete domain naming over vague generic naming, and deletion over unused flexibility.
- Do not introduce without a concrete present need: extra abstraction layers, interfaces or factories with a single implementation, wrappers around already-clear APIs, complex generics without real benefit, parallel repository/service layers without a distinct responsibility, internal event buses for simple calls, hand-rolled dependency injection, configurability for values that never vary, caches or memoization without a measured problem, speculative extension points, or distributed/concurrent architecture without necessity. Do not design for hypothetical future requirements unless the current architecture has an explicit, demonstrated need for extensibility. Prefer deleting unnecessary complexity over abstracting it.
- The test is always total cost, not dogma: abstraction earns its place when it removes real conceptual duplication, a generic when it has genuinely multiple uses, a service when it owns a distinct responsibility/lifecycle/dependency, a cache when it solves a real measured cost. No arbitrary thresholds (max lines, one class per file, always-extract, always-interface, mandatory patterns); decide on responsibility, cohesion, complexity, coupling, change frequency, and testability. A 60-line linear function can beat six artificial abstractions.
- Existing abstraction first — before creating one, ask: does the repository, the current stack (TanStack, Effect, Elysia, Drizzle, validation, logging, configuration, caching, HTTP clients, auth, providers, queues), or the platform already own this? Would a plain function suffice? Is it actually reused? Never create a parallel abstraction when an existing repository primitive already owns the responsibility.
- No speculative refactoring: a significant refactor needs a concrete motivation — bug, complexity reduction, duplicated behavior, performance, maintainability, testability, security, architectural invariant, or explicit task requirement — never just "this could be cleaner" when it raises risk or scope without real benefit.

## TypeScript

- Make invalid states hard to represent: discriminated unions with exhaustive branching, `readonly` where it reflects the real contract, `unknown` (never `any`) at untrusted boundaries, honest narrowing over convenience casts, no `as any` or unjustified `@ts-ignore`.
- Prefer inference where it is clearer than repeated annotations; use `satisfies` when it validates without widening.
- `verbatimModuleSyntax` requires `import type` for type-only imports; `exactOptionalPropertyTypes` requires omitting absent optional keys.

## Modules, bundles, splitting

- Direct imports inside apps and hot paths. Barrels only as intentional stable public APIs at genuine package boundaries — the small curated `exports` maps in `packages/*` are that contract; preserve them when changing internals, and prefer them over accidental deep imports across packages. Never create a barrel for shorter paths; treat `export *` with suspicion.
- Protect tree shaking: keep module scope side-effect-free, avoid importing a heavy dependency for one small function, respect `exports`/side-effect semantics.
- Keep Vite defaults and automatic code splitting. Dynamic-import at meaningful boundaries (three/D3/force-graph views, heavy editors, optional integrations, post-navigation features), not tiny utilities, immediately needed code, or splits that create waterfalls. Manual chunking requires inspecting the actual build output first and accounting for execution order; avoid both giant vendor chunks and swarms of micro-chunks. Do not copy legacy Rollup recipes into new config.
- Performance is transfer + parse/execute + waterfalls + hydration + rendering + caching, not gzip size alone. Backend/worker: batch or parallelize round trips, bound concurrency, keep expensive work and excessive logging out of hot paths, never let one provider block others.

## Optimization order

- Optimize the largest meaningful bottleneck first, looking roughly in this order: architecture, unnecessary work, I/O, data flow, algorithms and data structures, network/DB round trips, concurrency, module graph and bundle boundaries, rendering and hydration, allocations, syntax-level micro-optimizations. Do not optimize syntax while avoidable I/O, duplicated work, waterfalls, N+1 behavior, or unnecessary module loading remains.
- Apply without benchmarks when clearly better: removing accidental sequential I/O, duplicate requests, N+1s, hot-path barrels being touched, duplicated work, impossible/unsafe type states.
- Measure first for tuning: manual chunks, memoization, cache layers, virtualization, custom scheduling, concurrency settings, exotic flags. Prefer readability when performance differences are immaterial — clearer, less fragile, more testable code wins when the real cost is negligible; in genuinely hot paths avoid repeated parsing/sorting of unchanged data and obvious O(n²) with a natural O(n log n) alternative.
- For any non-trivial optimization, answer "How do we know this is better?": simpler control flow, fewer requests/round trips/modules loaded/failure modes, lower algorithmic complexity, smaller bundle, measured execution time, less duplicate state, fewer dependencies, stronger type guarantees, clearer ownership, or tests proving unchanged behavior.

## React and async

- Follow `finance-os-web-stack` for Query/Router/SSR patterns; this skill adds no competing data rules. Let React Compiler memoize: do not add `useMemo`/`useCallback`/`memo` mechanically, and do not remove existing manual memoization without a semantic or measured justification. Derive state instead of duplicating it; avoid unnecessary Effects; poll only while an operation is active.
- Parallelize truly independent async work with bounded concurrency; propagate `AbortSignal`/cancellation when the surrounding API supports it; no orphaned async work.
- Prefer the simplest abstraction that correctly models the problem: Effect is valuable when it removes real complexity around failures, concurrency, resources, dependencies, scheduling, or lifecycle; plain TypeScript remains preferable when those concerns do not exist. Fit check — consider Effect seriously when touched code combines several of: typed expected failures, retry/backoff, timeout, cancellation, resource lifetime, structured concurrency, service wiring, provider/workflow orchestration — prefer it there over new hand-rolled versions of those concerns. Weak fit: pure functions, React presentation, mappers/formatters, a trivial promise or `Promise.all`, framework glue. Never install Effect in an unrelated task, migrate a module for a few lines, or replace Elysia/Drizzle/TanStack/React responsibilities with it.

## Dependencies and platform

Dependencies are not free: each adds runtime, bundle, install/build, security, maintenance, API-churn, and cognitive cost. Choose between platform, repository primitive, existing dependency, new dependency, or local code by total cost. Before adding one: check whether the platform (Web APIs in Bun/Node/browser — `AbortSignal`, `URL`, `structuredClone`, native array/string primitives) or an existing dependency already solves it, check its bundle impact if it can reach the client, and skip packages for trivial lines — but avoid not-invented-here: a reliable dependency beats a homegrown implementation of a complex or sensitive primitive. Verify actual runtime support before using a platform API.

## Code smells in touched code

Recognize these in code you touch and fix them within the boy-scout bounds:

- Complexity: giant functions/modules, deep nesting, excessive branching, boolean-flag APIs, primitive obsession where a domain type prevents real errors, shotgun changes, excessive indirection, wrappers without semantic value, generic abstractions with one real use.
- State: duplicated state, independently stored derived state, synchronization effects, stale caches, multiple sources of truth, shared mutable state, global state for local concerns.
- Types: broad `any`, unsafe assertions, repeated casts, `@ts-ignore`, representable impossible states, stringly typed domain values, optional fields compensating for unclear modeling, catching `unknown` and discarding useful failure information.
- Async: sequential independent I/O, unmanaged background work, missing cancellation, unbounded concurrency or retries, permanent polling, duplicate requests, swallowed rejections, broad `try/catch`, valueless async wrappers.
- Data: N+1 behavior, repeated parsing/serialization, repeated sorting/filtering of unchanged large datasets, unnecessary copies, fetching far more data than required, transformations duplicated across layers.
- Modules: accidental circular dependencies, convenience barrels, broad `export *`, accidentally exposed internals, huge dependency surfaces, deep cross-package imports bypassing intentional public APIs, heavy module loading on hot paths.
- Dependencies: duplicate libraries for one problem, packages for trivial functionality, a dependency serving one tiny helper, large browser dependencies for small APIs, dependencies obsoleted by platform capabilities.
- Errors: swallowed errors, logging-and-rethrowing without added context, string parsing to identify error types, retrying permanent failures, expected failures converted into defects, internal details leaking to users.
- Tests: implementation-coupled tests, excessive mocking, nondeterministic timers/sleeps, missing failure-path coverage, integration tests where a deterministic unit test suffices, huge fixtures for tiny behavior.

## Anti-patterns

Premature abstraction, memoization, or manual chunking; speculative plugin/extension architectures for single implementations; unmeasured vendor/micro chunk schemes; dynamic imports for tiny code; rewriting stable framework responsibilities; Effect everywhere; drive-by `latest` upgrades; optimizing benchmark numbers over real user/runtime behavior.

## Verification

Optimization follows task scope. Verify each improvement like any behavior change: nearest tests, package typecheck/lint, build when bundling behavior changed, and before/after evidence for tuning claims. Domain, security, design, and verification skills stay authoritative; this skill chooses efficient implementations inside their boundaries.
