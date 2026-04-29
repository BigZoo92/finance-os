# Canonical Contracts Guide

> Canonical source for HTTP contract expectations and non-regression rules.

## Document Template (Required)

1. Contract catalog
2. Owners and callsites
3. **Demo/Admin dual-path**
4. **Observability & Safety**
5. **UI/UX state matrix** (if contract has UI impact)
6. Verification
7. Rollback / kill-switch

## Contract Catalog

All contract docs should provide:

- Method + path
- Required response envelope
- Mode-specific behavior (demo/admin)
- Failure/degraded semantics
- Owning API route and web/worker consumer links

## Owners and Callsites

- API owners live in `apps/api/src/**/routes/*.ts`.
- Web consumers live in `apps/web/src/features/*query-options.ts` and route loaders.
- Worker or integration dependencies must be linked when contracts depend on sync freshness.
- Knowledge memory contracts are owned by `apps/api/src/routes/dashboard/routes/advisor-knowledge.ts` and proxied to the internal-only `apps/knowledge-service` in admin mode. Demo mode must return deterministic fixtures and never call the service.

## Current Special Contracts

| Surface | Paths | Required behavior |
| --- | --- | --- |
| Advisor knowledge memory | `/dashboard/advisor/knowledge/stats`, `/schema`, `/query`, `/context-bundle`, `/explain`, `/rebuild` | requestId propagation, safe errors, demo fixtures, admin fail-soft fallback, rebuild admin/internal only |
| Knowledge service internal API | `/health`, `/version`, `/knowledge/*` | internal-only, structured logs, no PII/raw secret logging, temporal provenance on entities and relations |
| Powens connection management | `/integrations/powens/status`, `/sync`, `/callback`, `/connections/:connectionId` | demo deterministic/no writes, admin-only mutations, signed callback state, encrypted tokens, soft-disconnect/archive, hidden archived connections, worker skips archived rows |

## Demo/Admin Dual-Path (Required)

### Demo path

- Contract must resolve from deterministic fixtures.
- No DB/provider coupling.

### Admin path

- Contract may use DB/provider data with auth gating.
- Output shape must remain stable even if live sources degrade.

### Fail-soft fallback

- Preserve response schema with safe defaults when upstream data is delayed/unavailable.

## Observability & Safety (Required)

- **Request ID propagation:** include request id in logs and error payload metadata.
- **Logging redaction rules:** avoid sensitive payload logging.
- **Normalized error contract:** stable error envelope with exposable fields only.
- **Health/smoke verification expectations:** include impacted route assertions in smoke coverage.

## UI/UX State Matrix (Required when UI consumes contract)

| Consumer mode | Loading | Empty | Error | Degraded | Fallback copy |
| --- | --- | --- | --- | --- | --- |
| Demo | Required | Required | Required | Required | Required |
| Admin | Required | Required | Required | Required | Required |

## Verification

- Run route and contract tests first.
- Then run `pnpm check:ci`.
- For route topology changes, run smoke scripts and document evidence.

## Rollback / Kill-Switch

- Revert contract migration commit if schema drift appears.
- Keep deprecated contract docs as redirect stubs for one release cycle.
