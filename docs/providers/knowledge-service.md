# Provider: `knowledge-service`

> Macro Prompt 2 — first internal provider migration. The wrapper exists at
> [`apps/api/src/routes/dashboard/services/providers/knowledge-context-bundle-provider.ts`](../../apps/api/src/routes/dashboard/services/providers/knowledge-context-bundle-provider.ts)
> and is exercised by unit tests. **Routes still consume `KnowledgeServiceClient` directly**;
> rewiring routes to call the provider is deferred to a follow-up macro prompt.

## Provider id

`knowledge-service`

## Capabilities

| Capability | Status |
|---|---|
| `knowledge.context_bundle.read` | Implemented as `Provider<C>` wrapper. |
| `knowledge.query.read` | **Deferred.** Allowed by the contract but not yet wrapped — the `query` path is reachable via the existing client. |
| graph ingest / write | **Out of scope.** Not present in `ALLOWED_PROVIDER_CAPABILITIES`. Adding any ingest/write capability would require an ADR amendment first. The existing `advisor-graph-ingest.ts` continues to operate fail-soft, gated by `KNOWLEDGE_SERVICE_ENABLED` and `ADVISOR_GRAPH_INGEST_ENABLED`. The wrapper does not change either flag's default. |

## Mode behavior

| Mode | Behavior |
|---|---|
| `demo` | Refuses with `demo_mode_forbidden`. The knowledge-service is admin-side only; no synthetic context bundle is fabricated. The route layer keeps its existing demo branch shape. |
| `admin` | If `config.enabled === false`, refuses with `disabled_by_flag`. Otherwise issues a single `POST /knowledge/context-bundle` honoring the configured `maxContextTokens`, `maxPathDepth`, `retrievalMode`, and `minConfidence`. |

## Credentials

- No external credentials. The knowledge-service is an internal Python service, addressed
  by `KNOWLEDGE_SERVICE_URL`. No `VITE_*` exposure.
- Feature flag: `KNOWLEDGE_SERVICE_ENABLED` (consumed by the existing config layer).
  Default unchanged in this batch.

## Cache / freshness

- No additional cache layer. The provider wrapper reports `freshnessMinutes: 0` and
  `fromCache: false` on every successful admin call.
- Freshness policies in `ProviderCallContext` are accepted but not yet enforced — the
  upstream service has no cache-aware behavior to honor today.

## Error mapping

| Upstream signal | `ProviderErrorCode` | `retryable` |
|---|---|---|
| `mode === 'demo'` | `demo_mode_forbidden` | `false` |
| `config.enabled === false` | `disabled_by_flag` | `false` |
| HTTP 401 / 403 | `auth_failed` | `false` |
| HTTP 404 | `not_found` | `false` |
| HTTP 429 | `rate_limited` | `true` |
| HTTP 5xx | `transient` | `true` |
| Network / abort / timeout | `provider_unavailable` (or `transient` via `KnowledgeServiceUnavailableError` chain) | `true` |
| Anything else | `provider_unavailable` | `true` |

## Redaction notes

- The wrapper never logs the upstream JSON body. `provider.call.*` log lines carry only
  the closed `ProviderLogEventFields` vocabulary (`providerId`, `capability`, `requestId`,
  `mode`, `errorCode`, `durationMs`, `status`, etc.) and run through
  `redactProviderLogFields` before reaching the API logger.
- Tests assert that synthetic upstream payloads carrying `access_token`,
  `Authorization: Bearer …`, and free-form notes never appear in any captured log line.
- The advisor scanner (separate concern) protects LLM output. This wrapper protects
  provider input — the bundle returned by `data.bundle` is application-internal and is
  not re-emitted through any log, prompt, or browser response by this module.

## Health check

`getHealth()` is precomputed and never performs IO:

- `status`: `ok` after a successful call, `degraded` after a 5xx or thrown error,
  `down` after a 4xx (including disabled / auth_failed).
- `lastSuccessAt`: ISO timestamp of the most recent successful call.
- `lastErrorCode`: closed-set `ProviderErrorCode` from the most recent failure.

## Tests

[`knowledge-context-bundle-provider.test.ts`](../../apps/api/src/routes/dashboard/services/providers/knowledge-context-bundle-provider.test.ts)
exercises:

- `assertProviderContract` + `assertProviderDoesNotExposeForbiddenCapabilities`
- `assertProviderResultSafe` on ok, disabled, demo, and HTTP-5xx results
- `assertProviderLogsSafe` over every captured log line
- explicit assertion that synthetic secrets in upstream JSON do not surface in logs
- thrown-error normalization → `provider_unavailable`

## Known limitations

- The wrapper currently surfaces `data.bundle` as `Record<string, unknown>` because the
  knowledge-service response type is not yet shared as a workspace contract. Tightening
  this DTO is left for a follow-up batch.
- Graph ingest is **not** part of this migration. The existing `advisor-graph-ingest.ts`
  continues to be the only caller for `POST /knowledge/ingest/advisor`, with its
  fail-soft semantics intact.

## ToS / legal notes

- Internal service; no third-party ToS applies.
- No user-facing attribution required.

## No execution guarantee

This adapter implements only the read capability `knowledge.context_bundle.read`. No
`trading.*`, `crypto.swap.*`, `crypto.transfer.*`, `payment.*`, or `bank.transfer.*`
capabilities are implemented or planned. Knowledge graph remains best-effort enrichment
only; Postgres remains canonical.
