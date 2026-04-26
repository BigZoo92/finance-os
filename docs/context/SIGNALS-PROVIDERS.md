# Finance-OS -- Signal Providers Landscape

> **Derniere mise a jour** : 2026-04-26
> **Maintenu par** : agents (Claude, Codex) + humain
> Source de verite pour les providers externes du domaine signaux.

---

## Vue d'ensemble

Finance-OS consomme des signaux externes depuis plusieurs categories de sources:
- **News / media** : HN, GDELT
- **Central banks / regulateurs** : ECB RSS, Fed RSS, SEC EDGAR
- **Macro structuree** : FRED, ECB Data Portal
- **Marches** : EODHD, Twelve Data (voir MARKETS-MACRO.md)
- **Social / opinion leaders** : X/Twitter, Bluesky/ATProto
- **Manual** : imports JSON/CSV/texte

Principes:
- API officielles uniquement, aucun scraping non autorise
- cache-first, fail-soft, provider-abstracted
- providers payes optionnels et desactives par defaut si credentials absents
- les GET ne touchent jamais un provider live

---

## 1. X/Twitter API v2

| Detail | Valeur |
|---|---|
| **Use case** | Signaux evenementiels finance + AI/tech depuis comptes surveilles ou recherche recente |
| **Auth** | Bearer token (pay-per-use credits) |
| **Cout** | Pay-per-use: ~$0.005/post read, ~$0.01/user profile. Aucun free tier pour nouveaux devs (fev 2026) |
| **Rate limits** | 2M post reads/mois max. Meme post lu plusieurs fois dans 24h UTC = 1 charge |
| **Endpoints utiles** | `GET /2/tweets/search/recent`, `GET /2/users/:id/tweets`, `GET /2/users/by/username/:username` |
| **Contraintes legales** | ToS X API: pas de scraping, pas de redistribution bulk, usage declare |
| **Data shape** | JSON: id, text, created_at, author_id, entities, public_metrics |
| **Fraicheur** | Recent search: 7 derniers jours max |
| **Fiabilite** | Variable (changements API frequents, pricing changeant) |
| **Fail-soft** | Si credentials absents ou budget epuise: provider desactive, aucun item |
| **Feed AI Advisor** | Oui (via scoring + filtre, jamais brut) |
| **Feed Knowledge Graph** | Oui (SocialSignal nodes) |
| **Feed Trading Lab** | Indirect (signaux scores uniquement) |

Sources: [X API Pricing](https://docs.x.com/x-api/getting-started/pricing), [X Pay-Per-Use Announcement](https://devcommunity.x.com/t/announcing-the-launch-of-x-api-pay-per-use-pricing/256476)

---

## 2. Bluesky / AT Protocol

| Detail | Valeur |
|---|---|
| **Use case** | Alternative sociale ouverte, signaux AI/tech, finance indirecte |
| **Auth** | App password pour API authentifiee; firehose/Jetstream sans auth |
| **Cout** | Gratuit (protocole ouvert) |
| **Rate limits** | API: 3000 pts/5min (rate limit headers). Jetstream: websocket, pas de limite applicative formelle |
| **Endpoints utiles** | `app.bsky.feed.getAuthorFeed`, `app.bsky.feed.searchPosts`, Jetstream websocket |
| **Contraintes legales** | Protocole ouvert, ToS Bluesky standard. Pas de redistribution de contenu non autorisee |
| **Data shape** | JSON (XRPC/Lexicon): uri, cid, author, record, indexedAt |
| **Fraicheur** | Temps reel via Jetstream; API: quasi-temps reel |
| **Fiabilite** | Bonne (4 instances Jetstream publiques operees par Bluesky) |
| **Fail-soft** | Si non configure: provider desactive. Jetstream non formel = fallback API HTTP |
| **Feed AI Advisor** | Oui (meme pipeline que X, via scoring) |
| **Feed Knowledge Graph** | Oui (SocialSignal nodes) |
| **Feed Trading Lab** | Indirect |

Sources: [Bluesky API Docs](https://docs.bsky.app/docs/advanced-guides/api-directory), [Jetstream](https://docs.bsky.app/blog/jetstream), [Jetstream GitHub](https://github.com/bluesky-social/jetstream)

Caveat: Jetstream n'est pas formellement partie du protocole AT. Bluesky ne garantit pas sa stabilite long terme.

---

## 3. GDELT DOC 2.0

| Detail | Valeur |
|---|---|
| **Use case** | Couverture media globale, geopolitique, macro |
| **Auth** | Aucune |
| **Cout** | Gratuit |
| **Rate limits** | Non documente precisement, rate-limiting actif sur clusters ElasticSearch. Prudence requise |
| **Endpoints utiles** | `https://api.gdeltproject.org/api/v2/doc/doc?query=...&format=json&maxrecords=250` |
| **Contraintes legales** | Usage raisonnable, pas de high-volume abusif |
| **Data shape** | JSON: url, title, seendate, domain, language, socialimage, tone |
| **Fraicheur** | Quelques minutes de latence |
| **Fiabilite** | Moyenne (surcharges possibles lors d'evenements majeurs) |
| **Fail-soft** | Cooldown + skip si erreur, cache existing articles |
| **Feed AI Advisor** | Oui |
| **Feed Knowledge Graph** | Oui (NewsSignal) |
| **Feed Trading Lab** | Indirect |

Sources: [GDELT DOC 2.0 API](https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/), [Rate Limiting Blog](https://blog.gdeltproject.org/ukraine-api-rate-limiting-web-ngrams-3-0/)

---

## 4. Hacker News Algolia

| Detail | Valeur |
|---|---|
| **Use case** | Tech, AI, startup, model releases, cybersecurity |
| **Auth** | Aucune |
| **Cout** | Gratuit |
| **Rate limits** | ~10,000 req/heure par IP |
| **Endpoints utiles** | `https://hn.algolia.com/api/v1/search_by_date?query=...&tags=story` |
| **Data shape** | JSON: objectID, title, url, author, created_at, points, num_comments |
| **Fraicheur** | Quasi temps reel |
| **Fiabilite** | Elevee |
| **Fail-soft** | Cooldown si erreur, cache existing |
| **Feed AI Advisor** | Oui (surtout AI/tech/model signals) |
| **Feed Knowledge Graph** | Oui (NewsSignal) |
| **Feed Trading Lab** | Indirect |

Sources: [HN Algolia API](https://hn.algolia.com/api)

---

## 5. SEC EDGAR / data.sec.gov

| Detail | Valeur |
|---|---|
| **Use case** | Filings primaires (8-K, 10-Q, 10-K, 20-F, 6-K) |
| **Auth** | Aucune cle; User-Agent explicite requis avec nom + email |
| **Cout** | Gratuit |
| **Rate limits** | 10 req/s par IP. Depassement = block 403 pendant ~10 min |
| **Endpoints utiles** | `https://data.sec.gov/submissions/CIK{cik}.json` |
| **Contraintes legales** | Fair Access Policy: usage raisonnable, User-Agent declare |
| **Data shape** | JSON: filings.recent (form, filingDate, accessionNumber, primaryDocument) |
| **Fraicheur** | Quelques heures apres depot |
| **Fiabilite** | Elevee |
| **Fail-soft** | Backoff si 403, skip provider |
| **Feed AI Advisor** | Oui (filings) |
| **Feed Knowledge Graph** | Oui (FilingSignal / SourceDocument) |
| **Feed Trading Lab** | Oui (events catalyseurs) |

Sources: [SEC EDGAR API](https://www.sec.gov/search-filings/edgar-search-assistance/accessing-edgar-data), [SEC Rate Limits](https://www.sec.gov/filergroup/announcements-old/new-rate-control-limits)

---

## 6. FRED (Federal Reserve Economic Data)

| Detail | Valeur |
|---|---|
| **Use case** | Series macro structurees (taux, CPI, emploi, yields) |
| **Auth** | `FRED_API_KEY` (enregistrement gratuit) |
| **Cout** | Gratuit |
| **Rate limits** | 120 req/min |
| **Endpoints utiles** | `https://api.stlouisfed.org/fred/series/observations?series_id=...&api_key=...&file_type=json` |
| **Data shape** | JSON: observations[].date, observations[].value |
| **Fraicheur** | Retardee (donnees officielles, release schedule) |
| **Fiabilite** | Tres elevee |
| **Fail-soft** | Skip si cle absente, cache existing |
| **Feed AI Advisor** | Oui (signaux macro) |
| **Feed Knowledge Graph** | Oui (MacroSignal / MacroObservation) |
| **Feed Trading Lab** | Oui (macro context) |

Sources: [FRED API](https://fred.stlouisfed.org/docs/api/fred/), [FRED Terms](https://fred.stlouisfed.org/docs/api/terms_of_use.html)

---

## 7. ECB RSS

| Detail | Valeur |
|---|---|
| **Use case** | Press releases, speeches, publications, blog ECB |
| **Auth** | Aucune |
| **Cout** | Gratuit |
| **Rate limits** | Non documente formellement |
| **Data shape** | RSS/XML standard |
| **Fraicheur** | Quelques heures |
| **Fiabilite** | Elevee |
| **Feed AI Advisor** | Oui (signaux central bank) |
| **Feed Knowledge Graph** | Oui (NewsSignal avec domain central_banks) |

---

## 8. ECB Data Portal (SDMX)

| Detail | Valeur |
|---|---|
| **Use case** | Series statistiques structurees (FX, taux) |
| **Auth** | Aucune |
| **Cout** | Gratuit |
| **Rate limits** | Limites de telechargement: 500 series CSV |
| **Data shape** | SDMX-JSON / CSV |
| **Fraicheur** | Release schedule officiel |
| **Fiabilite** | Elevee |
| **Feed AI Advisor** | Oui (macro context) |
| **Feed Knowledge Graph** | Oui (MacroSignal) |

Sources: [ECB Data Portal API](https://data.ecb.europa.eu/help/api/overview)

---

## 9. Federal Reserve RSS

| Detail | Valeur |
|---|---|
| **Use case** | Monetary policy, speeches, press releases Fed |
| **Auth** | Aucune |
| **Cout** | Gratuit |
| **Data shape** | RSS/XML standard |
| **Feed AI Advisor** | Oui (signaux central bank / monetary policy) |
| **Feed Knowledge Graph** | Oui |

---

## 10. EODHD

| Detail | Valeur |
|---|---|
| **Use case** | Source primaire globale prix EOD / differees |
| **Auth** | `EODHD_API_KEY` |
| **Cout** | Plan free: 20 appels/jour, 1 an historique |
| **Rate limits** | Plan-dependent |
| **Feed AI Advisor** | Oui (market context) |
| **Feed Knowledge Graph** | Oui (market observations) |
| **Feed Trading Lab** | Oui |

Voir [MARKETS-MACRO.md](MARKETS-MACRO.md) pour details.

---

## 11. Twelve Data

| Detail | Valeur |
|---|---|
| **Use case** | Overlay optionnel US plus frais |
| **Auth** | `TWELVEDATA_API_KEY` |
| **Cout** | Plan Basic: 8 credits/min, 800/jour |
| **Rate limits** | Credit-based |
| **Feed AI Advisor** | Oui (market context) |
| **Feed Knowledge Graph** | Oui |
| **Feed Trading Lab** | Oui |

Voir [MARKETS-MACRO.md](MARKETS-MACRO.md) pour details.

---

## 12. Manual Import

| Detail | Valeur |
|---|---|
| **Use case** | Fallback universel: import JSON/CSV/texte de posts sociaux, notes, signaux manuels |
| **Auth** | Admin session |
| **Cout** | Gratuit |
| **Rate limits** | Aucune (single-user) |
| **Contraintes legales** | Responsabilite utilisateur sur le contenu importe |
| **Data shape** | JSON ou CSV normalise en signal items |
| **Fraicheur** | Manuelle |
| **Fiabilite** | Depends de l'utilisateur |
| **Fail-soft** | N/A (import explicite) |
| **Feed AI Advisor** | Oui (via normalisation + scoring) |
| **Feed Knowledge Graph** | Oui |
| **Feed Trading Lab** | Possible |

---

## Matrice recapitulative

| Provider | Category | Auth | Free | Rate Limits | Status |
|---|---|---|---|---|---|
| X/Twitter v2 | Social | Bearer token (paid credits) | Non | 2M reads/mois | Optionnel, desactive par defaut |
| Bluesky/ATProto | Social | App password / none | Oui | 3000 pts/5min | Optionnel, desactive par defaut |
| GDELT DOC 2.0 | News | Aucune | Oui | Rate-limite (non precis) | Actif |
| HN Algolia | News/Tech | Aucune | Oui | 10K req/h | Actif |
| SEC EDGAR | Filing | User-Agent | Oui | 10 req/s | Actif |
| FRED | Macro | API Key | Oui | 120 req/min | Actif si cle |
| ECB RSS | Central bank | Aucune | Oui | - | Actif |
| ECB Data | Macro | Aucune | Oui | 500 series | Optionnel |
| Fed RSS | Central bank | Aucune | Oui | - | Actif |
| EODHD | Market | API Key | Partiel | 20/jour free | Actif |
| Twelve Data | Market | API Key | Partiel | 800/jour | Optionnel |
| Manual Import | Fallback | Admin session | Oui | - | Toujours disponible |

---

## Architecture de persistence

Le schema canonique est PostgreSQL:
- `signal_source`: comptes et sources surveilles (Finance / IA-Tech)
- `signal_item`: signaux persistes, classifies, scores, dedupliques
- `signal_ingestion_run`: historique des runs d'ingestion

Le Knowledge Graph (Neo4j/Qdrant) est derive:
- Les `SocialSignal` / `NewsSignal` sont envoyes automatiquement apres chaque ingestion reussie
- L'ingestion graph est fail-soft: si le service est indisponible, les signaux restent en `pending`
- Le champ `graphIngestStatus` sur `signal_item` trace l'etat (`pending` / `sent` / `failed` / `skipped`)

Le pipeline complet:
1. Import (API/provider/manual) → normalisation → enrichissement deterministe
2. Classification (Finance / IA-Tech / macro / market / regulatory / cybersecurity)
3. Scoring (relevance, novelty, confidence, impact, urgency)
4. Attention detection (patterns Finance + patterns IA/Tech)
5. Dedupe par `dedupeKey` (SHA-256 stable)
6. Persistence dans `signal_item`
7. Auto-trigger graph ingest pour les signaux top-scored (si KNOWLEDGE_SERVICE_ENABLED=true)
8. Mise a jour de `signal_ingestion_run` avec les compteurs

## Regles de securite

- Aucune cle provider dans `VITE_*`
- Aucun appel provider depuis le frontend
- Tous les appels provider passent par API/worker serveur
- Bearer tokens, API keys: jamais logges
- Cooldown et backoff sur chaque provider
- Scraping interdit sauf metadata HTML head (og:image, favicon)
- X/Twitter: API officielle uniquement, no scraping
- Import manuel = fallback legal et gratuit si aucun provider social configure
