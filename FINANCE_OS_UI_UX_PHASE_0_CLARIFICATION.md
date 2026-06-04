# Finance-OS — UI/UX Phase 0 Clarification

> **Date** : 2026-05-24
> **Branche** : `main`
> **Auteur** : Claude (audit lecture seule, aucune modification applicative)
> **Périmètre** : lever les `à confirmer` du rapport initial, mesurer l'usage réel, préparer la phase de feedback utilisateur écran par écran.
> **Ne décide pas** : aucune décision DA, aucune refonte, aucune suppression réelle. Diagnostic uniquement.
> **Prérequis lu** : [`FINANCE_OS_UI_UX_REPO_AUDIT.md`](./FINANCE_OS_UI_UX_REPO_AUDIT.md).

---

## 1. Executive summary

Cette phase a permis de lever la plupart des incertitudes du rapport d'audit initial via des vérifications statiques ciblées (grep, wc, lecture de fichiers clés). Trois constats majeurs en émergent :

**Confirmé** :
- La DA actuelle Aurora Pink est codée de façon centralisée et cohérente dans [`packages/ui/src/styles/globals.css`](packages/ui/src/styles/globals.css) (489 LOC, 125 déclarations `oklch()`).
- React Compiler est **bien actif** ([`apps/web/vite.config.ts:32-34`](apps/web/vite.config.ts#L32-L34)) — un point qui était noté "à confirmer".
- La navigation est définie dans [`apps/web/src/components/shell/nav-items.ts`](apps/web/src/components/shell/nav-items.ts) (251 LOC) — 22 items répartis en 3 groupes (cockpit 6, ia 5, expert 11), avec **seulement 5 items marqués `adminOnly`**, ce qui contredit partiellement le rapport initial qui supposait que la majorité des items expert étaient admin-only.
- `finance-os-ui-cockpit` SKILL.md référence bel et bien une palette amber/gold + navy-slate obsolète, divergente de DESIGN.md. **Confirmé.**

**Contredit / nuancé** :
- **GSAP n'est PAS du dead weight** : 5 composants l'importent réellement (cf. §4). À ne pas supprimer.
- **`personal-ux.tsx` n'est PAS orphelin** : il est importé par 7 routes (`/`, `/depenses`, `/patrimoine`, `/investissements`, `/objectifs`, `/fiscalite`). Le rapport initial s'est trompé.
- **4 "routes" sont en réalité des stubs de redirect 301** : `/marches`, `/memoire`, `/actualites`, `/signaux/x-twitter`. Elles ne sont pas des pages distinctes — elles redirigent vers leurs nouveaux noms.
- **Radix UI n'est pas utilisé dans le code source** — la dépendance `radix-ui@1.4.3` est présente dans `package.json` mais aucun import depuis ce package n'a été trouvé. Le DS est encore plus pauvre que ce que le rapport initial laissait penser : **aucun Dialog/Drawer/Tabs/Tooltip/Popover wrapper**.

**Risques majeurs identifiés** :
- **~3235 LOC de composants morts** (8 ReactBits non utilisés totalisant 2865 LOC + 7 composants dashboard morts ~370 LOC). À documenter mais ne PAS supprimer sans validation utilisateur.
- **`liquid-ether.tsx` (1254 LOC, WebGL)** est employé sur **une seule page** (`/_app/` cockpit, via `aurora-canvas` → `cockpit-hero`). C'est le composant le plus lourd du frontend pour un usage hyperlocalisé.
- **`pixel-blast.tsx` (705 LOC)** est utilisé sur `/login` ET `/_app/sante`. Présence sur une page santé surprenante (à interroger).
- **`text-pressure.tsx` (343 LOC)** est utilisé via `page-header.tsx` (110 LOC, 22 routes consommatrices) : tout passage de page traverse ce composant.
- **20 fichiers contiennent des `oklch()` hardcodés inline** au lieu de `var(--token)` (cf. §7.3).

**Quick wins identifiés (sans application)** :
- 8 reactbits + 7 composants dashboard à confirmer morts → candidats suppression future (Phase 0+ après validation utilisateur).
- 4 routes 301 redirect : opportunité de centraliser ces redirects (route-level) ou de les supprimer si plus de bookmarks à préserver.
- Resync `finance-os-ui-cockpit` SKILL.md → Aurora Pink (palette obsolète documentée).

**À vérifier avant design** :
- L'utilisateur veut-il garder Aurora Pink, l'évoluer (v2), ou changer complètement de DA ? Cette phase 0 ne tranche pas.
- Quel est le ressenti écran par écran ? Template fourni en §12.
- Quelles pages doivent être conservées / supprimées / fusionnées ? L'IA actuelle est-elle satisfaisante ?

---

## 2. Confirmations and unresolved points from initial audit

Table de vérification des `à confirmer` du rapport initial. Chaque ligne cite le sujet, verdict, preuve, et impact UI/UX.

| # | Sujet (extrait audit initial) | Verdict | Preuve | Impact UI/UX |
|---|-------------------------------|---------|--------|--------------|
| 1 | `gsap@3.15.0` non utilisé visible | **Infirmé — UTILISÉ** | [`pixel-image-reveal.tsx`](apps/web/src/components/surfaces/pixel-image-reveal.tsx), [`staggered-menu.tsx`](apps/web/src/components/reactbits/staggered-menu.tsx), [`magic-bento.tsx`](apps/web/src/components/reactbits/magic-bento.tsx), [`chroma-grid.tsx`](apps/web/src/components/reactbits/chroma-grid.tsx), [`pixel-transition.tsx`](apps/web/src/components/reactbits/pixel-transition.tsx) | Ne PAS supprimer GSAP. Cohabite avec motion/react. À surveiller bundle |
| 2 | React Compiler activation `à confirmer` | **Confirmé — ACTIF** | [`apps/web/vite.config.ts:32-34`](apps/web/vite.config.ts#L32-L34) `viteReact({ babel: { plugins: ['babel-plugin-react-compiler'] } })` | Memo manuel inutile en général. Compilateur fait le travail |
| 3 | `personal-ux.tsx` "orphelin à confirmer" | **Infirmé — TRÈS UTILISÉ** | 7 imports : routes `/`, `/depenses`, `/patrimoine`, `/investissements`, `/objectifs`, `/fiscalite` | Composant central, à ne PAS toucher légèrement |
| 4 | `dashboard/topbar.tsx` doublon mort | **Confirmé — MORT** | Aucun import. 17 LOC | Suppression candidate (low risk) |
| 5 | `dashboard/sidebar-nav.tsx` legacy | **Confirmé — MORT** | Aucun import. 35 LOC | Suppression candidate (low risk) |
| 6 | LOC `markets-dashboard.tsx` 30K | **Infirmé** | `wc -l` → 680 LOC réels | Le rapport initial s'était trompé. Composant gros mais pas monolithique |
| 7 | Routes `/_app/marches`, `/_app/memoire`, `/_app/actualites` comme pages | **Infirmé — STUBS 301 REDIRECT** | Fichiers de 8 LOC chacun avec `throw redirect()` | Ne sont PAS des pages distinctes. Ce sont des redirects legacy |
| 8 | `/_app/signaux/x-twitter` page séparée | **Infirmé — REDIRECT** | 14 LOC, redirige vers `/signaux/social` (consolidation documentée) | Page consolidée dans `/signaux/social` |
| 9 | LOC `routes/_app/actualites.tsx` "à confirmer" | **Levé — 8 LOC stub** | Idem #7 | N/A — stub |
| 10 | LOC `routes/_app/marches.tsx` "à confirmer" | **Levé — 8 LOC stub** | Idem #7 | N/A — stub |
| 11 | LOC `routes/_app/ia/*` "à confirmer" | **Levé** | `ia/index.tsx` 559, `ia/chat.tsx` 434, `ia/memoire/index.tsx` 516, `ia/couts.tsx` 255, `ia/trading-lab.tsx` 414 | Routes ia/* moins denses que craint (sauf strategie 1216 et memoire/graph 1860) |
| 12 | LOC `routes/_app/signaux/*` "à confirmer" | **Levé** | `signaux/index.tsx` 261, `signaux/marches.tsx` 114, `signaux/sources.tsx` 160, `signaux/free-firehose.tsx` 260, `signaux/social.tsx` 1206 | Seul social est vraiment dense |
| 13 | LOC `routes/_app/ops-env-diagnostics.tsx` "à confirmer" | **Levé — 251 LOC** | `wc -l` | Page admin/debug raisonnable |
| 14 | Routes admin-only listées | **Partiellement infirmé** | `nav-items.ts` : seulement `/signaux/sources`, `/signaux/free-firehose`, `/ia/couts`, `/orchestration`, `/ops-env-diagnostics` ont `adminOnly: true`. `/integrations`, `/sante`, `/parametres`, `/signaux/marches`, `/signaux/social`, `/ia/trading-lab` ne sont **PAS** `adminOnly` en nav | Nuance importante : le rapport initial supposait davantage d'items admin-only. La nav expose pages "expert" en demo aussi (les pages elles-mêmes gèrent demo/admin) |
| 15 | Radix UI utilisé `à confirmer` | **Infirmé — NON UTILISÉ** | `grep -r "from ['\"]radix-ui"` → 0 résultats source | DS encore plus pauvre. Dialog/Tabs/Popover/Tooltip à créer ex nihilo |
| 16 | "use client" directives | **Confirmé — 0 dans web/src** | `grep -r "use client"` → 0 résultats | Pas de boundary explicite ; tout SSR par défaut |
| 17 | Knowledge graph `à confirmer` fallback WebGL | **Confirmé — pas de fallback** | `knowledge-graph-3d.tsx` ligne 278 : dynamic import seulement | À traiter en a11y |
| 18 | Dark mode forcé dans `__root.tsx` | **Confirmé** | Cf. audit initial | Le toggle existe mais classList `dark` est sur `<html>` par défaut |
| 19 | Mocks demo `à confirmer` | **Confirmé** | `apps/api/src/mocks/demo-*.ts` 14 fichiers | OK |
| 20 | Light mode tokens couverture | **Confirmé** | `globals.css` lignes ~80-160 (tokens dual `:root` vs `.dark`) | OK |
| 21 | Apps `desktop` minimalisme | **Confirmé** | Apps/desktop 0 fichiers TS, Tauri Rust shell | N/A pour refonte UI web |
| 22 | "Demo dataset v1 vs v2" stratégie | **À confirmer** | Flag `DEMO_DATASET_STRATEGY` mentionné dans audit ; pas vérifié ici | Hors scope phase 0 |
| 23 | Skill `finance-os-ui-cockpit` palette amber/gold obsolète | **Confirmé** | [`.agentic/source/skills/finance-os/ui-cockpit/SKILL.md`](.agentic/source/skills/finance-os/ui-cockpit/SKILL.md) lignes 18-30 : amber/gold `oklch(0.78 0.155 75)` + navy-slate `oklch(0.13 0.015 260)`, NON aligné avec DESIGN.md Aurora Pink rose `oklch(0.72 0.19 355)` + plum `oklch(0.12 0.02 325)` | Skill induit en erreur Claude/Codex pendant la refonte |
| 24 | `dashboard-health-panel.tsx` `à confirmer` usage | **Infirmé — MORT** | Aucun import. 159 LOC. Cf. §6 | Candidat suppression |
| 25 | `portfolio-summary.tsx`, `expenses-list.tsx`, `metric-card.tsx`, `api-status-card.tsx` `à confirmer` | **Confirmé MORTS** | Aucun import. Cf. §6 | Candidats suppression |
| 26 | Lazy load des heavy reactbits | **Partiellement infirmé** | Seuls `react-force-graph-3d` (knowledge-graph-3d.tsx:278) et `lightweight-charts` (3 charts trading-lab) sont dynamic imports. `liquid-ether`, `pixel-blast`, `magic-bento` etc. sont importés statiquement | Risque bundle réel |
| 27 | Une seule "use client" directive | **Infirmé — 0** | `grep -r "use client" apps/web/src` → 0 résultats | TanStack Start sans boundary explicite (par défaut SSR) |
| 28 | LH/Bundle baseline | **Non mesurée** | Non lancée (phase 0 read-only) | À mesurer phase 0 bis ou phase 1 |

**Synthèse §2** : 24 points levés (confirmés ou infirmés), 2 non vérifiés (perf metrics + demo strategy v1 vs v2). Plusieurs **erreurs** du rapport initial relevées (markets-dashboard LOC, GSAP usage, personal-ux usage, routes stub vs page, Radix non utilisé). Ces corrections sont importantes pour la suite.

---

## 3. Exact frontend routes map

35 fichiers de routes, dont **31 pages réelles + 4 stubs 301 redirect**.

### 3.1 Routes réelles (31)

| Route | Fichier | LOC | Mode (nav) | Composants/features clés | Imports lourds | Risque refonte |
|-------|---------|-----|------------|--------------------------|----------------|----------------|
| `/` | `routes/__root.tsx` | 148 | shared (root) | `PwaInstallPrompt`, `ToastViewport`, devtools | — | Faible (shell) |
| `/login` | `routes/login.tsx` | 180 | public | `BrandMark`, `CircularEmblem`, `BorderGlow`, `ShinyText`, `PixelBlastBackdrop` (→ `pixel-blast` 705 LOC) | ⚠ `pixel-blast` | Moyen (perte signature si refonte) |
| `/health` | `routes/health.tsx` | 31 | public | minimal | — | Nul |
| `/healthz` | `routes/healthz.tsx` | 31 | public | minimal | — | Nul |
| `/version` | `routes/version.tsx` | 37 | public | minimal | — | Nul |
| `/transactions` | `routes/transactions.tsx` | 223 | public (export) | tables | — | Faible |
| `/powens/callback` | `routes/powens/callback.tsx` | 219 | demo+admin | OAuth flow | — | Moyen (ne PAS casser OAuth) |
| `/_app` (layout) | `routes/_app.tsx` | 59 | shared | `AppSidebar`, `Topbar`, `CommandPalette`, `MobileNav`, motion AnimatePresence | `motion` | Élevé (shell) |
| `/` (cockpit) | `routes/_app/index.tsx` | 689 | demo+admin | `CockpitHero` (→ `text-pressure`+`rotating-text`+`liquid-ether` via aurora-canvas), `KpiTile`, `D3Sparkline`, `ai-advisor-panel` (1013), `personal-financial-goals-card` (921), `wealth-history` (491), `month-end-projection-card` (384), `news-feed` (366), `monthly-category-budgets-card` (330), `powens-connections-card` (242), `expense-structure-card` (162), `PersonalActionsPanel` | ⚠ liquid-ether (single page) | **Critique** |
| `/_app/depenses` | `routes/_app/depenses.tsx` | 426 | demo+admin | `PageHeader`, `PersonalActionsPanel`, transactions, budgets | — | Moyen |
| `/_app/patrimoine` | `routes/_app/patrimoine.tsx` | 1004 | demo+admin | `PageHeader`, `PersonalActionsPanel`, KPI, allocation, history, motion | — | **Élevé** |
| `/_app/investissements` | `routes/_app/investissements.tsx` | 971 | demo+admin | `PageHeader`, `PersonalActionsPanel`, `ActionDock`, positions, 60/30/10 | — | **Élevé** |
| `/_app/fiscalite` | `routes/_app/fiscalite.tsx` | 595 | demo+admin (nav) | `PageHeader`, `PersonalActionsPanel`, dossier préparatoire | — | Moyen |
| `/_app/objectifs` | `routes/_app/objectifs.tsx` | 210 | demo+admin | `PageHeader`, `PersonalActionsPanel`, `antigravity` (201 LOC reactbits) | ⚠ antigravity | Faible |
| `/_app/sante` | `routes/_app/sante.tsx` | 418 | demo+admin (nav) | `PageHeader`, `PixelBlast`, health panels, reduced-motion | ⚠ pixel-blast | Moyen |
| `/_app/parametres` | `routes/_app/parametres.tsx` | 262 | demo+admin (nav) | `PageHeader`, `Folder` (reactbits 166 LOC), push notifications | ⚠ folder | Faible |
| `/_app/integrations` | `routes/_app/integrations.tsx` | 1072 | demo+admin (nav) | `PageHeader`, `ActionDock`, Powens + IBKR + Binance status, sync logs | — | **Élevé** |
| `/_app/orchestration` | `routes/_app/orchestration.tsx` | 445 | admin-only | `PageHeader`, CTA cards, policy events | — | Moyen |
| `/_app/ops-env-diagnostics` | `routes/_app/ops-env-diagnostics.tsx` | 251 | admin-only | `PageHeader`, diagnostic panels | — | Faible (debug) |
| `/_app/ia` (hub) | `routes/_app/ia/index.tsx` | 559 | demo+admin | `PageHeader`, advisor brief, recommendations | — | **Élevé** |
| `/_app/ia/strategie-investissement` | `routes/_app/ia/strategie-investissement.tsx` | **1216** | demo+admin | `PageHeader`, plan d'action, scorecard, hypothèses | — | **Critique** |
| `/_app/ia/chat` | `routes/_app/ia/chat.tsx` | 434 | demo+admin | `PageHeader`, conversation Advisor | — | Élevé |
| `/_app/ia/memoire` | `routes/_app/ia/memoire/index.tsx` | 516 | demo+admin | `PageHeader`, knowledge inspection | — | Moyen |
| `/_app/ia/memoire/graph` | `routes/_app/ia/memoire/graph.tsx` | **1860** | demo+admin | `PageHeader`, `KnowledgeGraph3D` (755 LOC + three + react-force-graph-3d dynamic), `advisor-graph-details-panel` (463), lenses, traversal, pin path, reduced-motion | ⚠⚠ three + force-graph-3d | **Critique** |
| `/_app/ia/couts` | `routes/_app/ia/couts.tsx` | 255 | admin-only | `PageHeader`, cost ledger | — | Faible |
| `/_app/ia/trading-lab` | `routes/_app/ia/trading-lab.tsx` | 414 | demo+admin (nav) | `PageHeader`, backtest runner, hypothesis lab, strategy editor (local `MetricCard`) | `lightweight-charts` (via charts) | Moyen |
| `/_app/signaux` (hub) | `routes/_app/signaux/index.tsx` | 261 | demo+admin (nav) | `PageHeader`, signals summary | — | Faible |
| `/_app/signaux/marches` | `routes/_app/signaux/marches.tsx` | 114 | demo+admin (nav) | `PageHeader`, `markets-dashboard` (680) | `lightweight-charts` (via markets) | Élevé (charts) |
| `/_app/signaux/sources` | `routes/_app/signaux/sources.tsx` | 160 | admin-only | `PageHeader`, source status | — | Faible |
| `/_app/signaux/social` | `routes/_app/signaux/social.tsx` | **1206** | demo+admin (nav) | `PageHeader`, sentiment, sources, dedupe, `XHealthPanel` (local) | — | **Élevé** |
| `/_app/signaux/free-firehose` | `routes/_app/signaux/free-firehose.tsx` | 260 | admin-only | `PageHeader`, raw data | — | Faible |

### 3.2 Routes stub 301 redirect (4) — legacy

| Route | Redirige vers | LOC | Raison |
|-------|---------------|-----|--------|
| `/_app/marches` | `/signaux/marches` (301) | 8 | Legacy bookmark |
| `/_app/memoire` | `/ia/memoire` (301) | 8 | Legacy bookmark |
| `/_app/actualites` | `/signaux` (301) | 8 | Legacy bookmark |
| `/_app/signaux/x-twitter` | `/signaux/social` (replace) | 14 | Consolidation X/Twitter dans Social Intelligence cockpit |

**Note** : ces routes ne sont pas des pages distinctes. Le rapport initial les comptait à tort comme pages. Total **pages réelles authentifiées sous `/_app/` = 23**, et non 27 comme indiqué initialement.

### 3.3 Total LOC routes

| Catégorie | LOC |
|-----------|-----|
| Routes authentifiées `_app/*` réelles | ~12 900 |
| Stubs 301 | 38 |
| Routes publiques + root + login | ~770 |
| **Total** | **14 564** |

### 3.4 Mode nav par groupe (basé sur `nav-items.ts`)

| Groupe | Item | adminOnly nav |
|--------|------|---------------|
| cockpit | `/`, `/depenses`, `/patrimoine`, `/investissements`, `/fiscalite`, `/objectifs` | non |
| ia | `/ia`, `/ia/strategie-investissement`, `/ia/chat`, `/ia/memoire`, `/ia/memoire/graph` | non |
| expert | `/signaux` | non |
| expert | `/signaux/marches` | non |
| expert | `/signaux/social` | non |
| expert | `/signaux/sources` | **oui** |
| expert | `/signaux/free-firehose` | **oui** |
| expert | `/ia/trading-lab` | non |
| expert | `/ia/couts` | **oui** |
| expert | `/integrations` | non |
| expert | `/sante` | non |
| expert | `/orchestration` | **oui** |
| expert | `/ops-env-diagnostics` | **oui** |
| expert | `/parametres` | non |

⚠ **Correction** : le rapport initial supposait davantage d'items admin-only. La nav réelle expose `integrations`, `sante`, `parametres`, `signaux/marches`, `signaux/social`, `ia/trading-lab` aux deux modes (la page elle-même peut filtrer en interne).

---

## 4. Heavy imports and bundle-risk map

### 4.1 Dépendances lourdes — usage réel

| Dépendance | Fichiers importeurs | Routes concernées | Lazy ? | SSR-safe ? | Reduced-motion ? | Bundle estimé | Recommandation |
|------------|---------------------|-------------------|--------|------------|------------------|---------------|----------------|
| **`three`** | `knowledge-graph-3d.tsx`, `shape-blur.tsx` (mort), `antigravity.tsx`, `pixel-blast.tsx`, `liquid-ether.tsx`, `pixel-trail.tsx` (mort) | `/ia/memoire/graph`, `/login`, `/_app/sante`, `/_app/objectifs`, `/_app/` (cockpit via aurora-canvas) | ⚠ Indirect via dynamic import knowledge-graph-3d | Oui (guards `typeof window`) | Oui (`useReducedMotion`) | ~600 KB | **Garder** — usage justifié, mais surveiller bundle |
| **`react-force-graph-3d`** | `knowledge-graph-3d.tsx` | `/ia/memoire/graph` | ✅ Dynamic import (`knowledge-graph-3d.tsx:278`) | Oui | Oui | ~200 KB | **Garder, lazy déjà OK** |
| **`@react-three/fiber`** | reactbits 3D (shape-blur mort, antigravity, pixel-blast, liquid-ether, pixel-trail mort) | login, sante, objectifs, cockpit | ⚠ Statiques (sauf via knowledge-graph) | Oui | Oui | ~100 KB | **Lazy-load** sur reactbits live |
| **`@react-three/drei`** | (probablement via reactbits 3D — non vérifié ici) | idem | ⚠ | Oui | Oui | ~80 KB | **Lazy-load** |
| **`postprocessing`** | `pixel-blast.tsx` uniquement | `/login`, `/_app/sante` | ⚠ Statique via pixel-blast | Oui | Oui | ~50 KB | **Lazy-load** ou retirer de sante |
| **`d3`** | `d3-sparkline.tsx`, `relative-performance-ribbon.tsx` | toutes pages avec sparkline (cockpit, etc.) | ❌ Statique | Oui (SVG) | N/A | ~200 KB (tree-shakable) | **Garder** — usage justifié |
| **`lightweight-charts`** | `equity-curve-chart.tsx`, `drawdown-chart.tsx`, `candle-chart.tsx` | trading-lab, signaux/marches | ✅ Dynamic import dans chaque chart | Oui | N/A | ~100 KB | **Garder, lazy déjà OK** |
| **`gsap`** | `pixel-image-reveal.tsx`, `staggered-menu.tsx` (mort), `magic-bento.tsx` (mort), `chroma-grid.tsx`, `pixel-transition.tsx` (mort) | top-movers (markets), news-signal-card (cockpit), reactbits morts | ❌ Statique | Oui | À vérifier (pas trouvé `useReducedMotion` dans pixel-image-reveal `à confirmer`) | ~80 KB | **Garder** car utilisé. Réévaluer si reactbits morts retirés |
| **`motion` (Framer Motion v3)** | 30 fichiers | partout | ❌ Statique | Oui | ✅ Excellent — 19 fichiers `useReducedMotion` | ~50 KB | **Garder** — pillier UX |
| **`cmdk`** | `command-palette.tsx` | shell | ❌ Statique | Oui | N/A | ~10 KB | **Garder** |
| **`radix-ui`** | **AUCUN IMPORT TROUVÉ** | — | N/A | N/A | N/A | dead dep | ⚠ **Dep fantôme** — à reconfirmer (potentiel deadweight package.json) |
| **`@finance-os/ui` (workspace)** | partout | partout | ❌ Statique | Oui | N/A | minimal | OK |

### 4.2 Mapping `three.js` ecosystem détaillé

`three` est utilisé par 6 composants, dont **2 sont morts** :

| Composant three | Statut | Routes |
|-----------------|--------|--------|
| `knowledge-graph-3d.tsx` (755) | Vivant | `/ia/memoire/graph` |
| `antigravity.tsx` (201) | Vivant | `/_app/objectifs` |
| `pixel-blast.tsx` (705) | Vivant | `/login`, `/_app/sante` |
| `liquid-ether.tsx` (1254) | Vivant | `/_app/` (cockpit) |
| `shape-blur.tsx` (274) | **Mort** | — |
| `pixel-trail.tsx` (186) | **Mort** | — |

### 4.3 Imports statiques à risque

Composants Three/WebGL **importés statiquement** dans des routes utilisateur :

| Route | Composant Three | LOC | Risque |
|-------|----------------|-----|--------|
| `/_app/` (cockpit) | `liquid-ether` via aurora-canvas via cockpit-hero | 1254 | **Élevé** — page d'accueil avec WebGL synchrone |
| `/_app/sante` | `pixel-blast` | 705 | Élevé — page santé n'a pas vocation à être un showcase |
| `/_app/objectifs` | `antigravity` | 201 | Moyen — page secondaire |
| `/login` | `pixel-blast` + `border-glow` + `shiny-text` + `circular-emblem` | ~700+300+140+60 | Acceptable (page d'entrée signature) |
| `/_app/parametres` | `folder` reactbit | 166 | Faible |

### 4.4 Recommandations bundle

1. **Lazy-load systématique** sur tous les composants Three vivants (antigravity, pixel-blast, liquid-ether) via `React.lazy` ou dynamic import du composant aval (cockpit-hero, sante, objectifs).
2. **Retirer `pixel-blast` de `/_app/sante`** ou demander à l'utilisateur si cet effet est intentionnel ici (surprenant sur une page santé).
3. **Mesurer le bundle réel** via `vite-bundle-visualizer` (à lancer hors scope phase 0).
4. **Vérifier `radix-ui` dans `package.json`** — si vraiment 0 imports, c'est un fantôme.
5. **Conserver GSAP** — usage réel confirmé.

---

## 5. ReactBits real usage audit

### 5.1 Inventaire complet (22 composants)

| Composant | LOC | Usage (importé par X fichiers) | Vivant ? | Importé par | Type | Coût | Rôle produit | Recommandation |
|-----------|-----|-------------------------------|----------|-------------|------|------|--------------|----------------|
| `antigravity` | 201 | 1 | ✅ | `routes/_app/objectifs.tsx` | WebGL | Élevé | Décoration | **Lazy-load** + interroger user (overkill pour objectifs ?) |
| `aurora-shape` | 60 | 1 | ✅ | `components/brand/aurora-backdrop.tsx` | Canvas/CSS | Faible | Signature visuelle | **Garder** |
| `border-glow` | 303 | 1 | ✅ | `routes/login.tsx` | Animation | Moyen | Signature login | **Garder** (login only) |
| `chroma-grid` | 230 | 1 | ✅ | `components/markets/top-movers-chroma.tsx` | Animation + GSAP | Moyen | Data viz décorative | **Garder** ou alléger |
| `circular-text` | 124 | 2 | ✅ | `circular-emblem.tsx`, `cockpit-hero.tsx` | Animation | Faible | Signature | **Garder** |
| `count-up` | 114 | 1 | ✅ | `components/surfaces/kpi-tile.tsx` | Animation | Faible | Feedback numérique | **Garder** (core KpiTile) |
| `dock` | 191 | 0 | ❌ **Mort** | — | Interaction | Moyen | — | **Diagnostic : candidate suppression** |
| `folder` | 166 | 1 | ✅ | `routes/_app/parametres.tsx` | Animation | Faible | Décoration | **Garder** ou alléger (parametres seul) |
| `glass-surface` | 379 | 0 | ❌ **Mort** | — | Décoratif | Élevé | — | **Diagnostic : candidate suppression** |
| `liquid-ether` | **1254** | 1 | ✅ | `components/brand/aurora-canvas.tsx` | **WebGL** | **Élevé** | Signature cockpit | **À interroger user** : 1254 LOC WebGL pour une seule page (cockpit) — voulez-vous le garder ? Si oui, lazy-load |
| `magic-bento` | **862** | 0 | ❌ **Mort** | — | Layout | Élevé | — | **Diagnostic : candidate suppression** |
| `pixel-blast` | 705 | 2 | ✅ | `pixel-blast-backdrop.tsx`, `routes/_app/sante.tsx` | **WebGL + postprocessing** | **Élevé** | Signature login + sante | **À interroger** : usage sur `/sante` surprenant |
| `pixel-trail` | 186 | 0 | ❌ **Mort** | — | WebGL | Moyen | — | **Diagnostic : candidate suppression** |
| `pixel-transition` | 167 | 0 | ❌ **Mort** | — | Animation | Moyen | — | **Diagnostic : candidate suppression** |
| `rotating-text` | 245 | 1 | ✅ | `components/surfaces/cockpit-hero.tsx` | Animation texte | Faible | Signature hero | **Garder** |
| `shape-blur` | 274 | 0 | ❌ **Mort** | — | WebGL | Moyen | — | **Diagnostic : candidate suppression** |
| `shiny-text` | 139 | 1 | ✅ | `routes/login.tsx` | Animation texte | Faible | Signature login | **Garder** |
| `spotlight-card` | 84 | 1 | ✅ | `components/surfaces/kpi-tile.tsx` | Animation | Faible | Feedback interactif | **Garder** (core KpiTile) |
| `staggered-menu` | 589 | 0 | ❌ **Mort** | — | Interaction + GSAP | Élevé | — | **Diagnostic : candidate suppression** |
| `text-pressure` | 343 | 2 | ✅ | `cockpit-hero.tsx`, `page-header.tsx` | Animation variable-font | Moyen | **Pervasive** | **Garder mais surveiller** (chargé via PageHeader sur 22 routes) |
| `variable-proximity` | 217 | 0 | ❌ **Mort** | — | Animation | Moyen | — | **Diagnostic : candidate suppression** |

### 5.2 Synthèse ReactBits

- **Vivants : 13 composants (~3520 LOC)**
- **Morts : 8 composants (~2865 LOC)** — `dock`, `glass-surface`, `magic-bento`, `pixel-trail`, `pixel-transition`, `shape-blur`, `staggered-menu`, `variable-proximity`
- **Critiques** : `liquid-ether` (1254 LOC WebGL, page cockpit unique), `pixel-blast` (705 LOC sur login + sante), `text-pressure` (343 LOC pervasive via PageHeader)

⚠ **Recommandation** : ne RIEN supprimer maintenant. Présenter le diagnostic à l'utilisateur, lui demander quels composants signature il souhaite conserver, et **ensuite** envisager la suppression en phase 2 (après décision DA).

---

## 6. Dead, duplicate, and legacy components audit

### 6.1 Composants potentiellement morts (à valider avant suppression)

| Fichier | LOC | Importé ? | Importé par | Statut |
|---------|-----|-----------|-------------|--------|
| `components/dashboard/topbar.tsx` | 17 | ❌ | — | **Mort confirmé** |
| `components/dashboard/sidebar-nav.tsx` | 35 | ❌ | — | **Mort confirmé** |
| `components/dashboard/portfolio-summary.tsx` | 27 | ❌ | — | **Mort confirmé** (export `PortfolioSummary` jamais consommé) |
| `components/dashboard/metric-card.tsx` | 26 | ❌ | — | **Mort confirmé** (un autre `MetricCard` local existe dans `routes/_app/ia/trading-lab.tsx:78`, sans rapport) |
| `components/dashboard/expenses-list.tsx` | 42 | ❌ | — | **Mort confirmé** |
| `components/dashboard/dashboard-health-panel.tsx` | 159 | ❌ | — | **Mort confirmé** (le rapport initial le citait — confirmé inactif) |
| `components/dashboard/api-status-card.tsx` | 64 | ❌ | — | **Mort confirmé** |
| `components/reactbits/dock.tsx` | 191 | ❌ | — | **Mort confirmé** |
| `components/reactbits/glass-surface.tsx` | 379 | ❌ | — | **Mort confirmé** |
| `components/reactbits/magic-bento.tsx` | 862 | ❌ | — | **Mort confirmé** (le plus gros mort, 862 LOC) |
| `components/reactbits/pixel-trail.tsx` | 186 | ❌ | — | **Mort confirmé** |
| `components/reactbits/pixel-transition.tsx` | 167 | ❌ | — | **Mort confirmé** |
| `components/reactbits/shape-blur.tsx` | 274 | ❌ | — | **Mort confirmé** |
| `components/reactbits/staggered-menu.tsx` | 589 | ❌ | — | **Mort confirmé** |
| `components/reactbits/variable-proximity.tsx` | 217 | ❌ | — | **Mort confirmé** |
| `components/brand/aurora-backdrop.tsx` | 60 | ❌ | — | **Mort confirmé** (importe `aurora-shape`, mais lui-même n'est pas consommé) |
| `components/advisor/learning-loop-smoke.test.tsx` | 382 | N/A | — | Test file (pas un composant prod) |

**Total LOC mort (composants vivants prod, hors tests) : ~3295 LOC**

### 6.2 Doublons / patterns dupliqués

| Doublon | Fichiers | Détail |
|---------|----------|--------|
| `MetricCard` | `components/dashboard/metric-card.tsx` (26, mort) + `routes/_app/ia/trading-lab.tsx:78` (local) | Le composant dashboard n'est pas utilisé ; trading-lab a sa version locale |
| `Topbar` | `components/shell/topbar.tsx` (104, vivant) + `components/dashboard/topbar.tsx` (17, mort) | Confirmé : un seul est utilisé |
| `XHealthPanel` | `components/dashboard/dashboard-health-panel.tsx` (159, mort, exporte `DashboardHealthPanel`) + `routes/_app/signaux/social.tsx:867` (local `XHealthPanel`) | Pas exactement un doublon, mais convention duplication |

### 6.3 Composants vivants importants à NE PAS toucher légèrement

| Composant | LOC | Importé par | Notes |
|-----------|-----|-------------|-------|
| `surfaces/page-header.tsx` | 110 | 22 routes | Pivot du shell — tout le monde passe par lui |
| `surfaces/panel.tsx` | 100 | 36 fichiers | Pattern de wrapper card universel |
| `surfaces/status-dot.tsx` | 48 | 11 fichiers | Indicateur état standardisé |
| `surfaces/kpi-tile.tsx` | 105 | 8 fichiers | Source de vérité KPI |
| `personal/personal-ux.tsx` | ? | 7 routes (cockpit, depenses, patrimoine, investissements, objectifs, fiscalite, index) | Exporte `PersonalActionsPanel`, `PersonalSectionHeading` |

⚠ Ces composants sont à **respecter** en refonte — toute modification a effet domino.

### 6.4 Recommandation

Aucun fichier ne doit être supprimé maintenant. Le diagnostic permet de :
1. Présenter à l'utilisateur la liste des candidats morts (3295 LOC).
2. Valider page par page (cf. §12) si certains "morts" sont en réalité prévus pour usage futur.
3. Préparer une PR de suppression contrôlée en phase 1 ou 2 (après décision DA).

---

## 7. Current design system verification

### 7.1 Composants partagés actuels (`packages/ui`)

| Composant | Package/fichier | Usage observable | Maturité | Recommandation |
|-----------|------------------|------------------|----------|----------------|
| `Button` | `packages/ui/src/components/ui/button.tsx` | Standard | Stable | Garder dans `packages/ui` |
| `Card` | `packages/ui/src/components/ui/card.tsx` | Standard | Stable | Garder |
| `Badge` | `packages/ui/src/components/ui/badge.tsx` | Standard | Stable | Garder |
| `Avatar` | `packages/ui/src/components/ui/avatar.tsx` | Standard | Stable | Garder |
| `Input` | `packages/ui/src/components/ui/input.tsx` | Standard | Stable | Garder |
| `Separator` | `packages/ui/src/components/ui/separator.tsx` | Standard | Stable | Garder |
| `globals.css` | `packages/ui/src/styles/globals.css` | 489 LOC, **125 `oklch()` déclarations** | Stable mais dense | Garder, mais isoler les tokens semantic vs decorative |
| `cn()` utility | `packages/ui/src/lib/utils.ts` | Helper | Stable | Garder |

**Total `packages/ui` composants** : 6 primitives. **Pas de wrapper Radix** (Dialog, Tabs, Drawer, Tooltip, Popover, etc.) car Radix n'est pas réellement importé.

### 7.2 Composants candidats à remonter dans `packages/ui`

Liste vérifiée par usage réel observé :

| Candidat | Localisation actuelle | LOC | Usage actuel | Pourquoi remonter | Risques | Priorité |
|----------|----------------------|-----|--------------|---------------------|---------|----------|
| `PageHeader` | `apps/web/src/components/surfaces/page-header.tsx` | 110 | **22 routes** | Pivot du shell, standard absolu | Importe `text-pressure` (reactbits, 343 LOC) — décision : remonter aussi ou découpler ? | **P0** |
| `Panel` | `apps/web/src/components/surfaces/panel.tsx` | 100 | **36 fichiers** | Wrapper card universel | Faible — composant lean | **P0** |
| `KpiTile` | `apps/web/src/components/surfaces/kpi-tile.tsx` | 105 | 8 fichiers | Pattern KPI canonique | Importe `SpotlightCard` (reactbit) + `CountUp` — chaîne de deps à remonter aussi | **P0** |
| `StatusDot` | `apps/web/src/components/surfaces/status-dot.tsx` | 48 | 11 fichiers | Indicateur état standardisé | Faible | **P0** |
| `D3Sparkline` | `apps/web/src/components/ui/d3-sparkline.tsx` | 200+ | 6 fichiers | Sparkline réutilisable | d3 est dans web/package.json, à propager | **P1** |
| `BrandMark` | `apps/web/src/components/brand/brand-mark.tsx` | 80 | 4 fichiers | Logo réutilisable | Faible | **P1** |
| `RangePill` | `apps/web/src/components/surfaces/range-pill.tsx` | 81 | 2 fichiers | Segmented control | Usage modéré — attendre | **P2** |
| `ActionDock` | `apps/web/src/components/surfaces/action-dock.tsx` | 193 | 2 fichiers | CTA dock | Usage modéré (investissements, integrations) | **P2** |
| `ThemeToggle` | `apps/web/src/components/shell/theme-toggle.tsx` | 80 | 1 fichier | Toggle dark/light | Usage faible — attendre | **P2** |
| `CockpitHero` | `apps/web/src/components/surfaces/cockpit-hero.tsx` | 151 | **1 fichier** | Spécifique cockpit | Très spécifique — garder côté web | ❌ Ne pas remonter |
| `PixelImageReveal` | `apps/web/src/components/surfaces/pixel-image-reveal.tsx` | 101 | 1 fichier | Effet décoratif news-signal-card | Très spécifique | ❌ Ne pas remonter |

**À créer ex nihilo (Phase 1)** :
- `DataTable` (TanStack Table wrapper)
- `Skeleton` (animate-shimmer)
- `Field` (Input + label + error + helper)
- `EmptyState` (icône + titre + CTA)
- `WidgetError`, `WidgetDegraded` (fail-soft states)
- `ModeBadge` (Demo / Admin)
- `Dialog`, `Drawer`, `Tabs`, `Tooltip`, `Popover` — soit créer ex nihilo (recommandé : importer une lib type Radix si décidé), soit garder Radix dans deps et écrire les wrappers.

### 7.3 Tokens hardcodés inline détectés

20 fichiers contiennent des `oklch()` inline (hors `globals.css`) :

| Fichier | Notes |
|---------|-------|
| `components/ui/d3-sparkline.tsx` | Couleurs gradient charts dynamiques |
| `components/advisor/knowledge-graph-3d.tsx` | Couleurs nodes/edges (Three.js) — légitime, mais hardcodé |
| `components/shell/topbar.tsx` | Bordure ou background — `à vérifier` |
| `components/shell/app-sidebar.tsx` | Gradient actif état — `à vérifier` |
| `components/shell/command-palette.tsx` | À vérifier |
| `components/brand/brand-mark.tsx` | Halo couleur |
| `components/reactbits/border-glow.tsx` | Gradient brand |
| `components/reactbits/spotlight-card.tsx` | Spotlight color |
| `components/dashboard/personal-financial-goals-card.tsx` | À vérifier |
| `components/dashboard/ai-advisor-panel.tsx` | À vérifier |
| `components/dashboard/news-signal-card.tsx` | À vérifier |
| `components/markets/relative-performance-ribbon.tsx` | Ribbon colors |
| `components/markets/markets-dashboard.tsx` | Chart colors |
| `components/markets/top-movers-chroma.tsx` | Chroma grid colors |
| `components/surfaces/range-pill.tsx` | Active state |
| `components/surfaces/panel.tsx` | Rail color |
| `components/surfaces/cockpit-hero.tsx` | Hero gradient |
| `components/surfaces/status-dot.tsx` | Dot tones |
| `components/surfaces/pixel-image-reveal.tsx` | Decorative |
| `routes/login.tsx` | Login decorative |

⚠ **Recommandation** : auditer chaque fichier en phase 1, soit transformer en variable CSS dans `globals.css`, soit les conserver comme "couleurs dynamiques" (cas Three.js, gradients calculés). Ne pas faire une passe aveugle.

### 7.4 Autres classes répétées / valeurs magiques

À investiguer en phase 1 (non vérifié finement ici) :
- `shadow-[...]` ad hoc (Tailwind arbitrary values) — à grep
- Tailwind paddings/margins très spécifiques (`px-4 py-6 pb-28` dans `_app.tsx`) — à standardiser via tokens spacing si besoin
- Classes responsive ad hoc (`lg:ml-[248px]`) — déjà via CSS var, OK

---

## 8. Current art direction clarification

### 8.1 Composition de la DA actuelle (Aurora Pink)

| Couche | Élément | Localisation | Difficulté à changer |
|--------|---------|--------------|----------------------|
| **Couleurs** | Palette OKLCH dark + light, 125 déclarations | [`packages/ui/src/styles/globals.css`](packages/ui/src/styles/globals.css) | **Faible** — un seul fichier source |
| **Couleurs hardcodées** | 20 fichiers avec `oklch()` inline | divers composants | Moyen — mais isolable |
| **Tokens semantic finance** | `--positive`, `--negative`, `--warning` (emerald/coral/amber) | `globals.css` | Faible mais ⚠ **invariant produit** |
| **Aurora triad** | `--aurora-a`, `--aurora-b`, `--aurora-c` (rose/magenta-plum/indigo-violet) | `globals.css` + composants `text-aurora`, `bg-aurora-mesh` | Faible |
| **Typographie corps** | Inter Variable (fontsource) | `apps/web/src/styles.css:1` | Faible |
| **Typographie financière** | JetBrains Mono Variable (`.font-financial`) | `apps/web/src/styles.css:2` + `globals.css` | Faible |
| **Typographie hero** | Compressa VF (via TextPressure reactbit) | `text-pressure.tsx` 343 LOC | Moyen — composant signature |
| **Layout shell** | sidebar 248/72px, mobile bottom nav | `app-sidebar.tsx` (195) + `_app.tsx` (59) + `nav-items.ts` (251) | Moyen — structure produit |
| **Densité** | gap-6, space-y-10, max-w-7xl | Tailwind partout | Faible — convention |
| **Motion** | ease-out-expo/spring/aurora, durées 120/200/350ms | `globals.css` + 30 fichiers motion/react | Moyen |
| **Effets visuels décoratifs** | Aurora canvas (liquid-ether), pixel-blast, aurora-mesh, scanlines, grain, grid-dots | `globals.css` (textures) + reactbits | Moyen — signature visuelle |
| **Data viz** | d3 sparkline, lightweight-charts, force-graph-3d, chroma-grid | 3 libs distinctes | Élevé |
| **Copywriting** | Français, descriptions navItems, glyphes ASCII | `nav-items.ts` + composants | Faible (texte) — mais ⚠ langage cockpit |
| **Iconographie** | Glyphes ASCII (◈ □ ≋ ↔ ◇ △ § ◎ ▱ # ⊟ ⊞ ≋ 𝕏 ⚡ ⇶ ⟐ ⊘ ♡ <> ⚙ ◴) | `nav-items.ts` icon field | Faible — mais identitaire |
| **Textures** | `.texture-scanlines`, `.texture-grain`, `.bg-grid-dots`, `.bg-aurora-mesh`, `.bg-stripe-pattern` | `globals.css` | Faible |
| **Composants signature** | `BrandMark`, `KpiTile` (SpotlightCard + CountUp), `Panel`, `PageHeader` (TextPressure), `RangePill`, `StatusDot`, `CockpitHero`, `AuroraBackdrop`, `BorderGlow`, `ShinyText`, `CircularEmblem` | `apps/web/src/components/{surfaces,brand,reactbits}` | Variable selon composant |

### 8.2 Ce qui est facile à changer

- **Tokens couleur** : modifier `globals.css` `:root` + `.dark` change immédiatement toute l'app
- **Polices** : remplacer Inter/JetBrains Mono = changer 2 lignes dans `styles.css`
- **Glyphes ASCII** nav : changer `icon` field dans `nav-items.ts`
- **Textures décoratives** : retirer/remplacer les classes dans composants
- **Aurora gradients** : modifier les variables `--aurora-*`

### 8.3 Ce qui est risqué à changer

- **Sémantique finance** (positive/negative/warning) — invariant business
- **`PageHeader` + `text-pressure`** — 22 routes l'utilisent
- **`Panel`** — 36 fichiers
- **`KpiTile`** — chaîne de deps reactbits
- **Sidebar structure** — nav-items.ts touche routes
- **`CockpitHero` + `aurora-canvas` + `liquid-ether`** — chaîne dépendante WebGL

### 8.4 Catégorisation pour décision utilisateur

L'utilisateur peut maintenant cibler **ce qui le dérange** parmi :

| Catégorie | Exemples concrets |
|-----------|-------------------|
| **Couleurs** | Le rose magenta, le violet, les surfaces plum, le warm pearl en light |
| **Typographie** | Inter (corps), JetBrains Mono (montants), Compressa (hero TextPressure) |
| **Layout** | sidebar 248px, mobile bottom nav, max-w-7xl, sticky topbar |
| **Densité** | Pages 1000+ LOC, multiples cards, peu de respiration |
| **Motion** | Animations transitions, easeOutExpo, AnimatePresence, CountUp |
| **Effets visuels** | Aurora canvas, pixel-blast, scanlines, grain, glow, halo-spin |
| **Data viz** | Sparklines, donuts, force graph 3D, chroma grid, candle charts |
| **Copywriting** | "advisor-knowledge", "context-bundle", "fine-tuning-readiness", "DEMO_MODE_FORBIDDEN" |
| **Iconographie** | Glyphes ASCII nav (◈ □ ≋) |
| **Textures** | grain, scanlines, grid-dots |
| **Composants** | KpiTile spotlight, Panel rail, PageHeader text-pressure |
| **Tone général** | Cockpit cinéma-SF (Dune, BR2049) vs alternative possible |

### 8.5 Questions à poser à l'utilisateur sur la DA

(Préparation phase suivante — ne pas répondre maintenant)

1. **Couleur** : Le rose magenta est-il pour toi un atout, un irritant, ou neutre ?
2. **Couleur** : Le violet électrique en accent est-il bien dosé ?
3. **Background** : Préfères-tu un fond plus neutre (graphite, charcoal) ou la teinte plum actuelle ?
4. **Light mode** : Utilises-tu light mode régulièrement ou jamais ?
5. **Typographie** : Inter te paraît bien ? Compressa hero te plaît ?
6. **Densité** : Les pages te paraissent surchargées globalement, ou seulement certaines ?
7. **Effets décoratifs** : Le pixel-blast / liquid-ether / aurora-canvas t'apportent quelque chose (signature, plaisir d'usage) ou te paraissent gratuits ?
8. **Motion** : Les transitions de pages te plaisent ? Trop rapides, trop lentes, juste ?
9. **Iconographie** : Les glyphes ASCII (◈ □ ≋) sont une signature unique ou un irritant ?
10. **Tone général** : Le côté cockpit cinéma-SF te correspond ? Préférerais-tu plus minimal/brutaliste, plus éditorial, plus "Bloomberg perso", plus "OS d'écran d'avion", plus "data room luxueuse" ?
11. **Inspirations** : Quelles apps/sites ont la sensation que tu veux ressentir en utilisant Finance-OS ?
12. **Anti-références** : Quelles apps/sites veux-tu éviter absolument ?
13. **Aurora Pink** : garder, faire v2, ou changer totalement ?

---

## 9. Static accessibility baseline

Audit statique uniquement — aucun outil automatisé lancé.

### 9.1 Indicateurs quantitatifs

| Métrique | Compte | Notes |
|----------|--------|-------|
| `aria-*` ou `role=` instances | 217 | Bonne couverture statique |
| `<button>` éléments | 70 | OK |
| `<div onClick>` | 0 | ✅ Aucun anti-pattern divClick détecté |
| `useReducedMotion` / `prefers-reduced-motion` usages | 19 | ✅ Couverture solide |
| `role=` overrides (fichiers) | 11 | À auditer un par un |
| Pages 3D/Canvas sans fallback explicite | ~6 | ⚠ Risque |

### 9.2 Risques détectés (statique)

| # | Problème | Fichiers | Risque | Recommandation | Priorité |
|---|----------|----------|--------|----------------|----------|
| 1 | Pas de fallback WebGL pour knowledge graph | `components/advisor/knowledge-graph-3d.tsx` | Moyen | Ajouter état "graphe non disponible" + alternative table | **P1** |
| 2 | Canvas effets décoratifs sans `aria-label`/`role="presentation"` systématique | `pixel-blast-backdrop.tsx`, `aurora-canvas.tsx`, `aurora-backdrop.tsx` | Faible | Vérifier `aria-hidden` partout | P2 |
| 3 | Tables ad hoc (transactions, positions, sync logs) | divers | Moyen | Standardiser via `DataTable` partagé (à créer) | **P1** |
| 4 | Charts d3/lightweight-charts/force-graph-3d sans `<title>` ou `aria-label` | sparklines, markets-dashboard, knowledge-graph | Moyen | Ajouter description textuelle | P1 |
| 5 | Command palette Cmd+K sans hint visible | `command-palette.tsx` | Faible | Ajouter hint touch + keyboard discovery | P2 |
| 6 | Color contrast `--muted-foreground` sur `--surface-0` | tokens | À mesurer | Audit contrast (outil OKLCH → APCA / WCAG) | **P1** |
| 7 | Modale/Drawer non identifiés (radix absent) | DS | Élevé | Créer wrappers a11y-first (focus trap, escape, aria) | **P1** |
| 8 | Forms TanStack — pattern `aria-describedby` | divers | Moyen | Documenter pattern + créer `Field` composant | **P1** |
| 9 | Reduced motion sur reactbits 3D lourds (`liquid-ether`, `pixel-blast`, `antigravity`) | reactbits | Moyen | Garantir freeze sous prefers-reduced-motion | P1 |
| 10 | Focus indicators sur composants custom | toujours `.focus-glow` défini | Faible | Vérifier presence partout | P2 |
| 11 | Densité info (pages 1000+ LOC) | 6 routes | Moyen | Hiérarchie + landmarks ARIA (`<section aria-labelledby>`) | P1 |
| 12 | Mobile bottom nav focus order | `app-sidebar.tsx` MobileNav | Faible | Tester tab order | P2 |
| 13 | Skip link visible au focus | `routes/__root.tsx` (SR-only) | OK ✅ | — | — |
| 14 | Theme toggle a11y label | `theme-toggle.tsx` | OK ✅ | `aria-label` présent | — |

### 9.3 Limites de cet audit a11y

- Audit **statique uniquement** — `axe-core` ou Lighthouse non lancés.
- Contraste couleur **non mesuré** numériquement — il faut un outil OKLCH ou un test visuel APCA.
- Couverture clavier **non testée** — il faut naviguer réellement.
- Screen reader **non testé**.

Cet audit doit être complété par une passe `axe-core` automatisée (CI) **avant** la refonte design.

---

## 10. Static performance baseline

### 10.1 Routes les plus lourdes (LOC)

| Route | LOC | Composants/imports notables |
|-------|-----|------------------------------|
| `/_app/ia/memoire/graph` | 1860 | Three.js + force-graph-3d + advisor-graph-details-panel (463) |
| `/_app/ia/strategie-investissement` | 1216 | 1 fichier monolithique |
| `/_app/signaux/social` | 1206 | XHealthPanel local + sentiment |
| `/_app/integrations` | 1072 | 3 providers + sync logs |
| `/_app/patrimoine` | 1004 | KPIs + history + allocation |
| `/_app/investissements` | 971 | Positions + 60/30/10 |
| `/_app/` (cockpit) | 689 | ai-advisor-panel (1013) + personal-financial-goals-card (921) + wealth-history (491) + liquid-ether via cockpit-hero |
| `/_app/fiscalite` | 595 | Dossier préparatoire |
| `/_app/ia` (hub) | 559 | Advisor brief |
| `/_app/ia/memoire/index.tsx` | 516 | Knowledge inspection |
| `/_app/ia/chat` | 434 | Chat advisor |
| `/_app/depenses` | 426 | Transactions + budgets |
| `/_app/sante` | 418 | Health + pixel-blast |
| `/_app/ia/trading-lab` | 414 | Backtest + lightweight-charts dynamic |

### 10.2 Composants les plus longs

| Composant | LOC | Type |
|-----------|-----|------|
| `routes/_app/ia/memoire/graph.tsx` | 1860 | Route |
| `components/reactbits/liquid-ether.tsx` | 1254 | WebGL (1 usage) |
| `routes/_app/ia/strategie-investissement.tsx` | 1216 | Route |
| `routes/_app/signaux/social.tsx` | 1206 | Route |
| `routes/_app/integrations.tsx` | 1072 | Route |
| `components/dashboard/ai-advisor-panel.tsx` | 1013 | Composant |
| `routes/_app/patrimoine.tsx` | 1004 | Route |
| `routes/_app/investissements.tsx` | 971 | Route |
| `components/dashboard/personal-financial-goals-card.tsx` | 921 | Composant |
| `components/reactbits/magic-bento.tsx` | 862 | **Mort** |
| `components/advisor/knowledge-graph-3d.tsx` | 755 | WebGL |
| `components/reactbits/pixel-blast.tsx` | 705 | WebGL |
| `routes/_app/index.tsx` | 689 | Route |
| `components/reactbits/staggered-menu.tsx` | 589 | **Mort** |

### 10.3 Imports synchrones à risque (déjà mentionnés §4)

- `liquid-ether` (1254 LOC) sur `/_app/` (cockpit) via `aurora-canvas` via `cockpit-hero` — **static import**
- `pixel-blast` (705 LOC) sur `/login` ET `/_app/sante` — **static import**
- `antigravity` (201 LOC) sur `/_app/objectifs` — **static import**

### 10.4 Composants à lazy-load (recommandation)

- `aurora-canvas.tsx` (et donc `liquid-ether`) — lazy sur `/_app/`
- `pixel-blast-backdrop.tsx` (et donc `pixel-blast`) — lazy sur `/login`, retirer de `/sante` (ou lazy)
- `routes/_app/objectifs.tsx` import de `antigravity` — lazy
- `ai-advisor-panel.tsx` (1013 LOC) — découper en sous-composants + lazy fragments si applicable
- `personal-financial-goals-card.tsx` (921 LOC) — découper

### 10.5 Risques Core Web Vitals

| Métrique | Risque | Source | Mitigation |
|----------|--------|--------|-----------|
| **LCP** | Élevé sur `/_app/` (liquid-ether WebGL initial) | Static import | Lazy + placeholder léger |
| **LCP** | Moyen sur `/login` (pixel-blast WebGL) | Static import | Skeleton brand |
| **INP** | Moyen sur knowledge graph 3D | Three.js + force-graph | Throttle interactions + reduced-motion mode |
| **INP** | Moyen sur grandes tables (transactions, positions) | Pas de virtualization | Ajouter TanStack Virtual |
| **CLS** | Faible globalement (motion respecte layoutId) | Layout shifts si data lazy | Skeletons à dimensions fixes |
| **Hydration** | Faible (TanStack Start prefetch) | guards `typeof window` | OK |
| **Bundle initial** | À mesurer | Pas de bundle analyzer lancé ici | Phase 0 bis : `pnpm -F web build && analyzer` |

### 10.6 Scripts bundle analyzer existants

Vérifié : pas de script `bundle-analyzer` ou équivalent évident dans `apps/web/package.json`. À créer si besoin (`vite-bundle-visualizer` ou `rollup-plugin-visualizer`).

### 10.7 Animations bloquantes ?

- 30 fichiers importent `motion` (Framer Motion v3)
- 19 fichiers respectent `useReducedMotion` / `prefers-reduced-motion`
- Ratio : couverture solide (≥ 60% des composants animés)
- ⚠ À vérifier : reactbits 3D (`liquid-ether`, `pixel-blast`, `antigravity`) — `useReducedMotion` présent côté `aurora-canvas.tsx` et `pixel-blast-backdrop.tsx`, donc déjà couvert au niveau wrapper

### 10.8 Limites de cet audit perf

- **Aucun build lancé**, **aucun Lighthouse** mesuré.
- Estimations bundle basées sur poids connus des libs (three, force-graph-3d, etc.).
- Risque réel doit être confirmé par mesures (phase 0 bis).

---

## 11. Information architecture baseline

Matrice page-par-page pour 20 pages prioritaires. Chaque ligne prépare les questions à poser à l'utilisateur (§12).

### 11.1 Matrice IA actuelle (extrait)

| Page | Intention principale | Intentions secondaires | Signaux surcharge | Trop technique | Essentiel | À drilldown | À admin/debug | Questions user-feedback |
|------|----------------------|------------------------|-------------------|----------------|-----------|-------------|---------------|--------------------------|
| `/_app/` (cockpit) | Synthèse quotidienne | Brief advisor, attentions, KPIs, history | 689 LOC, ai-advisor-panel 1013, personal-goals 921, wealth-history 491, ~10 cards | "advisor digéré" hiérarchie | KPIs + 1 attention + 1 brief | Détails advisor, news complète | — | Quel est le 1er regard ? Quels indicateurs sont essentiels au quotidien ? |
| `/_app/depenses` | Voir où va l'argent du mois | Budgets, projections, catégories | 426 LOC, multiples cards | budgets vs transactions vs projection mélangés | Total mois + sparkline + top dépenses | Détail catégorie, history | — | Vue mois ou vue catégorie en premier ? |
| `/_app/patrimoine` | Vue consolidée actifs | Allocation, history, connexions, EI résumé | 1004 LOC, tabs absents | "external investments summary" technique | Net worth + allocation actifs | History détaillée, par compte | — | Voir un total ou un graphe d'évolution en premier ? |
| `/_app/investissements` | Portefeuille | Positions, 60/30/10, recommandations | 971 LOC + double avec `/ia/strategie` | "external investments positions" | Allocation cible vs réelle, P&L | Détail par position, history | — | Voir positions ou allocation 60/30/10 en premier ? Différence avec /ia/strategie ? |
| `/_app/integrations` | Connecter / surveiller providers | Status Powens + IBKR + Binance, sync logs, audit | 1072 LOC, 3 providers mélangés | sync logs avec codes erreur, audit trail | État connexion + dernière sync | Sync logs, audit trail (admin) | Diagnostics, audit | Page par provider ou hub ? |
| `/_app/ia` | Hub Advisor | Synthèse, recos, hypothèses, questions, journal | 559 LOC, 6 zones | "advisor-knowledge", "context-bundle" | Action recommandée + pourquoi + sources | Hypothèses, journal | Eval scorecard | Quelles 6 zones sont utiles ? |
| `/_app/ia/chat` | Conversation Advisor | Garde-fous, suggestions | 434 LOC | Mention "knowledge topics" | Input + historique | Topics | — | Liberté totale ou starters guidés ? |
| `/_app/ia/strategie-investissement` | Plan d'action 60/30/10 | Action principale, scorecard, hypothèses, qualité données, PEA/IBKR/Binance | **1216 LOC monolithe** | "fine-tuning-readiness", "qualité données" | Action principale + allocation drift | Scorecard IA, hypothèses | Trends éval | Tabs ou stepper ? Frontière avec /investissements ? |
| `/_app/ia/memoire` | Inspection mémoire | Provenance, confiance, contexte | 516 LOC | "knowledge schema", "stats", "context-bundle" | "Ce que sait l'Advisor" en français | Provenance détaillée, schema | Backend availability | Vulgariser le concept "mémoire" ? |
| `/_app/ia/memoire/graph` | Carte 3D mémoire | Concepts, signaux, relations, contradictions | 1860 LOC + Three.js | Tout est expert | Vue concept central + relations | Lenses, traversal | Pin path, performance preset | Garder 3D ? Ajouter vue tableau ? |
| `/_app/signaux` | Hub signaux | Résumé pour Advisor | 261 LOC | Concept "signal" abstrait | Aperçu + nombre par type | Détail par source | — | Signaux = jargon ? renommer ? |
| `/_app/signaux/marches` | Panorama marchés | Macro, watchlist, top movers | 114 LOC route + markets-dashboard 680 | Lightweight-charts dense | Indices key + watchlist perso | Macro complète | — | Watchlist personnalisable ? |
| `/_app/signaux/social` | Sentiment social | Sentiment, sources X/Bluesky, comptes suivis, lookup, dedupe | **1206 LOC** | dedupe, sync J-1, X/Twitter health | Top tendances + sentiment global | Comptes suivis, dedupe | XHealthPanel | Garder un cockpit social aussi gros ? |
| `/_app/signaux/sources` | Santé providers data | Fraîcheur, qualité | 160 LOC, admin-only | "provider capabilities" | État global + alertes | Détail par source | Tous diagnostics | Page utile ? Ou drawer ? |
| `/_app/signaux/free-firehose` | Fetch manuel signaux | GDELT, HN, SEC, FRED, ECB | 260 LOC, admin-only | Tous les noms techniques | Boutons fetch + status | Logs | Tout | Conserver ou cacher complètement ? |
| `/_app/sante` | Santé système | Pipelines, alertes, qualité | 418 LOC + pixel-blast | "data quality" + "pipelines" | État global + alertes actives | Détail par pipeline | Tout debug | Pixel-blast voulu ici ? |
| `/_app/fiscalite` | Dossier fiscal préparatoire | Comptes, formulaires, manquants | 595 LOC | "Formulaires 3916/3916-bis/2086/2074/PEA" | Comptes à vérifier | Manquants, exports | — | Présentation fiscaliste ou user ? |
| `/_app/objectifs` | Suivi objectifs | Progression, antigravity decorative | 210 LOC + antigravity 201 | "antigravity" déco | Progression objectif + ETA | History | — | Antigravity utile/voulu ? |
| `/_app/orchestration` | Jobs / CTA policy | Daily Intelligence Run, relances | 445 LOC, admin-only | "CTA policy" | État jobs + dernière exécution | Détails jobs | Tout | Renommer "Automatisations" ? |
| `/_app/parametres` | Préférences | Push notifications, exports, config | 262 LOC + folder reactbit | "derived recompute" | Toggle notifs + exports | Detail config | Recompute | Folder reactbit utile ? |

### 11.2 Pages à NE PAS modifier en priorité (low risk)

- `/health`, `/healthz`, `/version`, `/transactions` — endpoints utility
- `/_app/marches`, `/_app/memoire`, `/_app/actualites`, `/_app/signaux/x-twitter` — stubs 301
- `/powens/callback` — OAuth, ne pas casser

### 11.3 Pages critiques pour la refonte

(Ordre de priorité utilisateur recommandé, à valider avec lui)

1. `/_app/` (cockpit) — point d'entrée
2. `/_app/ia/strategie-investissement` (1216 LOC monolithe)
3. `/_app/ia/memoire/graph` (1860 LOC + WebGL)
4. `/_app/patrimoine` (1004 LOC)
5. `/_app/investissements` (971 LOC + frontière avec /ia/strategie)
6. `/_app/integrations` (1072 LOC, multi-provider)
7. `/_app/signaux/social` (1206 LOC, jargon)
8. `/_app/depenses` (426 LOC, page quotidienne)
9. `/_app/ia` (hub Advisor)
10. `/_app/ia/chat` (UX conversation)

---

## 12. Screen-by-screen user feedback preparation

### 12.1 Template de feedback écran

L'utilisateur doit remplir un bloc par page prioritaire, dans cet ordre :

```md
## [PAGE] Nom de la page / route

### 1. Ce qui ne me convient pas
- ...

### 2. Ce que je veux supprimer
- ...

### 3. Ce que je veux garder
- ...

### 4. Ce que je veux rendre plus visible
- ...

### 5. Ce que je veux cacher ou déplacer en drilldown
- ...

### 6. Ce que je veux ajouter
- ...

### 7. Ce qui est trop technique / mal nommé
- ...

### 8. Ce qui manque d'émotion / de style / de finition
- ...

### 9. Inspirations associées
- ...

### 10. Priorité
- P0 / P1 / P2 / P3

### 11. Notes accessibilité / responsive / performance
- ...
```

### 12.2 Pages à faire remplir en priorité

Ordre recommandé — du plus impactant pour la perception produit, au plus secondaire :

| # | Route | Pourquoi cet ordre |
|---|-------|---------------------|
| 1 | `/_app/` (cockpit) | Premier écran après login, perception générale |
| 2 | `/_app/depenses` | Usage quotidien tracking dépenses |
| 3 | `/_app/patrimoine` | Vue d'ensemble fortune |
| 4 | `/_app/investissements` | Cœur produit investissement |
| 5 | `/_app/ia/strategie-investissement` | Plan d'action — frontière à clarifier avec #4 |
| 6 | `/_app/ia` (hub) | Première impression Advisor |
| 7 | `/_app/ia/chat` | Interaction directe |
| 8 | `/_app/ia/memoire` | Compréhension de la mémoire IA |
| 9 | `/_app/ia/memoire/graph` | Carte 3D — décision conservation/refonte |
| 10 | `/_app/integrations` | Page admin la plus exposée |
| 11 | `/_app/signaux` (hub) | Concept "signaux" — vulgarisation |
| 12 | `/_app/signaux/marches` | Présentation marchés |
| 13 | `/_app/signaux/social` | Plus dense de la section signaux |
| 14 | `/_app/sante` | Santé système — usage réel ? |
| 15 | `/_app/fiscalite` | Posture produit fiscaliste |
| 16 | `/_app/objectifs` | Page secondaire, antigravity à décider |
| 17 | `/_app/orchestration` | Page admin — utilité ? |
| 18 | `/_app/parametres` | Settings — peu prioritaire |
| 19 | `/login` | Présentation entrée, signature visuelle |
| 20 | `/_app/ia/trading-lab`, `/_app/signaux/sources`, `/_app/signaux/free-firehose`, `/_app/ops-env-diagnostics`, `/_app/ia/couts` | Pages admin/debug — décision séparée |

### 12.3 Conseils à l'utilisateur pendant le remplissage

(Suggestions de prompt pour l'utilisateur, à inclure dans le brief envoyé à ChatGPT plus tard)

- Captures d'écran utiles : dark mode + mobile si possible
- Annotations bienvenues (zones entourées + flèches)
- Citer les libellés précis qui irritent
- Distinguer "esthétique" vs "fonctionnel" vs "info trop dense"
- Pas besoin d'être designer — décrire en mots simples ("ce bouton est trop fort", "cette colonne sert à rien", "je voudrais voir X en premier")

---

## 13. Future art direction preparation

### 13.1 Axes DA possibles (non décidés)

| Axe | Ce qu'il changerait | Ce qu'il préserverait | Risques | Compatibilité Finance-OS |
|-----|---------------------|------------------------|---------|--------------------------|
| **A. Aurora Pink v2 (mature)** | Tokens couleur affinés (peut-être moins de magenta), surfaces plus chaudes, motion plus calme, retrait des effets WebGL gratuits, copywriting vulgarisé | Identité rose/violet, surfaces plum, Inter + JetBrains Mono, glyphes ASCII, sémantique finance | Faible (évolution) | **Excellente** — pas de refacto massif |
| **B. Finance cockpit premium sombre** | Plus minimal, plus dense, palette graphite/charcoal + 1 accent froid (sapphire, cyan), motion réduit, typo serif éditoriale optionnelle | DS architecture, surfaces canoniques | Moyen (changement palette globale) | Bonne — tokens à remapper |
| **C. OS financier minimal très lisible** | Palette monochrome + 2 accents semantic (positive/negative), suppression de tous effets décoratifs, typo grotesque type Söhne / Inter / GT America, focus densité info, micro-typographie | Sémantique finance, structure produit | Moyen — perte signature | Très bonne — moins de WebGL, plus de stabilité |
| **D. Interface IA futuriste mais sobre** | Couleurs froides (cyan, ultraviolet), backgrounds verre profond, focus halos accent, type techno (Mona Sans, NB Architekt, JetBrains), grilles asymétriques | Sémantique finance, DS | Moyen | Bonne mais Advisor doit rester rassurant |
| **E. Data room / Bloomberg personnel** | Densité maximale, multi-colonnes, palette neutre + 4-6 accents data (status), typo lecture haute, mode "wall of data" | Structure produit | Élevé (changement densité) | Convient à un usage expert quotidien |
| **F. Direction radicale créative** | Inspirée des références utilisateur (Linear, Vercel, Things 3, Stripe, Mercury, etc. — à découvrir) | À définir | Élevé (refonte profonde) | À évaluer |

### 13.2 Composants à conserver dans toutes les directions

Indépendamment de l'axe DA choisi, ces éléments **doivent** être conservés (invariants produit) :

- **Sémantique finance dissociée du brand** (positive=emerald, negative=coral, warning=amber)
- **Typographie tabulaire pour montants** (`.font-financial` avec `tnum`, `zero`)
- **Architecture 3 groupes nav** (cockpit / ia / expert) — sauf décision contraire utilisateur
- **Dark + Light modes** — obligatoire
- **Mobile bottom nav** — obligatoire
- **Demo / Admin badges** — obligatoire
- **prefers-reduced-motion respect** — obligatoire
- **Skip link + landmarks ARIA** — obligatoire

### 13.3 Composants à interroger selon l'axe

| Élément | Aurora Pink v2 | Cockpit Premium | Minimal | IA Futuriste | Data Room | Radical |
|---------|-----------------|-----------------|---------|--------------|-----------|---------|
| `liquid-ether` (1254 LOC WebGL) | Garder | Supprimer | Supprimer | Garder différent | Supprimer | Selon |
| `pixel-blast` sur `/login` | Garder | Garder | Supprimer | Garder | Supprimer | Selon |
| `pixel-blast` sur `/sante` | À interroger | Supprimer | Supprimer | Supprimer | Supprimer | Selon |
| `text-pressure` hero | Garder | Alléger | Supprimer | Garder différent | Supprimer | Selon |
| Glyphes ASCII nav | Garder | Garder | Conserver minimaliste | Remplacer par icons techno | Conserver | Selon |
| Aurora gradients triad | Garder | Repalette | Supprimer | Repalette froid | Supprimer | Selon |
| Texture scanlines / grain | Garder | Garder discret | Supprimer | Garder différent | Supprimer | Selon |
| `antigravity` `/objectifs` | À interroger | Supprimer | Supprimer | Garder | Supprimer | Selon |

### 13.4 Questions DA à poser à l'utilisateur

(Préparation phase suivante — ne pas répondre maintenant)

1. **Premier ressenti** : quand tu ouvres Finance-OS, qu'est-ce qui te déplaît le plus visuellement ?
2. **Couleur principale** : le rose magenta brand t'apporte-t-il quelque chose ou tu préférerais autre chose ?
3. **Densité** : Finance-OS doit-il rester "cockpit dense" ou évoluer vers plus minimal/respirant ?
4. **Effets décoratifs** : aimes-tu les effets WebGL (liquid-ether, pixel-blast) ou tu trouves ça gratuit ?
5. **Typographie hero** : le TextPressure variable-font sur cockpit te plaît ou ça t'agace ?
6. **Iconographie** : les glyphes ASCII (◈ □ ≋) sont une signature ou un irritant ?
7. **Tone** : préfères-tu un tone luxe/cinéma-SF, brutaliste, éditorial, techno, ou neutre pro ?
8. **Inspirations positives** : quelles apps as-tu en tête comme "j'aimerais que ça donne ça" ?
9. **Anti-inspirations** : quelles apps tu détestes visuellement et veux absolument éviter ?
10. **Identité forte ou neutre** : tu veux que Finance-OS ait "une voix visuelle" reconnaissable, ou tu préfères un outil qui s'efface devant les données ?
11. **Investissement émotionnel** : un produit utilitaire fonctionnel suffit, ou tu veux du "plaisir d'usage" (animations, sensations, signature) ?
12. **Pivot prêt** : es-tu prêt à un refacto profond (1-2 mois) ou tu préfères des passes progressives ?

---

## 14. Skills to fix or create

### 14.1 Skills à corriger immédiatement

| Skill | Fichier source | Problème | Action recommandée |
|-------|----------------|----------|---------------------|
| `finance-os-ui-cockpit` | `.agentic/source/skills/finance-os/ui-cockpit/SKILL.md` | Palette amber/gold `oklch(0.78 0.155 75)` + navy-slate `oklch(0.13 0.015 260)` divergente de DESIGN.md Aurora Pink (rose `oklch(0.72 0.19 355)` + plum `oklch(0.12 0.02 325)`). Description "amber/gold accent" obsolète | Réécrire palette + bgs + accent. Puis `pnpm agent:skills:sync` |

### 14.2 Skills à créer pour la refonte

| Skill | Objectif | Pourquoi manquant | Docs sources | Contenu `SKILL.md` attendu |
|-------|----------|---------------------|--------------|------------------------------|
| `data-visualization-finance` | Encoder règles charts/tables Finance-OS | Pas de standard documenté ; 3 libs charts cohabitent (d3, lightweight-charts, force-graph-3d) | `DESIGN.md` + §12 audit + `docs/frontend/design-system.md` | Quand utiliser chaque lib, palette charts officielle, règles densité, accessibilité charts, alternatives table/3D, format fraîcheur/confidence/sources |
| `ai-advisor-ux` | Encoder UX patterns Advisor (recommendations, hypothèses, sources, confidence, journal) | Page advisor monolithique sans standard | `docs/frontend/information-architecture.md` (zone 1-6) + AGENTS.md (invariants) | Pattern recommendation card, "Pourquoi maintenant ?", confidence affichage, sources tooltip, limitations explicites, séparation memoire/graph/chat |
| `admin-debug-ux-separation` | Encoder règle de séparation user / admin / debug | Mélange actuel dans plusieurs pages | `nav-items.ts` + audit | Quand cacher derrière drawer admin, quand garder visible, quand renommer, libellés à vulgariser, banner mode |
| `dashboard-information-architecture` | Patterns IA pour pages dashboard finance | Pas de standard ; 6 pages dépassent 1000 LOC | `docs/frontend/information-architecture.md` + §11 audit | Hiérarchie KPI > attention > brief > détail, progressive disclosure, tabs vs sections, drilldown, max-w-7xl, density rules |
| `accessibility-reviewer` | Audit WCAG par composant + tokens contrast | Pas de checklist détaillée | `globals.css` + composants + WCAG 2.2 | Checklist par composant (DataTable, Field, Dialog, Chart, KPI), tokens contrast minimums, patterns ARIA, reduced-motion |
| `financial-product-ux` | Patterns UX spécifiques finance perso (montants, allocation, drift, decision-making) | Pas de skill couvrant ce domaine | DESIGN.md + finance-engine + experience produit | Affichage montant grand/petit, P&L colorisation, allocation drift visualisation, fraîcheur prix, paper trading badge, fiscalité préparatoire |

### 14.3 Skills à vérifier (non corriger)

| Skill | Action |
|-------|--------|
| `finance-os-core-invariants` | À relire et confirmer si toujours aligné AGENTS.md actuel `à confirmer` |
| `finance-os-web-ssr-auth` | À relire — pas vérifié ici |
| `finance-os-observability-failsoft` | À relire — utile pour fail-soft UI states |
| Impeccable 33 skills | Inventaire OK selon audit initial. Pas d'action requise |
| GitNexus 6 skills | Inventaire OK |

### 14.4 Recommandation

Créer les skills **après** que l'utilisateur ait validé son axe DA, pour que les contenus soient cohérents avec la direction choisie. Sauf `finance-os-ui-cockpit` correction palette, à faire avant tout travail design.

---

## 15. Phase 0 quick wins

Liste des quick wins identifiés. **Aucun n'est appliqué à cette phase.** Cette section sert de base pour la planification.

| # | Quick win | Impact | Risque | Fichiers | Phase reco | Validation user requise ? |
|---|-----------|--------|--------|----------|------------|---------------------------|
| 1 | Resync `finance-os-ui-cockpit` SKILL.md → Aurora Pink | Élevé (évite agents Claude/Codex induits en erreur) | Faible | `.agentic/source/skills/finance-os/ui-cockpit/SKILL.md` + `pnpm agent:skills:sync` | Phase 0 bis | **Non** (correction documentaire) |
| 2 | Suppression candidate reactbits morts (8 fichiers, ~2865 LOC) | Bundle + maintenance | Faible (aucun import) | `dock.tsx`, `glass-surface.tsx`, `magic-bento.tsx`, `pixel-trail.tsx`, `pixel-transition.tsx`, `shape-blur.tsx`, `staggered-menu.tsx`, `variable-proximity.tsx` | Phase 2 | **Oui** (user peut vouloir les conserver pour usage futur) |
| 3 | Suppression candidate dashboard morts (7 fichiers, ~370 LOC) | Maintenance | Faible | `dashboard/topbar.tsx`, `dashboard/sidebar-nav.tsx`, `portfolio-summary.tsx`, `metric-card.tsx`, `expenses-list.tsx`, `dashboard-health-panel.tsx`, `api-status-card.tsx` | Phase 2 | **Oui** |
| 4 | Suppression candidate `aurora-backdrop.tsx` (60 LOC, importe aurora-shape mais lui-même non importé) | Maintenance | Faible | `components/brand/aurora-backdrop.tsx` | Phase 2 | **Oui** |
| 5 | Lazy-load `aurora-canvas` (et `liquid-ether` 1254 LOC) sur `/_app/` | LCP cockpit | Moyen (placeholder à designer) | `components/brand/aurora-canvas.tsx`, `components/surfaces/cockpit-hero.tsx` | Phase 3 | **Oui** (décision conservation effet) |
| 6 | Lazy-load `pixel-blast-backdrop` sur `/_app/sante` | LCP sante | Faible | `routes/_app/sante.tsx` | Phase 3 | **Oui** (présence sante voulue ?) |
| 7 | Lazy-load `antigravity` sur `/_app/objectifs` | LCP objectifs | Faible | `routes/_app/objectifs.tsx` | Phase 3 | **Oui** |
| 8 | Remonter `Panel`, `PageHeader`, `KpiTile`, `StatusDot` dans `packages/ui` | Réutilisabilité | Moyen (multi-imports) | `surfaces/*` + `packages/ui/src/components/surfaces/` | Phase 1 | Non (décision technique) |
| 9 | Créer wrappers `Dialog`, `Drawer`, `Tabs`, `Tooltip` dans `packages/ui` (lib à choisir) | DS | Moyen | `packages/ui/src/components/ui/` | Phase 1 | **Oui** (choix lib : Radix conservé ? remplacé ?) |
| 10 | Auditer `radix-ui` dans `package.json` — supprimer si vraiment 0 usage | Bundle (~30 KB) | Faible | `apps/web/package.json` | Phase 0 bis | **Non** (technique) |
| 11 | Renommer libellés techniques (cf. §6 audit initial : "advisor-knowledge", "context-bundle", "fine-tuning-readiness", "DEMO_MODE_FORBIDDEN" → user-friendly) | UX clarté | Faible | divers composants + routes | Phase 7 | **Oui** (libellés exacts) |
| 12 | Standardiser `animate-pulse` → `animate-shimmer` partout | DS cohérence | Faible | divers | Phase 1 | Non |
| 13 | Audit clés `oklch()` inline → tokens CSS variables | DS cohérence | Faible-moyen | 20 fichiers (cf. §7.3) | Phase 1 | Non |
| 14 | Décider si stubs 301 (`/marches`, `/memoire`, `/actualites`, `/signaux/x-twitter`) peuvent être retirés (plus de bookmarks) | Code propreté | Faible | `routes/_app/marches.tsx`, `memoire.tsx`, `actualites.tsx`, `signaux/x-twitter.tsx` | Phase 2 | **Oui** |
| 15 | Découper `ai-advisor-panel.tsx` (1013 LOC) en sous-composants | Maintenance + lazy | Élevé (composant central) | `components/dashboard/ai-advisor-panel.tsx` | Phase 6 (refonte Advisor) | **Oui** (refonte UX) |
| 16 | Découper `personal-financial-goals-card.tsx` (921 LOC) | Maintenance | Élevé | `components/dashboard/personal-financial-goals-card.tsx` | Phase 4 (refonte cockpit) | **Oui** |
| 17 | Documenter palette charts officielle (`--chart-1..7`) | DS data viz | Faible | `DESIGN.md` + `docs/frontend/design-system.md` | Phase 1 | Non |
| 18 | Créer skills manquants (cf. §14.2) | Tooling | Faible | `.agentic/source/skills/` | Phase 0 bis | Non |

---

## 16. Recommended next steps

Cette phase 0 prépare. Elle ne remplace **pas** la phase de feedback utilisateur. Enchaînement recommandé :

1. **Lecture par utilisateur** de ce rapport + du rapport d'audit initial.
2. **Envoi à ChatGPT (ou autre LLM consolidateur)** pour intégration dans le Master Brief produit.
3. **Phase 0 bis (technique uniquement)** : actions sans impact UX
   - Resync skill `finance-os-ui-cockpit` (palette)
   - Audit `radix-ui` dans `package.json`
   - Mesure baseline Lighthouse + bundle analyzer
   - Création des skills manquants
4. **Phase de feedback utilisateur écran par écran** (cf. §12 template) — l'utilisateur remplit page par page selon l'ordre recommandé.
5. **Consolidation des retours utilisateur** dans un document `UI_UX_DECISIONS.md` (à créer).
6. **Phase inspirations DA** : utilisateur envoie ses références (apps, sites, moodboards) + anti-références.
7. **Définition de 2-3 directions artistiques** à partir des retours + inspirations (cf. §13.1 axes).
8. **Prompt Claude Design / Stitch** pour génération maquettes des directions sélectionnées sur les pages prioritaires (cf. §12.2).
9. **Sélection de la direction finale** par l'utilisateur.
10. **Phase implémentation progressive** (cf. stratégie audit initial §18 — 10 phases) :
    - Phase 0bis : tokens + DS + cleanup
    - Phase 1 : composants partagés
    - Phase 2-N : refonte page par page selon ordre priorité

**Important** :
- Aucune modification UI ne doit commencer avant que l'utilisateur ait validé la direction.
- Le rapport audit + ce phase 0 + les feedbacks utilisateur = entrée du prompt design.
- Le `finance-os-ui-cockpit` SKILL.md doit être corrigé avant tout travail Claude/Codex sur l'UI.

---

## 17. Appendix: commands used, files inspected, limits

### 17.1 Commandes utilisées (lecture seule)

```bash
pwd, ls, find, wc -l, cat (limité), grep -r --include='*.ts' --include='*.tsx'
```

Quelques exemples concrets exécutés :
- `find apps/web/src/routes -type f -name "*.tsx" | xargs wc -l | sort -rn`
- `wc -l components/{dashboard,advisor,trading-lab,reactbits,surfaces,brand}/*.tsx`
- `grep -rn "from ['\"]gsap" .`
- `grep -rl "reactbits/<name>" .` pour chaque composant reactbits
- `grep -rl "dashboard/topbar" .`
- `grep -rln "use client" apps/web/src`
- `grep -rl "radix-ui" .` (résultat 0)
- `grep -rln "from ['\"]three" / "lightweight-charts" / "@react-three" / "postprocessing" / "cmdk" .`
- `grep -rn "import(" .` (pour dynamic imports)
- `grep -rln "prefers-reduced-motion\|useReducedMotion" .` → 19 fichiers
- `grep -rn "aria-label\|aria-hidden\|role=" . | wc -l` → 217
- `grep -rn "<button" . | wc -l` → 70
- `grep -rn '<div [^>]*onClick' . | wc -l` → 0
- Lecture intégrale : `nav-items.ts` (251 LOC), `_app.tsx` (59 LOC), `vite.config.ts`, `globals.css` (extraits), `finance-os-ui-cockpit/SKILL.md` (extraits)

Aucune commande destructive, aucun build, aucun test, aucun commit.

### 17.2 Fichiers inspectés (sélection)

- `apps/web/src/routes/__root.tsx`, `_app.tsx`, et les 33 sous-routes (mesurées)
- `apps/web/src/components/shell/{app-sidebar.tsx, topbar.tsx, command-palette.tsx, theme-toggle.tsx, nav-items.ts}` (nav-items.ts lu intégralement)
- `apps/web/src/components/{surfaces,brand,reactbits,dashboard,advisor,markets,trading-lab,personal,ui}/*.tsx` (LOC mesurés, imports tracés)
- `apps/web/vite.config.ts` (React Compiler vérifié actif)
- `apps/web/package.json` (deps listées dans audit initial)
- `packages/ui/src/styles/globals.css` (489 LOC, 125 `oklch()`)
- `.agentic/source/skills/finance-os/ui-cockpit/SKILL.md` (extrait palette obsolète)
- `DESIGN.md` (palette canonique Aurora Pink)
- `FINANCE_OS_UI_UX_REPO_AUDIT.md` (rapport initial)

### 17.3 Limites de cette phase 0

- **Aucune mesure perf réelle** (Lighthouse, bundle analyzer) — à faire en phase 0 bis.
- **Aucun test a11y automatique** (axe-core, Lighthouse) — à faire en phase 0 bis.
- **Pas d'inspection backend détaillée** — limitée à ce qui est utile à la refonte UI/UX.
- **Inspection complète des `oklch()` inline non finalisée** — 20 fichiers listés, contenu non audité ligne par ligne.
- **Pas de test responsive sur device** — vérification statique uniquement.
- **`DEMO_DATASET_STRATEGY` v1/v2** : non vérifié dans le code.
- **`radix-ui` dans `node_modules`** : non vérifié si réellement chargé via deps indirectes (cmdk peut l'embarquer `à confirmer`).
- **Audit Python knowledge-service + quant-service** : hors scope phase 0.
- **Tests E2E Playwright** : non lancés.
- **Smoke scripts** : non lancés.

### 17.4 Méthode

Phase 0 réalisée par Claude (Opus 4.7, 1M context), en lecture seule, en cinq passes :
1. Lecture rapide du rapport initial pour identifier les `à confirmer`.
2. Greps ciblés pour lever les incertitudes (GSAP, dashboard mort, reactbits, radix, react compiler).
3. Vérifications LOC précises via `wc -l` sur fichiers clés.
4. Lecture intégrale de `nav-items.ts`, `_app.tsx`, `vite.config.ts`, et extraits `globals.css`/`finance-os-ui-cockpit/SKILL.md`.
5. Synthèse en 17 sections + template feedback utilisateur.

Aucun fichier applicatif modifié. Aucun commit. Aucune commande destructive.

---

**Fin du rapport.**

> Ce document doit être lu avec [`FINANCE_OS_UI_UX_REPO_AUDIT.md`](./FINANCE_OS_UI_UX_REPO_AUDIT.md). Il est conçu pour être envoyé à ChatGPT/Claude Design/Stitch comme entrée structurée avant la phase de feedback utilisateur écran par écran.
