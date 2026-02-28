# Debugging rapide (prod / Dokploy)

## Depuis le container `web`

```bash
wget -qSO- http://api:3001/health
wget -qSO- http://api:3001/auth/me
wget -qSO- http://api:3001/debug/auth --header='x-internal-token: <PRIVATE_ACCESS_TOKEN>'
wget -qSO- http://api:3001/debug/routes --header='x-finance-os-debug-token: <DEBUG_METRICS_TOKEN>'
```

## Contrats attendus

- `GET /auth/me`:
  - `200` si session admin valide
  - `401` si non authentifie
  - jamais `404`
- `POST /integrations/powens/callback`:
  - `200` si callback traite
  - `401/403` si mode demo/non autorise
  - jamais `404`

## Request ID

- API renvoie `x-request-id` sur chaque reponse.
- Les erreurs JSON API incluent `requestId`.
- La page SSR d'erreur affiche `Request ID`.
- Rechercher ce `requestId` dans les logs `web` et `api` Dokploy.

## Verifier mode demo/admin

- `GET /debug/auth` (token interne requis en prod):
  - `hasSession`, `isAdmin`, `hasInternalToken`, `mode`, `requestId`

## Smoke test rapide

```bash
pnpm smoke:api -- --base=http://api:3001 --internal-token=<PRIVATE_ACCESS_TOKEN>
```

## Local prod-like avec HTTPS

Pour reproduire le comportement prod du cookie admin en local:

```bash
docker compose --env-file .env.prod.local -f docker-compose.prod.yml -f docker-compose.prod.https.yml up -d --build
```

Puis ouvrir:

```text
https://localhost:3443
```

Notes:

- le proxy TLS local est defini dans `docker-compose.prod.https.yml`
- le certificat est emis par Caddy en local (`tls internal`), donc le navigateur peut afficher un avertissement la premiere fois
- sur Windows, `localhost` est plus fiable que `finance-os.localhost` pour la resolution DNS locale
- si tu veux rester en `http://localhost:3000` pour un debug rapide, mets `AUTH_ALLOW_INSECURE_COOKIE_IN_PROD=true` dans `.env.prod.local`
