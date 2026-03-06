# AGENTS.md — Finance-OS (Single Source of Truth)

Last updated: 2026-03-03

Codex reads `AGENTS.md` before doing any work and applies the closest instructions for each file. This repo intentionally uses a SINGLE root `AGENTS.md` for now.

---

## 0) Mission (non-negotiable)

Finance-OS is a strictly personal, single-user “finance cockpit”.
Every feature must work in **two explicit execution paths**:

- **demo (default):** no DB reads/writes, no Powens/provider calls, deterministic mocks only
- **admin:** DB + providers enabled, guarded by admin session cookie and/or signed internal state

Fail-soft is mandatory:

- if any integration breaks (Powens/news/crypto/etc.), the app remains usable (fallback + clear messaging).

Privacy by design:

- never expose secrets to browser bundles (`VITE_*`), never log tokens/codes, encrypt sensitive tokens at rest.

If a change affects architecture, contracts, env, CI/CD, or Powens flows:
✅ update this file in the same PR.

---

## 1) Repo map (pnpm TypeScript monorepo)

Apps:

- `apps/api` Elysia HTTP API (Bun runtime)
- `apps/web` TanStack Start (SSR)
- `apps/worker` background jobs (Powens sync)

Packages:

- `packages/db` Drizzle schema + migrations
- `packages/env` env parsing/validation (single source of truth)
- `packages/powens` Powens client + crypto + queue payloads
- `packages/redis` Redis client factory
- `packages/ui` shared UI components (shadcn baseline)
- `packages/prelude` low-level utilities (errors/format/etc.)

Golden rule:

- Never invent scripts/commands. Always read `package.json` + docs to find canonical commands.

---

## 2) Non-breakable API contracts (must always exist)

These endpoints must NEVER “404 surprise” in production (demo + admin):

- `GET /auth/me` -> `200 { mode: "admin"|"demo", user }`

  - must be `Cache-Control: no-store`
  - must not call DB or Powens

- `GET /dashboard/summary?range=7d|30d|90d`
- `GET /dashboard/transactions?...` (paginated)
- `GET /integrations/powens/status`
Admin-only sensitive routes:

- `GET /integrations/powens/connect-url`
- `POST /integrations/powens/sync`
- `POST /integrations/powens/callback` (admin cookie OR valid signed state)

Prod routing principle:

- Public traffic terminates on **web** only.
- web proxies `/api/*` internally to `API_INTERNAL_URL`.
- api should not need a public route.

---

## 3) Architecture rules (backend)

Layering is mandatory:

- `routes/` HTTP parsing, validation, status codes, response shaping only
- `domain/` use-cases orchestration (no HTTP framework coupling)
- `repositories/` DB/Redis persistence + queue writes
- `services/` external providers + deterministic helpers
- `runtime.ts` composition root
- `plugin.ts` Elysia plugin that decorates runtime into ctx

Demo-first enforcement:

- In handlers/use-cases, the demo branch MUST short-circuit BEFORE any DB/Powens call.

---

## 4) Frontend rules (TanStack Start + Query)

Loader-first:

- Route-critical data comes from loader.
- Use `ensureQueryData` to prewarm cache.
- Avoid `useEffect` for request orchestration.

Auth consistency (no demo->admin flash):

- loaders should prefetch `/auth/me`
- SSR must keep first render auth-consistent
- on auth failure/network: fallback to demo, do not crash SSR

Query rules:

- server state uses Query/Mutation (no mirrored local state).
- define query keys/options in feature modules.
- mutations invalidate/refetch coherently.
- dashboard filters live in URL search params (no duplicate local state).

---

## 5) Powens integration (flow + security + boundaries)

Flow:

1. web -> `GET /integrations/powens/connect-url` (admin only)
2. api returns webview URL with short-lived signed state (HMAC, admin:true, exp:+10min)
3. user finishes Powens -> lands on web callback route
4. web callback POSTs to api callback
5. api exchanges code -> token, encrypts (AES-GCM `APP_ENCRYPTION_KEY`), upserts connection, enqueues job
6. worker syncs, updates status
7. dashboard reads `/integrations/powens/status`

Security:

- NEVER log Powens code/tokens
- persist only encrypted tokens
- sanitize error payloads

Worker boundaries:

- isolate failures per connection
- per-connection lock in Redis
- idempotent upserts
- maintain operational metrics
- never expose tokens in logs

---

## 6) Agentic team workflow (roles + breakpoints)

Roles:

1. **PM/Orchestrator**: turns specs into scoped implementation issues; owns priorities + acceptance criteria.
2. **Challenger**: proposes improvements/pivots; does NOT code.
3. **Dev/Implementer**: codes exactly the accepted scope; does NOT change product scope.
4. **Reviewer**: review only; does NOT implement features.

Breakpoints (max 3 per feature):

- **BP1 (Approach):** plan + contracts + risks + kill-switch/rollback approved
- **BP2 (PR ready):** CI green, tests done, UI screenshots if relevant
- **BP3 (Release ready):** changelog, flags, monitoring, deploy notes

Mandatory concise status format (every approval request):

- Status: (WAITING_YOU / BLOCKED / READY)
- What changed: (max 3 bullets)
- Risk: (low/med/high + why)
- Needs you: (one decision/question)
- Next: (one next step)

Label expectations:

- `agent:pm`, `agent:challenger`, `agent:dev`, `agent:review`
- `breakpoint`, `needs:you`, `ready`, `blocked`
- `area:*` and `prio:*` must be set on issues/PRs.

---

## 7) ENV / API keys playbook (MANDATORY)

If work requires a new external service / API key:

1. Add an **ENV CHANGE REQUEST** in the issue/PR:

   - Provider + purpose
   - Free vs paid (prefer free; justify paid)
   - Exact env var names (server-only unless explicitly safe)
   - Where used (api / web-SSR / worker)
   - How to obtain the key (steps)
   - Prod placement (Dokploy: which service)
   - Rotation plan
   - Failure mode + fallback

2. Update in the same PR:
   - `packages/env` schema
   - `.env.prod.example`
   - relevant deploy docs

Hard rule:

- secrets NEVER go into `VITE_*`.

---

## 8) Observability baseline (required)

- propagate `x-request-id` end-to-end (web SSR -> api -> worker)
- API logs structured JSON: level, msg, route, method, status, requestId
- error payload normalized: code, message, requestId, optional safe details
- redact secrets; do not log sensitive callback query params

---

## 9) UI/UX quality bar (premium cockpit)

Shadcn is a baseline, not the finish line.

Must-have states on any UI work:

- loading (skeletons matching layout, not generic spinners)
- empty (beautiful, instructive)
- error (clear + recoverable)
- success (tactile feedback)

Design discipline:

- consistent spacing rhythm
- clear hierarchy (typography, weight, contrast)
- accessibility (keyboard, ARIA, contrast)
- performance: heavy graphs lazy-loaded; SSR stable

Anti-slop rules:

- do not ship “generic 3 equal cards” layouts by default
- verify dependencies before importing new libs (check `package.json`)
- avoid gratuitous neon/glow/over-gradients; keep one accent color

When UI changes:

- include a short “UI rationale” in PR + before/after screenshots.

---

## 10) Review guidelines (for Codex GitHub reviews)

Severity:

- **P0:** security issue, secret leak risk, data loss, auth/demo dual-path broken, Powens token/code exposure
- **P1:** contract regression, missing demo path, missing tests for behavior change, SSR auth flash regression, unsafe logging
- **P2:** style/nit (do not block unless requested)

Review focus (always):

- demo/admin dual-path correctness
- no secret exposure (`VITE_*`, logs, error payloads)
- endpoint contracts preserved
- tests + CI green
- rollback/kill-switch present for risky integrations

Docs rule:

- treat typos in docs as P1 only if the PR is “docs-only”.

END.
