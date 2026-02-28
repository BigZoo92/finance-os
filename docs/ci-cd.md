# CI/CD

Le workflow de release est tag-only et immuable.

## Principe

- `main` valide le code
- un tag `vX.Y.Z` publie les images GHCR
- Dokploy ne build rien
- GitHub Actions met a jour `APP_IMAGE_TAG` dans Dokploy puis declenche `compose.deploy`

## Workflows

### CI

- fichier: `.github/workflows/ci.yml`
- triggers:
  - `push` sur `main`
  - `pull_request` vers `main`

Etapes:

1. `pnpm install --frozen-lockfile`
2. `pnpm lint`
3. `pnpm typecheck`
4. `pnpm -r --if-present test`
5. `pnpm build`

### Release

- fichier: `.github/workflows/release.yml`
- triggers:
  - `push` tag `v*`
  - `workflow_dispatch` avec `release_tag` pour redeployer une image deja publiee

Etapes sur tag:

1. relance la CI
2. build les images `web`, `api`, `worker`
3. push les tags:
   - `vX.Y.Z`
   - `sha-<commit>`
4. pousse `docker-compose.prod.yml` vers Dokploy via `compose.update`
5. met a jour l'env Dokploy:
   - `APP_IMAGE_TAG=vX.Y.Z`
   - `APP_VERSION=vX.Y.Z`
   - `APP_COMMIT_SHA=<commit>`
   - `BUILD_TIME=<timestamp>`
6. declenche `compose.deploy`

## Variables GitHub

Repository variables:

```text
GHCR_IMAGE_NAME
NODE_VERSION
BUN_VERSION
PNPM_VERSION
API_INTERNAL_URL
VITE_API_BASE_URL
VITE_APP_TITLE
```

Repository secrets:

```text
DOKPLOY_URL
DOKPLOY_API_KEY
DOKPLOY_COMPOSE_ID
```

## Rollback

Deux options:

1. `workflow_dispatch` avec `release_tag=v1.2.2`
2. changer `APP_IMAGE_TAG=v1.2.2` dans Dokploy puis redeployer

## Politique

- ne jamais deployer `latest`
- ne jamais rebuild sur le serveur Dokploy
- ne jamais exposer `VITE_PRIVATE_ACCESS_TOKEN`

Le guide complet est dans [docs/deployment.md](/c:/Users/giver/dev/finance-os/docs/deployment.md).
