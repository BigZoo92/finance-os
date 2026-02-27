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
4. Appel API Dokploy deploy (retry x3 + backoff).

Pourquoi pas le webhook Dokploy classique:

- Le webhook Git provider applique un filtre de branche.
- Un run GitHub Actions declenche sur tag (`refs/tags/v*`) ne matche pas cette contrainte.
- Resultat typique: `{"message":"Branch Not Match"}`.
- En mode images GHCR + Compose, il faut declencher un deploy API (`compose.deploy` ou `application.deploy`), pas un webhook branch-based.

Politique de tag:

- Production utilise un tag immutable `APP_IMAGE_TAG=vX.Y.Z`.
- `sha-*` reste disponible pour verification technique.

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
4. Verifier que le job `Trigger Dokploy deployment API` est `success`.

## 5) Verification post-release

1. Dokploy montre un redeploy recent.
2. Conteneurs `web/api/worker` sont `healthy`.
3. Checks fonctionnels:
   - home page
   - `/api/health`
   - login/logout
4. (Optionnel) verifier les tags GHCR publies (`vX.Y.Z`, `sha-*`).

## 6) Rollback

Option 1 (recommandee):

1. Dans Dokploy, definir `APP_IMAGE_TAG=v1.2.2`.
2. Redeployer.

Option 2:

1. Re-taguer une ancienne revision et re-lancer une release.
2. Reconfigurer explicitement `APP_IMAGE_TAG=vX.Y.Z`.

## 7) Diagnostic des echecs

- Echec CI: lint/typecheck/tests/build en erreur.
- Echec build image: verifier `infra/docker/Dockerfile`, cache buildx, args.
- Echec push GHCR: verifier permissions workflow (`packages: write`) et visibilite package GHCR.
- Echec trigger Dokploy API: verifier `DOKPLOY_URL`, `DOKPLOY_API_KEY`, `DOKPLOY_COMPOSE_ID` (ou `DOKPLOY_APPLICATION_ID`).
- Echec deploy runtime: verifier `docker-compose.prod.yml`, `GHCR_IMAGE_NAME`, `APP_IMAGE_TAG`, env runtime.

## 8) Secrets GitHub pour Dokploy API

- `DOKPLOY_URL` (Secret): URL base Dokploy, ex `https://dokploy.example.com`
- `DOKPLOY_API_KEY` (Secret): API key Dokploy
- `DOKPLOY_COMPOSE_ID` (Secret, recommande): ID du service Compose a deployer
- `DOKPLOY_APPLICATION_ID` (Secret, fallback): ID de l'application si vous utilisez `application.deploy`

Recuperation:

1. API key:
   - Dokploy UI -> profil utilisateur -> API Keys -> creer/copier la cle.
2. IDs:
   - Via API Dokploy `project.all`, puis lire `composeId` ou `applicationId` du service cible.
   - Exemple:

```bash
curl -sS "$DOKPLOY_URL/api/project.all" \
  -H "accept: application/json" \
  -H "x-api-key: $DOKPLOY_API_KEY"
```

## 9) Test manuel d'un deploy API

Compose (recommande pour ce repo):

```bash
curl -sS -X POST "$DOKPLOY_URL/api/compose.deploy" \
  -H "accept: application/json" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $DOKPLOY_API_KEY" \
  --data "{\"composeId\":\"$DOKPLOY_COMPOSE_ID\"}"
```

Application (fallback):

```bash
curl -sS -X POST "$DOKPLOY_URL/api/application.deploy" \
  -H "accept: application/json" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $DOKPLOY_API_KEY" \
  --data "{\"applicationId\":\"$DOKPLOY_APPLICATION_ID\"}"
```
