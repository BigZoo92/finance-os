# Auth and demo mode

## 1) Objectif

Le projet fonctionne en 2 modes:

- `demo` (par defaut): routes data en mock, actions sensibles bloquees.
- `admin`: acces DB + Powens.

La decision est faite cote API a partir du cookie session signe `finance_os_session`.

## 2) Architecture auth (barriere + session)

L'auth combine 2 mecanismes:

1. Barriere d'acces optionnelle:
   - Headers acceptes: `x-internal-token`, `Authorization: Bearer <token>`, compat `x-finance-os-access-token`
   - compare a `PRIVATE_ACCESS_TOKEN`
   - si invalide: `401 Unauthorized`
2. Session admin:
   - cookie HttpOnly signe HMAC avec `AUTH_SESSION_SECRET`
   - TTL via `AUTH_SESSION_TTL_DAYS`
   - payload minimal `{ admin: true, iat }`
   - mode resolu cote API dans `ctx.auth.mode` (`demo` ou `admin`)

Important:

- En `development`, `/auth/login`, `/auth/logout` et `/auth/me` restent accessibles sans la barriere header.
- En `production`, `PRIVATE_ACCESS_TOKEN` est reserve aux appels serveur-a-serveur (SSR/internal tooling), jamais au navigateur.

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
- `PRIVATE_ACCESS_TOKEN` (optionnel, runtime SSR uniquement; ne pas exposer en `VITE_*`)

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

## 9) Onboarding court (demo/admin + installation + notifications + limites hors-ligne)

### A. Installation locale (chemin le plus court)

1. Installer les dependances: `pnpm install --frozen-lockfile`
2. Copier l'env: `cp .env.example .env`
3. Demarrer le web + API (selon votre workflow local, ex. `pnpm dev`)
4. Ouvrir l'app puis verifier que l'etat initial est bien `demo`

### B. Validation rapide du split demo/admin

- `demo` (par defaut):
  - aucune lecture/ecriture DB
  - aucun appel provider
  - donnees deterministes mock uniquement
- `admin` (apres login):
  - DB + providers actives derriere cookie session signe
  - erreurs provider tolerees avec fallback clair (fail-soft)

### C. Notifications (comportement attendu)

- Les notifications push restent **descriptives** et non bloquantes pour les flux coeur produit.
- Si permission navigateur/refus provider: l'UI reste utilisable avec message explicite.
- En mode demo, les chemins notifications doivent rester deterministes (mock), sans effet externe.

### D. Limites hors-ligne (offline)

- Hors-ligne, l'app doit rester navigable autant que possible avec etats de degradation explicites.
- Les actions qui necessitent reseau/provider doivent:
  - afficher une raison claire,
  - proposer une reprise quand la connexion revient,
  - ne jamais casser le parcours principal.

### E. Checklist d'onboarding operateur (5 min)

1. Verifier `/auth/me` retourne `demo` hors session.
2. Passer en `admin` via `/login`, puis reverifier `/auth/me`.
3. Couper le reseau (ou simuler indisponibilite provider) et confirmer le fallback UI.
4. Tester l'opt-in notifications et verifier qu'un echec ne bloque pas le dashboard.
5. Revenir en `demo` via logout et confirmer l'absence d'acces mutation.
