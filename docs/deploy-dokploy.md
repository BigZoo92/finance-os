# Deployment production avec Dokploy (Git provider, build on server)

## 1) Vue globale

- Le deploy production est declenche par push sur `main` via le provider GitHub Dokploy.
- Dokploy pull le repo puis build `web`, `api`, `worker` depuis `infra/docker/Dockerfile`.
- Le compose prod utilise `build:` (pas de tags GHCR applicatifs).

Flux:

```text
git push origin main
  -> Dokploy webhook/provider GitHub
  -> Dokploy pull le repo
  -> docker compose build + up -d
```

## 2) Fichiers source of truth

- `docker-compose.prod.yml`: build targets (`web`, `api`, `worker`).
- `infra/docker/Dockerfile`: build multi-target utilise par Dokploy.
- `.env.prod.example`: variables runtime requises pour Dokploy.
- `docs/deploy-dokploy-env.md`: checklist exhaustive des variables Dokploy.

## 3) Variables Dokploy requises

Variables compose importantes:

- `NODE_VERSION`, `BUN_VERSION`, `PNPM_VERSION` (build args)
- `APP_URL`, `WEB_URL`, `API_URL`
- `DATABASE_URL`, `POSTGRES_*`, `REDIS_URL`
- `AUTH_*`, `POWENS_*`, `APP_ENCRYPTION_KEY`

Reference complete:

- Voir [docs/deploy-dokploy-env.md](./deploy-dokploy-env.md)

Note:

- `APP_IMAGE_TAG` n'est pas necessaire dans ce mode Git provider.

## 4) Configuration Dokploy

1. Creer le fichier d'env Dokploy a partir de `.env.prod.example`.
2. Verifier que Dokploy utilise bien `docker-compose.prod.yml`.
3. Verifier la branche source `main`.
4. Push sur `main` pour declencher le redeploy.

## 5) Commandes de verification locale (equivalent Dokploy)

Validation compose:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml config
```

Build + update:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml build
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --remove-orphans
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

1. Revenir a un commit `main` stable (git revert ou reset de branche selon ton flow).
2. Push sur `main` pour reconstruire et redeployer.
3. Verifier `ps`, logs et endpoints health.

Option rapide:

- Declencher un redeploy manuel Dokploy sans changer de code (si incident transitoire).

## 7) Debug rapide

- Echec trigger provider: verifier webhook/provider GitHub dans Dokploy.
- Echec build: verifier `docker-compose.prod.yml` + `infra/docker/Dockerfile` + logs build Dokploy.
- Echec runtime: verifier healthchecks `web/api/worker`, puis DB/Redis connectivite.

Voir aussi le runbook runtime detaille: `infra/dokploy/PROD_ENV.md`.
