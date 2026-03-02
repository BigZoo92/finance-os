# AGENTS.md — Finance-OS (Source of Truth for Coding Agents)

Last updated: 2026-03-02

This file is the repository-wide source of truth for architecture, workflow, and non-negotiable rules for AI/code agents working on Finance-OS.

> Progressive disclosure rule:
>
> - Read this file first.
> - Also read local AGENTS/AGENT files when touching those areas:
>   - ./AGENT.md
>   - apps/api/AGENT.md
>   - apps/web/AGENT.md
>   - apps/worker/AGENT.md (if exists)
>   - packages/\*/AGENT.md (when present)

---

0. Mission & product guardrails (non-negotiable)

---

Finance-OS is strictly personal, single-user, with a mandatory dual-path on almost every feature:

- demo path (default): no DB reads/writes, no Powens/provider calls, deterministic mocks only.
- admin path: DB + providers enabled, guarded by admin session (cookie) and/or signed internal state.

Fail-soft:

- If an external integration breaks (Powens/news/crypto), the app stays usable with graceful fallback and clear messaging.

Privacy by design:

- No secrets in browser builds, no token leaks in logs/errors, encrypt sensitive tokens at rest.

Observability first:

- No feature ships without minimal logs/metrics/trace hooks.

Experimental stack bias:

- Prefer modern/beta/alpha tech if it gives leverage (Bun/Elysia/TanStack), BUT:
  - wrap risky parts behind feature flags / kill-switches,
  - provide fallback behavior,
  - keep rollback simple.

If a change affects architecture, boundaries, conventions, scripts, shared packages, or Powens flows:
✅ update this file in the same patch/PR.

---

1. Repo map (monorepo)

---

pnpm TypeScript monorepo `finance-os`:

Apps:

- apps/api : Elysia HTTP API (Bun runtime)
- apps/web : TanStack Start web app (SSR)
- apps/worker : background jobs (Powens sync)

Packages:

- packages/db : Drizzle schema/client/migrations
- packages/env : env parsing + validation (single source of truth)
- packages/powens : Powens client + crypto + queue payloads
- packages/redis : Redis client factory
- packages/ui : UI components/styles (shadcn present, not sufficient alone)
- packages/prelude : low-level shared utilities (errors/format/etc.)

Never invent scripts/commands:

- Always open package.json and docs to find the canonical commands for dev/test/build/migrate.

---

2. Non-breakable API contracts (must always exist, demo + admin)

---

These endpoints must NEVER “404 surprise” in production:

- GET /auth/me -> 200 { mode: "admin"|"demo", user }

  - must be Cache-Control: no-store
  - must not call DB or Powens

- GET /dashboard/summary?range=7d|30d|90d
- GET /dashboard/transactions?... (paginated)
- GET /integrations/powens/status

Admin-only sensitive routes:

- GET /integrations/powens/connect-url
- POST /integrations/powens/sync
- POST /integrations/powens/callback (admin cookie OR valid signed state)

Routing principle (prod):

- Public traffic terminates on web (SSR) only.
- web proxies /api/\* internally to API_INTERNAL_URL.
- api should not need a public route.

---

3. Agentic team workflow (roles, boundaries, comms)

---

We run a 4-agent pipeline:

1. PM/Orchestrator
2. Challenger (product improvement)
3. Dev/Implementer
4. Reviewer

Hard boundaries:

- Challenger does NOT code.
- Dev does NOT change product scope (must follow spec + accepted clarifications).
- Reviewer does NOT implement features; reviewer asks for changes.

  3.1 Breakpoints (max 3 per feature)
  Agents must stop and request approval using label `needs:you` (or explicit ping) at:

- BP1: Approach approved (plan + contracts + risks)
- BP2: PR ready (CI green, tests done, screenshots/notes if UI)
- BP3: Release ready (changelog, flags/rollbacks, deploy notes)

  3.2 Mandatory concise status format (every ping)
  When requesting validation, respond exactly with:

- Status: (WAITING_YOU / BLOCKED / READY)
- What changed: (max 3 bullets)
- Risk: (low/med/high + why)
- Needs you: (one decision/question)
- Next: (one next step)

---

4. PR rules (quality, scope, safety)

---

- Small PRs preferred (avoid “god PR” refactors).
- No refactor unless explicitly requested by spec/issue.
- Tests required when behavior changes:
  - unit/integration where relevant,
  - SSR boundary checks for auth/demo,
  - worker job idempotency when touching sync.
- Docs required when contracts change:
  - .env examples, docs/\*, and this AGENTS.md if needed.
- Never commit secrets.
- Never expose internal tokens via VITE\_\*.

Definition of Done (DoD) for any feature:

- demo path works and is deterministic
- admin path works (guarded)
- UI has explicit demo state (banner/badge + disable sensitive actions)
- CI green + tests
- logs/errors sanitized (no tokens, no codes)
- feature flags / kill-switch if integration-risky or beta tech

---

5. Architecture rules (backend)

---

Layering is mandatory:

- routes/ : HTTP parsing, validation, status codes, response shaping only
- domain/ : use-cases (orchestration), no HTTP framework coupling
- repositories/: DB/Redis persistence and queue writes
- services/ : external providers + deterministic helpers
- runtime.ts : composition root for dependencies
- plugin.ts : Elysia plugin that decorates runtime into ctx

Elysia practices:

- Use plugin system for DI.
- Type decorated context for route modules.
- Keep route registration modular (.use(routePlugin)).
- Keep set.status and response shaping in route layer only.
- Validate ranges/pagination at boundary (7d|30d|90d).

Demo-first enforcement:

- In handlers/use-cases, demo branch must short-circuit BEFORE any DB/Powens call.

---

6. Frontend rules (TanStack Start + Query)

---

Loader-first strategy:

- Route-critical data comes from loader.
- Use ensureQueryData in loaders to prewarm cache.
- Avoid useEffect for data orchestration; prefer loaders + Query.

Auth consistency (no demo -> admin flash):

- loaders should prefetch auth/me
- SSR should keep first render auth-consistent
- On auth failure/network: fallback to demo, do not crash SSR

Query rules:

- Server state uses Query/Mutation (no “mirrored” local state).
- Define query keys/options in feature modules.
- Mutations invalidate/refetch keys coherently.
- Search params for dashboard filters (avoid duplicate local state).

TanStack DB:

- Only if it provides clear relational/cache value beyond Query.

---

7. Powens integration (flow, security, responsibilities)

---

Flow:

1. web -> GET /integrations/powens/connect-url (admin only)
2. api returns webview URL with short-lived signed state (HMAC, admin:true, exp:+10min)
3. user finishes Powens -> lands on web callback route
4. web callback POSTs to api callback
5. api exchanges code -> token, encrypts (AES-GCM APP_ENCRYPTION_KEY), upserts connection, enqueues job
6. worker syncs, updates status
7. dashboard reads /integrations/powens/status

Security:

- Never log Powens code or tokens.
- Persist only encrypted tokens.
- Sanitize error payloads (toSafeErrorMessage).

Worker boundaries:

- isolate failures per connection
- per-connection lock in Redis
- idempotent upserts
- maintain operational metrics (counts, last sync start/end)
- never expose tokens in logs

---

8. Observability baseline (required)

---

- Propagate x-request-id end-to-end (web SSR -> api -> worker)
- API logs structured JSON to stdout/stderr:
  level, msg, route, method, status, requestId
- Error payloads normalized:
  code, message, requestId, optional safe details
- Sampling/redaction:
  - redact secrets automatically
  - do not log sensitive query params (callback)

When adding monitoring/alerts integrations:

- must be admin-only surfaces
- must support “incident mode” kill-switch to disable providers

---

9. Environment variables & “New API key” playbook (MANDATORY)

---

Agents MUST handle env changes explicitly and safely.

If a feature needs a new external service/API key:

1. Create an “ENV CHANGE REQUEST” comment in the issue/PR:
   - Provider name + purpose
   - Free vs paid plan (prefer free; justify paid)
   - Exact env var names (server-only unless explicitly safe)
   - Where used (apps/api, apps/web SSR, worker)
   - Rotation plan (how to change without breaking)
   - Failure mode (what happens if missing)
2. Update:
   - packages/env validation schema
   - .env.prod.example (and other env examples)
   - docs/deploy-dokploy-env.md (or relevant deploy docs)
3. Production placement rules:
   - Put secrets only in Dokploy runtime env for api/worker (and web SSR if required).
   - Never expose secrets in VITE\_\*.
   - If web SSR needs internal auth, use PRIVATE_ACCESS_TOKEN server-side only (never VITE).

If the env var is missing:

- feature must fail-soft and keep app usable (demo remains available).

---

10. Deployment (Dokploy + GHCR + Docker) — condensed rules

---

Source of truth:

- docker-compose.prod.yml (no build)
- infra/docker/Dockerfile (multi-target)
- docs/deployment.md, docs/ci-cd.md, docs/deploy-dokploy-env.md

Image strategy:

- CI builds and pushes GHCR images for web/api/worker.
- Prod compose references image: only (no build).
- Use immutable tags (vX.Y.Z or sha-\*), no latest.

Runtime hardening (when possible):

- run as non-root
- read_only + tmpfs /tmp
- cap_drop ALL + no-new-privileges

Migrations:

- API bootstrap migration via RUN_DB_MIGRATIONS (Drizzle migrations)
- do not bypass migration history with manual SQL scripts

---

11. UI/UX quality bar (beyond shadcn)

---

We want “premium cockpit” UX. Shadcn is a baseline, not the finish line.

UI quality checklist:

- clear hierarchy (spacing, typography, rhythm)
- states: loading/empty/error/success (no jank)
- micro-interactions: hover, pressed, focus, skeletons
- accessibility: keyboard, ARIA, contrast
- performance: heavy graphs lazy-loaded; SSR stable

High-agency UI guidance:

- avoid “generic dashboard slop”
- prefer cohesive layouts, proper spacing, tasteful motion
- when building new UI modules, include a short “UI rationale” in PR:
  - what changed visually
  - screenshots (before/after) if relevant
  - why it improves daily usability

---

12. Local instructions & directory overrides

---

Always read local AGENT(S).md files when present:

- apps/api/AGENT.md
- apps/web/AGENT.md
- packages/\*/AGENT.md

If local rules conflict with root rules:

- local rules win for that directory,
- but root non-negotiables still apply (demo/admin dual-path, no secrets, contracts).

END.
