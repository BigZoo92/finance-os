# FINANCE-OS — RESET-AUDIT-CLEANUP-0

Date: 2026-08-07
Branch: `main` (working tree only — rien n'est committé, comme demandé)
Diff global: **121 fichiers modifiés, +153 / −21 478 lignes** (83 suppressions, 34 modifications)

---

## A. Executive summary

**État initial.** Repo fonctionnel: typecheck, lint et tests workspace verts avant toute modification (baseline vérifiée). Le master brief était globalement fidèle, avec des écarts notables (voir B). L'application portait encore: la feature Fiscalité (frontend-only), 5 pages condamnées, 21 composants ReactBits vendorés (dont 8 déjà morts), le pattern « Prochaines actions » sur 5 pages, des CTA Advisor génériques, un footer/hero décoratif sur Cockpit, et l'intégralité du pipeline agentique GitHub (9 workflows autopilot Codex, ~2 900 lignes de JS inline).

**Principaux problèmes découverts.**
- Le pipeline autopilot était intact et actif dans `.github/workflows` (le brief le disait « à supprimer », rien n'avait été fait).
- Fiscalité n'a **aucun backend**: pas de route API, pas de table, pas de service. Purement frontend.
- `routeTree.gen.ts` était périmé (daté du 23 mai) — le build le régénère.
- Les tests des parsers autopilot ne tournaient jamais en CI (`pnpm -r test` exclut la racine du workspace) — devenu sans objet après suppression.
- 6 routes crashent en SSR (500) quand l'API est injoignable au lieu de rendre un état dégradé (voir M).

**Volume de nettoyage.** 83 fichiers supprimés (~21 000 lignes): 14 fichiers GitHub agentiques, 5 pages + leurs features exclusives, 20 fichiers ReactBits, 12 composants dashboard morts, l'ancienne chaîne news UI, docs autopilot.

**État final.** Typecheck 16/16 projets vert, lint vert, tests workspace verts (`pnpm -r test` exit 0), build web + Nitro vert, routes supprimées en 404 propre, navigation sans entrée morte, demo/admin split intact, pipelines data intacts, CI/CD classique intacte.

---

## B. Repository current-state

**Apps** : `web` (React 19 / TanStack Start / Vite / Nitro), `api` (Elysia/Bun, routes montées à la racine et sous `/api`), `worker` (Bun, 10 schedulers + 2 queues Redis), `desktop` (Tauri), `knowledge-service` (FastAPI, Neo4j+Qdrant, GraphRAG interne), `quant-service` (FastAPI, backtests papier).

**Packages** : `ai`, `config-ts`, `db` (Drizzle, 85 tables, 37 migrations), `env`, `external-investments` (IBKR Flex + Binance read-only), `finance-engine`, `powens`, `prelude`, `provider-contract`, `provider-runtime`, `redis`, `ui`.

**Jobs/queues worker** : `powens:jobs`, `external-investments:jobs`; schedulers: powens auto-sync, news ingest, market refresh, advisor daily, daily intelligence (cron), post-mortem (cron), social signal ingest, attention rebuild, X daily sync (cron), heartbeat. **Tous intacts.**

**Providers API** (18, tous intacts): binance, ibkr, powens, manual-import, bluesky/ecb-data/ecb-rss/fed-rss/fred/gdelt/hn/sec-edgar/x-twitter news, news-service, knowledge-context-bundle, quant-patterns-detect, free-firehose-orchestrator, internal-provider-registry.

**Écarts vs master brief découverts** :
- Fiscalité annoncée comme feature: en réalité 100 % frontend (page + view-model + fixtures), zéro artefact backend/DB. Sa suppression est donc totale, sans « table historique à garder ».
- 8 des composants ReactBits listés « actifs » étaient déjà morts (dock, glass-surface, magic-bento, pixel-trail, pixel-transition, shape-blur, staggered-menu, variable-proximity) — jamais importés.
- Le « bento menu » n'existe pas en usage réel: `magic-bento`/`staggered-menu` étaient vendorés mais non branchés. Le shell actif est `components/shell/` (sidebar + topbar + command palette) — fonctionnel, conservé tel quel (pas de `PENDING_SHELL_REPLACEMENT` nécessaire: aucune suppression de shell n'a eu lieu, seule la future top navbar le remplacera).
- Le dock utilisé (`surfaces/action-dock.tsx`) est une réimplémentation motion/react maison, pas le Dock ReactBits.

## C. Functional baseline

Environnement de test: **docker daemon arrêté** → pas de Postgres/Redis/Neo4j/Qdrant → l'API ne peut pas tourner. Smoke réalisé sur le build production web servi par Nitro (`node .output/server/index.mjs`, `NODE_ENV=production`), API injoignable. Le smoke « avec données » est **NOT VALIDATED LOCALLY**.

| Route | Chargement (API down) | Data/API | Problème observé | Sévérité | Future phase |
|---|---|---|---|---|---|
| `/login` | 200 | n/a | OK, background PixelBlast conservé | — | Login |
| `/` | **500** | SSR loader hard-fail | `Auth SSR unavailable (network_error)` → 500 au lieu d'un rendu dégradé | P1 | Cockpit / Financial Data Core |
| `/depenses` | 200 | dégradé | OK fail-soft | — | Dépenses |
| `/patrimoine` | 200 | dégradé | OK fail-soft | — | Patrimoine |
| `/investissements` | 200 | dégradé | OK fail-soft | — | Investissements |
| `/objectifs` | 200 | dégradé | OK fail-soft | — | Objectifs |
| `/ia` | 200 | dégradé | OK fail-soft | — | Advisor |
| `/ia/chat` | 200 | dégradé | OK fail-soft | — | Chat |
| `/ia/memoire` | **500** | SSR loader hard-fail | idem `/` | P1 | Memory |
| `/ia/memoire/graph` | **500** | SSR loader hard-fail | idem | P1 | Memory |
| `/ia/strategie-investissement` | **500** | SSR loader hard-fail | idem | P1 | Advisor |
| `/ia/couts` | 200 | dégradé | OK | — | Coûts |
| `/ia/trading-lab` | 200 | dégradé | OK | — | Trading Lab (hors scope) |
| `/signaux` | **500** | SSR loader hard-fail | idem | P2 (admin) | Radar |
| `/signaux/marches` | 200 | dégradé | OK | — | Radar |
| `/signaux/social` | **500** | SSR loader hard-fail | idem | P2 (admin) | Social |
| `/integrations` | 200 | dégradé | OK | — | Intégrations |
| `/sante` | 200 | dégradé | OK | — | Santé |
| `/orchestration` | 200 | dégradé | OK | — | Orchestration |
| `/healthz`, `/health`, `/version` | 200 | n/a | OK (endpoints serveur) | — | — |
| `/transactions`, `/marches`, `/actualites`, `/memoire` | 301 | n/a | redirects legacy OK | — | — |
| `/signaux/x-twitter` | 307 | n/a | redirect vers `/signaux/social` OK | — | — |
| `/fiscalite`, `/parametres`, `/signaux/sources`, `/signaux/free-firehose`, `/ops-env-diagnostics` | **404** | n/a | suppression propre, voulue | — | — |

Le pattern des 500: les loaders de ces 6 routes `await` un `fetchQuery` qui throw quand l'API est injoignable. Pré-existant (pas causé par ce nettoyage), mais contraire au principe fail-soft du repo. À corriger dans les phases correspondantes.

Note environnement: `vite preview` (script `start` du package web) sert un bundle SSR qui crashe avec `jsxDevRuntimeExports.jsxDEV is not a function` même après build — le serveur Nitro (`node .output/server/index.mjs`), utilisé en prod Docker, fonctionne. Voir M.

## D. Deleted pages

| Page | Route | Fichiers supprimés | Logique conservée | Raison / destination |
|---|---|---|---|---|
| Fiscalité | `/fiscalite` | `routes/_app/fiscalite.tsx`, `features/fiscalite-view-model.ts` (+ test), entrée nav, keyword palette | Rien à conserver: aucune API, aucune table. `tax_wrapper` (colonne partagée), catégorie transaction `taxes`, guardrail Advisor `guardrail_regulatory_or_tax` conservés (non fiscaux/partagés) | Décision ferme 15.5 — feature supprimée du produit |
| Sources | `/signaux/sources` | `routes/_app/signaux/sources.tsx`, entrée nav, keyword palette, lien depuis le hub Signaux | La page ne lisait que des query options partagées (news, markets, knowledge, powens) — tout le pipeline intact | UI supprimée; infos techniques exposables plus tard dans Ops |
| Free Firehose | `/signaux/free-firehose` | `routes/_app/signaux/free-firehose.tsx`, entrée nav | Backend 100 % intact: `POST /dashboard/admin/free-firehose/{estimate,run}`, orchestrateur, table `free_firehose_run`, env flags, stale-recovery. **Client API/types conservés et déplacés vers `features/ops-refresh/free-firehose-api.ts`** (emplacement Orchestration, prêts à câbler) | Destination future: Orchestration |
| Env Diagnostics | `/ops-env-diagnostics` | `routes/_app/ops-env-diagnostics.tsx`, `features/ops-env-diagnostics/` (api, query-options, types, preflight-banner — le banner n'était utilisé que par cette page + Free Firehose) | Endpoint `GET /ops/env/diagnostics`, validation env Zod (`packages/env`), guards runtime, health checks: intacts | Page de diagnostic supprimée, pas la validation |
| Paramètres | `/parametres` | `routes/_app/parametres.tsx`, entrée nav, keyword palette | `PushNotificationCard`, features notifications et recompute dérivé conservés (aussi utilisés par Santé). Backend push/recompute intacts | Audit conclu: suppression (voir H) |

## E. Deleted sections/patterns

- **« Prochaines actions »** — supprimé sur Cockpit, Dépenses, Patrimoine, Investissements, Objectifs, et le composant racine `PersonalActionsPanel` (+ `PersonalActionItem`, `ActionIcon`, `ActionCopy`) supprimé de `personal-ux.tsx`. Le pattern ne peut plus être réinstancié.
- **CTA Advisor génériques** — « Demander à l'Advisor » (objectifs, dépenses, investissements), « Lire l'Advisor » (cockpit): supprimés. Aucune exception conservée. Les liens « Accès utiles » internes à la page `/ia` (chat, mémoire, coûts) sont conservés: navigation contextuelle de la page Advisor elle-même, pas un CTA injecté dans une page métier.
- **Cockpit** — hero `CockpitHero` (LiquidEther + TextPressure + CircularText + RotatingText) supprimé, remplacé par un `PageHeader` simple + `RangePill` (les contrôles de période survivent); headings « Aujourd'hui / Ta situation en un coup d'œil / Ma trajectoire / Ce qui change sur la période » supprimés; bloc « synthèse Advisor / Brief quotidien » + panneau « ⚠ à traiter » supprimés; footer mono supprimé. Conservé: métriques du jour (argent disponible, cashflow, état données), chart patrimoine, tuiles KPI, top dépenses, connexions, objectifs.
- **Dépenses** — eyebrow « Cockpit personnel », intro « Comprendre ce qui sort... », « Tes flux en clair », bloc « Ce qui pèse le plus / Poste principal », projection fin de mois (`MonthEndProjectionCard` + test supprimés): retirés. Conservé: KPI, structure des dépenses, budgets par catégorie, table transactions, édition catégorie, export CSV, contrôles période.
- **Objectifs** — hero Antigravity + CircularEmblem supprimé, remplacé par un panneau de progression simple; panneau actions supprimé. Conservé: progression globale, prochaine cible, alertes, `PersonalFinancialGoalsCard` (création/édition).
- **Investissements** — bloc « Données à vérifier » + `Coût inconnu:` bruts, « Pourquoi ce benchmark diffère » (explainability + trace + confiance), tuile « Qualite » (confidence brute), eyebrows/headings condamnés: retirés. Conservé: valorisation totale, positions, allocation, IBKR/Binance/Powens, ActionDock (refresh/export/création manuelle).
- **Patrimoine** — heading « Aujourd'hui / Ce que tu possèdes », panneau actions, eyebrow « Données à vérifier », liste de couverture provider (stale/configure/manquant) et badge « valuation inconnue »: retirés. Conservé: répartition (liquidités/investi/manuel), alertes valorisation utiles, valeur externe, allocation externe, comptes et actifs, historique.
- **Santé** — couche PixelBlast WebGL du hero, `AsciiDivider`/`AsciiStatusLine` (composant `ascii-brand.tsx` supprimé, esthétique ASCII legacy): retirés. Conservé: statut global, grille de signaux santé, runs de sync, health providers.
- **Social Intelligence** — `ProviderStatusBanner`, `XHealthPanel` (santé/token/coûts X), `XReadinessBanner` (batch resolve), `DailySyncPanel` (sync J-1 + coûts), `SocialStat`, bouton « Rafraîchir » par compte, compteur d'items, `id:{externalId}`, `lastError` brut, note « Lookup payant ($0.01) », code d'erreur brut dans le lookup: retirés du rendu. Conservé: comptes suivis complets (avatar, nom, handle, bio, métriques publiques, tags, badges de vérification lisibles), lookup/ajout, activer/désactiver/supprimer, import manuel.
- **Intégrations** — « Derniers runs de synchronisation », « Derniers runs investissements », « Diagnostic provider », « Audit trail », actions dock « Diagnostiquer »/« Audit trail », prefetches et queries associés: retirés du rendu. Conservé: connect Powens, sync manuelle + cooldown, reconnect, disconnect avec confirmation, credentials IBKR/Binance, badge de statut sync par connexion, safe mode.
- **IA (Advisor)** — footer mono technique (status/source/recs/runs/topics), badge modèle LLM, query knowledge-topics devenue inutile: retirés. Page Advisor par ailleurs intacte (refonte = mission dédiée).
- **Login** — ShinyText, BorderGlow, CircularEmblem (ReactBits) remplacés par des équivalents simples; « cockpit · personnel · premium » supprimé. **Background PixelBlast conservé.**
- **Wording** — « Cockpit personnel » supprimé partout (nav group → « Cockpit », manifest PWA, eyebrows); « graphrag/neo4j/qdrant » retirés des keywords de la command palette; descriptions IA/corporate raccourcies sur les pages touchées.

## F. Fiscalité

- **Supprimé** : page, view-model + test, entrée nav, keyword palette. C'était l'intégralité de la feature.
- **Conservé parce que partagé (non fiscal)** : colonne `tax_wrapper` sur `account_strategy_policy` (stratégie d'investissement, valeurs type `PEA`); catégorie de transaction `taxes` (auto-catégorisation, matching `impot|tax|dgfip`); guardrail Advisor `guardrail_regulatory_or_tax` (refus de conseil fiscal); chaînes « Fiscalite latente » etc. dans finance-engine (caveats de recommandation); type `tax_note`.
- **DB conservée** : aucune table Fiscalité n'existait — rien à documenter pour suppression future.

## G. Signals / Sources / Free Firehose

**UI supprimée** : pages Sources et Free Firehose; `NewsFeed` + `NewsSignalCard` + `relevance-scoring` + `high-value-signals` (ancienne chaîne news UI, + tests); `TopMoversChroma` (ChromaGrid) sur Marchés; panels ops de Social (santé X, sync J-1, coûts); lien Sources du hub Signaux.

**Pipeline conservé (100 %)** : jobs news/market/social/advisor du worker; providers GDELT/HN/SEC/FRED/ECB/Fed/Bluesky/X; endpoints `/dashboard/news*`, `/dashboard/markets/*`, `/dashboard/signals/*`, `/dashboard/admin/free-firehose/*`; tables `news_*`, `market_*`, `signal_*`, `free_firehose_run`, `x_twitter_usage_ledger`; cache; ingestion knowledge-graph.

`/signaux` reste une page minimale (stats signaux, items persistés, création de scénario Trading Lab, lien Social) marquée dans le code comme temporaire en attendant la future page fusionnée **Radar / Marchés & Signaux**. Aucune nouvelle UX inventée.

Les primitives client Free Firehose (types `FreeFirehoseEstimateResponse`/`FreeFirehoseRunResponse`, fetchers `estimateFreeFirehose`/`runFreeFirehose`) vivent maintenant dans `apps/web/src/features/ops-refresh/free-firehose-api.ts` — UI supprimée, logique réutilisable conservée.

## H. Settings audit

**Conclusion : page supprimée.** Contenu audité:
1. *Notifications push* — flow d'enregistrement factice (`https://example.invalid/subscription`, clés masquées hardcodées): non fonctionnel, placeholder. La carte + les features restent utilisées par Santé; le backend push est intact. UI à réintroduire seulement si rendue fonctionnelle.
2. *Derived recompute* — action admin technique → destination future: Orchestration (l'API `POST /dashboard/derived-recompute` et le statut restent exposés et utilisés par Santé).
3. *Exports* — carte purement informative pointant vers Dépenses + visuel Folder décoratif. L'export réel vit déjà sur Dépenses.
4. Pas de thème/préférences/PWA stockés sur cette page (le theme toggle vit dans le shell, inchangé).

Aucune dépendance critique n'empêchait la suppression.

## I. GitHub agentic pipeline cleanup

**Supprimé** :
- Workflows (10): `autopilot-batch-to-codex`, `autopilot-batch-create-specs`, `autopilot-spec-to-improve`, `autopilot-improve-comment-to-ready`, `autopilot-improve-to-draft-pr`, `autopilot-apply-codex-diff`, `autopilot-ci-failure-to-codex`, `autopilot-merge-on-green`, `autopilot-queue-pump`, `no-agent-stubs` (garde-fou existant uniquement pour les stubs autopilot).
- Issue templates (4): `batch-spec`, `spec`, `improve`, `implement` (dossier `ISSUE_TEMPLATE` vidé).
- Scripts: `scripts/agentic/` entier (2 parsers + 2 tests), `scripts/codex-env-setup.sh` (bootstrap sandbox Codex).
- Config/refs: entrée `codex-env-setup.sh` dans `desktop-scope.mjs`; glob `scripts/agentic/*.test.mjs` retiré du script `test` racine; domaine `agentic-autopilot` retiré de l'outillage local agent-context (`lib.mjs`, `pack.mjs`, `prompt-builder.mjs`).
- Docs: `docs/autopilot-labels-glossary.md`, `docs/autopilot-troubleshooting.md`, `docs/ai/{audit-current-agentic-system, diagnose-stubbed-implement-flow, final-setup-checklist, target-agentic-architecture}.md`, `docs/agentic/context-packs/autopilot.md`; blocs autopilot retirés de `AGENTS.md`, `CLAUDE.md`, `docs/ci-cd.md`, `docs/AI-SETUP.md`, `docs/agentic/INDEX.md`.

**Éléments ambigus préservés (documentés)** :
- `.agentic/` (604 fichiers), `.claude/`, `.agents/`, `.qwen/`, `skills/`, `scripts/agent-context/`, `docs/agentic/` (reste): outillage **local** (skills, context packs, routing) sans aucun couplage GitHub — sert l'usage manuel avec agents locaux, conservé conformément à la section 29.
- `.codex/config.toml`: 3 lignes, enregistre uniquement le MCP gitnexus (outil local) — conservé.
- `pull_request_template.md`: checklist DoD utilisée aussi par les humains — conservé.
- Skill `release-sanity`: source canonique nettoyée (étapes autopilot/parsers/codex-env-setup retirées), projections resynchronisées (`pnpm agent:skills:sync`, drift check PASS). Plus aucune référence ACTIVE au pipeline dans configs/scripts/skills — les seuls hits `autopilot` restants dans les skills sont « GKE Autopilot » (Google Cloud, contenu tiers vendoré, sans rapport).
- Anciennes mentions autopilot dans des documents d'archive (ADRs, `FINANCE_OS_UI_UX_REPO_AUDIT.md`, `docs/debug/*`): documents historiques, non réécrits (voulu).

**CI/CD classique conservée** : `ci.yml` (lint/typecheck/tests/builds/e2e/docker smoke/tauri), `release.yml` (GHCR + Dokploy + smoke prod), `ghcr-cleanup.yml`. Vérifié: aucun de ces workflows ne référençait les éléments supprimés.

## J. Remote cleanup candidates

`REMOTE_SECRET_CANDIDATES_TO_REMOVE` :
- **`GH_AUTOPILOT_TOKEN`** — PAT utilisé exclusivement par les 9 workflows autopilot supprimés (20 références, toutes supprimées). Aucun usage runtime Finance-OS. À révoquer côté GitHub (non modifiable depuis le repo).

Autres candidats distants (non-secrets): les ~14 labels `autopilot:*` du repo GitHub, et l'app/connector GitHub Codex si elle n'a plus d'usage. Rien n'a été supprimé à distance.

Secrets classiques à **conserver**: `DOKPLOY_URL`, `DOKPLOY_API_KEY`, `DOKPLOY_COMPOSE_ID`, `SMOKE_ADMIN_EMAIL`, `SMOKE_ADMIN_PASSWORD` (release.yml).

## K. ReactBits audit

Composants vendorés dans `apps/web/src/components/reactbits/` (pas de dépendance npm ReactBits).

| Composant | Usage avant | Résultat |
|---|---|---|
| `pixel-blast.tsx` | Login (background) + Santé (hero OK-state) | **CONSERVÉ** (Login uniquement, via `pixel-blast-backdrop`); usage Santé supprimé |
| `liquid-ether` | Cockpit hero (via aurora-canvas) | supprimé (+ aurora-canvas, cockpit-hero) |
| `antigravity` | Objectifs hero | supprimé |
| `text-pressure` | PageHeader (24 routes) + cockpit-hero | supprimé; PageHeader réécrit en `<h1>` simple |
| `count-up`, `spotlight-card` | KpiTile | supprimés; KpiTile réécrit (carte simple, valeur statique formatée), API identique |
| `circular-text` | CircularEmblem → Login + Objectifs | supprimé (+ circular-emblem) |
| `shiny-text`, `border-glow` | Login (titre, carte) | supprimés, remplacés par texte/carte simples |
| `rotating-text` | cockpit-hero | supprimé |
| `chroma-grid` | TopMoversChroma → Marchés | supprimé (+ top-movers-chroma) |
| `folder` | Paramètres (page supprimée) | supprimé |
| `aurora-shape` | aurora-backdrop (déjà mort) | supprimé (chaîne morte) |
| `dock`, `glass-surface`, `magic-bento`, `pixel-trail`, `pixel-transition`, `shape-blur`, `staggered-menu`, `variable-proximity` | aucun (morts) | supprimés |

Résultat: **Login background = seul survivant. Aucune autre exception.** Le README du dossier documente l'interdiction. Dépendances npm devenues inutiles retirées: `@react-three/fiber`, `@react-three/drei`, `@faker-js/faker` (déjà sans usage). Conservées car encore utilisées: `three` (+`@types/three`) et `postprocessing` et `gsap` (pixel-blast), `three` + `react-force-graph-3d` (graph 3D mémoire). Lockfile mis à jour.

## L. Dead code removed

- Composants dashboard 0-importeur revalidés puis supprimés: `sidebar-nav`, `topbar` (doublons de l'ancien shell), `metric-card`, `portfolio-summary`, `powens-connections-card`, `expenses-list`, `ai-advisor-panel`, `api-status-card`, `dashboard-health-panel`.
- `trading-lab/candle-chart.tsx` (0 importeur — suppression de fichier mort, pas de refactor Trading Lab).
- `surfaces/pixel-image-reveal.tsx` (0 importeur, gsap).
- `ui/ascii-brand.tsx` (esthétique ASCII legacy, dernier usage retiré avec Santé).
- Chaîne news UI morte après retrait du hub: `news-feed`, `news-signal-card`, `relevance-scoring` (+ test), `high-value-signals` (+ test), `month-end-projection-card` (+ test).
- `PersonalActionsPanel` et helpers dans `personal-ux.tsx`.

## M. Bugs discovered but NOT fixed

**Financial Data Core / Cockpit**
- P1 — `/` (cockpit) répond 500 en SSR quand l'API est injoignable (`Auth SSR unavailable`) au lieu d'un rendu dégradé. Le loader `await Promise.all(...)` sans fail-soft.

**Advisor**
- P1 — `/ia/strategie-investissement` même hard-fail SSR.

**Memory**
- P1 — `/ia/memoire` et `/ia/memoire/graph` même hard-fail SSR.
- P3 — mapping human-readable des nœuds/tooltips du graph à approfondir dans la mission Mémoire 3D (pas de JSON brut détecté rendu à l'utilisateur, mais la chaîne Memory n'a pas été auditée en profondeur ici).

**Radar / Social**
- P2 — `/signaux` et `/signaux/social` même hard-fail SSR (admin-only).

**Login / Ops (build tooling)**
- P1 — `pnpm --filter @finance-os/web start` (= `vite preview`) sert un SSR qui crashe (`jsxDevRuntimeExports.jsxDEV is not a function`) sur toutes les routes, même après build. Le serveur Nitro (`node .output/server/index.mjs`) fonctionne. Soit corriger le script `start`, soit corriger la config build. À traiter en Final QA / Déploiement (vérifier ce que fait l'image Docker — si elle utilise Nitro, l'impact est local uniquement).

**Général**
- P2 — le script `test` racine (parsers/context tests) ne tourne dans aucune CI (`pnpm -r test` exclut la racine). Décider: l'ajouter à `ci.yml` ou l'assumer local.
- P3 — deux manifests skills dupliqués (`.agentic/manifests/` vs `docs/agentic/skills-sync-manifest.json`).

**Non testé faute d'API/DB (docker down)** : login réel, mode admin, mutations, sync Powens/IBKR/Binance, chat IA, orchestration runs, données réelles sur toutes les pages. **NOT VALIDATED LOCALLY.**

## N. Checks

| Commande | Résultat |
|---|---|
| `pnpm typecheck` (16 projets) | ✅ vert (baseline verte aussi avant modifications) |
| `pnpm lint` (biome, ~1000 fichiers) | ✅ vert |
| `pnpm -r --if-present test` (tous workspaces, bun + vitest) | ✅ exit 0 |
| `node --test scripts/desktop-scope.test.mjs scripts/agent-context/*.test.mjs` (script `test` racine mis à jour) | ✅ 36/36 pass |
| `NODE_ENV=production vite build` (web) → Nitro output | ✅ vert, `routeTree.gen.ts` régénéré (0 référence morte) |
| `pnpm install --no-frozen-lockfile` (lockfile après retrait deps) | ✅ vert |
| `git diff --check` | ✅ propre |
| Smoke routes (Nitro, API down) | ✅ matrice en C |
| Build API / worker / packages | ✅ couverts par `pnpm -r test` + typecheck; pas de build bundle séparé requis localement |
| Desktop (Tauri/Rust) | **NOT VALIDATED LOCALLY** — hors scope du diff (aucun fichier desktop touché), toolchain Rust non vérifiée |
| E2E Playwright (`pnpm test:e2e`) | **NOT VALIDATED LOCALLY** — nécessite l'app + API up (docker down) |
| Smoke avec API/DB réelles | **NOT VALIDATED LOCALLY** — docker daemon arrêté |

## O. Git diff summary

- **Ajoutés (2)** : `docs/refactor/FINANCE_OS_RESET_AUDIT_CLEANUP_0.md` (ce rapport); `finance_os_ui_ux_master_brief_UPDATED_2026-06-03.md` (déposé par l'utilisateur, non touché).
- **Supprimés (83)** : 14 GitHub agentique (10 workflows + 4 templates), 5 scripts (agentic + codex-env-setup), 7 docs autopilot, 5 routes pages, 8 fichiers features exclusifs, 20 ReactBits, 12 composants dashboard/misc morts, 6 fichiers chaîne news UI, autres composants décoratifs (cockpit-hero, aurora-*, circular-emblem, pixel-image-reveal, ascii-brand, top-movers-chroma, candle-chart). Liste complète: `git status --short | grep '^D'`. Correction post-revue: le client API Free Firehose a été restauré dans `features/ops-refresh/free-firehose-api.ts` (voir D/G); la source du skill `release-sanity` et ses projections ont été nettoyées des références autopilot.
- **Modifiés (34)** : `AGENTS.md`, `CLAUDE.md`, `package.json` (racine + web), `pnpm-lock.yaml`, `scripts/desktop-scope.mjs`, `scripts/agent-context/{lib,pack,prompt-builder}.mjs`, `docs/{ci-cd,AI-SETUP}.md`, `docs/agentic/INDEX.md`, `docs/frontend/information-architecture.md`, `docs/context/FEATURES.md`, `apps/web/public/manifest.json`, `routeTree.gen.ts`, shell (`nav-items`, `command-palette`), surfaces (`page-header`, `kpi-tile`), `personal-ux`, `reactbits/README.md`, et les routes: cockpit, dépenses, patrimoine, investissements, objectifs, santé, social, intégrations, signaux hub, marchés, ia/index, login.
- **Dépendances retirées** : `@react-three/fiber`, `@react-three/drei`, `@faker-js/faker` (apps/web).

## P. Remaining cleanup (nécessite les phases futures)

1. **Fail-soft SSR** des 6 loaders qui hard-fail sans API (phases par page).
2. **Recompute dérivé → Orchestration** et **coûts X / runs sociaux → Coûts / Orchestration**: la logique backend + features frontend existent, seule l'UI d'accueil doit être créée dans les missions Orchestration/Coûts.
3. **Réintégration Free Firehose dans Orchestration**: primitives client prêtes dans `features/ops-refresh/free-firehose-api.ts`, reste l'UI à câbler dans la mission Orchestration.
4. **Radar / Marchés & Signaux**: page fusionnée à construire; `/signaux` actuel est un placeholder assumé.
5. **`vite preview` SSR cassé** (M) — décider script `start` vs config.
6. **Révocation distante** de `GH_AUTOPILOT_TOKEN` + suppression des labels `autopilot:*` (action manuelle GitHub).
7. Refontes visuelles complètes (Command Pixel, navbar, design system): explicitement hors scope ici.
