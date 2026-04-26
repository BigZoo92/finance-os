<!-- GENERATED — DO NOT EDIT
     Source: .agentic/source/skills/finance-os/deploy-ghcr-dokploy/SKILL.md
     Hash:   sha256:f58b6f6e72989e31
     Sync:   pnpm agent:skills:sync -->

---
name: finance-os-deploy-ghcr-dokploy
description: "Deployment pipeline — Docker multi-stage build, GHCR tagging, Dokploy orchestration, smoke tests, rollback. Use when working on CI/CD, Docker, release process, or infrastructure."
---

# Finance-OS Deploy: GHCR + Dokploy

## When to use
- Modifying Dockerfiles or docker-compose configuration
- Changing CI/CD pipelines (`.github/workflows/`)
- Working on release tagging or image management
- Debugging deployment failures
- Adding smoke tests or health checks

## When NOT to use
- Application code changes with no infra impact
- Local development environment setup

---

## 1. Pipeline Overview

```
push to main
  → CI: pnpm check:ci (lint + typecheck + test + build)
  → Release: Docker multi-stage build
  → Tag: vX.Y.Z + sha-<commit>
  → Push: 3 images to GHCR (web, api, worker)
  → Deploy: Dokploy API compose sync
  → Smoke: scripts/smoke-prod.mjs
```

---

## 2. Docker Multi-Stage Build

4 targets, single Dockerfile:

| Target | Base | Output |
|---|---|---|
| `build-web` | Node + pnpm | SSR bundle (Nitro) |
| `web` | Node slim | SSR server |
| `api` | Bun | Elysia API server |
| `worker` | Bun | Background job consumer |

**Build args**: `NODE_VERSION`, `BUN_VERSION`, `PNPM_VERSION`, `GIT_SHA`, `GIT_TAG`

**Rules**:
- Each image is self-contained (no shared volumes for code)
- No `latest` tag — always `vX.Y.Z` or `sha-<commit>`
- Images are immutable after push (never overwrite a tag)
- Build uses `--mount=type=cache` for pnpm store

---

## 3. Image Tagging

```
ghcr.io/{owner}/finance-os-web:v1.2.3
ghcr.io/{owner}/finance-os-web:sha-abc1234
ghcr.io/{owner}/finance-os-api:v1.2.3
ghcr.io/{owner}/finance-os-worker:v1.2.3
```

**Rules**:
- Semantic version tags (`vX.Y.Z`) for releases
- SHA tags for every build (traceability)
- NEVER use `latest` — breaks immutability and rollback
- `GHCR_IMAGE_NAME` and `APP_IMAGE_TAG` in compose reference these

---

## 4. Dokploy Orchestration

Dokploy uses "Raw" source type — it deploys from docker-compose directly, no rebuild.

```yaml
# compose references GHCR images
services:
  web:
    image: ${GHCR_IMAGE_NAME}-web:${APP_IMAGE_TAG}
  api:
    image: ${GHCR_IMAGE_NAME}-api:${APP_IMAGE_TAG}
  worker:
    image: ${GHCR_IMAGE_NAME}-worker:${APP_IMAGE_TAG}
```

**Deployment flow**:
1. CI pushes new images to GHCR
2. CI calls Dokploy API to sync compose
3. Dokploy pulls new images and restarts services
4. Health checks verify services are up

**Rules**:
- Env vars are set in Dokploy, not baked into images
- Runtime env injection: `APP_VERSION`, `APP_COMMIT_SHA` set at deploy time
- Database migrations run on API startup (`RUN_DB_MIGRATIONS=true`)

---

## 5. Smoke Tests

Two smoke test scripts:

| Script | What it checks |
|---|---|
| `scripts/smoke-api.mjs` | API routes respond, auth endpoints work, health check passes |
| `scripts/smoke-prod.mjs` | Full prod deployment — web serves HTML, API proxy works, worker heartbeat exists |

**Rules**:
- Smoke tests run after every deployment
- Failure triggers rollback alert (not automatic rollback yet)
- Tests check HTTP status codes and response shapes, not business logic

---

## 6. Rollback

Manual rollback process:
1. Identify last known good tag: `ghcr.io/.../finance-os-web:v1.1.0`
2. Update `APP_IMAGE_TAG` in Dokploy to previous version
3. Trigger compose sync via Dokploy API
4. Verify with smoke tests

**Rules**:
- Immutable tags make rollback reliable — old image is still in GHCR
- Database migrations must be backward-compatible (no breaking schema changes)
- If migration is breaking: deploy migration separately first, verify, then deploy code

---

## 7. Environment Variables in Deploy

- **Build-time**: `NODE_VERSION`, `BUN_VERSION`, `PNPM_VERSION`, `GIT_SHA`, `GIT_TAG`
- **Runtime**: All others — set in Dokploy compose environment
- **Secrets**: `DATABASE_URL`, `AUTH_SESSION_SECRET`, `APP_ENCRYPTION_KEY`, `POWENS_CLIENT_SECRET` — set in Dokploy, never in repo

**Rule**: No secrets in Docker images or GitHub Actions logs.

## Common Mistakes

1. **Using `latest` tag** — breaks rollback, unclear what's deployed
2. **Baking secrets into images** — secrets visible in image layers
3. **Breaking database migrations** — can't rollback if schema changed destructively
4. **Skipping smoke tests** — deploy looks successful but is actually broken
5. **Overwriting existing tags** — breaks immutability guarantee

## References
- [STACK.md](docs/context/STACK.md) — CI/CD pipeline section
- [EXTERNAL-SERVICES.md](docs/context/EXTERNAL-SERVICES.md) — GHCR, Dokploy sections
- [ENV-REFERENCE.md](docs/context/ENV-REFERENCE.md) — Docker build args, compose vars
