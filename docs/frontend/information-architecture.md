# Architecture d'information — Finance-OS

> Carte des pages, rôle de chaque surface, principes de navigation.

## Structure des routes

### Routes applicatives (sous layout `_app.tsx`)

| Route | Page | Rôle | Données principales |
|-------|------|------|---------------------|
| `/` | **Cockpit** | Vue d'ensemble — KPIs, tendance patrimoine, top dépenses, connexions, objectifs | `dashboardSummary`, `financialGoals`, `powensStatus` |
| `/depenses` | **Dépenses** | Transactions, structure des dépenses, budgets, projection fin de mois | `dashboardTransactions`, `dashboardSummary` |
| `/patrimoine` | **Patrimoine** | Actifs, historique patrimoine, soldes par connexion | `dashboardSummary` |
| `/investissements` | **Investissements** | Positions d'investissement, valorisation, P&L | `dashboardSummary` (positions) |
| `/marches` | **Marches & Macro** | Panorama marche, macro, watchlist mondiale, signaux et bundle IA futur | `marketsOverview` |
| `/objectifs` | **Objectifs** | Objectifs financiers personnels (CRUD) | `financialGoals` |
| `/actualites` | **Actualités** | Flux d'actualités financières, conseiller IA | `dashboardNews`, `dashboardAdvisor` |
| `/integrations` | **Intégrations** | Connexions Powens, sync runs, diagnostics, audit trail | `powensStatus`, `powensSyncRuns`, `powensDiagnostics`, `powensAuditTrail` |
| `/sante` | **Santé** | Vue consolidée de l'état système — connexions, sync, diagnostics, derived, push | Tous les endpoints status/health |
| `/parametres` | **Paramètres** | Notifications push, derived recompute, exports | `pushSettings`, `derivedRecomputeStatus` |

Additional AI route:

| Route | Page | Role | Donnees principales |
|-------|------|------|---------------------|
| `/memoire` | **Memoire & connaissances** | Graphe temporel interne, recherche hybride, provenance, contradictions et preview du contexte AI Advisor | `knowledgeStats`, `knowledgeSchema`, `knowledgeQuery`, `knowledgeContextBundle` |

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

### Desktop (≥1024px)

```
┌─────────────┬──────────────────────────────────┐
│  Sidebar     │  Topbar (titre, démo badge,      │
│  (240px)     │  session)                        │
│              ├──────────────────────────────────│
│  ◈ Cockpit   │                                  │
│  ↔ Dépenses  │  [Contenu de page]               │
│  ▣ Actualités│                                  │
│  ◊ Patrimoine│  max-width: 7xl (1280px)         │
│  ◎ Objectifs │                                  │
│  △ Invest.   │                                  │
│  ≈ Marchés   │                                  │
│  ⊞ Intégr.  │                                  │
│  ⚙ Paramèt. │                                  │
│              │                                  │
│  [Réduire]   │                                  │
└─────────────┴──────────────────────────────────┘
```

- La sidebar se réduit à 68px (icônes seules) via toggle
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
│  ◈   ↔   ▣   ◊   ◎   ⋯        │
│  Bottom navigation               │
└──────────────────────────────────┘
```

- Bottom navigation avec les 5 pages principales + "Plus" (drawer)
- Le drawer "Plus" affiche toutes les 10 pages avec descriptions
- Indicateur actif : barre ambre en haut du tab

## Workflow quotidien prioritaire

Ordre de navigation principal (desktop + mobile) :
1. `Cockpit` → point d'entrée et synthèse journalière.
2. `Dépenses` → contrôle du flux du jour (transactions, budgets, projection).
3. `Actualités` → briefing rapide (news + advisor) pour contextualiser les décisions.
4. `Patrimoine` → état du stock patrimonial.
5. `Objectifs` → arbitrage et progression.

Les surfaces `Investissements` et `Marchés` restent accessibles immédiatement mais passent après ce noyau quotidien pour limiter la charge cognitive lors des sessions courtes.

## Principes de navigation

1. **Chaque page a un rôle clair** — pas de chevauchement entre pages
2. **Progressive disclosure** — le cockpit montre l'essentiel, les pages dédiées montrent le détail
3. **URL = état** — les filtres (range, etc.) vivent dans les search params URL
4. **Loaders = fraîcheur** — chaque page prefetch ses données dans le loader TanStack
5. **Fail-soft** — si une query échoue, la page reste utilisable (sections individuelles gèrent leurs erreurs)

## Relation entre surfaces métier

```
                    ┌─────────────┐
                    │   COCKPIT   │
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
    ┌─────┴─────┐   ┌───────────┐   ┌────────────┐
    │ Objectifs │   │ Actualités│   │ Intégrations│
    │(planning) │   │(contexte) │   │(ops)       │
    └───────────┘   └───────────┘   └────────────┘
                                          │
                                    ┌─────┴──────┐
                                    │ Paramètres │
                                    │(config)    │
                                    └────────────┘
```

Le cockpit est le point d'entrée. Il redirige naturellement vers les pages dédiées via les cartes de synthèse. `Marches & Macro` sert de surface de contexte exogène : elle complète `Actualités` avec un snapshot de marché lisible mais reste séparée du cockpit personnel. Les intégrations et paramètres sont séparés de la surface métier car ils concernent l'infrastructure, pas les finances.

## Guidelines pour les futures évolutions

### Ajouter une page

1. Créer `apps/web/src/routes/_app/{nom}.tsx`
2. Ajouter le loader avec prefetch des queries nécessaires
3. Ajouter l'entrée dans `NAV_ITEMS` du composant `AppSidebar`
4. Mettre à jour ce document
5. Vérifier que la bottom nav mobile reste gérable (max 5 items principaux)

### Ajouter une section au cockpit

Le cockpit ne doit PAS grossir indéfiniment. Avant d'ajouter une carte au cockpit, se demander :
- Est-ce que l'utilisateur a besoin de cette info **chaque jour** ?
- Est-ce que ça ne fait pas doublon avec une page dédiée ?
- Est-ce que ça peut être un **lien** vers la page dédiée plutôt qu'une duplication ?

### Ajouter un filtre global

Les filtres de période (`range`) sont locaux à chaque page. Un filtre global (par exemple : toutes les pages sur la même période) devrait vivre dans un layout context, pas dans chaque page individuellement.
