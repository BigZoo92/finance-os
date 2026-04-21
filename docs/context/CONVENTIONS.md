# Finance-OS -- Conventions & Bonnes Pratiques

> **Derniere mise a jour** : 2026-04-10
> **Maintenu par** : agents (Claude, Codex) + humain
> Toute convention ajoutee ou modifiee doit etre refletee ici.

---

## 1. Invariants globaux

Ces regles ne sont **jamais** negociables :

### 1.1 Dual-path demo/admin
- **Chaque feature** doit supporter les deux modes (demo + admin)
- Demo : mocks deterministes, aucun acces DB ni provider, read-only
- Admin : DB + providers derriere cookie session signe
- Aucune lecture/ecriture DB en mode demo
- Aucun appel provider en mode demo
- Les fixtures demo utilisent des personas : student, freelancer, family, retiree

### 1.2 Fail-soft
- Toujours maintenir un fallback utilisable
- Les widgets du dashboard echouent independamment
- Une erreur provider ne bloque pas le rendu du dashboard
- Donnees stale preferees a donnees manquantes
- Messages de fallback explicites pour les etats degrades
- Politique failsoft configurable : ingestion live explicite, lecture cache -> demo

### 1.3 Privacy by design
- **Aucun secret dans les variables `VITE_*`** (exposees au client)
- Tokens chiffres AES-256-GCM at rest
- Secrets jamais logges
- `Cache-Control: no-store` sur les routes sensibles (auth, integrations)
- `x-robots-tag: noindex` en headers

### 1.4 Observabilite obligatoire
- `x-request-id` propage end-to-end (web -> API -> worker)
- Logging JSON structure (jamais de `console.log`)
- Payloads normalises et safe (pas de tokens, pas de PII)
- Metriques collectees (sync counts, API calls, timings)

---

## 2. TypeScript

### 2.1 Configuration
- **`exactOptionalPropertyTypes: true`** -- invariant critique
- Target : ES2023
- Module : ESNext
- Strict mode active

### 2.2 Regle des proprietes optionnelles
```typescript
// CORRECT -- omettre la propriete absente
const obj: { name?: string } = {}

// INCORRECT -- ne jamais passer undefined
const obj: { name?: string } = { name: undefined }
```

### 2.3 Conventions de nommage

| Pattern | Convention | Exemple |
|---|---|---|
| Fichiers route | kebab-case | `connect-url.ts` |
| Fichiers domain | `create-*-use-case.ts` | `create-get-dashboard-summary-use-case.ts` |
| Fichiers repository | `create-*-repository.ts` | `create-dashboard-read-repository.ts` |
| Fichiers service | `create-*-service.ts` | `create-powens-client-service.ts` |
| Runtime | `runtime.ts` | Injection de dependances par route |
| Query options | `*-query-options.ts` | `dashboard-query-options.ts` |
| Adapteurs | `*-adapter.ts` | Ponts entre couches |
| Composants dashboard | `dashboard-*` prefix | `dashboard-health-panel.tsx` |
| Types | `types.ts` par module | Interfaces TypeScript |

---

## 3. Architecture backend (API)

### 3.1 Layering strict

```
Routes (HTTP) -> Domain (orchestration) -> Repositories (persistence) -> Services (providers/helpers)
```

- **Routes** : validation input, auth guards, appel use case, serialisation output
- **Domain** : logique metier pure, use cases, pas d'acces direct DB
- **Repositories** : acces donnees, split demo/real
- **Services** : integration providers externes
- Pour le domaine news: `GET /dashboard/news` et `GET /dashboard/news/context` restent cache-only; seuls `POST /dashboard/news/ingest` et le scheduler worker touchent les providers live.
- Pour le domaine marches: `GET /dashboard/markets/overview`, `/watchlist`, `/macro` et `/context-bundle` restent cache-only; seuls `POST /dashboard/markets/refresh` et le scheduler worker touchent les providers live.
- Les quotes marches doivent garder une provenance explicite (`provider`, `baselineProvider`, `overlayProvider`, `mode`, `delayLabel`, `reason`, `freshnessMinutes`) afin d'eviter tout merge opaque.
- Aucun composant web ne doit appeler directement EODHD, FRED ou Twelve Data.
- Les providers publics soumis a fair-access doivent recevoir un `User-Agent` explicite et des timeouts stricts; le scraping article se limite au `head` HTML.

### 3.2 Dependency injection
Chaque module de routes suit ce pattern :
1. `router.ts` -- setup Elysia, compose les routes
2. `plugin.ts` -- decore le contexte Elysia avec le runtime
3. `runtime.ts` -- cree services, repositories, use cases
4. `routes/` -- handlers individuels
5. `domain/` -- use cases
6. `repositories/` -- acces donnees
7. `services/` -- integrations externes

### 3.3 Pattern demoOrReal
```typescript
demoOrReal(sessionMode, {
  demo: () => demoFixture(),
  real: () => repository.fetchFromDb(),
})
```

### 3.4 Auth guards

| Guard | Quand |
|---|---|
| `requireAdmin` | Mutations, acces donnees reelles |
| `requireAdminOrInternalToken` | Debug endpoints |
| `requireInternalToken` | Metriques, config |

---

## 4. Frontend

### 4.1 SSR-first
- Auth prefetch cote serveur dans le root loader
- Route loaders pour prefetch concurrent des donnees
- `fetchQuery()` pour SSR, `ensureQueryData()` pour concurrent
- Retry : 0 cote serveur, 1 cote client

### 4.2 API calls
- Fonction `apiFetch<T>()` centralisee dans `lib/api.ts`
- Resolution base URL : client (`/api`) vs SSR (`API_INTERNAL_URL`) vs fallback (`APP_ORIGIN`)
- Cookie forwarding en SSR
- `x-request-id` propage
- Fallback path automatique (avec/sans prefixe `/api`)

### 4.3 Query patterns
- Query key factory centralisee (`dashboardQueryKeys.summary(range)`)
- `staleTime: 0` par defaut (donnees toujours fraiches)
- `gcTime: 5 * 60 * 1000` (garbage collect apres 5min)
- Mode-aware queries : options separees pour admin vs demo

### 4.4 State management
- **TanStack Query** : server state (API data)
- **TanStack Store** : micro state local (toasts)
- **URL search params** : filtres persistants (range, query)
- Pas de state management global (Redux, Zustand, etc.)

### 4.5 Composants
- Un composant = un `data-slot`
- Variantes via CVA
- Merge classes via `cn()` (clsx + tailwind-merge)
- Accepter `className` en prop pour customisation
- Composants UI dans `packages/ui/`, composants metier dans `apps/web/src/components/`

---

## 5. UI / UX

### 5.1 Etats obligatoires
Chaque widget/feature doit couvrir :
- Loading (skeleton / "Chargement...")
- Empty (message contextuel muted)
- Success (donnees normales)
- Degraded (donnees stale, badge warning)
- Error (texte destructive, request ID, retry)
- Offline (message "Reseau requis")
- Permission-gated (CTA login pour admin-only)

### 5.2 Coherence auth
- Badge mode visible (Admin active / Mode demo)
- Actions admin desactivees en demo avec feedback
- Pas de flash de contenu auth au chargement
- Transition fluide demo -> admin apres login

### 5.3 Accessibilite
- Focus ring visible : `focus-visible:ring-2 focus-visible:ring-ring/60`
- Etats d'erreur : `aria-invalid:ring-destructive/20`
- Skip link vers contenu principal (sr-only)
- Touch targets minimum 44px sur mobile
- Pas d'animation qui bloque l'interaction

### 5.4 Responsive
- Mobile-first (design pour petit ecran d'abord)
- Sidebar cachee sur mobile, bottom nav
- Tables en scroll horizontal sur mobile
- Grilles progressives (`sm:2`, `lg:2`, `xl:4`)
- Safe area respectee

---

## 6. Securite

### 6.1 Secrets
- **Jamais** de secret dans `VITE_*`
- Tokens provider chiffres AES-256-GCM at rest
- Hash password PBKDF2-SHA256 (210k iterations) ou Argon2 (legacy)
- Session HMAC-SHA256 avec secret minimum 32 bytes
- Comparaisons timing-safe partout

### 6.2 Rate limiting
- Login : 5 tentatives/min/IP (Redis-backed)
- Manual sync : cooldown configurable (Redis slot)
- Pas de rate limiting agressif sur les lectures

### 6.3 CORS
- Origins autorises : WEB_ORIGIN, localhost (dev)
- Headers autorises : Accept, Content-Type, authorization, x-finance-os-access-token, x-internal-token, x-request-id
- Credentials : true

---

## 7. Logging

### 7.1 Format
- JSON structure exclusivement (`@finance-os/prelude`)
- Jamais de `console.log` brut

### 7.2 Champs obligatoires
- `requestId` : UUID trace end-to-end
- `operation` : nom de l'operation
- `duration` : temps d'execution
- `status` : resultat

### 7.3 Ce qui ne doit JAMAIS etre logge
- Tokens d'acces (provider ou session)
- Passwords ou hashes
- Payloads bruts provider
- PII non necessaire

---

## 8. Tests

### 8.1 Strategie
- Tests scope-based : le scope du changement determine les tests a executer
- Pas de coverage obligatoire, mais couverture des chemins critiques
- Tests d'integration preferes aux unit tests isoles pour les flows DB

### 8.2 Verification CI
```bash
pnpm check:ci       # = frozen lockfile + lint + typecheck + test + build, plus desktop only when desktop scope is detected
pnpm check:ci:full  # = force la suite complete, y compris desktop:build
```

### 8.3 Verification manuelle requise (medium-high risk)
- Demo mode : fixtures deterministes, pas de DB, actions desactivees
- Admin mode : auth fonctionne, unauthorized echoue, pas de flash
- Demo/admin parite : meme UI, comportements differents
- Transaction freshness UX
- Health indicators
- PWA install prompt

---

## 9. Deploiement

### 9.1 Release
- **Tag-only** : `git tag vX.Y.Z` declenche le workflow
- Images GHCR immutables (jamais `latest`)
- Compose Dokploy (source Raw, pas de rebuild)

### 9.2 Rollback
- Changer `APP_IMAGE_TAG` vers le tag precedent dans Dokploy
- Ou `workflow_dispatch` avec `release_tag`
- Kill-switch pour desactiver des features sans redeploy

### 9.3 Smoke tests post-deploy
- `/health`, `/auth/me`, `/dashboard/summary`, `/integrations/powens/status`

---

## 10. Conventions agentic (autopilot)

### 10.1 Workflow
- Batch specs 1:1 avec raw bullets (1 spec = 1 bullet)
- Single implementation lane (1 PR a la fois)
- Codex est le writer par defaut sur les branches `agent/impl-*`
- Claude ne write pas en concurrence avec Codex sur la meme branche
- Patch replies sur le thread PR

### 10.2 Branches
- `implement:` PRs -> branches `agent/impl-*`
- Merge-on-green apres landing de fichiers non-stub
- CI failure reportee sur le thread PR

### 10.3 Labels
- `autopilot` : travail automatise
- `autopilot:queued` -> `autopilot:waiting-patch` -> `autopilot:patch-applied` -> `autopilot:ready-to-merge`
- `agent:pm`, `agent:dev`, `agent:review`, `agent:challenger`

---

## 11. Code review

### 11.1 Severites

| Niveau | Scope |
|---|---|
| **P0** | Securite, fuite de secret, violation demo/admin split |
| **P1** | Contrats HTTP, tests manquants, logging unsafe, SSR broken |
| **P2** | Style, cleanup, nommage |

### 11.2 Toujours verifier
- Dual-path correctness (demo ET admin)
- Safety `VITE_*` (pas de secrets)
- Logging safe (pas de tokens/PII)
- Observability wiring (`x-request-id`)
- Evidence de tests
- UI state coverage (loading/empty/error/success)

### 11.3 Ignorer generalement
- Nits de formulation
- Preferences de style
- Suggestions de redesign

---

## 12. GitNexus (Code Intelligence)

### 12.1 Obligations
- **MUST** : `gitnexus_impact` avant d'editer tout symbole
- **MUST** : `gitnexus_detect_changes` avant de commit
- **MUST** : alerter si risk HIGH ou CRITICAL
- **MUST** : `gitnexus_rename` pour les renommages (pas de find-replace)

### 12.2 Index
- 2024 symboles, 4147 relations, 75 execution flows
- Rafraichir apres chaque commit : `npx gitnexus analyze`
- Preserver les embeddings si existants : `--embeddings`
