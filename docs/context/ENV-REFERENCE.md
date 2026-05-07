# Finance-OS -- Variables d'environnement & Feature Flags

> **Derniere mise a jour** : 2026-05-03
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
| `FINANCE_OS_SKIP_ROOT_ENV` | `false` | Local, CI | API, Worker, Web SSR tools | Non | Test/e2e escape hatch: skip loading the root `.env` when the caller supplies an explicit env |
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
| `API_ALLOW_IN_MEMORY_REDIS` | `false` | Local, CI | API | Non | Autorise l'API a utiliser l'adapter Redis en memoire pour demo/test/local sans daemon Redis. Rejete explicitement en production si `true`. |

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

## 8.bis Investissements externes -- IBKR / Binance

Ces variables sont des reglages applicatifs serveur. Les credentials IBKR/Binance ne sont pas des variables d'env: ils sont configures en admin via `/integrations`, chiffres en DB avec `APP_ENCRYPTION_KEY`, et jamais exposes dans `VITE_*`.

| Variable | Default | Ou la definir | Consommateur | Description |
|---|---|---|---|---|
| `EXTERNAL_INVESTMENTS_ENABLED` | `true` | Dokploy, Local | API, Worker | Active les routes cache-only, la configuration admin et les jobs worker |
| `EXTERNAL_INVESTMENTS_SAFE_MODE` | `false` | Dokploy, Local | API, Worker | Kill-switch dedie IBKR/Binance: bloque les syncs provider et laisse les lectures cache/demo disponibles |
| `EXTERNAL_INVESTMENTS_SYNC_COOLDOWN_SECONDS` | `300` | Dokploy, Local | API | Cooldown des syncs manuelles IBKR/Binance |
| `EXTERNAL_INVESTMENTS_STALE_AFTER_MINUTES` | `1440` | Dokploy, Local | API, Worker | Seuil de fraicheur pour health, UI et Advisor bundle |
| `IBKR_FLEX_ENABLED` | `true` | Dokploy, Local | API, Worker | Active le provider IBKR Flex Web Service |
| `IBKR_FLEX_BASE_URL` | `https://ndcdyn.interactivebrokers.com` | Dokploy, Local | API, Worker | Base URL Flex par defaut; surcharge possible par credential admin |
| `IBKR_FLEX_USER_AGENT` | `Finance-OS External Investments/1.0` | Dokploy, Local | API, Worker | User-Agent requis pour les appels Flex |
| `IBKR_FLEX_TIMEOUT_MS` | `30000` | Dokploy, Local | Worker | Timeout des appels Flex |
| `BINANCE_SPOT_ENABLED` | `true` | Dokploy, Local | API, Worker | Active le provider Binance Spot/Wallet read-only |
| `BINANCE_SPOT_BASE_URL` | `https://api.binance.com` | Dokploy, Local | API, Worker | Base URL Spot REST par defaut; surcharge possible par credential admin |
| `BINANCE_SPOT_RECV_WINDOW_MS` | `5000` | Dokploy, Local | Worker | `recvWindow` signe pour les endpoints USER_DATA |
| `BINANCE_SPOT_TIMEOUT_MS` | `30000` | Dokploy, Local | Worker | Timeout des appels Binance |

Notes:

- `APP_ENCRYPTION_KEY` est obligatoire pour chiffrer/dechiffrer les credentials.
- `EXTERNAL_INTEGRATIONS_SAFE_MODE` reste le kill-switch global; `EXTERNAL_INVESTMENTS_SAFE_MODE` est le kill-switch specifique IBKR/Binance.
- Aucune permission trading, withdrawal, transfer, convert, margin/futures ou staking/earn mutation n'est acceptee.

---

## 9. Worker

| Variable | Default | Ou la definir | Consommateur | Description |
|---|---|---|---|---|
| `WORKER_HEARTBEAT_MS` | `30000` | Dokploy | Worker | Intervalle heartbeat (ms) |
| `WORKER_HEALTHCHECK_FILE` | `/tmp/worker-heartbeat` | Dokploy | Worker | Fichier heartbeat pour liveness k8s |
| `WORKER_HEALTHCHECK_MAX_AGE_MS` | `120000` | Dokploy | Worker | Age max heartbeat (ms) |
| `WORKER_AUTO_SYNC_ENABLED` | `false` | Dokploy | Worker | Activer auto-sync scheduler. Laisser `false` pour le mode manuel recommande |
| `NEWS_AUTO_INGEST_ENABLED` | `true` | Dokploy | Worker | Activer le scheduler d'ingestion news. Mettre `false` pour le mode manuel-first recommande |
| `NEWS_FETCH_INTERVAL_MS` | `14400000` | Dokploy | Worker | Intervalle du scheduler news (4h par defaut) |
| `MARKET_DATA_AUTO_REFRESH_ENABLED` | `false` | Dokploy | Worker | Activer le scheduler de refresh marches |
| `MARKET_DATA_REFRESH_INTERVAL_MS` | `21600000` | Dokploy | Worker | Intervalle du scheduler marches (6h par defaut) |
| `DAILY_INTELLIGENCE_ENABLED` | `false` | Dokploy, Local | Worker | Active le scheduler Daily Intelligence Run |
| `DAILY_INTELLIGENCE_CRON` | `0 9 * * 1-5` | Dokploy, Local | Worker | Heure cible du run global. Le worker applique minute/heure et garde en plus lundi-vendredi |
| `DAILY_INTELLIGENCE_TIMEZONE` | `Europe/Paris` | Dokploy, Local | Worker | Timezone du run global |
| `DAILY_INTELLIGENCE_MARKET_OPEN_HOUR` | `9` | Dokploy, Local | Worker | Heure locale de repli si le champ heure du cron est absent ou wildcard |

Daily Intelligence appelle `POST API_INTERNAL_URL/ops/refresh/all` avec `PRIVATE_ACCESS_TOKEN` en `x-internal-token`. Le lock Redis `daily-intelligence:run:lock` evite les doubles executions entre instances worker.

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
| `TRANSACTIONS_CATEGORIZATION_MIGRATION_ENABLED` | `true` | Dokploy | API | Active le mode shadow + compare pour la migration de categorisation |
| `TRANSACTIONS_CATEGORIZATION_ROLLOUT_PERCENT` | `0` | Dokploy | API | Pourcentage de cutover progressif vers le moteur deterministe (`0-100`) |
| `TRANSACTIONS_CATEGORIZATION_ALERT_DISAGREEMENT_RATE` | `0.08` | Dokploy | API | Seuil d'alerte (ratio) si le desaccord shadow depasse le niveau acceptable |
| `TRANSACTIONS_CATEGORIZATION_SHADOW_LATENCY_BUDGET_MS` | `150` | Dokploy | API | Kill-switch shadow si la comparaison depasse ce budget de latence |
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
| `NEWS_PROVIDER_X_TWITTER_ENABLED` | `false` | Dokploy, Local | API | Active l'ingestion X/Twitter (recent search v2) |
| `NEWS_PROVIDER_X_TWITTER_QUERY` | `(inflation OR rates OR guidance OR earnings OR sanctions OR cyber OR "artificial intelligence") lang:en -is:retweet` | Dokploy, Local | API | Requete X/Twitter (sans retweets par defaut) |
| `NEWS_PROVIDER_X_TWITTER_BEARER_TOKEN` | -- | Dokploy, Local | API | Bearer token X API v2, secret obligatoire si provider actif |
| `FRED_API_KEY` | -- | Dokploy, Local | API | Cle API FRED, requise si FRED news ou marches est active |

Notes:

- `FRED_API_KEY` est un secret partage entre le domaine news et le domaine marches.
- `SEC_USER_AGENT` doit etre defini avec une vraie signature produit/contact en prod.
- `NEWS_PROVIDER_ECB_DATA_ENABLED`, `NEWS_PROVIDER_FRED_ENABLED`, et `NEWS_PROVIDER_X_TWITTER_ENABLED` restent desactives par defaut pour garder un cout reseau raisonnable.

---

## 11.ter Bluesky / AT Protocol

| Variable | Default | Ou la definir | Consommateur | Sensible | Description |
|---|---|---|---|---|---|
| `BLUESKY_ENABLED` | `false` | Dokploy, Local | API | Non | Active le provider Bluesky |
| `BLUESKY_HANDLE` | -- | Dokploy, Local | API | Non | Handle Bluesky pour l'auth (ex: `user.bsky.social`) |
| `BLUESKY_APP_PASSWORD` | -- | Dokploy, Local | API | **Oui** | App password Bluesky, server-only |
| `BLUESKY_SERVICE_URL` | `https://bsky.social` | Dokploy, Local | API | Non | URL du service ATProto |

Notes:

- `BLUESKY_APP_PASSWORD` est un secret, jamais expose cote client.
- Le provider Bluesky est optionnel et desactive par defaut.

---

## 11.quater Signaux sociaux

| Variable | Default | Ou la definir | Consommateur | Description |
|---|---|---|---|---|
| `SIGNALS_SOCIAL_POLLING_ENABLED` | `false` | Dokploy, Local | API, Worker | Active le polling automatique des comptes sociaux |
| `SIGNALS_SOCIAL_POLLING_INTERVAL_MS` | `3600000` | Dokploy, Local | Worker | Intervalle du scheduler social (1h par defaut) |
| `SIGNALS_MANUAL_IMPORT_ENABLED` | `true` | Dokploy, Local | API | Active l'import manuel de signaux |

Notes:

- Le polling social est desactive par defaut. Il necessite au moins un provider social configure (X ou Bluesky).
- L'import manuel est toujours disponible en mode admin, meme sans provider social.

---

## 11.bis Market data

| Variable | Default | Ou la definir | Consommateur | Description |
|---|---|---|---|---|
| `MARKET_DATA_ENABLED` | `true` | Dokploy, Local | API | Active la feature marches |
| `MARKET_DATA_REFRESH_ENABLED` | `true` | Dokploy, Local | API | Autorise `POST /dashboard/markets/refresh` |
| `MARKET_DATA_EODHD_ENABLED` | `true` | Dokploy, Local | API | Active le baseline EODHD |
| `MARKET_DATA_TWELVEDATA_ENABLED` | `true` | Dokploy, Local | API | Active l'overlay Twelve Data |
| `MARKET_DATA_FRED_ENABLED` | `true` | Dokploy, Local | API | Active les series macro FRED |
| `MARKET_DATA_US_FRESH_OVERLAY_ENABLED` | `true` | Dokploy, Local | API | Autorise l'overlay US plus frais |
| `MARKET_DATA_FORCE_FIXTURE_FALLBACK` | `false` | Dokploy, Local | API | Force le fallback fixture admin pour debug/demo ops |
| `MARKET_DATA_STALE_AFTER_MINUTES` | `960` | Dokploy, Local | API | Seuil de staleness cache marches |
| `MARKET_DATA_DEFAULT_WATCHLIST_IDS` | watchlist repo par defaut | Dokploy, Local | API | Liste CSV des instruments suivis |
| `MARKET_DATA_FRED_SERIES_IDS` | `FEDFUNDS,SOFR,DGS2,DGS10,T10Y2Y,CPIAUCSL,UNRATE` | Dokploy, Local | API | Liste CSV des series macro |
| `EODHD_API_KEY` | -- | Dokploy, Local | API | Cle API EODHD |
| `TWELVEDATA_API_KEY` | -- | Dokploy, Local | API | Cle API Twelve Data |

Notes:

- `EODHD_API_KEY`, `TWELVEDATA_API_KEY` et `FRED_API_KEY` restent strictement serveur.
- `MARKET_DATA_DEFAULT_WATCHLIST_IDS` attend les ids internes (`spy-us`, `cw8-pa`, etc.), pas les symboles provider bruts.
- `MARKET_DATA_FORCE_FIXTURE_FALLBACK=true` est utile pour valider le rendu degrade admin sans couper la feature.

---

## 11. Quant Service / Trading Lab

| Variable | Default | Ou la definir | Consommateur | Description |
|---|---|---|---|---|
| `QUANT_SERVICE_ENABLED` | `false` | Dokploy, Local | API | Active le quant service proxy |
| `QUANT_SERVICE_URL` | `http://127.0.0.1:8012` | Dokploy, Local | API | URL interne du quant service |
| `QUANT_SERVICE_TIMEOUT_MS` | `30000` | Dokploy, Local | API | Timeout appels quant service |
| `TRADING_LAB_ENABLED` | `true` | Dokploy, Local | API | Active les routes Trading Lab |
| `TRADING_LAB_PAPER_ONLY` | `true` | Dokploy, Local | API, Quant Service | Verrou paper-trading only. Ne pas mettre a false. |
| `TRADING_LAB_MAX_BACKTEST_ROWS` | `50000` | Dokploy, Local | Quant Service | Limite donnees par backtest |
| `TRADING_LAB_DEFAULT_FEES_BPS` | `10` | Dokploy, Local | Quant Service | Frais par defaut en bps |
| `TRADING_LAB_DEFAULT_SLIPPAGE_BPS` | `5` | Dokploy, Local | Quant Service | Slippage par defaut en bps |
| `TRADING_LAB_GRAPH_INGEST_ENABLED` | `true` | Dokploy, Local | API | Ingest strategies/backtests vers knowledge graph |
| `ATTENTION_SYSTEM_ENABLED` | `true` | Dokploy, Local | API | Active le systeme d'attention |
| `ATTENTION_SIGNAL_MIN_RELEVANCE` | `60` | Dokploy, Local | API | Seuil minimum relevance pour attention signal |
| `ATTENTION_SIGNAL_MIN_CONFIDENCE` | `50` | Dokploy, Local | API | Seuil minimum confidence pour attention signal |
| `ATTENTION_REBUILD_AUTO_ENABLED` | `false` | Dokploy, Local | Worker | Active la reconstruction periodique des attention items via le worker |
| `ATTENTION_REBUILD_INTERVAL_MS` | `600000` | Dokploy, Local | Worker | Intervalle de reconstruction (par defaut 10 min) |

Notes:

- `TRADING_LAB_PAPER_ONLY` doit rester `true`. Aucune execution reelle n'est implementee.
- Le quant service est interne uniquement (pas d'exposition publique).
- En demo, les routes Trading Lab retournent des fixtures deterministes.
- Le runner UI Trading Lab utilise l'adapter OHLCV (cache `market_ohlcv_bar` -> provider EODHD/TwelveData -> fixture deterministe). Aucun appel provider n'est emis depuis une route GET.
- `ATTENTION_REBUILD_AUTO_ENABLED=false` par defaut : la reconstruction reste declenchable manuellement via `POST /dashboard/trading-lab/attention/rebuild`.

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

## 13. AI Advisor / LLM (server only)

| Variable | Default | Ou la definir | Consommateur | Sensible | Description |
|---|---|---|---|---|---|
| `AI_ADVISOR_ENABLED` | `true` | Dokploy, `.env` | API, Worker | Non | Active le sous-systeme advisor |
| `AI_ADVISOR_ADMIN_ONLY` | `false` | Dokploy, `.env` | API | Non | Restreint les surfaces advisor aux sessions admin. Mettre `true` pour le mode manuel admin-only recommande |
| `AI_ADVISOR_FORCE_LOCAL_ONLY` | `false` | Dokploy, `.env` | API, Worker | Non | Coupe les appels LLM et force le chemin deterministe |
| `ADVISOR_X_SIGNALS_MODE` | `shadow` | Dokploy, `.env` | API, Worker | Non | Kill-switch des signaux X advisor: `off` desactive, `shadow` score+log sans injection prompt, `enforced` autorise inclusion bornee |
| `AI_KNOWLEDGE_QA_RETRIEVAL_ENABLED` | `true` | Dokploy, `.env` | API, Worker | Non | Kill-switch du Q&A educatif: quand `false`, `/dashboard/advisor/knowledge-answer` reste browse-only et `/dashboard/advisor/knowledge-topics` reste disponible |
| `KNOWLEDGE_SERVICE_ENABLED` | `false` | Dokploy, `.env` | API | Non | Autorise `apps/api` a appeler le service interne GraphRAG. Demo/UI gardent des fixtures si `false` |
| `KNOWLEDGE_SERVICE_URL` | `http://127.0.0.1:8011` local, `http://knowledge-service:8011` Docker | Dokploy, `.env` | API | Non | URL interne du knowledge service. Ne pas exposer publiquement |
| `KNOWLEDGE_SERVICE_TIMEOUT_MS` | `2500` | Dokploy, `.env` | API | Non | Timeout court pour fail-soft advisor |
| `KNOWLEDGE_GRAPH_BACKEND` | `local` dev, `neo4j` prod | Dokploy, `.env` | API, knowledge-service | Non | Backend graph cible: `local`, `neo4j`, `memgraph`, `falkordb` |
| `KNOWLEDGE_GRAPH_STORAGE_PATH` | `./.knowledge/graph` | Dokploy, `.env` | knowledge-service | Non | Chemin du snapshot local derive |
| `KNOWLEDGE_GRAPH_REBUILD_ON_START` | `true` | Dokploy, `.env` | knowledge-service | Non | Rebuild seed si le store local est vide au demarrage |
| `KNOWLEDGE_GRAPH_MAX_CONTEXT_TOKENS` | `1800` | Dokploy, `.env` | API, knowledge-service | Non | Plafond du bundle compact pour l'Advisor |
| `KNOWLEDGE_GRAPH_VECTOR_ENABLED` | `true` | Dokploy, `.env` | knowledge-service | Non | Active la lane vectorielle si backend disponible |
| `KNOWLEDGE_GRAPH_FULLTEXT_ENABLED` | `true` | Dokploy, `.env` | knowledge-service | Non | Active la lane full-text/BM25 |
| `KNOWLEDGE_GRAPH_TEMPORAL_ENABLED` | `true` | Dokploy, `.env` | knowledge-service | Non | Active scoring/filtres temporels |
| `KNOWLEDGE_GRAPH_DEMO_FIXTURES_ENABLED` | `true` | Dokploy, `.env` | API, knowledge-service | Non | Conserve les fixtures demo deterministes |
| `KNOWLEDGE_GRAPH_RETRIEVAL_MODE` | `hybrid` | Dokploy, `.env` | API, knowledge-service | Non | Mode par defaut: `hybrid`, `graph`, `vector`, `fulltext` |
| `KNOWLEDGE_GRAPH_RERANKING_ENABLED` | `true` | Dokploy, `.env` | knowledge-service | Non | Active reranking confiance/provenance/recence |
| `KNOWLEDGE_GRAPH_MAX_PATH_DEPTH` | `3` | Dokploy, `.env` | API, knowledge-service | Non | Profondeur max de traversal exposee au bundle |
| `KNOWLEDGE_GRAPH_MIN_CONFIDENCE` | `0.35` | Dokploy, `.env` | API, knowledge-service | Non | Filtre minimal de confiance |
| `KNOWLEDGE_GRAPH_RECENCY_HALF_LIFE_DAYS` | `45` | Dokploy, `.env` | knowledge-service | Non | Demi-vie de scoring recence |
| `KNOWLEDGE_GRAPH_EMBEDDING_PROVIDER` | `local` | Dokploy, `.env` | knowledge-service | Non | `local` par defaut; providers externes doivent rester server-only |
| `KNOWLEDGE_GRAPH_EMBEDDING_MODEL` | `local-hashing-v1` | Dokploy, `.env` | knowledge-service | Non | Modele/strategie d'embedding |
| `NEO4J_URI` | `bolt://neo4j:7687` | Dokploy, `.env` | knowledge-service | Non | URI interne Neo4j (legacy alias, encore supporte) |
| `NEO4J_USERNAME` | `neo4j` | Dokploy, `.env` | knowledge-service | Non | Utilisateur Neo4j (legacy alias) |
| `NEO4J_PASSWORD` | -- | Dokploy, `.env` | knowledge-service | **Oui** | Mot de passe Neo4j (legacy alias) |
| `QDRANT_URL` | `http://qdrant:6333` | Dokploy, `.env` | knowledge-service | Non | URL interne Qdrant (legacy alias) |
| `QDRANT_API_KEY` | -- | Dokploy, `.env` | knowledge-service | **Oui si defini** | Cle Qdrant optionnelle (legacy alias) |
| `KNOWLEDGE_USE_PRODUCTION_BACKENDS` | `false` dev / `true` prod | Dokploy, `.env` | knowledge-service | Non | Bascule admin sur Neo4j+Qdrant. Demo et tests restent toujours sur le store local |
| `KNOWLEDGE_REQUIRE_PRODUCTION_BACKENDS_IN_ADMIN` | `false` dev / `true` prod | Dokploy, `.env` | knowledge-service | Non | Si `true`, l'admin doit pouvoir parler a Neo4j et Qdrant ou degrader explicitement |
| `KNOWLEDGE_ALLOW_LOCAL_FALLBACK_IN_ADMIN` | `true` | Dokploy, `.env` | knowledge-service | Non | Autorise le fallback local quand un backend est indisponible (degraded surface) |
| `KNOWLEDGE_NEO4J_URI` | `bolt://neo4j:7687` | Dokploy, `.env` | knowledge-service | Non | URI Neo4j cible utilisee par l'adapter production |
| `KNOWLEDGE_NEO4J_USER` | `neo4j` | Dokploy, `.env` | knowledge-service | Non | Utilisateur Neo4j |
| `KNOWLEDGE_NEO4J_PASSWORD` | -- | Dokploy, `.env` | knowledge-service | **Oui** | Mot de passe Neo4j, server-only, jamais expose a l'UI |
| `KNOWLEDGE_NEO4J_DATABASE` | `neo4j` | Dokploy, `.env` | knowledge-service | Non | Base Neo4j cible |
| `KNOWLEDGE_QDRANT_URL` | `http://qdrant:6333` | Dokploy, `.env` | knowledge-service | Non | URL Qdrant pour le retrieval vectoriel/hybride |
| `KNOWLEDGE_QDRANT_API_KEY` | -- | Dokploy, `.env` | knowledge-service | **Oui si defini** | Cle Qdrant optionnelle, server-only |
| `KNOWLEDGE_QDRANT_COLLECTION` | `finance_os_knowledge` | Dokploy, `.env` | knowledge-service | Non | Nom de la collection vectorielle |
| `KNOWLEDGE_EMBEDDING_PROVIDER` | `local` | Dokploy, `.env` | knowledge-service | Non | `local` ou `openai` (server-only). Failures degradent vers hashing local |
| `KNOWLEDGE_EMBEDDING_MODEL` | `local-hashing-v1` | Dokploy, `.env` | knowledge-service | Non | Modele/strategie d'embedding effective |
| `KNOWLEDGE_EMBEDDING_DIMENSIONS` | `256` | Dokploy, `.env` | knowledge-service | Non | Dimension du vecteur stocke dans Qdrant |
| `AI_CHAT_ENABLED` | `true` | Dokploy, `.env` | API | Non | Active le chat grounded |
| `AI_CHALLENGER_ENABLED` | `true` | Dokploy, `.env` | API | Non | Active le challenger Anthropic |
| `AI_RELABEL_ENABLED` | `true` | Dokploy, `.env` | API | Non | Active le relabel transaction ambigu |
| `AI_OPENAI_API_KEY` | -- | Dokploy, `.env` | API | **Oui** | Cle API OpenAI |
| `AI_OPENAI_BASE_URL` | -- | Dokploy, `.env` | API | Non | Gateway/proxy OpenAI optionnel |
| `AI_OPENAI_CLASSIFIER_MODEL` | `gpt-5.4-nano` | Dokploy, `.env` | API | Non | Modele volume / classification |
| `AI_OPENAI_DAILY_MODEL` | `gpt-5.4-mini` | Dokploy, `.env` | API | Non | Modele principal daily brief / chat |
| `AI_OPENAI_DEEP_MODEL` | `gpt-5.4` | Dokploy, `.env` | API | Non | Modele reserve aux analyses plus profondes |
| `AI_ANTHROPIC_API_KEY` | -- | Dokploy, `.env` | API | **Oui** | Cle API Anthropic |
| `AI_ANTHROPIC_BASE_URL` | -- | Dokploy, `.env` | API | Non | Gateway/proxy Anthropic optionnel |
| `AI_ANTHROPIC_CHALLENGER_MODEL` | `claude-sonnet-4-6` | Dokploy, `.env` | API | Non | Modele challenger |
| `AI_USD_TO_EUR_RATE` | `0.92` | Dokploy, `.env` | API | Non | Conversion explicite pour reporting |
| `AI_BUDGET_DAILY_USD` | `2` | Dokploy, `.env` | API | Non | Budget journalier IA |
| `AI_BUDGET_MONTHLY_USD` | `40` | Dokploy, `.env` | API | Non | Budget mensuel IA |
| `AI_BUDGET_DISABLE_CHALLENGER_RATIO` | `0.75` | Dokploy, `.env` | API | Non | Coupe Claude avant depassement total |
| `AI_BUDGET_DISABLE_DEEP_ANALYSIS_RATIO` | `0.5` | Dokploy, `.env` | API | Non | Coupe les runs plus profonds avant le challenger |
| `AI_SPEND_ALERT_DAILY_THRESHOLD_PCT` | `0.8` | Dokploy, `.env` | API | Non | Alerte de budget journalier |
| `AI_SPEND_ALERT_MONTHLY_THRESHOLD_PCT` | `0.8` | Dokploy, `.env` | API | Non | Alerte de budget mensuel |
| `AI_MAX_CHAT_MESSAGES_CONTEXT` | `8` | Dokploy, `.env` | API | Non | Taille max du contexte chat persiste |
| `AI_POST_MORTEM_ENABLED` | `false` | Dokploy, `.env` | API | Non | Active le post-mortem advisor (PR4). Quand `false`, le runner LLM est inaccessible et `POST /dashboard/advisor/post-mortem/run` retourne `skipped_disabled`. |
| `AI_POST_MORTEM_HORIZON_DAYS` | `30` | Dokploy, `.env` | API | Non | Horizon par defaut pour considerer une recommandation expiree dans le batch post-mortem |
| `AI_POST_MORTEM_BATCH_LIMIT` | `10` | Dokploy, `.env` | API | Non | Cap dur d'items traites par run post-mortem (un seul appel LLM batch) |
| `AI_POST_MORTEM_MODEL` | `claude-sonnet-4-6` | Dokploy, `.env` | API | Non | Modele LLM utilise par le post-mortem |
| `AI_DAILY_AUTO_RUN_ENABLED` | `false` | Dokploy, `.env` | Worker | Non | Scheduler quotidien advisor. Doit rester `false` dans le mode manuel recommande |
| `AI_DAILY_INTERVAL_MS` | `900000` | Dokploy, `.env` | Worker | Non | Frequence de verification du scheduler advisor (tick periodique) |
| `AI_DAILY_MARKET_OPEN_WINDOW_ENABLED` | `true` | Dokploy, `.env` | Worker | Non | Active la garde de fenetre autour de l'ouverture de marche pour `run-daily` |
| `AI_DAILY_MARKET_OPEN_TIMEZONE` | `America/New_York` | Dokploy, `.env` | Worker | Non | Timezone de reference pour la fenetre `run-daily` |
| `AI_DAILY_MARKET_OPEN_HOUR` | `9` | Dokploy, `.env` | Worker | Non | Heure locale d'ouverture de marche ciblee |
| `AI_DAILY_MARKET_OPEN_MINUTE` | `30` | Dokploy, `.env` | Worker | Non | Minute locale d'ouverture de marche ciblee |
| `AI_DAILY_MARKET_OPEN_LEAD_MINUTES` | `45` | Dokploy, `.env` | Worker | Non | Minutes autorisees avant l'ouverture ciblee |
| `AI_DAILY_MARKET_OPEN_LAG_MINUTES` | `90` | Dokploy, `.env` | Worker | Non | Minutes autorisees apres l'ouverture ciblee |

---

## 14. Feature Flags (Frontend / Vite)

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
| `VITE_AI_ADVISOR_ADMIN_ONLY` | -- | GitHub vars | Restreindre IA aux admins. Recommande `true` pour le mode manuel actuel |
| `VITE_SOCIAL_BENCHMARK_EXPLAINABILITY_ENABLED` | `true` | GitHub vars | Active/desactive le panneau d'explicabilite benchmark social |
| `VITE_CTA_POLICY_REGISTRY_V1` | `false` | GitHub vars | Active le registre CTA policy-first v1 (fallback legacy si desactive) |
| `VITE_CTA_ORCHESTRATION_OFF` | `false` | GitHub vars | Kill-switch global pour couper l'orchestration CTA policy-first |
| `VITE_CTA_EMERGENCY_DISABLE_LIST` | -- | GitHub vars | Liste CSV des CTA a desactiver en urgence (`cta_id_1,cta_id_2`) |

---

## 15. Push Notifications

| Variable | Default | Ou la definir | Consommateur | Sensible | Comment generer |
|---|---|---|---|---|---|
| `PWA_NOTIFICATIONS_ENABLED` | `true` | Dokploy | API, Worker | Non | Flag on/off |
| `PWA_CRITICAL_ENABLED` | `true` | Dokploy | API | Non | Flag on/off |
| `PUSH_DELIVERY_PROVIDER_URL` | -- | Dokploy | API | Non | URL provider push externe |
| `PUSH_VAPID_PUBLIC_KEY` | -- | Dokploy | API | Non | `npx web-push generate-vapid-keys` |
| `PUSH_VAPID_PRIVATE_KEY` | -- | Dokploy | API | **Oui** | `npx web-push generate-vapid-keys` |

---

## 16. Monitoring & Alertes (ops-alerts sidecar)

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

## 17. Docker Build (arguments de build)

| Argument | Default | Ou la definir | Description |
|---|---|---|---|
| `NODE_VERSION` | `22.15.0` | GitHub vars | Version Node.js |
| `BUN_VERSION` | `1.2.22` | GitHub vars | Version Bun |
| `PNPM_VERSION` | `10.15.0` | GitHub vars | Version pnpm |
| `GIT_SHA` | -- | GitHub Actions (auto) | Commit SHA |
| `GIT_TAG` | -- | GitHub Actions (auto) | Tag release |
| `BUILD_TIME` | -- | GitHub Actions (auto) | Timestamp build |

---

## 18. Docker Compose

| Variable | Default | Ou la definir | Description |
|---|---|---|---|
| `GHCR_IMAGE_NAME` | -- | Dokploy, GitHub | Image GHCR (ex: `ghcr.io/bigzoo92/finance-os`) |
| `APP_IMAGE_TAG` | -- | Dokploy | Tag image Docker (ex: `v1.2.3`, jamais `latest`) |
| `HERMES_AGENT_IMAGE` | `ghcr.io/nousresearch/hermes-agent:latest` | Dokploy | Image du sidecar Hermes (profile `hermes-agent`) |
| `HERMES_AGENT_PORT` | `8080` | Dokploy | Port interne du sidecar Hermes |
| `HERMES_AGENT_API_KEY` | -- | Dokploy | Cle API obligatoire pour Hermes (secrete) |
| `PROXY_HTTP_PORT` | `3080` | Local | Port HTTP proxy (HTTPS local) |
| `PROXY_HTTPS_PORT` | `3443` | Local | Port HTTPS proxy (HTTPS local) |

---

## 19. GitHub Actions Secrets & Variables

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
