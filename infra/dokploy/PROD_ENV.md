# Prod Env - Dokploy

## 1) Variables Dokploy (runtime)

### Build et version (obligatoire)
- `NODE_VERSION=22.15.0`
- `BUN_VERSION=1.2.22`
- `PNPM_VERSION=10.15.0`
- `GIT_SHA=<sha courant>` (optionnel mais recommande)
- `GIT_TAG=main` (optionnel)
- `BUILD_TIME=YYYY-MM-DDTHH:MM:SSZ` (optionnel)

### URLs
- `APP_URL=https://finance-os.enzogivernaud.fr`
- `WEB_URL=https://finance-os.enzogivernaud.fr`
- `API_URL=https://finance-os.enzogivernaud.fr/api`
- `API_INTERNAL_URL=http://finance-os-api:3001`
- `VITE_API_BASE_URL=/api`
- `VITE_APP_ORIGIN=https://finance-os.enzogivernaud.fr`

### Auth single-user (obligatoire)
- `AUTH_ADMIN_EMAIL=<ton email admin>`
- `AUTH_ADMIN_PASSWORD_HASH_B64=<base64 du hash>` (recommande)
- `AUTH_ADMIN_PASSWORD_HASH=<hash brut>` (fallback)
- `AUTH_SESSION_SECRET=<32+ bytes>`
- `AUTH_SESSION_TTL_DAYS=30`
- `AUTH_LOGIN_RATE_LIMIT_PER_MIN=5`

Notes:
- Format hash supporte `pbkdf2$...` (recommande) et legacy `$argon2...`.
- `pnpm auth:hash-b64 -- "ton-mot-de-passe"` genere les variables.

### API / Debug
- `PRIVATE_ACCESS_TOKEN=<token interne long>` (recommande)
- `DEBUG_METRICS_TOKEN=<token debug long>` (optionnel)
- `LOG_LEVEL=info` (mettre `debug` temporairement si incident)
- `APP_DEBUG=0`

### DB / Redis
- `DATABASE_URL=postgresql://...`
- `REDIS_URL=redis://redis:6379`
- `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`

### Powens / chiffrement
- `POWENS_CLIENT_ID`
- `POWENS_CLIENT_SECRET`
- `POWENS_BASE_URL`
- `POWENS_DOMAIN`
- `POWENS_REDIRECT_URI_DEV`
- `POWENS_REDIRECT_URI_PROD`
- `POWENS_WEBVIEW_BASE_URL` (defaut ok)
- `POWENS_WEBVIEW_URL` (optionnel)
- `APP_ENCRYPTION_KEY` (32 bytes)

### Worker
- `WORKER_AUTO_SYNC_ENABLED=false` (recommande en prod pour eviter sync auto non demandee)
- `EXTERNAL_INTEGRATIONS_SAFE_MODE=false` (passer a `true` pour desactiver temporairement les appels integrations externes)
- `WORKER_HEARTBEAT_MS=30000`
- `WORKER_HEALTHCHECK_MAX_AGE_MS=120000`
- `POWENS_SYNC_INTERVAL_MS=43200000`
- `POWENS_SYNC_MIN_INTERVAL_PROD_MS=43200000`

### Alerting minimal
- `ALERTS_ENABLED=true` (laisser `false` tant que le webhook n'est pas configure)
- `ALERTS_WEBHOOK_URL=<webhook>`
- `ALERTS_WEBHOOK_HEADERS_JSON={"Authorization":"Bearer <token>"}` (optionnel)
- `ALERTS_POLL_INTERVAL_MS=30000`
- `ALERTS_HTTP_TIMEOUT_MS=5000`
- `ALERTS_5XX_THRESHOLD=3`
- `ALERTS_5XX_WINDOW_MS=300000`
- `ALERTS_5XX_PROBE_URLS=http://web:3000/api/auth/me,http://web:3000/api/dashboard/summary?range=30d`
- `ALERTS_HEALTHCHECK_FAILURE_THRESHOLD=2`
- `ALERTS_HEALTHCHECK_URLS=http://web:3000/healthz,http://finance-os-api:3001/health`
- `ALERTS_WORKER_STALE_AFTER_MS=120000`
- `ALERTS_DISK_FREE_PERCENT_THRESHOLD=10`
- `ALERTS_DISK_PATHS=/mnt/postgres,/mnt/redis`

## 2) Variables GitHub (optionnel)

Utile seulement si tu gardes un trigger API externe Dokploy:

- `DOKPLOY_URL`
- `DOKPLOY_API_KEY`
- `DOKPLOY_COMPOSE_ID` ou `DOKPLOY_APPLICATION_ID`

## 3) Procedure de deploiement deterministe

1. Push sur `main`.
2. Dokploy (provider GitHub) pull le repo et build les services.
3. Dans Dokploy, verifier les variables:
   - `GIT_TAG=main`
   - `GIT_SHA=<sha du commit>`
   - `BUILD_TIME=<timestamp UTC>`
4. Redeployer.
5. Verifier:
   - `/api/health` -> 200
   - `/api/version` -> JSON avec `GIT_SHA/GIT_TAG/BUILD_TIME/NODE_ENV`
   - `/api/auth/me` -> 200 `mode=demo` hors login
   - `/api/__routes` (avec token interne) -> contient les routes critiques
6. Lancer `pnpm smoke:prod -- --base https://finance-os.enzogivernaud.fr/api --internal-token <token>`.

## 4) Dokploy routing attendu

- Host `finance-os.enzogivernaud.fr` path `/` -> `web:3000`
- Pas de route publique separee vers `api:3001` dans le setup standard.
- Le runtime `web` proxyfie deja `/api/*` vers l'alias interne `finance-os-api` via `API_INTERNAL_URL=http://finance-os-api:3001`.
- Exposer `/api` directement vers `api` dans Dokploy est inutile et peut diverger du comportement local.

## 5) Cloudflare anti-cache (obligatoire)

Creer des Cache Rules (ordre top-down):

1. `finance-os.enzogivernaud.fr/api/*` -> `Cache: Bypass`
2. `finance-os.enzogivernaud.fr/powens/*` -> `Cache: Bypass`
3. `finance-os.enzogivernaud.fr/login*` -> `Cache: Bypass`
4. `finance-os.enzogivernaud.fr/` -> `Cache: Bypass`

Recommandations:
- Ne jamais activer "Cache Everything" sur ce domaine sans exclusions strictes.
- Garder les cookies forwarding actifs au proxy.
- Ne pas transformer/supprimer `x-request-id`.

## 6) Generation rapide des secrets

- `AUTH_SESSION_SECRET`: `openssl rand -base64 48`
- `PRIVATE_ACCESS_TOKEN`: `openssl rand -base64 48`
- `APP_ENCRYPTION_KEY` (32 bytes): `openssl rand -base64 32`
- Hash mot de passe admin: `pnpm auth:hash-b64 -- "mot-de-passe-admin"`
