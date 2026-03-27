# CI/CD

Le workflow de release est tag-only et immuable.

## Principe

- `main` valide le code
- un tag `vX.Y.Z` publie les images GHCR
- Dokploy ne build rien
- GitHub Actions met a jour `APP_IMAGE_TAG` dans l'env du Compose Dokploy via `compose.update`, verifie la persistence du tag, puis declenche `compose.deploy`

## Workflows

### CI

- fichier: `.github/workflows/ci.yml`
- triggers:
  - `push` sur `main`
  - `pull_request` vers `main`

Etapes:

1. `pnpm install --frozen-lockfile`
2. `pnpm -r --if-present lint`
3. `pnpm -r --if-present typecheck`
4. `pnpm -r --if-present test`
5. `pnpm -r --if-present build`

Commande locale equivalente:

- `pnpm check:ci`
- ce script force `CI=true` puis rejoue exactement le meme ordre et les memes commandes que `.github/workflows/ci.yml`

### Codex environment parity

- To keep manual Codex extraction close to CI, use [../scripts/codex-env-setup.sh](/c:/Users/giver/dev/finance-os/scripts/codex-env-setup.sh) as the Codex environment setup script.
- It runs the same frozen-lockfile install as CI and then executes [../scripts/verify-workspace-install.mjs](/c:/Users/giver/dev/finance-os/scripts/verify-workspace-install.mjs) to fail early if declared workspace dependencies are missing from the environment cache.
- Once the environment setup succeeds, manual Codex extraction on an `implement:` PR should run `pnpm check:ci` before claiming the branch is ready.

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
4. pousse `docker-compose.prod.yml` et l'env du Compose vers Dokploy via `compose.update`
5. met a jour l'env Dokploy:
   - `APP_IMAGE_TAG=vX.Y.Z`
   - `APP_VERSION=vX.Y.Z`
   - `APP_COMMIT_SHA=<commit>`
   - `BUILD_TIME=<timestamp>`
6. verifie via `compose.one` que `APP_IMAGE_TAG` a bien ete persiste
7. declenche `compose.deploy`
8. attend que `GET /health` reponde publiquement
9. execute `node scripts/smoke-prod.mjs --base=https://finance-os.enzogivernaud.fr`
   - verifie au minimum `/health`, `/auth/me`, `/dashboard/summary`, `/integrations/powens/status` (racine et compat `/api`)
   - adapte les assertions au contexte `demo` ou `admin` selon `SMOKE_AUTH_MODE`
   - peut ouvrir une session admin via `SMOKE_ADMIN_EMAIL` + `SMOKE_ADMIN_PASSWORD` si necessaire
10. en cas d'echec smoke, le job `Post-deploy smoke` echoue explicitement avec un resume GitHub Actions et des annotations `::error`

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
VITE_DASHBOARD_HEALTH_SIGNALS_ENABLED      # optional master switch for dashboard health signals
VITE_DASHBOARD_HEALTH_GLOBAL_INDICATOR_ENABLED
VITE_DASHBOARD_HEALTH_WIDGET_BADGES_ENABLED
VITE_POWENS_SYNC_COOLDOWN_UI_ENABLED   # optional web UI kill-switch
VITE_POWENS_SYNC_COOLDOWN_UI_SECONDS   # optional web UI countdown duration
```

Runtime flags that affect API/worker writes, such as `SYNC_STATUS_PERSISTENCE_ENABLED`, are not GitHub repo variables here. They live in the Dokploy Compose env so the same value reaches both `api` and `worker` at deploy time.

Repository secrets:

```text
DOKPLOY_URL
DOKPLOY_API_KEY
DOKPLOY_COMPOSE_ID
SMOKE_ADMIN_EMAIL        # optional, only for admin-targeted smoke
SMOKE_ADMIN_PASSWORD     # optional, only for admin-targeted smoke
```

Repository variables (optional smoke tuning):

```text
SMOKE_AUTH_MODE=demo|admin|auto
SMOKE_SUMMARY_RANGE=7d|30d|90d
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
