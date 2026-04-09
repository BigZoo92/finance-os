# Finance-OS -- Variables d'environnement & Feature Flags

> **Derniere mise a jour** : 2026-04-09
> **Maintenu par** : agents (Claude, Codex) + humain
> Documenter ici toute nouvelle variable ajoutee.

---

## Legende

| Colonne | Signification |
|---|---|
| **Ou la definir** | `Dokploy` = env Dokploy compose, `GitHub` = Actions secrets/vars, `Local` = .env |
| **Consommateur** | API, Worker, Web (SSR), Vite (build), Docker |
| **Sensible** | Oui = ne jamais exposer cote client, ne jamais logger |

---

## 1. Runtime & Deploiement

| Variable | Default | Ou la definir | Consommateur | Sensible | Description |
|---|---|---|---|---|---|
| `NODE_ENV` | `development` | Dokploy, Local | API, Worker, Web | Non | Environnement runtime |
| `TZ` | `Europe/Paris` | Dokploy | Tous | Non | Timezone |
| `APP_VERSION` | -- | Docker build | Tous | Non | Version app (git tag) |
| `APP_COMMIT_SHA` | -- | Docker build | Tous | Non | Commit SHA |
| `LOG_LEVEL` | `info` | Dokploy, Local | API, Worker | Non | Niveau de log (debug/info/warn/error) |
| `APP_DEBUG` | `0` | Local | API | Non | Mode debug (1 = active) |

---

## 2. Serveurs

| Variable | Default | Ou la definir | Consommateur | Description |
|---|---|---|---|---|
| `WEB_PORT` | `3000` | Dokploy | Web | Port serveur web |
| `NITRO_HOST` | `0.0.0.0` | Dokploy | Web | Binding Nitro SSR |
| `NITRO_PORT` | `3000` | Dokploy | Web | Port Nitro SSR |
| `API_HOST` | `0.0.0.0` | Dokploy | API | Binding API |
| `API_PORT` | `3001` | Dokploy | API | Port API |
| `API_URL` | `http://127.0.0.1:3001` | Local | -- | URL API (dev) |
| `API_INTERNAL_URL` | `http://finance-os-api:3001` | Dokploy | Web (SSR), Worker | URL interne API pour proxy Nitro et appels internes worker |
| `APP_URL` | -- | Dokploy | API | URL publique de l'app |
| `WEB_URL` | = `APP_URL` | Dokploy | API | URL du serveur web |
| `WEB_ORIGIN` | = `WEB_URL` | Dokploy | API (CORS) | Origin web pour CORS |

---

## 3. Base de donnees

| Variable | Default | Ou la definir | Consommateur | Sensible | Description |
|---|---|---|---|---|---|
| `DATABASE_URL` | -- | Dokploy, Local | API, Worker | **Oui** | Connection string PostgreSQL |
| `POSTGRES_DB` | `finance_os` | Docker compose | Docker | Non | Nom de la DB |
| `POSTGRES_USER` | `finance_os` | Docker compose | Docker | Non | Utilisateur DB |
| `POSTGRES_PASSWORD` | -- | Dokploy, Local | Docker | **Oui** | Mot de passe DB |
| `POSTGRES_PORT` | `55432` (dev) / `5432` (prod) | Local / Dokploy | Docker | Non | Port PostgreSQL |
| `DRIZZLE_MIGRATIONS_FOLDER` | `packages/db/drizzle` | -- | API, Worker | Non | Dossier migrations |
| `RUN_DB_MIGRATIONS` | `true` | Dokploy | API | Non | Lancer migrations au demarrage |

**Generation** : PostgreSQL est provisionne par Docker compose. Le `DATABASE_URL` suit le format `postgresql://user:password@host:port/database`.

---

## 4. Redis

| Variable | Default | Ou la definir | Consommateur | Sensible | Description |
|---|---|---|---|---|---|
| `REDIS_URL` | `redis://localhost:6379` | Dokploy, Local | API, Worker | Non | Connection string Redis |
| `REDIS_PORT` | `6379` | Docker compose | Docker | Non | Port Redis |

---

## 5. Authentification

| Variable | Default | Ou la definir | Consommateur | Sensible | Comment generer |
|---|---|---|---|---|---|
| `AUTH_ADMIN_EMAIL` | `bigzoo@example.com` | Dokploy | API | Non | Choisir l'email admin |
| `AUTH_ADMIN_PASSWORD_HASH_B64` | -- | Dokploy | API | **Oui** | `echo -n "password" \| pnpm auth:hash-b64` |
| `AUTH_ADMIN_PASSWORD_HASH` | -- | Dokploy | API | **Oui** | `pnpm auth:hash` (format plain) |
| `AUTH_PASSWORD_HASH_B64` | -- | -- | API | **Oui** | Legacy, utiliser AUTH_ADMIN_* |
| `AUTH_PASSWORD_HASH` | -- | -- | API | **Oui** | Legacy, utiliser AUTH_ADMIN_* |
| `AUTH_SESSION_SECRET` | -- | Dokploy | API | **Oui** | `openssl rand -base64 48` (min 32 bytes) |
| `AUTH_SESSION_TTL_DAYS` | `30` | Dokploy | API | Non | Duree de vie session (jours) |
| `AUTH_LOGIN_RATE_LIMIT_PER_MIN` | `5` | Dokploy | API | Non | Max tentatives login/min |
| `AUTH_ALLOW_INSECURE_COOKIE_IN_PROD` | `false` | -- | API | Non | Cookies non-secure en prod (debug only) |

**Priorite de resolution du hash** :
1. `AUTH_ADMIN_PASSWORD_HASH_B64` (recommande)
2. `AUTH_ADMIN_PASSWORD_HASH`
3. `AUTH_PASSWORD_HASH_B64` (legacy)
4. `AUTH_PASSWORD_HASH` (legacy)

**Formats supportes** : `pbkdf2$sha256$...` (recommande) ou `$argon2...` (legacy)

---

## 6. Securite & Tokens

| Variable | Default | Ou la definir | Consommateur | Sensible | Comment generer |
|---|---|---|---|---|---|
| `PRIVATE_ACCESS_TOKEN` | -- | Dokploy | API | **Oui** | `openssl rand -base64 24` (min 12 chars) |
| `DEBUG_METRICS_TOKEN` | -- | Dokploy | API | **Oui** | `openssl rand -base64 24` (min 12 chars) |
| `APP_ENCRYPTION_KEY` | -- | Dokploy | API, Worker | **Oui** | `openssl rand -hex 32` (exactement 32 bytes) |

**`PRIVATE_ACCESS_TOKEN`** : token optionnel pour l'acces server-to-server. Accepte via headers `Authorization: Bearer`, `x-internal-token`, `x-finance-os-access-token`.

**`APP_ENCRYPTION_KEY`** : cle AES-256-GCM pour chiffrer les tokens Powens. Accepte : raw UTF-8 (32 bytes), hex (64 chars), base64.

---

## 7. Powens (Integration bancaire)

| Variable | Default | Ou la definir | Consommateur | Sensible | Comment obtenir |
|---|---|---|---|---|---|
| `POWENS_CLIENT_ID` | -- | Dokploy | API, Worker | **Oui** | Dashboard Powens |
| `POWENS_CLIENT_SECRET` | -- | Dokploy | API, Worker | **Oui** | Dashboard Powens |
| `POWENS_BASE_URL` | -- | Dokploy | API, Worker | Non | Ex: `https://xxx-sandbox.biapi.pro` |
| `POWENS_DOMAIN` | -- | Dokploy | API | Non | Ex: `enzogivernaud-sandbox` |
| `POWENS_REDIRECT_URI_DEV` | `http://localhost:3000/powens/callback` | Local | API | Non | URI callback OAuth (dev) |
| `POWENS_REDIRECT_URI_PROD` | -- | Dokploy | API | Non | URI callback OAuth (prod, requis) |
| `POWENS_WEBVIEW_BASE_URL` | `https://webview.powens.com/connect` | -- | API | Non | URL base webview Powens |
| `POWENS_WEBVIEW_URL` | -- | Local | API | Non | URL webview complete (sandbox/test) |

---

## 8. Powens -- Tuning Sync

| Variable | Default | Ou la definir | Consommateur | Description |
|---|---|---|---|---|
| `POWENS_MANUAL_SYNC_COOLDOWN_SECONDS` | `300` | Dokploy | API | Cooldown entre syncs manuelles |
| `POWENS_SYNC_INTERVAL_MS` | `43200000` (12h) | Dokploy | Worker | Intervalle auto-sync |
| `POWENS_SYNC_MIN_INTERVAL_PROD_MS` | `43200000` (12h) | -- | Worker | Minimum en prod |
| `POWENS_SYNC_INCREMENTAL_LOOKBACK_DAYS` | `7` | Dokploy | Worker | Fenetre lookback incremental (1-30) |
| `POWENS_FORCE_FULL_SYNC` | `false` | Dokploy | Worker | Forcer full sync |
| `POWENS_SYNC_DISABLED_PROVIDERS` | -- | Dokploy | Worker | Providers desactives (comma-separated) |

---

## 9. Worker

| Variable | Default | Ou la definir | Consommateur | Description |
|---|---|---|---|---|
| `WORKER_HEARTBEAT_MS` | `30000` | Dokploy | Worker | Intervalle heartbeat (ms) |
| `WORKER_HEALTHCHECK_FILE` | `/tmp/worker-heartbeat` | Dokploy | Worker | Fichier heartbeat pour liveness k8s |
| `WORKER_HEALTHCHECK_MAX_AGE_MS` | `120000` | Dokploy | Worker | Age max heartbeat (ms) |
| `WORKER_AUTO_SYNC_ENABLED` | `false` | Dokploy | Worker | Activer auto-sync scheduler |
| `NEWS_AUTO_INGEST_ENABLED` | `true` | Dokploy | Worker | Activer le scheduler d'ingestion news |
| `NEWS_FETCH_INTERVAL_MS` | `14400000` | Dokploy | Worker | Intervalle du scheduler news (4h par defaut) |

---

## 10. Feature Flags (Backend)

| Flag | Default | Ou la definir | Consommateur | Description |
|---|---|---|---|---|
| `SYNC_STATUS_PERSISTENCE_ENABLED` | `true` | Dokploy | API, Worker | Persister statut sync OK/KO |
| `POWENS_DIAGNOSTICS_ENABLED` | `true` | Dokploy | API | Activer diagnostics Powens |
| `TRANSACTIONS_SNAPSHOT_FIRST_ENABLED` | `true` | Dokploy | API | Utiliser snapshot transactions en premier |
| `POWENS_REFRESH_BACKGROUND_ENABLED` | `true` | Dokploy | API | Refresh background Powens |
| `DEMO_DATASET_STRATEGY` | `v1` | Dokploy | API | Dataset demo (legacy/minimal/v1) |
| `DEMO_PERSONA_MATCHING_ENABLED` | `true` | Dokploy | API | Matching persona demo |
| `TRANSACTIONS_SNAPSHOT_STALE_AFTER_MINUTES` | `30` | Dokploy | API | Seuil fraicheur snapshot (min) |
| `DERIVED_RECOMPUTE_ENABLED` | `true` | Dokploy | API | Pipeline recompute |
| `ENRICHMENT_BULK_TRIAGE_ENABLED` | `true` | Dokploy | API | Bulk triage enrichment |
| `EXTERNAL_INTEGRATIONS_SAFE_MODE` | `false` | Dokploy | API, Worker | **Kill-switch** : desactive toutes les integrations Powens |
| `LIVE_NEWS_INGESTION_ENABLED` | `true` | Dokploy | API | Ingestion news live |
| `NEWS_AI_CONTEXT_BUNDLE_ENABLED` | `true` | Dokploy | API | Expose le bundle de contexte IA cache-only |
| `NEWS_MAX_PROVIDER_ITEMS_PER_RUN` | `20` | Dokploy | API | Cap par provider et par run |
| `NEWS_METADATA_FETCH_ENABLED` | `true` | Dokploy | API | Active le scraping de metadata article |
| `NEWS_METADATA_FETCH_TIMEOUT_MS` | `2500` | Dokploy | API | Timeout du scraping metadata |
| `NEWS_METADATA_FETCH_MAX_BYTES` | `131072` | Dokploy | API | Taille max lue pour le head HTML |
| `NEWS_SCRAPER_USER_AGENT` | `finance-os-news/1.0 (+APP_URL)` | Dokploy, Local | API | User-Agent pour metadata scraping |
| `SEC_USER_AGENT` | `= NEWS_SCRAPER_USER_AGENT` | Dokploy, Local | API | User-Agent explicite pour SEC / data.sec.gov |
| `DASHBOARD_NEWS_FORCE_FIXTURE_FALLBACK` | `false` | Dokploy, Local | API | Kill-switch debug : force `GET /dashboard/news` admin a servir le fixture pack (`admin_fallback`) ; lu directement via `process.env` |

---

## 11. News providers

| Variable | Default | Ou la definir | Consommateur | Description |
|---|---|---|---|---|
| `NEWS_PROVIDER_HN_ENABLED` | `true` | Dokploy, Local | API | Active Hacker News Algolia |
| `NEWS_PROVIDER_HN_QUERY` | `finance OR markets OR inflation OR AI` | Dokploy, Local | API | Requete HN |
| `NEWS_PROVIDER_GDELT_ENABLED` | `true` | Dokploy, Local | API | Active GDELT DOC 2.0 |
| `NEWS_PROVIDER_GDELT_QUERY` | `(finance OR inflation OR rates OR sanctions OR cybersecurity OR "artificial intelligence")` | Dokploy, Local | API | Requete GDELT |
| `NEWS_PROVIDER_ECB_RSS_ENABLED` | `true` | Dokploy, Local | API | Active les feeds ECB RSS |
| `NEWS_PROVIDER_ECB_RSS_FEED_URLS` | feeds ECB par defaut | Dokploy, Local | API | Liste CSV des feeds RSS ECB |
| `NEWS_PROVIDER_ECB_DATA_ENABLED` | `false` | Dokploy, Local | API | Active ECB Data Portal |
| `NEWS_PROVIDER_ECB_DATA_SERIES_KEYS` | `EXR/D.USD.EUR.SP00.A` | Dokploy, Local | API | Liste CSV des series ECB |
| `NEWS_PROVIDER_FED_ENABLED` | `true` | Dokploy, Local | API | Active Federal Reserve RSS |
| `NEWS_PROVIDER_FED_FEED_URLS` | feeds Fed par defaut | Dokploy, Local | API | Liste CSV des feeds Fed |
| `NEWS_PROVIDER_SEC_ENABLED` | `true` | Dokploy, Local | API | Active SEC EDGAR / data.sec.gov |
| `NEWS_PROVIDER_SEC_TICKERS` | `AAPL,MSFT,NVDA,AMZN,GOOGL,META,TSLA` | Dokploy, Local | API | Watchlist ticker SEC |
| `NEWS_PROVIDER_FRED_ENABLED` | `false` | Dokploy, Local | API | Active FRED |
| `NEWS_PROVIDER_FRED_SERIES_IDS` | `FEDFUNDS,CPIAUCSL,UNRATE,DGS10` | Dokploy, Local | API | Liste CSV des series FRED |
| `FRED_API_KEY` | -- | Dokploy, Local | API | Cle API FRED, requise si provider active |

Notes:

- `FRED_API_KEY` est un secret.
- `SEC_USER_AGENT` doit etre defini avec une vraie signature produit/contact en prod.
- `NEWS_PROVIDER_ECB_DATA_ENABLED` et `NEWS_PROVIDER_FRED_ENABLED` restent desactives par defaut pour garder un cout reseau raisonnable.

---

## 12. Failsoft Policy

| Flag | Default | Ou la definir | Consommateur | Description |
|---|---|---|---|---|
| `FAILSOFT_POLICY_ENABLED` | `true` | Dokploy | API | Activer politique failsoft |
| `FAILSOFT_SOURCE_ORDER` | `live,cache,demo` | Dokploy | API | Ordre des sources de fallback |
| `FAILSOFT_ALERTS_ENABLED` | `true` | Dokploy | API | Alertes dans failsoft |
| `FAILSOFT_NEWS_ENABLED` | `true` | Dokploy | API | News dans failsoft |
| `FAILSOFT_INSIGHTS_ENABLED` | `true` | Dokploy | API | Insights dans failsoft |

---

## 13. Feature Flags (Frontend / Vite)

> **Rappel** : les variables `VITE_*` sont exposees au client. Ne JAMAIS y mettre de secret.

| Flag | Default | Ou la definir | Description |
|---|---|---|---|
| `VITE_APP_TITLE` | `Finance OS` | GitHub vars | Titre de l'app |
| `VITE_APP_ORIGIN` | -- | Dokploy, GitHub | Origin publique (SSR) |
| `VITE_API_BASE_URL` | `/api` | Dokploy, GitHub | Endpoint API client |
| `VITE_POWENS_SYNC_COOLDOWN_UI_ENABLED` | `true` | GitHub vars | Afficher cooldown sync UI |
| `VITE_POWENS_SYNC_COOLDOWN_UI_SECONDS` | `300` | GitHub vars | Duree cooldown affichee |
| `VITE_DASHBOARD_HEALTH_SIGNALS_ENABLED` | `true` | GitHub vars | Signaux de sante dashboard |
| `VITE_DASHBOARD_HEALTH_GLOBAL_INDICATOR_ENABLED` | `true` | GitHub vars | Indicateur global sante |
| `VITE_DASHBOARD_HEALTH_WIDGET_BADGES_ENABLED` | `true` | GitHub vars | Badges sante par widget |
| `VITE_UI_RECONNECT_BANNER_ENABLED` | -- | GitHub vars | Bandeau reconnexion Powens |
| `VITE_PWA_NOTIFICATIONS_ENABLED` | -- | GitHub vars | Notifications push UI |
| `VITE_PWA_CRITICAL_ENABLED` | -- | GitHub vars | Alertes critiques push |
| `VITE_AI_ADVISOR_ENABLED` | -- | GitHub vars | Feature conseiller IA |
| `VITE_AI_ADVISOR_ADMIN_ONLY` | -- | GitHub vars | Restreindre IA aux admins |

---

## 14. Push Notifications

| Variable | Default | Ou la definir | Consommateur | Sensible | Comment generer |
|---|---|---|---|---|---|
| `PWA_NOTIFICATIONS_ENABLED` | `true` | Dokploy | API, Worker | Non | Flag on/off |
| `PWA_CRITICAL_ENABLED` | `true` | Dokploy | API | Non | Flag on/off |
| `PUSH_DELIVERY_PROVIDER_URL` | -- | Dokploy | API | Non | URL provider push externe |
| `PUSH_VAPID_PUBLIC_KEY` | -- | Dokploy | API | Non | `npx web-push generate-vapid-keys` |
| `PUSH_VAPID_PRIVATE_KEY` | -- | Dokploy | API | **Oui** | `npx web-push generate-vapid-keys` |

---

## 15. Monitoring & Alertes (ops-alerts sidecar)

| Variable | Default | Ou la definir | Description |
|---|---|---|---|
| `ALERTS_ENABLED` | `false` | Dokploy | Activer le sidecar alertes |
| `ALERTS_WEBHOOK_URL` | -- | Dokploy | URL webhook (ntfy/Slack/Discord) |
| `ALERTS_WEBHOOK_HEADERS_JSON` | -- | Dokploy | Headers JSON pour webhook |
| `ALERTS_POLL_INTERVAL_MS` | `30000` | Dokploy | Intervalle de polling |
| `ALERTS_HTTP_TIMEOUT_MS` | `5000` | Dokploy | Timeout HTTP alertes |
| `ALERTS_5XX_THRESHOLD` | `3` | Dokploy | Seuil erreurs 5xx |
| `ALERTS_5XX_WINDOW_MS` | `300000` | Dokploy | Fenetre 5xx (5min) |
| `ALERTS_5XX_PROBE_URLS` | -- | Dokploy | URLs a sonder |
| `ALERTS_HEALTHCHECK_FAILURE_THRESHOLD` | `2` | Dokploy | Seuil echecs healthcheck |
| `ALERTS_HEALTHCHECK_URLS` | -- | Dokploy | URLs healthcheck |
| `ALERTS_WORKER_HEARTBEAT_FILE` | -- | Dokploy | Fichier heartbeat worker |
| `ALERTS_WORKER_STALE_AFTER_MS` | `120000` | Dokploy | Seuil staleness worker |
| `ALERTS_DISK_FREE_PERCENT_THRESHOLD` | `10` | Dokploy | Seuil disque libre (%) |
| `ALERTS_DISK_PATHS` | -- | Dokploy | Chemins a surveiller |

---

## 16. Docker Build (arguments de build)

| Argument | Default | Ou la definir | Description |
|---|---|---|---|
| `NODE_VERSION` | `22.15.0` | GitHub vars | Version Node.js |
| `BUN_VERSION` | `1.2.22` | GitHub vars | Version Bun |
| `PNPM_VERSION` | `10.15.0` | GitHub vars | Version pnpm |
| `GIT_SHA` | -- | GitHub Actions (auto) | Commit SHA |
| `GIT_TAG` | -- | GitHub Actions (auto) | Tag release |
| `BUILD_TIME` | -- | GitHub Actions (auto) | Timestamp build |

---

## 17. Docker Compose

| Variable | Default | Ou la definir | Description |
|---|---|---|---|
| `GHCR_IMAGE_NAME` | -- | Dokploy, GitHub | Image GHCR (ex: `ghcr.io/bigzoo92/finance-os`) |
| `APP_IMAGE_TAG` | -- | Dokploy | Tag image Docker (ex: `v1.2.3`, jamais `latest`) |
| `PROXY_HTTP_PORT` | `3080` | Local | Port HTTP proxy (HTTPS local) |
| `PROXY_HTTPS_PORT` | `3443` | Local | Port HTTPS proxy (HTTPS local) |

---

## 18. GitHub Actions Secrets & Variables

### Secrets (GitHub Settings > Secrets)

| Secret | Usage |
|---|---|
| `GHCR_TOKEN` | Token push GHCR |
| `DOKPLOY_API_KEY` | Cle API Dokploy |

### Variables (GitHub Settings > Variables)

| Variable | Usage |
|---|---|
| `GHCR_IMAGE_NAME` | Nom image GHCR |
| `DOKPLOY_URL` | URL Dokploy |
| `DOKPLOY_COMPOSE_ID` | ID compose Dokploy |
| `NODE_VERSION` | Version Node build |
| `BUN_VERSION` | Version Bun build |
| `PNPM_VERSION` | Version pnpm build |
| `VITE_*` | Toutes les variables frontend Vite |

---

## Validation

Les variables sont validees au demarrage par **Zod** :
- **API** : `packages/env/src/index.ts` -> `getApiEnv()`
- **Worker** : `packages/env/src/index.ts` -> `getWorkerEnv()`
- **Web** : `apps/web/src/env.ts` -> `@t3-oss/env-core`

Erreurs de validation = crash au demarrage avec message explicite.
