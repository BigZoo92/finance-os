# Finance-OS -- News Fetch

> **Derniere mise a jour** : 2026-04-26
> **Maintenu par** : agents (Claude, Codex) + humain
> Toute modification touchant `/dashboard/news`, `/dashboard/news/context`, `/dashboard/news/ingest`, `apps/api/src/routes/dashboard/domain/dashboard-news.ts`, `apps/api/src/routes/dashboard/services/fetch-live-news.ts`, `apps/api/src/routes/dashboard/services/providers/**`, `apps/api/src/routes/dashboard/services/scrape-article-metadata.ts`, `apps/api/src/routes/dashboard/repositories/dashboard-news-repository.ts`, `apps/worker/src/news-ingest-scheduler.ts`, `packages/db/src/schema/news.ts`, `apps/web/src/features/dashboard-api.ts`, `apps/web/src/features/dashboard-query-options.ts`, `apps/web/src/features/demo-data.ts`, `apps/web/src/components/dashboard/news-feed.tsx`, `apps/web/src/components/dashboard/relevance-scoring.ts`, ou les flags news/failsoft doit mettre a jour ce document dans le meme changement.

---

## 1. Resume executif

La feature news n'est plus un simple feed HN. C'est maintenant une **plateforme cache-first de collecte et de restitution de signaux macro-financiers et evenementiels**.

- `GET /dashboard/news` reste **cache-only**.
- `POST /dashboard/news/ingest` reste le point d'entree live explicite.
- Le worker peut maintenant lancer des ingestions recurrentes via `NEWS_AUTO_INGEST_ENABLED`.
- Le mode recommande actuel pour l'advisor garde `NEWS_AUTO_INGEST_ENABLED=false` et reutilise cette route depuis la mission manuelle complete.
- L'ingestion est **multi-source**, **deterministe**, **sans LLM externe**, avec:
  - normalisation metier,
  - taxonomie hierarchique,
  - dedupe cross-source,
  - enrichissement d'entites/themes/risques/opportunites,
  - scraping leger de metadata article,
  - health par provider,
  - context bundle pour future IA.
- Le `NewsContextBundle` est maintenant consomme par le pipeline advisor quotidien pour persister des `ai_macro_signal` et `ai_news_signal`, sans changer l'invariant cache-only de `GET /dashboard/news`.

Le principe produit ne change pas:

1. demo = fixtures deterministes uniquement
2. admin = DB + providers
3. fail-soft obligatoire
4. aucune lecture `GET /dashboard/news` ne doit appeler un provider live

---

## 2. Sources retenues

### 2.1 Backbone actuel

Providers actuellement cables dans `apps/api/src/routes/dashboard/runtime.ts` :

| Provider | ID | Role principal | Auth |
|---|---|---|---|
| Hacker News Algolia | `hn_algolia` | tech, startup, AI, internet finance | aucune |
| GDELT DOC 2.0 | `gdelt_doc` | couverture globale media / geopolitique / macro | aucune |
| ECB RSS | `ecb_rss` | speeches, press releases, publications | aucune |
| ECB Data Portal | `ecb_data` | points macro structures / releases de series | aucune |
| Federal Reserve RSS | `fed_rss` | policy, speeches, press releases | aucune |
| SEC EDGAR / data.sec.gov | `sec_edgar` | filings primaires et submissions | aucune cle, `User-Agent` requis |
| FRED | `fred` | series macro structurees | `FRED_API_KEY` |
| X/Twitter recent search | `x_twitter` | capter des signaux evenementiels tres recents (macro, guidance, cyber, geopolitique) | `NEWS_PROVIDER_X_TWITTER_BEARER_TOKEN` |

### 2.2 Providers sociaux (Prompt 4)

- `x_twitter`
  - branche dans le runtime mais **desactive par defaut**
  - la foundation actuelle se limite a la recherche recente (`/2/tweets/search/recent`) avec query configurable
  - tant que `NEWS_PROVIDER_X_TWITTER_ENABLED=false` ou que le bearer token est absent, le provider n'ingere aucun item
  - API officielle pay-per-use uniquement, pas de scraping
- `bluesky`
  - provider Bluesky/ATProto ajoute en Prompt 4
  - desactive par defaut (`BLUESKY_ENABLED=false`)
  - utilise l'API XRPC avec app password
  - alternative gratuite et ouverte a X/Twitter
- `manual_import`
  - permet l'import manuel de signaux via JSON/texte
  - toujours disponible en mode admin
  - utile comme fallback avant l'activation d'un provider payant
  - endpoint: `POST /dashboard/signals/ingest/manual`

### 2.3 Providers prepares mais non cables

- `alpha_vantage`
  - type deja reserve dans la taxonomie
  - non branche par defaut
  - volontairement exclu du backbone pour eviter une dependance centrale a une API a quotas serras

### 2.3 Sources explicitement non retenues comme coeur

- `NewsAPI` gratuit
  - non retenu comme dependance coeur
  - couverture/quotas/licensing trop fragiles pour la base produit

---

## 3. Architecture end-to-end

### 3.1 Runtime API

Le runtime dashboard compose:

- `createDashboardNewsRepository()`
- `createLiveNewsIngestionService()`
- les adapters provider `providers/**`
- `createDashboardNewsUseCases()`
- les flags provider, scraping, fail-soft et context bundle

### 3.2 Lecture cache-only

Flux:

```text
Web admin
  -> dashboardNewsQueryOptionsWithMode()
  -> fetchDashboardNews()
  -> GET /dashboard/news
  -> createNewsRoute()
  -> selectDashboardNewsDataset()
  -> dashboard.useCases.getNews()
  -> newsRepository.getNewsCacheState()
  -> newsRepository.listNewsArticles()
  -> reponse cache enrichie
```

Important:

- `GET /dashboard/news` ne lance jamais un provider live
- la reponse contient:
  - items enrichis
  - health par provider
  - clusters d'evenements
  - context preview
  - fail-soft envelope

### 3.3 Ingestion explicite

Flux:

```text
Admin UI ou worker interne
  -> POST /dashboard/news/ingest
  -> createNewsRoute()
  -> ingestNews()
  -> runLiveIngestion()
  -> provider adapters
  -> normalisation / enrichissement
  -> dedupe cross-source
  -> metadata scrape optionnel
  -> DB cache
```

Le `POST` accepte:

- session admin
- ou token interne valide (`x-internal-token`)

Le bouton advisor `Tout rafraichir et analyser` ne contourne pas ce contrat: il orchestre la meme logique d'ingestion cote serveur, puis attend un etat de fraicheur utilisable avant de lancer l'analyse advisor.

### 3.4 Scheduler worker

Le worker ajoute un scheduler dedie:

```text
Worker setInterval
  -> triggerDashboardNewsIngest()
  -> POST API_INTERNAL_URL/dashboard/news/ingest
  -> lock Redis news:dashboard:ingest:lock
```

Invariants:

- pas de provider call direct depuis le worker
- le worker repasse par le contrat HTTP interne
- lock Redis pour eviter les overlaps

### 3.5 Integration advisor

Le pipeline advisor ne modifie pas l'invariant de la feature news:

- `GET /dashboard/news` reste cache-only
- `POST /dashboard/news/ingest` reste le seul point d'entree live
- aucun provider news n'est appele depuis le chat advisor ou les routes read-only advisor

Ce qui change:

- `createDashboardAdvisorUseCases()` lit `getNewsContextBundle({ range: '7d' })`
- les hypotheses causales et top signals du bundle sont transformees en:
  - `ai_macro_signal`
  - `ai_news_signal`
- ces signaux servent ensuite au:
  - daily brief
  - challenger
  - chat grounded

Autrement dit, la news stack reste une source structuree et cachee, et l'advisor consomme ses artefacts au lieu d'aller reparcourir le web en direct.

### 3.6 Memoire temporelle

Le `NewsContextBundle` est une source canonique admissible pour `apps/knowledge-service`, mais l'invariant cache-first ne change pas:

- l'ingestion graphe consomme uniquement les artefacts deja normalises/cachees; elle ne declenche pas de provider news
- `GET /dashboard/news` et `GET /dashboard/news/context` restent read-only/cache-only
- les relations graphe possibles (`NewsSignal -> MacroSignal -> Sector/Ticker -> Recommendation`) gardent provenance, timestamp source, confiance et validite temporelle
- demo reste fixture-only; admin peut reconstruire la memoire depuis les snapshots persistants
- les contradictions ou signaux obsoletes sont historises au lieu d'ecraser les faits precedents

---

## 4. Mode demo vs admin

| Surface | Demo | Admin |
|---|---|---|
| `apps/web/src/routes/_app/actualites.tsx` | prewarm fixtures web | prewarm API cache |
| `dashboardNewsQueryOptionsWithMode()` | `getDemoDashboardNews()` | `fetchDashboardNews()` |
| `GET /dashboard/news` | fixture pack versionne | cache PostgreSQL enrichi |
| `GET /dashboard/news/context` | interdit sans token interne | bundle IA cache-only |
| `POST /dashboard/news/ingest` | `403` | ingestion live explicite |
| worker news scheduler | aucun effet demo | ingestion recurrente via token interne |

Notes:

- demo web et demo API restent deux fixtures distinctes
- aucune lecture demo ne touche la DB
- aucun provider n'est appele en demo

---

## 5. Taxonomie et enrichissement

### 5.1 Domaines couverts

La taxonomie `news-taxonomy.ts` couvre notamment:

- finance
- markets
- macroeconomy
- central_banks
- monetary_policy
- regulation
- legislation
- public_policy
- geopolitics
- conflict
- sanctions
- diplomacy
- supply_chain
- logistics
- energy
- commodities
- technology
- ai
- cybersecurity
- product_launches
- model_releases
- cyber_incidents
- earnings
- guidance
- filings
- mna
- capital_markets
- credit
- real_estate
- public_health
- climate
- labor
- general_impact
- emerging_themes

### 5.2 Event types

Exemples:

- `policy_decision`
- `macro_release`
- `regulatory_action`
- `filing_8k`
- `earnings_result`
- `guidance_update`
- `product_launch`
- `model_release`
- `cyber_incident`
- `geopolitical_escalation`
- `sanctions_update`
- `general_update`

### 5.3 Enrichissement deterministic

`createNormalizedNewsSignal()` produit:

- domaines, categories, subcategories
- `eventType`
- `severity`, `confidence`, `novelty`
- `marketImpactScore`, `relevanceScore`
- `riskFlags`, `opportunityFlags`
- entites affectees
- tickers inferes si fiables
- secteurs et themes
- hypotheses de transmission
- `whyItMatters`
- `macroLinks`, `policyLinks`, `filingLinks`

---

## 6. Deduplication et clustering

### 6.1 Dedupe key de stockage

Le champ `dedupeKey` persiste une cle stable issue de:

- fingerprint canonical URL si disponible
- sinon fingerprint titre normalise
- event type
- jour de publication

### 6.2 Dedupe cross-source

`resolveNewsDuplicate()` combine plusieurs heuristiques:

- canonical URL fingerprint
- titre normalise exact
- similarite Jaccard sur tokens de titre
- meme `eventType`
- meme `sourceDomain`
- fenetre de publication proche
- entites partagees

Seuil de merge actuel: score >= `60`.

### 6.3 Provenance

Quand plusieurs sources fusionnent:

- `news_article` garde un signal canonique
- `news_article_source_ref` garde toutes les references source
- `provenance` expose:
  - `sourceCount`
  - `providerCount`
  - providers
  - domains d'origine

### 6.4 Clusters

Le cache restitue aussi des clusters legerement agrages:

- `eventClusterId`
- `signalCount`
- `sourceCount`
- `topDomains`
- `topSectors`

But:

- reduire le bruit cross-source
- preparer des bundles utilisables par une IA plus tard

---

## 7. Metadata scraping

Le scraping est volontairement leger et safe.

Service:

- `apps/api/src/routes/dashboard/services/scrape-article-metadata.ts`

Strategie:

- fetch server-side
- URL publique uniquement: `http:`/`https:`, pas de `localhost`, IP privees, loopback, link-local, metadata IPs, ni redirection vers ces cibles
- redirections manuelles bornees
- timeout strict
- taille max stricte
- lecture partielle du `head`
- pas de headless browser
- fallback minimal si HTML indisponible, non HTML, ou site restreint
- aucun cookie/token interne n'est transmis aux URLs externes

Champs extraits:

- `<title>`
- `meta description`
- canonical
- `og:title`
- `og:description`
- `og:image`
- `og:image:url`
- `og:image:secure_url`
- `og:image:alt`
- `og:site_name`
- `og:url`
- `twitter:title`
- `twitter:description`
- `twitter:image`
- `twitter:image:src`
- `twitter:image:alt`
- `icon` / `favicon`
- JSON-LD `Article` / `NewsArticle`

Le resultat est stocke dans:

- `metadataFetchStatus`
- `metadataCard`
- `metadataFetchedAt`

Le `metadataCard` conserve maintenant:

- `imageUrl` + `imageCandidates[]`
- `faviconUrl` + `faviconCandidates[]`
- `imageAlt`

But:

- fournir une meilleure image hero si plusieurs meta tags existent
- garder des fallbacks si `og:image` ou l'icone principale est indisponible
- permettre une UI plus visuelle sans headless browser ni scraping du body

---

## 8. Stockage PostgreSQL

### 8.1 `news_article`

Table canonique des signaux agreges.

Contient notamment:

- ids provider et article
- URLs provider/canonical
- source name/domain/type
- title, summary, snippet
- pays, region, geo scope
- domaines/categories/subcategories
- event type
- scores et labels
- flags risque / opportunite
- entites / tickers / secteurs / themes
- hypotheses de transmission
- liens macro / policy / filing
- raw payload sanitize
- metadata card
- provenance

### 8.2 `news_article_source_ref`

Une ligne par source rattachee a un signal canonique.

Usage:

- provenance UI
- dedupe audit
- reconstitution future d'un cluster/source set

### 8.3 `news_cache_state`

Singleton global du domaine news.

Contient:

- derniers timestamps success/attempt/failure
- derniere erreur safe
- compteurs d'ingestion / dedupe / echec provider
- derniers compteurs fetched / inserted / merged
- dernier nombre de providers et de signaux

### 8.4 `news_provider_state`

Etat par provider:

- active ou non
- success / failure / skipped counters
- dernier fetch / merge / insert
- dernier cooldown
- dernier message d'erreur safe

---

## 9. Endpoints et contrats

### 9.1 `GET /dashboard/news`

Filtres supportes:

- `topic`
- `source`
- `sourceType`
- `domain`
- `eventType`
- `minSeverity`
- `region`
- `ticker`
- `sector`
- `direction`
- `from`
- `to`
- `limit`

Reponse:

- `items`
- `providers`
- `clusters`
- `contextPreview`
- `resilience`
- `metrics`
- `dataset`

### 9.2 `GET /dashboard/news/context`

Endpoint cache-only pour bundle IA futur.

Acces:

- admin
- ou token interne valide

Plages:

- `24h`
- `7d`
- `30d`

Contenu:

- top signals
- clustered events
- impacted sectors/entities
- regulator / central bank / filings highlights
- thematic highlights
- contradictory signals
- causal hypotheses
- supporting references

### 9.3 `POST /dashboard/news/ingest`

Acces:

- admin
- ou token interne valide

Retour:

- `fetchedCount`
- `insertedCount`
- `mergedCount`
- `dedupeDropCount`

En cas d'echec:

- `503`
- envelope safe
- la lecture cache reste disponible

---

## 10. UI actuelle

Le composant `NewsFeed` expose maintenant:

- hero radar cache-first
- filtres de lecture
- signal leaders
- flux enrichi avec `why it matters`
- cards visuelles adossees aux images metadata, favicons et provenance source
- provenance visible
- metadata cards
- clusters d'evenements
- impacts secteurs / entites
- sante des providers
- bouton admin pour lancer une ingestion manuelle

Le scoring UI reste distinct du scoring backend:

- backend = score canonique du signal
- frontend = reranking local selon les filtres actifs

---

## 11. Flags et kill-switches

### 11.1 Core

- `LIVE_NEWS_INGESTION_ENABLED`
- `NEWS_AI_CONTEXT_BUNDLE_ENABLED`
- `NEWS_MAX_PROVIDER_ITEMS_PER_RUN`
- `NEWS_METADATA_FETCH_ENABLED`
- `NEWS_METADATA_FETCH_TIMEOUT_MS`
- `NEWS_METADATA_FETCH_MAX_BYTES`
- `NEWS_SCRAPER_USER_AGENT`
- `SEC_USER_AGENT`
- `DASHBOARD_NEWS_FORCE_FIXTURE_FALLBACK`

### 11.2 Providers

- `NEWS_PROVIDER_HN_ENABLED`
- `NEWS_PROVIDER_HN_QUERY`
- `NEWS_PROVIDER_GDELT_ENABLED`
- `NEWS_PROVIDER_GDELT_QUERY`
- `NEWS_PROVIDER_ECB_RSS_ENABLED`
- `NEWS_PROVIDER_ECB_RSS_FEED_URLS`
- `NEWS_PROVIDER_ECB_DATA_ENABLED`
- `NEWS_PROVIDER_ECB_DATA_SERIES_KEYS`
- `NEWS_PROVIDER_FED_ENABLED`
- `NEWS_PROVIDER_FED_FEED_URLS`
- `NEWS_PROVIDER_SEC_ENABLED`
- `NEWS_PROVIDER_SEC_TICKERS`
- `NEWS_PROVIDER_FRED_ENABLED`
- `NEWS_PROVIDER_FRED_SERIES_IDS`
- `FRED_API_KEY`

### 11.3 Worker

- `NEWS_AUTO_INGEST_ENABLED`
- `NEWS_FETCH_INTERVAL_MS`

### 11.4 Fail-soft

- `FAILSOFT_POLICY_ENABLED`
- `FAILSOFT_SOURCE_ORDER`
- `FAILSOFT_NEWS_ENABLED`

---

## 12. Verification actuelle

Tests couverts:

- enrichissement et taxonomie
- dedupe cross-source
- metadata extraction
- contrats route `GET /dashboard/news`
- contrats route `POST /dashboard/news/ingest`
- fallback web API -> demo
- scheduler worker news
- scoring UI

Verification recommandees apres changement:

- `pnpm --filter @finance-os/api typecheck`
- `bun test apps/api/src/routes/dashboard/domain/news-enrichment.test.ts apps/api/src/routes/dashboard/domain/news-dedupe.test.ts apps/api/src/routes/dashboard/services/scrape-article-metadata.test.ts apps/api/src/routes/dashboard/routes/news.test.ts`
- `pnpm --filter @finance-os/web typecheck`
- `pnpm --filter @finance-os/web test`
- `pnpm --filter @finance-os/worker typecheck`
- `bun test apps/worker/src/news-ingest-scheduler.test.ts`

---

## 13. Signal item persistence (Prompt 4B)

En complement de la table `news_article` (backbone news), `signal_item` persiste les signaux provenant de:
- imports manuels (`manual_import`)
- providers sociaux (X/Twitter, Bluesky)
- tout provider normalise dans le pipeline signal

Le pipeline complet: normalisation → enrichissement → classification → scoring → dedupe → persist → graph ingest auto-trigger.

Verification specifique aux signaux:
- `bun test apps/api/src/routes/dashboard/domain/signal-pipeline.test.ts apps/api/src/routes/dashboard/domain/signal-classifier.test.ts`

## 14. Limites connues

- pas de LLM externe: tout l'enrichissement est deterministic
- pas de scraping body complet: volontaire
- pas de scheduler par provider ni de backoff complexe par provider pour l'instant
- `alpha_vantage` est prepare mais non branche
- demo web et demo API restent deux fixtures separees
- certains providers publics ont des contraintes fortes:
  - GDELT doit etre rate-limite
  - SEC exige un `User-Agent` explicite
  - FRED exige une cle API
- `signal_item` et `news_article` sont deux tables separees; les signaux sociaux vont dans `signal_item`, les news backbone restent dans `news_article`

---

## 14. Regle de verite

Ne laissez jamais la doc raconter:

```text
GET /dashboard/news -> live provider
```

si l'implementation reste:

```text
ingest live explicite ou worker -> DB cache -> GET cache-only -> fallback demo/fixture
```
