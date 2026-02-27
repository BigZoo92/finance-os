# Dokploy Environment Variables (finance-os)

## 1) Explication simple

Cette page liste exactement toutes les variables a configurer dans Dokploy pour `docker-compose.prod.yml`.

Objectif:

- eviter les erreurs de preview compose (variables manquantes)
- garder un runtime stable (API/worker refusent de demarrer si secrets invalides)
- rendre le deploiement operable avec une seule configuration initiale

Important:

- Le compose est tolerant aux variables manquantes au parsing (`:-`), donc la preview Dokploy passe.
- La validation stricte se fait au runtime dans `@finance-os/env` (fail-fast si variable invalide).
- `GHCR_IMAGE_NAME` est optionnelle: par defaut `ghcr.io/bigzoo92/finance-os`.

## 2) Explication technique

- Les services `web`, `api`, `worker` sont des images GHCR runtime-only (pas de `build:`).
- L'API/worker valident fortement l'env:
  - URL obligatoires
  - hash Argon2
  - `AUTH_SESSION_SECRET` >= 32 bytes
  - `APP_ENCRYPTION_KEY` = 32 bytes
- Pour Dokploy/Compose, preferer `AUTH_PASSWORD_HASH_B64` pour eviter toute alteration des caracteres `$` du format PHC Argon2.
- Le mode recommande est:
  - `APP_IMAGE_TAG=latest` pour suivre automatiquement les releases tag (`v*`)
  - pin temporaire `APP_IMAGE_TAG=vX.Y.Z` pour rollback

## 3) Variables Dokploy (tableau exhaustif)

| Variable | Service(s) | Obligatoire | Format attendu | Valeur recommandee | Comment obtenir/generer |
| --- | --- | --- | --- | --- | --- |
| `GHCR_IMAGE_NAME` | web, api, worker | Optionnel | `ghcr.io/<owner>/finance-os` | `ghcr.io/bigzoo92/finance-os` | Deduit du remote GitHub actuel (`BigZoo92/finance-os`). |
| `APP_IMAGE_TAG` | web, api, worker | Optionnel | `latest` ou `vX.Y.Z` | `latest` | `latest` pour suivi auto des releases; `vX.Y.Z` pour pin rollback. |
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
| `POWENS_MANUAL_SYNC_COOLDOWN_SECONDS` | api | Optionnel | entier positif | `300` | Cooldown sync manuel. |
| `AUTH_ADMIN_EMAIL` | api | Oui | email valide | ton email admin | Compte unique admin de l'app perso. |
| `AUTH_PASSWORD_HASH_B64` | api | Recommande | base64 UTF-8 du hash Argon2 PHC | hash base64 genere | `pnpm auth:hash-b64` puis copier `AUTH_PASSWORD_HASH_B64=...` dans Dokploy. |
| `AUTH_PASSWORD_HASH` | api | Fallback | hash Argon2 (prefixe `$argon2`) | vide si `AUTH_PASSWORD_HASH_B64` est utilise | Compat legacy seulement; utilise quand `AUTH_PASSWORD_HASH_B64` est absent. |
| `AUTH_SESSION_SECRET` | api | Oui | secret >= 32 bytes (raw/hex/base64/base64url) | secret fort | `openssl rand -base64 48` (ou `openssl rand -hex 32`). |
| `AUTH_SESSION_TTL_DAYS` | api | Optionnel | entier positif | `30` | Duree cookie session. |
| `AUTH_LOGIN_RATE_LIMIT_PER_MIN` | api | Optionnel | entier positif | `5` | Limite brute-force login. |
| `APP_ENCRYPTION_KEY` | api, worker | Oui | 32 bytes exacts (raw/hex/base64) | cle 32 bytes | `openssl rand -hex 32` recommande. |
| `WORKER_HEARTBEAT_MS` | worker | Optionnel | entier positif (ms) | `30000` | Frequence heartbeat worker. |
| `WORKER_HEALTHCHECK_MAX_AGE_MS` | worker | Optionnel | entier positif (ms) | `120000` | Age max heartbeat pour healthcheck. |
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

## 4) Variables non-Dokploy (GitHub Actions)

Ces variables ne vont pas dans Dokploy, mais dans GitHub (Actions release):

- `DOKPLOY_URL` (Secret)
- `DOKPLOY_API_KEY` (Secret)
- `DOKPLOY_COMPOSE_ID` (Secret, recommande)
- `DOKPLOY_APPLICATION_ID` (Secret, fallback)

## 4.1) Windows PowerShell - generer `AUTH_PASSWORD_HASH_B64`

Option script repo (recommandee):

```powershell
echo -n "VotreMotDePasse" | pnpm auth:hash-b64
```

Option manuelle depuis un hash PHC existant:

```powershell
$hash = '$argon2id$v=19$m=65536,t=3,p=1$...'
[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($hash))
```

Validation rapide en logs API (safe):

- definir `LOG_LEVEL=debug`
- redeployer
- verifier une ligne `[api:env] auth password hash resolved` avec:
  - `source` (`AUTH_PASSWORD_HASH_B64` attendu)
  - `hashLength`
  - `hashPrefix` (10 chars max)

## 5) Checklist Dokploy (une seule fois)

1. Ouvrir ton application Compose dans Dokploy.
2. Configurer les credentials registry GHCR (pull prive).
3. Coller les variables ci-dessus dans l'onglet Environment.
4. Verifier `APP_IMAGE_TAG=latest`.
5. Lancer "Preview Compose" (doit parser sans erreur de variable manquante).
6. Deployer et verifier:
   - `web`, `api`, `worker` en `healthy`
   - `GET /`, `GET /api/health`, `GET /api/db/health`

## 6) Strategie `APP_IMAGE_TAG`

- Mode normal (recommande): `APP_IMAGE_TAG=latest`
  - chaque release tag pousse `latest`
  - Dokploy redeploie via API
- Rollback: definir `APP_IMAGE_TAG=vX.Y.Z`, puis redeployer
  - retour explicite et reproductible
  - remettre ensuite `latest` quand stable
