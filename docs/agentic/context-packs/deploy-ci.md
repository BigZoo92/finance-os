# Deploy & CI Context Pack — Finance-OS

> Auto-generated. Sources: infra/docker/AGENTS.md, docs/deployment.md
> Do not edit directly — regenerate with `pnpm agent:context:pack`

## Infrastructure Rules

# AGENTS.md - infra/docker

Scope: `infra/docker/**`

## Local Rules

- Treat this tree as the production runtime topology contract. Public browser traffic must continue to terminate on `web`; `api` stays internal-only and `/api/*` continues to flow through the web proxy.
- Keep healthcheck and observability wiring aligned across runtime and deploy files:
  - `web` health probes use `/healthz`
  - `api` health probes use `/health`
  - `worker` heartbeat file paths stay consistent with the worker runtime and the `ops-alerts` sidecar
- The `ops-alerts` sidecar is the minimum production observability layer. When changing it, preserve all four alert families unless the task explicitly scopes a contract change:
  - 5xx burst probes
  - healthcheck failures
  - worker heartbeat freshness
  - disk free percent
- Keep `ops-alerts` secret-safe: webhook URLs and headers must stay in runtime env only, never in `VITE_*`, docs examples, client code, or logs.
- Keep shared deploy assumptions intact when editing Compose or container entrypoints:
  - readonly mounts for heartbeat and disk probes stay aligned
  - `no-new-privileges` and current read-only/tmpfs hardening stay intact unless the task explicitly changes the security posture
  - the sidecar continues to reuse the existing API image instead of introducing a separate build surface

## Verify

- `node --test infra/docker/ops-alerts/monitor.test.mjs` for alerting or health-monitor changes
- `pnpm smoke:api` when routing, proxy, or healthcheck URLs change
- `pnpm check:ci` when the environment can install and run the full repo suite

## Pitfalls

- Do not expose `apps/api` directly on a new public route in deploy config unless the task explicitly changes the external topology.
- Do not change worker heartbeat paths in only one place; update the worker runtime, healthchecks, and `ops-alerts` sidecar together.
- Do not weaken the observability signal by removing `x-request-id` propagation expectations, safe structured logging, 

## Deployment

# Deployment

## Objectif

Ce repo est deploye en production avec:

- GitHub Actions pour la CI et la publication des images
- GHCR pour les images Docker immuables
- Dokploy pour l'orchestration Docker Compose

Le flux cible est:

1. coder
2. `git push`
3. `git tag vX.Y.Z`
4. `git push origin vX.Y.Z`
5. GitHub Actions build et push:
   - `ghcr.io/.../finance-os-web:vX.Y.Z`
   - `ghcr.io/.../finance-os-api:vX.Y.Z`
   - `ghcr.io/.../finance-os-worker:vX.Y.Z`
   - plus les tags techniques `sha-<commit>`
6. GitHub Actions met a jour Dokploy:
   - `docker-compose.prod.yml`
   - `APP_IMAGE_TAG=vX.Y.Z`
7. GitHub Actions declenche le deploy Dokploy

Chaque release correspond donc a un tag immuable precis.

## Strategie recommandee

Cette configuration suit un principe simple:

- Dokploy ne build pas le code applicatif
- Dokploy ne depend pas d'un tag mutable comme `latest`
- la production execute uniquement des images GHCR deja publiees
- le tag deploye est stocke explicitement dans `APP_IMAGE_TAG`

Pour ce repo, la meilleure option est un service **Docker Compose** Dokploy avec images GHCR, pas un build Git provider cote serveur.

Pourquoi:

- l'application a plusieurs services couples (`web`, `api`, `worker`, `postgres`, `redis`)
- les releases doivent etre immuables
- le rollback doit etre trivial

References officielles Dokploy utilisees pour cette strategie:

- Docker Compose deployments
- Docker tags / immutable images
- API endpoints `compose.update`, `compose.one`, `compose.deploy`

## Dokploy

### Type de service

Creer un service **Docker Compose**.

Configuration recommandee:

- `Source Type`: `Raw`
- `Auto Deploy`: desactive
- deploy uniquement via l'API Dokploy appelee par GitHub Actions

Pourquoi `Raw`:

- Dokploy n'a pas a relire une branche Git ou a rebuild
- GitHub Actions pousse le `docker-compose.prod.yml` du tag exact via `compose.update`
- GitHub Actions met a jour `APP_IMAGE_TAG`, `APP_VERSION` et `APP_COMMIT_SHA` directement dans l'env du Compose via `compose.update`
- GitHub Actions relit `compose.one` et echoue si `APP_IMAGE_TAG` n'a pas persiste
- le deploy reste aligne sur le commit tague, pas sur l'etat mouvant de `main`

### Registry GHCR

Si les images GHCR sont privees:

1. Creer un token GitHub avec `read:packages`
2. Ajouter GHCR comme registry dans Dokploy
3. Verifier que le serveur Dokploy peut pull:
   - `ghcr.io/<owner>/finance-os-web:<tag>`
   - `ghcr.io/<owner>/finance-os-api:<tag>`
   - `ghcr.io/<owner>/finance-os-worker:<tag>`

Si les packages GHCR sont publics, cette etape peut etre simplifiee.

### Routing Dokploy

Configuration recommandee:

- un seul domaine public:
  - host: `finance-os.enzogivernaud.fr`
  - path: `/`
  - service: `web`
  - port: `3000`
  - HTTPS: active

Ne pas creer une route publique separee vers `api`.

Pourquoi:

- le runtime `web` TanStack Start/Nitro proxyfie deja `/api/*` vers `API_INTERNAL_URL=http://finance-os-api:3001`
- cela conserve le routing externe `/api`
- cela elimine une s

## Key Constraints

- GHCR container registry
- Dokploy deployment
- Multi-stage Docker builds
- CI via GitHub Actions
- Smoke tests for route topology
