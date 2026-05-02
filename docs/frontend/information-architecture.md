# Architecture d'information — Finance-OS

> Carte des pages, rôle de chaque surface, principes de navigation.
> Refactorisée en Prompt 3 (2026-04-26) : 3 sections (Cockpit personnel, IA, Données & signaux).

## Structure des routes

### Section 1 : Cockpit personnel

| Route | Page | Rôle | Données principales |
|-------|------|------|---------------------|
| `/` | **Cockpit** | Vue d'ensemble — KPIs, tendance patrimoine, top dépenses, connexions, objectifs, entry point IA | `dashboardSummary`, `financialGoals`, `powensStatus`, `dashboardAdvisor` |
| `/depenses` | **Dépenses** | Transactions, structure des dépenses, budgets, projection fin de mois | `dashboardTransactions`, `dashboardSummary` |
| `/patrimoine` | **Patrimoine** | Actifs, historique patrimoine, soldes par connexion, investissements externes | `dashboardSummary`, `externalInvestmentsSummary`, `externalInvestmentsPositions` |
| `/investissements` | **Investissements** | Cockpit positions, IBKR/Binance, valorisation, P&L, qualite data | `dashboardSummary`, `externalInvestmentsSummary`, `externalInvestmentsPositions`, `externalInvestmentsTrades`, `externalInvestmentsCashFlows` |
| `/objectifs` | **Objectifs** | Objectifs financiers personnels (CRUD) | `financialGoals` |
| `/integrations` | **Intégrations** | Connexions Powens, sync runs, diagnostics, audit trail | `powensStatus`, `powensSyncRuns`, `powensDiagnostics`, `powensAuditTrail` |
| `/sante` | **Santé** | Vue consolidée de l'état système | Tous les endpoints status/health |
| `/parametres` | **Paramètres** | Notifications push, derived recompute, exports | `pushSettings`, `derivedRecomputeStatus` |

Note investissements externes: `/integrations` gere aussi les credentials admin IBKR/Binance, leur health et leurs sync runs. `/sante` expose ces providers avec request IDs, comptes raw/normalises et erreurs safe.

### Section 2 : IA

| Route | Page | Rôle | Données principales |
|-------|------|------|---------------------|
| `/ia` | **Advisor** | Brief quotidien, recommandations, métriques, navigation IA | `dashboardAdvisor*`, `dashboardAdvisorRecommendations`, `dashboardAdvisorSpend` |
| `/ia/chat` | **Chat finance** | Conversation financière avec contexte + Q&A pédagogique | `dashboardAdvisorChat`, `dashboardAdvisorKnowledgeTopics` |
| `/ia/memoire` | **Mémoire & connaissances** | Graphe temporel, recherche hybride, provenance, contexte bundle | `knowledgeStats`, `knowledgeSchema`, `knowledgeQuery`, `knowledgeContextBundle` |
| `/ia/trading-lab` | **Trading Lab** | Paper-trading, backtesting, stratégies, scénarios (paper-only) | `tradingLabStrategies`, `tradingLabBacktests`, `tradingLabScenarios`, `tradingLabCapabilities`, `attentionItems` |
| `/ia/couts` | **Coûts IA** | Tokens, modèles, budget, runs (admin-only) | `dashboardAdvisorSpend`, `dashboardAdvisorRuns` |

### Section 3 : Données & signaux

| Route | Page | Rôle | Données principales |
|-------|------|------|---------------------|
| `/signaux` | **Signaux** | Hub de signaux externes — news, overview, navigation | `dashboardNews`, `signalHealth`, `signalSources` |
| `/signaux/marches` | **Marchés & macro** | Panorama marché, macro, watchlist mondiale | `marketsOverview` |
| `/signaux/social` | **Comptes sociaux** | Gestion des comptes X, Bluesky, imports manuels | `signalSources`, `signalHealth` |
| `/signaux/sources` | **Sources & fraîcheur** | Provenance et qualité des données (admin-only) | Multiple health queries |

### Redirections (ancien vers nouveau)

| Ancienne route | Nouvelle route | Type |
|----------------|----------------|------|
| `/actualites` | `/signaux` | 301 |
| `/memoire` | `/ia/memoire` | 301 |
| `/marches` | `/signaux/marches` | 301 |

### Routes système (hors layout)

| Route | Rôle |
|-------|------|
| `/login` | Authentification |
| `/transactions` | Navigateur de transactions legacy (conservé, hors shell) |
| `/powens/callback` | Callback Powens (SSR) |
| `/health` | Health check |
| `/healthz` | Health check avec flags |
| `/version` | Info version |

## Shell applicatif

### Desktop (>=1024px)

```
┌──────────────────┬──────────────────────────────┐
│  Sidebar (248px)  │  Topbar (brand, demo, auth)  │
│                   ├──────────────────────────────│
│  Cockpit personnel│                              │
│  ◈ Cockpit        │  [Contenu de page]           │
│  ↔ Dépenses       │                              │
│  ◊ Patrimoine     │  max-width: 7xl (1280px)     │
│  △ Invest.        │                              │
│  ◎ Objectifs      │                              │
│  ⊞ Intégrations   │                              │
│  ♡ Santé          │                              │
│  ⚙ Paramètres     │                              │
│  ──────────────── │                              │
│  IA               │                              │
│  ▣ Advisor        │                              │
│  ◬ Chat finance   │                              │
│  [#] Mémoire      │                              │
│  ⊘ Coûts IA       │                              │
│  ──────────────── │                              │
│  Données & signaux│                              │
│  ⊟ Signaux        │                              │
│  ≈ Marchés        │                              │
│  ⊕ Social         │                              │
│  ⊡ Sources        │                              │
│                   │                              │
│  [Réduire]        │                              │
└──────────────────┴──────────────────────────────┘
```

- La sidebar se réduit à 72px (icônes seules) via toggle
- 3 groupes avec séparateurs et headers
- L'indicateur de page active utilise `motion layoutId` pour une animation fluide

### Mobile (<1024px)

```
┌──────────────────────────────────┐
│  Topbar (brand, démo, session)   │
├──────────────────────────────────│
│                                  │
│  [Contenu de page]               │
│  padding-bottom: safe area       │
│                                  │
├──────────────────────────────────│
│  ◈   ↔   ◊   ▣   ⋯             │
│  Bottom navigation               │
└──────────────────────────────────┘
```

Tabs bottom bar : Cockpit, Dépenses, Patrimoine, IA (Advisor)
Bouton "Plus" ouvre un drawer avec tous les autres items, groupés par section.

## Workflow quotidien prioritaire

1. `Cockpit` — point d'entrée, synthèse, "qu'est-ce qui demande attention ?"
2. `Dépenses` — contrôle du flux du jour
3. `IA > Advisor` — briefing IA, recommandations, agir
4. `Patrimoine` — état du stock patrimonial
5. `Objectifs` — arbitrage et progression

Les signaux (Actualités, Marchés) sont consultés quand le contexte est nécessaire, pas comme routine quotidienne. Ils alimentent l'IA en arrière-plan.

## Principes de navigation

1. **3 sections claires** — finances personnelles, IA, données externes
2. **Chaque page a un rôle clair** — pas de chevauchement
3. **Progressive disclosure** — le cockpit montre l'essentiel, les pages dédiées montrent le détail
4. **URL = état** — les filtres (range, etc.) vivent dans les search params URL
5. **Loaders = fraîcheur** — chaque page prefetch ses données dans le loader TanStack
6. **Fail-soft** — si une query échoue, la page reste utilisable
7. **IA first-class** — l'IA a sa propre section, pas un widget dans une page news

## Relation entre surfaces métier

```
                    ┌─────────────┐
                    │   COCKPIT   │ ← point d'entrée
                    │ (synthèse)  │
                    └──────┬──────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
    ┌─────┴─────┐   ┌─────┴─────┐   ┌─────┴──────┐
    │ Dépenses  │   │ Patrimoine│   │ Investiss. │
    │(flux)     │   │(stock)    │   │(positions) │
    └───────────┘   └───────────┘   └────────────┘
          │
    ┌─────┴─────┐
    │ Objectifs │
    │(planning) │
    └───────────┘

    ┌─────────────────────────────────────┐
    │             IA                      │
    │  Advisor → Chat → Mémoire → Coûts  │
    │  (enrichi par Données & signaux)    │
    └─────────────────────────────────────┘
                     ↑
    ┌────────────────┼──────────────────┐
    │ Actualités │ Marchés │ Sources    │
    │ (contexte externe / signaux)      │
    └───────────────────────────────────┘
```

## Guidelines pour les futures évolutions

### Ajouter une page

1. Créer `apps/web/src/routes/_app/{section}/{nom}.tsx`
2. Ajouter le loader avec prefetch des queries nécessaires
3. Ajouter l'entrée dans `NAV_ITEMS` (`nav-items.ts`) avec le bon `group`
4. Mettre à jour ce document
5. Vérifier que la bottom nav mobile reste gérable (max 4 tabs + Plus)

### Ajouter au cockpit

Le cockpit ne doit PAS grossir indéfiniment. Avant d'ajouter une carte :
- Est-ce que l'utilisateur a besoin de cette info **chaque jour** ?
- Est-ce que ça ne fait pas doublon avec une page dédiée ?
- Est-ce que ça peut être un **lien** vers la page dédiée plutôt qu'une duplication ?

### Navigation source de vérité

`apps/web/src/components/shell/nav-items.ts` est la source unique pour :
- tous les items de navigation
- les groupes (cockpit, ia, signaux)
- les priorités mobile
- les descriptions et icônes
