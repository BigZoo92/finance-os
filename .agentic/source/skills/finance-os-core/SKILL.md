---
name: finance-os-core
description: Enforce Finance-OS demo/admin, privacy, request tracing, fail-soft, and read-only finance boundaries. Use before changing auth, routes, data access, environment variables, logging, or external integrations.
---

# Finance-OS core

Read the nearest `AGENTS.md` first. This skill turns the global invariants into a change workflow; it does not replace local instructions.

## Before editing

1. Identify every entry point and whether it is public, admin-session, internal-token, or signed Powens-state traffic.
2. Trace both execution paths:
   - `demo`: deterministic fixtures only; no database, Redis, provider, or write side effects.
   - `admin`: database/providers only after the expected session or internal-state guard.
3. Identify secret-bearing values and all log/error surfaces they could cross.
4. Run GitNexus impact for each symbol that will change.

## Required behavior

- In API routes, prefer `demoOrReal` and existing guards over ad-hoc mode checks.
- Omit absent optional keys; `exactOptionalPropertyTypes` rejects explicit `undefined`.
- Keep public traffic on `apps/web`; browser `/api/*` requests are proxied to `API_INTERNAL_URL`.
- Propagate `x-request-id` through API calls, jobs, logs, and safe error responses.
- Return normalized, user-safe errors and keep the rest of the cockpit usable on dependency failure.
- Keep secrets server-only. Never add a secret to `VITE_*`, browser DTOs, fixtures, logs, or prompts.
- Never add mutations for trading, order placement, withdrawals, transfers, or any hidden execution-ready path. Read-only ingestion may retain provider history for analytics.

## Verification

- Add a deterministic demo assertion and an authenticated admin assertion for behavior changes.
- Assert forbidden provider/DB calls are not reached in demo mode.
- Exercise the smallest relevant tests, then `pnpm typecheck` and `pnpm agent:skills:check` when instructions changed.

Use `apps/api/src/auth/demo-mode.ts`, `apps/api/src/auth/context.ts`, `packages/env/src/index.ts`, and the nearest route tests as current implementation references.
