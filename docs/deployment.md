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
- API endpoints `compose/update`, `compose/one`, `compose/deploy`

## Dokploy

### Type de service

Creer un service **Docker Compose**.

Configuration recommandee:

- `Source Type`: `Raw`
- `Auto Deploy`: desactive
- deploy uniquement via l'API Dokploy appelee par GitHub Actions

Pourquoi `Raw`:

- Dokploy n'a pas a relire une branche Git ou a rebuild
- GitHub Actions pousse le `docker-compose.prod.yml` du tag exact via `compose/update`
- GitHub Actions met a jour `APP_IMAGE_TAG`, `APP_VERSION` et `APP_COMMIT_SHA` directement dans l'env du Compose via `compose/update`
- GitHub Actions relit `compose/one` et echoue si `APP_IMAGE_TAG` n'a pas persiste
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
- cela elimine une source frequente de `404`/`500` liee a un mauvais strip-path ou a un mauvais backend cible

Resultat:

- `https://finance-os.enzogivernaud.fr/` -> `web:3000`
- `https://finance-os.enzogivernaud.fr/api/*` -> `web`, puis proxy interne vers `finance-os-api:3001`

## Variables Dokploy

Coller ces variables dans l'environnement Dokploy du service Compose.

### Variables obligatoires

```env
GHCR_IMAGE_NAME=ghcr.io/bigzoo92/finance-os
APP_IMAGE_TAG=v1.0.0

NODE_ENV=production
TZ=Europe/Paris
WEB_PORT=3000

APP_URL=https://finance-os.enzogivernaud.fr
WEB_URL=https://finance-os.enzogivernaud.fr
API_URL=https://finance-os.enzogivernaud.fr/api

RUN_DB_MIGRATIONS=true
API_INTERNAL_URL=http://finance-os-api:3001
VITE_API_BASE_URL=/api
VITE_APP_ORIGIN=https://finance-os.enzogivernaud.fr
VITE_APP_TITLE=finance-os

DATABASE_URL=postgresql://finance_os:<PASSWORD>@postgres:5432/finance_os
REDIS_URL=redis://redis:6379
POSTGRES_DB=finance_os
POSTGRES_USER=finance_os
POSTGRES_PASSWORD=<PASSWORD>

PRIVATE_ACCESS_TOKEN=<long-random-token>
DEBUG_METRICS_TOKEN=<long-random-token>
POWENS_MANUAL_SYNC_COOLDOWN_SECONDS=300

AUTH_ADMIN_EMAIL=<admin@email>
AUTH_ADMIN_PASSWORD_HASH_B64=<base64-hash>
AUTH_SESSION_SECRET=<32+-bytes>
AUTH_SESSION_TTL_DAYS=30
AUTH_LOGIN_RATE_LIMIT_PER_MIN=5
AUTH_ALLOW_INSECURE_COOKIE_IN_PROD=false

WORKER_HEARTBEAT_MS=30000
WORKER_HEALTHCHECK_MAX_AGE_MS=120000
WORKER_AUTO_SYNC_ENABLED=false
POWENS_SYNC_INTERVAL_MS=43200000
POWENS_SYNC_MIN_INTERVAL_PROD_MS=43200000

POWENS_CLIENT_ID=<powens-client-id>
POWENS_CLIENT_SECRET=<powens-client-secret>
POWENS_BASE_URL=https://<tenant>.biapi.pro
POWENS_DOMAIN=<powens-domain>
POWENS_REDIRECT_URI_DEV=http://localhost:3000/powens/callback
POWENS_REDIRECT_URI_PROD=https://finance-os.enzogivernaud.fr/powens/callback
POWENS_WEBVIEW_BASE_URL=https://webview.powens.com/connect
POWENS_WEBVIEW_URL=

APP_ENCRYPTION_KEY=<32-byte-key>
```

### Variables a ne pas definir

Ne pas mettre dans Dokploy:

- `VITE_PRIVATE_ACCESS_TOKEN`
- `AUTH_PASSWORD_HASH_B64` si `AUTH_ADMIN_PASSWORD_HASH_B64` est deja renseigne
- `latest` comme valeur de `APP_IMAGE_TAG`

### Notes

- `APP_IMAGE_TAG` est la cle du systeme: chaque deploy doit pointer vers un tag immuable, par exemple `v1.2.3`
- `AUTH_ADMIN_PASSWORD_HASH_B64` est la variable canonique
- `APP_VERSION` et `APP_COMMIT_SHA` sont mis a jour automatiquement par GitHub Actions

## GitHub

### Repository variables

Configurer dans GitHub Actions Variables:

```text
GHCR_IMAGE_NAME=ghcr.io/bigzoo92/finance-os
NODE_VERSION=22.15.0
BUN_VERSION=1.2.22
PNPM_VERSION=10.15.0
API_INTERNAL_URL=http://finance-os-api:3001
VITE_API_BASE_URL=/api
VITE_APP_TITLE=finance-os
```

`GHCR_IMAGE_NAME` est obligatoire.

Les autres ont des valeurs par defaut raisonnables dans le workflow.

### Repository secrets

Configurer dans GitHub Actions Secrets:

```text
DOKPLOY_URL
DOKPLOY_API_KEY
DOKPLOY_COMPOSE_ID
SMOKE_ADMIN_EMAIL      # optionnel, pour un smoke cible admin
SMOKE_ADMIN_PASSWORD   # optionnel, pour un smoke cible admin
```

Variables GitHub optionnelles pour le smoke post-deploy:

```text
SMOKE_AUTH_MODE=demo|admin|auto
SMOKE_SUMMARY_RANGE=7d|30d|90d
```

Utilisation:

- `DOKPLOY_URL`: URL base Dokploy, par exemple `https://dokploy.example.com`
- `DOKPLOY_API_KEY`: cle API Dokploy
- `DOKPLOY_COMPOSE_ID`: identifiant du service Compose Dokploy

Secrets GitHub a supprimer si encore presents mais inutiles pour ce flux:

- `DOKPLOY_WEBHOOK_URL`
- `DOKPLOY_WEBHOOK_TOKEN`
- `VITE_PRIVATE_ACCESS_TOKEN`
- `VITE_APP_ORIGIN` en secret GitHub
- `VITE_API_BASE_URL` en secret GitHub
- `API_INTERNAL_URL` en secret GitHub

Ces valeurs doivent vivre soit dans les repo variables GitHub non sensibles, soit dans l'env Dokploy runtime.

## Workflow GitHub Actions

Le workflow release fait maintenant trois choses:

1. build + push des images GHCR sur tag `v*`
2. mise a jour du `docker-compose.prod.yml` et de l'env du Compose dans Dokploy via `compose/update`
3. verification via `compose/one` que `APP_IMAGE_TAG` correspond bien au tag release
4. deploy Dokploy via `compose/deploy`
5. attendre `GET /health` puis lancer le smoke post-deploy sur `/health`, `/auth/me`, `/dashboard/summary`, `/integrations/powens/status` (racine et compat `/api`)

Tags pushes:

- release fonctionnelle: `v1.2.3`
- tag technique toujours publie aussi: `sha-<commit>`

Rollback:

- relancer `Release` en `workflow_dispatch` avec `release_tag=v1.2.2`
- ou changer manuellement `APP_IMAGE_TAG=v1.2.2` dans Dokploy puis redeployer

## Fichiers du repo

### Production Dokploy

- [docker-compose.prod.yml](/c:/Users/giver/dev/finance-os/docker-compose.prod.yml)
  - images GHCR seulement
  - aucun `build:`
  - `pull_policy: always`

### Local prod-like

- [docker-compose.prod.build.yml](/c:/Users/giver/dev/finance-os/docker-compose.prod.build.yml)
  - reintroduit `build:` pour `web`, `api`, `worker`
  - reserve au debug local

Exemple local:

```bash
docker compose --env-file .env.prod.local -f docker-compose.prod.yml -f docker-compose.prod.build.yml up -d --build
```

HTTPS local:

```bash
docker compose --env-file .env.prod.local -f docker-compose.prod.yml -f docker-compose.prod.build.yml -f docker-compose.prod.https.yml up -d --build
```

## Comment deployer

### Release normale

```bash
git checkout main
git pull
git tag v1.0.0
git push origin v1.0.0
```

Puis:

1. attendre la fin du workflow `Release`
2. verifier que les images GHCR `v1.0.0` existent
3. verifier que Dokploy a redeploye

### Rollback

Option recommandee:

1. lancer `Release` manuellement
2. saisir `release_tag=v0.9.3`
3. le workflow remet `APP_IMAGE_TAG=v0.9.3` puis redeploie

Option manuelle:

1. changer `APP_IMAGE_TAG` dans Dokploy
2. relancer le deploy Compose

## Verifications post-deploy

Checks minimum:

```bash
curl -i https://finance-os.enzogivernaud.fr/health
curl -i https://finance-os.enzogivernaud.fr/api/health
curl -i https://finance-os.enzogivernaud.fr/api/version
curl -i https://finance-os.enzogivernaud.fr/api/auth/me
```

Attendu:

- `/health` repond depuis `web` (`/healthz` reste un alias de compatibilite)
- `/api/health` repond depuis `api`
- `/api/version` existe
- `/api/auth/me` existe et ne doit jamais renvoyer `404`

## Debug

### Symptomes typiques

Si tu vois:

- `GET /api/health` -> `{"ok":true}`
- `GET /api/auth/me` -> `{"message":"Route GET:/auth/me not found",...}`

alors le domaine ne sert pas le bon runtime. Ce n'est pas un simple cache navigateur.

### Depuis le conteneur web

```bash
wget -qSO- http://127.0.0.1:3000/health
wget -qSO- http://finance-os-api:3001/health
wget -qSO- http://finance-os-api:3001/version
wget -qSO- http://127.0.0.1:3002/health
wget -qSO- http://127.0.0.1:3002/version
wget -qSO- http://finance-os-api:3001/auth/me
wget -qSO- http://finance-os-api:3001/debug/config --header='x-internal-token: <PRIVATE_ACCESS_TOKEN>'
```

### Logs utiles

Mettre temporairement:

```env
LOG_LEVEL=debug
APP_DEBUG=1
```

Puis regarder:

- logs `web` pour les erreurs SSR
- logs `api` pour les erreurs de routes ou d'env

### Cloudflare / proxy

Si Cloudflare est devant Dokploy, bypass cache pour:

- `/`
- `/login*`
- `/api/*`
- `/powens/*`

## Decision technique finale

La complexite venait du melange de trois modes incompatibles:

- build serveur Dokploy
- tags mutables comme `latest`
- routage public `web` + `api` en meme temps

La base propre pour ce repo est:

- un seul compose Dokploy
- images GHCR immuables
- un seul domaine public vers `web`
- `/api` gere par le proxy interne du runtime `web`
- deploy pilote uniquement par GitHub Actions sur tag
