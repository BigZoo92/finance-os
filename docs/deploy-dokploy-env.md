# Dokploy Environment Variables (finance-os)

## 1) Explication simple

Cette page liste exactement toutes les variables a configurer dans Dokploy pour `docker-compose.prod.yml`.

Objectif:

- eviter les erreurs de preview compose (variables manquantes)
- garder un runtime stable (API/worker refusent de demarrer si secrets invalides)
- rendre le deploiement operable avec une seule configuration initiale

Important:

- Le compose prod build localement les services (`web`, `api`, `worker`) via `build:`.
- La validation runtime reste strictement appliquee dans `@finance-os/env`.
- `APP_IMAGE_TAG`/`GHCR_IMAGE_NAME` ne sont pas necessaires en mode Dokploy Git provider.
- En production standard, seul `web` doit etre expose publiquement. Le runtime `web` proxifie `/api/*` vers `api` en interne.

## 2) Explication technique

- Les services `web`, `api`, `worker` sont buildes depuis le repo par Dokploy.
- L'API/worker valident fortement l'env:
  - URL obligatoires
  - hash admin (`pbkdf2$...` recommande, `$argon2...` legacy)
  - `AUTH_SESSION_SECRET` >= 32 bytes
  - `APP_ENCRYPTION_KEY` = 32 bytes
- Pour Dokploy/Compose, preferer `AUTH_ADMIN_PASSWORD_HASH_B64`.
- Le mode recommande est:
  - deploiement sur push `main`
  - rollback via revert/reset de `main` puis redeploy

## 3) Variables Dokploy (tableau exhaustif)

| Variable | Service(s) | Obligatoire | Format attendu | Valeur recommandee | Comment obtenir/generer |
| --- | --- | --- | --- | --- | --- |
| `NODE_VERSION` | web, api, worker | Optionnel | semver Node | `22.15.0` | Build arg Dockerfile. |
| `BUN_VERSION` | web, api, worker | Optionnel | semver Bun | `1.2.22` | Build arg Dockerfile. |
| `PNPM_VERSION` | web, api, worker | Optionnel | semver pnpm | `10.15.0` | Build arg Dockerfile. |
| `WEB_PORT` | web | Optionnel | entier TCP | `3000` | Changer seulement si conflit de port VPS. |
| `TZ` | web, api, worker, postgres | Optionnel | timezone IANA | `Europe/Paris` | Ex: `Europe/Paris`, `UTC`, `America/New_York`. |
| `APP_VERSION` | web, api | Optionnel | string | vide | Version affichee dans `/debug/health` si renseignee. |
| `APP_COMMIT_SHA` | web, api | Optionnel | string | vide | Commit SHA affiche dans `/debug/health` si renseigne. |
| `APP_URL` | web, api | Oui | URL HTTPS | `https://finance-os.enzogivernaud.fr` (si c'est ton domaine) | URL publique principale servie par Dokploy. |
| `WEB_URL` | web, api | Optionnel | URL HTTPS | meme que `APP_URL` | Peut etre vide; l'API retombera sur `APP_URL`. |
| `API_URL` | web, api | Optionnel | URL HTTPS | `${APP_URL}/api` | Peut etre vide; l'API le reconstruit depuis `APP_URL`. |
| `RUN_DB_MIGRATIONS` | api | Optionnel | `true` ou `false` | `true` | Laisse `true` pour migration automatique au boot API. |
| `DATABASE_URL` | api, worker | Oui | URL postgres | `postgresql://finance_os:<PASSWORD>@postgres:5432/finance_os` | Construire avec les valeurs `POSTGRES_*`. |
| `REDIS_URL` | api, worker | Oui | URL redis | `redis://redis:6379` | Service redis interne compose. |
| `POSTGRES_DB` | postgres | Optionnel (fortement recommande) | string | `finance_os` | Nom base Postgres locale. |
| `POSTGRES_USER` | postgres | Optionnel (fortement recommande) | string | `finance_os` | Utilisateur Postgres local. |
| `POSTGRES_PASSWORD` | postgres | Oui | secret fort | valeur aleatoire 24+ chars | `openssl rand -base64 32` (ou gestionnaire de mots de passe). |
| `PRIVATE_ACCESS_TOKEN` | web, api | Optionnel | secret >= 12 chars | vide (desactive) | Si active, meme valeur doit etre presente en runtime sur `web` et `api` pour les appels SSR internes. |
| `VITE_PRIVATE_ACCESS_TOKEN` | aucun | Non | ne pas definir | vide | Variable interdite: ne jamais exposer le token interne via `VITE_*`. |
| `POWENS_MANUAL_SYNC_COOLDOWN_SECONDS` | api | Optionnel | entier positif | `300` | Cooldown sync manuel. |
| `AUTH_ADMIN_EMAIL` | api | Oui | email valide | ton email admin | Compte unique admin de l'app perso. |
| `AUTH_ADMIN_PASSWORD_HASH_B64` | api | Recommande | base64 UTF-8 du hash admin | hash base64 genere | `pnpm auth:hash-b64` puis copier `AUTH_ADMIN_PASSWORD_HASH_B64=...` dans Dokploy. |
| `AUTH_ADMIN_PASSWORD_HASH` | api | Fallback | hash admin (`pbkdf2$...` ou `$argon2...`) | vide si version B64 utilisee | Fallback direct si la version B64 est absente. |
| `AUTH_PASSWORD_HASH_B64` | api | Legacy fallback | base64 UTF-8 d'un hash legacy | vide | Compatibilite descendante uniquement. |
| `AUTH_PASSWORD_HASH` | api | Legacy fallback | hash legacy (`pbkdf2$...` ou `$argon2...`) | vide | Compatibilite descendante uniquement. |
| `AUTH_SESSION_SECRET` | api | Oui | secret >= 32 bytes (raw/hex/base64/base64url) | secret fort | `openssl rand -base64 48` (ou `openssl rand -hex 32`). |
| `AUTH_SESSION_TTL_DAYS` | api | Optionnel | entier positif | `30` | Duree cookie session. |
| `AUTH_LOGIN_RATE_LIMIT_PER_MIN` | api | Optionnel | entier positif | `5` | Limite brute-force login. |
| `APP_ENCRYPTION_KEY` | api, worker | Oui | 32 bytes exacts (raw/hex/base64) | cle 32 bytes | `openssl rand -hex 32` recommande. |
| `WORKER_HEARTBEAT_MS` | worker | Optionnel | entier positif (ms) | `30000` | Frequence heartbeat worker. |
| `WORKER_HEALTHCHECK_MAX_AGE_MS` | worker | Optionnel | entier positif (ms) | `120000` | Age max heartbeat pour healthcheck. |
| `WORKER_AUTO_SYNC_ENABLED` | worker | Optionnel | `true` ou `false` | `false` | En prod, laisser `false` pour eviter les syncs auto non demandees. |
| `POWENS_SYNC_INTERVAL_MS` | worker | Optionnel | entier positif (ms) | `43200000` | Intervalle sync planifiee (12h). |
| `POWENS_SYNC_MIN_INTERVAL_PROD_MS` | worker | Optionnel | entier positif (ms) | `43200000` | Garde-fou prod sync min. |
| `POWENS_CLIENT_ID` | api, worker | Oui | string non vide | valeur Powens | Depuis dashboard Powens. |
| `POWENS_CLIENT_SECRET` | api, worker | Oui | secret non vide | valeur Powens | Depuis dashboard Powens. |
| `POWENS_BASE_URL` | api, worker | Oui | URL valide | ex `https://your-domain.biapi.pro` | Depuis la config Powens de ton tenant. |
| `POWENS_DOMAIN` | api, worker | Oui | string non vide | domaine Powens | Depuis dashboard Powens. |
| `POWENS_REDIRECT_URI_DEV` | api, worker | Oui | URL valide | `http://localhost:3000/powens/callback` | Requise par validation env, meme en prod. |
| `POWENS_REDIRECT_URI_PROD` | api, worker | Oui (en prod) | URL HTTPS valide | `${APP_URL}/powens/callback` | URL callback enregistre dans Powens. |
| `POWENS_WEBVIEW_BASE_URL` | api, worker | Optionnel | URL valide | `https://webview.powens.com/connect` | Laisser valeur par defaut sauf besoin specifique Powens. |
| `POWENS_WEBVIEW_URL` | api, worker | Optionnel | URL valide | vide | Override complet URL webview si fourni par Powens. |

## 4) Variables non-Dokploy (optionnel)

Si tu utilises encore un trigger API externe Dokploy, garder:

- `DOKPLOY_URL`
- `DOKPLOY_API_KEY`
- `DOKPLOY_COMPOSE_ID` (ou `DOKPLOY_APPLICATION_ID`)

## 4.1) Windows PowerShell - generer `AUTH_ADMIN_PASSWORD_HASH_B64`

Option script repo (recommandee):

```powershell
echo -n "VotreMotDePasse" | pnpm auth:hash-b64
```

Option manuelle depuis un hash existant:

```powershell
$hash = 'pbkdf2$sha256$210000$...'
[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($hash))
```

Validation rapide en logs API (safe):

- definir `LOG_LEVEL=debug`
- redeployer
- verifier une ligne `[api:env] auth password hash resolved` avec:
  - `source` (`AUTH_ADMIN_PASSWORD_HASH_B64` attendu)
  - `hashLength`
  - `hashPrefix` (short preview)

## 5) Checklist Dokploy (une seule fois)

1. Ouvrir ton application Compose dans Dokploy.
2. Verifier que la source GitHub pointe la branche `main`.
3. Coller les variables ci-dessus dans l'onglet Environment.
4. Lancer "Preview Compose" (doit parser sans erreur de variable manquante).
5. Deployer et verifier:
   - `web`, `api`, `worker` en `healthy`
   - `GET /`, `GET /api/health`, `GET /api/db/health`
6. Verifier que le routage public Dokploy pointe uniquement vers `web:3000`.

## 6) Strategie de rollback

- Mode normal: push `main` => build Dokploy => deploy.
- Rollback:
  - revert commit(s) sur `main`
  - push `main`
  - Dokploy rebuild/redeploy automatiquement.
