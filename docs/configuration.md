# Configuration

## Sources of truth

- `packages/env/src/index.ts`: API and worker environment schemas and defaults.
- `packages/env/src/diagnostics.ts`: cross-runtime consistency checks.
- `apps/web/src/env.ts`: web build and server-runtime schema.
- `apps/knowledge-service/src/finance_os_knowledge/config.py` and `apps/quant-service/src/finance_os_quant/config.py`: Python service schemas and defaults.
- `.env.example`: local template without secrets.
- `.env.prod.example`: production template without secrets.
- `docker-compose.prod.yml`: runtime ownership and service wiring.
- `.github/workflows/release.yml`: build-time variables and deployment inputs.

Do not maintain a second exhaustive variable table in Markdown. When an environment contract changes, update the schema, the applicable example, Compose/workflow wiring, diagnostics, tests, and this guide only if operator behavior changes.

## Local setup

Create `.env` from `.env.example` only when it does not already exist. The root `.env` is a local convenience: it never overrides a variable that the process already received from the shell, CI, Compose, or Dokploy. Validate without printing values:

```text
pnpm env:check
pnpm env:check:compose
pnpm env:check:parity
```

Use `.env.production.local` only for local production-like validation; production secrets belong in Dokploy.

## Ownership

| Configuration | Consumers | Notes |
|---|---|---|
| URLs, auth, encryption, database, Redis | API/worker/server-side web | never expose secrets to client code |
| `API_INTERNAL_URL` | web SSR, web `/api` proxy, worker | internal service URL read at request time (never baked into the web build); browser uses `/api` |
| `PRIVATE_ACCESS_TOKEN` | API, server-side web, and worker | static server-only token accepted only by explicitly guarded API routes |
| `AUTH_SESSION_SECRET` | API | HMAC-signs the admin session cookie and the distinct Powens callback state |
| Powens credentials/config | API and worker as declared in schemas | codes/tokens never logged |
| IBKR/Binance credentials | API/worker server runtime only | no database credential store or browser DTO |
| model/provider keys | API/worker only | prompts/logs contain no key or raw sensitive payload |
| knowledge/quant service config and `INTERNAL_SERVICE_TOKEN` | API and Python services | internal network only; the API sends the shared token as `x-internal-service-token`, the Python services require it on every route except `/health` and `/version` once set, and production sets `INTERNAL_SERVICE_AUTH_REQUIRED=true` so they refuse to start without it |
| `ALERTS_*` webhook settings | ops-alerts only | webhook URL/headers remain secret |
| `VITE_*` | browser bundle | public flags and display values only |

The external-investment credential names are `BINANCE_SPOT_API_KEY`, `BINANCE_SPOT_API_SECRET`, `IBKR_FLEX_TOKEN`, and `IBKR_FLEX_QUERY_IDS`.

## Feature flags

Flags may gate an unavailable provider or experimental advisory surface, but they must not weaken authorization or make analytics an execution dependency. Demo behavior remains deterministic with any flag combination. Default-off capabilities need explicit fail-soft copy.

## Secret handling

- Generate high-entropy `AUTH_SESSION_SECRET`, `APP_ENCRYPTION_KEY`, `PRIVATE_ACCESS_TOKEN`, and `INTERNAL_SERVICE_TOKEN` values outside the repo.
- Never put a secret in `VITE_*`, Docker build args, GitHub variables, URLs, fixtures, screenshots, logs, or documentation examples.
- Keep provider tokens encrypted at rest using the existing envelope.
- Rotate by updating runtime secret storage and restarting only the consumers; verify redaction and health afterward.

## Production validation

Before deployment, run `pnpm env:check:prod` with a local non-committed production file or use the equivalent Dokploy values. Render Compose with placeholders and run `pnpm docker:check`. Never paste the resolved secret-bearing Compose output into an issue or agent prompt.
