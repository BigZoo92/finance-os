# PR16 — Provider Abstraction: OpenBB + Hyperswitch reference notes

> **Status**: research / documentation only — no runtime change in this PR.
> **Date**: 2026-05-09
> **Companion**: [`docs/adr/provider-abstraction-v2.md`](../adr/provider-abstraction-v2.md) (the proposal).
> **Scope**: read-only architectural notes on two open-source projects whose abstraction
> patterns are useful inputs to Finance-OS's v2 design. Neither is a runtime dependency.

---

## 0. Purpose of this file

The ADR (`provider-abstraction-v2.md`) contains the proposal. This file collects the
**reference notes** that informed the proposal — exclusively to make the decisions in the
ADR auditable. It is intentionally short.

The two projects below were flagged in PR13's audit as "high-priority architectural
inspiration, not vendoring candidates":

- [`docs/research/advisor-external-repos-audit.md`](./advisor-external-repos-audit.md) — §3.A.1
  (OpenBB) and §3.E.1 (Hyperswitch).

This file does NOT replicate the audit. It captures the specific patterns we want to
re-implement under our license, and — equally important — the specific patterns we will
NOT take.

## 1. OpenBB — what we take, what we don't

**Verified facts** (from GitHub API at audit date 2026-05-08): NOASSERTION license per the
GitHub metadata; README states AGPL-3.0 for the core CLI / SDK. Treat as AGPL-equivalent
until counsel verified. ~67k stars. Last push 2026-05-08. Python.

### 1.1 Take (re-implement under our license)

- **Provider/data abstraction model.** OpenBB normalizes hundreds of equity / macro / news
  / on-chain providers behind one Python SDK API. The pattern of "one capability ⇒ many
  provider implementations ⇒ uniform consumer surface" is exactly what `Provider<C>` in the
  ADR §6 captures.
- **Capability-then-provider routing.** OpenBB consumers ask for a capability (e.g.,
  fundamentals); the SDK resolves which configured provider can serve it. Map: this becomes
  `ProviderRegistry.resolve<C>(capability)` in ADR §6.4.
- **Provider self-description.** OpenBB providers declare which symbols / regions /
  data-classes they support. Map: this becomes the `ProviderCapability[]` array on each
  adapter's `meta`.
- **Caveat-bearing outputs.** OpenBB output frames carry a notes / source field. Map: this
  is our `output.source` provenance object in ADR §6.3, mandatory on every output.

### 1.2 Don't take

- **Heavy plugin / extension model.** OpenBB ships providers as separately installable
  Python packages. Operationally too heavy for our scope; we keep adapters in the
  monorepo.
- **Pandas-first SDK shape.** Our consumers are TypeScript / Elysia routes, not Python
  notebooks. The DTOs are plain JSON-serializable objects.
- **CLI / Terminal surface.** Out of scope.
- **AGPL-equivalent licensing posture.** We re-implement under our license; we do not
  vendor or link OpenBB code.

## 2. Hyperswitch — what we take, what we don't

**Verified facts**: Apache-2.0 license. ~42k stars. Last push 2026-05-08. Rust + Postgres + Redis.

### 2.1 Take (re-implement under our license)

- **Connector framework shape.** Hyperswitch normalizes ~50 PSP integrations behind a
  single request/response shape, with each connector implementing a typed trait. Map:
  one-to-one to `Provider<C>` in the ADR.
- **Capability discovery.** Hyperswitch exposes which connectors support which payment
  methods, currencies, regions. Consumers can ask "which connectors can do USD card 3DS
  in EU?". Map: capability registry per ADR §6.1 + 6.4.
- **Connector errors as a typed taxonomy.** Hyperswitch maps every PSP-specific error code
  to a closed-set internal enum. Map: `ProviderError` + `ProviderErrorCode` per ADR §7.
- **Routing / fallback chains.** Hyperswitch supports configurable routing strategies
  (priority, volume splits, regional preference). For our scope we only borrow the
  PRIORITY mode (configurable order with skip-on-error), per ADR §6.4. Volume splits and
  load balancing are explicitly out of scope.
- **Connector health surface.** Hyperswitch exposes a per-connector health roll-up. Map:
  `ProviderRegistry.healthAll()` + the planned `GET /dashboard/providers/diagnostics` in
  ADR §11.3 / PR17C.
- **Idempotency keys.** Hyperswitch consumers attach idempotency keys to writes. We don't
  do writes against third parties — see §2.2. We DO borrow the IDEA for idempotent sync
  jobs against our own DB, mirroring PR7's compare-and-delete Redis lock.

### 2.2 Don't take (and why this matters)

- **Payment-execution layer.** Hyperswitch's core value is moving money. Finance-OS is
  advisory-only. We take the connector-architecture shape and explicitly REJECT the
  payment-action capabilities. ADR §6.1's "NOT IN UNION" comment is the type-level guard;
  PR17A's runtime registry check is the runtime guard; PR17E's CI grep is the third
  guard.
- **Live retry-with-mutation semantics.** Hyperswitch retries can change state at the PSP
  (e.g., re-issuing a refund). For Finance-OS, retries are read-only against third parties;
  state changes are confined to our own DB.
- **Hosted UI / consumer-facing surfaces.** Out of scope.
- **Multi-tenant isolation.** Finance-OS is single-tenant for now. The connector model
  works without it.

## 3. What Finance-OS already does well (for context)

This is the prior art the v2 architecture extends rather than replaces:

- **News providers** ([`apps/api/src/routes/dashboard/services/news-provider-types.ts`](../../apps/api/src/routes/dashboard/services/news-provider-types.ts))
  already use a uniform `NewsProviderAdapter` with `provider`, `enabled`, `cooldownMs`,
  `fetchItems`. This is the closest existing thing to `Provider<C>` and is the implicit
  prior art the ADR formalizes.
- **Knowledge service client**
  ([`apps/api/src/routes/dashboard/services/knowledge-service-client.ts`](../../apps/api/src/routes/dashboard/services/knowledge-service-client.ts))
  is a structured client with retry policy, request-id propagation, and a typed
  `KnowledgeServiceUnavailableError`. The retry policy doc-string ("only retry idempotent
  reads") is exactly what `ProviderError.retryable` formalizes.
- **PR7 worker scheduler** uses compare-and-delete Redis locks (Lua release with owner
  token). This is the canonical pattern for idempotent sync jobs and informs PR17D directly.
- **PR8 redaction** in
  [`apps/knowledge-service/src/finance_os_knowledge/redaction.py`](../../apps/knowledge-service/src/finance_os_knowledge/redaction.py)
  defines `SENSITIVE_KEY_PARTS`. PR16 uses the same allowlist as the basis for the
  provider-side redaction harness.
- **PR12 / PR14 honesty rule**: null over fake zero. Adopted as the universal rule for
  provider DTOs in ADR §6.3.

## 4. What this notes file deliberately does NOT contain

- Code diff comparisons or line-by-line code copies from OpenBB or Hyperswitch.
- Specific OpenBB or Hyperswitch source-file URLs. The README and project pages are
  sufficient as references; copying file paths from external repos creates drift.
- Performance benchmarks. The ADR does not propose performance changes.
- A "case for migrating now". The migration plan is in the ADR; this file is reference
  material only.

## 5. Open questions (deferred to PR17A discussion)

These are intentionally not decided in the ADR — they are the smallest set of decisions
that should be debated when PR17A is opened, with the ADR as input.

1. **Workspace layout** — `packages/provider-contract/` vs colocating types inside
   `apps/api/src/`. Trade-off: workspace gives clean import boundaries; colocation avoids
   another pnpm workspace. Recommendation in ADR §11.1: a package, but the call is
   PR17A's.
2. **News-provider migration depth** — do we keep `NewsProviderAdapter` as-is and just
   declare it implements `Provider<'news_feed'>`, or do we refactor the existing 10 news
   providers to the v2 shape? Recommendation: keep as-is + thin wrapper (avoids churn).
3. **`callWithFallback` vs explicit "primary or skip"** — when EODHD is rate-limited, do we
   want the registry to silently fall back to Twelve Data, or do we want the consumer to
   see "EODHD failed, falling back" as structured signal? Recommendation: structured
   signal in the response provenance — never silent.
4. **Should the registry be a singleton or constructed per-request?** — Powens has
   per-request credential scoping (one user, one session). Most providers don't. The
   registry needs to support both modes.

---

**No runtime code is changed by this file. No dependency is added.** This is a
companion-notes document to support the ADR; it does not introduce binding decisions of its
own.
