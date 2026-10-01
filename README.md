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
pnpm db:migrate             # applies the journal with packages/db/src/migrate.ts (the API never migrates at startup)
pnpm db:check               # journal consistency + schema drift, no database needed
pnpm dev:apps
```

Do not overwrite an existing `.env`; it is local and may contain secrets. Provider credentials are optional for deterministic demo work.

Useful commands:

```text
pnpm dev:all                start infrastructure and app runtimes
pnpm check:ci               canonical repository verification
pnpm test:e2e               deterministic browser smoke suite
pnpm test:e2e:visual        local Command Pixel screenshot regression (add --update-snapshots to record)
pnpm panda:codegen          regenerate the Panda CSS runtime after token or config changes
pnpm env:check:parity       compare runtime and Compose environment contracts
pnpm agent:skills:check     detect missing, drifted, or extra skill files
pnpm docs:check             validate local Markdown links
pnpm check:client-bundle    fail if the web client bundle carries server-only code
pnpm moon:projects          print the Moon project graph (JSON)
pnpm moon:validate          load the Moon project graph and enforce layer/tag constraints
pnpm moon:ci                run the affected project tasks through Moon (what CI runs)
pnpm affected:test          run only the tests of projects touched since main
```

## Repository task graph

[Moon](https://moonrepo.dev) (`.moon/`) owns the project graph, task caching and affected selection. Every project declares explicit tasks in its `moon.yml` (`typecheck`, `test`, `build`, `codegen`, the Python services' `uv` tasks) with inputs and outputs; `package.json` scripts stay the single source of the commands (`pnpm run …`). Projects carry a `layer` (application, library, configuration) and a tag (`frontend`, `backend`, `shared`); `.moon/workspace.yml` enforces that applications depend on libraries only and that the browser graph never reaches a backend-only package. Moon runs the installed runtimes and never installs or switches them. `pnpm moon:ci` (what CI runs) executes the affected project tasks with cache replay; `pnpm affected:typecheck|test|build` do the same locally; `pnpm moon:validate` loads the graph and its constraints.

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
- [Modernization V1 notes](docs/modernization-v1.md) (deviations, defects fixed, measurements, validation matrix)

Repository instructions live in the nearest `AGENTS.md`; Claude-specific bootstrap guidance lives in `CLAUDE.md`.
