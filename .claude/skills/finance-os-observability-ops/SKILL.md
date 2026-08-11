---
name: finance-os-observability-ops
description: Design fail-soft behavior, safe telemetry, health probes, and actionable alerts for Finance-OS. Use for error handling, degraded UI states, structured logs, request IDs, diagnostics, health routes, or ops-alerts.
---

# Observability and operations

Inspect the current runtime contract instead of relying on generic fallback environment names.

## Runtime contract

- Logs are structured and secret-safe; include request ID, action, duration/status, and stable identifiers only.
- Error payloads use the established normalized shape and expose no raw provider payload, credential, stack, or SQL detail.
- Web health is `/healthz`; API health is `/health`; worker health is the shared heartbeat file.
- Analytics and metrics are descriptive. Product decisions and execution must continue if telemetry is unavailable.
- Each data surface distinguishes loading, empty, stale/degraded, error, offline/cache, and gated states when those states can occur.

## Alerts

- Map `critical -> P0`, `high -> P1`, and `medium/low -> P2`.
- Score additively: impact 0-5 + confidence 0-3 + recency 0-2; record the final score.
- Deduplicate by fingerprint, apply cooldowns, and notify on state changes rather than intervals.
- Put priority, score, owner, and next step before informational detail.

## Verification

Exercise dependency failure and recovery, redaction, request-ID continuity, health topology, and alert dedupe/resolution. For monitor changes run `node --test infra/docker/ops-alerts/monitor.test.mjs`; for routing changes also run the smoke scripts.

Current sources: `apps/api/src/observability/`, `packages/prelude/src/`, `infra/docker/ops-alerts/`, `scripts/smoke-api.mjs`, and `scripts/smoke-prod.mjs`.
