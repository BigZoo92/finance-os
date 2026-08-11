# Redis instructions

Scope: `packages/redis/**`.

- Keep a thin explicit client lifecycle with matching real and deterministic in-memory behavior.
- Avoid hidden globals/background retries that change API or worker semantics.
- Preserve queue ordering, locks, rate limits, and graceful close behavior expected by API/worker callers.
- Redis/metrics failure must not become a core product execution dependency.

Verify package typecheck and real/in-memory contract tests for changed commands.
