# API Backend Context Pack — Finance-OS

> Auto-generated. Sources: apps/api/AGENTS.md, docs/context/CONVENTIONS.md
> Do not edit directly — regenerate with `pnpm agent:context:pack`

## API Rules

# AGENTS.md - apps/api

Scope: `apps/api/**`

## Local Rules

- Keep [src/index.ts](src/index.ts) as the API composition root. Preserve both bare and `/api` compatibility mounts, request-id propagation, and startup route assertions.
- Keep public `GET /health` and `GET /version` aligned with the shared system contract used by web and worker, including runtime flags such as `safeModeActive`.
- Keep HTTP parsing, validation, status codes, and response shaping in route files such as [src/routes/dashboard/routes/summary.ts](src/routes/dashboard/routes/summary.ts) and [src/routes/integrations/powens/routes/callback.ts](src/routes/integrations/powens/routes/callback.ts).
- Keep orchestration in `domain/`, persistence in `repositories/`, provider and deterministic helpers in `services/`, and wiring in `runtime.ts` plus `plugin.ts`.
- Demo must short-circuit before any DB, Redis, or Powens access. `GET /auth/me` must stay `200`, `Cache-Control: no-store`, and must never hit DB or Powens.
- Keep dashboard summary read models coherent across low-level accounts/connections and the higher-level unified `assets` collection used for patrimoine-style views.
- Keep `/dashboard/derived-recompute` demo-safe on reads, admin/internal-token gated on real execution, and `Cache-Control: no-store` on both status and trigger paths.
- Keep the advisor stack (`/dashboard/advisor`, `/dashboard/advisor/*`, `/dashboard/manual-assets`, persisted runs/artifacts/cost ledger, grounded chat, educational knowledge Q&A, challenger flow, admin-triggered `POST /dashboard/advisor/manual-refresh-and-run`, optional worker-triggered `POST /dashboard/advisor/run-daily`) aligned with `docs/AI-ARCHITECTURE.md` and `docs/AI-SETUP.md`: demo must stay fully deterministic and write-free, admin/internal-token mutations must remain guarded, and GET routes must never trigger live provider work. `GET /dashboard/advisor/knowledge-topics` and `GET /dashboard/advisor/knowledge-answer` stay read-only, log safe retrieval telemetry, and must degrade to browse-only when `AI_KNOWLEDGE_QA_RETRIEVAL_ENABLED=false` or `AI_ADVISOR_FORCE_LOCAL_ONLY=true`.
- Keep the dashboard news pipeline (`/dashboard/news`, `/dashboard/news/context`, `/dashboard/news/ingest`, cache-state semantics, provider health, metadata scraping, dataset fallback) aligned with [../../docs/context/NEWS-FETCH.md](../../docs/context/NEWS-FETCH.md), and update that document whenever this feature changes.
- Keep the dashboard markets pipeline (`/dashboard/markets/overview`, `/dashboard/markets/watchlist`, `/dashboard/markets/macro`, `/dashboard/markets/context-bundle`, `/dashboard/markets/refresh`) aligned with [../../docs/context/MARKETS-MACRO.md](../../docs/context/MARKETS-MACRO.md): demo must stay deterministic, `GET` reads remain cache-only, `POST /refresh` stays admin/internal-token only, and quote provenance/freshness metadata must remain explicit.
- Powens callback must continue to allow either an admin session or a valid signed state. N

## Conventions

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
- **

## Key Constraints

- Bun + Elysia runtime
- Structured logging, secret-safe
- x-request-id propagation
- demo/admin dual-path
- Public traffic proxied from apps/web, not directly exposed
