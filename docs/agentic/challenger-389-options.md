# Challenger options for Parent spec #389: Ops overview admin unifiée

## Option 1 — Admin-only unified console page (low blast radius)
- **Demo/admin dual-path**
  - `demo`: render deterministic mock ops KPIs, incidents, and task queues from static fixtures only.
  - `admin`: enable live data panels sourced from DB/providers behind admin session cookie and signed internal state.
- **Observability**
  - Require `x-request-id` propagation from web route to API calls and structured logs for panel-level load errors.
  - Emit normalized error objects per widget (`service`, `scope`, `requestId`, `safeMessage`).
- **UI/UX states**
  - Skeleton on first load, partial-degradation banners per failed provider, explicit `demo data` badge.
  - Empty state for no active incidents and stale-data badge when provider freshness exceeds threshold.
- **Risks**
  - Dashboard fragmentation if current admin pages stay in parallel too long.
  - Inconsistent panel contracts if each widget evolves independently.
- **Rollback/kill-switch**
  - Feature flag `ops_overview_unified_admin` defaults off; route-level fallback to current admin ops page.

## Option 2 — Progressive merge with shared ops domain contract (balanced)
- **Demo/admin dual-path**
  - Build a shared `ops overview` contract with deterministic fixture adapter (`demo`) and live adapter (`admin`).
  - Enforce no DB/provider reads in demo via adapter boundary tests.
- **Observability**
  - Shared telemetry helper for request lifecycle and panel timing metrics keyed by `x-request-id`.
  - Standardized safe error taxonomy to reduce ad hoc logging.
- **UI/UX states**
  - Unified state model for loading, empty, degraded, and recovered states across all widgets.
  - Top-level health strip summarizes failing integrations with actionable fallback text.
- **Risks**
  - Medium implementation cost due to contract extraction and migration sequencing.
  - Potential short-term duplication while old and new adapters coexist.
- **Rollback/kill-switch**
  - Flag both route and adapter (`ops_overview_contract_v1`), allowing fallback to legacy page and legacy data mappers.

## Option 3 — Full replacement + hard cutover (highest speed/risk)
- **Demo/admin dual-path**
  - Replace existing ops pages with one unified route immediately; demo/admin switch inferred by session context.
- **Observability**
  - Single instrumentation path, but limited soak time before production usage.
- **UI/UX states**
  - Consistent states by design, but reduced iteration window for UX hardening.
- **Risks**
  - High risk of regressions in admin-only workflows and fallback behavior under provider failures.
  - Limited rollback granularity because legacy path removed.
- **Rollback/kill-switch**
  - Coarse rollback only (revert deployment), no fine-grained widget disablement.

## Recommendation
Recommend **Option 2**. It best preserves Finance-OS invariants by explicitly modeling demo/admin separation, normalized observability, and consistent degraded UX while keeping rollback levers at both route and data-adapter layers.

Status: READY
What changed:
- Added three challenger implementation options with explicit dual-path handling.
- Added risk and kill-switch/rollback guidance per option.
- Added a single recommendation optimized for safety and maintainability.
Risk: low — documentation-only change, no runtime behavior modified.
Next: convert Option 2 into an implementation checklist with acceptance tests for demo/admin and fallback states.
