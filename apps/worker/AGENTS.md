# Worker instructions

Scope: `apps/worker/**`.

- `src/index.ts` is the entry point. Preserve typed queue dispatch, per-job isolation, idempotent writes, locks, request IDs, heartbeat, graceful shutdown, and scheduler boundaries.
- Never log provider credentials/codes/tokens/raw payloads. Resolve IBKR/Binance credentials only from validated server env and skip an unconfigured provider without blocking others.
- Preserve raw -> normalized -> derived boundaries; manual/user-authored data is authoritative and is not overwritten by ingestion.
- Use queue keys and serializers exported by provider packages; do not duplicate Redis key strings.
- Schedulers call guarded API orchestration over `API_INTERNAL_URL` or enqueue typed provider jobs; they do not move provider/DB logic into timers.
- Demo behavior is never a worker dependency. Provider failure remains isolated and fail-soft for API/web consumers.
- Keep heartbeat paths aligned with Compose healthcheck and ops-alerts.

Verify with `pnpm worker:typecheck` and the focused scheduler/ingestion tests for changed behavior.
