# FINANCE-OS — FINANCIAL-DATA-CORE-0

Date: 2026-08-07
Branch: `main` (working tree only — rien n'est committé, comme demandé)

---

## A. Executive summary

**Problème initial.** Finance-OS n'avait pas de source de vérité financière : cinq calculs indépendants du patrimoine total (Cockpit, Analytics, Advisor, Investment Strategy, bundle externe), aucune conversion FX nulle part (les sommes mélangeaient EUR et USD), des `toNumber() → 0` transformant chaque valeur inconnue en `0 €`, un double comptage confirmé des positions IBKR/Binance dans l'allocation Investment Strategy, et une couche de valorisation (`asset_valuation_snapshot`, `fx_rate_snapshot`, `valuation-foundation.ts`) entièrement scaffoldée mais **jamais câblée** (zéro writer, zéro appelant).

**Changements.** Cette mission câble et complète la couche existante au lieu d'en inventer une nouvelle :

- **Cœur pur dans `packages/finance-engine/src/valuation/`** : identité canonique, convertisseur FX (convention ECB), statuts (`priced/derived/estimated/manual/stale/unresolved/unavailable`), P&L (null quand cost basis inconnu), coverage report. 100 % déterministe, testé.
- **FX réel** : ingestion des taux de référence ECB (gratuit, sans clé, optionnel, fail-soft) dans `fx_rate_snapshot`, désormais avec contrainte d'unicité (écritures idempotentes).
- **Job `asset-valuation`** : use-case + endpoints `GET /dashboard/valuation/status`, `POST /dashboard/valuation/refresh` (avec vrai `dryRun`), `GET /dashboard/valuation/unresolved`; enregistré dans le registry `/ops/refresh` (orchestration-ready), avec table de runs `asset_valuation_run`, verrou atomique single-running, recovery des runs stale, coverage report persisté.
- **DTO summary enrichi** : bloc `valuation` canonique + `valueBase`/`valuationStatus` par asset/position — tous `number | null`, jamais `0` pour inconnu.
- **Bugs corrigés** : double comptage Investment Strategy (positions externes comptées 2×), worker external-investments qui laissait les connexions en `syncing` après un run propre, verrou advisory non fiable derrière le pool postgres-js (détecté pendant la validation).
- **UI minimale** : un panneau admin « Valorisation des actifs » sur `/orchestration` (coverage, statuts, FX, unresolved, dry-run/refresh). Aucune refonte de page.

**Résultat.** `unknown ≠ 0` est structurel de la DB au frontend. Validation réelle locale : dry-run sans écriture, run réel avec 29 taux ECB du jour persistés, rerun sans doublon, portefeuille vide → `totalValueBase: null` (pas `0`). Typecheck/lint/tests verts (1 échec de test préexistant hors périmètre, documenté en R).

---

## B. Existing architecture audit

Chaîne auditée : `provider → ingestion → DB → normalization → finance engine → API → query → view-model → UI`, pour Powens, IBKR Flex, Binance, manual, cash, transactions, external investments.

### Providers

- **Powens** (`packages/powens`, worker `apps/worker/src/index.ts:885`) : 3 appels seulement (token, accounts, transactions). **Aucun endpoint investissements/wealth appelé** — un compte PEA/AV Powens n'est qu'un solde scalaire. Persiste `financial_account`, `asset` (1 asset par compte, `valuation = balance`), `transaction` (double unique index d'idempotence), `provider_raw_import`.
- **IBKR Flex** (`packages/external-investments/src/normalizer.ts:488`) : positions (conid/isin/cusip/symbol, quantité, `marketValue` → `providerValue`, cost basis FIFO, unrealized P&L), cash par devise (`CashReport`, skip `BASE_SUMMARY` anti-double-comptage), NAV (`EquitySummaryInBase`) stocké **uniquement en metadata** — jamais additionné (pas de double comptage NAV+positions). Le prix unitaire (`markPrice`) n'est pas extrait.
- **Binance** (`binance-readonly-client.ts`) : allowlist GET signés read-only. Valorisation EUR par paire directe (`BTCEUR`) puis pont stablecoin + FX `1/EURUSDT` avec fallback statique env. Les `valuationSnapshots` calculés par l'enrichissement étaient jetés (provenance FX perdue) — non corrigé ici, documenté en R.
- **manual-import** : n'existe que pour les news/signaux. L'entrée financière manuelle est `POST /dashboard/manual-assets` → table `asset` (`origin='manual'`), valeur scalaire.
- **provider-contract / provider-runtime** : types + registry santé uniquement; `BudgetPolicy`/`FreshnessPolicy`/`dryRun` déclarés mais appliqués nulle part. L'ingestion réelle ne passe pas par `Provider.call()`.

### DB (constats principaux, packages/db — 88 tables)

- Pas de table instrument canonique : identité éclatée sur 6 tables avec 3 espaces de clés incompatibles (`instrument_id` text, `instrument_key` text, `asset.id` int); `asset` et `investment_position` n'ont **ni symbol ni ISIN**.
- `asset_valuation_snapshot.asset_id`/`account_id` sont `text` sans FK (assumé : on y met des clés canoniques `asset:<id>` / `external:<positionKey>` / `position:<key>` — c'est ce que fait cette mission).
- **Aucune table d'historique patrimoine** (le graphique Cockpit est une rétro-extrapolation par flux depuis le solde actuel).
- Deux modèles de positions non reliés (`investment_position` vs `external_investment_position`) avec un pont implicite (`asset.providerExternalAssetId = 'external:<positionKey>'`, `investment_position.assetId`).
- Convention numérique : `numeric(p,s)` lu/écrit en string JS (précision préservée); `doublePrecision` fuit sur des pourcentages/coûts (hors périmètre).
- Drift des snapshots meta Drizzle (12 manquants) : `db:generate` est dangereux → migration 0037 écrite à la main (convention existante des migrations descriptives).

### Duplications de calcul (avant)

| Copie | Fichier | Formule |
|---|---|---|
| Cockpit `totals.balance` | `create-get-dashboard-summary-use-case.ts:301` | somme brute `asset.valuation` (devises mélangées) |
| Analytics allocation | `analytics-contract.ts:202` | même somme mais en excluant les ≤ 0 (divergence interne au même payload) |
| Advisor engine input | `map-summary-to-engine-input.ts:94` | assets > 0 + positions non bridgées, `currency` ignorée par l'engine |
| Investment strategy | `investment-strategy-engine.ts:768` | externes + internes **avec double comptage** (bug corrigé) |
| Bundle externe | `context-bundle.ts:43` | somme cross-devises assumée (`fxAssumptions`) |
| (morte) | `build-advisor-financial-context.ts` | aucun appelant production |
| (client) | `patrimoine.tsx:205` | re-somme côté navigateur |

### finance-engine (avant)

Pur, zéro dépendance, mais : aucun FX (currency des positions ignorée, total mixte silencieusement faux), aucun P&L/cost basis, `null → 0` dans la couche recommandations, `goals` input mort.

---

## C. Asset model — identité canonique

Pas de nouvelle table : résolution **en code, déterministe**, dans `packages/finance-engine/src/valuation/resolve-asset-identity.ts`, alimentée par les identifiants déjà persistés (`external_investment_instrument.conid/isin/binance_asset/symbol`).

Priorité : `CONID → ISIN → Binance asset → ticker+exchange → ticker+currency → account/manual → unresolved`. Un ticker nu (`AIR`) est `ambiguous` et n'est **jamais** auto-résolu. Statuts : `resolved | ambiguous | unresolved | unsupported`.

Clés d'items canoniques (uniques, stables) :

- `asset:<asset.id>` — comptes bancaires, valorisations de comptes Powens, actifs manuels;
- `external:<positionKey>` — positions IBKR/Binance (= `asset.providerExternalAssetId` des copies bridgées);
- `position:<positionKey>` — positions internes non bridgées.

Une table de mappings manuels persistés est un follow-up documenté (S), pas un besoin actuel : aucun cas ambigu réel dans les données.

## D. Valuation model

`packages/finance-engine/src/valuation/` (pur, testé) :

- `types.ts` — `ValuationItemInput` → `ItemValuation` : quantité, `valueOriginal` (devise native, préservée même sans FX), `valueBase` (EUR, `number | null`), `fxRate/fxProvider/fxTimestamp`, `costBasisBase`, `unrealizedPnlBase`, `unrealizedPnlPercent`, `status`, `source`, `identityStatus`, `asOf`, `staleAfterSeconds`, `confidence`, `errorCode`, `safeErrorMessage`.
- `valuate-items.ts` — table de décision : valeur absente → `unresolved` (identité inconnue/ambiguë) ou `unavailable` (identifié mais sans prix); devise inconnue → `unavailable` (`CURRENCY_UNKNOWN`); FX absent → `unavailable` (`FX_RATE_UNAVAILABLE`), valeur native conservée; manuel → `manual` (jamais downgradé stale, la date fait foi); valeur plus vieille que la politique de fraîcheur → `stale` (valeur conservée); FX stale → `estimated`; cash → `derived`; sinon `priced`. Jamais de `NaN`/`Infinity`.
- `freshness.ts` — par classe : crypto 12 h, stablecoin 2 j, actions/ETF 3 j (couvre week-ends EOD), fonds/obligations 5 j, cash 4 j, défaut 5 j; manuel exempté.
- `coverage.ts` — voir N.

## E. Provider strategy

- **Powens** : le solde provider est la vérité (`bank_balance` → `derived`), fraîcheur = dernière sync. Pas d'appel marché pour du cash.
- **IBKR** : `normalizedValue/providerValue` natif broker d'abord (`provider_native` → `priced`); l'enrichissement `market_quote_snapshot` existant reste en amont; cost basis provider quand présent.
- **Binance** : valorisation Binance existante (paire directe/pont stable) en amont; l'item porte `degradedReasons` (`BINANCE_PRICE_*`) qui deviennent `errorCode` quand la valeur manque. **Correctif post-revue** : le pont FX n'utilise **plus aucun taux statique** — chaîne `EURUSDT live (taux marché réel) → dernier fx_rate_snapshot ECB (avec provenance + staleness) → null`. Un FX ECB stale produit un `valueSource: 'market_resolved_estimated'` que la couche canonique classe `estimated`; aucun FX fiable → position non valorisée (`FX_RATE_UNAVAILABLE`) → `unavailable`. La provenance FX (source, taux, asOf, stale) est persistée dans les `assumptions` de la position et portée par le `bridge` des valuationSnapshots (`fxSource`, `fxIsStale`).
- **Market pricing** : aucun nouveau provider payant. Watchlist EODHD/TwelveData inchangée.
- **Manual** : valeur utilisateur = vérité, statut `manual`, aucun lookup externe.

## F. FX strategy

- Source : **taux de référence ECB quotidiens** (`eurofxref-daily.xml`, gratuit, sans clé) — `apps/api/src/routes/dashboard/services/fetch-ecb-fx-rates.ts`. Optionnel (`FX_RATES_ENABLED`), URL overridable, timeout 12 s.
- Persistance : `fx_rate_snapshot` (base `EUR`, `rate` = unités de devise par 1 EUR, `rateTimestamp` ancré à 15:00 UTC jour de fixing), désormais **unique** sur `(base, quote, provider, rate_timestamp)` → ingestion idempotente (`ON CONFLICT DO NOTHING`).
- Fraîcheur : `FX_RATES_STALE_AFTER_SECONDS` défaut 96 h (couvre les week-ends). Taux stale → conversion quand même mais statut `estimated`. Taux absent → `valueBase = null`, jamais 0.
- Fail-soft : échec du fetch ECB → derniers taux persistés + `providerFailures: [{provider:'ecb', errorCode:'FX_REFRESH_FAILED', ...}]` dans le run.
- Conversion testée dans les deux sens (round-trip test).
- **Correctif post-revue** : le fallback statique du pont Binance (`EXTERNAL_INVESTMENTS_BINANCE_VALUATION_USD_EUR_FALLBACK`, défaut 0.92) est **supprimé** (env schema, diagnostics, compose prod). Le fallback est désormais le dernier `fx_rate_snapshot` canonique (`createSnapshotFxFetcher`, lecture inverse `1/rate(EUR→devise)`, provenance `<provider>_snapshot`, flag stale), et couvre au passage les paires non-USD. `AI_USD_TO_EUR_RATE` reste intact — il ne sert que le cost ledger IA, pas la valorisation financière.

## G. Cost basis / P&L semantics

- Cost basis : pass-through provider (IBKR) ou saisie (`costBasisSource: minimal|provider|manual|unknown`). Le cost basis Binance égal à la valeur courante (faux cost basis, connu) reste en amont — les items Binance sont traités `unknown` quand `costBasis === null`.
- **P&L canonique** (unrealized uniquement) : calculé seulement si `costBasis` connu ET `costBasisSource !== 'unknown'` ET `valueBase` connu; le cost basis est converti dans sa propre devise (`costBasisCurrency`); `unrealizedPnlPercent = pnl/costBasisBase*100` seulement si `costBasisBase > 0`. Sinon **null partout** — plus jamais `0` ni `Infinity`.
- `realized P&L`, `daily P&L`, `period return` : non mélangés — non calculés par cette couche (le `realizedPnl` provider reste exposé tel quel par les endpoints external-investments).
- « Gagné/perdu sur la période » (§17 du brief) : **volontairement non fabriqué**. Les données locales ne permettent pas une performance cashflow-adjusted fiable (pas d'historique de valorisation avant cette mission, `external_investment_cash_flow.type` en texte libre, pas de réconciliation dépôts/virements). Les snapshots écrits par le job sont la fondation pour le construire honnêtement plus tard. Limite documentée en R/S.

## H. Aggregation rules (anti-double-comptage)

Règle canonique unique — `collect-valuation-items.ts` :

1. `asset` rows `enabled` avec `source !== 'external_investment'` (cash banque, comptes Powens wealth, manuels);
2. `external_investment_position` (les copies bridgées dans `asset`/`investment_position` sont **exclues** car même argent);
3. `investment_position` non bridgées (`assetId IS NULL`), ouvertes, non externes.

Le cost basis d'une position bridgée est greffé sur son item asset (le P&L survit sans double compter la valeur). `accounts[]` et `connections[].balance` du summary restent des vues (jamais additionnées aux assets). IBKR NAV n'entre jamais dans un agrégat (metadata only).

**Bug corrigé** : `runtime.ts` — `listPowensInvestmentPositions` filtrait rien; chaque position IBKR/Binance était comptée deux fois dans `computePortfolioAllocation` (totaux, buckets, drift). Filtre `source !== 'external_investment' && closedAt === null` ajouté.

## I. DB changes

Migration additive `packages/db/drizzle/0037_financial_data_core_valuation.sql` (+ entrée journal; snapshot meta non généré, convention des migrations manuelles du repo) :

- `asset_valuation_snapshot` : +13 colonnes nullable (`run_id`, `item_key`, `kind`, `status`, `valuation_source`, `provider`, `value_original`, `cost_basis_base`, `unrealized_pnl_base`, `unrealized_pnl_pct`, `as_of`, `error_code`, `safe_error_message`), index `run_idx`, unique partiel `(run_id, item_key)` → écritures idempotentes par run.
- Nouvelle table `asset_valuation_run` (pattern `derived_recompute_run`) : status/trigger/requestId/`dry_run`/coverage jsonb/totals jsonb/compteurs/`provider_failures`/safe errors/timings. Unique partiel `asset_valuation_run_single_running` sur `status WHERE status='running'` → **verrou de concurrence atomique**.
- `fx_rate_snapshot` : unique `(base_currency, quote_currency, provider, rate_timestamp)`.

Aucune destruction, aucune colonne modifiée, aucun historique touché. `avant → problème → après` : couche valorisation sans writer ni provenance → snapshots avec statut/provenance/P&L + runs observables + FX idempotent.

## J. Refresh job

`createAssetValuationUseCases` (`apps/api/src/routes/dashboard/domain/valuation/`) :

1. recovery des runs `running` > 30 min (auto-`failed`, `ASSET_VALUATION_STALE_TIMED_OUT`);
2. claim atomique du run (insert; violation unique → `409 ASSET_VALUATION_RUNNING`). *Note : le pattern advisory-lock du repo (derived-recompute) s'est révélé non fiable derrière le pool postgres-js (lock/unlock sur des sessions différentes) — constaté pendant la validation réelle; le job utilise donc l'index unique partiel;*
3. refresh FX ECB (1 requête batch pour toutes les paires, fail-soft);
4. lecture fail-soft **par source** (assets, external positions, positions, instruments, FX) : une source en échec est ignorée pour ce run et reportée dans `providerFailures` — Binance en panne ne masque jamais Powens/IBKR/manuel;
5. collecte canonique + valorisation pure + coverage;
6. run réel : snapshots écrits (`ON CONFLICT (run_id, item_key) DO NOTHING`) — uniquement les items avec `valueBase` connu; les unknown vivent dans le coverage et l'endpoint unresolved;
7. **dry-run** : tout est calculé (FX fetché mais non persisté), `wouldCreateSnapshots` reporté, **aucune écriture de snapshot ni de taux** (seule la ligne de run `dry_run=true` est journalisée);
8. run complété avec coverage/totals/failures/durée.

Rate limits : 1 requête ECB par run, zéro appel par asset (tout vient de la DB). Jamais déclenché par un chargement de page (le summary ne fait que lire la DB et calculer). Déclenchement : admin (`POST /dashboard/valuation/refresh`) ou job `asset-valuation` du registry `/ops/refresh` (deps `market-data`, `external-investments`; note : ces jobs *enqueue* les syncs worker, le run valorise donc l'état DB courant).

## K. API

- `GET /dashboard/valuation/status` — feature flags, état, dernier run (coverage complet, failures), fraîcheur FX. Demo : fixture déterministe. Admin/internal : réel.
- `POST /dashboard/valuation/refresh` `{dryRun?: boolean}` — admin/internal only; demo → `403 DEMO_MODE_FORBIDDEN`; `409` si déjà en cours; `503` si désactivé.
- `GET /dashboard/valuation/unresolved` — items `unresolved`/`unavailable`/`stale` avec raisons safe.
- `GET /dashboard/summary` enrichi : bloc `valuation` (`totalValueBase`, `coveragePercent`, `statusCounts`, `unknownValueCount`, `totalUnrealizedPnlBase`, `pnlCoverageCount`, `asOf`) + `valueBase`/`valuationStatus` par asset et position. `totals.balance` (somme naïve legacy) est conservé pour compatibilité et documenté comme tel; l'overlay est fail-soft (`valuation: null` si indisponible — jamais un faux zéro, jamais un 500).
- Registry `/ops/refresh` : job `asset-valuation` (dispatch → use-case, coverage dans `details`).

## L. Demo mode

Fixtures déterministes (aucun `Math.random()`/`Date.now()`), cohérentes entre elles : 3 comptes cash Powens (48 320,44), 1 investissement manuel avec cost basis (12 450, P&L +1 470), 1 actif manuel (6 300) = **67 070,44 €** partout (Cockpit, Patrimoine, Investissements, Advisor, valuation block), plus **une position volontairement `unresolved`** (« Actions non cotees - import manuel », sans valeur — coverage demo 83,33 %) pour exercer les états dégradés sans inventer d'argent. Fichiers : `apps/api/src/mocks/dashboardSummary.mock.ts`, `dashboardValuation.mock.ts`, `apps/web/src/features/demo-data.ts`, `features/valuation/demo-data.ts`.

## M. Real-data validation (redacted)

Environnement : Docker démarré (daemon 29.6.2) — Postgres 16 (port 55432) + Redis 7 (port **63790**, car 6379 occupé par un conteneur `kvrocks` d'un autre projet, non touché; override `REDIS_URL` process-level, aucun fichier secret modifié). Migrations 0000→0037 appliquées proprement. Neo4j/Qdrant non démarrés (inutiles ici).

- **DB locale vide** : 0 compte, 0 asset, 0 position, 0 connexion Powens, 0 credential IBKR/Binance → **la validation provider réelle (Powens/IBKR/Binance) est impossible localement**. NOT VALIDATED LOCALLY, sans maquillage.
- **Validation réelle du core exécutée** (script server-side équivalent au endpoint admin) :
  - dry-run : 0 écriture (fx=0, snapshots=0), run journalisé, `wouldCreateSnapshots: 0`;
  - run réel : **29 taux ECB réels du jour** persistés (`rateTimestamp 2026-08-07T15:00Z`), 0 failure;
  - idempotence : second run réel → toujours 29 lignes FX (0 doublon);
  - concurrence : claim/relâche corrects (après remplacement du verrou advisory défaillant);
  - portefeuille vide → `totalValueBase: null`, `coveragePercent: null` — pas de `0` inventé.
- **Endpoints HTTP validés** (API lancée localement, mode demo) : `/health` 200; `/dashboard/valuation/status` et `/unresolved` 200 fixtures; `/dashboard/summary` avec bloc `valuation` et statuts par item; `POST /valuation/refresh` refusé hors admin (403, CSRF+demo).

## N. Coverage

Formule (documentée dans `coverage.ts`) :

```
coveragePercent = items avec valeur exploitable (priced|derived|estimated|manual|stale)
                / TOUS les items nécessitant une valorisation × 100
```

Rien n'est exclu du dénominateur — un `unresolved` fait baisser la coverage au lieu de disparaître. `totalValueBase = somme des valueBase connus`, `null` si aucun (jamais 0). Breakdown par provider et par classe avec `unknownValueCount` explicite. Local réel : 0 item → coverage `null`. Demo : 6 items, 83,33 %, 67 070,44 €.

## O. Before / after totals

| Source/Page | Before | Canonical | Delta | Explication |
|---|---|---|---|---|
| Cockpit `totals.balance` (demo) | 67 070,44 | 67 070,44 | 0 | données demo 100 % EUR → somme naïve = somme FX |
| Patrimoine (demo) | 67 070,44 | 67 070,44 | 0 | idem |
| Investissements (demo) | 12 450 | 12 450 | 0 | idem |
| Advisor totalValue (demo) | 67 070,44 | 67 070,44 | 0 | position unresolved exclue des deux côtés (pas de valeur) |
| Investment strategy allocation (admin) | 2× la valeur externe | 1× | −50 % sur la part externe | **bug de double comptage corrigé** (`runtime.ts`) |
| Admin réel (local) | 0 € affiché comme « 0 » | `null` / « indisponible » | sémantique | DB vide : l'ancien code affichait 0 €, le canonique dit « inconnu » |
| IBKR / Binance / Powens raw | n/a localement | n/a | — | aucune donnée provider locale (voir M) |

Delta structurel attendu en production : `totals.balance` (naïf) divergera de `valuation.totalValueBase` dès qu'une position non-EUR existe (IBKR USD) — c'est le but : l'écart mesure l'erreur FX historique. Les pages continuent d'afficher l'ancien total (aucun changement visuel), le canonique est disponible pour les missions Cockpit/Patrimoine/Investissements.

## P. Unresolved assets

Local réel : aucun (0 item). Demo : 1 (`position:demo-unlisted-shares`, `IDENTITY_UNRESOLVED`, volontaire). L'endpoint `GET /dashboard/valuation/unresolved` liste en continu les `unresolved`/`unavailable`/`stale` avec `errorCode` + `safeErrorMessage` (les erreurs techniques provider restent dans les logs, jamais dans les DTO).

## Q. Tests

| Commande | Résultat |
|---|---|
| `pnpm --filter @finance-os/finance-engine test` | ✅ 34 pass (dont 26 nouveaux : FX bi-directionnel, statuts, cash EUR/USD/FX absent, manuel, P&L ±/null/zero-division/multi-devise, invariants finite/déterminisme/coverage∈[0,100], unknown≠0, FX approximatif → estimated) |
| `bun test` (apps/api) | ✅ 750 pass / 1 fail **préexistant** (voir R) — dont 11 nouveaux : job dry-run/réel, FX fail-soft, fail-soft par provider, 409 concurrent, 503 disabled, unresolved listing, stale-FX → estimated; parser ECB (3) |
| `bun test` (packages/external-investments) | ✅ 68 pass — dont 11 nouveaux/adaptés : chaîne FX sans taux statique (live → snapshot ECB → null), provenance bridge, stale → `market_resolved_estimated`, aucune valeur sans FX fiable |
| `pnpm typecheck` (16 projets) | ✅ vert |
| `pnpm lint` | ✅ vert |
| `pnpm -r --if-present test` | ✅ hors échec préexistant ci-dessous |
| Build web (vite + Nitro) | ✅ vert |
| `git diff --check` | ✅ propre |

## R. Known limitations

1. **Pas de validation provider réelle locale** : aucune connexion Powens ni credential IBKR/Binance dans la DB locale (voir M). Le premier run admin en prod fournira le vrai coverage report.
2. **`totals.balance` reste la somme naïve** consommée par les pages actuelles — la bascule d'affichage vers `valuation.totalValueBase` appartient aux missions Cockpit/Patrimoine/Investissements (S).
3. **« Gagné/perdu sur la période » non fabriqué** : nécessite l'accumulation des snapshots de valorisation + une réconciliation des cashflows (types libres dans `external_investment_cash_flow`) — fondation posée, métrique honnête à construire.
4. **Provenance FX Binance** : corrigé pour le taux statique (supprimé — chaîne live → snapshot ECB → null, provenance persistée dans `assumptions` + `bridge.fxSource/fxIsStale`, stale → `estimated`). Restant : les `valuationSnapshots` de l'enrichissement ne sont toujours pas écrits en table par le worker (le job canonique `asset-valuation` écrit les siens); `AI_USD_TO_EUR_RATE=0.92` subsiste uniquement pour les estimations de coûts IA.
5. **Prix unitaire IBKR** non extrait du Flex (`markPrice` ignoré) → les snapshots externes stockent valeur/quantité, prix dérivé.
6. **Verrou advisory de derived-recompute** : même faiblesse pool postgres-js que celle corrigée ici (lock/unlock sur sessions différentes) — préexistant, non touché, à corriger dans sa mission.
7. **Échec de test préexistant** : `create-get-dashboard-transactions-use-case.test.ts` (« applies explicit precedence categorization ») échoue sur `resolutionTrace` (un step `no_user_rules` supplémentaire) — fichiers non touchés par cette mission, échec identique sans mes changements. À trier dans la mission Transactions/Dépenses.
8. **Fail-soft SSR des 6 loaders** (dont Cockpit `/`) : non traité, conformément au périmètre (§43 du brief) — le hard-fail Cockpit n'est pas causé par la couche financial data.
9. Snapshots meta Drizzle toujours en drift (12 manquants) — `db:generate` reste dangereux; 0037 suit la convention manuelle.

## S. Follow-up by page

- **Cockpit** : afficher `valuation.totalValueBase` (avec état « indisponible » quand null) au lieu de `totals.balance`; corriger le hard-fail SSR; supprimer le fallback `balance: 0` du `dashboard-legacy-adapter` (le bloc `valuation` est déjà exposé par l'adapter).
- **Patrimoine** : remplacer les 3 `reduce()` client par les breakdowns du coverage report; brancher l'historique sur `asset_valuation_snapshot` (vraie série temporelle, plus de rétro-extrapolation).
- **Investissements** : utiliser `valueBase`/`valuationStatus`/`unrealizedPnlBase` par position; supprimer `currentValue ?? lastKnownValue ?? 0`.
- **Advisor** : brancher `map-summary-to-engine-input` sur les valuations canoniques (FX correct) au lieu des sommes naïves; la garde `assetId === null` devient inutile.
- **Santé** : exposer coverage/unresolved comme signaux (le panneau Orchestration en est la base).
- **Orchestration** : le job `asset-valuation` est déjà dans le registry; câbler l'historique de runs persisté (`asset_valuation_run`) dans la page.

---

Non fait volontairement : aucune refonte visuelle, aucun trading, aucun provider payant, aucune migration destructrice, aucun commit.
