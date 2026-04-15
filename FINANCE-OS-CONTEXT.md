# Finance-OS — Context Pack (single source for external chats)

> **Date de génération** : 2026-04-15
> **But du document** : fournir un contexte complet, autonome et dense sur Finance-OS pour un projet ChatGPT externe.
> **Sources** : agrégation de `DESIGN.md`, `AGENTS.md`, `docs/SKILLS-INVENTORY.md`, et tout le dossier `docs/` (context, frontend, ai, agentic, deployment, auth, mvp, powens).
> **Langue produit** : interface entièrement en français. Documentation interne mixte FR/EN.

---

## Sommaire

1. [Pitch produit & vision](#1-pitch-produit--vision)
2. [Invariants non-négociables](#2-invariants-non-négociables)
3. [Stack technique](#3-stack-technique)
4. [Architecture monorepo](#4-architecture-monorepo)
5. [Architecture par app & package](#5-architecture-par-app--package)
6. [Features métier détaillées](#6-features-métier-détaillées)
7. [Direction artistique (DA)](#7-direction-artistique-da)
8. [Design System](#8-design-system)
9. [Information Architecture & Navigation](#9-information-architecture--navigation)
10. [Motion & Interactions](#10-motion--interactions)
11. [Auth & Demo/Admin](#11-auth--demoadmin)
12. [Conventions & Bonnes Pratiques](#12-conventions--bonnes-pratiques)
13. [Variables d'environnement & Feature Flags](#13-variables-denvironnement--feature-flags)
14. [Services externes](#14-services-externes)
15. [AI Advisor — Architecture, Setup, Coûts, Évals](#15-ai-advisor--architecture-setup-coûts-évals)
16. [Pipeline News (signaux macro-financiers)](#16-pipeline-news-signaux-macro-financiers)
17. [Pipeline Marchés & Macro](#17-pipeline-marchés--macro)
18. [CI/CD & Déploiement](#18-cicd--déploiement)
19. [Workflow Agentic (autopilot)](#19-workflow-agentic-autopilot)
20. [Inventaire complet des Skills installés](#20-inventaire-complet-des-skills-installés)

---

## 1. Pitch produit & vision

**Finance-OS** est une **application de finances personnelles self-hosted, mono-utilisateur**.

- Pas un SaaS, pas un dashboard admin générique : c'est un **cockpit financier privé haut de gamme**.
- Un **OS personnel**, dense mais maîtrisé, élégant et précis.
- Interface entièrement en français.
- Mono-utilisateur : aucune notion de multi-tenancy, de team, ou d'auth multi-comptes.
- Pensé pour un usage quotidien par son propriétaire unique.

### Périmètre fonctionnel

- Agrégation bancaire PSD2 (via Powens) : Fortuneo, Revolut, etc.
- Cockpit dashboard avec patrimoine, dépenses, projections, alertes, objectifs.
- Marchés & Macro : panorama, watchlist mondiale, signaux deterministic.
- News : plateforme cache-first multi-source (HN, GDELT, ECB, Fed, SEC, FRED).
- Conseiller IA (advisor) hybride : moteur déterministe + OpenAI + Anthropic challenger.
- PWA installable, dark mode par défaut, notifications push.

### Hors scope explicite

- Crypto (préparé mais non câblé)
- Multi-utilisateur
- Trading / exécution d'ordres
- Streaming temps réel client-side
- LLM unique qui « lit tout » (toujours grounded sur artefacts persistés)

---

## 2. Invariants non-négociables

Ces règles **ne se négocient jamais**. Elles sont vérifiées à chaque revue.

### 2.1 Dual-path demo / admin
- **Chaque feature** doit supporter les deux modes.
- `demo` (par défaut) : mocks déterministes, **aucune lecture/écriture DB**, **aucun appel provider**, read-only.
- `admin` (post-login) : DB + providers derrière cookie session signé.
- Personas demo : `student`, `freelancer`, `family`, `retiree`.

### 2.2 Fail-soft
- Si Powens ou un provider échoue → l'app reste utilisable avec fallback explicite.
- Widgets dashboard échouent **indépendamment**.
- Données stale > données manquantes.
- Politique configurable : ingestion live explicite séparée, lecture cache → demo.

### 2.3 Privacy by design
- **JAMAIS** de secret dans `VITE_*` (exposées au client).
- Tokens Powens chiffrés AES-256-GCM at rest.
- Codes/tokens Powens jamais loggés.
- `Cache-Control: no-store` sur les routes sensibles.
- `x-robots-tag: noindex` partout.

### 2.4 Observabilité obligatoire
- `x-request-id` propagé end-to-end (web → api → worker).
- Logs JSON structurés (`@finance-os/prelude`), jamais de `console.log`.
- Payloads normalisés, pas de PII.
- Métriques (sync counts, API calls, timings) collectées dans Redis.

### 2.5 TypeScript : `exactOptionalPropertyTypes: true`
- Une propriété optionnelle absente doit **omettre la clé entièrement**.
- **Jamais** assigner `undefined` à une optional property.

### 2.6 Routage public unique
- Public traffic atterrit **uniquement sur `apps/web`**.
- `/api/*` est proxifié en interne vers `API_INTERNAL_URL` (Nitro).
- `apps/api` n'a **pas** de route publique.

### 2.7 Analytics ≠ exécution
- L'analytics est descriptive, jamais une dépendance d'exécution.
- Chaque métrique déclare une source de vérité canonique (table DB, contrat API, fixture demo).
- Hypothèses (fenêtre temporelle, FX, fuseaux, null/default) explicites et versionnées.

### 2.8 Identité visuelle
- Couleur primaire **ambre/or** (`oklch ~75°`) — JAMAIS un bleu SaaS générique.
- Typo : Inter Variable + JetBrains Mono Variable (montants en `.font-financial`).
- Surfaces 3 niveaux : `surface-0` / `surface-1` / `surface-2`.
- Mode dark par défaut, light supporté.
- Couleurs sémantiques pour finances : `positive`, `negative`, `warning` (jamais hardcodées).

### 2.9 News & Marchés : cache-first strict
- `GET /dashboard/news` et `GET /dashboard/markets/*` sont **cache-only**.
- Seuls `POST .../ingest` ou `POST .../refresh` touchent les providers live.
- Aucun composant web ne doit appeler EODHD, FRED, Twelve Data, etc. directement.

---

## 3. Stack technique

### Versions clés
| Outil | Version |
|---|---|
| Node.js | 22.15.0 (SSR via Nitro) |
| Bun | 1.2.22 (API + Worker) |
| pnpm | 10.15.0 |
| TypeScript | strict, ES2023, `exactOptionalPropertyTypes` |
| PostgreSQL | 16-alpine |
| Redis | 7-alpine |

### Frontend (`apps/web`)
| Tech | Rôle |
|---|---|
| React 19 | UI |
| TanStack Start | SSR framework (Nitro) |
| TanStack Router | Routing file-based + loaders |
| TanStack Query | Server state, cache, prefetch SSR |
| TanStack Store | Micro-state local (toasts) |
| Tailwind CSS 4.1 | Utility-first CSS |
| shadcn/ui (style new-york) | Composants UI (Radix headless) |
| CVA | Variants composants |
| Framer Motion v12+ (`motion/react`) | Page transitions, layout animations |
| tw-animate-css | Animations CSS via Tailwind |
| D3.js | Visualisations custom (sparklines, ribbons, heat strips) |
| @t3-oss/env-core | Validation env client |
| Zod 4.1 | Validation schémas |
| Vite | Bundler + dev server |
| Nitro | Server SSR (proxy API, cache) |

### Backend API (`apps/api`)
| Tech | Rôle |
|---|---|
| Bun 1.2+ | Runtime |
| Elysia | HTTP framework TypeScript |
| Drizzle ORM | Query builder type-safe |
| node-redis | Client Redis |
| Cheerio | Extraction metadata `<head>` / OG |
| fast-xml-parser | Parsing RSS/XML institutionnel |
| Zod 4.1 | Validation payloads |

### Worker (`apps/worker`)
| Tech | Rôle |
|---|---|
| Bun 1.2+ | Runtime |
| node-redis | BLPOP consumer (job queue) |
| Drizzle ORM | Accès DB |
| `@finance-os/powens` | Client Powens + crypto |

### Sécurité & Crypto
| Tech | Rôle |
|---|---|
| PBKDF2-SHA256 (210k iter) | Hash password (recommandé) |
| Argon2 | Hash password (legacy via Bun.password) |
| HMAC-SHA256 | Signature session cookie + callback Powens state |
| AES-256-GCM | Chiffrement tokens Powens at rest |

---

## 4. Architecture monorepo

```
finance-os/
  apps/
    web/          # React 19, TanStack Start, Nitro SSR (port 3000)
    api/          # Elysia sur Bun (port 3001, internal only)
    worker/       # Job consumer Bun (port 3002 health localhost)
  packages/
    ui/                # Design system (shadcn/ui + Radix + Tailwind v4)
    db/                # Schema + migrations Drizzle ORM
    env/               # Validation env Zod centralisée
    ai/                # Providers LLM, prompts, schemas, pricing, budget, evals
    finance-engine/    # Moteur déterministe finance/quant
    powens/            # Client Powens HTTP + crypto AES-256-GCM
    redis/             # Wrapper node-redis
    prelude/           # Logger JSON structuré, helpers
    config-ts/         # tsconfig partagés (base, web, server)
  infra/
    docker/            # Dockerfile multi-stage, compose dev
  docs/                # Documentation
  .github/
    workflows/         # CI (ci.yml) + Release (release.yml)
```

### Topologie runtime

```
Browser → (HTTPS) → Web (Nitro SSR :3000)
                       └─ proxy /api/* → API (Elysia :3001, internal)
                                            ├─ PostgreSQL 16
                                            └─ Redis 7
Worker (Bun) ←→ Redis (BLPOP queue) ←→ Powens API
            ├─ POST internal /dashboard/news/ingest
            ├─ POST internal /dashboard/markets/refresh
            └─ POST internal /dashboard/advisor/run-daily
```

**Réseau Docker** : `finance_os_internal` (bridge).
**Volumes** : `postgres_data`, `redis_data`, `worker_run_v2`.
**Domaine public** : un seul domaine pointe vers `web`. L'API n'est pas exposée.

---

## 5. Architecture par app & package

### 5.1 `apps/web` — Frontend

Patterns clés :
- **SSR-first** : auth prefetch dans le root loader, route loaders pour data concurrent.
- **Mode-aware queries** : options séparées admin/demo, fallback demo automatique sur erreur.
- **API client intelligent** (`lib/api.ts`, ~558 lignes) : résolution URL client/SSR/fallback, cookie forwarding, retry, fallback path automatique avec/sans préfixe `/api`.
- **Runtime env** : config injectée dans `window.__FINANCE_OS_PUBLIC_RUNTIME_ENV__` sans rebuild.
- **State** : TanStack Query (server) + TanStack Store (toasts) + URL search params (filtres). Pas de Redux/Zustand.
- **Retry policy** : 0 côté serveur, 1 côté client. `staleTime: 0`, `gcTime: 5min`.

Structure :
```
apps/web/src/
  start.ts                      # Middleware SSR, auth context injection
  router.tsx                    # TanStack Router setup, scroll restoration
  routeTree.gen.ts              # Auto-generated routes
  routes/
    __root.tsx                  # SSR auth prefetch, PWA manifest, dark mode, devtools
    _app.tsx                    # Sidebar + topbar + outlet, page transitions
    _app/{page}.tsx             # Pages applicatives (dashboard, dépenses, etc.)
    login.tsx
    powens/callback.tsx
    health.tsx, healthz.tsx, version.tsx
  features/                     # API, query options, types par domaine
  components/
    shell/                      # topbar, sidebar, command-palette, theme-toggle
    dashboard/                  # 32+ composants spécialisés
    markets/                    # Premium dataviz D3
    ui/                         # d3-sparkline
    pwa-install-prompt.tsx
    toast-viewport.tsx
  lib/
    api.ts                      # apiFetch + apiRequest
    toast-store.ts              # TanStack Store
    public-runtime-env.ts
  env.ts                        # @t3-oss/env-core, validation VITE_*
```

### 5.2 `apps/api` — Backend Elysia/Bun

**Layering strict** :
```
Routes (HTTP in/out)
  → Auth guard (demo/admin/token)
    → Use case (business logic pure)
      → Repository (data access, demoOrReal split)
        → DB (Drizzle) | Redis | Mock fixture
      → Service (provider externe)
```

Pattern par module de routes :
1. `router.ts` — setup Elysia, compose les routes
2. `plugin.ts` — décore le contexte Elysia avec le runtime
3. `runtime.ts` — DI container : crée services, repositories, use cases
4. `routes/` — handlers HTTP individuels
5. `domain/` — use cases (logique métier pure)
6. `repositories/` — accès données (split demo/real)
7. `services/` — intégrations providers externes

Auth guards :
| Guard | Quand |
|---|---|
| `requireAdmin` | Mutations, accès données réelles |
| `requireAdminOrInternalToken` | Debug endpoints |
| `requireInternalToken` | Métriques, config |

Routes enregistrées (toutes en double : `/path` et `/api/path` pour proxy) :
| Préfixe | Routes |
|---|---|
| `/auth` | login, logout, me |
| `/dashboard` | summary, transactions, analytics, goals, news, news/context, markets/{overview,watchlist,macro,context-bundle,refresh}, advisor/{daily-brief,recommendations,runs,assumptions,signals,spend,chat,evals,manual-refresh-and-run,run-daily,relabel-transactions}, manual-assets, derived-recompute |
| `/integrations/powens` | connect-url, callback, sync, status, audit-trail, backlog, sync-runs, diagnostics |
| `/enrichment` | notes, bulk-triage |
| `/notifications/push` | settings, subscription, delivery, send-preview |
| `/debug` | health, auth, config, metrics |
| (système) | `/health`, `/healthz`, `/version` |

Pattern `demoOrReal` :
```typescript
demoOrReal(sessionMode, {
  demo: () => demoFixture(),
  real: () => repository.fetchFromDb(),
})
```

### 5.3 `apps/worker` — Background jobs

Pattern : Redis BLPOP consumer + scheduler optionnel.

```
Boucle principale :
  BLPOP powens:jobs (5s timeout)
  → Acquire Redis lock connection:{id} (TTL 15 min)
  → Decrypt access token (AES-256-GCM)
  → GET /users/me/connections/{id}/accounts
  → Upsert comptes + actifs (transaction SQL unique)
  → GET /accounts/{id}/transactions (paginated, max 500 pages)
  → Upsert transactions (batch 800 lignes)
  → Contrôles intégrité (gap 45j, cohérence comptes)
  → Update statut connexion + métriques Redis
  → Release lock
```

Schedulers (tous **désactivés** par défaut dans la posture recommandée) :
| Scheduler | Flag | Default | Rôle |
|---|---|---|---|
| Powens auto-sync | `WORKER_AUTO_SYNC_ENABLED` | `false` | Enqueue `powens.syncAll` |
| News ingest | `NEWS_AUTO_INGEST_ENABLED` | `true` | POST internal `/dashboard/news/ingest` |
| Market refresh | `MARKET_DATA_AUTO_REFRESH_ENABLED` | `false` | POST internal `/dashboard/markets/refresh` |
| Advisor daily | `AI_DAILY_AUTO_RUN_ENABLED` | `false` | POST internal `/dashboard/advisor/run-daily` |

Heartbeat : `WORKER_HEARTBEAT_MS` (30s par défaut), écrit dans `WORKER_HEALTHCHECK_FILE`.

### 5.4 `packages/db`

Schema-as-code Drizzle, migrations dans `packages/db/drizzle/`.

Tables principales :
| Table | Clé unique | Rôle |
|---|---|---|
| `powens_connection` | `powens_connection_id` | Connexions bancaires, tokens chiffrés, statut sync |
| `financial_account` | `(powens_connection_id, powens_account_id)` | Comptes bancaires |
| `transaction` | `(powens_connection_id, powens_transaction_id)` ou hash | Transactions multi-source |
| `provider_raw_import` | -- | Payloads bruts Powens (audit) |
| `personal_goal` | `id` UUID | Objectifs financiers + snapshots |
| `recurring_commitment` | `id` | Charges fixes / abonnements détectés |
| `recurring_commitment_transaction_link` | -- | Liens commit ↔ transactions |
| `asset` | `id` | Actifs (provider + manuels) |
| `investment_position` | `id` | Positions d'investissement |
| `enrichment_note` | -- | Notes utilisateur par transaction |
| `news_article` | `dedupe_key` | Signal canonique enrichi |
| `news_article_source_ref` | `(provider, provider_article_id)` | Provenance cross-source |
| `news_cache_state` | -- | Singleton cache news |
| `news_provider_state` | `provider` | Health par provider |
| `market_quote_snapshot` | `instrument_id` | Quote canonique par instrument |
| `market_macro_observation` | `(series_id, observation_date)` | Observations FRED |
| `market_cache_state` | -- | Singleton cache marchés |
| `market_provider_state` | `provider` | Health par provider |
| `market_context_bundle_snapshot` | -- | Bundle IA marchés serialisé |
| `derived_recompute_run` | -- | Statut recompute background |
| `ai_run`, `ai_run_step` | -- | Runs advisor |
| `ai_model_usage`, `ai_cost_ledger` | -- | Cost tracking |
| `ai_prompt_template` | -- | Registry prompts |
| `ai_portfolio_snapshot`, `ai_daily_brief`, `ai_recommendation`, `ai_recommendation_challenge` | -- | Artefacts advisor |
| `ai_macro_signal`, `ai_news_signal`, `ai_transaction_label_suggestion` | -- | Signaux + labels |
| `ai_assumption_log`, `ai_chat_thread`, `ai_chat_message` | -- | Grounding chat |
| `ai_eval_case`, `ai_eval_run` | -- | Évaluation |
| `ai_manual_operation`, `ai_manual_operation_step` | -- | Mission manuelle full-refresh |

### 5.5 `packages/powens`

```
client.ts    # createPowensClient() — fetch natif + AbortController + retry
crypto.ts    # encryptString / decryptString — AES-256-GCM, format v1:base64(iv):base64(tag):base64(enc)
jobs.ts      # parsePowensJob / serializePowensJob (Redis)
types.ts     # PowensAccount, PowensTransaction, PowensApiError
```
- Timeout : 30s
- Retry : 2 max sur 408/429/5xx
- Backoff : `250ms * (attempt + 1)`
- Crypto IV : 12 bytes random, Auth Tag : 16 bytes
- Clé AES : `APP_ENCRYPTION_KEY` (32 bytes exact, accepte raw/hex/base64)

### 5.6 `packages/env`

`getApiEnv()` et `getWorkerEnv()` validés strictement par Zod au démarrage. Crash si invalide.
Multi-format password hash supporté (PBKDF2 / Argon2, plain / base64).

### 5.7 `packages/redis`

Wrapper léger autour de `node-redis`. Expose `client`, `connect()`, `ping()`, `close()`.

### 5.8 `packages/ui`

```
packages/ui/
  src/
    styles/globals.css           # Tokens CSS OKLch, themes light/dark, textures, utilities
    components/ui/
      button.tsx                 # 6 variantes × 7 tailles, CVA
      badge.tsx                  # 6 variantes, pill rounded-full
      card.tsx                   # Header/Title/Description/Action/Content/Footer
      input.tsx                  # File support, aria-invalid
      avatar.tsx                 # Radix, image+fallback+badge+group
      separator.tsx
    lib/utils.ts                 # cn() = clsx + tailwind-merge
```

Exports :
```ts
import '@finance-os/ui/styles.css'
import { cn } from '@finance-os/ui/lib/utils'
import { Button, Card, Badge } from '@finance-os/ui/components'
```

### 5.9 `packages/prelude`

```
logger.ts    # JSON structured logger (operation/duration/status/requestId)
version.ts   # Runtime version resolution
health.ts    # Health check builders
errors.ts    # Error serialization helpers
```

### 5.10 `packages/finance-engine`

Moteur déterministe :
- asset-class assumptions, target bands
- TVM formulas, risk proxies, drawdown
- portfolio snapshot, deterministic recommendations
- contribution & cash-opportunity simulators

Outputs : `AdvisorSnapshot`, `DeterministicRecommendation[]`, assumption logs.

### 5.11 `packages/ai`

Providers (OpenAI Responses API, Anthropic Messages API), prompt templates versionnés, JSON schemas, pricing registry (`packages/ai/src/pricing/registry.ts`, version `2026-04-14`), budget policy, default seeded eval cases.

### 5.12 `packages/config-ts`

```
base.json    # ES2023, ESNext, strict, exactOptionalPropertyTypes
web.json     # Extends base + DOM types + React JSX
server.json  # Extends base + Node types
```

---

## 6. Features métier détaillées

### 6.1 Dashboard (Cockpit principal) — route `/`

API : `GET /dashboard/summary?range=7d|30d|90d`

5 sections navigables par ancres :
1. **Vue patrimoine globale** — solde total agrégé, income vs expenses, cashflow directionnel, tendance.
2. **Historique de patrimoine** — Sparkline SVG custom, filtres 7j/14j/tout, indicateurs min/max/dernière, % variation, export SVG/PDF.
3. **Structure des dépenses** — breakdown catégories %, comparaison mensuelle, top 5 groupes.
4. **Alertes et signaux** — alertes personnelles, warnings sync, signaux budgétaires, anomalies (pills bordés).
5. **Range selector** — 7j/30j/90j, persisté en search params (`?range=30d`).

### 6.2 Agrégation bancaire (Powens)

Endpoints : `/integrations/powens/{connect-url,callback,sync,status,audit-trail,backlog,sync-runs,diagnostics}`

Flux connexion :
```
Click "Connecter une banque"
→ GET /integrations/powens/connect-url (génère URL webview + state HMAC)
→ Webview Powens (auth bancaire)
→ POST /integrations/powens/callback
→ Validation signature state, échange code OAuth, chiffrement token AES-256-GCM, stockage DB
→ Enqueue Redis job sync
```

Endpoints Powens utilisés :
- `POST /auth/token/access` (code → access token)
- `GET /users/me/connections/{id}/accounts?all=true`
- `GET /users/me/accounts/{id}/transactions?min_date=...&max_date=...&limit=...&offset=...`

Modes sync :
- **Auto** : scheduler worker (optionnel, recommandé `WORKER_AUTO_SYNC_ENABLED=false`)
- **Manuel** : bouton dashboard avec cooldown 300s par défaut (Redis rate-limit)

Pipeline sync (worker) :
1. BLPOP `powens:jobs`
2. Lock Redis connection (TTL 15 min)
3. Decrypt token
4. Fetch accounts → upsert comptes + actifs (1 transaction SQL)
5. Pour chaque compte : fetch transactions paginées
6. Upsert transactions par batch 800
7. Contrôles intégrité (gaps > 45j, cohérence comptes)
8. Update statut + métriques Redis
9. Release lock

**Sync incrémentale** : watermark `last_success_at` + lookback `POWENS_SYNC_INCREMENTAL_LOOKBACK_DAYS` (7j par défaut, 1-30).
**Full resync** : disponible par connexion (10 ans).

Statuts connexion :
| Statut | Signification |
|---|---|
| `connected` | Active, sync OK |
| `syncing` | En cours |
| `error` | Erreur technique (retry auto) |
| `reconnect_required` | Auth PSD2 expirée → reconnexion webview |

Idempotence :
- Accounts : upsert sur `powens_account_id`
- Transactions : `(connection, txn_id)` (partial unique sur id non-null) sinon `(connection, account, booking_date, amount, label_hash)`

Kill-switches :
- `EXTERNAL_INTEGRATIONS_SAFE_MODE` — désactive toutes les syncs
- `POWENS_SYNC_DISABLED_PROVIDERS` — par provider

### 6.3 Transactions

Endpoints : `GET /dashboard/transactions?range=...&limit=...&cursor=...`, page `/transactions` (legacy hors shell).

- Pagination cursor-based (`bookingDate|id`, sort desc)
- Recherche full-text (label, compte, catégorie, tag)
- Filtre range temporel + infinite scroll

**Catégorisation multi-source** (priorité décroissante) :
1. Override manuel
2. Règles marchand custom
3. Code MCC Powens
4. Inférence par contrepartie
5. Fallback `Unknown - [marchand]`

Chaque transaction expose sa chaîne de résolution ("Why this category?").

Enrichissement :
- Notes utilisateur
- Tags custom (array JSON libre)
- Type de revenu (salaire/récurrent/exceptionnel)
- Override marchand avec historique
- Bulk triage (admin only)

### 6.4 Engagements récurrents

Schema : `recurring_commitment` + `recurring_commitment_transaction_link`.

- Détection auto : charges fixes, abonnements
- Périodicité : hebdo / mensuel / trim / annuel / inconnu
- États : suggéré, validé, rejeté
- Score de confiance, activation/désactivation utilisateur

### 6.5 Objectifs financiers — route `/objectifs`

Endpoints : `GET/POST /dashboard/goals`, `PATCH /dashboard/goals/:id`

- Types : fonds d'urgence, voyage, immobilier, éducation, retraite, custom
- Suivi : montant cible, courant, date cible
- Snapshots de progression horodatés avec notes
- Archivage (`archived_at`)
- UI : barres de progression animées, CRUD admin

### 6.6 Actifs et positions d'investissement — routes `/patrimoine`, `/investissements`

Schema : `asset` + `investment_position`.

- Types actifs : cash, investissement, manuel
- Origines : provider (Powens), saisie manuelle
- Supporte non-bancaires (immobilier, crypto, art...)
- Positions : quantité, coût base, valeur courante, source (minimal/provider/manuel/inconnu)
- Actifs manuels admin : `/dashboard/manual-assets` CRUD (aucun hardcode en admin)

### 6.7 Projections fin de mois
- Jours écoulés/restants
- Revenus/dépenses à date
- Net moyen par jour
- Projection nette fin de mois
- Tableaux charges fixes attendues + revenus attendus

### 6.8 Budgets mensuels par catégorie
- Budget par catégorie pour le mois courant
- Barres de progression dépense vs budget
- Édition admin only

### 6.9 News / signaux macro-financiers — route `/actualites`

Voir [§16](#16-pipeline-news-signaux-macro-financiers) pour le pipeline complet.

### 6.10 Marchés & Macro — route `/marches`

Voir [§17](#17-pipeline-marchés--macro) pour le pipeline complet.

### 6.11 Conseiller IA / Quant

Voir [§15](#15-ai-advisor--architecture-setup-coûts-évals) pour l'architecture complète.

### 6.12 Notifications push

Routes : `/notifications/push/{settings,subscription,delivery,send-preview}`

- Web Push API + clés VAPID
- Opt-in/opt-out utilisateur
- Subscription stockée Redis (endpoint, p256dh, auth, expiration)
- Distinction critique vs régulière
- Dégradation gracieuse si refus permission
- **Delivery réelle non implémentée** : `PUSH_DELIVERY_PROVIDER_URL` non câblé

### 6.13 PWA

- Mode standalone, icônes maskable 192/512
- Theme color `#0b1020`
- Prompt d'installation avec cooldown 7j après refus
- Orientation portrait
- Scope `/`
- **Offline** : dashboard cache + navigation possible, mutations bloquées avec message, indicateurs fraîcheur/dégradation par widget

### 6.14 Derived Recompute

Routes : `GET/POST /dashboard/derived-recompute`

- Recalcul background des classifications + snapshots transactions
- États : Idle/Running/Completed/Failed
- Déclenchement manuel admin
- Flag : `DERIVED_RECOMPUTE_ENABLED`

### 6.15 Export

Implémenté :
- CSV transactions (bouton Ops)
- PDF résumé
- SVG sparkline (chart patrimoine)

Non implémenté (prévu) : relevés PDF, rapport fiscal annuel, bulk download.

### 6.16 Authentification

- Hash : PBKDF2-SHA256 (210k iter) ou Argon2 (legacy)
- Session : cookie HttpOnly signé HMAC-SHA256 (`finance_os_session`)
- TTL : 30 jours par défaut
- Rate limiting : 5 tentatives/min Redis-backed
- Flux : login → validation email vs `AUTH_ADMIN_EMAIL` → vérif hash timing-safe → cookie HttpOnly SameSite=Lax Secure → `/auth/me` retourne `{ mode: 'admin' }`

### 6.17 Health & Observabilité

Endpoints : `/health`, `/healthz`, `/version` (no auth) ; `/debug/health`, `/debug/metrics` (token requis).

Dashboard health :
- Indicateur global
- Badges par widget
- Signaux configurables (`VITE_DASHBOARD_HEALTH_*`)
- Panel diagnostics Powens

**Ops-alerts sidecar** (4 familles d'alertes) :
- Burst 5xx, healthcheck failure, worker heartbeat, disk low
- Webhook configurable (ntfy, Slack, Discord, Mattermost)
- Scoring : `impact (0-5) + confidence (0-3) + recency (0-2)`
- Priorities mappées review : `critical→P0`, `high→P1`, `medium/low→P2`

### 6.18 Matrice des features par mode

| Feature | Demo | Admin |
|---|---|---|
| Dashboard lecture | Mocks déterministes | Données réelles DB |
| Transactions | Fixtures (14 000+) | Cursor-paginated DB |
| Objectifs | Lecture seule | CRUD complet |
| Sync Powens | Désactivée | Active |
| Catégorisation | Lecture seule | Édition |
| Budgets | Lecture seule | Édition |
| News | Fixtures déterministes | Ingestion live + cache enrichi |
| Marchés & Macro | Fixtures déterministes | Cache DB + refresh live |
| Conseiller IA | Mocks déterministes | OpenAI + Anthropic + déterministe |
| Notifications | Désactivées | Actives |
| Export | Non disponible | CSV + PDF |
| Derived recompute | Désactivé | Déclenchement admin |

---

## 7. Direction artistique (DA)

> **Source de vérité** : `DESIGN.md` à la racine + `docs/context/DESIGN-DIRECTION.md`

### 7.1 Vision

Finance-OS est un **cockpit financier personnel haut de gamme**. Pas un dashboard SaaS, pas un tableau admin. C'est un **système vivant, élégant et précis** — l'impression d'un OS personnel, dense mais maîtrisé.

### 7.2 Principes fondateurs

| Principe | Description |
|---|---|
| **Clarté avant densité** | Chaque page compréhensible en quelques secondes. Essentiel d'abord, détail accessible. |
| **Hiérarchie typographique forte** | Taille, poids, espacement créent la hiérarchie — pas les bordures. Montants en `font-financial`. |
| **Respiration intentionnelle** | L'espace blanc guide le regard. `space-y-8` entre sections, `gap-4`-`gap-6` dans les grilles. |
| **Motion qui communique** | Animations pour signaler un changement d'état, jamais pour décorer. |
| **Identité distinctive** | Pas un clone shadcn. Signature ambre/or, surfaces 3 niveaux, accents ASCII. |

### 7.3 Palette de couleurs (OKLch)

Espace **OKLch** (perceptuellement uniforme, idéal pour dark mode).

#### Tokens sémantiques

| Token | Light | Dark |
|---|---|---|
| `--background` | `oklch(0.955 0.008 75)` ivoire chaud | `oklch(0.13 0.015 260)` navy-slate profond |
| `--foreground` | `oklch(0.20 0.02 260)` quasi noir | `oklch(0.93 0.01 80)` blanc chaud |
| `--card` | `oklch(0.98 0.005 80)` | `oklch(0.17 0.015 260)` |
| `--primary` | `oklch(0.65 0.18 75)` ambre/or | `oklch(0.75 0.16 75)` ambre/or clair |
| `--secondary` | `oklch(0.94 0.01 260)` | `oklch(0.22 0.015 260)` |
| `--destructive` | `oklch(0.55 0.22 25)` corail | `oklch(0.65 0.20 25)` corail clair |
| `--border` | `oklch(0.88 0.015 75)` | `oklch(1 0 0 / 8%)` blanc transparent |
| `--ring` | `oklch(0.70 0.16 75)` focus ambre | `oklch(0.75 0.16 75)` |

#### Couleurs financières

| Token | Valeur | Usage |
|---|---|---|
| `--positive` | emerald-500 | Revenus, tendances positives |
| `--negative` | corail (destructive) | Dépenses, tendances négatives |
| `--warning` | amber | Cooldown, alertes modérées |
| `--info` | sky | Sync en cours, infos |

#### Couleur primaire : Ambre/Or

- Hue OKLch ~75°
- **Signature visuelle** de Finance-OS
- Usage : actions primaires, focus rings, états actifs, accents
- **JAMAIS de bleu générique SaaS** comme couleur primaire

#### Palette charts (7 séries)

`chart-1` → `chart-7` : palette harmonieuse basée sur la famille ambre/or, du chaud au froid.

### 7.4 Profondeur de surface (3 niveaux)

| Niveau | Token | Usage |
|---|---|---|
| Surface-0 | `--surface-0` | Arrière-plan page |
| Surface-1 | `--surface-1` | Cartes, contenu |
| Surface-2 | `--surface-2` | Hover, élévé, popovers |

### 7.5 Typographie

| Rôle | Font |
|---|---|
| Corps & titres | **Inter Variable** (`cv11`, `ss01`, `ss03`) |
| Montants financiers | **JetBrains Mono Variable** (`tnum`, `zero`) |
| Display | **Inter Variable** |

```css
.font-financial {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}
```

Échelle :
- `text-xs` (12px), `text-sm` (14px), `text-base` (16px)
- `text-2xl`, `text-3xl`, `text-4xl` pour KPI et grands chiffres
- Poids : `font-medium`, `font-semibold`, `font-bold`

### 7.6 Accents ASCII

Ponctuation visuelle distinctive : `◈ ↔ ◆ △ ◎ ▣ ⊞ ⚙ ♡`

Composants disponibles :
- `AsciiLogo` — logo produit
- `AsciiDivider` — séparateurs (thin/bold)
- `AsciiFrame` — cadre corner
- `AsciiStatusLine` — ligne de statut style terminal
- `SectionGlyph` — glyphe de section

**Règle** : au service de l'interface. **Jamais** de mur ASCII art, jamais au détriment de la lisibilité.

### 7.7 Textures CSS

| Classe | Effet |
|---|---|
| `.texture-scanlines` | Lignes scan retro digital |
| `.texture-grain` | Bruit grain overlay |
| `.bg-grid-dots` | Grille points (sections hero) |
| `.animate-shimmer` | Skeleton premium (remplace `animate-pulse`) |
| `.glow-primary` | Halo premium |
| `.surface-elevated` | Gradient carte élevée |

### 7.8 Theme Dark Mode

- Activation : classe `.dark` sur `<html>`
- **Mode dark par défaut**
- Theme color PWA : `#0b1020`
- **Pas de blanc pur** : fond `oklch(0.13 0.015 260)`, texte `oklch(0.93 0.01 80)` (blanc chaud)
- La sidebar a ses propres tokens

### 7.9 Charts et data-viz

- **D3.js exclusivement** — liberté créative max, pas de recharts/visx
- `D3Sparkline` — sparkline interactive (tooltip, crosshair, gradient area, animation entrée)
- `MiniSparkline` — mini sparkline inline (tableaux, KPI cards)
- `MarketsHeatStrip`, `RelativePerformanceRibbon`, `MacroPulsePanel`, `SignalBoard` — visu marchés
- Courbes en `curveCatmullRom` (smooth, naturel)
- Sparklines viewbox `320×112`, stroke 3px, caps arrondis, couleur `var(--color-chart-2)`
- Tables : montants alignés droite en `font-financial`, couleurs sémantiques

### 7.10 À éviter absolument

- AI slop (gradients arc-en-ciel, glow partout, glassmorphism gratuit)
- Clone SaaS (sidebar 30 items, shadcn default non modifié)
- Surcharge (15 badges/ligne, cartes identiques)
- ASCII forcé (mur ASCII)
- Animations bloquantes (stagger lists, parallax, scroll jacking)
- Blanc pur (`#fff`) en dark
- Couleur primaire bleue
- Emojis dans l'interface (sauf demande explicite)
- Dépendances de visualisation injustifiées

### 7.11 Inspirations / Anti-inspirations

| Inspirations | Anti-inspirations |
|---|---|
| Apple Stocks (transitions claires) | Dribbble-style spectacle |
| Linear (sidebar indicators) | "Everything bounces" |
| Vercel Dashboard (motion restreinte) | Delay chains / shape morphing |

---

## 8. Design System

> **Source de vérité** : `packages/ui/src/styles/globals.css` + `packages/ui/src/components/` + `docs/frontend/design-system.md`

### 8.1 Tokens

#### Couleurs sémantiques
`--background`/`--foreground`, `--card`/`--card-foreground`, `--primary`/`--primary-foreground`, `--secondary`, `--muted`/`--muted-foreground`, `--accent`, `--destructive`, `--border`, `--ring`.

#### Couleurs financières
`--positive`, `--negative`, `--warning`.

#### Surfaces (profondeur)
| Token | Dark | Light | Usage |
|---|---|---|---|
| `surface-0` | `oklch(0.13...)` | `oklch(0.97...)` | Fond page |
| `surface-1` | `oklch(0.17...)` | `oklch(0.99...)` | Éléments dans cartes |
| `surface-2` | `oklch(0.21...)` | `oklch(1 0 0)` | Hover, élevé |

#### Typographie

| Variable | Valeur |
|---|---|
| `--font-sans` | Inter Variable |
| `--font-mono` | JetBrains Mono Variable |
| `--font-display` | Inter Variable |

Classe : `.font-financial` = `font-mono` + `tnum` + `zero`.

#### Espacement (Tailwind 4px base)

- Entre sections : `space-y-8`
- Grilles compactes : `gap-4` ; aérées : `gap-6`
- Padding carte : `p-4` à `p-6`
- Padding page : `px-4 py-6` (mobile) / `px-8` (desktop)

#### Rayon

| Token | Valeur | Usage |
|---|---|---|
| `radius-sm` | `calc(0.625rem - 4px)` | Badges |
| `radius-md` | `calc(0.625rem - 2px)` | Inputs, boutons secondaires |
| `radius-lg` | `0.625rem` (10px, base) | Cartes, boutons principaux |
| `radius-xl` | `calc(0.625rem + 4px)` | Modals, sheets |
| `radius-2xl` | `calc(0.625rem + 10px)` | Bottom sheets mobile |

#### Motion

| Variable | Valeur |
|---|---|
| `--ease-out-expo` | `cubic-bezier(0.16, 1, 0.3, 1)` — entrées rapides |
| `--ease-out-quart` | `cubic-bezier(0.25, 1, 0.5, 1)` — standard |
| `--ease-in-out-quart` | `cubic-bezier(0.76, 0, 0.24, 1)` — symétrique |
| `--ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` — rebond subtil |
| `--duration-fast` | `120ms` — hover |
| `--duration-normal` | `200ms` — standard |
| `--duration-slow` | `350ms` — complexes |
| `--duration-enter` | `250ms` — entrées |
| `--duration-exit` | `180ms` — sorties (plus rapides) |

#### Shadows

| Token | Usage |
|---|---|
| `--shadow-xs` | Subtils |
| `--shadow-sm` | Cards |
| `--shadow-md` | Popovers |
| `--shadow-lg` | Modals |
| `--shadow-glow` | Premium (halo ambre) |

### 8.2 Composants partagés

| Composant | Variantes / Exports |
|---|---|
| Button | 6 variantes × 7 tailles (CVA), `active:scale-[0.97]`, SVG auto-size, focus ring 60% |
| Badge | 6 variantes, `rounded-full`, pills statuts |
| Card | Header / Title / Description / Action / Content / Footer (container queries) |
| Input | File support, `aria-invalid:ring-destructive/20`, `disabled` states |
| Avatar | Image + Fallback + Badge + Group (Radix) |
| Separator | Horizontal / Vertical |

### 8.3 Conventions de composition

1. **Un composant = un `data-slot`** (ciblage CSS fiable, debug)
2. **Variants via CVA** (`class-variance-authority`)
3. **Class merge via `cn()`** (`tailwind-merge` + `clsx`)
4. **Toujours accepter `className`** en prop
5. Attributs data : `data-slot`, `data-variant`, `data-size`

Pattern CVA :
```tsx
const buttonVariants = cva("base-classes", {
  variants: {
    variant: { default: "...", destructive: "...", ghost: "..." },
    size: { default: "h-9 px-4", sm: "h-8 px-3", lg: "h-11 px-6" },
  },
  defaultVariants: { variant: "default", size: "default" },
})
```

### 8.4 Icônes

- **lucide-react** exclusivement
- Sizing via `[&_svg]:size-4` (auto-sizing dans composants)
- Tailles : `size-3` (small), `size-4` (default), `size-5` (large)
- `pointer-events-none` + `shrink-0` sur tous les SVG

### 8.5 Patterns layout

#### Page standard
```tsx
<div className="space-y-8">
  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <h2 className="text-2xl font-semibold tracking-tight">{titre}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
    {/* actions */}
  </div>
  {/* contenu */}
</div>
```

#### KPI Card
```tsx
<Card>
  <CardContent className="p-5">
    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
    <p className="mt-1 font-financial text-2xl font-semibold tracking-tight">{value}</p>
  </CardContent>
</Card>
```

#### Range filter
```tsx
<div className="inline-flex items-center rounded-lg border border-border bg-surface-1 p-1">
  {options.map(option => (
    <button
      className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
        active ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
      }`}
      style={{ transitionDuration: 'var(--duration-fast)' }}
    >{option.label}</button>
  ))}
</div>
```

### 8.6 Responsive

| Breakpoint | Largeur | Usage |
|---|---|---|
| Default | < 768px | Mobile portrait |
| `md:` | 768px | Tablette / desktop étroit |
| `lg:` | 1024px | Desktop — sidebar visible |
| `xl:` | 1280px | Desktop large — grilles 3-4 col |

Règles mobile :
- Bottom navigation 5 pages + drawer "Plus"
- Tables : `overflow-x-auto -mx-6`
- Grilles : `grid-cols-1` → `sm:grid-cols-2` → `xl:grid-cols-3/4`
- Sidebar cachée < `lg:`
- Touch targets min 44px (`py-2.5` + `py-3`)
- `.safe-area-bottom` sur bottom nav (notch iPhone)

### 8.7 États UI obligatoires

Chaque widget doit couvrir :
| État | Pattern |
|---|---|
| Loading | "Chargement…" + skeleton (`animate-pulse rounded bg-muted`) ou `animate-shimmer` |
| Empty | Texte muted centré ("Aucune donnée exploitable", `py-8 text-center`) |
| Success | Données normales |
| Degraded | Données stale + badge warning |
| Error | Texte destructive + request ID + bouton retry |
| Offline | Message "Réseau requis" |
| Permission-gated | Admin-only avec CTA login |

### 8.8 Patterns récurrents

| Pattern | Implémentation |
|---|---|
| Metric cards | Grand chiffre + label + indicateur tendance |
| Status badges | Couleur par état (emerald/amber/sky/destructive) |
| Range selector | Boutons 7j/30j/90j |
| Toast notifications | Fixed bottom-right, titre + description, couleurs sévérité |
| Banners | Pleine largeur, gradient, CTA, role alert |
| PWA install prompt | Fixed bottom-center, cooldown 7j |
| Empty states | Texte muted contextuel |

---

## 9. Information Architecture & Navigation

> **Source** : `docs/frontend/information-architecture.md`

### 9.1 Routes applicatives (sous layout `_app.tsx`)

| Route | Page | Rôle | Données principales |
|---|---|---|---|
| `/` | **Cockpit** | Vue d'ensemble — KPIs, tendance patrimoine, top dépenses, connexions, objectifs | `dashboardSummary`, `financialGoals`, `powensStatus` |
| `/depenses` | **Dépenses** | Transactions, structure dépenses, budgets, projection fin de mois | `dashboardTransactions`, `dashboardSummary` |
| `/patrimoine` | **Patrimoine** | Actifs, historique patrimoine, soldes par connexion, manual-assets admin | `dashboardSummary`, `manualAssets` |
| `/investissements` | **Investissements** | Positions, valorisation, P&L | `dashboardSummary` |
| `/marches` | **Marchés & Macro** | Panorama, macro, watchlist mondiale, signaux, bundle IA | `marketsOverview` |
| `/objectifs` | **Objectifs** | Objectifs financiers (CRUD admin) | `financialGoals` |
| `/actualites` | **Actualités** | Flux news, conseiller IA + bouton mission complète | `dashboardNews`, `dashboardAdvisor` |
| `/integrations` | **Intégrations** | Connexions Powens, sync runs, diagnostics, audit trail | `powensStatus`, `powensSyncRuns`, `powensDiagnostics` |
| `/sante` | **Santé** | Vue consolidée — connexions, sync, diagnostics, derived, push | Tous endpoints status/health |
| `/parametres` | **Paramètres** | Push notifications, derived recompute, exports | `pushSettings`, `derivedRecomputeStatus` |

### 9.2 Routes système (hors layout)

| Route | Rôle |
|---|---|
| `/login` | Auth |
| `/transactions` | Navigateur transactions legacy |
| `/powens/callback` | Callback Powens (SSR) |
| `/health`, `/healthz`, `/version` | System |

### 9.3 Shell

#### Desktop (≥ 1024px)
```
+--sidebar (240px / 68px collapsed)--+--main (max-w-7xl)----+
| Logo                                | Topbar (titre, demo) |
| ◈ Cockpit                           +----------------------+
| ↔ Dépenses                          | Range selector + nav |
| ◆ Patrimoine                        +----------------------+
| △ Investissements                   |                      |
| ◎ Objectifs                         | Sections dashboard   |
| ▣ Actualités                        | (grilles responsives)|
| ⊞ Intégrations                     |                      |
| ⚙ Paramètres                       |                      |
| [Réduire]                           |                      |
+-------------------------------------+----------------------+
```

- Sidebar : 240px → 68px (icônes) via toggle
- Indicateur page actif : `motion layoutId` spring

#### Mobile (< 1024px)
- Topbar (brand, démo, session)
- Bottom navigation 5 pages + "Plus" drawer
- Drawer "Plus" : toutes les 10 pages avec descriptions
- Indicateur actif : barre ambre top du tab
- Safe area respectée

### 9.4 Principes de navigation

1. Chaque page a un **rôle clair** — pas de chevauchement.
2. **Progressive disclosure** : le cockpit montre l'essentiel, les pages dédiées le détail.
3. **URL = état** : filtres (range, etc.) en search params.
4. **Loaders = fraîcheur** : chaque page prefetch dans le loader TanStack.
5. **Fail-soft** : si une query échoue, la page reste utilisable.

### 9.5 Relation entre surfaces

```
                COCKPIT (synthèse)
                     │
        ┌────────────┼────────────┐
   Dépenses     Patrimoine    Investiss.
   (flux)        (stock)      (positions)
        │
   Objectifs   Actualités   Intégrations
  (planning)   (contexte)      (ops)
                                  │
                              Paramètres
                               (config)
```

`Marches & Macro` : surface de contexte exogène, complète `Actualités`. Séparée du cockpit personnel.

### 9.6 Guidelines évolution

**Ajouter une page** :
1. Créer `apps/web/src/routes/_app/{nom}.tsx`
2. Ajouter loader avec prefetch
3. Ajouter dans `NAV_ITEMS` de `AppSidebar`
4. Mettre à jour `docs/frontend/information-architecture.md`
5. Vérifier que la bottom nav mobile reste gérable (max 5 items principaux)

**Ajouter une section au cockpit** :
- Info nécessaire **chaque jour** ?
- Pas de doublon avec page dédiée ?
- Plutôt un **lien** qu'une duplication ?

---

## 10. Motion & Interactions

> **Source** : `docs/frontend/motion-and-interactions.md`

### 10.1 Philosophie

**Le mouvement sert la compréhension, jamais la décoration.** Chaque animation répond à : "qu'est-ce qui vient de changer ?" ou "où suis-je maintenant ?".

### 10.2 Dépendances

- **`motion` (Framer Motion v12+)** — animations complexes (layout, gestures, AnimatePresence)
- **CSS transitions/transforms** — hover, focus, transitions simples
- **CSS keyframes** — animations de page (`page-enter`)

**Règle** : CSS d'abord, `motion` seulement si CSS insuffisant (layout, spring, exit).

### 10.3 Micro-interactions implémentées

#### Sidebar active indicator
```tsx
<motion.div
  layoutId="sidebar-active-indicator"
  className="absolute inset-0 rounded-lg bg-sidebar-accent"
  transition={{ type: 'spring', bounce: 0.15, duration: 0.5 }}
/>
```

#### Mobile tab indicator
```tsx
<motion.div
  layoutId="mobile-tab-indicator"
  className="absolute -top-px left-2 right-2 h-0.5 rounded-full bg-primary"
  transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
/>
```

#### Progress bars (objectifs)
```tsx
<motion.div
  className="h-full rounded-full bg-primary"
  initial={{ width: 0 }}
  animate={{ width: `${progress}%` }}
  transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
/>
```

#### Page enter (CSS)
```css
.page-enter { animation: page-fade-in var(--duration-enter) var(--ease-out-expo); }
@keyframes page-fade-in {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

#### Mobile drawer (bottom sheet)
```tsx
<motion.div
  initial={{ y: '100%' }}
  animate={{ y: 0 }}
  exit={{ y: '100%' }}
  transition={{ type: 'spring', bounce: 0.1, duration: 0.4 }}
/>
```

#### Sidebar collapse
- Transition CSS sur `width` : `var(--duration-slow)` × `var(--ease-out-expo)`
- Chevron : `motion.span` rotation

#### Hover/focus
- Hover : `transition-colors hover:bg-surface-2` + `transitionDuration: var(--duration-fast)`
- Focus : token `--ring` (ambre), `focus-visible:ring-2 focus-visible:ring-ring/60`

### 10.4 Patterns d'états

| État | Pattern |
|---|---|
| Loading | `animate-pulse rounded bg-muted` ou texte "Chargement..." en `text-muted-foreground` |
| Empty | Centré `text-muted-foreground py-8 text-center` |
| Error | `text-destructive` + message, fail-soft (page reste utilisable) |
| Success | Toast `pushToast({ tone: 'success' })` + badge vert |

### 10.5 Contraintes performance

**Règles absolues** :
1. **Jamais de layout animation sur les listes** — `layoutId` réservé aux indicateurs nav (1-2 éléments max)
2. **Préférer `transform` et `opacity`** (animées par GPU sans relayout)
3. **CSS > motion** quand CSS suffit
4. `will-change: auto` — ne pas forcer
5. Aucune animation qui bloque le rendu initial

**Interdit** :
- Animations de listes (stagger entry séquentiel)
- Parallax / scroll-driven effects
- Animations SVG complexes (paths, morphing)
- Auto-play / loops permanents
- Libs autres que `motion` (pas de GSAP, anime.js)
- Scroll-jacking

**Mesure DevTools** : pas de layout thrashing, 60fps stable, main thread < 16ms/frame.

---

## 11. Auth & Demo/Admin

> **Source** : `docs/auth-demo-mode.md`

### 11.1 Architecture

L'auth combine 2 mécanismes :
1. **Barrière d'accès optionnelle** :
   - Headers : `x-internal-token`, `Authorization: Bearer`, compat `x-finance-os-access-token`
   - Comparée à `PRIVATE_ACCESS_TOKEN`
   - Si invalide : `401`
2. **Session admin** :
   - Cookie HttpOnly signé HMAC avec `AUTH_SESSION_SECRET`
   - TTL : `AUTH_SESSION_TTL_DAYS` (30j)
   - Payload minimal : `{ admin: true, iat }`
   - Mode résolu côté API dans `ctx.auth.mode` (`demo` | `admin`)

**Important** :
- En `development`, `/auth/{login,logout,me}` accessibles sans la barrière header.
- En `production`, `PRIVATE_ACCESS_TOKEN` réservé aux appels server-to-server (SSR/internal), JAMAIS au navigateur.

### 11.2 Endpoints

- `POST /auth/login` — body `{ email, password }` → vérifie email + hash (PBKDF2 priorité, Argon2 legacy) → pose cookie session
- `POST /auth/logout` — efface cookie
- `GET /auth/me` — retourne `{ mode: 'demo' | 'admin' }`, `Cache-Control: no-store`

### 11.3 Generation du hash

```bash
echo -n "votre-mot-de-passe" | pnpm auth:hash-b64
```
Copier `AUTH_PASSWORD_HASH_B64=...` dans Dokploy/API env.

### 11.4 Test rapide (5 min)

1. `/auth/me` retourne `demo` hors session
2. Login admin via `/login`, reverif `/auth/me`
3. Couper réseau / simuler indispo provider → fallback UI
4. Tester opt-in notifications → échec ne bloque pas dashboard
5. Logout → retour demo, mutations bloquées

### 11.5 Checklist nouvelle feature

1. Définir comportement `demo` (mock/read-only)
2. Définir comportement `admin` (data réelle / mutation)
3. Bloquer actions sensibles côté API ET UI si `mode !== 'admin'`
4. Tests rapides : demo sans cookie, admin avec cookie, erreur auth `401/403` (jamais `500`)

---

## 12. Conventions & Bonnes Pratiques

> **Source** : `docs/context/CONVENTIONS.md`

### 12.1 TypeScript

- Target `ES2023`, module `ESNext`, strict, `exactOptionalPropertyTypes: true`
- Optional property absente → **omettre la clé** :
```typescript
// ✅ CORRECT
const obj: { name?: string } = {}
// ❌ INCORRECT
const obj: { name?: string } = { name: undefined }
```

### 12.2 Conventions de nommage

| Pattern | Convention | Exemple |
|---|---|---|
| Fichiers route | kebab-case | `connect-url.ts` |
| Fichiers domain | `create-*-use-case.ts` | `create-get-dashboard-summary-use-case.ts` |
| Fichiers repository | `create-*-repository.ts` | `create-dashboard-read-repository.ts` |
| Fichiers service | `create-*-service.ts` | `create-powens-client-service.ts` |
| Runtime | `runtime.ts` | DI par route |
| Query options | `*-query-options.ts` | `dashboard-query-options.ts` |
| Adapteurs | `*-adapter.ts` | Ponts entre couches |
| Composants dashboard | `dashboard-*` prefix | `dashboard-health-panel.tsx` |
| Types | `types.ts` par module | -- |

### 12.3 Backend (API)

- Layering strict (Routes → Domain → Repositories → Services)
- News : `GET /dashboard/news` cache-only, `POST .../ingest` seul live
- Markets : `GET /dashboard/markets/*` cache-only, `POST .../refresh` seul live
- Quotes marchés : provenance explicite (`provider`, `baselineProvider`, `overlayProvider`, `mode`, `delayLabel`, `reason`, `freshnessMinutes`)
- **Aucun composant web ne doit appeler EODHD/FRED/Twelve Data directement**
- Providers fair-access : `User-Agent` explicite + timeouts stricts ; scraping article limité au `head` HTML

### 12.4 Frontend

- **SSR-first** : auth prefetch root loader, route loaders pour data concurrent
- `fetchQuery()` SSR, `ensureQueryData()` concurrent
- Retry : 0 server, 1 client
- API calls : `apiFetch<T>()` centralisé dans `lib/api.ts`
- Resolution base URL : client (`/api`) vs SSR (`API_INTERNAL_URL`) vs fallback (`APP_ORIGIN`)
- Cookie forwarding SSR, `x-request-id` propagé, fallback path automatique
- Query keys via factory centralisée (`dashboardQueryKeys.summary(range)`)
- `staleTime: 0`, `gcTime: 5 * 60 * 1000`
- Mode-aware queries séparées admin/demo
- State : TanStack Query (server) + TanStack Store (toasts) + URL search params (filtres). **Pas** de Redux/Zustand global.

### 12.5 Sécurité

- **Jamais** de secret dans `VITE_*`
- Tokens chiffrés AES-256-GCM at rest
- Hash password PBKDF2-SHA256 (210k iter) ou Argon2
- Session HMAC-SHA256 (secret min 32 bytes)
- Comparaisons timing-safe partout
- Rate limiting login : 5/min/IP (Redis)
- Manual sync : cooldown configurable (Redis slot)
- CORS : origins WEB_ORIGIN + localhost (dev), credentials true
- Headers autorisés : Accept, Content-Type, authorization, x-finance-os-access-token, x-internal-token, x-request-id

### 12.6 Logging

- JSON structuré exclusivement (`@finance-os/prelude`)
- Champs obligatoires : `requestId`, `operation`, `duration`, `status`
- **JAMAIS logger** : tokens (provider/session), passwords/hashes, payloads bruts provider, PII non nécessaire

### 12.7 Tests

- Scope-based : le scope du changement détermine les tests
- Pas de coverage obligatoire, mais chemins critiques couverts
- Tests d'intégration > unit isolés pour flows DB
- CI : `pnpm check:ci` (frozen lockfile + lint + typecheck + test + build)

Vérification manuelle requise (medium-high risk) :
- Demo : fixtures déterministes, pas de DB, actions désactivées
- Admin : auth fonctionne, unauthorized échoue, pas de flash
- Demo/admin parité : même UI, comportements différents
- Transaction freshness UX, health indicators, PWA install prompt

### 12.8 Code review

| Niveau | Scope |
|---|---|
| **P0** | Sécurité, fuite secret, violation demo/admin split |
| **P1** | Contrats HTTP, tests manquants, logging unsafe, SSR broken |
| **P2** | Style, cleanup, naming |

Toujours vérifier :
- Dual-path correctness (demo ET admin)
- Safety `VITE_*` (pas de secrets)
- Logging safe (pas de tokens/PII)
- Observability wiring (`x-request-id`)
- Evidence de tests
- UI state coverage (loading/empty/error/success)

### 12.9 Ops alert quality

- Priorities explicites : `critical→P0`, `high→P1`, `medium/low→P2`
- Scoring transparent additif : `impact (0-5) + confidence (0-3) + recency (0-2)`, score final dans docs/PR
- Anti-noise : déduplication par fingerprint, suppression repeats dans cooldown, état-change > interval spam
- Digests decision-first : top actionable items (priority, score, owner, next step), tail informatif collapse

### 12.10 Analytics

- Descriptive telemetry, jamais une dependency d'exécution
- Chaque métrique déclare une SoT canonique (DB table/view, contrat API, fixture demo)
- Source-of-truth graphs : provenance amont + consommateurs aval
- Hypothèses explicites versionnées : fenêtres temporelles, freshness SLOs, sampling, FX, timezone, null/default
- Données delayed/missing/inconsistent → fail soft avec fallback UI clair
- Demo : déterministe, mock-backed
- Admin : live providers OK mais split demo/admin explicite

---

## 13. Variables d'environnement & Feature Flags

> **Source** : `docs/context/ENV-REFERENCE.md`

Tableau condensé. Voir source pour défauts et descriptions complètes.

### 13.1 Runtime & Déploiement
`NODE_ENV`, `TZ`, `APP_VERSION`, `APP_COMMIT_SHA`, `LOG_LEVEL` (`info`), `APP_DEBUG`

### 13.2 Serveurs
`WEB_PORT` (3000), `NITRO_HOST` (`0.0.0.0`), `NITRO_PORT` (3000), `API_HOST`, `API_PORT` (3001), `API_URL`, `API_INTERNAL_URL` (`http://finance-os-api:3001`), `APP_URL`, `WEB_URL`, `WEB_ORIGIN`

### 13.3 Database
`DATABASE_URL` 🔒, `POSTGRES_DB` (`finance_os`), `POSTGRES_USER`, `POSTGRES_PASSWORD` 🔒, `POSTGRES_PORT`, `DRIZZLE_MIGRATIONS_FOLDER`, `RUN_DB_MIGRATIONS` (`true`)

### 13.4 Redis
`REDIS_URL` (`redis://localhost:6379`), `REDIS_PORT`

### 13.5 Auth
`AUTH_ADMIN_EMAIL`, `AUTH_ADMIN_PASSWORD_HASH_B64` 🔒, `AUTH_ADMIN_PASSWORD_HASH` 🔒, `AUTH_SESSION_SECRET` 🔒 (`openssl rand -base64 48`, min 32 bytes), `AUTH_SESSION_TTL_DAYS` (30), `AUTH_LOGIN_RATE_LIMIT_PER_MIN` (5)

Priorité hash : `AUTH_ADMIN_PASSWORD_HASH_B64` > `AUTH_ADMIN_PASSWORD_HASH` > `AUTH_PASSWORD_HASH_B64` (legacy) > `AUTH_PASSWORD_HASH` (legacy).
Formats supportés : `pbkdf2$sha256$...` (recommandé) ou `$argon2...` (legacy).

### 13.6 Sécurité & Tokens
- `PRIVATE_ACCESS_TOKEN` 🔒 (`openssl rand -base64 24`, min 12 chars) — server-to-server, headers `Authorization: Bearer` / `x-internal-token` / `x-finance-os-access-token`
- `DEBUG_METRICS_TOKEN` 🔒 (`openssl rand -base64 24`)
- `APP_ENCRYPTION_KEY` 🔒 (`openssl rand -hex 32` → 32 bytes exact, accepte raw/hex/base64) — AES-256-GCM tokens Powens

### 13.7 Powens
`POWENS_CLIENT_ID` 🔒, `POWENS_CLIENT_SECRET` 🔒, `POWENS_BASE_URL` (ex: `https://xxx-sandbox.biapi.pro`), `POWENS_DOMAIN`, `POWENS_REDIRECT_URI_DEV` (`http://localhost:3000/powens/callback`), `POWENS_REDIRECT_URI_PROD`, `POWENS_WEBVIEW_BASE_URL` (`https://webview.powens.com/connect`), `POWENS_WEBVIEW_URL`

Tuning sync :
- `POWENS_MANUAL_SYNC_COOLDOWN_SECONDS` (300)
- `POWENS_SYNC_INTERVAL_MS` (43 200 000 = 12h)
- `POWENS_SYNC_MIN_INTERVAL_PROD_MS` (12h, hard min prod)
- `POWENS_SYNC_INCREMENTAL_LOOKBACK_DAYS` (7, range 1-30)
- `POWENS_FORCE_FULL_SYNC` (`false`)
- `POWENS_SYNC_DISABLED_PROVIDERS` (CSV)

### 13.8 Worker
- `WORKER_HEARTBEAT_MS` (30 000)
- `WORKER_HEALTHCHECK_FILE` (`/tmp/worker-heartbeat`)
- `WORKER_HEALTHCHECK_MAX_AGE_MS` (120 000)
- `WORKER_AUTO_SYNC_ENABLED` (`false` recommandé)
- `NEWS_AUTO_INGEST_ENABLED` (`true` default, `false` recommandé manuel-first)
- `NEWS_FETCH_INTERVAL_MS` (14 400 000 = 4h)
- `MARKET_DATA_AUTO_REFRESH_ENABLED` (`false`)
- `MARKET_DATA_REFRESH_INTERVAL_MS` (21 600 000 = 6h)

### 13.9 Feature Flags Backend (extrait)

| Flag | Default | Description |
|---|---|---|
| `SYNC_STATUS_PERSISTENCE_ENABLED` | `true` | Persister statut sync OK/KO |
| `POWENS_DIAGNOSTICS_ENABLED` | `true` | Diagnostics Powens |
| `TRANSACTIONS_SNAPSHOT_FIRST_ENABLED` | `true` | Snapshot transactions en premier |
| `TRANSACTIONS_SNAPSHOT_STALE_AFTER_MINUTES` | `30` | Seuil fraîcheur snapshot |
| `POWENS_REFRESH_BACKGROUND_ENABLED` | `true` | Refresh bg Powens |
| `DEMO_DATASET_STRATEGY` | `v1` | Dataset demo (legacy/minimal/v1) |
| `DEMO_PERSONA_MATCHING_ENABLED` | `true` | Matching persona demo |
| `DERIVED_RECOMPUTE_ENABLED` | `true` | Pipeline recompute |
| `ENRICHMENT_BULK_TRIAGE_ENABLED` | `true` | Bulk triage enrichment |
| `EXTERNAL_INTEGRATIONS_SAFE_MODE` | `false` | **Kill-switch global Powens** |
| `LIVE_NEWS_INGESTION_ENABLED` | `true` | Ingestion news live |
| `NEWS_AI_CONTEXT_BUNDLE_ENABLED` | `true` | Bundle de contexte IA cache-only |
| `NEWS_MAX_PROVIDER_ITEMS_PER_RUN` | `20` | Cap par provider/run |
| `NEWS_METADATA_FETCH_ENABLED` | `true` | Scraping metadata article |
| `NEWS_METADATA_FETCH_TIMEOUT_MS` | `2500` | Timeout scraping |
| `NEWS_METADATA_FETCH_MAX_BYTES` | `131072` | Taille max head HTML |
| `NEWS_SCRAPER_USER_AGENT` | `finance-os-news/1.0 (+APP_URL)` | UA scraper |
| `SEC_USER_AGENT` | = scraper UA | UA pour SEC (signature produit/contact requise prod) |
| `DASHBOARD_NEWS_FORCE_FIXTURE_FALLBACK` | `false` | Kill-switch debug news admin |

### 13.10 News providers
`NEWS_PROVIDER_HN_ENABLED`, `NEWS_PROVIDER_HN_QUERY`, `NEWS_PROVIDER_GDELT_ENABLED`, `NEWS_PROVIDER_GDELT_QUERY`, `NEWS_PROVIDER_ECB_RSS_ENABLED`, `NEWS_PROVIDER_ECB_RSS_FEED_URLS`, `NEWS_PROVIDER_ECB_DATA_ENABLED` (`false`), `NEWS_PROVIDER_ECB_DATA_SERIES_KEYS`, `NEWS_PROVIDER_FED_ENABLED`, `NEWS_PROVIDER_FED_FEED_URLS`, `NEWS_PROVIDER_SEC_ENABLED`, `NEWS_PROVIDER_SEC_TICKERS` (`AAPL,MSFT,NVDA,AMZN,GOOGL,META,TSLA`), `NEWS_PROVIDER_FRED_ENABLED` (`false`), `NEWS_PROVIDER_FRED_SERIES_IDS` (`FEDFUNDS,CPIAUCSL,UNRATE,DGS10`), `FRED_API_KEY`

### 13.11 Market data
`MARKET_DATA_ENABLED` (`true`), `MARKET_DATA_REFRESH_ENABLED` (`true`), `MARKET_DATA_EODHD_ENABLED` (`true`), `MARKET_DATA_TWELVEDATA_ENABLED` (`true`), `MARKET_DATA_FRED_ENABLED` (`true`), `MARKET_DATA_US_FRESH_OVERLAY_ENABLED` (`true`), `MARKET_DATA_FORCE_FIXTURE_FALLBACK` (`false`), `MARKET_DATA_STALE_AFTER_MINUTES` (960), `MARKET_DATA_DEFAULT_WATCHLIST_IDS`, `MARKET_DATA_FRED_SERIES_IDS` (`FEDFUNDS,SOFR,DGS2,DGS10,T10Y2Y,CPIAUCSL,UNRATE`), `EODHD_API_KEY` 🔒, `TWELVEDATA_API_KEY` 🔒, `FRED_API_KEY` (partagé news + markets)

### 13.12 Failsoft policy
`FAILSOFT_POLICY_ENABLED` (`true`), `FAILSOFT_SOURCE_ORDER` (`live,cache,demo`), `FAILSOFT_ALERTS_ENABLED` (`true`), `FAILSOFT_NEWS_ENABLED` (`true`), `FAILSOFT_INSIGHTS_ENABLED` (`true`)

### 13.13 AI Advisor / LLM (server only)

`AI_ADVISOR_ENABLED` (`true`), `AI_ADVISOR_ADMIN_ONLY` (`true` recommandé), `AI_ADVISOR_FORCE_LOCAL_ONLY` (`false`), `AI_CHAT_ENABLED`, `AI_CHALLENGER_ENABLED`, `AI_RELABEL_ENABLED`

`AI_OPENAI_API_KEY` 🔒, `AI_OPENAI_BASE_URL`, `AI_OPENAI_CLASSIFIER_MODEL` (`gpt-5.4-nano`), `AI_OPENAI_DAILY_MODEL` (`gpt-5.4-mini`), `AI_OPENAI_DEEP_MODEL` (`gpt-5.4`)

`AI_ANTHROPIC_API_KEY` 🔒, `AI_ANTHROPIC_BASE_URL`, `AI_ANTHROPIC_CHALLENGER_MODEL` (`claude-sonnet-4-6`)

Budgets / cost :
- `AI_USD_TO_EUR_RATE` (`0.92`)
- `AI_BUDGET_DAILY_USD` (`2`), `AI_BUDGET_MONTHLY_USD` (`40`)
- `AI_BUDGET_DISABLE_CHALLENGER_RATIO` (`0.75`), `AI_BUDGET_DISABLE_DEEP_ANALYSIS_RATIO` (`0.5`)
- `AI_SPEND_ALERT_DAILY_THRESHOLD_PCT` (`0.8`), `AI_SPEND_ALERT_MONTHLY_THRESHOLD_PCT` (`0.8`)
- `AI_MAX_CHAT_MESSAGES_CONTEXT` (`8`)

Worker scheduler :
- `AI_DAILY_AUTO_RUN_ENABLED` (`false` recommandé)
- `AI_DAILY_INTERVAL_MS` (`86 400 000` = 24h)

### 13.14 Frontend / Vite (⚠️ exposées au client, pas de secret)

- `VITE_APP_TITLE` (`Finance OS`), `VITE_APP_ORIGIN`, `VITE_API_BASE_URL` (`/api`)
- `VITE_POWENS_SYNC_COOLDOWN_UI_ENABLED` (`true`), `VITE_POWENS_SYNC_COOLDOWN_UI_SECONDS` (`300`)
- `VITE_DASHBOARD_HEALTH_SIGNALS_ENABLED` (`true`), `VITE_DASHBOARD_HEALTH_GLOBAL_INDICATOR_ENABLED` (`true`), `VITE_DASHBOARD_HEALTH_WIDGET_BADGES_ENABLED` (`true`)
- `VITE_UI_RECONNECT_BANNER_ENABLED`
- `VITE_PWA_NOTIFICATIONS_ENABLED`, `VITE_PWA_CRITICAL_ENABLED`
- `VITE_AI_ADVISOR_ENABLED`, `VITE_AI_ADVISOR_ADMIN_ONLY` (`true` recommandé)

### 13.15 Push Notifications
`PWA_NOTIFICATIONS_ENABLED` (`true`), `PWA_CRITICAL_ENABLED` (`true`), `PUSH_DELIVERY_PROVIDER_URL`, `PUSH_VAPID_PUBLIC_KEY`, `PUSH_VAPID_PRIVATE_KEY` 🔒 (générés via `npx web-push generate-vapid-keys`)

### 13.16 Monitoring & Alertes (ops-alerts sidecar)
`ALERTS_ENABLED` (`false`), `ALERTS_WEBHOOK_URL`, `ALERTS_WEBHOOK_HEADERS_JSON`, `ALERTS_POLL_INTERVAL_MS` (30 000), `ALERTS_HTTP_TIMEOUT_MS` (5000), `ALERTS_5XX_THRESHOLD` (3), `ALERTS_5XX_WINDOW_MS` (300 000), `ALERTS_5XX_PROBE_URLS`, `ALERTS_HEALTHCHECK_FAILURE_THRESHOLD` (2), `ALERTS_HEALTHCHECK_URLS`, `ALERTS_WORKER_HEARTBEAT_FILE`, `ALERTS_WORKER_STALE_AFTER_MS` (120 000), `ALERTS_DISK_FREE_PERCENT_THRESHOLD` (10), `ALERTS_DISK_PATHS`

### 13.17 Docker Build
`NODE_VERSION` (`22.15.0`), `BUN_VERSION` (`1.2.22`), `PNPM_VERSION` (`10.15.0`), `GIT_SHA`, `GIT_TAG`, `BUILD_TIME`

### 13.18 Docker Compose
`GHCR_IMAGE_NAME` (ex: `ghcr.io/bigzoo92/finance-os`), `APP_IMAGE_TAG` (ex: `v1.2.3`, **jamais `latest`**), `PROXY_HTTP_PORT` (3080), `PROXY_HTTPS_PORT` (3443)

### 13.19 GitHub Actions

**Secrets** : `GHCR_TOKEN`, `DOKPLOY_API_KEY`
**Variables** : `GHCR_IMAGE_NAME`, `DOKPLOY_URL`, `DOKPLOY_COMPOSE_ID`, `NODE_VERSION`, `BUN_VERSION`, `PNPM_VERSION`, toutes les `VITE_*`

### 13.20 Validation

Validation Zod stricte au démarrage :
- API : `packages/env/src/index.ts` → `getApiEnv()`
- Worker : `packages/env/src/index.ts` → `getWorkerEnv()`
- Web : `apps/web/src/env.ts` → `@t3-oss/env-core`

Erreurs = crash au démarrage avec message explicite.

---

## 14. Services externes

> **Source** : `docs/context/EXTERNAL-SERVICES.md`

### 14.1 Powens (Agrégation bancaire)

| Détail | Valeur |
|---|---|
| Type | API REST + OAuth2 |
| Rôle | Agrégation comptes/transactions PSD2 |
| Base URL | `POWENS_BASE_URL` (ex: `https://xxx-sandbox.biapi.pro`) |
| Auth | OAuth2 Code Grant + Client Credentials |
| Package interne | `@finance-os/powens` |
| Consommateurs | API (callback, connect-url), Worker (sync) |
| Dashboard | https://console.powens.com |

Endpoints utilisés :
- `POST /auth/token/access` — code → access token
- `GET /users/me/connections/{id}/accounts?all=true`
- `GET /users/me/accounts/{id}/transactions?min_date=...&max_date=...&limit=...&offset=...`

Sécurité : Client ID/Secret jamais côté client, access tokens AES-256-GCM at rest, callback state HMAC-SHA256 TTL 10min, retry 2 max sur 408/429/5xx (backoff `250ms × attempt`), timeout 30s.

### 14.2 News backbone (cache-first)

| Provider | ID | Auth | Rôle |
|---|---|---|---|
| Hacker News Algolia | `hn_algolia` | aucune | Tech / startup / AI / internet finance |
| GDELT DOC 2.0 | `gdelt_doc` | aucune | Media global / géopolitique / macro |
| ECB RSS | `ecb_rss` | aucune | Press releases, speeches, publications |
| ECB Data Portal | `ecb_data` | aucune | Series macro structurées (off par défaut) |
| Federal Reserve RSS | `fed_rss` | aucune | Monetary policy, speeches |
| SEC EDGAR / data.sec.gov | `sec_edgar` | UA explicite requis | Filings primaires, watchlist corporate |
| FRED | `fred` | `FRED_API_KEY` | Series macro (rates, CPI, jobs, yields) |

URLs typiques : voir `docs/context/EXTERNAL-SERVICES.md` §2.

Open Graph / metadata article : fetch HTML head only, timeout strict, max bytes strict, pas de headless browser. Champs extraits : `<title>`, meta description, canonical, OG, twitter card, favicon, JSON-LD `Article`/`NewsArticle`.

### 14.3 Market backbone (cache-first)

| Provider | Auth | Rôle |
|---|---|---|
| EODHD | `EODHD_API_KEY` | Baseline global EOD/différé (free: 20 calls/jour, 1 an EOD) |
| Twelve Data | `TWELVEDATA_API_KEY` | Overlay optionnel symboles US frais (Basic: 8 credits/min, 800/jour) |
| FRED | `FRED_API_KEY` | Series macro officielles |

Stratégie merge :
- EODHD = baseline quote
- Twelve Data écrase qu'un symbole US explicitement éligible avec quote exploitable + lecture plus fraîche
- FRED = macro uniquement
- Chaque quote persiste : `provider`, `baseline_provider`, `overlay_provider`, `source_mode` (eod/delayed/intraday), `source_delay_label`, `source_reason`, `quote_as_of`, `captured_at`
- `GET /dashboard/markets/*` ne touche jamais providers live

Limites assumées :
- Pas de crypto
- Indices globaux représentés par ETF proxies si mapping cash gratuit fragile
- Données EOD/différées affichées comme telles, sans ambiguité

### 14.4 Web Push

| Détail | Valeur |
|---|---|
| Type | Web Push API (RFC 8030) |
| Auth | VAPID |
| Stockage | Redis (endpoint, p256dh, auth, expiration) |
| Delivery | **Non implémentée** : `PUSH_DELIVERY_PROVIDER_URL` non câblé |

### 14.5 LLM Providers

**OpenAI** : transaction relabeling, daily brief, grounded chat. Client `packages/ai/src/providers/openai-responses-client.ts`.
**Anthropic Claude** : challenger / contre-analyse. Client `packages/ai/src/providers/anthropic-messages-client.ts`.

Gouvernance :
- Aucun secret LLM côté client
- Prix versionnés `packages/ai/src/pricing/registry.ts`
- Usages/coûts tracés `ai_model_usage` + `ai_cost_ledger`
- Mode recommandé : manuel-first via `/dashboard/advisor/manual-refresh-and-run`

Préparés non activés : Gemma/local on-prem, Twitter/X ingestion, crypto.

### 14.6 GHCR — GitHub Container Registry

URL : `ghcr.io/bigzoo92/finance-os`
Auth : `GHCR_TOKEN`
Usage : 3 images par release (`web`, `api`, `worker`), tags `vX.Y.Z` + `sha-<commit>`, **immutables**, jamais `latest`.

### 14.7 GitHub Actions

Workflows :
- `ci.yml` — push main, PRs, workflow_call : frozen lockfile install → lint → typecheck → test → build
- `release.yml` — tag `v*`, manual dispatch : CI rerun → Docker build multi-stage → Push GHCR → Sync Dokploy → Deploy → Smoke tests

### 14.8 Dokploy

Type : Orchestrateur Docker Compose
Auth : `DOKPLOY_API_KEY`
Service type : Docker Compose (source Raw, pas de rebuild)
Compose sync : GitHub Actions met à jour compose + env via API Dokploy
Deploy trigger : `compose.deploy` via API
Rollback : changer `APP_IMAGE_TAG` vers tag précédent

### 14.9 PostgreSQL & Redis

PostgreSQL 16-alpine, Drizzle ORM, container Docker dans le compose, migrations auto démarrage (`RUN_DB_MIGRATIONS=true`).

Redis 7-alpine, node-redis via `@finance-os/redis`. Structures :
| Clé | Type | Usage | Rétention |
|---|---|---|---|
| `powens:jobs` | List (RPUSH/BLPOP) | Job queue sync | continu |
| `powens:lock:connection:{id}` | String (SET EX) | Lock par connexion | 15 min |
| `powens:metrics:sync:count:{date}` | Counter | Compteur syncs/jour | 3j |
| `powens:metrics:powens_calls:count:{date}` | Counter | Compteur API Powens | 3j |
| `powens:metrics:sync:runs` | List (max 40) | Historique sync runs | 30j |
| `powens:metrics:sync:run:{id}` | Hash | Metadata sync run | 30j |
| `notifications:push:settings` | Hash | Opt-in/permission | Permanent |
| `notifications:push:subscription` | Hash | Subscription WebPush | Permanent |
| `auth:rate_limit:login:{ip}` | Counter | Rate limit login | 60s |
| `powens:sync:cooldown:{id}` | String EX | Cooldown manual sync | configurable |
| `news:dashboard:ingest:lock` | String EX | Lock ingest news | court |

### 14.10 Matrice récapitulative

| Service | Statut | Auth | Gratuit | Critique |
|---|---|---|---|---|
| Powens | Actif | OAuth2 + Client Creds | Non | Oui (données bancaires) |
| News backbone | Actif | Mixte | Oui (FRED key opt) | Non (cache-first) |
| Market backbone | Actif | Clés serveur | Oui/partiel selon plan | Non (cache-first) |
| Web Push | Configuré | VAPID | Oui | Non |
| LLM (OpenAI/Anthropic) | Actif | API keys | Non | Non (fail-soft déterministe) |
| GHCR | Actif | Token GitHub | Oui | Non (build-time) |
| GitHub Actions | Actif | Built-in | Oui (limites free) | Non |
| Dokploy | Actif | API key | Self-hosted | Oui (deploy) |
| PostgreSQL | Actif | Connection string | Self-hosted | Oui |
| Redis | Actif | Connection string | Self-hosted | Oui |

---

## 15. AI Advisor — Architecture, Setup, Coûts, Évals

> **Sources** : `docs/AI-ARCHITECTURE.md`, `docs/AI-SETUP.md`, `docs/AI-COSTS.md`, `docs/AI-EVALS.md`

### 15.1 Principes architecturaux

1. **Deterministic first** : `packages/finance-engine` calcule ratios, allocation drift, cash drag, emergency fund, drawdown, diversification, scenarios.
2. **LLM second** : OpenAI = drafting/classification structuré ; Anthropic = challenger reviews sur top recos.
3. **Challenger isolation** : peut soften, flag ou confirm une reco. Ne remplace pas la base déterministe.
4. **Grounded chat** : consomme artefacts persistés + assumptions explicites. Préfère "unknown" > certitude inventée.
5. **Fail-soft** : demo 100% déterministe ; admin peut dégrader vers preview déterministe si DB/provider/budget bloque.
6. **Cost-aware** : chaque appel écrit usage + cost ledger. Budgets désactivent challenger / deep analysis avant hard stop.

### 15.2 Modules runtime

**`packages/finance-engine`** — asset-class assumptions, TVM, risk proxies, drawdown, portfolio snapshot, deterministic recommendations, simulators. Outputs : `AdvisorSnapshot`, `DeterministicRecommendation[]`, assumption logs.

**`packages/ai`** — providers (OpenAI Responses API, Anthropic Messages API), prompt templates versionnés, JSON schemas structured outputs, pricing registry (version `2026-04-14`), budget policy, default seeded eval cases.

**API advisor domain** :
- `create-dashboard-advisor-use-cases.ts` orchestre déterministe preview + daily pipeline + OpenAI brief + Anthropic challenger + relabel + chat + evals
- `create-manual-refresh-and-run-use-case.ts` orchestre la mission manuelle complète :
  1. Empêche concurrent missions
  2. Enqueue + attend freshness data perso
  3. Refresh news (existing news ingest stack)
  4. Refresh markets (existing markets stack)
  5. Run advisor pipeline après freshness checks
  6. Persist statut readable avec progress par step

**Repository** : `dashboard-advisor-repository.ts` (boundary persistence) — runs/steps, prompts, model usage/cost, snapshots/briefs/recos/challenges, signals, label suggestions, assumptions, chat, evals, manual operations.

**Worker** :
- `advisor-daily-scheduler.ts` — POST internal `/dashboard/advisor/run-daily`, respect `EXTERNAL_INTEGRATIONS_SAFE_MODE`, Redis lock, internal HTTP boundary
- Schedulers `powens-auto-sync`, `news-ingest`, `market-refresh` disponibles mais désactivés en posture recommandée

**Web** : `AiAdvisorPanel` rend daily brief + recos + challenger + signals + assumptions + spend analytics + run history + manual full-mission status + grounded chat + eval status.
`/_app/patrimoine` → admin manual-asset CRUD (`/dashboard/manual-assets`).

### 15.3 Modes d'orchestration

#### Mode recommandé actuel : manual full mission

Trigger : bouton admin `Tout rafraichir et analyser` sur `/actualites` ou `POST /dashboard/advisor/manual-refresh-and-run`.

Flux :
1. Crée manual operation row + acquire concurrency lock
2. Enqueue personal sync pour real connections si besoin
3. Attend sufficient freshness ou marque step degraded
4. Run `POST /dashboard/news/ingest` via use case stack
5. Run `POST /dashboard/markets/refresh` via use case stack
6. Execute advisor pipeline
7. Persist operation steps, advisor artifacts, usages, costs, evals
8. Expose status via `GET /dashboard/advisor/manual-refresh-and-run*`

#### Pipeline advisor lui-même

Une fois freshness gates satisfaits :
1. Read dashboard summary, goals, transactions, news context bundle
2. Compute deterministic finance snapshot
3. Generate deterministic candidate recommendations
4. Build deterministic daily brief fallback
5. (Optionnel) Ask OpenAI structured daily brief draft
6. (Optionnel) Ask Anthropic to challenge top recommendations
7. (Optionnel) Ask OpenAI to relabel ambiguous transactions
8. Run seeded eval cases against resulting state
9. Persist artifacts, usage, cost, eval results
10. Expose latest state via `/dashboard/advisor*`

#### Mode scheduled optionnel

Activable plus tard sans changement de code :
- `AI_DAILY_AUTO_RUN_ENABLED=true`
- `WORKER_AUTO_SYNC_ENABLED=true`

**Off** dans la posture recommandée actuelle.

### 15.4 Posture recommandée actuelle (env)

```env
VITE_AI_ADVISOR_ENABLED=true
VITE_AI_ADVISOR_ADMIN_ONLY=true

AI_ADVISOR_ENABLED=true
AI_ADVISOR_ADMIN_ONLY=true
AI_ADVISOR_FORCE_LOCAL_ONLY=false
AI_CHAT_ENABLED=true
AI_CHALLENGER_ENABLED=true
AI_RELABEL_ENABLED=true

AI_DAILY_AUTO_RUN_ENABLED=false
WORKER_AUTO_SYNC_ENABLED=false
NEWS_AUTO_INGEST_ENABLED=false
MARKET_DATA_AUTO_REFRESH_ENABLED=false

AI_BUDGET_DAILY_USD=5
AI_BUDGET_MONTHLY_USD=75
AI_BUDGET_DISABLE_DEEP_ANALYSIS_RATIO=0.5
AI_BUDGET_DISABLE_CHALLENGER_RATIO=0.75
AI_MAX_CHAT_MESSAGES_CONTEXT=8
```

Mode déterministe sans clés provider :
```env
AI_ADVISOR_FORCE_LOCAL_ONLY=true
AI_CHALLENGER_ENABLED=false
AI_RELABEL_ENABLED=false
```

### 15.5 Setup minimal

1. `pnpm db:migrate`
2. Set env vars
3. Start runtimes (`pnpm api:start`, `pnpm worker:start`, `pnpm web:dev`)
4. Login admin, ouvrir `/actualites`
5. Click `Tout rafraichir et analyser`

Equivalent CLI :
```bash
curl -X POST http://127.0.0.1:3001/dashboard/advisor/manual-refresh-and-run \
  -H "content-type: application/json" \
  -H "cookie: <admin-session-cookie>"
```

### 15.6 Coûts

Tables : `ai_model_usage`, `ai_cost_ledger`, `ai_run`, `ai_run_step`, `ai_manual_operation`, `ai_manual_operation_step`.
Pricing source : `packages/ai/src/pricing/registry.ts` (version `2026-04-14`).

Dimensions trackées par appel : provider, model, feature, endpoint type, run/step id, input/output/cached tokens, batch flag, latency, USD/EUR, pricing version.

Spend analytics endpoint agrège : daily totals, weekly/monthly rollup, par provider/model/feature, anomalies + budget warnings.

Budget controls behavior :
- `< deep-analysis ratio` : full stack
- `> deep-analysis ratio` : deeper synthesis désactivée
- `> challenger ratio` : challenger désactivé
- `> hard daily/monthly` : model calls bloqués, fallback déterministe

Bandes de coûts estimées (single-user) :
- Light : $10-25/mois
- Standard : $25-75/mois
- Heavy reruns : $75-150+/mois

Stratégie de réduction implémentée :
- Déterministe d'abord
- OpenAI nano/mini pour classification + drafting cheap
- Anthropic challenger seulement sur top recos
- Context compact ciblé > full history prompts
- Artefacts persistés réutilisés par chat + overview reads
- Budget-aware skip avant hard failure

### 15.7 Évals

Catégories :
- `transaction_classification`
- `recommendation_quality`
- `challenger`
- `data_sufficiency`
- `cost_control`

Cases seedés : `packages/ai/src/evals/default-eval-cases.ts`. Persistés `ai_eval_case`, `ai_eval_run`.

Évalués pendant : manual full mission, run-daily, relabel runs.
Visibles via : `GET /dashboard/advisor/evals`.

Méthode déterministe et conservatrice :
- Vérifie compatibilité avec expectations explicites
- Pas d'autre LLM grader
- Treats degraded runs / budget-blocked runs comme signaux significatifs

Bons patterns :
- "no emergency fund → don't recommend opportunistic sleeve first"
- "budget exhausted → challenger must not be considered available"
- "macro noise only → confidence stays moderate"
- "insufficient data → must surface assumptions/caveats"

Limites connues :
- Pas de replay harness historique
- Pas de provider-side golden dataset
- Pas d'offline batch eval job

---

## 16. Pipeline News (signaux macro-financiers)

> **Source** : `docs/context/NEWS-FETCH.md`

### 16.1 Vue d'ensemble

La feature news n'est plus un simple feed HN. C'est une **plateforme cache-first de collecte et de restitution de signaux macro-financiers et événementiels** :
- `GET /dashboard/news` reste **cache-only**
- `POST /dashboard/news/ingest` = point d'entrée live explicite
- Worker peut lancer ingestions récurrentes via `NEWS_AUTO_INGEST_ENABLED`
- Multi-source, déterministe, **sans LLM externe**
- `NewsContextBundle` consommé par advisor pour persister `ai_macro_signal` + `ai_news_signal`

### 16.2 Sources actives

| Provider | ID | Rôle | Auth |
|---|---|---|---|
| Hacker News Algolia | `hn_algolia` | tech, startup, AI, internet finance | aucune |
| GDELT DOC 2.0 | `gdelt_doc` | media global, géopolitique, macro | aucune |
| ECB RSS | `ecb_rss` | speeches, press releases, publications | aucune |
| ECB Data Portal | `ecb_data` | series macro structurées | aucune (off default) |
| Federal Reserve RSS | `fed_rss` | policy, speeches, press releases | aucune |
| SEC EDGAR / data.sec.gov | `sec_edgar` | filings primaires, watchlist corporate | UA explicite requis |
| FRED | `fred` | series macro structurées | `FRED_API_KEY` |

Préparés non câblés : `alpha_vantage`. Refusés comme dépendance core : NewsAPI gratuit.

### 16.3 Flux

```
# Lecture cache-only
Web admin
  → dashboardNewsQueryOptionsWithMode()
  → fetchDashboardNews() → GET /dashboard/news
  → createNewsRoute() → selectDashboardNewsDataset()
  → useCases.getNews() → newsRepository.{getNewsCacheState, listNewsArticles}
  → réponse cache enrichie

# Ingestion explicite
Admin UI ou worker interne
  → POST /dashboard/news/ingest
  → ingestNews() → runLiveIngestion()
  → provider adapters → normalisation/enrichissement → dedupe cross-source → metadata scrape opt
  → DB cache

# Scheduler worker (optionnel)
Worker setInterval
  → triggerDashboardNewsIngest()
  → POST API_INTERNAL_URL/dashboard/news/ingest
  → lock Redis news:dashboard:ingest:lock
```

### 16.4 Demo vs Admin

| Surface | Demo | Admin |
|---|---|---|
| `apps/web/src/routes/_app/actualites.tsx` | prewarm fixtures web | prewarm API cache |
| `dashboardNewsQueryOptionsWithMode()` | `getDemoDashboardNews()` | `fetchDashboardNews()` |
| `GET /dashboard/news` | fixture pack versionné | cache PostgreSQL enrichi |
| `GET /dashboard/news/context` | interdit sans token interne | bundle IA cache-only |
| `POST /dashboard/news/ingest` | `403` | ingestion live explicite |
| Worker scheduler | aucun effet demo | ingestion via token interne |

### 16.5 Taxonomie

Domaines couverts : finance, markets, macroeconomy, central_banks, monetary_policy, regulation, legislation, public_policy, geopolitics, conflict, sanctions, diplomacy, supply_chain, logistics, energy, commodities, technology, ai, cybersecurity, product_launches, model_releases, cyber_incidents, earnings, guidance, filings, mna, capital_markets, credit, real_estate, public_health, climate, labor, general_impact, emerging_themes.

Event types (extrait) : `policy_decision`, `macro_release`, `regulatory_action`, `filing_8k`, `earnings_result`, `guidance_update`, `product_launch`, `model_release`, `cyber_incident`, `geopolitical_escalation`, `sanctions_update`, `general_update`.

Enrichissement déterministique (`createNormalizedNewsSignal()`) : domaines/categories/subcategories, eventType, severity/confidence/novelty, marketImpactScore/relevanceScore, riskFlags/opportunityFlags, entités, tickers inférés, secteurs/themes, hypothèses transmission, whyItMatters, macroLinks/policyLinks/filingLinks.

### 16.6 Dedupe & clustering

Dedupe key stockage : fingerprint canonical URL OU titre normalisé + event type + jour publication.
Dedupe cross-source (`resolveNewsDuplicate()`) : combine canonical URL fingerprint, titre normalisé exact, similarité Jaccard tokens titre, même eventType, même sourceDomain, fenêtre publication, entités partagées. Seuil merge : score ≥ 60.

Provenance : `news_article` = signal canonique, `news_article_source_ref` = toutes les refs source, exposes `sourceCount`, `providerCount`, providers, domains.

Clusters : `eventClusterId`, `signalCount`, `sourceCount`, `topDomains`, `topSectors`.

### 16.7 Metadata scraping

Service : `apps/api/src/routes/dashboard/services/scrape-article-metadata.ts`
Stratégie : fetch server-side, timeout strict, max bytes strict, lecture partielle `head`, pas de headless browser, fallback minimal.
Champs extraits : `<title>`, meta description, canonical, OG (`title`, `description`, `image`, `image:url`, `image:secure_url`, `image:alt`, `site_name`, `url`), twitter card, favicon, JSON-LD `Article`/`NewsArticle`.
Stocké dans : `metadataFetchStatus`, `metadataCard` (avec `imageUrl` + `imageCandidates[]`, `faviconUrl` + `faviconCandidates[]`, `imageAlt`), `metadataFetchedAt`.

### 16.8 Endpoints

#### `GET /dashboard/news`
Filtres : `topic`, `source`, `sourceType`, `domain`, `eventType`, `minSeverity`, `region`, `ticker`, `sector`, `direction`, `from`, `to`, `limit`.
Réponse : `items`, `providers`, `clusters`, `contextPreview`, `resilience`, `metrics`, `dataset`.

#### `GET /dashboard/news/context`
Cache-only bundle IA. Accès admin OU token interne. Plages : `24h`, `7d`, `30d`.
Contenu : top signals, clustered events, impacted sectors/entities, regulator/central bank/filings highlights, thematic highlights, contradictory signals, causal hypotheses, supporting references.

#### `POST /dashboard/news/ingest`
Accès admin OU token interne. Retour : `fetchedCount`, `insertedCount`, `mergedCount`, `dedupeDropCount`. Échec → `503` envelope safe, lecture cache reste dispo.

### 16.9 UI

`NewsFeed` : hero radar cache-first, filtres lecture, signal leaders, flux enrichi avec "why it matters", cards visuelles (image metadata + favicon + provenance source), provenance visible, metadata cards, clusters événements, impacts secteurs/entités, santé providers, bouton admin ingestion manuelle.

Scoring UI séparé du backend : backend = score canonique, frontend = reranking local selon filtres actifs.

### 16.10 Règle de vérité

Ne jamais laisser la doc raconter `GET /dashboard/news → live provider`. L'implémentation reste : `ingest live explicite ou worker → DB cache → GET cache-only → fallback demo/fixture`.

---

## 17. Pipeline Marchés & Macro

> **Source** : `docs/context/MARKETS-MACRO.md`

### 17.1 But du domaine

`/marches` fournit lecture exogène premium :
- panorama global compact
- macro officielle structurée
- watchlist mondiale initiale en code
- signaux déterministes sans LLM
- bundle de contexte stable pour futur advisor IA

Pas un terminal trading. Conçu pour : snapshot-first, provenance explicite, fraîcheur honnête, dual-path strict, évolution douce vers payant sans rearchitecture.

Hors scope : crypto, exécution/ordres, streaming client-side, modèle IA en production.

### 17.2 Recherche provider

Sources docs officielles vérifiées :
- EODHD : `https://eodhd.com/financial-apis/api-for-historical-data-and-volumes/`, pricing `https://eodhd.com/pricing`
- FRED : `https://fred.stlouisfed.org/docs/api/fred/series.html`
- Twelve Data : `https://twelvedata.com/docs`, `https://twelvedata.com/pricing`, credits `https://support.twelvedata.com/en/articles/5615854-credits`

Hypothèses :
- EODHD Free = baseline global EOD/différé (20 calls/jour, 1 an EOD)
- FRED = source officielle macro (clé enregistrée requise, endpoint `fred/series/observations` suffit MVP)
- Twelve Data Free = overlay optionnel US (Basic 8 credits/min, 800/jour ; couverture gratuite globale insuffisante pour primary)
- Aucun wrapper tiers : fetch HTTP natif uniquement

### 17.3 Stratégie merge / fallback

- EODHD = baseline quote
- Twelve Data overlay si :
  - symbole explicitement éligible
  - quote exploitable
  - overlay apporte lecture plus fraîche
- FRED = macro uniquement

Chaque quote expose : `provider`, `baselineProvider`, `overlayProvider`, `mode` (`eod | delayed | intraday`), `delayLabel`, `reason`, `quoteDate`, `quoteAsOf`, `capturedAt`, `freshnessMinutes`, `isDelayed`.

**Pas de merge opaque**. Si Twelve Data utilisé, raison persistante visible.

Honnêteté UI : EOD reste EOD, différé reste différé, overlay US marqué tel. UI préfère bonne explication staleness > illusion temps réel.

### 17.4 Architecture runtime

```
Worker scheduler (optional)
  └─ POST /dashboard/markets/refresh
       │
   apps/api ───── EOD baseline ──> EODHD
       │  ───── US overlay ─────> Twelve Data
       │  ───── Macro obs ───────> FRED
       └─ Drizzle → PostgreSQL

apps/web /marches → GET /dashboard/markets/*
```

Lecture : web SSR → loader TanStack → `GET /dashboard/markets/overview` → API → PostgreSQL snapshots + cache state. **Aucun GET ne touche provider live**.
Refresh : manuel `POST /dashboard/markets/refresh` ; programmé worker optionnel ; demo interdit ; admin requis (session admin ou token interne).

### 17.5 Contrats API

| Endpoint | Rôle |
|---|---|
| `GET /dashboard/markets/overview` | payload complet `/marches` (cache-only, fixture demo/admin fallback) |
| `GET /dashboard/markets/watchlist` | vue watchlist simplifiée (stable JSON) |
| `GET /dashboard/markets/macro` | vue macro simplifiée (stable JSON) |
| `GET /dashboard/markets/context-bundle` | bundle IA marché (stable, serialisable) |
| `POST /dashboard/markets/refresh` | refresh live cache (admin/internal only) |

Réponse overview : `summary`, `panorama.items`, `macro.items`, `watchlist.items`, `signals.items`, `contextBundle`, `providers`, `freshness`, `dataset`.

Enveloppes fail-soft : demo → fixture déterministe ; admin live OK → `dataset.source = admin_live` ; admin fallback → `dataset.source = admin_fallback` ; POST refresh → `MARKET_REFRESH_DISABLED`, `MARKET_PROVIDER_UNAVAILABLE`, `MARKET_REFRESH_FAILED`.

### 17.6 Persistence (`packages/db/src/schema/markets.ts`)

| Table | Rôle |
|---|---|
| `market_quote_snapshot` | quote canonique par instrument |
| `market_macro_observation` | obs macro FRED par date |
| `market_cache_state` | etat global cache marchés |
| `market_provider_state` | health + compteurs par provider |
| `market_context_bundle_snapshot` | dernier bundle IA serialisé |

Strategy upsert : quotes une ligne canonique par `instrument_id` ; macro upsert `(series_id, observation_date)` ; provider state upsert `provider` ; cache state singleton `scope = global` ; context bundle dernier snapshot logique.

Fraîcheur : cache global garde `lastSuccessAt`, `lastAttemptAt`, `lastFailureAt`, `lastErrorCode`, `lastRequestId`. Staleness UI dépend `MARKET_DATA_STALE_AFTER_MINUTES`.

### 17.7 Univers initial

#### Panorama / watchlist
| Id interne | Instrument | Mapping provider | Rôle |
|---|---|---|---|
| `spy-us` | S&P 500 via SPY | `SPY.US` | panorama US large cap |
| `qqq-us` | Nasdaq 100 via QQQ | `QQQ.US` | panorama growth US |
| `vgk-us` | Europe large caps | `VGK.US` | panorama Europe |
| `ewj-us` | Japon | `EWJ.US` | panorama Asie |
| `iemg-us` | Emergents | `IEMG.US` | panorama EM |
| `cw8-pa` | MSCI World PEA | `CW8.PA` | panorama monde / PEA |
| `meud-pa` | MSCI Europe PEA | `MEUD.PA` | watchlist PEA |
| `aeem-pa` | Emergents PEA | `AEEM.PA` | watchlist PEA |
| `mjp-pa` | Japon PEA | `MJP.PA` | watchlist PEA |
| `air-pa` | Airbus | `AIR.PA` | watchlist Europe equity |
| `mc-pa` | LVMH | `MC.PA` | watchlist Europe equity |
| `ief-us` | US Treasuries 7-10Y | `IEF.US` | cross-asset rates proxy |
| `gld-us` | Or | `GLD.US` | cross-asset commodity proxy |
| `eza-us` | Afrique du Sud | `EZA.US` | couverture Afrique partielle |

#### Series macro
`FEDFUNDS`, `SOFR`, `DGS2`, `DGS10`, `T10Y2Y`, `CPIAUCSL`, `UNRATE`.

Couvre taux directeurs, taux courts, courbe taux, inflation, marché du travail. Officielles, lisibles, peu coûteuses à rafraîchir. Suffisent pour premier moteur signaux déterministes.

### 17.8 MarketContextBundle

Champs : `generatedAt`, `coverageSummary`, `quoteFreshness`, `keyMovers`, `marketBreadth`, `marketRegimeHints`, `macroRegime`, `ratesSummary`, `inflationSummary`, `laborSummary`, `riskFlags`, `anomalies`, `warnings`, `watchlistHighlights`, `providerProvenance`, `confidence`.

Garanties : structure stable et serialisable, provenance/fraîcheur par provider, séparation explicite faits/heuristiques/caveats, compatibilité demo/admin.
Pas garanti : vérité marché temps réel, recommandations investissement, exécution, inférence LLM aujourd'hui.

### 17.9 Moteur de signaux

Déterministes et locaux :
- régime taux courts élevés vs baisse
- inflation refroidissement / réchauffement
- spread 10Y-2Y plus pentu / plus inversé
- surperformance relative US vs Europe
- alertes fraîcheur ou couverture partielle

S'appuient sur : variations quotes, observations macro vs période précédente, key movers et breadth watchlist.

### 17.10 UX & dataviz

- **D3** pour graphes
- Peu de graphiques mais forts
- Dark premium aligné Finance-OS
- Badges source/fraîcheur premier niveau
- Motion discrète, non bloquante

Visualisations MVP : heat strip panorama, relative performance ribbon, sparklines macro, signal board / provenance legend.
États couverts : loading, empty, degraded, error, offline, permission-gated.

### 17.11 Évolution future

- Remplacer proxies par indices cash vérifiés si plan provider permet
- Plus de séries macro FRED ou source BCE structurée séparée
- Brancher provider payant plus frais sans changer contrat quote (triplet baseline/overlay/provenance)
- Injecter `MarketContextBundle` dans futur advisor IA sans re-wirer UI/tables

---

## 18. CI/CD & Déploiement

### 18.1 Pipeline

```
git push main → CI Workflow (lint + typecheck + test + build)
git tag vX.Y.Z → Release Workflow
                  → CI rerun
                  → Docker Build (4 targets: build-web, web, api, worker)
                  → Push GHCR (vX.Y.Z + sha-commit, immutable)
                  → Sync Dokploy (compose + env)
                  → Dokploy Deploy (compose.deploy)
                  → Smoke Tests (/health, /auth/me, /dashboard/summary, /powens/status)
```

### 18.2 Étapes

| Étape | Outil | Détails |
|---|---|---|
| CI | GitHub Actions | `pnpm check:ci` = frozen lockfile + lint + typecheck + test + build |
| Build | Docker multi-stage | 4 targets : `build-web`, `web`, `api`, `worker` |
| Registry | GHCR | Images immutables, **jamais `latest`** |
| Deploy | Dokploy | Docker Compose, source Raw (pas de rebuild) |
| Smoke | `smoke-prod.mjs` | `/health`, `/auth/me`, `/dashboard/summary`, `/powens/status` |
| Rollback | Tag précédent | Changer `APP_IMAGE_TAG` dans Dokploy ou `workflow_dispatch` |

### 18.3 Architecture déploiement

```
Dokploy (VPS)
  └─ Docker Compose
       ├─ web :3000 (Node/Nitro) ←─ HTTPS single domain
       ├─ api :3001 (Bun/Elysia) ←─ proxy /api/*
       ├─ worker (Bun)
       ├─ postgres :5432
       ├─ redis :6379
       └─ ops-alerts (sidecar)
            └─ webhook → ntfy / Slack / Discord
```

**Réseau** : `finance_os_internal` (bridge Docker)
**Volumes** : `postgres_data`, `redis_data`, `worker_run_v2`
**Domaine** : single public domain pointe vers `web`. API interne uniquement.

### 18.4 Dockerfile multi-stage

```
base (Node + Bun + pnpm + deps install)
  ├→ build-web (Vite build, VITE_* args)
  │    └→ web target (Node runtime, Nitro SSR)
  ├→ api target (Bun runtime, Elysia server)
  └→ worker target (Bun runtime, Job consumer)
```

### 18.5 Posture recommandée (kill-switches)

- `WORKER_AUTO_SYNC_ENABLED=false`
- `NEWS_AUTO_INGEST_ENABLED=false`
- `MARKET_DATA_AUTO_REFRESH_ENABLED=false`
- `AI_DAILY_AUTO_RUN_ENABLED=false`

→ Mission complète advisor lancée manuellement via bouton admin sur `/actualites`.

---

## 19. Workflow Agentic (autopilot)

> **Sources** : `AGENTS.md`, `docs/agentic/INDEX.md`, `CLAUDE.md`

### 19.1 Acteurs

- **Codex** : default writer pour les branches `agent/impl-*`. GitHub automation est wired autour des PR-thread patch replies de Codex.
- **Claude** : challenger, reviewer, local high-context collaborator. Ne writes pas en concurrence avec Codex sur la même branche autopilot active.
- **Humain** : peut faire takeover manuel d'une branche → pause Codex prompts.

### 19.2 Invariants autopilot

- Batch spec expansion 1:1 avec raw bullets (1 spec = 1 bullet)
- Single implementation lane (1 PR à la fois)
- `issue_comment` workflows gate sur Codex-authored comments
- PRs créées automatiquement comme draft `agent/impl-*` branches
- Codex implémente via PR thread reply `AUTOPILOT_PATCH_V1`, autopilot applique le patch sur la même branche
- Une fois implementation PR créée, linked `spec:` et `improve:` issues fermées comme `completed`
- Si PR fermée sans merge, autopilot reopens et requeues
- Une seule autopilot implementation PR ouverte à la fois ; extras attendent en `autopilot:queued-pr`
- Merge-on-green seulement après fichiers non-stub landés + `.github/agent-stubs/**` removed du PR diff + branche up-to-date avec green CI
- Failed CI résumée sur PR thread (Codex voit l'erreur)

### 19.3 Labels autopilot

- `autopilot` : travail automatisé
- `autopilot:queued` → `autopilot:waiting-patch` → `autopilot:patch-applied` → `autopilot:ready-to-merge`
- `agent:pm`, `agent:dev`, `agent:review`, `agent:challenger`

### 19.4 Maps agentic (`docs/agentic/`)

| Map | Rôle |
|---|---|
| `INDEX.md` | Entry point markdown-first |
| `architecture-map.md` | Runtime entrypoints, package anchors, local rules |
| `contracts-map.md` | Required HTTP contracts + implementation files |
| `testing-map.md` | Coverage actuelle, scope-based verification, manual gaps |
| `ui-quality-map.md` | UI quality bar, key surfaces, manual UI checks |
| `release-map.md` | CI, autopilot, release, deploy, smoke-test entrypoints |
| `code_review.md` | Severities + checklist pour ce repo |
| `policy-verification-bundle.md` | Conventions, decision trees, verification checklists |

### 19.5 Local AGENTS.md

| Path | Rôle |
|---|---|
| `apps/api/AGENTS.md` | Rules API |
| `apps/web/AGENTS.md` | Rules Web |
| `apps/worker/AGENTS.md` | Rules Worker |
| `infra/docker/AGENTS.md` | Rules Docker/deploy |
| `packages/{db,env,powens,redis,ui,prelude}/AGENTS.md` | Rules par package |

### 19.6 Validation

```bash
node .agents/skills/scripts/validate-agent-foundation.mjs
```

### 19.7 Verification commands

```bash
pnpm check:ci          # lint + typecheck + test + build
pnpm lint
pnpm typecheck
pnpm -r --if-present test
pnpm -r --if-present build
node scripts/smoke-api.mjs
node scripts/smoke-prod.mjs
node --test infra/docker/ops-alerts/monitor.test.mjs
```

### 19.8 GitNexus (Code Intelligence)

Indexé : finance-os (2178 symbols, 4633 relationships, 88 execution flows). Disponible via MCP (Claude Code + Codex).

Tools clés :
| Tool | Quand |
|---|---|
| `query` | Trouver code par concept |
| `context` | 360° view d'un symbol |
| `impact` | Blast radius avant édition |
| `detect_changes` | Pre-commit scope check |
| `rename` | Safe multi-file rename |
| `cypher` | Custom graph queries |

Risk levels :
| Depth | Meaning | Action |
|---|---|---|
| `d=1` | WILL BREAK — direct callers/importers | MUST update |
| `d=2` | LIKELY AFFECTED — indirect deps | Should test |
| `d=3` | MAY NEED TESTING — transitive | Test if critical path |

Skills GitNexus :
- `gitnexus-exploring`, `gitnexus-impact-analysis`, `gitnexus-debugging`, `gitnexus-refactoring`, `gitnexus-guide`, `gitnexus-cli`

Refresh index après commits :
```bash
npx gitnexus analyze [--embeddings]
```

---

## 20. Inventaire complet des Skills installés

> **Source** : `docs/SKILLS-INVENTORY.md` + `.claude/skills/`

### 20.1 Trust tiers

| Tier | Quand load |
|---|---|
| **Core** | Local Finance-OS — invariants repo (toujours pour leur domaine) |
| **Recommended** | External bien maintenus (>100 stars, actifs, prouvés) |
| **Optional** | Utiles mais niche / overlap avec tier supérieur |
| **Experimental** | Low adoption, unproven (use with caution) |
| **Rejected** | Évalués et exclus (documentés pour future) |

**Règle de priorité** : `Local Finance-OS > Recommended external > Optional external > Experimental`. Les skills locaux encodent invariants non-négociables ; externes supplémentent.

### 20.2 Core — Finance-OS Local Skills (7)

| Skill | Path | Quand |
|---|---|---|
| `finance-os-core-invariants` | `finance-os/core-invariants/` | ANY change touchant auth, routes, env, data access, logging |
| `finance-os-web-ssr-auth` | `finance-os/web-ssr-auth/` | Auth flows, route loaders, SSR/client coherence, demo/admin transitions |
| `finance-os-powens-integration` | `finance-os/powens-integration/` | Bank connections, Powens client, callback, token encryption |
| `finance-os-worker-sync` | `finance-os/worker-sync/` | Background worker, sync jobs, Redis queue, batch upserts |
| `finance-os-deploy-ghcr-dokploy` | `finance-os/deploy-ghcr-dokploy/` | CI/CD, Docker, releases, Dokploy, smoke tests |
| `finance-os-observability-failsoft` | `finance-os/observability-failsoft/` | Widget health states, fallbacks, metrics, logging, health checks |
| `finance-os-ui-cockpit` | `finance-os/ui-cockpit/` | UI components, pages, animations, design system compliance |

### 20.3 Core — GitNexus Code Intelligence (6)

| Skill | Quand |
|---|---|
| `gitnexus-exploring` | "How does X work?" |
| `gitnexus-impact-analysis` | Blast radius avant édition |
| `gitnexus-debugging` | Tracing bugs |
| `gitnexus-refactoring` | Rename / extract / split / refactor |
| `gitnexus-guide` | Tools reference, schema |
| `gitnexus-cli` | Index management, status, CLI |

### 20.4 Recommended — External Skills (17)

#### Frontend / React (2)
| Skill | Source | Stars |
|---|---|---|
| `vercel-react-best-practices` | vercel-labs/agent-skills | 24.7K |
| `vercel-composition-patterns` | vercel-labs/agent-skills | 24.7K |

#### TanStack (4)
| Skill | Source | Stars |
|---|---|---|
| `tanstack-start-best-practices` | DeckardGer/tanstack-agent-skills | 121 |
| `tanstack-query-best-practices` | DeckardGer/tanstack-agent-skills | 121 |
| `tanstack-router-best-practices` | DeckardGer/tanstack-agent-skills | 121 |
| `tanstack-integration-best-practices` | DeckardGer/tanstack-agent-skills | 121 |

#### Quality / Performance (3)
| Skill | Source | Stars |
|---|---|---|
| `web-quality-audit` | addyosmani/web-quality-skills | 1.7K |
| `performance` | addyosmani/web-quality-skills | 1.7K |
| `core-web-vitals` | addyosmani/web-quality-skills | 1.7K |

#### DevOps / Workflow (4)
| Skill | Source | Stars |
|---|---|---|
| `ci-cd-and-automation` | addyosmani/agent-skills | 9K |
| `git-workflow-and-versioning` | addyosmani/agent-skills | 9K |
| `security-and-hardening` | addyosmani/agent-skills | 9K |
| `documentation-and-adrs` | addyosmani/agent-skills | 9K |

#### Data / Backend (3)
| Skill | Source | Stars |
|---|---|---|
| `redis-development` | redis/agent-skills (officiel) | 41 |
| `drizzle-best-practices` | adapted from honra-io | 6 |
| `postgresql-code-review` | adapted from github/awesome-copilot | -- |

#### Testing (1)
| Skill | Source | Stars |
|---|---|---|
| `webapp-testing` | anthropics/skills (officiel) | 113K |

### 20.5 Optional — Code Review (1)

| Skill | Quand |
|---|---|
| `code-review` | PRs, 4-phase structured review with severity labels |

### 20.6 Optional — UI Design System Impeccable (33)

Pré-installés depuis `pbakaus/impeccable`. Spécialisés UI refinement. Compléments à `finance-os-ui-cockpit` + `DESIGN.md`, **pas** des remplaçants.

#### Key skills pour Finance-OS
- `polish` / `critique` / `audit` — pre-ship quality pass
- `arrange` / `typeset` / `colorize` — layout, typography, color
- `distill` / `bolder` / `quieter` — calibrate visual intensity
- `adapt` / `harden` — responsive design + edge-case resilience
- `normalize` / `extract` — design system alignment + token extraction
- `color-expert` — palette direction, contrast, theme systems

#### Liste exhaustive (33)
`adapt`, `animate`, `arrange`, `audit`, `bolder`, `clarify`, `color-expert`, `colorize`, `creative-direction`, `critique`, `delight`, `design-tokens`, `distill`, `extract`, `frontend-design`, `frontend-design-review`, `frontend-skill`, `harden`, `motion-design-patterns`, `normalize`, `onboard`, `optimize`, `overdrive`, `polish`, `quieter`, `teach-impeccable`, `typeset`, `typography-audit`, `ui-animation`, `ui-audit`, `ui-design`, `visual-qa`, `web-design-guidelines`

### 20.7 Generated — GitNexus Domain Skills (20)

Auto-générés depuis analyse codebase. Update via `node scripts/sync-gitnexus-generated-skills.mjs`.

| Skill | Symbols | Quand |
|---|---|---|
| `dashboard` | 83-93 | Dashboard app shell, sync status, financial cards |
| `domain` | 67-96 | Core domain models, types, contracts |
| `auth` | 66 | Authentication flows, session management |
| `routes` | 60-72 | API route definitions + handlers |
| `repositories` | 38-50 | Data access layer, query builders |
| `features` | 30-32 | Feature flags, configuration |
| `services` | 27-29 | Business logic services |
| `powens` | 29-30 | Powens API integration symbols |
| `ui` | 18-20 | UI components + utilities |
| `mocks` | 16 | Test mocks + fixtures |
| `debug` | 11 | Debugging utilities |
| `logging` | 9 | Logging infrastructure |
| `goals` | 8 | Financial goals domain |
| `app` | 8 | App shell |
| `shell` | 7 | Shell components |
| `cluster-1` | 13 | Domain cluster |
| `cluster-3` | 12 | Domain cluster |
| `cluster-17` | 7 | Domain cluster |
| `cluster-47` | 10 | Domain cluster |
| `cluster-48` | 7 | Domain cluster |

### 20.8 Experimental (1)

| Skill | Source | Pourquoi experimental |
|---|---|---|
| `sast-security-scan` | utkusen/sast-skills (529 stars) | Novel SAST approach, CLAUDE.md format adapté SKILL.md. Useful audits périodiques, unproven daily workflow. |

### 20.9 Rejected — avec justification

| Skill | Source | Stars | Pourquoi rejeté |
|---|---|---|---|
| `ymc182/bun-elysia-skill` | ymc182 | 0 | Dead repo (0 stars, 2 commits Jan 2026). Local `core-invariants` + `worker-sync` couvrent mieux Bun/Elysia. |
| `thruthesky/dokploy-skill` | thruthesky | 2 | Minimal content shell-based. Local `deploy-ghcr-dokploy` plus comprehensive et repo-specific. |
| `Ameyanagi/tanstack-start-elysia` | Ameyanagi | 2 | Scaffolding nouveau projet. App déjà running → no value. |
| `ofershap/typescript-best-practices` | ofershap | 1 | Unproven. TS patterns couverts par `exactOptionalPropertyTypes` conventions + Vercel React. |
| TanStack official intent skills | TanStack | -- | Not yet released. `@tanstack/intent` annoncé, skills non shippés. Revisit when available. |
| Microsoft Playwright official | Microsoft | -- | No official Claude Code skill exists. `webapp-testing` Anthropic suffit. |

### 20.10 Overlap arbitration

| Topic | Primary | Supplement | Override |
|---|---|---|---|
| React patterns | `vercel-react-best-practices` | `vercel-composition-patterns` | `finance-os-ui-cockpit` (DS compliance) |
| TanStack | DeckardGer 4 skills | -- | `finance-os-web-ssr-auth` (SSR/auth specifics) |
| Security | `security-and-hardening` (OWASP) | `sast-security-scan` (deep) | `finance-os-core-invariants` (VITE_*, encryption, logging) |
| Performance | `performance` + `core-web-vitals` | Impeccable `optimize` | -- |
| Code Review | `code-review` | `postgresql-code-review` | `finance-os-core-invariants` checklist toujours |
| CI/CD + Deploy | `ci-cd-and-automation` | -- | `finance-os-deploy-ghcr-dokploy` |
| Redis | `redis-development` (officiel) | -- | `finance-os-worker-sync` (queue/lock patterns) |

### 20.11 Quick selection by task

| Task | Primary skill(s) | Supplement |
|---|---|---|
| React component | `finance-os-ui-cockpit` | `vercel-react-best-practices`, `vercel-composition-patterns` |
| TanStack Start route | `finance-os-web-ssr-auth`, `tanstack-start-best-practices` | `tanstack-router-best-practices`, `tanstack-integration-best-practices` |
| TanStack Query | `tanstack-query-best-practices` | `tanstack-integration-best-practices` |
| Bun/Elysia API | `finance-os-core-invariants` | `security-and-hardening` |
| Drizzle/PostgreSQL | `drizzle-best-practices` | `postgresql-code-review` |
| Redis | `finance-os-worker-sync` | `redis-development` |
| Powens | `finance-os-powens-integration` | `finance-os-core-invariants` |
| CI/CD | `finance-os-deploy-ghcr-dokploy` | `ci-cd-and-automation` |
| Security audit | `finance-os-core-invariants`, `security-and-hardening` | `sast-security-scan` (exp) |
| Performance | `performance`, `core-web-vitals` | Impeccable `optimize` |
| PR review | `code-review`, `finance-os-core-invariants` | `postgresql-code-review` (DB) |
| UI polish | `finance-os-ui-cockpit` | Impeccable `polish`, `critique`, `audit` |
| New full-stack feature | `finance-os-core-invariants`, `finance-os-observability-failsoft` | Domain skills as needed |
| Worker/sync | `finance-os-worker-sync` | `redis-development` |
| Deploy/release | `finance-os-deploy-ghcr-dokploy` | `ci-cd-and-automation`, `git-workflow-and-versioning` |
| ADR/documentation | `documentation-and-adrs` | -- |
| Code exploration | GitNexus skills + generated domain skills | -- |

---

## Annexes utiles

### A. Commandes de vérification

```bash
# CI complet
pnpm check:ci

# Individuels
pnpm lint
pnpm typecheck
pnpm -r --if-present test
pnpm -r --if-present build

# Smokes
node scripts/smoke-api.mjs
node scripts/smoke-prod.mjs

# Ops alerts
node --test infra/docker/ops-alerts/monitor.test.mjs

# Agentic foundation
node .agents/skills/scripts/validate-agent-foundation.mjs

# Auth hash
echo -n "votre-mot-de-passe" | pnpm auth:hash-b64

# Migrations
pnpm db:migrate

# GitNexus
npx gitnexus analyze [--embeddings]
```

### B. Génération secrets

```bash
openssl rand -base64 48        # AUTH_SESSION_SECRET (min 32 bytes)
openssl rand -base64 24        # PRIVATE_ACCESS_TOKEN, DEBUG_METRICS_TOKEN
openssl rand -hex 32           # APP_ENCRYPTION_KEY (32 bytes exact)
npx web-push generate-vapid-keys  # PUSH_VAPID_PUBLIC_KEY + PRIVATE
```

### C. Local dev setup

```bash
pnpm install --frozen-lockfile
cp .env.example .env
pnpm infra:up        # postgres + redis via docker
pnpm db:migrate
pnpm dev:apps        # web + api + worker
```

### D. Liens documentaires (chemins repo)

| Doc | Chemin |
|---|---|
| Vision visuelle | `DESIGN.md` |
| Direction artistique | `docs/context/DESIGN-DIRECTION.md` |
| Design system tokens/composants | `docs/frontend/design-system.md` |
| Information architecture | `docs/frontend/information-architecture.md` |
| Motion & interactions | `docs/frontend/motion-and-interactions.md` |
| Stack technique complet | `docs/context/STACK.md` |
| Features métier | `docs/context/FEATURES.md` |
| Architecture par app/package | `docs/context/APP-ARCHITECTURES.md` |
| Conventions | `docs/context/CONVENTIONS.md` |
| Variables d'environnement | `docs/context/ENV-REFERENCE.md` |
| Services externes | `docs/context/EXTERNAL-SERVICES.md` |
| News pipeline | `docs/context/NEWS-FETCH.md` |
| Marchés & macro pipeline | `docs/context/MARKETS-MACRO.md` |
| AI architecture | `docs/AI-ARCHITECTURE.md` |
| AI setup | `docs/AI-SETUP.md` |
| AI coûts | `docs/AI-COSTS.md` |
| AI évals | `docs/AI-EVALS.md` |
| Auth & demo mode | `docs/auth-demo-mode.md` |
| MVP dashboard | `docs/mvp-dashboard.md` |
| Powens MVP | `docs/powens-mvp.md` |
| Deployment complet | `docs/deployment.md` |
| Skills inventory | `docs/SKILLS-INVENTORY.md` |
| Agentic INDEX | `docs/agentic/INDEX.md` |
| Agents (root contract) | `AGENTS.md` |
| Claude-specific | `CLAUDE.md` |

---

**Fin du contexte. Ce document est auto-suffisant pour briefer un projet ChatGPT externe sur Finance-OS.**
