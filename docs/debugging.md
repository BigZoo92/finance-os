# Debugging rapide (prod / Dokploy)

## Depuis le container `web`

```bash
wget -qSO- http://api:3001/health
wget -qSO- http://api:3001/auth/me --header='x-internal-token: <PRIVATE_ACCESS_TOKEN>'
wget -qSO- http://api:3001/debug/auth --header='x-internal-token: <PRIVATE_ACCESS_TOKEN>'
wget -qSO- http://api:3001/debug/health --header='x-internal-token: <PRIVATE_ACCESS_TOKEN>'
```

## Request ID

- API renvoie `x-request-id` sur chaque reponse.
- Les erreurs JSON API incluent aussi `requestId`.
- La page SSR d'erreur affiche `Request ID`.
- Rechercher ce `requestId` dans les logs `web` et `api` Dokploy.

## Verifier mode demo/admin

- `GET /api/auth/me`:
  - `mode: "admin"` => session admin OK
  - `mode: "demo"` => fallback demo
- `GET /api/debug/auth` (interne):
  - `hasSession`, `isAdmin`, `hasInternalToken`, `mode`, `requestId`
