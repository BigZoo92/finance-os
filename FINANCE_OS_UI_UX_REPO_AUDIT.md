# Finance-OS — UI/UX, Product, Repo & Skills Audit

> **Date** : 2026-05-24
> **Branche analysée** : `main`
> **Auteur** : Claude (audit lecture seule, aucune modification applicative)
> **Statut** : Snapshot pré-refonte. Ce document est une base de travail pour la refonte UI/UX majeure à venir. Aucune décision design finale n'est prise ici.
> **Convention de chemins** : tous les chemins sont relatifs à la racine `/Users/enzogivernaud/dev/finance-os/`.
> **Marquages** : `à confirmer` = donnée non vérifiée à 100% par lecture directe. `⚠` = dette / risque. `✅` = point fort.

---

## 1. Executive summary

Finance-OS est un **cockpit financier personnel single-user** (mono-utilisateur) construit en monorepo pnpm. Le frontend (`apps/web`) est une SPA SSR TanStack Start / React 19 / Tailwind v4, le backend (`apps/api`) est Elysia/Bun, complétée par un `worker`, un service Python `knowledge-service` (Neo4j + Qdrant + fallback déterministe) et un `quant-service` (paper-trading, vectorbt). 12 packages partagent la logique métier déterministe (`finance-engine`), l'IA (`ai`), les intégrations (`powens`, `external-investments`), la DB (`db`), l'UI (`ui`, très minimaliste).

L'application expose **35 routes** dont **27 routes authentifiées** sous `/_app/`. Elle distingue rigoureusement deux modes : **demo** (fixtures déterministes pour démo publique, scenario library) et **admin** (données live + outils de debug). La distinction est gérée côté API (`DEMO_MODE_FORBIDDEN`, internal token) et côté UI (badges, items de nav filtrés, redirections). Cette dualité est un **invariant non négociable** documenté dans `AGENTS.md`.

La direction artistique actuelle, **"Aurora Pink"**, est documentée et cohérente : palette OKLCH (rose magenta `oklch(0.72 0.19 355)` brand + violet électrique `oklch(0.70 0.22 295)` accent-2 + emerald/coral/amber sémantiques finance), 4 niveaux de surface, typo Inter Variable + JetBrains Mono Variable, react-bits intégrés en source manuelle (22 composants animés, ~7000 LOC à eux seuls dont `liquid-ether` 1254 LOC et `magic-bento` 862 LOC). Le design system partagé (`packages/ui`) reste **délibérément pauvre** (6 primitives), la majorité des composants vivant dans `apps/web/src/components/{surfaces,brand,reactbits,dashboard,advisor,markets,trading-lab,shell}`.

**Trois points produit méritent une refonte ciblée plus qu'une refonte totale** :

1. **Hiérarchie d'information** : plusieurs pages dépassent 1000 LOC (`integrations` 1072, `patrimoine` 1004, `investissements` 971, `strategie-investissement` 1216, `social` 1206, `graph` 1860). Elles concentrent trop d'intentions par écran ; refonte = drilldown / progressive disclosure plutôt que redesign.
2. **Séparation cockpit quotidien / signaux experts / debug** : déjà amorcée (3 groupes de nav), mais la frontière reste poreuse — beaucoup d'écrans mélangent données financières utiles et diagnostics techniques (advisor panels, signal sources, env diagnostics).
3. **Bundle UI lourd sur quelques pages critiques** : `/ia/memoire/graph` (Three.js + react-force-graph-3d + 1860 LOC route), `/signaux/marches` (lightweight-charts + markets-dashboard), `/login` (PixelBlast + Aurora canvas).

**Côté tooling / skills** : l'infrastructure agentique est mature. 72 skills sources + 33 skills Impeccable (UI polish) + 7 skills locaux Finance-OS + 6 skills GitNexus. La documentation `docs/frontend/` est complète (design-system.md, information-architecture.md, motion-and-interactions.md, navigation-refactor-audit.md) — utilisable telle quelle comme base de refonte. **Manques principaux** : skill dédié data-viz financier, skill a11y deep-dive avec WCAG checklist par composant, skill financial-product-UX. `finance-os-ui-cockpit` contient une **palette obsolète (amber/gold)** divergente de `DESIGN.md` (Aurora Pink) — à resync avant la refonte.

**Posture recommandée pour la refonte** : *refonte par phases, drilldown plutôt que redesign total, conservation des tokens Aurora Pink (l'identité fonctionne), travail prioritaire sur l'information architecture et la séparation user / admin / debug, refonte composant-par-composant via les surfaces canoniques (`KpiTile`, `Panel`, `RangePill`, `PageHeader`, `StatusDot`).*

---

## 2. Repo map

```
finance-os/
├── apps/
│   ├── api/                    # Elysia/Bun backend (357 fichiers TS)
│   ├── web/                    # TanStack Start frontend (260 fichiers TS/TSX, ~35K LOC)
│   ├── worker/                 # Background jobs Redis (40 fichiers)
│   ├── desktop/                # Tauri shell (Rust, réutilise web)
│   ├── knowledge-service/      # GraphRAG Python (Neo4j + Qdrant, ~32 fichiers)
│   └── quant-service/          # Backtesting Python (~10 fichiers)
│
├── packages/
│   ├── ui/                     # ⚠ 6 composants partagés + globals.css (489 LOC tokens)
│   ├── db/                     # Drizzle ORM + schemas
│   ├── ai/                     # Providers LLM (Claude/OpenAI), prompts, evals
│   ├── finance-engine/         # Calculs déterministes (risk, projections, recos)
│   ├── powens/                 # OAuth banque + crypto tokens + jobs
│   ├── external-investments/   # IBKR XML + Binance JSON (read-only)
│   ├── env/                    # Validation Zod env vars
│   ├── prelude/                # Utils (errors, format, logging)
│   ├── provider-contract/      # Interface abstraite providers
│   ├── provider-runtime/       # Exécution + registry + test-harness
│   ├── redis/                  # Client Redis + in-memory adapter
│   └── config-ts/              # tsconfigs partagés
│
├── docs/                       # 30+ dossiers de doc (adr, frontend, agentic, context, ai, providers, ops, etc.)
├── skills/                     # 36 skills symlinks (Impeccable + locaux)
├── scripts/                    # 23 scripts (agent:*, smoke-*, validate-*, etc.)
├── e2e/                        # Playwright
├── infra/                      # Docker/Dokploy
├── .agentic/source/skills/     # ⭐ Source de vérité skills (72 sources)
├── .claude/skills/             # Skills générés/symlinks pour Claude (87)
├── .agents/                    # Skills auteur + graphs
├── .codex/                     # Config Codex (autopilot writer)
├── .qwen/, .vscode/            # Configs additionnelles
├── AGENTS.md (20 Ko)           # ⭐ Invariants globaux (lecture obligatoire)
├── CLAUDE.md (15 Ko)           # ⭐ Rôle Claude (challenger/reviewer)
├── DESIGN.md (8 Ko)            # ⭐ Source de vérité visuelle (Aurora Pink)
└── FINANCE-OS-CONTEXT.md       # Résumé contexte
```

### Zones par fonction

| Zone | Localisation | Notes refonte |
|------|--------------|---------------|
| Frontend UI | `apps/web/src/{routes,components,features}` | **Cœur de la refonte** |
| Design tokens | `packages/ui/src/styles/globals.css` (489 LOC) | À enrichir, mais structure OKLCH solide |
| Design system partagé | `packages/ui/src/components/ui/` (6 fichiers) | ⚠ Très pauvre — candidats à enrichir |
| API/backend | `apps/api/src/{routes,auth,mocks}` | Pas dans le scope refonte UI mais détermine contrats data |
| Worker | `apps/worker/src` | Hors scope refonte, mais ses jobs alimentent les widgets |
| Advisor IA | `apps/web/src/components/advisor`, `apps/api/src/routes/dashboard/advisor*`, `packages/ai`, `apps/knowledge-service` | Refonte UX advisor critique |
| Intégrations externes | `packages/{powens,external-investments}` + `apps/web/src/features/{powens,external-investments}` | Surfaces d'admin/intégrations à clarifier |
| Skills/agents | `.agentic/source/skills/`, `.claude/skills/`, `.agents/` | À synchroniser avant refonte (palette ui-cockpit obsolète) |

---

## 3. Apps and packages inventory

### Apps (6)

| App | Stack | Entry | Fichiers | Rôle | Pertinence refonte |
|-----|-------|-------|----------|------|--------------------|
| `apps/web` | TanStack Start, React 19, Tailwind v4 | `src/routes/__root.tsx` | 260 TS/TSX | Frontend SPA SSR | **P0 — cœur refonte** |
| `apps/api` | Elysia, Bun, Drizzle, Zod | `src/bootstrap.ts → src/index.ts` | 357 TS | Backend HTTP | Contrats data lus pendant refonte |
| `apps/worker` | Bun, Redis queues | `src/index.ts` | 40 TS | Jobs background (Powens sync, advisor daily, news, X/Twitter, market refresh, etc.) | Indirect (alimente widgets) |
| `apps/desktop` | Tauri (Rust) | `src/main.rs` | 0 TS | Wrapper desktop iOS/Android `à confirmer` | Hors scope refonte UI directe |
| `apps/knowledge-service` | Python 3.12, FastAPI, Neo4j, Qdrant | `app/main.py` `à confirmer` | ~32 PY | GraphRAG mémoire IA (avec fallback local déterministe) | Alimente `/ia/memoire/graph` |
| `apps/quant-service` | Python 3.12, FastAPI, vectorbt, quantstats | `à confirmer` | ~10 PY | Backtesting paper-trading | Alimente `/ia/trading-lab` |

### Packages (12)

| Package | Rôle | Exports | Consommé par | Maturité |
|---------|------|---------|--------------|----------|
| `@finance-os/ui` | DS partagé minimaliste (button, card, badge, avatar, input, separator) + `styles/globals.css` 489 LOC | `./styles.css`, `./lib/utils`, `./components/*` | `apps/web` | ⚠ Très léger |
| `@finance-os/db` | Drizzle schemas + client PG | `./client`, `./schema` | api, worker, external-investments | Stable |
| `@finance-os/ai` | Providers LLM (Anthropic, OpenAI), prompts, evals, scorers, pricing | `.` | api | Stable |
| `@finance-os/finance-engine` | Calculs déterministes (risk, NPV/IRR, projections, snapshot advisor, recommandations) | `.` | api | Stable |
| `@finance-os/powens` | OAuth, crypto tokens AES, jobs | `./client`, `./crypto` | api, worker, external-investments | Stable |
| `@finance-os/external-investments` | IBKR Flex XML + Binance readonly + credentials encryption + jobs | `./binance`, `./ibkr`, `./credentials`, `./jobs` | api, worker | Beta |
| `@finance-os/env` | Validation Zod env vars + diagnostics | `.`, `./diagnostics` | api, worker, external-investments | Stable |
| `@finance-os/prelude` | Utils communs (errors, format, logging, runtime versioning) | `./errors`, `./format`, `./logging` | api, worker | Stable |
| `@finance-os/provider-contract` | Interface abstraite provider (capabilities, errors, result) | `./capabilities`, `./errors`, `./provider`, `./result` | provider-runtime, external-investments | Stable |
| `@finance-os/provider-runtime` | Exécution provider (registry, logger, redaction, test-harness) | `./registry`, `./logger`, `./diagnostics`, `./test-harness` | external-investments | Stable |
| `@finance-os/redis` | Client Redis + in-memory adapter | `.` | api, worker, external-investments | Stable |
| `@finance-os/config-ts` | tsconfigs partagés (base, web, server) | `./base`, `./web`, `./server` | tous | Stable |

### Outils & scripts clés

- **Build/test** : `pnpm check:ci`, `pnpm lint` (Biome), `pnpm typecheck`, `pnpm -r test` (Vitest), `pnpm -r build`
- **Smoke** : `scripts/smoke-api.mjs`, `scripts/smoke-prod.mjs`
- **Agent** : `pnpm agent:context:select`, `agent:prompt:build`, `agent:skills:sync`, `agent:skills:check`
- **GitNexus** : `npx gitnexus analyze` (re-index post-commit)
- **Playwright** : `playwright.config.ts` + `e2e/`
- **PNPM monorepo** : `pnpm-workspace.yaml`, lockfile 442 Ko
- **Tooling** : Biome (lint+format), TypeScript 5.7+ avec `exactOptionalPropertyTypes`, React Compiler `à confirmer`

---

## 4. Frontend routes/pages inventory

### 4.1 Table récapitulative — 35 routes

| # | Route | Fichier | LOC | Mode | Priorité refonte | Risque refonte |
|---|-------|---------|-----|------|------------------|----------------|
| 1 | `/` (root) | `routes/__root.tsx` | 149 | shared | P1 | Faible (shell) |
| 2 | `/login` | `routes/login.tsx` | 188 | public | P1 | Faible |
| 3 | `/health`, `/healthz`, `/version` | `routes/{health,healthz,version}.tsx` | ~10 chacun | public | P3 | Nul |
| 4 | `/transactions` | `routes/transactions.tsx` | ~200 | public (export) | P2 | Faible |
| 5 | `/powens/callback` | `routes/powens/callback.tsx` | 220 | demo+admin | P2 | Moyen (OAuth) |
| 6 | `/_app` (layout) | `routes/_app.tsx` | 60 | shared | P0 | Élevé (shell) |
| 7 | `/_app/` (cockpit) | `routes/_app/index.tsx` | **689** | demo+admin | **P0** | Élevé |
| 8 | `/_app/depenses` | `routes/_app/depenses.tsx` | 426 | demo+admin | P0 | Moyen |
| 9 | `/_app/patrimoine` | `routes/_app/patrimoine.tsx` | **1004** | demo+admin | **P0** | Élevé |
| 10 | `/_app/investissements` | `routes/_app/investissements.tsx` | **971** | demo+admin | **P0** | Élevé |
| 11 | `/_app/fiscalite` | `routes/_app/fiscalite.tsx` | 595 | admin | P1 | Moyen |
| 12 | `/_app/objectifs` | `routes/_app/objectifs.tsx` | 262 | demo+admin | P1 | Faible |
| 13 | `/_app/actualites` | `routes/_app/actualites.tsx` | `à confirmer` | demo+admin | P1 | Faible |
| 14 | `/_app/sante` | `routes/_app/sante.tsx` | 418 | admin | P1 | Moyen |
| 15 | `/_app/parametres` | `routes/_app/parametres.tsx` | 262 | admin | P2 | Faible |
| 16 | `/_app/integrations` | `routes/_app/integrations.tsx` | **1072** | admin | **P0** | Élevé |
| 17 | `/_app/orchestration` | `routes/_app/orchestration.tsx` | 445 | admin | P2 | Moyen |
| 18 | `/_app/marches` | `routes/_app/marches.tsx` | `à confirmer` | admin | P1 | Moyen |
| 19 | `/_app/memoire` | `routes/_app/memoire.tsx` | `à confirmer` | demo+admin | P1 | Moyen (refonte journal) |
| 20 | `/_app/ops-env-diagnostics` | `routes/_app/ops-env-diagnostics.tsx` | `à confirmer` | admin | P3 | Faible (debug) |
| 21 | `/_app/ia/` | `routes/_app/ia/index.tsx` | `à confirmer` | demo+admin | **P0** | Élevé |
| 22 | `/_app/ia/strategie-investissement` | `routes/_app/ia/strategie-investissement.tsx` | **1216** | demo+admin | **P0** | Élevé |
| 23 | `/_app/ia/chat` | `routes/_app/ia/chat.tsx` | `à confirmer` | demo+admin | P0 | Élevé |
| 24 | `/_app/ia/memoire/` | `routes/_app/ia/memoire/index.tsx` | `à confirmer` | demo+admin | P1 | Moyen |
| 25 | `/_app/ia/memoire/graph` | `routes/_app/ia/memoire/graph.tsx` | **1860** | demo+admin | **P0** | **Critique** |
| 26 | `/_app/ia/couts` | `routes/_app/ia/couts.tsx` | `à confirmer` | admin | P2 | Faible |
| 27 | `/_app/ia/trading-lab` | `routes/_app/ia/trading-lab.tsx` | `à confirmer` | admin | P2 | Moyen |
| 28 | `/_app/signaux/` | `routes/_app/signaux/index.tsx` | `à confirmer` | admin | P2 | Moyen |
| 29 | `/_app/signaux/marches` | `routes/_app/signaux/marches.tsx` | `à confirmer` | admin | P1 | Élevé (charts) |
| 30 | `/_app/signaux/sources` | `routes/_app/signaux/sources.tsx` | `à confirmer` | admin | P2 | Faible |
| 31 | `/_app/signaux/x-twitter` | `routes/_app/signaux/x-twitter.tsx` | `à confirmer` | admin | P2 | Moyen |
| 32 | `/_app/signaux/free-firehose` | `routes/_app/signaux/free-firehose.tsx` | `à confirmer` | admin | P2 | Faible |
| 33 | `/_app/signaux/social` | `routes/_app/signaux/social.tsx` | **1206** | admin | P1 | Élevé |

LOC totaux frontend (routes + components) : **~35 600 LOC**. Cinq fichiers `routes/_app/*` dépassent 1000 LOC, signal clair de pages multi-intentions à dégonfler.

### 4.2 Détail par page critique

**`/_app/` — Cockpit principal (689 LOC)**
- Objectif : entrée quotidienne — KPIs, tendance patrimoine, dépenses du mois, connexions, objectifs, résumé Advisor digéré.
- Données : `dashboardSummary`, `dashboardAdvisor`, `financialGoals`, `powensStatus`, `attentionItems`.
- Composants : `CockpitHero`, `KpiTile`, `D3Sparkline`, `ai-advisor-panel`, `month-end-projection-card`, `wealth-history`, `powens-connections-card`, etc.
- États gérés : loading (suspense), empty (premier login), error (fail-soft widget), demo badge, admin badge.
- Dette UX visible : ~10 cartes empilées, hiérarchie pas toujours évidente, ai-advisor-panel (1013 LOC) très dense.
- Priorité refonte P0 — c'est la page de vérité du produit.

**`/_app/patrimoine` (1004 LOC)**
- Objectif : vue consolidée actifs/dettes, allocation, historique, valuation par connexion.
- Données : `dashboardSummary`, `externalInvestmentsSummary`, `externalInvestmentsPositions`.
- Dette UX : 1004 LOC, mélange table positions + chart + KPIs + breakdown allocation. Drilldown à introduire.

**`/_app/investissements` (971 LOC)**
- Objectif : portefeuille + modèle d'allocation 60/30/10 (PEA/IBKR/Binance).
- Données : `dashboardInvestmentStrategy`, positions externes.
- Dette UX : redondance partielle avec `/ia/strategie-investissement` (1216 LOC) — relation à clarifier.

**`/_app/integrations` (1072 LOC)**
- Objectif : gestion connexions Powens + IBKR + Binance, sync logs, audit trail.
- Mode : admin only.
- Dette UX : page très technique, beaucoup d'états (connecté, à reconnecter, en sync, en erreur, dégradé). Refonte = découper en cartes par provider + sous-page diagnostics.

**`/_app/ia/strategie-investissement` (1216 LOC)**
- Objectif : "Plan d'action investissement" — action recommandée, allocation 60/30/10, hypothèses, scorecard IA, qualité des données.
- Dette UX : très long écran, navigation interne peu claire `à confirmer`. Candidate à découpage en stepper ou tabs.

**`/_app/signaux/social` (1206 LOC)**
- Objectif : sentiment social X/Twitter + agrégation.
- Mode : admin.
- Dette UX : page admin/debug exposée à un niveau de nav assez haut. Question : doit-elle rester aussi exposée ?

**`/_app/ia/memoire/graph` (1860 LOC) — la plus grosse route**
- Objectif : visualisation Force Graph 3D de la mémoire Advisor.
- Composants : `KnowledgeGraph3D` (755 LOC, Three.js + react-force-graph-3d), `advisor-graph-details-panel` (~560 LOC), lenses, pin path, traversal.
- Dette : ⚠ Bundle lourd (Three.js + force-graph), pas de fallback WebGL explicite, accessibilité du graphe 3D limitée.
- Posture produit (cf. `docs/frontend/information-architecture.md`) : la carte 3D est une **mémoire dérivée**, pas une base de vérité ; ne pilote aucun ordre, paper-trading uniquement.

### 4.3 Distinction des modes par route

| Mode | Routes |
|------|--------|
| Public | `/health`, `/healthz`, `/version`, `/transactions`, `/login`, `/powens/callback` |
| Demo + admin | `/`, `/depenses`, `/patrimoine`, `/investissements`, `/objectifs`, `/actualites`, `/ia`, `/ia/strategie-investissement`, `/ia/chat`, `/ia/memoire`, `/ia/memoire/graph` |
| Admin only | `/fiscalite`, `/sante`, `/parametres`, `/integrations`, `/orchestration`, `/marches`, `/ops-env-diagnostics`, `/ia/couts`, `/ia/trading-lab`, `/signaux/*` |

Détection : `authMeQueryOptions()` → `auth.mode = 'demo' | 'admin'` → `resolveAuthViewState()` → filtre nav via `getVisibleNavItems(authViewState)`. Items de nav portent un flag `adminOnly?: boolean`. Loaders prefetch en fonction du mode (`*QueryOptionsWithMode({ mode })`).

---

## 5. Product features inventory

29 features identifiées. Notation : maturité `alpha/beta/stable`, importance `P0/P1/P2`.

| # | Feature | Description | Files clés | Pages | Maturité | Importance | Dette UX visible |
|---|---------|-------------|-----------|-------|----------|-----------|------------------|
| 1 | **Cockpit/Dashboard** | Synthèse quotidienne (KPI, advisor brief, attentions) | `routes/_app/index.tsx`, `apps/api/src/routes/dashboard/summary.ts`, `dashboard-summary.mock.ts` | `/` | stable | **P0** | Pages denses |
| 2 | **Transactions** | Liste, catégorisation auto/manuelle | `dashboard/routes/transactions.ts`, `transaction-classification.ts` | `/depenses`, `/transactions` | stable | **P0** | Table dense, peu de filtres visibles |
| 3 | **Patrimoine** | Vue consolidée actifs + allocations | `dashboard/domain/valuation-repositories.ts` | `/patrimoine` | stable | **P0** | 1004 LOC, multi-intention |
| 4 | **Comptes Powens** | OAuth banque + sync transactions | `packages/powens`, `integrations/powens/routes/*` (9 endpoints) | `/integrations` | stable | **P0** | UX admin technique |
| 5 | **Investissements internes** | Portefeuille + allocation 60/30/10 | `investment-strategy-use-cases.ts` | `/investissements` | beta | P1 | Double avec /ia/strategie |
| 6 | **External Investments** | IBKR Flex XML + Binance readonly | `packages/external-investments`, `external-investments/routes/sync.ts` | `/investissements`, `/integrations` | beta | P1 | Statuts multiples peu lisibles |
| 7 | **Market Data** | Prix indices + macro (Binance + FRED + ECB) | `dashboard-market-dataset-selector.ts` | `/marches`, `/signaux/marches` | stable | P1 | 2 pages marchés `à confirmer` |
| 8 | **News/Actualités** | Agrégation multi-providers (GDELT, HN, Bluesky, RSS) | `dashboard/services/providers/gdelt-news-provider.ts` | `/actualites` | stable | P1 | OK |
| 9 | **X/Twitter Signals** | Profils, daily sync, dedupe | `x-twitter-daily-sync.ts` | `/signaux/x-twitter` | beta | P2 | Page admin-only |
| 10 | **Free-Firehose** | Flux signaux libre | `free-firehose-orchestrator.ts` | `/signaux/free-firehose` | alpha | P2 | Très technique |
| 11 | **Social signals** | Sentiment social agrégé | `/signaux/social.tsx` 1206 LOC | `/signaux/social` | beta | P2 | Page admin trop exposée |
| 12 | **AI Advisor** | Recommandations + chat + challenges | `advisor-contract.ts`, `packages/ai/prompts/*` | `/ia`, `/ia/chat` | stable | **P0** | ai-advisor-panel 1013 LOC |
| 13 | **AI Memory / Knowledge Graph** | Neo4j + Qdrant + local fallback | `knowledge-service`, `advisor-graph-ingest.ts` | `/ia/memoire`, `/ia/memoire/graph` | beta | P1 | Graphe 3D dense, peu vulgarisé |
| 14 | **Decision Journal / Post-mortem** | Journal non persistant + post-mortem | `post-mortem-scheduler.ts` | `/memoire`, `/ia` | beta | P1 | À éclaircir |
| 15 | **Investment Strategy (plan)** | Plan d'action 60/30/10, scorecard | `dashboardInvestmentStrategy` | `/ia/strategie-investissement` | beta | **P0** | 1216 LOC monolithe |
| 16 | **Trading-Lab** | Backtesting, hypothèses, scorecard, walk-forward | `dashboard/routes/trading-lab.ts`, `apps/quant-service` | `/ia/trading-lab` | alpha | P2 | Paper-trading-only |
| 17 | **Objectifs/Goals** | Suivi objectifs financiers | `goals.ts` | `/objectifs` | beta | P1 | OK |
| 18 | **Fiscalité** | Dossier fiscal préparatoire (NON déclaration) | `dashboard/routes/fiscalite` `à confirmer` | `/fiscalite` | alpha | P1 | Posture produit claire mais UX dense |
| 19 | **Dépenses** | Tracking + budgets + projection fin de mois | `dashboard/routes/transactions.ts` | `/depenses` | stable | **P0** | Densité élevée |
| 20 | **Santé patrimoine** | Indicateurs santé, data quality, anomalies | `data-quality-types.ts` | `/sante` | beta | P1 | Mix entre santé financière et qualité technique données |
| 21 | **Ops/Env Diagnostics** | Health providers, env vars, feature flags | `env-diagnostics.ts` | `/ops-env-diagnostics` | stable | P3 | Debug pur — à confiner |
| 22 | **Orchestration/Jobs** | Gestion jobs, CTA policy runtime | `orchestration.tsx` 445 LOC | `/orchestration` | beta | P2 | Très technique |
| 23 | **Integrations dashboard** | Connexions Powens + EI + status | `integrations.tsx` 1072 LOC | `/integrations` | stable | P1 | Mélange config + diagnostic |
| 24 | **Paramètres** | Préférences UI, push notifications | `parametres.tsx` 262 LOC | `/parametres` | beta | P2 | Léger |
| 25 | **Auth/Login** | Session, demo/admin split | `auth/routes.ts`, `/login` | `/login` | stable | **P0** | PixelBlast backdrop lourd |
| 26 | **PWA / Push notifications** | Service worker + push | `notifications/routes/push.ts`, `pwa-install-prompt.tsx` | (système) | beta | P2 | OK |
| 27 | **Demo mode** | Fixtures déterministes, scenario library | `mocks/demo-*.ts` (14 fichiers), `demo-scenario-library.ts` | tous | stable | **P0 invariant** | OK (bien isolé) |
| 28 | **Admin mode** | Internal token + admin-only routes | `feature-flags-audit.ts`, internal-token guards | tous (admin) | stable | **P0 invariant** | OK |
| 29 | **AI Cost Tracking** | LLM costs + usage | `pricing/registry.ts`, `cost-ledger` | `/ia/couts` | beta | P2 | OK |

---

## 6. Current information architecture

### 6.1 Structure actuelle (3 groupes de nav)

D'après `apps/web/src/components/shell/app-sidebar.tsx` et `docs/frontend/information-architecture.md` :

**Groupe 1 — Cockpit personnel** (◈) — 6 items, usage quotidien
- `/`, `/depenses`, `/patrimoine`, `/investissements`, `/fiscalite`, `/objectifs`

**Groupe 2 — Advisor IA** (□) — 5 items
- `/ia`, `/ia/strategie-investissement`, `/ia/chat`, `/ia/memoire`, `/ia/memoire/graph`

**Groupe 3 — Intelligence & Admin** (≋) — 11 items (admin-only)
- `/signaux`, `/signaux/marches`, `/signaux/sources`, `/signaux/x-twitter`, `/signaux/free-firehose`, `/signaux/social`, `/integrations`, `/parametres`, `/orchestration`, `/ops-env-diagnostics`, `/ia/couts`, `/ia/trading-lab`

Cette structure est **déjà bien pensée** (cf. ADR / refactor 2026-04-26 documenté dans `docs/frontend/navigation-refactor-audit.md`). Elle sépare correctement quotidien / advisor / expert. Refonte = la respecter et la clarifier davantage, **pas la refaire**.

### 6.2 Pages surchargées

| Page | LOC | Symptôme | Recommandation |
|------|-----|----------|----------------|
| `/_app/ia/memoire/graph` | 1860 | Graphe 3D + panneau détails + lenses + traversal + pin paths | Découper le panneau latéral en sous-composants, sortir lenses dans drawer |
| `/_app/ia/strategie-investissement` | 1216 | Action principale + PEA/IBKR/Binance + 60/30/10 + hypothèses + scorecard + qualité données | Stepper ou tabs : "Action / Allocation / Hypothèses / Qualité" |
| `/_app/signaux/social` | 1206 | Agrégation sentiment + sources + signals + dedupe | Drilldown par signal type, masquer dedupe en admin debug |
| `/_app/integrations` | 1072 | 3 providers × multiples statuts × audit trail | Page par provider + sous-onglet audit |
| `/_app/patrimoine` | 1004 | KPIs + history + allocation + connexions + EI résumé | Découper en sections collapsibles ou tabs `aperçu / détail / historique` |
| `/_app/investissements` | 971 | Positions + 60/30/10 + benchmarks | Clarifier la frontière avec `/ia/strategie-investissement` |
| `/_app/` (cockpit) | 689 | ~10 cards | Hiérarchie visuelle plus marquée (KPI > attention > brief > graphes) |
| `/_app/fiscalite` | 595 | Dossier préparatoire + comptes + formulaires + manquants | Conserver tel quel, soigner la structure de revue |

### 6.3 Informations trop techniques pour user final

- **Sync logs Powens** dans `/integrations` (timestamps, codes erreur 401/403, runs ID) — à masquer derrière "voir détails" admin
- **Audit trail Powens** — admin uniquement, OK
- **Provider diagnostics** (capabilities, redaction logs, error codes) — `/ops-env-diagnostics` est le bon endroit, ne pas remonter sur des pages user
- **Knowledge graph schema/stats** (Neo4j vs local fallback, degradation reasons) — visible sur `/ia/memoire`, à vulgariser ou retirer côté demo
- **Feature flags audit warnings** au startup — admin uniquement
- **AI cost ledger** brut — page `/ia/couts` OK ; mais référence aux tokens/modèles doit rester technique
- **X/Twitter daily sync metrics** — admin
- **Free-firehose raw data** — admin
- **Trading-lab walk-forward + pattern detection** — admin/expert

### 6.4 Informations vulgarisables

- **Advisor confidence** : devrait être affichée comme barre + libellé ("confiance moyenne", "à confirmer"), pas en pourcentage cru
- **Fraîcheur data** : "il y a 2h" plutôt que timestamp UTC
- **Provenance** : icône source + tooltip plutôt que clé technique provider
- **Hypothèses IA** : à présenter comme "Ce que l'Advisor suppose" en langage simple
- **Risques 60/30/10** : visualisation alloc + écart vs cible plutôt que tableau %

### 6.5 Mélange demo/admin/debug par page

| Surface | Mélange observé | Recommandation |
|---------|-----------------|----------------|
| `/_app/` cockpit | Demo et admin partagent l'écran mais badges visibles | OK, garder le badge top-bar |
| `/_app/sante` | Mélange "santé financière" + "qualité technique données" | Séparer en 2 pages ou 2 sections claires |
| `/_app/orchestration` | Très admin, mais le concept "CTA policy" est obscur | Renommer en termes produit ("Automations") |
| Advisor brief sur `/` | Affiche parfois statuts techniques (provider unavailable, fallback) | Déléguer ces messages à un toast / banner dégradé, pas au cœur |
| `/_app/integrations` | Config user + diagnostics admin sur même page | Carte par provider + drawer "Diagnostic" |

### 6.6 Libellés trop techniques

Exemples typiques observés ou anticipés (cf. routes + composants) :
- "advisor-knowledge", "knowledge-context-bundle", "data-quality" → vulgariser
- "free-firehose", "social-signal", "x-twitter-daily-sync" → cf. nav (signaux/marchés, signaux/réseaux sociaux, signaux/X)
- "derived-recompute", "attention-rebuild" → masquer ou renommer
- "DEMO_MODE_FORBIDDEN" → message d'erreur user-friendly
- "POWENS_TOKEN_EXPIRED" → "Connexion bancaire expirée — reconnectez votre compte"

---

## 7. Current UI audit

### 7.1 Composants par famille (83 composants .tsx dans `apps/web/src/components`)

**Shell (4)** — `components/shell/`
- `app-sidebar.tsx` (195) — sidebar collapsible desktop + mobile bottom nav, 3 groupes nav, motion/react avec ease-out-expo, AnimatePresence staggered
- `topbar.tsx` (104) — header sticky, glass-surface, demo/admin badges, CommandPaletteTrigger
- `command-palette.tsx` (309) — Cmd+K, fuzzy match routes
- `theme-toggle.tsx` (80) — dark/light + localStorage + prefers-reduced-motion

**Dashboard (15+)** — `components/dashboard/`
- `ai-advisor-panel.tsx` (**1013 LOC**) ⚠ — large widget recommandations Advisor
- `dashboard-health-panel.tsx` (180)
- `expense-structure-card.tsx` (260) — pie d3
- `expenses-list.tsx`, `metric-card.tsx`, `month-end-projection-card.tsx` (400), `monthly-category-budgets-card.tsx` (370), `news-feed.tsx`, `news-signal-card.tsx`, `personal-financial-goals-card.tsx` (**921 LOC**) ⚠, `portfolio-summary.tsx`, `powens-connections-card.tsx`, `push-notification-card.tsx`, `api-status-card.tsx`, `wealth-history.tsx`
- `topbar.tsx` (17) ⚠ **non importé** (doublon mort avec `shell/topbar.tsx`)
- `sidebar-nav.tsx` — possiblement legacy `à confirmer`

**Advisor (7)** — `components/advisor/`
- `knowledge-graph-3d.tsx` (755) — Three.js + react-force-graph-3d, dynamic import, presets cinematic/standard/performance, SSR-safe
- `advisor-graph-details-panel.tsx` (~560)
- `advisor-decision-ui.tsx` (370)
- `behavior-analytics-card.tsx` (260), `decision-recorder.tsx` (270), `eval-scorecard.tsx` (300), `post-mortem-feed.tsx` (250)

**Markets (3)** — `components/markets/`
- `markets-dashboard.tsx` (680 LOC) — lightweight-charts + grid + filters
- `relative-performance-ribbon.tsx` (~200)
- `top-movers-chroma.tsx` (~100)

**Trading-Lab (13)** — `components/trading-lab/`
- `backtest-runner.tsx` (~500), `hypothesis-lab.tsx` (~500), `pattern-detection-panel.tsx` (~600), `strategy-editor.tsx` (420), `strategy-scorecard-card.tsx` (~500), `equity-curve-chart.tsx`, `drawdown-chart.tsx`, `candle-chart.tsx`, `strategy-picker.tsx`, `path-preview.tsx`, `data-source-badge.tsx`, `market-data-source-picker.tsx`

**Surfaces (8) — composants canoniques DA** — `components/surfaces/`
- `kpi-tile.tsx` (105) ⭐ — SpotlightCard + CountUp, tones plain/brand/violet/positive/negative/warning
- `cockpit-hero.tsx` (~180) — TextPressure + RotatingText
- `panel.tsx` (~110), `page-header.tsx` (~140), `action-dock.tsx` (~200), `pixel-image-reveal.tsx` (~130), `range-pill.tsx` (~100), `status-dot.tsx` (~50)

**Brand (5)** — `components/brand/`
- `brand-mark.tsx` (80), `circular-emblem.tsx` (60), `aurora-canvas.tsx` (120), `aurora-backdrop.tsx` (60), `pixel-blast-backdrop.tsx` (130)

**ReactBits (22)** — `components/reactbits/` — copiés depuis react-bits.dev (TS + Tailwind, attribution maintenue)
- Animations : `aurora-shape`, `border-glow` (370), `circular-text`, `shiny-text`, `spotlight-card`, `text-pressure` (400), `variable-proximity` (250)
- Viz : `chroma-grid` (250), `count-up` (150), `rotating-text` (220)
- Misc : `antigravity` (250), `dock` (200), `folder` (220), `glass-surface` (400), `shape-blur` (280), `staggered-menu` (600)
- Heavy : `liquid-ether.tsx` (**1254 LOC**) ⚠, `magic-bento.tsx` (**862 LOC**) ⚠, `pixel-blast.tsx` (**705 LOC**) ⚠, `pixel-trail`, `pixel-transition`

**UI primitives (2)** — `components/ui/`
- `d3-sparkline.tsx` (~200) — SVG sparkline responsive
- `ascii-brand.tsx` (~100) — glyphes ASCII utility

**Personal (1)** — `components/personal/`
- `personal-ux.tsx`

**PWA / utility (2)** — racine `components/`
- `pwa-install-prompt.tsx`, `toast-viewport.tsx`

### 7.2 Layouts & navigation

**Root → AppLayout** :
```
<__root>
  <html.dark forced>
    <body>
      <_app>
        <AppSidebar collapsed>          // desktop 248px / 72px collapsed
        <main lg:ml-[248px|72px]>
          <Topbar>
          <main #main-content>
            <AnimatePresence key={pathname}>
              <Outlet />
            </AnimatePresence>
          </main>
        </main>
        <MobileNav>                     // lg:hidden, bottom nav + drawer
        <CommandPalette>                // Cmd+K
        <PwaInstallPrompt>
        <ToastViewport>
```

**Sidebar** : transition `margin-left` avec `var(--duration-slow)` + `var(--ease-out-expo)`. Item actif : gradient rose/violet + spring layoutId. 3 groupes (cockpit / ia / expert) avec glyphes ASCII (◈ □ ≋).

**Mobile bottom nav** : 4 primaires (`/`, `/depenses`, `/patrimoine`, `/ia`) + bouton "⋯" → drawer staggered.

**Topbar** : BrandMark (mobile) + CommandPaletteTrigger + badges Demo/Admin + ThemeToggle.

### 7.3 Cards / tables / forms / states

| Famille | État | Problèmes | Opportunités |
|--------|------|-----------|--------------|
| **Cards** | OK — `Panel`, `KpiTile`, multiples cards dashboard/advisor | Densité parfois excessive, hiérarchie titre/contenu inégale | Standardiser un seul `Panel` avec props `tone`, `density`, `collapsible` |
| **Tables** | TanStack Table sur transactions, autres tables ad hoc | Pas de table partagée packages/ui ; UX scroll-x sur mobile à vérifier | Créer `DataTable` réutilisable avec sticky header + virtualization optionnelle |
| **Forms** | TanStack Form + `<Input>` from packages/ui | Validation pattern non documenté `à confirmer` | Documenter pattern + créer composant `Field` |
| **Modales/Dialogs** | Radix UI (radix-ui dep) | Usage `à confirmer` — chercher Dialog dans code | Standardiser via packages/ui |
| **Buttons** | `packages/ui/components/ui/button.tsx` | Bouton OK, mais variants Aurora utilisés ad hoc | Documenter les variants finaux |
| **Badges** | `packages/ui/components/ui/badge.tsx` + ad hoc | Demo/Admin badges custom dans topbar | Élever `ModeBadge` au DS |
| **Empty states** | Quelques cas (cf. ai-advisor "no recommendations") | Pas systématique | Convention `bg-grid-dots` + icône + CTA |
| **Loading states** | `animate-shimmer` défini dans globals.css | Usage partiel | Forcer skeleton via `Skeleton` partagé |
| **Error states** | Fail-soft widgets (sera vu dans `finance-os-observability-failsoft`) | UX d'erreur peu standardisée | Composant `WidgetError` + `WidgetDegraded` |
| **Data viz** | d3-sparkline + lightweight-charts + force-graph-3d + chroma-grid | Trois libs charts différentes | Voir §12 |
| **Micro-interactions** | motion/react sur sidebar, topbar, layout transitions | Bien fait, ease-out-expo + spring | Garder, étendre aux cards |
| **Responsive** | Tailwind v4, breakpoints standards, mobile bottom nav | Pages dense → mobile à tester `à confirmer` | Audit responsive systématique |

### 7.4 Doublons / dette structurelle

- ⚠ `components/dashboard/topbar.tsx` (17 LOC, non importé) — doublon mort de `components/shell/topbar.tsx`
- ⚠ `components/dashboard/sidebar-nav.tsx` — probable legacy avant refonte sidebar `à confirmer`
- ⚠ Deux libs d'animation : `motion@12.38.0` (Framer Motion) + `gsap@3.15.0` — gsap utilisé ? à vérifier, si non utilisé → supprimer
- ⚠ Trois libs de graphes : `d3@7.9.0` (sparklines), `lightweight-charts@5.2.0` (markets/trading-lab), `react-force-graph-3d@1.29.1` + `three@0.183.2` (knowledge graph) — justifié par usage différent, mais bundle à surveiller
- ⚠ `personal-ux.tsx` — composants utility orphelins `à confirmer`
- ⚠ Reactbits "Heavy" non utilisés universellement : `liquid-ether` (1254 LOC), `antigravity` (250), `shape-blur` (280) — à vérifier réellement utilisés

---

## 8. Current art direction audit

### 8.1 Description honnête de la DA actuelle

**Aurora Pink** est une DA **distinctive, intentionnelle, cohérente** (cf. `DESIGN.md`).

- **Identité forte** : rose magenta + violet électrique en signature, jamais utilisés en sémantique finance (séparation rose=identité vs positive=emerald/negative=coral/warning=amber)
- **Surfaces sombres chaudes** : `oklch(0.12 0.02 325)` midnight plum en dark, `oklch(0.975 0.006 355)` warm pearl en light — jamais grey clinique
- **4 niveaux d'élévation** : `--surface-0/1/2/3` documentés
- **Typographie cockpit** : Inter Variable + JetBrains Mono Variable (`.font-financial` avec `tnum`, `zero`) ; Compressa VF chargé à la demande pour TextPressure hero
- **Composants signature** : TextPressure (hero), RotatingText, ShinyText, VariableProximity, CountUp, SpotlightCard (KpiTile), BorderGlow, AuroraShape
- **Effets retro-cockpit** : `.texture-scanlines`, `.texture-grain`, `.bg-grid-dots`, `.bg-aurora-mesh`
- **Motion** : ease-out-expo / ease-spring / ease-aurora, durées 120/200/350ms, `prefers-reduced-motion` respecté à 14 endroits + au layer CSS

### 8.2 Ce qui fonctionne

- ✅ **Token system OKLCH** centralisé (489 LOC `packages/ui/src/styles/globals.css`)
- ✅ **Dark / light duality** complète, toggle persisté
- ✅ **Sémantique finance dissociée du brand** — règle non négociable respectée
- ✅ **Chart palette 7 couleurs** — diverse et harmonieuse (rose, violet, indigo, teal, emerald, gold, coral)
- ✅ **Identité distinctive** — Finance-OS n'est pas un clone shadcn
- ✅ **Documentation visuelle** complète (DESIGN.md + docs/frontend/design-system.md)

### 8.3 Ce qui ne fonctionne pas / risques

- ⚠ **Effets décoratifs lourds** : `liquid-ether` (1254 LOC), `pixel-blast` (705 LOC), `magic-bento` (862 LOC), `aurora-canvas` Canvas — impact bundle/perf à mesurer
- ⚠ **Tokens hardcodés résiduels** : quelques `oklch(...)` inline dans `app-sidebar.tsx` (lignes 50, 169–171, 239–242 `à confirmer`) — acceptable pour states dynamiques mais à documenter
- ⚠ **Skill `finance-os-ui-cockpit` obsolète** : référence palette amber/gold (legacy) au lieu d'Aurora Pink — divergence avec DESIGN.md, à resync
- ⚠ **GSAP non utilisé visible** : 3.15.0 dans deps mais usage à vérifier (potentiel deadweight)
- ⚠ **Très peu de composants dans `packages/ui`** : KpiTile, Panel, RangePill, StatusDot, PageHeader sont des **patterns canoniques** mais vivent dans `apps/web/src/components/surfaces/` — friction si une autre app (desktop ?) veut les réutiliser

### 8.4 Incohérences détectées

| Sujet | Localisation | Détail |
|-------|-------------|--------|
| Palette legacy amber | `.agentic/source/skills/finance-os/ui-cockpit/SKILL.md` | À sync avec DESIGN.md (Aurora Pink) |
| Loaders : `animate-pulse` vs `animate-shimmer` | Composants divers | DESIGN.md préconise shimmer ; vérifier qu'aucun `animate-pulse` ne traîne |
| Trois libs charts | d3 + lightweight-charts + force-graph-3d | Acceptable mais à justifier dans docs |
| Topbar duplicate | `components/dashboard/topbar.tsx` (17, mort) vs `components/shell/topbar.tsx` (104, actif) | Suppression candidate |

### 8.5 Éléments à conserver vs remplacer

| Conserver ✅ | Remplacer ou alléger ⚠ |
|--------------|--------------------------|
| Palette OKLCH Aurora Pink (rose 355°, violet 295°) | Effets décoratifs Canvas lourds non essentiels (pixel-blast, liquid-ether s'ils ne sont pas réellement employés sur des surfaces clés) |
| Sémantique finance emerald/coral/amber | `animate-pulse` résiduel → `animate-shimmer` |
| 4 niveaux de surface | Tokens hardcodés inline `app-sidebar.tsx` (à terme) |
| Typo Inter + JetBrains Mono | gsap si non utilisé |
| Surfaces canoniques (KpiTile, Panel, etc.) | Topbar dashboard mort |
| Motion ease-out-expo/spring/aurora | Reactbits Heavy non employés (audit usage) |
| prefers-reduced-motion respect | — |

### 8.6 Risques si refonte totale DA

- 🚨 Perdre l'identité distinctive (Aurora Pink est rare et travaillée — un retour shadcn par défaut serait une régression)
- 🚨 Casser la sémantique finance (rose ≠ signal) si une nouvelle palette mixe rose et statuts métiers
- 🚨 Perdre les composants signature (TextPressure hero, KpiTile SpotlightCard, etc.) qui font l'âme du produit
- 🚨 Régressions a11y si motion/réduced-motion oubliés dans un refactor

**Recommandation** : **garder Aurora Pink** comme socle, raffiner sa cohérence et son application plutôt que la remplacer.

---

## 9. Design system and shared components audit

### 9.1 `packages/ui` — état actuel (⚠ très léger)

9 fichiers seulement :
- `styles/globals.css` (489 LOC) — **tokens canoniques** ✅
- `lib/utils.ts` — `cn()` helper
- `components/index.ts` — barrel export
- `components/ui/button.tsx`, `card.tsx`, `badge.tsx`, `avatar.tsx`, `input.tsx`, `separator.tsx`

**Total composants partagés** : 6 primitives, ~600 LOC

### 9.2 Composants `apps/web` qui devraient remonter dans `packages/ui`

| Candidat | LOC | Localisation actuelle | Raison |
|----------|-----|------------------------|--------|
| `KpiTile` | 105 | `surfaces/kpi-tile.tsx` | Pattern canonique cockpit |
| `Panel` | ~110 | `surfaces/panel.tsx` | Workhorse data-dense |
| `RangePill` | ~100 | `surfaces/range-pill.tsx` | Segmented control |
| `PageHeader` | ~140 | `surfaces/page-header.tsx` | Eyebrow + titre + actions |
| `StatusDot` | ~50 | `surfaces/status-dot.tsx` | Indicateur état |
| `ActionDock` | ~200 | `surfaces/action-dock.tsx` | CTA dock |
| `BrandMark` | 80 | `brand/brand-mark.tsx` | Logo réutilisable |
| `D3Sparkline` | ~200 | `ui/d3-sparkline.tsx` | Charts léger réutilisable |
| `ThemeToggle` | 80 | `shell/theme-toggle.tsx` | Réutilisable |

**Recommandation** : créer `packages/ui/src/components/surfaces/` et y monter ces composants en première intention.

### 9.3 Composants manquants au DS

À créer dans la refonte :
- `DataTable` (wrap TanStack Table avec sticky header + virtualization + filtres)
- `Skeleton` standard (basé sur animate-shimmer)
- `Field` (label + input + error message + helper)
- `WidgetError` / `WidgetDegraded` (fail-soft states)
- `ModeBadge` (Demo / Admin)
- `Dialog` / `Drawer` (wrapping Radix UI)
- `Tooltip` (wrapping Radix UI)
- `Tabs` (wrapping Radix UI)
- `Toast` (wrapping toast lib `à confirmer`)
- `EmptyState` (icône + titre + sous-titre + CTA)
- `ProgressBar` (objectifs, confidence)
- `Stepper` (advisor / strategy)

### 9.4 Duplications et patterns récurrents

- "Card avec rail coloré + header tone" récurrent : à standardiser via `Panel` props
- Loading shimmer dupliqué : à centraliser via `Skeleton`
- "Empty state avec dots grid" récurrent : à standardiser via `EmptyState`
- Inline `oklch(...)` dans plusieurs composants : à remplacer par variables CSS

### 9.5 Maturité du DS

| Aspect | Niveau |
|--------|--------|
| Tokens (couleurs, typo, motion, shadows) | **Élevé** ✅ |
| Composants primitives partagés | **Faible** ⚠ |
| Documentation pattern | **Moyen** (docs/frontend/design-system.md) |
| Couverture states (loading/empty/error) | **Faible** — par convention plutôt que par composants |
| Cohérence dark/light | **Élevé** ✅ |
| A11y patterns documentés | **Faible** ⚠ |

---

## 10. Accessibility audit

Audit statique (lecture du code, sans tests automatisés type axe). Données issues des relevés Explore.

### 10.1 Points forts ✅

- **107 instances `aria-*` détectées** dans `apps/web/src/components/`
- `aria-label` sur boutons icônes (sidebar collapse, theme toggle, command palette)
- `aria-hidden="true"` sur layers décoratifs (aurora mesh, glyphes ASCII décoratifs, canvas backgrounds)
- `aria-label="Navigation principale"` sur `<nav>`
- Sémantique HTML correcte : `<nav>`, `<header>`, `<main id="main-content">`, `<button type="button">`
- SR-only skip-to-main link dans `__root.tsx`
- **14 instances `prefers-reduced-motion`** : `useReducedMotion()` motion/react + fallback CSS (`globals.css` lignes 132–141 : toutes animations → 0.01ms)
- Focus rings définis (`.focus-glow`)
- Contraste primary rose (oklch(0.72 0.19 355)) sur dark — WCAG AAA `à confirmer` par mesure

### 10.2 Risques / écarts ⚠

| Risque | Localisation | Sévérité | Action |
|--------|-------------|----------|--------|
| Pas de fallback WebGL pour KnowledgeGraph3D | `components/advisor/knowledge-graph-3d.tsx` | Moyen | Ajouter état "graphe non disponible" |
| Canvas effets décoratifs sans aria | aurora-canvas, pixel-blast, liquid-ether | Faible (décoratif) | Vérifier `aria-hidden` ou `role="presentation"` partout |
| Densité info pages 1000+ LOC | patrimoine, integrations, ia/memoire/graph | Moyen | Hiérarchie + landmarks ARIA |
| Tables ad hoc (pas DataTable partagé) | transactions, positions, sync runs | Moyen | Standardiser via DataTable avec ARIA grid/table |
| Charts d3/lightweight-charts | sparklines, markets-dashboard | Moyen | Ajouter `<title>`, `aria-label`, description textuelle |
| Command palette Cmd+K sans hint visible | `command-palette.tsx` | Faible | Hint mobile + keyboard discovery |
| Color contrast `muted-foreground` `oklch(0.64 0.02 325)` | tokens | Faible | Mesurer contrast vs background `à confirmer` |
| Modal/Drawer ARIA | Radix utilisé `à confirmer` | Faible (Radix gère) | Vérifier focus trap & escape |
| Form errors a11y | Forms TanStack | Moyen | Pattern `aria-describedby` + role="alert" |
| Reduced motion sur lourds reactbits | liquid-ether, pixel-blast | Moyen | Garantir freeze sous prefers-reduced-motion |

### 10.3 Quick wins

1. Ajouter `<canvas role="presentation" aria-hidden="true">` à tous les canvas décoratifs
2. Donner un `<title>` ou `aria-label` à chaque SVG sparkline informatif
3. Créer un composant `WidgetUnavailable` accessible pour fallbacks (WebGL, fail-soft)
4. Mesurer contrast tokens muted via outil OKLCH→sRGB
5. Documenter conventions a11y dans `docs/frontend/accessibility.md` (à créer)

### 10.4 Recommandations refonte

- **Phase a11y dédiée** dans la refonte (cf. §18, phase 8)
- Adopter `axe-core` en CI pour `apps/web` (Playwright a11y tests)
- Créer un skill `accessibility-reviewer` interne avec checklist par composant
- Auditer KnowledgeGraph3D : alternative tableau filtrable comme fallback

---

## 11. Frontend performance audit

### 11.1 Dépendances lourdes `apps/web/package.json`

| Dep | Version | Usage | Poids estimé |
|-----|---------|-------|--------------|
| `three` | 0.183.2 | Knowledge graph 3D + reactbits Canvas | ~600 KB |
| `react-force-graph-3d` | 1.29.1 | `knowledge-graph-3d.tsx` (dynamic import) | ~200 KB |
| `@react-three/fiber` | 9.6.0 | Reactbits 3D | ~100 KB |
| `@react-three/drei` | 10.7.7 | Reactbits 3D helpers | ~80 KB |
| `postprocessing` | 6.39.0 | Effets reactbits | ~50 KB |
| `d3` | 7.9.0 | Sparklines + chroma | ~200 KB (à tree-shaker) |
| `lightweight-charts` | 5.2.0 | Markets / trading-lab | ~100 KB |
| `gsap` | 3.15.0 | ⚠ Usage incertain — duplication potentielle avec motion | ~80 KB |
| `motion` | 12.38.0 | Animations (UI) | ~50 KB |
| `cmdk` | 1.1.1 | Command palette | ~10 KB |
| `radix-ui` | 1.4.3 | Composants headless | tree-shakable |
| `@tanstack/*` | varies | Router, query, table, form, store, db | bundle modulaire |

**Bundle critique** : `/ia/memoire/graph` charge potentiellement Three + force-graph + d3 → ~1.1 MB JS (estimé).

### 11.2 SSR / hydration

- ✅ TanStack Start (Nitro) avec SSR enabled
- ✅ Dynamic imports pour heavy 3D (`knowledge-graph-3d.tsx`)
- ✅ `typeof window !== 'undefined'` guards dans reactbits
- ✅ Route loaders prefetch query data côté serveur (`authMe`, dashboard summary, etc.)
- ⚠ React Compiler : `babel-plugin-react-compiler@1.0.0` dans devDeps — activation effective `à confirmer` dans vite config
- ⚠ Une seule directive `"use client"` trouvée — TanStack Start gère côté serveur par défaut

### 11.3 Risques de perf

| Risque | Source | Sévérité |
|--------|--------|----------|
| Bundle splitting `/ia/memoire/graph` | three + force-graph-3d + 1860 LOC route | **Élevé** |
| Heavy reactbits chargés inutilement | liquid-ether 1254, magic-bento 862, pixel-blast 705 | **Moyen** (à vérifier usage) |
| Re-renders cards dashboard | dashboard 15+ cards avec props changeantes | Moyen |
| Hydration mismatch sur SSR | `typeof window` checks + theme dark forced | Faible |
| Login PixelBlast Canvas | `pixel-blast-backdrop.tsx` | Faible (login page courte) |
| Tables transactions denses | `/depenses`, transactions list | Moyen (virtualization absente ?) |
| Charts trading-lab | candle-chart + equity-curve + drawdown × pages | Moyen |
| Polices Inter + JetBrains Mono Variable | woff2 + fontsource | Faible (variable fonts efficaces) |
| GSAP fantôme | `gsap` dans deps mais peut-être non utilisé | Faible (dead weight) |

### 11.4 Recommandations performance

1. **Mesurer** : Lighthouse + Web Vitals sur `/`, `/ia/memoire/graph`, `/signaux/marches`, `/_app/integrations`, `/login`
2. **Bundle analyzer** : `vite-bundle-visualizer` ou équivalent, identifier hotspots
3. **Lazy load** systématique des reactbits "Heavy" (liquid-ether, magic-bento, pixel-blast) — déjà partiellement fait
4. **Virtualization** : ajouter sur listes transactions/positions longues (TanStack Virtual)
5. **Audit `gsap`** : si non utilisé, supprimer
6. **Code split** par route : déjà par défaut via TanStack Router file-based, vérifier les imports synchronisés
7. **Image optimization** : check si Next/Image équivalent dans TanStack Start `à confirmer`
8. **Service Worker / PWA** : valider stratégies cache (PwaInstallPrompt présent)
9. **React Compiler** : confirmer activation pour éliminer memo manuels
10. **Server Components** : explorer si TanStack Start expose pattern équivalent

### 11.5 Pages à surveiller après refonte

- `/_app/` (cockpit) — 689 LOC route + ai-advisor-panel 1013 LOC
- `/_app/ia/memoire/graph` — bundle 3D
- `/_app/signaux/marches` — charts
- `/_app/integrations` — densité
- `/_app/ia/strategie-investissement` — 1216 LOC

---

## 12. Data visualization audit

Finance-OS manipule un volume important de données financières. Trois familles de visualisation cohabitent.

### 12.1 Bibliothèques utilisées

| Lib | Usage | Pertinence | Composants |
|-----|-------|-----------|-----------|
| **d3** | Sparklines + chroma-grid colors | ✅ Justifié pour sparklines custom | `d3-sparkline.tsx`, `top-movers-chroma.tsx`, `expense-structure-card.tsx` |
| **lightweight-charts** (TradingView) | Candles + equity + drawdown | ✅ Standard finance | `markets-dashboard.tsx`, `trading-lab/*.tsx`, `candle-chart.tsx` |
| **react-force-graph-3d + three** | Knowledge graph 3D | ✅ Identité advisor | `knowledge-graph-3d.tsx` |

### 12.2 Types de visualisations actuelles

| Type | Pages | Composants | État |
|------|-------|-----------|------|
| Sparklines | cockpit, patrimoine | `d3-sparkline` | OK |
| Pie/donuts | depenses, patrimoine | `expense-structure-card` | OK, lisibilité à vérifier |
| Candle/OHLC | markets, trading-lab | `candle-chart` | OK |
| Equity curve | trading-lab | `equity-curve-chart` | OK |
| Drawdown | trading-lab | `drawdown-chart` | OK |
| Force graph 3D | `/ia/memoire/graph` | `knowledge-graph-3d` | ⚠ Dense, peu vulgarisé |
| Chroma grid | top movers | `top-movers-chroma` | OK |
| Allocation breakdown | investissements | ad hoc | À standardiser |
| Range pill / segmented | partout | `range-pill` (surface) | OK |
| KPI tiles | partout | `KpiTile` (CountUp + SpotlightCard) | OK |
| Sentiment / social ribbon | signaux/social | `relative-performance-ribbon` | OK |
| Status dot | partout | `status-dot` | OK |

### 12.3 Problèmes / dette data viz

- ⚠ **Pas de palette charts documentée par série** (les 7 couleurs `--chart-1..7` existent mais l'ordre n'est pas toujours respecté)
- ⚠ **Tableaux denses** sans virtualization ni filtres typés
- ⚠ **Confidence / fraîcheur Advisor** affichées de façon hétérogène (parfois %, parfois timestamp, parfois badge)
- ⚠ **Knowledge graph 3D** : utilisable par experts, opaque pour user — pas de mode "tableau" alternatif
- ⚠ **Allocation 60/30/10** : visualisation à standardiser (drift vs cible)
- ⚠ **Risque / volatility** : pas de pattern visuel cohérent
- ⚠ **Données manquantes** (fiscalité) : pas de motif visuel clair pour "DONNÉE MANQUANTE" vs "ZÉRO"

### 12.4 Règles futures recommandées pour la data viz Finance-OS

| Situation | Visualisation préconisée |
|-----------|--------------------------|
| Une seule métrique critique | `KpiTile` (CountUp + sparkline + delta) |
| Comparaison période | Sparkline + delta % colorisé positive/negative |
| Distribution catégorielle (dépenses, allocation) | Donut + légende avec valeurs absolues |
| Série temporelle dense (prix, equity) | `lightweight-charts` candle ou line |
| Comparaison N entités sur 1 métrique | Bar horizontal trié (lisibilité > sexy) |
| Drilldown N→1 | Master/detail panel, jamais surimposition |
| Données incertaines (advisor) | Bande de confidence (intervalles) + libellé |
| Données dégradées / fail-soft | Composant `WidgetDegraded` + raison textuelle |
| Données manquantes | Cadre pointillé + "Donnée manquante — pourquoi" |
| Fraîcheur | Relative ("il y a 2h") + couleur tone (fresh/stale/stale-warning) |
| Provenance | Icône + tooltip source + lien drilldown |
| Risque | Échelle 1–5 + couleur sémantique (positive→warning→negative) |
| Confiance | Score 0–1 → libellé + barre progress + sources |
| Knowledge graph | 2 modes : 3D (exploration) + table filtrable (accessible/lisible) |

### 12.5 Recommandation

Créer un skill / doc `data-visualization-patterns.md` qui codifie ces règles + une **palette charts officielle** stricte (ordre, semantic, accessibilité couleur).

---

## 13. AI Advisor UX audit

### 13.1 Surfaces Advisor actuelles

| Route | Rôle |
|-------|------|
| `/ia` | Hub Advisor : synthèse + recommandations + hypothèses + questions + journal |
| `/ia/strategie-investissement` | Plan d'action 60/30/10 + scorecard + hypothèses + qualité données |
| `/ia/chat` | Conversation directe avec Advisor |
| `/ia/memoire` | Inspection mémoire dérivée (texte) |
| `/ia/memoire/graph` | Visualisation force graph 3D |
| `/ia/couts` (admin) | LLM costs ledger |
| `/ia/trading-lab` (admin) | Backtest, hypothesis lab |

Composants : `ai-advisor-panel` (1013 LOC), `advisor-decision-ui` (370), `advisor-graph-details-panel` (~560), `behavior-analytics-card` (260), `decision-recorder` (270), `eval-scorecard` (300), `post-mortem-feed` (250).

Backend : `packages/ai` (Claude + OpenAI providers, prompts chat-grounded, daily-brief, post-mortem, recommendation-challenge, transaction-labels, evals, scorers, budget-policy, pricing-registry), `dashboard/routes/advisor*` (14 endpoints incluant advisor, advisor-v2, advisor-replay, advisor-knowledge, advisor-fine-tuning-readiness, decision-journal, advisor-eval-trends), `knowledge-service` Python.

### 13.2 Structure attendue (cf. `docs/frontend/information-architecture.md`)

L'Advisor est organisé autour de 6 zones :
1. **Synthèse** — ce que l'Advisor voit, ce qui change, sain vs attention
2. **Conseils & recommandations** — pourquoi maintenant, données, hypothèses, risques, confiance, prochaine question
3. **Plan d'action investissement** — action principale, PEA/IBKR/Binance, 60/30/10, prix/fraîcheur, hypothèses, fiabilité IA
4. **Questions à poser** — starters contextualisés
5. **Hypothèses & limites** — données manquantes, fraîcheur, budget IA, signaux faibles
6. **Journal de décisions** — surface préparatoire non persistante

### 13.3 Forces

- ✅ Architecture conceptuelle très claire (les 6 zones)
- ✅ Bornes explicites posées : pas de learning loop auto, pas de fiscalité définitive, pas d'auto-trading, advisory-only
- ✅ Knowledge graph séparé en 2 vues (texte `/memoire` + 3D `/memoire/graph`)
- ✅ Knowledge graph est explicitement "mémoire dérivée", pas base de vérité — invariant non négociable (cf. AGENTS.md)
- ✅ Endpoint `recommendation-challenge` → committee challenger pattern
- ✅ Post-mortem + eval scorecard → learning visible
- ✅ Cost ledger → AI economics visible

### 13.4 Risques UX Advisor

| Risque | Détail |
|--------|--------|
| **ai-advisor-panel monolithique** | 1013 LOC — difficile à maintenir, risque de mélange de concerns |
| **Strategie-investissement page géante** | 1216 LOC — trop d'info en un seul écran |
| **Boîte noire** | Confidence/sources/raisonnement pas toujours visibles → besoin de "Pourquoi cette reco ?" systématique |
| **Mélange technique/produit** | "advisor-knowledge", "context-bundle", "fine-tuning-readiness" → vocabulaire à vulgariser |
| **Carte 3D opaque** | Sans alternative tabulaire / textuelle pour user non expert |
| **Daily brief / journal de décisions** | Surface préparatoire non persistante mais user peut s'attendre à persistance → poser explicitement la limite |
| **Demo vs admin Advisor** | Demo fixe ses recos via fixtures ; doit rester clair que ce sont des démos |
| **Recommandations contradictoires** | Pas vu de pattern explicite "contradiction détectée" (mais évoqué dans IA) |

### 13.5 Recommandations refonte Advisor

1. **Découper ai-advisor-panel** en sous-composants : `AdvisorSynthesis`, `RecommendationsList`, `HypothesesPanel`, `QuestionsList`, `DecisionJournalPreview`
2. **Stepper / tabs** sur `/ia/strategie-investissement` : `Action / Allocation / Hypothèses / Qualité données`
3. **Recommendation card pattern** : titre + pourquoi maintenant + données utilisées + hypothèses + risques + confidence bar + sources + CTA "approfondir"
4. **"Pourquoi ?" universel** : chaque output Advisor doit pouvoir s'expliquer en cliquant
5. **Vue tableau** comme alternative au knowledge graph 3D
6. **Vulgarisation libellés** : "advisor-knowledge" → "Ce que sait l'Advisor", "context-bundle" → "Contexte utilisé", "fine-tuning-readiness" → masquer en debug
7. **Confidence/freshness/source standardisés** (cf. §12)
8. **Limites explicites en haut de page** : "Cet Advisor recommande, ne décide pas. Aucun ordre n'est passé."
9. **Mode "challenger" visible** : afficher quand recommendation-challenge a été lancé et son verdict

---

## 14. Admin and demo mode audit

### 14.1 Détection (rappel §4.3)

- Source de vérité : `authMeQueryOptions()` → `auth.mode = 'demo' | 'admin'`
- UI : `resolveAuthViewState()` → `getVisibleNavItems(authViewState)` filtre items via `adminOnly?: boolean`
- API : guards `DEMO_MODE_FORBIDDEN` sur endpoints mutateurs + internal token (`Authorization: Bearer`, `X-Internal-Token`, `?internal_token=`) pour routes admin
- Données : `*QueryOptionsWithMode({ mode })` route vers `demo_fixture` (mocks `apps/api/src/mocks/demo-*`) vs `live | cache | admin_fallback`

### 14.2 Routes par mode (récap)

| Mode | Routes typiques |
|------|-----------------|
| Demo + admin | `/`, `/depenses`, `/patrimoine`, `/investissements`, `/objectifs`, `/actualites`, `/ia/`, `/ia/strategie`, `/ia/chat`, `/ia/memoire`, `/ia/memoire/graph` |
| Admin only | `/fiscalite`, `/sante`, `/parametres`, `/integrations`, `/orchestration`, `/marches`, `/ops-env-diagnostics`, `/ia/couts`, `/ia/trading-lab`, `/signaux/*` |

### 14.3 UI feedback du mode

- Topbar : badge "DÉMO" (warning/jaune) ou "ADMIN" (violet)
- Login : si mode admin détecté → redirect `/`
- Powens callback : demo → erreur `DEMO_MODE_FORBIDDEN` → redirect login avec reason
- ⚠ Pas de stripe-pattern background visible actuellement (utilitaire `.bg-stripe-pattern` défini mais pas utilisé)

### 14.4 Mélange admin/demo/debug sur certaines pages

| Surface | Mélange | Recommandation |
|---------|---------|----------------|
| `/_app/` cockpit | Demo et admin partagent — OK, badge suffit | Garder |
| `/_app/integrations` | Config + diagnostics + audit trail | Découper en `Vue d'ensemble / Diagnostics (admin) / Audit (admin)` |
| `/_app/sante` | Santé financière + qualité technique données | Séparer "Santé patrimoine" (user) vs "Qualité données" (admin) |
| `/_app/orchestration` | "CTA policy" obscur | Renommer "Automatisations", mais c'est avancé |
| Advisor cockpit | Affiche statuts techniques (fallback) | Déléguer aux toasts/banners |
| `/_app/ops-env-diagnostics` | Debug pur | Conserver, accès admin uniquement, mettre dans groupe `Système` |

### 14.5 Recommandations

- **Pas de pollution debug en demo** : tous les "advisor-fine-tuning-readiness", "data-quality" techniques, "feature-flags-audit" → admin/debug only
- **Banner mode** subtil mais constant (badge topbar OK)
- **Drawer "Diagnostic"** sur chaque page admin technique plutôt que tout afficher
- **Page `/admin/` (nouveau ?)** hub admin centralisé `à confirmer si pertinent`
- **Stripe pattern `.bg-stripe-pattern`** utilisé une fois subtilement pour rappeler mode (background body par exemple)

---

## 15. Claude skills, agents and prompt infrastructure audit

### 15.1 Skills présents

**Repos** :
- `.agentic/source/skills/` — **source de vérité (72 skills)**
- `.claude/skills/` — projection générée (87 skills, symlinks + copies via `pnpm agent:skills:sync`)
- `skills/` — symlink racine (36 visibles)
- `.agents/skills/` — skills auteur

#### Skills locaux Finance-OS (7) — `.agentic/source/skills/finance-os/`

| Skill | Type | Pertinence refonte UI/UX |
|-------|------|--------------------------|
| `finance-os-core-invariants` | backend/process | Non (fondationnel — à respecter) |
| `finance-os-web-ssr-auth` | backend/routing | Indirect (auth flows) |
| `finance-os-powens-integration` | backend/integration | Non |
| `finance-os-worker-sync` | backend/process | Non |
| `finance-os-deploy-ghcr-dokploy` | ops | Non |
| `finance-os-observability-failsoft` | backend/process | **Oui — patterns fail-soft à appliquer en UI** |
| `finance-os-ui-cockpit` | **design/frontend** | **Oui — primaire**, mais ⚠ palette obsolète à sync |

#### Skills GitNexus (6)

| Skill | Usage |
|-------|-------|
| `gitnexus-exploring` | Comprendre architecture |
| `gitnexus-impact-analysis` | Blast radius avant edit |
| `gitnexus-debugging` | Trace bugs |
| `gitnexus-refactoring` | Rename/extract/split safe |
| `gitnexus-guide` | Tools reference |
| `gitnexus-cli` | Index mgmt |

Pertinents pour refonte : oui, en particulier `gitnexus-impact-analysis` pour chaque composant touché.

#### Skills Impeccable (33) — installés pour UI premium

Liste indicative classée par utilité refonte :

| Skill | Rôle refonte |
|-------|--------------|
| `polish` | Pre-ship quality pass |
| `critique` | Critique esthétique |
| `audit` | Accessibility + completeness |
| `arrange` | Layout |
| `typeset` | Typography |
| `colorize` | Couleur |
| `distill` / `bolder` / `quieter` | Intensité visuelle |
| `adapt` | Responsive |
| `harden` | Edge cases |
| `normalize` | DS alignment |
| `extract` | DS extraction |
| `color-expert` | Palette / contrast |
| `motion-design-patterns` | Motion |
| `ui-animation` | Animation specifics |
| `ui-design` / `ui-audit` | High-level UI review |
| `visual-qa` | QA visuelle |
| `typography-audit` | Audit typo |
| `frontend-design` / `frontend-design-review` / `frontend-skill` | Frontend review |
| `creative-direction` | Brand direction |
| `web-design-guidelines` | Web principles |
| `delight` | Détails qui ravissent |
| `make-interfaces-feel-better` | Sensation produit |
| `emil-design-eng` | Philosophie Emil Kowalski |
| `animate` | Animation |
| `frontend-design` | Direction frontend |
| `optimize` | Perf |

**Pertinence refonte : 80% des besoins UI couverts** ✅

#### Skills recommandés (TanStack, Vercel, etc.)

| Domaine | Skills |
|---------|--------|
| TanStack | `tanstack-start-best-practices`, `tanstack-router-best-practices`, `tanstack-query-best-practices`, `tanstack-integration-best-practices` |
| React/Vercel | `vercel-react-best-practices`, `vercel-composition-patterns` |
| Quality | `web-quality-audit`, `performance`, `core-web-vitals`, `webapp-testing` |
| DevOps | `ci-cd-and-automation`, `git-workflow-and-versioning`, `security-and-hardening`, `documentation-and-adrs` |
| Data | `redis-development`, `drizzle-best-practices`, `postgresql-code-review` |

#### Skills présents mais hors scope refonte (process / triage)

`grill-me`, `grill-with-docs`, `to-issues`, `to-prd`, `tdd`, `triage`, `diagnose`, `caveman`, `loop`, `schedule`, `repo-recall`, `clarify`, `learn`, `teach-impeccable`, `release-sanity`, `pr-summary`, `code-review`, `code-change-verification`, `dual-path-guard`, `powens-safety-review`, `claude-api`, `write-a-skill`, `improve-codebase-architecture`, `update-config`, `run`, `verify`, `simplify`, `fewer-permission-prompts`, `init`, `review`, `security-review`, `find-skills`, `keybindings-help`, `statusline-setup`, `agentskill-sh-review-skill`, `agentskill-sh-learn`, `review-skill`, `setup-matt-pocock-skills`, `zoom-out`, `onboard`, `docs-sync`, `empirical-prompt-tuning`, `implementation-strategy`, `api-contract-guard`, `overdrive`.

### 15.2 Agents et configurations

| Chemin | Contenu |
|--------|---------|
| `.agents/` | Skills auteur (source) + graphs |
| `.codex/` | Config Codex (autopilot writer — ne pas concurrencer sur branches `agent/impl-*`) |
| `.claude/` | Skills générés + settings |
| `.qwen/` | Config Qwen `à confirmer` |
| `.vscode/` | Editor config |
| `.mcp.json` | GitNexus v1.4.10 stdio (seul MCP server actif) |
| `.claude/settings.json` | Mode `auto`, 42 patterns allowed (pnpm, docker, python venv, git) |

### 15.3 AGENTS.md (racine, 20 Ko) — règles clés

1. Single-user personal finance cockpit
2. Dual-path demo/admin **invariant non négociable**
3. Fail-soft (Powens unavailable → UI utilisable avec fallback)
4. Privacy by design : pas de secrets dans `VITE_*`, encrypt tokens
5. Observability : `x-request-id` propagation, structured logs
6. TypeScript `exactOptionalPropertyTypes` enabled
7. Analytics ≠ execution dependency
8. Knowledge Graph (Temporal GraphRAG) ≠ trading execution, paper-trading max
9. Design system : Aurora Pink (rose 355°, violet 295°), Inter + JetBrains Mono, 4-level surfaces
10. Verification : `pnpm check:ci`, `lint`, `typecheck`, `test`, `build` ; smoke scripts ; validate-agent-foundation
11. Review priorities P0/P1/P2 (security > contract regression > cleanup)
12. AI Advisor memory ≠ agentic dev pipeline (séparés strictement)
13. External investments : read-only analytics uniquement (jamais exécution)
14. Powens : aucune mutation (orders, transfers, etc.)
15. Compact context bundle pour Advisor (jamais raw XML / JSON / secrets)

### 15.4 CLAUDE.md (15 Ko) — rôle Claude

- Rôle par défaut : **challenger, reviewer, local high-context collaborator** (pas autopilot writer)
- Autopilot writer = Codex sur branches `agent/impl-*`
- Valeur Claude : challenge scope, review PRs, prototypes locaux, **critique UI** (structure, copy, a11y, color)
- Skills routing : local Finance-OS > recommended external > optional > experimental
- Color/UI work : `color-expert` + `finance-os-ui-cockpit` + Impeccable polish/critique
- Doit lire DESIGN.md + docs/frontend/* avant tout travail UI
- Context packs : `pnpm agent:context:select -- --domains=DOMAIN --budget=TIER`
- Budgets : small 8K, medium 16K, large 32K, xlarge 64K, autonomous 128K

### 15.5 Documentation existante (résumé)

| Dossier | Fichiers | Pertinence refonte |
|---------|----------|--------------------|
| `docs/adr/` (7 ADRs) | Advisor loop, agent efficiency, memory, model routing, providers v2, GraphRAG, trading-lab | À lire |
| `docs/frontend/` (4) | design-system.md, information-architecture.md, motion-and-interactions.md, navigation-refactor-audit.md | **CRITIQUE — à lire** |
| `docs/context/` (~19) | STACK, DESIGN-DIRECTION, CONVENTIONS, ENV-REFERENCE, EXTERNAL-SERVICES, FEATURES, NEWS-FETCH, TAURI, PERFORMANCE | **À lire** (STACK, FEATURES, DESIGN-DIRECTION) |
| `docs/agentic/` (44) | INDEX, runbook, surfaces, context-packs, model/skill routing, **ui-quality-map** | Utile (ui-quality-map) |
| `docs/ai/` (5) | Agentic audit, setup, target architecture, gitnexus | Référence |
| `docs/ops/`, `operations/` (8) | Advisor brain, daily intelligence, env prod, ibkr flex, twitter | Référence |
| `docs/providers/` (7) | Powens, IBKR, Binance, Knowledge Service, News Service, Quant Service | Référence |
| `docs/trading-lab/` (2) | README, risk-and-caveats | Référence |
| `docs/research/` (3) | Advisor external repos audit, trading lab audit, provider abstraction | Référence |

### 15.6 Skills manquants pour refonte UI/UX premium

| Skill recommandé | Existe ? | Action |
|------------------|---------|--------|
| `design-system-architect` | Partiel (docs/frontend + finance-os-ui-cockpit) | Créer skill dédié encodant invariants DS Finance-OS |
| `ux-audit` (conversational deep) | Partiel (web-quality-audit + frontend-design-review) | Créer ou étendre web-quality-audit |
| `accessibility-reviewer` (WCAG cookbook) | Partiel | Créer avec checklist par composant + couleur tokens |
| `frontend-performance` (LH + bundle) | Oui (`performance`, `core-web-vitals`) | Suffisant |
| `data-visualization` (financial) | **Non** | **À créer — règles §12** |
| `financial-product-ux` | Non | À créer — patterns finance (KPIs, density, decisions) |
| `motion-design` (page transitions) | Oui partiel (`motion-design-patterns`, docs/frontend/motion-and-interactions.md) | Suffisant |
| `design-token-engineer` | Partiel | Couvert par tokens existants + Impeccable extract |
| `visual-qa` | Oui (Impeccable visual-qa) | Suffisant |
| `large-refactor-safety` | Partiel (gitnexus-impact-analysis + finance-os-core-invariants) | Suffisant |
| `tanstack-start-ui` (UI patterns spécifiques) | Partiel (tanstack-start-best-practices) | Suffisant |
| `react-component-refactor` | Partiel (gitnexus-refactoring + Impeccable normalize) | Suffisant |
| `dashboard-information-architecture` | Non | À créer — règles §6 |
| `ai-advisor-ux` | Non | À créer — règles §13 |
| `admin-debug-ux-separation` | Non | À créer — règles §14 |

### 15.7 Divergences détectées

- ⚠ **Palette finance-os-ui-cockpit** : référence amber/gold (legacy) divergente de DESIGN.md Aurora Pink → sync à faire dans `.agentic/source/skills/finance-os/ui-cockpit/SKILL.md` puis `pnpm agent:skills:sync`
- AGENTS.md / CLAUDE.md / DESIGN.md : pas de contradiction détectée, complémentaires

---

## 16. Existing documentation audit

### 16.1 Utile pour la refonte

- ⭐ `DESIGN.md` — source de vérité visuelle (Aurora Pink), à appliquer strictement
- ⭐ `docs/frontend/design-system.md` — tokens + composants + patterns
- ⭐ `docs/frontend/information-architecture.md` — refonte nav 2026-05-03, structure produit
- ⭐ `docs/frontend/motion-and-interactions.md` — courbes/durées
- ⭐ `docs/frontend/navigation-refactor-audit.md` — audit refonte nav 2026-04-26
- ⭐ `docs/context/DESIGN-DIRECTION.md` — résumé brand pour agents externes
- ⭐ `docs/context/STACK.md`, `FEATURES.md`, `CONVENTIONS.md` — référence
- `docs/agentic/ui-quality-map.md` — quality gates UI
- `docs/adr/*` — décisions Advisor, memory, GraphRAG, trading-lab

### 16.2 Probablement obsolète / à vérifier

| Doc | Raison |
|-----|--------|
| `docs/mvp-dashboard.md` | MVP — probablement obsolète post-refonte 2026-05 `à confirmer` |
| `docs/powens-mvp.md` | MVP — vérifier vs état actuel |
| `docs/deployment.md`, `deployment-dokploy.md`, `deploy-dokploy.md`, `deploy-dokploy-env.md` | 4 docs deploy — risque de duplication / dérive |
| `docs/research/*` | Audits anciens, à dater |
| `docs/finance-os-full-inventory.md` | À comparer avec présent rapport |

### 16.3 Manquant / à créer après refonte

- `docs/frontend/accessibility.md` — checklist WCAG + patterns ARIA par composant
- `docs/frontend/data-visualization-patterns.md` — règles charts/tables/density (cf. §12)
- `docs/frontend/component-states-matrix.md` — every widget × loading/empty/error/degraded/admin/demo
- `docs/frontend/responsive-conventions.md` — breakpoints + comportements mobile
- `docs/frontend/page-templates.md` — patterns par type de page (cockpit / list / detail / admin)
- `docs/frontend/copy-guidelines.md` — vocabulaire vulgarisé (cf. §6.6)
- `docs/adr/00XX-ui-refonte-aurora-pink-v2.md` — ADR de la refonte
- README.md racine (absence détectée `à confirmer` — il existe peut-être dans apps/web)

---

## 17. Major redesign risks

| # | Risque | Zone concernée | Gravité | Probabilité | Mitigation |
|---|--------|----------------|---------|-------------|------------|
| 1 | Casser le dual-path demo/admin | Routes, loaders, queryOptionsWithMode | **Critique** | Moyenne | Tests E2E sur les 2 modes ; ne pas toucher au pattern ; cf. skill `dual-path-guard` |
| 2 | Casser SSR / hydration | `__root.tsx`, `_app.tsx`, dynamic imports | **Critique** | Moyenne | Tester chaque route en SSR ; `typeof window` guards préservés |
| 3 | Régression a11y | Components refactorisés | **Élevé** | Élevée | Audit axe-core en CI ; `audit` skill systématique |
| 4 | Perdre identité Aurora Pink | Tokens, composants signature | **Élevé** | Faible | Conserver tokens ; ne pas remplacer DESIGN.md sans ADR |
| 5 | Casser KnowledgeGraph3D | `/ia/memoire/graph` | Moyen | Moyenne | Refacto incrémental ; preset performance par défaut |
| 6 | Mélanger données démo et réelles | Loaders, mocks | **Critique** | Faible | Pattern existant solide ; ne pas changer la convention |
| 7 | Surcharger bundle | Pages avec heavy reactbits | Moyen | Élevée | Lazy load + bundle analyzer en CI |
| 8 | Animations trop nombreuses | motion/react usage | Moyen | Moyenne | Respect `prefers-reduced-motion` ; durées ≤ 350ms ; stagger ≤ 400ms |
| 9 | Régressions tables / forms | `/depenses`, `/transactions`, Powens forms | Moyen | Moyenne | Tests Playwright + TanStack tests |
| 10 | Régression Powens callback | OAuth flow | **Critique** | Faible | Garder logique inchangée ; refonte cosmétique uniquement |
| 11 | Refonte trop massive en une PR | Tout | **Élevé** | Élevée | Phases (cf. §18) ; PRs petites ; feature flag par phase si besoin |
| 12 | Skills obsolètes mal sync | `.agentic/source/skills/` | Faible | Élevée | `pnpm agent:skills:sync` après chaque maj source |
| 13 | Documentation pas à jour | DESIGN.md / docs/frontend/* | Moyen | Élevée | Forcer maj doc dans même PR (cf. AGENTS.md) |
| 14 | Refonte casse perfs (LH) | Tout | Moyen | Moyenne | LH baseline avant ; comparer après chaque phase |
| 15 | Casser PWA / push notifications | Service worker | Faible | Faible | Tester sur device réel |
| 16 | Faire un DS prematurément abstrait | `packages/ui` | Moyen | Moyenne | Ne monter que les composants prouvés (cf. §9.2) |
| 17 | Régression mobile bottom nav | Mobile users | Moyen | Moyenne | Tester sur device réel ; respecter safe-area-bottom |
| 18 | Régression dark/light | Theme toggle | Moyen | Faible | Tester les 2 modes après chaque modif |
| 19 | Bundle GSAP fantôme | deps | Faible | Élevée | Audit usage avant suppression |
| 20 | Mélanger UI advisor / pipeline agentique | Si nouveau pattern UI réutilise pipeline | **Critique** | Faible | Séparation stricte (AGENTS.md invariant 12) |

---

## 18. Recommended redesign strategy

**Posture générale** : refonte par **phases incrémentales**, conservation des tokens Aurora Pink (l'identité fonctionne), priorité à l'information architecture et la séparation user / admin / debug, refonte composant-par-composant via les surfaces canoniques.

### Phase 0 — Gel + cadrage (1 semaine)

- **Objectif** : geler l'inventaire, valider la stratégie, mesurer la baseline
- **Actions** :
  - Synchroniser `finance-os-ui-cockpit` SKILL.md avec DESIGN.md Aurora Pink
  - Lancer Lighthouse + bundle analyzer sur 6 pages clés → baseline
  - Activer axe-core en CI (Playwright)
  - Audit usage GSAP (supprimer si non utilisé)
  - Audit usage reactbits "Heavy" (liquid-ether, magic-bento, pixel-blast)
  - Lire `docs/frontend/*` complet (4 docs)
  - Décider : refonte conservatrice ou ambitieuse (cf. §19/20 questions)
- **Critères de validation** :
  - Baseline LH documentée
  - Liste des "dead deps" / "dead components" actée
  - Phases 1–9 ajustées au scope choisi

### Phase 1 — Design principles + tokens (1 semaine)

- **Objectif** : durcir les tokens, écrire les règles manquantes, créer ADR de la refonte
- **Fichiers probables** : `packages/ui/src/styles/globals.css`, `DESIGN.md`, `docs/frontend/`, nouvelle ADR
- **Actions** :
  - Vérifier contraste tous tokens (positive/negative/warning/muted sur surface-0/1/2/3) → mesurer
  - Documenter palette charts dans `data-visualization-patterns.md`
  - Documenter copy guidelines (cf. §6.6) — `docs/frontend/copy-guidelines.md`
  - Documenter component states matrix
  - Documenter responsive conventions
  - Écrire ADR `0xxx-ui-refonte-aurora-pink-v2.md`
- **Risques** : faible
- **Validation** : DESIGN.md à jour, ADR mergée

### Phase 2 — Layout shell + navigation (1 semaine)

- **Objectif** : nettoyer le shell sans casser, supprimer doublons
- **Fichiers** : `apps/web/src/components/shell/`, `routes/__root.tsx`, `routes/_app.tsx`
- **Actions** :
  - Supprimer `components/dashboard/topbar.tsx` (mort)
  - Vérifier / supprimer `components/dashboard/sidebar-nav.tsx` si legacy
  - Affiner mobile bottom nav (safe-area, animations)
  - Vérifier accessibilité command palette
- **Risques** : moyen (touch shell)
- **Validation** : tests Playwright e2e nav, dark/light, demo/admin

### Phase 3 — Composants système (DS) (2 semaines)

- **Objectif** : enrichir `packages/ui` avec composants canoniques
- **Actions** :
  - Monter KpiTile, Panel, RangePill, PageHeader, StatusDot, BrandMark, ThemeToggle dans `packages/ui`
  - Créer DataTable, Skeleton, Field, WidgetError, WidgetDegraded, ModeBadge, EmptyState
  - Wrapper Radix : Dialog, Drawer, Tooltip, Tabs
- **Risques** : moyen (refactor multi-imports)
- **Validation** : tous les imports `apps/web/src/components/surfaces/*` redirigés ; tests passent

### Phase 4 — Refonte cockpit (`/`) (2 semaines)

- **Objectif** : refondre la page d'entrée, hiérarchie KPI > attention > brief > détail
- **Fichiers** : `routes/_app/index.tsx`, `components/dashboard/*`
- **Actions** :
  - Découper `ai-advisor-panel` en sous-composants
  - Découper `personal-financial-goals-card` (921 LOC)
  - Standardiser cards via Panel
  - Standardiser loading via Skeleton
- **Risques** : élevé (page critique)
- **Validation** : E2E cockpit demo + admin ; perf LH

### Phase 5 — Refonte pages data-heavy (3 semaines)

- **Objectif** : dégonfler patrimoine (1004), investissements (971), depenses (426), integrations (1072), strategie-investissement (1216)
- **Actions** :
  - Tabs / drilldown sur pages multi-intentions
  - Découper en sous-composants
  - Clarifier frontière `/investissements` ↔ `/ia/strategie-investissement`
  - Découper `/integrations` par provider
- **Risques** : élevé
- **Validation** : tests par page, perf, mobile

### Phase 6 — Refonte Advisor (`/ia/*`) (3 semaines)

- **Objectif** : structure 6 zones explicite, vulgarisation, "Pourquoi ?" universel
- **Actions** :
  - Découper ai-advisor-panel
  - Stepper/tabs sur strategie-investissement
  - Recommendation card pattern standardisé (cf. §13.5)
  - Vue tableau alternative pour knowledge graph
  - Vulgarisation libellés
- **Risques** : élevé (UX advisor au cœur du produit)
- **Validation** : tests fonctionnels Advisor ; user feedback (single-user)

### Phase 7 — Admin / debug separation (2 semaines)

- **Objectif** : nettoyer mélange admin/debug dans pages user
- **Actions** :
  - Déplacer diagnostics dans drawer admin
  - Renommer "advisor-knowledge", "context-bundle", "fine-tuning-readiness", etc.
  - Confiner data-quality technique dans `/sante` admin
  - Renommer `/orchestration` → `/automations` `à confirmer`
- **Risques** : moyen
- **Validation** : aucun terme technique exposé en demo

### Phase 8 — QA accessibilité + performance (2 semaines)

- **Objectif** : a11y AAA sur surfaces critiques, perf LH > 90 sur cockpit
- **Actions** :
  - axe-core sur toutes pages
  - Mesures LH par phase
  - Audit reduced-motion sur tous reactbits
  - Fallback knowledge graph 3D
- **Risques** : faible
- **Validation** : axe-core 0 violations critical/serious ; LH ≥ 90 cockpit

### Phase 9 — Documentation + ADRs (1 semaine)

- **Objectif** : docs à jour
- **Actions** :
  - Maj DESIGN.md, docs/frontend/*, docs/context/
  - Maj skills (resync `pnpm agent:skills:sync`)
  - ADR de fin de refonte
  - README apps/web (à créer si absent)
- **Risques** : nul
- **Validation** : doc complète, agent prompts à jour

**Total estimatif** : ~17 semaines (4 mois), à ajuster selon scope. Découpable en sprints de 1–3 semaines.

---

## 19. Future prompt pack

> **⚠ Brouillons.** À affiner avant usage en prod.

### 19.1 Prompt — Claude Design / Stitch (génération maquettes)

```
Tu es invité à explorer plusieurs directions visuelles pour la refonte UI/UX de Finance-OS, un cockpit financier personnel single-user.

CONTEXTE PRODUIT
- Application personnelle de finance/patrimoine/cockpit
- 35 routes, dont 27 sous /_app/ (cockpit, dépenses, patrimoine, investissements, fiscalité, objectifs, advisor IA, signaux, etc.)
- 2 modes : demo (publique, données fixtures) et admin (live data, debug)
- Single-user : pas de "team", pas de "share", pas de "billing"
- Référence ton : haut de gamme, dense mais maîtrisé, cinéma-SF retenue (Dune, Blade Runner 2049)

DA EXISTANTE À CONSERVER OU ÉVOLUER (Aurora Pink)
- Rose magenta brand `oklch(0.72 0.19 355)` + violet électrique accent `oklch(0.70 0.22 295)`
- 4 surfaces dark `oklch(0.12 0.02 325 → 0.24 ...)` + 4 surfaces light pearl chaude
- Sémantique finance dissociée : emerald (positive), coral (negative), amber (warning)
- Typo : Inter Variable + JetBrains Mono Variable (`.font-financial`) + Compressa hero
- 22 react-bits décoratifs (TextPressure, ShinyText, BorderGlow, AuroraShape, SpotlightCard, CountUp)
- 4 niveaux de surface (--surface-0..3)
- Effets retro-cockpit : scanlines, grain, grid-dots, aurora-mesh

CONTRAINTES
- Identité distinctive obligatoire (pas un clone shadcn)
- Sémantique finance séparée du brand (rose ≠ statut)
- prefers-reduced-motion respecté
- Dark + Light obligatoires
- Mobile bottom nav obligatoire
- Demo/Admin badges visibles

DEMANDE
Produis 3 directions maquettes pour les écrans suivants :
1. /_app/ (cockpit personnel — KPI + advisor brief + attention items)
2. /_app/patrimoine (vue consolidée actifs + allocation + historique)
3. /_app/ia/strategie-investissement (plan d'action 60/30/10)
4. /_app/ia/memoire/graph (knowledge graph + vue alternative tableau)
5. /_app/integrations (Powens + IBKR + Binance)

Pour chaque direction :
- variation cohérente Aurora Pink (intensité variable : sobre / médian / expressif)
- hiérarchie info claire (KPI > attention > brief > détail)
- progressive disclosure (drilldown plutôt que tout afficher)
- état loading, empty, error, demo, admin documentés
- mobile breakpoint inclus

Format livraison : descriptions textuelles + composants concrets + tokens. Pas d'export Figma.
```

### 19.2 Prompt — Claude Max implémentation (refonte progressive)

```
Tu implémentes la refonte UI/UX de Finance-OS phase par phase. Tu DOIS respecter scrupuleusement :

INVARIANTS NON NÉGOCIABLES (lecture obligatoire avant édition)
1. AGENTS.md — dual-path demo/admin, fail-soft, privacy, observability, exactOptionalPropertyTypes
2. DESIGN.md — Aurora Pink, palette OKLCH, surfaces, motion
3. docs/frontend/design-system.md — tokens et composants
4. docs/frontend/information-architecture.md — structure produit
5. CLAUDE.md — rôle Claude, dual-path-guard, finance-os-core-invariants
6. FINANCE_OS_UI_UX_REPO_AUDIT.md — base de l'audit pré-refonte

RÈGLES OPÉRATIONNELLES
- Petites PRs (≤ 400 LOC diff utile)
- Ne touche pas aux endpoints API ni aux loaders sans justification
- Préserve les routes et leurs paths
- Maintiens demo/admin sur chaque page modifiée
- Chaque PR ajoute / met à jour la doc associée (DESIGN.md, docs/frontend/*)
- Lance `pnpm check:ci` + `pnpm lint` + `pnpm typecheck` avant push
- Utilise `gitnexus_impact` avant tout edit non trivial (cf. CLAUDE.md GitNexus)
- N'introduis JAMAIS de gradient arc-en-ciel, glow gratuit, glassmorphism partout, rose sémantique
- Respecte prefers-reduced-motion (cf. globals.css lignes 132–141)

SKILLS À CHARGER
- finance-os-ui-cockpit (primaire)
- finance-os-core-invariants (invariants)
- color-expert (couleur)
- polish / critique / arrange / typeset / colorize / adapt / harden (Impeccable)
- web-quality-audit (a11y)

TÂCHE CONCRÈTE (à instancier par phase)
Phase : [insérer phase 0–9 de la stratégie]
Pages : [insérer routes concernées]
Composants : [insérer fichiers]
Critères validation : [insérer tests + perf + a11y]

LIVRABLE
- Diff minimal
- Tests verts
- Doc à jour
- Pas de comment "added for X" — code se documente seul
- Aucune feature non demandée
```

### 19.3 Prompt — QA visuelle (post-refonte)

```
Tu es chargé d'une QA visuelle systématique pour la refonte UI/UX Finance-OS.

CHECKLIST PAR PAGE
1. Mode demo : tous les états affichables sans erreur
2. Mode admin : tous les états affichables sans erreur
3. Dark + Light : pixel-rendering correct sur les 2 themes
4. Mobile (≤ 640px) : safe-area-bottom respectée, bottom nav fonctionnelle
5. Tablet (640–1024px) : breakpoints corrects
6. Desktop (≥ 1024px) : sidebar 248/72px
7. Reduced motion : animations désactivées (CSS + JS)
8. Keyboard navigation : Tab traversal logique, focus visible, Escape ferme dialogs
9. Screen reader : aria-labels présents, landmarks corrects, alt text sur visuels informatifs
10. Contraste : tokens muted/foreground ≥ AAA sur fond surface-0
11. Loading : Skeleton (animate-shimmer) sur chaque widget
12. Empty : EmptyState avec CTA cohérent
13. Error : WidgetError avec retry + fallback
14. Degraded : WidgetDegraded avec raison + last-known-good
15. Demo/Admin badges visibles dans topbar
16. Sources / fraîcheur / confidence affichées de façon standardisée

POUR CHAQUE PAGE
- Capturer screenshot dark mobile + dark desktop + light desktop
- Documenter chaque divergence vs DESIGN.md
- Documenter chaque divergence vs information-architecture.md
- Mesurer Lighthouse desktop + mobile
- Lancer axe-core et lister violations critical/serious

PAGES PRIORITAIRES
P0 : /, /_app/patrimoine, /_app/investissements, /_app/integrations, /_app/ia/strategie-investissement
P1 : /_app/depenses, /_app/objectifs, /_app/sante, /_app/ia/, /_app/ia/chat, /_app/ia/memoire, /_app/ia/memoire/graph
P2 : reste

LIVRABLE
Rapport markdown listant : pages × points × verdict (OK / Warning / Fail) + screenshots + LH scores + axe-core violations.
```

---

## 20. Open questions

À résoudre avec l'utilisateur avant design final.

### Scope refonte

1. **Ampleur** : refonte conservatrice (DA conservée, focus IA + hiérarchie info) ou ambitieuse (nouvelle DA possible, repenser identité) ?
2. **Phases** : viser 17 semaines en séquence, ou paralléliser certaines phases (DS + cockpit) ?
3. **Pages "expertes" (signaux/*)** : doivent-elles rester aussi exposées dans la nav, ou être plus cachées (drawer admin) ?
4. **Knowledge graph 3D** : conserver, alléger, ou remplacer par vue 2D + tableau ?
5. **Reactbits "Heavy"** (liquid-ether, magic-bento, pixel-blast) : où sont-ils réellement utilisés ? Garder, lazy load, supprimer ?
6. **Trading lab** : reste-t-il en alpha admin-only, ou ambition de l'exposer plus visiblement ?

### Identité

7. Garde-t-on TextPressure / RotatingText / Compressa hero ? Ou veut-on une signature plus calme ?
8. Ascii brand glyphes (◈ □ ≋) : conserver dans la nav ou retirer ?
9. PixelBlast backdrop sur `/login` : conserver, alléger, remplacer par AuroraBackdrop ?

### Information architecture

10. `/investissements` vs `/ia/strategie-investissement` : fusionner, garder distincts, repenser ?
11. `/marches` (cockpit) vs `/signaux/marches` (admin) : doublon ? Fusionner ?
12. `/orchestration` : renommer ? Reste-t-elle pertinente en page nav ?
13. `/sante` : séparer santé patrimoine vs qualité données ?
14. `/parametres` : tout regrouper ou découper en sections (profil, notifications, données, IA) ?

### Advisor

15. Affichage confidence : barre 0–1, libellé, ou les deux ?
16. Journal de décisions : rester non persistant ou ambition de persistance ?
17. Mode "challenger" : exposer systématiquement ou seulement sur demande ?
18. Knowledge graph 3D : usage réel par l'utilisateur (qui est seul) ? Justifie le bundle Three.js ?

### Mobile / responsive

19. Cible mobile : iPhone (PWA + Tauri iOS) ou mobile web only ?
20. Densité info sur mobile : compromis acceptable (drilldown forcé) ou tout doit tenir ?

### Tooling

21. React Compiler : activer si non actif ?
22. Bundle GSAP : supprimer si non utilisé ?
23. Skills locaux : créer `data-visualization`, `ai-advisor-ux`, `admin-debug-ux-separation` ?
24. Skill `finance-os-ui-cockpit` : resync palette amber → Aurora Pink immédiatement ?

---

## 21. Appendix

### 21.1 Commandes utilisées pendant l'audit

```bash
pwd
ls -la
ls apps/ packages/ docs/ skills/
find apps/web/src/routes -type f
find apps/web/src/components -type f -name "*.tsx"
wc -l <fichiers clés>
cat DESIGN.md (lecture intégrale)
cat packages/ui/src/styles/globals.css (analysé via agent)
cat apps/web/src/styles.css
head/tail/grep ciblés via agents Explore
```

Aucune commande destructive, aucune migration, aucun build, aucun test exécuté.

### 21.2 Fichiers principaux lus ou inspectés

- `DESIGN.md` (intégral)
- `CLAUDE.md` (intégral)
- `AGENTS.md` (résumé via agent)
- `docs/frontend/design-system.md` (extrait)
- `docs/frontend/information-architecture.md` (extrait)
- `packages/ui/src/styles/globals.css` (489 LOC, analysé via agent)
- `apps/web/src/styles.css` (33 LOC)
- `apps/web/package.json` (intégral)
- Inventaire de 35 routes + 83 composants frontend
- Inventaire de 6 apps + 12 packages
- Inventaire de ~107 skills (72 sources + 33 Impeccable + 7 local + 6 GitNexus + recommended)
- Inventaire docs (200+ fichiers .md)

### 21.3 Limites de l'audit

- **LOC indicative** : certaines tailles affichées comme "à confirmer" (routes pour lesquelles wc -l n'a pas été exécuté individuellement ; les 9 tailles principales ont été vérifiées)
- **Usage réel des composants** : la simple existence d'un composant (ex: `liquid-ether.tsx`) ne signifie pas qu'il est importé ; un audit `grep` exhaustif d'imports n'a pas été fait — à valider en phase 0
- **A11y** : audit statique (lecture code) ; pas de test axe-core lancé
- **Performance** : pas de Lighthouse exécuté ; bundle weight estimé d'après poids des libs
- **Backend** : surface API listée à un niveau de domaine ; pas d'audit détaillé endpoint par endpoint
- **Knowledge service / Quant service Python** : structure surface, pas de lecture détaillée des modules Python
- **Tests** : pas de mesure de coverage actuelle
- **Cross-platform** : pas de test sur Tauri desktop / iOS / Android
- **Mode demo dataset v1 vs v2** : `DEMO_DATASET_STRATEGY` mentionné, comportement réel `à confirmer`
- **Skills générés vs source** : décalage possible si `pnpm agent:skills:sync` pas relancé récemment
- **Documentation obsolète** : marquages "à confirmer" pour les MVP docs et docs research anciens

### 21.4 Méthode

Cet audit a été produit en lecture seule par Claude (Opus 4.7, 1M context), avec délégation à 3 agents Explore en parallèle pour la collecte multi-domaine (frontend + UI, backend + features, skills + docs). Le rapport synthétise les retours validés par lecture directe de DESIGN.md et vérification de chiffres clés via `wc -l`. Aucune modification de fichier applicatif n'a été effectuée. Aucun commit, aucune migration, aucune commande destructive.

### 21.5 Versions de référence (extrait `apps/web/package.json`)

- React 19.2.0
- TanStack Router 1.132 / Query 5.66 / Start 1.132 / Table 8.21 / Form 1.0 / Store 0.8
- Tailwind CSS 4.1.18
- Motion 12.38.0
- Three 0.183.2 + react-force-graph-3d 1.29.1 + react-three/fiber 9.6.0
- D3 7.9.0
- Lightweight-charts 5.2.0
- GSAP 3.15.0 ⚠ usage à vérifier
- Radix UI 1.4.3
- cmdk 1.1.1
- Zod 4.1.11

---

**Fin du rapport.**

> Ce document est destiné à servir de base de travail. Toute évolution de la refonte doit être renseignée dans `docs/adr/`, `DESIGN.md`, et `docs/frontend/*`. Les "à confirmer" doivent être levés en phase 0 (gel + cadrage).
