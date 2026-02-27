# Auth and demo mode

## 1) Objectif

Le projet fonctionne en 2 modes:

- `demo` (par defaut): routes data en mock, actions sensibles bloquees.
- `admin`: acces DB + Powens.

La decision est faite cote API a partir du cookie session signe `finance_os_session`.

## 2) Architecture auth (barriere + session)

L'auth combine 2 mecanismes:

1. Barriere d'acces optionnelle:
   - Header `x-finance-os-access-token`
   - compare a `PRIVATE_ACCESS_TOKEN`
   - si invalide: `401 Unauthorized`
2. Session admin:
   - cookie HttpOnly signe HMAC avec `AUTH_SESSION_SECRET`
   - TTL via `AUTH_SESSION_TTL_DAYS`
   - payload minimal `{ admin: true, iat }`
   - mode resolu cote API dans `ctx.auth.mode` (`demo` ou `admin`)

Important:

- En `development`, `/auth/login`, `/auth/logout` et `/auth/me` restent accessibles sans la barriere header.
- En `production`, si `PRIVATE_ACCESS_TOKEN` est defini, le header est attendu sur toutes les routes API non publiques.

## 3) Endpoints auth

- `POST /auth/login`
  - body: `{ email, password }`
  - verifie email + Argon2 hash (priorite `AUTH_PASSWORD_HASH_B64`, fallback `AUTH_PASSWORD_HASH`)
  - pose le cookie session
- `POST /auth/logout`
  - efface le cookie session
- `GET /auth/me`
  - retourne `{ mode: 'demo' | 'admin' }`
  - `Cache-Control: no-store`

## 4) Variables d'environnement

Variables API:

- `AUTH_ADMIN_EMAIL` (requis)
- `AUTH_PASSWORD_HASH_B64` (recommande, base64 UTF-8 du hash Argon2 PHC)
- `AUTH_PASSWORD_HASH` (fallback compatibilite, utilise uniquement si `AUTH_PASSWORD_HASH_B64` est absent)
- `AUTH_SESSION_SECRET` (requis, 32+ bytes)
- `AUTH_SESSION_TTL_DAYS` (optionnel, defaut `30`)
- `AUTH_LOGIN_RATE_LIMIT_PER_MIN` (optionnel, defaut `5`)
- `PRIVATE_ACCESS_TOKEN` (optionnel, barriere header)

Variables web:

- `VITE_API_BASE_URL` (recommande: `/api`)
- `VITE_PRIVATE_ACCESS_TOKEN` (optionnel, si barriere active)

Voir aussi:

- `.env.example`
- `.env.prod.example`

## 5) Dev local: proxy `/api` et meme origine

En local, le web appelle `/api/*` (proxy Vite/Nitro vers l'API).  
Ce choix evite les problemes de cookies cross-origin et garde `credentials: 'include'` simple et fiable.

## 6) Generer le hash du mot de passe

```bash
echo -n "votre-mot-de-passe" | pnpm auth:hash-b64
```

Copier `AUTH_PASSWORD_HASH_B64=...` dans l'env Dokploy/API.

## 7) Test rapide (demo vs admin)

1. Sans login:
   - ouvrir `/`
   - verifier la banniere demo + actions sensibles desactivees
2. Login admin:
   - aller sur `/login`
   - se connecter avec `AUTH_ADMIN_EMAIL` + mot de passe
   - verifier disparition du mode demo
3. Refresh:
   - rafraichir `/`
   - verifier absence de flash demo avant admin (au pire etat "session en cours")
4. Logout:
   - cliquer `Logout`
   - verifier retour demo
5. Protection:
   - endpoint admin-only sans session -> `401` (pas `500`)

## 8) Checklist nouvelle feature

Quand tu ajoutes une feature:

1. Definir le comportement `demo` (mock/read-only) sur la meme route.
2. Definir le comportement `admin` (data reelle / mutation).
3. Bloquer les actions sensibles cote API et cote UI si `mode !== 'admin'`.
4. Ajouter un test rapide:
   - demo sans cookie
   - admin avec cookie
   - erreur auth attendue (`401/403`, jamais `500`).
