# Architecture d'information - Finance-OS

> Carte des pages, rôle de chaque surface, principes de navigation.
> Refactorisée le 2026-05-03 pour séparer l'usage quotidien, l'Advisor IA et les surfaces expert/admin.

## Structure Produit

Finance-OS ne doit pas montrer tout ce qu'il sait au même niveau. Le cockpit quotidien expose les décisions et les alertes utiles; les signaux bruts, diagnostics et outils de recherche restent disponibles dans un espace avancé.

### 1. Cockpit Personnel

| Route | Page | Rôle | Données principales |
|---|---|---|---|
| `/` | Vue d'ensemble / Cockpit | Entrée quotidienne: KPIs, tendance patrimoine, dépenses, connexions, objectifs, résumé IA digéré | `dashboardSummary`, `financialGoals`, `powensStatus`, `dashboardAdvisor` |
| `/depenses` | Dépenses & revenus | Transactions, revenus, budgets, projection fin de mois | `dashboardTransactions`, `dashboardSummary` |
| `/patrimoine` | Patrimoine | Actifs, historique patrimoine, soldes par connexion, investissements externes résumés | `dashboardSummary`, `externalInvestmentsSummary`, `externalInvestmentsPositions` |
| `/investissements` | Investissements | Positions et portefeuille lisible; détails provider en contexte | `dashboardSummary`, `externalInvestments*` |
| `/objectifs` | Objectifs | Objectifs financiers personnels et progression | `financialGoals` |

Les intégrations ne sont plus dans ce groupe: elles restent accessibles depuis le cockpit quand une connexion demande attention, mais leur page complète vit dans Intelligence & Admin.

### 2. Advisor IA

| Route | Page | Rôle | Données principales |
|---|---|---|---|
| `/ia` | Vue IA | Hub Advisor: synthèse, recommandations, hypothèses, questions utiles et journal de décisions non persistant | `dashboardAdvisor*`, `dashboardAdvisorRecommendations`, `dashboardAdvisorAssumptions` |
| `/ia/chat` | Chat | Questions directes à l'Advisor sur dépenses, patrimoine et investissements, avec garde-fous de décision | `dashboardAdvisorChat`, `dashboardAdvisorKnowledgeTopics`, `dashboardAdvisor` |
| `/ia/memoire` | Mémoire | Inspection de la mémoire dérivée, provenance, confiance et contexte utilisé par l'Advisor | `knowledgeStats`, `knowledgeSchema`, `knowledgeQuery`, `knowledgeContextBundle` |
| `/ia/memoire/graph` | Carte mémoire 3D | Visualisation force-directed 3D de la mémoire Advisor: concepts, signaux, recommandations, contradictions, sources. Strictement enrichissement, pas une base de vérité. | `knowledgeStats`, `knowledgeSchema`, `knowledgeQuery`, `knowledgeContextBundle` |

Le Trading Lab et les coûts IA ne sont pas des surfaces Advisor quotidiennes. Ils restent disponibles dans Intelligence & Admin.

#### Structure Advisor User-Facing

L'Advisor IA est organisé autour de cinq zones lisibles:

1. **Synthèse**: ce que l'Advisor voit, ce qui change, ce qui est sain et ce qui demande attention.
2. **Conseils & recommandations**: chaque recommandation expose pourquoi maintenant, données utilisées, hypothèses, risques/limites, confiance et prochaine question à poser.
3. **Questions à poser**: starters contextualisés pour clarifier les décisions sans transformer le chat en bouton d'exécution.
4. **Hypothèses & limites**: données manquantes, fraîcheur, budget IA et signaux faibles qui réduisent la confiance.
5. **Journal de décisions**: surface préparatoire non persistante. Elle ne prétend pas sauvegarder tant qu'un modèle dédié n'existe pas.

Bornes explicites:

- la visualisation Force Graph 3D vit sur `/ia/memoire/graph` (chantier dédié), `/ia/memoire` reste l'inspection texte;
- la carte 3D est une **mémoire dérivée**: elle n'est pas la base de vérité financière, ne pilote aucun ordre et n'expose aucun payload provider brut;
- pas de learning loop ou apprentissage automatique depuis les décisions utilisateur;
- pas de fiscalité/tax advice définitif;
- pas de trading, transfert, ordre, staking, rééquilibrage automatique ou chemin d'exécution;
- l'Advisor est séparé de la pipeline agentique de développement.

### 3. Intelligence & Admin

| Route | Page | Rôle | Données principales |
|---|---|---|---|
| `/signaux` | Signaux | Hub de données brutes et signaux avancés utilisés par l'Advisor | `dashboardNews`, `signalHealth`, `signalSources` |
| `/signaux/marches` | Marchés | Panorama macro, watchlist mondiale et signaux marché | `marketsOverview` |
| `/signaux/social` | Social | Comptes sociaux surveillés et imports manuels | `signalSources`, `signalHealth` |
| `/signaux/sources` | Sources | Provenance, fraîcheur et qualité des données, admin-only en navigation | Multiple health queries |
| `/ia/trading-lab` | Trading Lab | Recherche papier, backtests et scénarios, sans trading réel | `tradingLab*`, `attentionItems` |
| `/ia/couts` | Coûts IA | Tokens, modèles, budget et runs Advisor, admin-only en navigation | `dashboardAdvisorSpend`, `dashboardAdvisorRuns` |
| `/integrations` | Intégrations | Connexions Powens, sync runs, diagnostics, audit trail, credentials read-only externes | `powens*`, `externalInvestments*` |
| `/sante` | Santé | État système, provider health, sync et pipelines dérivés | Tous les endpoints status/health |
| `/parametres` | Paramètres | Notifications, exports, recompute dérivé et configuration avancée | `pushSettings`, `derivedRecomputeStatus` |

## Redirections Conservées

| Ancienne route | Nouvelle route | Type |
|---|---|---|
| `/actualites` | `/signaux` | 301 |
| `/memoire` | `/ia/memoire` | 301 |
| `/marches` | `/signaux/marches` | 301 |

## Routes Système Hors Shell

| Route | Rôle |
|---|---|
| `/login` | Authentification |
| `/transactions` | Navigateur de transactions legacy conservé hors shell |
| `/powens/callback` | Callback Powens SSR |
| `/health` | Health check public |
| `/healthz` | Health check legacy avec flags |
| `/version` | Version applicative |

## Navigation

`apps/web/src/components/shell/nav-items.ts` reste la source unique des groupes, labels, descriptions, priorités mobile et items admin-only.

### Desktop

La sidebar affiche trois espaces avec une courte description:

1. Cockpit personnel: argent personnel, dépenses, patrimoine, investissements, objectifs.
2. Advisor IA: vue IA, chat, mémoire.
3. Intelligence & Admin: signaux bruts, marchés, social, sources, Trading Lab, coûts IA, intégrations, santé, paramètres.

Les items `adminOnly` sont masqués en navigation hors session admin, mais les routes conservent leur propre comportement de dégradation ou de garde-fou.

### Mobile

La bottom nav reste volontairement courte: Vue d'ensemble, Dépenses & revenus, Patrimoine, Vue IA, puis "Plus". Le drawer "Plus" reprend les mêmes groupes que la sidebar.

## Workflow Quotidien Prioritaire

1. `/` - comprendre ce qui compte aujourd'hui.
2. `/depenses` - contrôler les flux.
3. `/ia` ou `/ia/chat` - lire un conseil ou poser une question.
4. `/patrimoine` et `/investissements` - vérifier le stock patrimonial.
5. `/objectifs` - suivre la progression.

Les surfaces Intelligence & Admin se consultent pour auditer, diagnostiquer ou rechercher. Elles alimentent l'Advisor, mais ne sont pas une routine obligatoire.

## Principes

1. Le cockpit digère; il ne copie pas les terminaux experts.
2. L'Advisor explique et recommande; il ne remplace pas les sources de vérité financières.
3. Intelligence & Admin expose les données brutes, la fraîcheur, les diagnostics et la recherche.
4. Demo reste déterministe et mock-backed; admin peut lire les providers derrière les garde-fous existants.
5. Les routes existantes restent accessibles ou redirigées.
