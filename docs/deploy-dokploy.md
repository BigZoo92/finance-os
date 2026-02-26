# Deployment production avec Dokploy (pull-only GHCR)

## 1) Vue globale

- Le deploy production est declenche uniquement par un tag Git `v*` (ex: `v1.2.3`).
- GitHub Actions build les images Docker (`web`, `api`, `worker`) et les push sur GHCR.
- Dokploy ne build rien: il pull les images GHCR referencees dans `docker-compose.prod.yml`.
- Une fois le push GHCR termine, le workflow release appelle l'API Dokploy de deploiement.

Flux:

```text
git tag v1.2.3 + git push origin v1.2.3
  -> GitHub Actions (CI + build images + push GHCR)
  -> API Dokploy deploy
  -> Dokploy pull images et redeploy
```

## 2) Fichiers source of truth

- `docker-compose.prod.yml`: references d'images GHCR (pas de `build:`).
- `infra/docker/Dockerfile`: build multi-target (`web`, `api`, `worker`) execute en CI.
- `.github/workflows/release.yml`: pipeline release tag-only + appel API Dokploy.
- `.env.prod.example`: variables runtime requises pour Dokploy.
- `docs/deploy-dokploy-env.md`: checklist exhaustive des variables Dokploy.

## 3) Variables Dokploy requises

Variables compose importantes:

- `GHCR_IMAGE_NAME` (optionnel, defaut `ghcr.io/bigzoo92/finance-os`)
- `APP_IMAGE_TAG` (defaut recommande: `latest`)
- `APP_URL`, `WEB_URL`, `API_URL`
- `DATABASE_URL`, `POSTGRES_*`, `REDIS_URL`
- `AUTH_*`, `POWENS_*`, `APP_ENCRYPTION_KEY`

Reference complete:

- Voir [docs/deploy-dokploy-env.md](./deploy-dokploy-env.md)

Note:

- `APP_IMAGE_TAG=latest` est adapte au mode deploy automatique sur tag.
- Pour pin/rollback explicite, definir `APP_IMAGE_TAG=vX.Y.Z` puis redeployer.

## 4) Configuration Dokploy

1. Creer le fichier d'env Dokploy a partir de `.env.prod.example`.
2. Configurer les credentials registry GHCR dans Dokploy (pull prive).
3. Verifier que Dokploy utilise `docker-compose.prod.yml`.
4. Mettre `APP_IMAGE_TAG=latest` pour suivre automatiquement les releases tag.
5. Configurer les secrets GitHub pour l'appel API:
   - `DOKPLOY_URL`
   - `DOKPLOY_API_KEY`
   - `DOKPLOY_COMPOSE_ID` (recommande)
   - `DOKPLOY_APPLICATION_ID` (fallback)

## 5) Commandes de verification locale (equivalent Dokploy)

Validation compose:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml config
```

Pull + update sans build:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml pull
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d
```

Etat + logs:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml ps
docker compose --env-file .env.prod -f docker-compose.prod.yml logs --no-color --tail=200 web api worker
```

Checks HTTP:

- `GET ${APP_URL}/`
- `GET ${APP_URL}/api/health`
- `GET ${APP_URL}/api/db/health`

## 6) Rollback

Option recommandee:

1. Dans Dokploy, changer `APP_IMAGE_TAG` vers un tag precedent (ex: `v1.2.2`).
2. Redeployer (manuel ou API).
3. Verifier `ps`, logs et endpoints health.

Option rapide:

- Si `latest` est conserve, redeployer un ancien tag Git qui repousse `latest`.
- Cette option est moins explicite qu'un pin `APP_IMAGE_TAG=vX.Y.Z`.

## 7) Debug rapide

- Echec CI/release: verifier onglet GitHub Actions (`ci.yml`, `release.yml`).
- Echec trigger API: verifier `DOKPLOY_URL`, `DOKPLOY_API_KEY`, `DOKPLOY_COMPOSE_ID`/`DOKPLOY_APPLICATION_ID`.
- Echec pull image: verifier `GHCR_IMAGE_NAME`, permissions `packages:write` du workflow et credentials registry Dokploy.
- Echec runtime: verifier healthchecks `web/api/worker`, puis DB/Redis connectivite.
