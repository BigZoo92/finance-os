# CI/CD GitHub Actions (finance-os)

## 1) Objectif

Le pipeline est separe en 2 workflows:

- `CI` (`.github/workflows/ci.yml`): validation code uniquement.
- `Release` (`.github/workflows/release.yml`): CI + build/push GHCR + deploy Dokploy.

Regle cle:

- Aucun deploy sans tag Git `v*`.
- Aucun build Docker sur le serveur Dokploy.

## 2) Triggers

### CI (sans deploy)

- `push` sur `main`
- `pull_request` vers `main`

Etapes:

1. `pnpm install --frozen-lockfile`
2. `pnpm lint`
3. `pnpm typecheck`
4. `pnpm -r --if-present test`
5. `pnpm build`

Optimisations:

- Cache pnpm via `actions/setup-node` (`cache: pnpm`).
- `concurrency` active pour annuler les runs obsoletes sur `push`/`PR`.

### Release (tag-only + deploy)

- `push` tag `v*` (ex: `v1.2.3`)
- `workflow_dispatch` disponible en dry-run (build sans push/deploy)

Etapes sur tag:

1. Reutilise la CI (`workflow_call` de `ci.yml`).
2. Build images Docker `web/api/worker` (buildx + cache GHA).
3. Push GHCR:
   - `${tag}` (ex: `v1.2.3`)
   - `sha-${commit}`
   - `latest`
4. Appel webhook Dokploy (retry x3 + backoff).

Pourquoi `latest`:

- Permet un deploy Dokploy simple avec `APP_IMAGE_TAG=latest`.
- Les tags versionnes `vX.Y.Z` + `sha-*` restent disponibles pour rollback/pin.

## 3) Nommage des images GHCR

Avec `GHCR_IMAGE_NAME=ghcr.io/<owner>/finance-os`:

- `ghcr.io/<owner>/finance-os-web:<tag>`
- `ghcr.io/<owner>/finance-os-api:<tag>`
- `ghcr.io/<owner>/finance-os-worker:<tag>`

## 4) Comment faire une release

1. Verifier que `main` est vert (CI OK).
2. Creer un tag semver:

```bash
git checkout main
git pull
git tag v1.2.3
git push origin v1.2.3
```

3. Suivre le workflow `Release` dans GitHub Actions.
4. Verifier que le job webhook Dokploy est `success`.

## 5) Verification post-release

1. Dokploy montre un redeploy recent.
2. Conteneurs `web/api/worker` sont `healthy`.
3. Checks fonctionnels:
   - home page
   - `/api/health`
   - login/logout
4. (Optionnel) verifier les tags GHCR publies (`vX.Y.Z`, `sha-*`, `latest`).

## 6) Rollback

Option 1 (recommandee):

1. Dans Dokploy, definir `APP_IMAGE_TAG=v1.2.2`.
2. Redeployer.

Option 2:

1. Re-taguer une ancienne revision et re-lancer une release.
2. `latest` pointera alors vers cette release.

## 7) Diagnostic des echecs

- Echec CI: lint/typecheck/tests/build en erreur.
- Echec build image: verifier `infra/docker/Dockerfile`, cache buildx, args.
- Echec push GHCR: verifier permissions workflow (`packages: write`) et visibilite package GHCR.
- Echec webhook: verifier `DOKPLOY_WEBHOOK_URL`/`DOKPLOY_WEBHOOK_TOKEN`.
- Echec deploy runtime: verifier `docker-compose.prod.yml`, `GHCR_IMAGE_NAME`, `APP_IMAGE_TAG`, env runtime.
