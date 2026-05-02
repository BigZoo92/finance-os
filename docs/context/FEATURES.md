# Finance-OS -- Features Metier

> **Derniere mise a jour** : 2026-04-26
> **Maintenu par** : agents (Claude, Codex) + humain
> Documenter ici toute nouvelle feature ou evolution significative.

---

## Contexte produit

Finance-OS est une **application de finances personnelles** pour un usage individuel (mono-utilisateur, self-hosted). Ce n'est pas un SaaS -- c'est un cockpit financier prive. L'interface est entierement en **francais**.

---

## 1. Dashboard (Cockpit principal)

**Route** : `/`
**API** : `GET /dashboard/summary?range=7d|30d|90d`

Le dashboard est la page principale, organisee en 5 sections navigables par ancres :

### 1.1 Vue patrimoine globale
- Solde total agrege de tous les comptes connectes
- Income vs Expenses sur la periode selectionnee
- Cashflow directionnel (barre income% vs expense%)
- Tendance patrimoine (indicateur hausse/baisse/stable)

### 1.2 Historique de patrimoine
- Sparkline SVG custom (pas de librairie tierce)
- Filtres : 7j, 14j, tout
- Indicateurs min/max/derniere valeur
- Pourcentage de variation
- Export SVG et PDF via APIs navigateur

### 1.3 Structure des depenses
- Breakdown par categorie avec pourcentages
- Comparaison tendance mensuelle
- Top 5 groupes de depenses avec nombre de transactions et montant total

### 1.4 Alertes et signaux
- Signaux d'alerte personnels
- Warnings de synchronisation
- Signaux budgetaires
- Detection d'anomalies
- Affichage en pills bordes avec titre + detail + badge

### 1.5 Range selector
- Boutons 7j / 30j / 90j
- Persiste dans les search params URL (`?range=30d`)

---

## 2. Agregation bancaire (Powens)

**Routes API** : `/integrations/powens/*`

### 2.1 Fonctionnement

Finance-OS utilise **Powens**, un agregateur bancaire conforme PSD2, pour synchroniser les donnees bancaires.

```
Utilisateur clique "Connecter une banque"
  -> GET /integrations/powens/connect-url
  -> Generation URL webview Powens avec state signe (HMAC, anti-CSRF)
  -> Redirection vers webview Powens (iframe bancaire)
  -> L'utilisateur s'authentifie aupres de sa banque
  -> Powens redirige vers POST /integrations/powens/callback
  -> Validation signature du state
  -> Echange code OAuth -> access token (Powens API)
  -> Chiffrement token AES-256-GCM
  -> Stockage en DB (powens_connection.accessTokenEncrypted)
  -> Mise en file d'attente sync (Redis job queue)
```

### 2.2 Synchronisation

**Deux modes** :
- **Automatique** : scheduler dans le Worker (optionnel, configurable)
- **Manuelle** : bouton dashboard avec cooldown (300s par defaut, rate-limit Redis)

**Mode recommande actuellement** :
- `WORKER_AUTO_SYNC_ENABLED=false`
- sync Powens declenchee via la mission manuelle advisor ou les actions admin explicites

**Pipeline de sync** :
1. Worker dequeue le job Redis (BLPOP)
2. Acquisition lock Redis par connexion (TTL 15min)
3. Dechiffrement token d'acces
4. Fetch comptes via Powens API
5. Upsert comptes + actifs en DB (transaction SQL unique)
6. Pour chaque compte : fetch transactions paginee
7. Upsert transactions par batch de 800 lignes
8. Controles d'integrite (gaps de transactions > 45j, coherence comptes)
9. Mise a jour statut connexion + metriques Redis
10. Liberation lock

**Sync incrementale** : fenetre de lookback (7j par defaut) pour capturer les ecritures tardives. Utilise un watermark `last_success_at`.

**Full resync** : disponible par connexion (10 ans d'historique).

### 2.3 Statuts de connexion

| Statut | Signification |
|---|---|
| `connected` | Connexion active, sync OK |
| `syncing` | Sync en cours |
| `error` | Erreur technique (retry auto) |
| `reconnect_required` | Auth PSD2 expiree, action utilisateur requise |

### 2.4 Reconnexion PSD2
Quand l'authentification bancaire expire, l'app affiche un bandeau de reconnexion avec un CTA vers la webview Powens.

### 2.5 Audit trail
Historique complet des sync runs : timestamps, resultats, erreurs par fingerprint, diagnostics.

### 2.6 Kill-switch
- `EXTERNAL_INTEGRATIONS_SAFE_MODE` : desactive toutes les syncs Powens
- `POWENS_SYNC_DISABLED_PROVIDERS` : desactive par provider specifique

---

## 3. Transactions

**Routes** : `GET /dashboard/transactions?range=...&limit=...&cursor=...`, `/transactions`

### 3.1 Liste de transactions
- Pagination cursor-based (performant sur gros volumes)
- Recherche full-text : label, compte, categorie, tag
- Filtre par range temporel (7j, 30j, 90j)
- Infinite scroll avec bouton "Charger plus"

### 3.2 Categorisation intelligente

Systeme de resolution multi-source ordonne par priorite :

| Priorite | Source | Description |
|---|---|---|
| 1 | Override manuel | L'utilisateur choisit la categorie |
| 2 | Regles marchand | Regles custom par nom de marchand |
| 3 | Code MCC Powens | Categorisation automatique Powens |
| 4 | Contrepartie | Inference par contrepartie |
| 5 | Fallback | "Unknown - [marchand]" |

Chaque transaction expose sa chaine de resolution ("Why this category?" expandable).

### 3.3 Enrichissement
- **Notes** : annotations utilisateur par transaction
- **Tags custom** : tableau JSON libre
- **Type de revenu** : salaire, recurrent, exceptionnel
- **Override marchand** : avec historique des changements
- **Bulk triage** : categorisation par lot (admin)

### 3.4 Classification
- Direction : income vs expense (detection automatique)
- Categorie / sous-categorie
- Couleurs semantiques : rouge (depense), vert (revenu)

---

## 4. Engagements recurrents

**Schema** : `recurring_commitment`, `recurring_commitment_transaction_link`

### Detection automatique
- Types : charges fixes, abonnements
- Periodicite : hebdomadaire, mensuel, trimestriel, annuel, inconnu
- Etats de validation : suggere, valide, rejete
- Score de confiance
- Liaison avec les transactions correspondantes
- Activation/desactivation par l'utilisateur

---

## 5. Objectifs financiers

**Routes** : `GET/POST /dashboard/goals`, `PATCH /dashboard/goals/:id`

### Fonctionnement
- **Types** : fonds d'urgence, voyage, immobilier, education, retraite, custom
- **Suivi** : montant cible, montant actuel, date cible
- **Snapshots de progression** : historique horodate avec notes
- **Archivage** : les objectifs termines/abandonnes sont archives (`archived_at`)
- **UI** : liste avec barres de progression, creation/edition/archivage (admin uniquement)

---

## 6. Actifs et positions d'investissement

**Schema** : `asset`, `investment_position`

### Actifs
- Types : cash, investissement, manuel
- Origines : provider (Powens), saisie manuelle
- Supporte les actifs non-bancaires (immobilier, crypto, art...)
- En mode admin, aucun actif manuel n'est injecte en dur par defaut
- Les actifs manuels admin se gerent via `/dashboard/manual-assets` et apparaissent ensuite dans les vues patrimoine

### Positions d'investissement
- Quantite, cout de base, valeur courante
- Source du cout de base : minimal, provider, manuel, inconnu
- Dates de valorisation et derniere sync
- Positions ouvertes/fermees
- Affichage en tableau avec colonnes : nom, actif, quantite, cout base, valeur, dates

---

## 6.bis Investissements externes IBKR / Binance

**Routes UI** : `/patrimoine`, `/investissements`, `/integrations`, `/sante`
**Routes API dashboard cache-only** : `/dashboard/external-investments/*`
**Routes API admin/internal** : `/integrations/external-investments/*`
**Rapport detaille** : [EXTERNAL-INVESTMENTS.md](EXTERNAL-INVESTMENTS.md)

### Fonctionnement

- Configuration admin chiffree pour IBKR Flex et Binance Spot.
- Demo: fixtures deterministes, zero DB write, zero provider call.
- Admin: lectures dashboard cache-only depuis PostgreSQL; syncs uniquement sur action explicite ou job worker.
- Worker Redis:
  - `externalInvestments.syncAll`
  - `externalInvestments.syncProvider`
  - `externalInvestments.syncConnection`
- Verrou par connexion/provider pour eviter les syncs concurrentes.
- Erreurs fail-soft: IBKR peut echouer sans bloquer Binance, news, marches ou Advisor.

### Donnees normalisees

- comptes externes
- instruments avec symboles, ISIN/CUSIP/conid ou asset Binance quand disponibles
- positions avec quantite, free/locked, valeurs connues ou inconnues
- trades avec side, prix, quantite, frais/commission
- cash flows: depot, retrait historique, dividende, interet, fee, tax, transfer, unknown
- raw import metadata: hash/digest, taille, statut, reference provider, sans payload secret brut dans les logs

### Valuation

- Priorite: valeur provider reportee, puis cache marche existant si present, puis valeur manuelle deja supportee, sinon unknown.
- Pas de nouvelle dependance paid market data.
- Pas de prix crypto invente.
- Les positions sans valeur ou cout de base gardent des warnings explicites.

### UI

- `/patrimoine` ajoute un bloc investissements externes avec provider freshness, allocations et warnings.
- `/investissements` devient un cockpit avec filtres provider/compte/classe/recherche, table positions, trades recents, cash flows et quality panel.
- `/integrations` permet la configuration des credentials, le retrait et la sync manuelle par provider.
- `/sante` expose health providers, derniers runs, request IDs, raw imports et compte de lignes normalisees.

### Advisor

- Un bundle compact `advisor_investment_context_bundle` alimente le moteur deterministe, le brief, les recommandations, le challenger, le chat grounded, les assumptions et les evals.
- Le bundle contient uniquement des faits normalises et des hypotheses; jamais le JSON/XML provider brut.
- L'Advisor peut repondre sur crypto exposure, provider stale, cout de base inconnu, concentration, part valorisee vs inconnue et limites de qualite data.

### Limites

- Pas de trading, retrait, transfert, reequilibrage execute ou endpoint Binance mutant.
- Pas d'IBKR Client Portal trading.
- Pas de reporting fiscal; les donnees utiles sont preservees pour un futur travail dedie.
- Binance trade backfill est volontairement conservateur et limite aux symboles connus.

---

## 7. Projections de fin de mois

### Contenu
- Jours ecoules / restants dans le mois
- Revenus et depenses a date
- Net moyen par jour
- Projection nette en fin de mois
- Tableau des charges fixes attendues
- Tableau des revenus attendus

---

## 8. Budgets mensuels par categorie

### Fonctionnement
- Budget defini par categorie pour le mois en cours
- Barres de progression depense vs budget
- Breakdown par categorie
- Editable (admin uniquement)

---

## 9. Plateforme news / signaux macro-financiers

**Routes** : `GET /dashboard/news`, `GET /dashboard/news/context`, `POST /dashboard/news/ingest`
**Rapport detaille** : [NEWS-FETCH.md](NEWS-FETCH.md)

### Fonctionnement
- Lecture `GET /dashboard/news` strictement cache-only
- Ingestion live explicite via `POST /dashboard/news/ingest`
- Scheduler worker optionnel via `NEWS_AUTO_INGEST_ENABLED`
- Providers multi-source:
  - Hacker News Algolia
  - GDELT DOC 2.0
  - ECB RSS
  - ECB Data Portal
  - Federal Reserve RSS
  - SEC EDGAR / data.sec.gov
  - FRED
- Normalisation metier deterministic:
  - taxonomie de domaines
  - `eventType`
  - `severity`, `confidence`, `novelty`
  - `marketImpactScore`, `relevanceScore`
  - risques, opportunites, secteurs, themes, tickers, entites
- Deduplication cross-source:
  - canonical URL
  - titre normalise
  - similarite textuelle
  - fenetre temporelle
  - entites partagees
- Scraping metadata article:
  - Open Graph
  - canonical
  - favicon
  - JSON-LD `Article` / `NewsArticle`
- Restitution UI:
  - signal leaders
  - flux enrichi
  - provenance
  - clusters d'evenements
  - provider health
  - context preview pour IA future
- Fail-soft:
  - cache stale/degrade visible
  - fallback fixture/admin_fallback cote API
  - fallback demo cote web si l'appel API casse

---

## 9.bis Marches & Macro

**Route** : `/marches`
**Routes API** : `GET /dashboard/markets/overview`, `GET /dashboard/markets/watchlist`, `GET /dashboard/markets/macro`, `GET /dashboard/markets/context-bundle`, `POST /dashboard/markets/refresh`
**Rapport detaille** : [MARKETS-MACRO.md](MARKETS-MACRO.md)

### Fonctionnement
- Lecture SSR-first via loader TanStack puis Query (`/marches`)
- Lecture `GET /dashboard/markets/*` strictement cache-only
- Refresh live explicite via `POST /dashboard/markets/refresh`
- Scheduler worker optionnel via `MARKET_DATA_AUTO_REFRESH_ENABLED`
- Providers:
  - EODHD = baseline global EOD / differe
  - Twelve Data = overlay optionnel plus frais sur certains symboles US
  - FRED = series macro officielles

### Dataset initial
- Panorama global: `SPY`, `QQQ`, `VGK`, `EWJ`, `IEMG`, `CW8`
- Watchlist PEA / Euronext: `CW8`, `MEUD`, `AEEM`, `MJP`, `AIR`, `MC`
- Cross-asset lisible: `IEF`, `GLD`, `EZA`
- Macro FRED: `FEDFUNDS`, `SOFR`, `DGS2`, `DGS10`, `T10Y2Y`, `CPIAUCSL`, `UNRATE`
- Pas de crypto

### Restitution UI
- Hero premium avec resume marche, fraicheur et source primaire
- Heat strip panorama
- Macro pulse panel avec mini-series D3
- Relative performance ribbon D3
- Watchlist mondiale dense mais lisible
- Signal board deterministic (pas de fake AI)
- Legend de provenance / fraicheur

### Context bundle IA futur
- Objet stable `MarketContextBundle`
- Contient couverture, key movers, market breadth, regime hints, macro regime, risk flags, provenance, freshness et caveats
- Aucune generation LLM aujourd'hui
- Reutilisable plus tard pour un advisor IA sans repenser le pipeline

### Demo / Admin
- Demo: fixture deterministic, read-only, zero DB, zero provider
- Admin: lecture PostgreSQL snapshot-first, refresh live sur action explicite ou scheduler worker
- Fallback admin: si cache / provider indisponible, l'UI reste usable avec source `admin_fallback`

### Limites assumees
- Les indices cash non verifies en gratuit sont remplaces par des ETF proxies explicites
- Les badges de fraicheur doivent afficher honnetement `EOD`, `differe` ou `overlay US`
- La couverture Twelve Data gratuite n'est pas traitee comme une source globale de reference

---

## 10. Conseiller IA / Quant

**Routes** :

- `GET /dashboard/advisor`
- `GET /dashboard/advisor/daily-brief`
- `GET /dashboard/advisor/recommendations`
- `GET /dashboard/advisor/runs`
- `GET /dashboard/advisor/assumptions`
- `GET /dashboard/advisor/signals`
- `GET /dashboard/advisor/spend`
- `GET /dashboard/advisor/knowledge-topics`
- `GET /dashboard/advisor/knowledge-answer`
- `GET /dashboard/advisor/knowledge/stats`
- `GET /dashboard/advisor/knowledge/schema`
- `POST /dashboard/advisor/knowledge/query`
- `POST /dashboard/advisor/knowledge/context-bundle`
- `POST /dashboard/advisor/knowledge/explain`
- `POST /dashboard/advisor/knowledge/rebuild`
- `GET /dashboard/advisor/chat`
- `POST /dashboard/advisor/chat`
- `GET /dashboard/advisor/evals`
- `GET /dashboard/advisor/manual-refresh-and-run`
- `GET /dashboard/advisor/manual-refresh-and-run/:operationId`
- `POST /dashboard/advisor/manual-refresh-and-run`
- `POST /dashboard/advisor/run-daily`
- `POST /dashboard/advisor/relabel-transactions`

**Feature flags** :

- Frontend: `VITE_AI_ADVISOR_ENABLED`, `VITE_AI_ADVISOR_ADMIN_ONLY`
- API/Worker: `AI_ADVISOR_ENABLED`, `AI_ADVISOR_ADMIN_ONLY`, `AI_ADVISOR_FORCE_LOCAL_ONLY`, `AI_KNOWLEDGE_QA_RETRIEVAL_ENABLED`

### Architecture produit

- Moteur deterministe dans `packages/finance-engine`
- Couche provider/prompt/schema/pricing dans `packages/ai`
- OpenAI = classification, daily brief, chat grounded
- Anthropic = challenger review
- Artefacts persistes en base:
  - snapshots portefeuille
  - briefs quotidiens
  - recommandations et contre-analyses
  - signaux macro/news
  - suggestions de relabel transaction
  - threads/messages de chat
  - runs, steps, usages modele, ledger de cout, evals
- Knowledge pack educatif read-only:
  - topics statiques sur fonds d'urgence, diversification, DCA, inflation/rendement reel, obligations/taux, dettes, risque/horizon, reequilibrage
  - fondation `Financial Datasets` pour expliquer les familles de donnees (prix, fundamentals, macro, news), leurs delais et les checks qualite avant interpretation
  - retrieval heuristique local + assemblage de reponse template
  - citations de sections du pack
  - garde-fous contre le conseil personnalise, fiscal, juridique, ou achat/vente
- Memoire temporelle `apps/knowledge-service`:
  - service Python FastAPI interne uniquement, appele par l'API via `KNOWLEDGE_SERVICE_URL`
  - schema graph temporel pour concepts financiers, formules, signaux news/marches, snapshots personnels, recommandations, modeles, usages tokens et observations de cout
  - retrieval hybride: texte/BM25, vecteur optionnel, traversal graphe, scoring temporel, confiance et provenance
  - `KnowledgeContextBundle` compact pour enrichir, expliquer et challenger les recommandations sans remplacer le moteur deterministe
  - mode demo deterministe sans DB, provider, embedding externe ou mutation reelle
  - mode admin persistant et rebuildable depuis les sources canoniques; les faits contradictoires ou supersedes restent historises

### Fonctionnement actuel

- Le mode recommande est **manuel-first**
- Le bouton admin `Tout rafraichir et analyser` sur `/actualites` orchestre:
  - refresh des donnees personnelles reelles
  - refresh news
  - refresh marche
  - run advisor complet
  - persistance des runs, couts, artefacts et evals
- Les schedulers `AI_DAILY_AUTO_RUN_ENABLED` et `WORKER_AUTO_SYNC_ENABLED` restent desactives dans ce mode
- Le moteur deterministe calcule:
  - allocation
  - cash drag
  - concentration
  - diversification
  - emergency fund / runway
  - rendements attendus nominaux/reels
  - proxies de volatilite, downside risk, Sharpe, Sortino, max drawdown
  - signaux de drift et scenarios simples
- Les recommandations candidates sont d'abord produites de facon deterministe
- La memoire graphe peut fournir un contexte explicable avant generation ou challenge, mais `packages/finance-engine` reste la source de decision primaire
- OpenAI reformule un brief quotidien structure et relabel les transactions ambiguës
- Claude challenger relit les recommandations prioritaires et peut les confirmer, les adoucir ou les flagger
- Le panneau Q&A educatif repond depuis le knowledge pack avec score de confiance, citations, et fallback browse-only vers les sujets si la confiance est faible
- Le chat repond a partir des artefacts persistants, hypotheses et signaux deja stockes
- Les couts IA sont historises et exposes dans l'UI

### Demo / Admin

- Demo:
  - zero DB
  - zero provider
  - zero mutation
  - brief/recommandations/chat/Q&A educatif deterministes
  - memoire graphe servie par fixtures deterministes et read-only
- Admin:
  - lecture DB et artefacts persistants
  - retrieval Q&A read-only autorise si `AI_KNOWLEDGE_QA_RETRIEVAL_ENABLED=true`
  - endpoints memoire admin appellent le service interne si `KNOWLEDGE_SERVICE_ENABLED=true`, avec fallback degradable si indisponible
  - runs manuels via orchestration complete ou planifies plus tard via worker
  - degrades intelligentes si budget, provider, kill-switch retrieval, ou garde-fou de contenu bloque

### Notes d'exploitation

- Le conseiller n'est jamais un "LLM unique qui lit tout"
- Les hypotheses et limites sont persistantes et consultables
- Les budgets peuvent couper le challenger ou les analyses plus profondes avant blocage total
- Voir aussi:
  - `docs/AI-ARCHITECTURE.md`
  - `docs/AI-SETUP.md`
  - `docs/AI-COSTS.md`
  - `docs/AI-EVALS.md`

---

## 11. Notifications push

**Routes** : `/notifications/push/*`
**Feature flags** : `PWA_NOTIFICATIONS_ENABLED`, `PWA_CRITICAL_ENABLED`

### Fonctionnement
- Web Push API avec cles VAPID
- Opt-in/opt-out par l'utilisateur
- Stockage subscription Redis (endpoint, cles, expiration)
- Distinction notifications critiques vs regulieres
- Degradation gracieuse si permission navigateur refusee
- Envoi de test via `/notifications/push/send-preview`

---

## 12. PWA

### Capacites
- Mode standalone (`display: standalone`)
- Icones maskable (192x192, 512x512)
- Theme sombre (`#0b1020`)
- Prompt d'installation avec cooldown 7j apres refus
- Orientation portrait preferee
- Scope : `/` (app complete)

### Resilience offline
- Dashboard affiche les donnees cachees (wealth snapshots, transactions)
- Navigation entre routes possible
- Mutations bloquees avec message explicite
- Failsoft policy : lecture cache -> fallback demo, ingestion live explicite separee
- Indicateurs de fraicheur/degradation par widget

---

## 13. Derived Recompute

**Routes** : `GET/POST /dashboard/derived-recompute`

### Fonctionnement
- Recalcul en arriere-plan des classifications et snapshots de transactions
- Etats : Idle, Running, Completed, Failed
- Declenchement manuel (admin uniquement)
- Affichage : etat, snapshot actif, derniere execution, nombre de lignes
- Feature flag : `DERIVED_RECOMPUTE_ENABLED`

---

## 14. Export

### Implemente
- **Export CSV transactions** : bouton dans la section Ops
- **Export PDF resume** : bouton dans la section Ops
- **Export SVG sparkline** : chart patrimoine

### Non implemente (prevu)
- Generation de releves PDF
- Rapport fiscal annuel
- Telechargement bulk de transactions

---

## 15. Systeme d'authentification

### Mecanisme
- **Hash** : PBKDF2-SHA256 (210k iterations) ou Argon2 (legacy)
- **Session** : cookie HttpOnly signe HMAC-SHA256 (`finance_os_session`)
- **TTL** : 30 jours par defaut
- **Rate limiting** : 5 tentatives/min (Redis-backed)

### Flux login
1. `POST /auth/login` (email + password)
2. Validation email contre `AUTH_ADMIN_EMAIL`
3. Verification hash Argon2/PBKDF2 (timing-safe)
4. Cookie HttpOnly SameSite=Lax Secure
5. `GET /auth/me` -> `{ mode: 'admin' }`

### Flux logout
1. `POST /auth/logout`
2. Cookie efface
3. Retour en mode demo

---

## 16. Health & Observabilite

### Endpoints
- `GET /health` : liveness (no auth)
- `GET /healthz` : readiness (no auth)
- `GET /version` : info version (no auth)
- `GET /debug/health` : latence DB + Redis (token requis)
- `GET /debug/metrics` : metriques operationnelles (token requis)

### Dashboard health
- Indicateur global de sante
- Badges de sante par widget
- Signaux de sante configurables (`VITE_DASHBOARD_HEALTH_*`)
- Panel diagnostics Powens avec guidance et retry

### Ops-alerts (sidecar)
- 4 familles d'alertes : burst 5xx, healthcheck failure, worker heartbeat, disk low
- Webhook configurable (ntfy, Slack, Discord, Mattermost)
- Scoring : impact (0-5) + confidence (0-3) + recency (0-2)

---

## Matrice des features par mode

| Feature | Demo | Admin |
|---|---|---|
| Dashboard lecture | Mocks deterministes | Donnees reelles DB |
| Transactions | Fixtures | Cursor-paginated DB |
| Objectifs | Lecture seule | CRUD complet |
| Sync Powens | Desactivee | Active |
| Categorisation | Lecture seule | Edition |
| Budgets | Lecture seule | Edition |
| News | Fixtures deterministes | Ingestion live + cache enrichi |
| Marches & Macro | Fixtures deterministes | Cache DB + refresh live |
| Conseiller IA | Mocks | Local (pas d'API LLM) |
| Notifications | Desactivees | Actives |
| Export | Non disponible | CSV + PDF |
| Derived recompute | Desactive | Declenchement admin |

---

## Schema de donnees (tables cles)

| Table | Role |
|---|---|
| `powens_connection` | Connexions bancaires, tokens chiffres, statut sync |
| `financial_account` | Comptes bancaires (IBAN, type, solde, devise) |
| `transaction` | Transactions avec categorisation multi-source |
| `provider_raw_import` | Payloads bruts Powens pour audit |
| `personal_goal` | Objectifs financiers avec snapshots progression |
| `recurring_commitment` | Abonnements/charges detectes |
| `asset` | Actifs (provider + manuels) |
| `investment_position` | Positions d'investissement |
| `enrichment_note` | Notes utilisateur par transaction |
| `news_article` | Signal canonique enrichi |
| `news_article_source_ref` | Provenance cross-source par signal |
| `news_cache_state` | Etat global du cache news |
| `news_provider_state` | Health et compteurs par provider |
| `market_quote_snapshot` | Snapshot canonique d'un instrument avec source et fraicheur |
| `market_macro_observation` | Observations macro FRED persistantes |
| `market_cache_state` | Etat global du cache marches |
| `market_provider_state` | Health et compteurs par provider marches |
| `market_context_bundle_snapshot` | Snapshot du bundle IA marches |
| `derived_recompute_run` | Statut recompute background |
