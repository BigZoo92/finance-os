# Finance-OS -- Features Metier

> **Derniere mise a jour** : 2026-04-08
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
- **Automatique** : scheduler dans le Worker (configurable, 2x/jour par defaut, min 12h en prod)
- **Manuelle** : bouton dashboard avec cooldown (300s par defaut, rate-limit Redis)

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

### Positions d'investissement
- Quantite, cout de base, valeur courante
- Source du cout de base : minimal, provider, manuel, inconnu
- Dates de valorisation et derniere sync
- Positions ouvertes/fermees
- Affichage en tableau avec colonnes : nom, actif, quantite, cout base, valeur, dates

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

## 9. Fil d'actualites financieres

**Routes** : `GET /dashboard/news`, `POST /dashboard/news/ingest`
**Source** : Hacker News Algolia API (articles finance)

### Fonctionnement
- Ingestion depuis HN Algolia : `https://hn.algolia.com/api/v1/search_by_date?query=finance&tags=story`
- Classification par topic : crypto, ETF/fonds, macro, marches
- Deduplication SHA256 sur titre+URL
- Cache PostgreSQL avec seuil de fraicheur (6h)
- Filtres par topic et source
- Score de pertinence avec raisons
- Resilience : live -> cache -> demo (failsoft policy)
- Statut de resilience affiche : ok, degrade, indisponible

---

## 10. Conseiller IA (MVP)

**Route** : `GET /dashboard/advisor`
**Feature flags** : `VITE_AI_ADVISOR_ENABLED`, `VITE_AI_ADVISOR_ADMIN_ONLY`

### Fonctionnement actuel
- Insights generes localement (pas d'API LLM externe pour l'instant)
- Contexte : solde, revenus, depenses, cashflow net, ratio depenses, actifs, top depenses
- Recommandations actionnables avec estimation d'effort (low/medium/high) et impact mensuel
- Workflow de decision avec checkpoints
- Statuts : suggere / en cours / termine
- Citations liees aux donnees comptables
- Fonctionne en demo et admin (mocks deterministes en demo)
- Fallback local si provider indisponible

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
- Failsoft policy : live -> cache -> demo
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
| News | Mocks ou cache | Live + cache |
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
| `news_article` | Cache articles financiers |
| `news_cache_state` | Etat du cache news (singleton) |
| `derived_recompute_run` | Statut recompute background |
