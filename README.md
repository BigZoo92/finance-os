# Finance-OS

Finance-OS is a strictly personal, single-user finance cockpit. It combines deterministic financial calculations, read-only provider ingestion, operational diagnostics, and an advisory AI layer. It never executes trades, transfers, withdrawals, or automatic rebalancing.

## Runtime modes

- `demo` is the default. It uses deterministic fixtures only and must not read or write the database, Redis, providers, or model services.
- `admin` is unlocked by the admin session and may use the database and configured providers. Explicit server-to-server API routes may instead accept the static server-only `PRIVATE_ACCESS_TOKEN`; the Powens callback uses a separate HMAC-signed state.

Dependency failures degrade individual surfaces; they do not make the cockpit unusable.

## Repository map

| Path | Role |
|---|---|
| `apps/web` | TanStack Start SSR application and the only public entry point |
| `apps/api` | Internal Elysia API, auth, repositories, and domain orchestration |
| `apps/worker` | Redis job consumer and scheduled ingestion |
| `apps/knowledge-service` | Internal temporal knowledge/GraphRAG service |
| `apps/quant-service` | Isolated research and backtest service |
| `apps/desktop` | Tauri shell around the web product |
| `packages/*` | Shared finance, provider, data, env, Redis, and UI contracts |
| `infra/docker` | Containers, health checks, and production alerting |

## Local setup

Runtimes are pinned in one place each: Node.js in `.node-version` (24 LTS, also `.nvmrc`), pnpm in the `packageManager` field of `package.json` (pnpm 11 manages its own version from that field), Bun in `.bun-version` (1.4, runs the API, worker, and Bun-native tests), Python in `.python-version` (3.12, frozen with `uv`), and Rust through the Tauri toolchain. CI and the Docker images read the same files and arguments. Docker Compose is required for local infrastructure.

```powershell
pnpm install --frozen-lockfile
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
pnpm env:check
pnpm infra:up
pnpm db:migrate
pnpm dev:apps
```

Do not overwrite an existing `.env`; it is local and may contain secrets. Provider credentials are optional for deterministic demo work.

Useful commands:

```text
pnpm dev:all                start infrastructure and app runtimes
pnpm check:ci               canonical repository verification
pnpm test:e2e               deterministic browser smoke suite
pnpm env:check:parity       compare runtime and Compose environment contracts
pnpm agent:skills:check     detect missing, drifted, or extra skill files
pnpm docs:check             validate local Markdown links
```

## Documentation

- [Architecture](docs/architecture.md)
- [Product and safety boundaries](docs/product.md)
- [Configuration](docs/configuration.md)
- [Deployment](docs/deployment.md)
- [Provider integrations](docs/integrations.md)
- [AI Advisor and knowledge](docs/advisor.md)
- [Operations](docs/operations.md)
- [Claude/Codex system](docs/agentic.md)
- [Command Pixel design system](DESIGN.md)

Repository instructions live in the nearest `AGENTS.md`; Claude-specific bootstrap guidance lives in `CLAUDE.md`.
