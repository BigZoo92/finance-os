# Deployment production avec Dokploy

## 1) Vue globale

### Explication simple
On publie seulement le service `web`.  
`api`, `worker`, `postgres` et `redis` restent sur le reseau interne Docker.  
Le frontend appelle `/api` sur le meme domaine public, et `web` proxy la requete vers `api` en interne.

### Explication technique
- `web` expose le port `3000` (mappe via `WEB_PORT`), c'est le seul service public.
- `api` n'a pas de `ports`, seulement `expose: 3001`.
- `worker` n'expose aucun port.
- `web` applique une regle Nitro `'/api/**' -> 'http://api:3001/**'`.
- `api` lance les migrations Drizzle au boot (`apps/api/src/bootstrap.ts`) avant d'ouvrir le serveur HTTP.
- `postgres` et `redis` utilisent des volumes persistants.

```text
Internet
   |
   v
[Dokploy Router]
   |
   v
[web:3000]  --(proxy /api/*)--> [api:3001] ---> [postgres:5432]
   |                                  |
   |                                  +--------> [redis:6379]
   |
   +-------------------------------------------> browser assets + SSR

[worker] ---------------------------------------> [api contract / db / redis]
```

## 2) Vue precise par fichier

### Explication simple
Chaque fichier ci-dessous sert a fiabiliser la prod: build propre, env strict, migrations automatiques, healthchecks et documentation de runbook.

### Explication technique

### `docker-compose.prod.yml`
- Pourquoi: definir une stack Dokploy prete a deployer avec separation public/interne.
- Ce que ca change:
- services `web/api/worker/postgres/redis`
- healthchecks partout
- dependances `service_healthy`
- volumes persistants DB/Redis
- API non exposee publiquement
- Extrait cle:

```yaml
web:
  ports:
    - '${WEB_PORT:-3000}:3000'
  depends_on:
    api:
      condition: service_healthy

api:
  expose:
    - '3001'
  depends_on:
    postgres:
      condition: service_healthy
```

### `infra/docker/Dockerfile`
- Pourquoi: centraliser des builds multi-stage optimises et reproductibles.
- Ce que ca change:
- un seul Dockerfile avec targets `web`, `api`, `worker`
- install `pnpm` figee
- runtime non-root
- images runtime allegees (sortie `.output` pour web, deps prod pour api/worker)
- Extrait cle:

```dockerfile
FROM node:${NODE_VERSION}-alpine AS build-web
RUN pnpm --filter @finance-os/web build

FROM oven/bun:${BUN_VERSION}-alpine AS api
USER app
ENTRYPOINT ["./infra/docker/entrypoints/api-entrypoint.sh"]
```

### `infra/docker/entrypoints/api-entrypoint.sh`
- Pourquoi: garantir un demarrage API homogene en prod.
- Ce que ca change: l'API passe toujours par le bootstrap (migrations + start).
- Extrait cle:

```sh
exec bun apps/api/src/bootstrap.ts
```

### `apps/api/src/bootstrap.ts`
- Pourquoi: appliquer les migrations Drizzle au demarrage (strategie A).
- Ce que ca change:
- execute `migrate(...)` sur `packages/db/drizzle`
- demarre ensuite le serveur API (`import './index'`)
- Extrait cle:

```ts
await migrate(dbClient.db, { migrationsFolder })
await import('./index')
```

### `infra/docker/entrypoints/worker-entrypoint.sh`
- Pourquoi: point d'entree explicite pour le worker.
- Ce que ca change: execution unique de `bun apps/worker/src/index.ts`.

### `apps/worker/src/index.ts`
- Pourquoi: permettre un healthcheck fiable sans port HTTP.
- Ce que ca change:
- ecrit un timestamp dans `/tmp/worker-heartbeat`
- met a jour ce fichier a chaque heartbeat DB+Redis reussi
- Extrait cle:

```ts
const WORKER_HEALTHCHECK_FILE = process.env.WORKER_HEALTHCHECK_FILE ?? '/tmp/worker-heartbeat'
await writeFile(WORKER_HEALTHCHECK_FILE, String(Date.now()), 'utf8')
```

### `infra/docker/healthchecks/http-healthcheck.mjs`
- Pourquoi: healthcheck HTTP reutilisable pour `web` et `api`.
- Ce que ca change: test simple base sur `HEALTHCHECK_URL`.

### `infra/docker/healthchecks/worker-heartbeat-healthcheck.mjs`
- Pourquoi: detecter un worker bloque meme si le process existe encore.
- Ce que ca change: fail si le heartbeat file est absent ou trop ancien.

### `apps/web/vite.config.ts`
- Pourquoi: garder `api` interne en ajoutant un proxy `/api`.
- Ce que ca change:
- route rule Nitro `'/api/**'` vers `API_INTERNAL_URL`
- Extrait cle:

```ts
routeRules: {
  '/api/**': {
    proxy: `${apiInternalUrl}/**`,
  },
}
```

### `apps/web/src/env.ts` et `apps/web/src/lib/api.ts`
- Pourquoi: accepter `VITE_API_BASE_URL=/api` en prod.
- Ce que ca change:
- validation env: URL absolue ou chemin absolu
- generation d'URL API compatible absolu/relatif
- Extrait cle:

```ts
if (baseUrl.startsWith('/')) {
  return `${toAbsolutePathPrefix(baseUrl)}${normalizedPath}`
}
```

### `packages/env/src/index.ts`
- Pourquoi: conventions d'env coherentes + validation prod stricte.
- Ce que ca change:
- support `APP_URL`, `WEB_URL`, `API_URL`
- compat legacy `WEB_ORIGIN`
- verifications prod (`APP_URL/WEB_URL` et `POWENS_REDIRECT_URI_PROD`)
- normalisation `'' -> undefined` pour les optionnelles
- Extrait cle:

```ts
const webUrl = normalizeUrl(parsed.WEB_URL ?? parsed.APP_URL ?? parsed.WEB_ORIGIN ?? 'http://127.0.0.1:3000')
const apiUrl = normalizeUrl(parsed.API_URL ?? `${appUrl}/api`)
```

### `.env.prod.example`
- Pourquoi: template prod unique, complet et explicite.
- Ce que ca change:
- variables URL canoniques
- variables Powens, DB, Redis, encryption key
- defaults surs pour healthchecks/migrations
- Emplacement de l'URL prod:
- `APP_URL=https://finance-os.enzogivernaud.fr`
- `WEB_URL=https://finance-os.enzogivernaud.fr`
- `API_URL=https://finance-os.enzogivernaud.fr/api`
- `POWENS_REDIRECT_URI_PROD=https://finance-os.enzogivernaud.fr/powens/callback`

### `.dockerignore`
- Pourquoi: eviter d'embarquer des secrets/fichiers inutiles dans les images.
- Ce que ca change: exclut `.env*`, `node_modules`, `.git`, artefacts build locaux.

### `AGENT.md`
- Pourquoi: figer les conventions de deploiement pour futurs agents.
- Ce que ca change:
- regles Dokploy/compose de prod
- conventions env URL
- strategie migration au boot API
- commandes de validation/deploiement

## 3) Checklist de deploiement Dokploy

### Explication simple
Tu copies le template d'env prod, tu remplis les secrets, tu deploies `docker-compose.prod.yml`, puis tu verifies health + logs.

### Explication technique
1. Creer le fichier `.env.prod` a partir de `.env.prod.example`.
2. Remplir obligatoirement:
- `APP_URL`, `WEB_URL`, `API_URL`
- `DATABASE_URL`, `POSTGRES_*`, `REDIS_URL`
- `POWENS_*`
- `APP_ENCRYPTION_KEY`
3. Verifier localement la config compose:
   - `docker compose --env-file .env.prod -f docker-compose.prod.yml config`
4. Deployer:
   - `docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build`
5. Verifier etat:
   - `docker compose --env-file .env.prod -f docker-compose.prod.yml ps`
6. Verifier logs:
   - `docker compose --env-file .env.prod -f docker-compose.prod.yml logs --no-color --tail=200 web api worker`
7. Tester endpoints:
   - `GET ${APP_URL}/`
   - `GET ${APP_URL}/api/health` (via proxy web)
   - `GET ${APP_URL}/api/db/health`

## 4) Debug / observabilite minimal

### Explication simple
Si quelque chose casse, regarde d'abord les healthchecks, puis les logs API/worker, puis la connectivite DB/Redis.

### Explication technique
- Logs utiles:
- `web`: erreurs SSR/proxy vers API
- `api`: migrations, erreurs DB, erreurs Powens
- `worker`: heartbeat, erreurs sync Powens, lock Redis

- Healthchecks:
- `web`: `infra/docker/healthchecks/http-healthcheck.mjs` sur `http://127.0.0.1:3000`
- `api`: `infra/docker/healthchecks/http-healthcheck.mjs` sur `http://127.0.0.1:3001/health`
- `worker`: `infra/docker/healthchecks/worker-heartbeat-healthcheck.mjs`

- Commandes Docker utiles:
- `docker compose --env-file .env.prod -f docker-compose.prod.yml ps`
- `docker compose --env-file .env.prod -f docker-compose.prod.yml logs -f api`
- `docker compose --env-file .env.prod -f docker-compose.prod.yml logs -f worker`
- `docker compose --env-file .env.prod -f docker-compose.prod.yml exec postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"`
- `docker compose --env-file .env.prod -f docker-compose.prod.yml exec redis redis-cli ping`
