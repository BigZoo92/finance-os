# FINANCE-OS — COMMAND PIXEL V1 IMPLEMENTATION AUDIT (UI-0)

Read-only audit of the working tree as of 2026-08-12. The tree was already mid-migration (51 vendored pixel icons in `packages/ui/src/icons/` and ~30 modified files uncommitted).

# EXECUTIVE SUMMARY

1. **The palette rotation is cheap; the current direction is rose-magenta/violet, hue-level different from Soft Orange Cream.** Token discipline is strong: ~85% of the color surface flips by editing `:root`/`.dark` in `packages/ui/src/styles/globals.css` alone. The remaining 15% (purple/aurora gradients, ~200 raw Tailwind palette classes in 22 files, JS-driven chart/3D colors) is per-component work concentrated in ~8 files.
2. **Geist does not exist anywhere in the repo** — no package, no font files, only documentation. Acquiring Geist Sans/Mono (and verifying Geist Pixel availability/licensing) is an unlisted hard prerequisite for Phase 01.
3. **The shell fundamentally conflicts with the canonical design**: a permanent desktop sidebar (`apps/web/src/components/shell/app-sidebar.tsx`) must be REPLACED by the floating 1240px navbar; `NavDropdown`, `NavIconTile`, `UserMenu` are MISSING entirely; the nav registry pattern (`apps/web/src/components/shell/nav-items.ts`) is a REFACTOR, not a rewrite.
4. **Route topology is already ~90% canonical.** All legacy routes are pure 301 redirect stubs (no duplicate implementations). The gaps: no `/radar` (signaux+marches must converge), Radar-area routes are wrongly admin-gated, Coûts lives under `/ia/`, and Trading Lab / Plan d'action pollute the IA group.
5. **The approved Advisor already has its backing data model — on the wrong page.** `advisor_action_plan_item` (rendered on `/ia/strategie-investissement`) answers what/how much/where/risk/action, and `core`/`growth`/`asymmetric` = Socle/Croissance/Opportuniste. `/ia` renders a weaker `ai_recommendation` model with none of those fields. "When" has no data anywhere; **Flash has zero backend support**; the Investment Profile write endpoint exists server-side with no client function.
6. **The canonical unknown-aware valuation block is fetched but never rendered.** `DashboardSummaryValuation` (`totalValueBase: number|null`, coverage, status counts) is produced by the API; every headline total instead uses the documented-legacy naive cross-currency sum. Fixing this is presentation-only and the highest-value financial-honesty win.
7. **~15 HIGH-severity "unknown rendered as zero" violations** concentrate on Investissements, Cockpit, Patrimoine, Coûts, and Advisor KPIs — exactly the pages that also have zero `isError` branches. The correct patterns already exist in-repo (`'Valeur inconnue'` at `patrimoine.tsx:613`, quality badges at `investissements.tsx:404`, `DataSourceBadge`).
8. **Admin-mode API failures silently return demo fixtures** labelled as fresh (`apps/web/src/features/dashboard-api.ts:132-152` and siblings), making most error/stale states unreachable — a product decision is needed before "stale/degraded" design states can be honest.
9. **Mémoire's index page is an infrastructure console** (Neo4j, Qdrant, BM25, retrieval-mode switch, schema version, token counts — 15 distinct leaks) and the 3D graph leaks raw entity IDs in tooltips/URL. The graph stack itself (react-force-graph-3d, lenses, tours, pins — all unit-tested) is a KEEP.
10. **Controls are missing, not competing**: no Tooltip, Popover, Modal, Drawer, Select, or accessible SegmentedControl exists (radix is installed and nearly unused); no `Amount`/`PercentChange`/`Progress`/`ValuationState` components (5+ duplicate currency formatters, 8 inaccessible hand-rolled progress bars, 6 hand-rolled tables with zero shared code).
11. **Copy debt is real but mechanical**: ~139 middle dots + ~84 em dashes + 7 semicolons in user-facing strings, driven by two idioms (`A · B` separators, `·` fake bullets) plus ~34 verbose subtitles and roadmap-narration blocks; nav labels are unaccented ASCII vs canonical accented French.
12. **React Bits/PixelBlast is fully quarantined and cheaply removable**: one vendored file, one wrapper, one consumer (`/login`). Removal cascades to dropping `postprocessing`; `gsap`, `@tanstack/react-table`, `react-form`, `react-db`, `match-sorter-utils` are already dead deps.
13. **The icon system is already migrated and governed** by the `finance-os-icon-system` skill (vendored Pixel Icons tier-1, Phosphor `dist/csr` fallback, CC BY 4.0 attribution in `docs/third-party-notices.md`) — no icon migration belongs in this redesign.
14. **Theming needs a real rewrite**: `<html className="dark">` is hardcoded server-side, theme applies post-hydration from localStorage (FOUC for light users), the `.light` class is dead CSS, no system-preference support — and the current light palette is pink-tinted, not warm cream.
15. **Test baseline is thin where the redesign lands**: 50 vitest files cover view-model logic well, but there is 1 DOM test, 1 e2e smoke (which asserts sidebar strings like "cockpit"), zero coverage of shell, formatting, states, or theme. GitNexus is 140 commits stale and must be refreshed (`pnpm gitnexus:analyze`) before UI-1.

# CURRENT FRONTEND ARCHITECTURE

**Monorepo**: pnpm workspace, no turbo/nx. Apps: `web` (the product, TanStack Start), `api`, `worker`, `desktop` (Tauri), `knowledge-service`, `quant-service`. Packages: `ui` (tokens + 6 shadcn components + 51 pixel icons), `ai`, `db`, `finance-engine`, `powens`, `external-investments`, `provider-*`, `env`, `redis`, `prelude`, `config-ts`.

**Stack**: React 19 + React Compiler, TanStack Start/Router/Query (SSR, file routes, `setupRouterSsrQueryIntegration`), Tailwind v4 via `@tailwindcss/vite` (no config file; tokens live in `packages/ui/src/styles/globals.css`), Biome (single lint+format tool), Vitest + 1 Playwright smoke.

**Data layering** (consistent, redesign-friendly): `lib/api.ts` (HTTP wrapper, SSR cookie/request-id forwarding, base-URL resolution) → `features/**/api.ts` (typed fetchers) → `features/**/query-options.ts` (13 factory modules with demo/admin switch: `queryFn: mode === 'demo' ? getDemoX() : fetchX()`) → `features/*-view-model.ts` (pure, unit-tested logic). Routes call `useQuery(factory(...))` directly; SSR loaders `ensureQueryData` per route; auth is SSR-seeded in `apps/web/src/routes/__root.tsx:100-109` and read everywhere through `authMeQueryOptions()` + `resolveAuthViewState()` (`admin`/`demo`/`pending`).

**Key seams to preserve**: root SSR auth seeding, fail-soft auth (401/403/404 → demo), three-state auth resolution with `pending` hiding admin surfaces, logout invalidation fan-out (`topbar.tsx:38-56`), login `reason` round-trip for Powens, CTA-policy telemetry on the PWA install button, per-page admin re-checks (nav hiding is deliberately not a security boundary; no `beforeLoad` guards exist and that is intentional demo-first behavior).

**Charting**: d3 (house system: `D3Sparkline`/`MiniSparkline`, markets ribbon) + lightweight-charts (Trading Lab only, lazy-loaded — a second system that `apps/web/AGENTS.md` forbids) + three/react-force-graph-3d (Mémoire 3D). **Motion**: `motion/react` (16 files), inconsistent reduced-motion guarding. **Forms**: none (raw inputs, `window.prompt` in Dépenses). **Tables**: 6 hand-rolled `<table>`s, `@tanstack/react-table` installed but never imported. **Auth UI**: `/login` route owns it fully.

**VERIFY — architecture risk**: query keys do not include `mode`; demo and admin share cache slots with demo `staleTime: Infinity`. A mode transition can serve wrong-mode data until explicit invalidation. Not a redesign task per se, but shell/UserMenu work touches exactly the code that papers over it.

# CANONICAL DESIGN INPUTS VERIFIED

All read in full: `DESIGN.md` (905 lines, locked direction), `.design/command-pixel-v1/` — README, DESIGN_SYSTEM, COPY_RULES, ROUTE_MAP, IMPLEMENTATION_RULES, IMPLEMENTATION_PHASES, FRAME_INVENTORY (82 frames), CLAUDE.md, `tokens/design-tokens.json` (status FINAL), and the canonical source verified on disk (`canonical/source/Finance-OS Command Pixel V1.dc.html`, 778 KB + support.js). Repository instructions read: root CLAUDE.md, AGENTS.md, plus skill `finance-os-icon-system` (treated as authoritative for icons). Source priority honored: `.design/command-pixel-v1/` > DESIGN.md > current implementation > history.

# ROUTE MAP

| Current route | Current implementation | Canonical destination | Action | Risk |
|---|---|---|---|---|
| `/` | `apps/web/src/routes/_app/index.tsx` (469 L) | Cockpit | Visual REFACTOR + valuation-field switch | MED |
| `/depenses` | `_app/depenses.tsx` (328 L) | Argent → Dépenses | Visual REFACTOR + totals fix | MED |
| `/patrimoine` | `_app/patrimoine.tsx` (907 L) | Argent → Patrimoine | REFACTOR + extract admin CRUD | HIGH |
| `/investissements` | `_app/investissements.tsx` (774 L) | Argent → Investissements | REFACTOR + false-zero fixes | HIGH |
| `/objectifs` | `_app/objectifs.tsx` (89 L) + goals card (936 L) | Argent → Objectifs | Visual REFACTOR, split card | LOW/MED |
| `/ia` | `_app/ia/index.tsx` (523 L) | IA → Advisor | REPLACE content model (plan, not recommendations) | HIGH |
| `/ia/strategie-investissement` | `_app/ia/strategie-investissement.tsx` (1216 L) | Merged into Advisor | MERGE into `/ia`, then REMOVE LATER | HIGH |
| `/ia/chat` | `_app/ia/chat.tsx` (435 L) | IA → Chat | Visual REFACTOR, strip metadata | LOW/MED |
| `/ia/memoire` | `_app/ia/memoire/index.tsx` (519 L) | IA → Mémoire | REPLACE (infra console → product surface) | LOW |
| `/ia/memoire/graph` | `_app/ia/memoire/graph.tsx` (1884 L) | IA → Mémoire 3D (primary) | REFACTOR (keep engine, fix leaks/mobile) | HIGH |
| `/signaux` | `_app/signaux/index.tsx` (self-described "temporaire") | Radar | MERGE into Radar | MED |
| `/signaux/marches` | `_app/signaux/marches.tsx` + `MarketsDashboard` (681 L) | Radar | MERGE into Radar, un-gate from admin | MED |
| `/signaux/social` | `_app/signaux/social.tsx` (670 L) | Social Intelligence | REFACTOR, remove technical leaks | LOW/MED |
| `/orchestration` | `_app/orchestration.tsx` (500 L) | Ops → Orchestration | REFACTOR (one job = one interaction) | HIGH |
| `/ia/couts` | `_app/ia/couts.tsx` (326 L) | Ops → Coûts | MOVE route + visual REFACTOR | LOW |
| `/integrations` | `_app/integrations.tsx` (505 L) | Ops → Intégrations | Visual REFACTOR (credentials already clean) | MED |
| `/sante` | `_app/sante.tsx` (471 L) | Ops → Santé | REFACTOR (move logs out, valuation coverage in) | LOW/MED |
| `/login` | `routes/login.tsx` (162 L) | Auth → Login | REPLACE visuals, KEEP auth verbatim | LOW |
| `/ia/trading-lab` | `_app/ia/trading-lab.tsx` | Not in canonical nav | VERIFY — keep as admin expert surface outside primary nav | — |
| `/actualites`, `/marches`, `/memoire`, `/transactions`, `/signaux/x-twitter` | 8–14-line redirect stubs | — | KEEP during migration, REMOVE LATER | — |
| `/health`, `/healthz`, `/version`, `/powens/callback` | Server handlers / callback | — | KEEP untouched | — |

Obsolete/accidental references: none found — all `<Link>` targets resolve to live routes; redirect stubs are not linked from anywhere.

# SHELL AUDIT

Current: `_app.tsx` renders a fixed left sidebar (248px/72px collapsed) + sticky in-column topbar + `max-w-7xl` (1280px vs canonical 1240px) content + mobile bottom bar with FAB drawer + cmdk palette. Single `lg` breakpoint switch.

**KEEP**: `__root.tsx` (document shell, SSR auth loader, skip link — needs theme bootstrap only), logout mutation + invalidation fan-out, `PwaInstallButton` CTA-policy logic (relocate into UserMenu), route transition with reduced-motion guard, `BrandMark` (add `aria-hidden`), `StatusDot`, redirect stubs.

**REFACTOR**: `nav-items.ts` (regroup `cockpit/ia/expert` → Cockpit/Argent/IA/Radar/Ops, add top-level-vs-dropdown notion, accent labels, un-gate Radar); mobile bottom bar (canonical 4 tabs already match — drop `glass-surface`, make "Plus" a fifth tab instead of a FAB); mobile drawer (add dialog semantics/focus trap/Escape, rebuild on new Drawer primitive); `command-palette.tsx` (keep cmdk + admin filtering; replace synthetic-KeyboardEvent trigger with shared state, lower radius, show below `md`); `theme-toggle.tsx` (extract real provider, SSR-safe); Demo/Admin badges (make visible below `sm`); `PwaInstallPrompt` and `ToastViewport` (z-index collisions with bottom nav at `z-50`).

**REPLACE**: `_app.tsx` layout (sidebar-driven margins → AppShell with floating navbar + 1240px container); `AppSidebar` + `SidebarItem` (permanent sidebar forbidden); `topbar.tsx` (becomes the contained floating `TopNavbar` carrying primary nav).

**REMOVE LATER**: `SidebarFooterBlock` ASCII art + "cockpit · personnel · premium", aurora mesh backdrop in `_app.tsx:21-24`.

**MISSING**: `AppShell`, `TopNavbar`, `NavDropdown`, `NavDropdownItem`, `NavIconTile` (three near-identical framed-tile treatments exist to converge), `UserMenu` (no identity rendered anywhere; `Avatar` component has zero consumers).

Load-bearing constraints: keep reading auth through `authMeQueryOptions()`; `pending` state must keep hiding admin nav without layout shift (currently admin items pop in post-hydration — the floating navbar should reserve the Ops trigger space); active-state matcher is duplicated twice and makes `/ia` active for `/ia/couts` (wrong under dropdown model — use router `activeOptions`); e2e smoke asserts `/cockpit/i` text currently supplied by the sidebar.

# DESIGN TOKEN AUDIT

Single source: `packages/ui/src/styles/globals.css` (489 lines, Tailwind v4 `@theme inline`, `:root` = light / `.dark` = dark, oklch). Header comment still documents the rejected rose/violet direction.

- **Palette vs canonical**: hue-level divergence. `--primary` rose-magenta (h≈355) vs orange `#F97A3C` (h≈47); backgrounds plum-tinted vs warm graphite; light theme pink-white vs warm cream. Closest match is `--positive` (chroma tweak only); `--warning`/`--negative` same families, need muting. MISSING tokens: `--teal`, `--warm-accent`, `--ai` (purple `--accent-2` exists but with the wrong role — canonical forbids purple as generic accent), spacing 26px step, z-index scale.
- **Radii**: `--radius: 12px` ladder reaches 22/30px; canonical caps at 14px. ~40 `rounded-2xl`, ~13 arbitrary `rounded-[21..32px]` outliers.
- **Shadows**: rose-tinted glows (`--shadow-brand`, `glow-violet`) — retint/replace.
- **Motion**: tokens exist (`--duration-fast: 120ms` matches canonical 120–180ms) but adoption is weak; framer transitions hardcode easings inline.
- **Hardcoded values**: 63 of ~135 tsx files contain at least one; concentration: `features/advisor-graph-data.ts` (27 hex), trading-lab charts + `advisor/knowledge-graph-3d.tsx` (21 rgba, dark-only, JS-driven — need a `getComputedStyle` token bridge to ever be theme-reactive), ~200 raw Tailwind palette classes in 22 files (amber ~62, emerald ~30, red ~25 — mostly financial semantics that should be `positive/negative/warning`), ~250 arbitrary-value classes of which most are token-derived (benign) and worst-concentrated in `routes/_app/ia/memoire/graph.tsx` (61).
- **Dead**: 13 unused utilities (~90 lines), 8 `--sidebar-*` tokens, `tw-animate-css` imported with zero usages (and version-skewed between packages), `.font-display`/`--font-display` unused.
- Stale surfaces: `manifest.json` theme colors `#0b1020`, `__root.tsx:76` theme-color `#0f0f12`.

**Migration strategy**: rotate the 11 canonical hues + radius ladder + fonts in globals.css first (one file, ~85% of visual change); keep `--accent-2`/`--aurora-*` names temporarily as legacy compat but plan their deletion during shell/page phases (they can't be recolored to orange without flattening gradients — needs per-surface treatment); sweep the 200 palette classes per-page during page migration; the JS chart/3D color bridge is its own small task before light mode.

# TYPOGRAPHY AUDIT

- Loading: `@fontsource-variable/inter` + `jetbrains-mono` imported in `apps/web/src/styles.css`; tokens `--font-sans`/`--font-mono` point at them. **No Geist anywhere** (repo, lockfile, font files). No Departure Mono; one page-specific `system-ui` print stylesheet in dead `wealth-history.tsx`.
- `.font-financial` (`globals.css:301`) = `var(--font-mono)` + `tnum/zero/ss01` — applied manually and unevenly at ~70 sites in 20 files; many amounts (most of Dépenses, Orchestration) omit it, so columns don't align. Tailwind `tabular-nums`: 0 uses.
- Arbitrary sizes bypass any scale (`text-[10px]`, `text-[13.5px]`, `text-[22px]/[34px]` in KpiTile, inline `clamp()` strings in PageHeader).
- **Safest migration**: swap deps + the two `@import` lines + three font tokens (`.font-financial` keeps working since it reads `var(--font-mono)`); then introduce the canonical type scale as tokens and let an `Amount` component enforce numeric treatment; Geist Pixel is a **new capability** (currently pixel-ness is carried by SVG icons, not a font) — verify availability before promising it. Legacy Inter/JetBrains classified as REMOVE LATER after the swap.

# COPY AUDIT

Approximate user-facing occurrences: **~139 middle dots**, **~84 em dashes** (≈60 prose + ≈24 as the `'—'` null-placeholder glyph pattern rooted in `kpi-tile.tsx:89`), **7 semicolons** (fully enumerated, e.g. `integrations.tsx:294`, `orchestration.tsx:442`). `•` bullets: zero user-facing.

Top offender files: `memoire/graph.tsx` (13·+5—), `behavior-analytics-card.tsx` (12·), `patrimoine.tsx` (10·), `advisor-graph-data.ts` (10—), `advisor-graph-details-panel.tsx` (6·+8—), `x-twitter-view-model.ts` (7—), `investissements.tsx` (7·), `advisor-graph-lenses.ts` (7·), `eval-scorecard.tsx` (6·), `sante.tsx` (5·), markets/trading-lab components (~4 each), plus always-visible shell instances (sidebar footer, command palette header, login footer).

Two idioms drive most of it: `A · B` metadata concatenation (exactly the pattern COPY_RULES.md bans — replace with layout/columns) and `· ` as a fake `<li>` bullet. Also flagged: AI-narration/disclaimers (signaux disclaimer block, "Pas de LLM ici", WebGL narration), roadmap narration in shipped UI (`AdvisorDecisionJournal` claims nothing persists while the journal API is live; "Cette vue ne filtre pas encore par date"), ~34 verbose `description=` subtitles, 4 English demo-fixture strings, and an accents split (nav + several routes unaccented ASCII vs accented components).

**Strategy**: enforce via page migration (each page's copy pass is part of its phase), plus one dedicated pass for shared components/view-models; decide once whether `—` is permitted as the null glyph (recommend replacing with `Indisponible`/`-` per DESIGN_SYSTEM examples — single origin point + ~16 call sites).

# COMPONENT INVENTORY

`packages/ui` ships only avatar/badge/button/card/input/separator (+51 pixel icons). The de-facto design system lives in `apps/web/src/components/surfaces/`.

| Target component | Existing implementation | Path | Decision | Notes |
|---|---|---|---|---|
| AppShell | inline in route | `routes/_app.tsx` | REPLACE | Sidebar-driven; extract real component |
| TopNavbar | Topbar | `shell/topbar.tsx` | REPLACE | Doesn't carry nav; relocate logout/PWA logic |
| NavDropdown / NavDropdownItem | — | — | MISSING | No dropdown/popover exists anywhere |
| NavIconTile | 3 ad-hoc framed tiles | sidebar/palette/panel | REFACTOR (converge) | Near-identical treatments at 3 sizes |
| MobileBottomNav | `MobileNav` tabs | `shell/app-sidebar.tsx` | REFACTOR | Right 4 destinations; glassmorphism + FAB to fix |
| MobileMoreDrawer | `MobileNav` drawer | same | REFACTOR | No dialog semantics/focus trap |
| CommandPalette | cmdk | `shell/command-palette.tsx` | KEEP (light refactor) | Best shell component |
| UserMenu | — | — | MISSING | `Avatar` in packages/ui has 0 consumers |
| Button / Input | shadcn | packages/ui | KEEP | Prune `aurora`/`soft` variants |
| IconButton | `Button size="icon"` + ad-hoc | — | REFACTOR | Formalize |
| Select | 11 raw `<select>` | across pages | MISSING | Highest-volume missing control |
| SegmentedControl | RangePill | `surfaces/range-pill.tsx` | REPLACE | Broken tablist semantics; 3 call sites |
| Tooltip / Popover / Drawer / Modal | native `title=` / 1 hand-rolled dialog / 2 hand-rolled sheets | — | MISSING | Build on installed radix |
| Amount / CurrencyAmount | `formatMoney` + 6 duplicates, no component | `lib/format.ts` | MISSING | Highest-value new component; must accept `number\|null` |
| PercentChange / TrendIndicator | 6+ ad-hoc formatters, inline `.toFixed()%` | — | MISSING (converge) | Sign color re-derived per site |
| BreakdownList / Progress | 4 bespoke bar lists / 8 bars, 0 `role="progressbar"` | — | MISSING (converge) | None accessible |
| MiniSparkline | exists by name | `components/ui/d3-sparkline.tsx` | KEEP (promote) | Correctly aria-hidden |
| Status | StatusDot + Badge + stranded orchestration mapping | surfaces + orchestration.tsx | REFACTOR | Gate pulse behind reduced-motion |
| ProviderStatus / Freshness | 3 provider renderings / table column + util | — | MISSING (converge) | Logic exists, no component |
| ValuationState | ValuationOpsPanel labels only | `dashboard/valuation-ops-panel.tsx` | REFACTOR (extract) | The 7 canonical states + FR labels exist in one admin panel |
| TransactionsTable / PositionsTable / CostsTable | inline `<table>`s | depenses/investissements/couts routes | REFACTOR (extract on shared Table) | Zero shared code today |
| RunsTable | Panel lists | orchestration/integrations | MISSING | Never was a table |
| Surface / Panel | `Card` (12 files) vs `Panel` (24 files) | packages/ui vs surfaces | REFACTOR (converge) | Panel wins by usage; promote to packages/ui, add a11y |
| ProviderCard / GoalSurface / RecommendationRow / OperationRow / SignalRow / SourceCard | inline compositions | integrations / goals card / IA pages / depenses / signaux | MISSING (converge) | `SignalItemCard` and social's card are closest seeds |

**Legacy audit**: `KpiTile` — REFACTOR (7 users; fix semantics/formatter/arbitrary sizes, promote); `Panel` — KEEP + converge with Card; `PageHeader` — REFACTOR (18 users; inline clamp() to tokens, icon-dropped-without-eyebrow bug, unguarded motion); `RangePill` — REPLACE; `BrandMark` — KEEP (a11y fix; VERIFY the `◈` glyph against the canonical frames); `StatusDot` — REFACTOR into the Status family.

# ICON AUDIT

Governed by the authoritative `finance-os-icon-system` skill: tier 1 vendored Pixel Icons (`packages/ui/src/icons/pixel/`, 51 components generated by `scripts/vendor-pixel-icons.mjs`, CC BY 4.0 attribution present in `docs/third-party-notices.md`); tier 2 Phosphor via `dist/csr/*` deep imports (6 files, 8 icons, 2 in nav as documented exceptions); tier 3 Pxlkit for rare expressive moments. Nav icon ownership is fully centralized in `nav-items.ts` via a narrow `IconComponent` type that both sets satisfy. **KEEP as-is** — the redesign consumes this system (NavIconTile frames pixel icons); the only conflict is generic (icons must sit in 7px-radius framed tiles per canonical dropdowns). Do not start any icon migration.

# THEME AUDIT

Class-on-`<html>` dark mode; SSR hardcodes `className="dark"` (`__root.tsx:117`); persistence in `localStorage['finance-os-theme']` applied post-hydration by `useTheme` (mounted only under the topbar — login never restores theme); `.light` class is written but defined nowhere; no `prefers-color-scheme` support; no cookie so SSR can never know the theme; FOUC risk for light users. Token-level share of the light/dark migration is high (values live in `:root`/`.dark`), but component-level exceptions are the ~200 raw palette classes, the dark-hardcoded JS charts/3D (rgba whites, fuchsia fills), `white/black` classes in memoire/graph, and shadows. Required code work: a blocking theme bootstrap (inline script or cookie), a real theme provider, `.light`/system-preference semantics, manifest/theme-color updates.

# RESPONSIVE AUDIT

- Shell: single `lg` switch; no search affordance below 768px; DEMO/ADMIN badge invisible below 640px; nav DOM triplicated (sidebar + bottom nav + palette); PWA prompt overlaps bottom bar (`z-50` collision).
- Tables: Dépenses and internal positions have mobile card duals; external positions table is `min-w-[760px]` scroll-only (inconsistent); markets watchlist has a dual. No shared mobile transformation.
- Charts: Cockpit chart fixed 220px; Coûts `MiniSparkline width={480}` **overflows at 320–390px**; memoire graph left rail (8 stacked panels) buries the canvas on mobile with no collapse (details rail has one).
- Chat: message list `max-h-[520px]` fixed, composer far below fold on mobile, no auto-scroll-to-bottom.
- Investissements: 5 KPI tiles in `sm:grid-cols-2` (orphan), `md:grid-cols-3` with 2 provider cards (permanent empty column); signaux nav cards `sm:grid-cols-3` with 2 children.
- Touch: Objectifs edit button is `opacity-0 group-hover:opacity-100` (**unreachable on touch**); ActionDock magnification untested on touch; native `title=` tooltips invisible on touch.
- Mostly-stacking pages (no intentional mobile composition): Patrimoine hero/admin CRUD, Orchestration, Santé, strategie-investissement. These need deliberate mobile hierarchies per the canonical Mobile frames.

# ACCESSIBILITY RISKS

Mobile drawer and goals editor overlay have no `role="dialog"`/focus trap/Escape/scroll lock; `role="progressbar"` appears 0 times across 8 progress bars; toast viewport has no `aria-live`; `RangePill` implements a broken tablist (no roving tabindex/arrow keys); reduced-motion is honored in ~4 components but unguarded in PageHeader, KpiTile, RangePill, StatusDot's `animate-ping`, Santé's stagger, and Login; `KpiTile` has no label↔value association; `Panel` sections are unlabeled landmarks; `BrandMark` announces "◈"; `⌘K` fires while typing in inputs; charts have no text alternatives except trading-lab's fallback; color-only status appears where dots lack adjacent text; `text-[10px]`/10.5px labels below readable floor. Positive baseline to generalize: `StatusDot`'s conditional `role="img"`, Santé's documented never-color-alone `SignalStatusIcon`, goals card's typed recoverable error banner.

# PAGE GAP ANALYSIS

### Cockpit (`/`)
- **Current**: 469-line god-component; Panel/KpiTile/RangePill/D3Sparkline; private `TodayMetric` duplicate of KpiTile; artificial 120ms `secondaryReady` gate.
- **Preserve**: query wiring (8 prefetches), `availableLiquidity` fallback logic, `attentionTotal` policy, `latestSync` reducer, advisor flag gates.
- **Reusable**: KpiTile/Panel/RangePill/sparklines, trend-visuals math.
- **Visual delta**: full restyle to canonical Cockpit frame; drop nested sections and fake progressive loading.
- **Missing states**: error (none for any query); stale banner unreachable; loading partial (zeros render while pending).
- **Responsive**: chart height fixed; otherwise adequate grids.
- **Backend dependency**: none — but should switch to `valuation.totalValueBase`/coverage (already served).
- **Risk**: MED. **Approach**: lift the ~10 inline derivations into a view-model verbatim, then restyle; migrate first as the baseline page (Phase 04).

### Dépenses
- **Current**: infinite transactions query (30/page), dual table/card rendering, `window.prompt` category editing, localStorage budgets card, expense structure card.
- **Preserve**: pagination + classification mutation, CSV export util, `summarizeExpenseCategories/Timeline`.
- **Visual delta**: canonical table grammar, édition catégorie frame (replace `window.prompt` — behavior change, needs sign-off), copy pass.
- **Correctness before restyle**: period KPIs computed from loaded pages only (HIGH), mixed-currency sums (HIGH), range-vs-monthly budget mismatch (HIGH), freshness payload fetched but never rendered.
- **Missing states**: stale/partial ("sur N chargées"); error near-unreachable.
- **Backend dependency**: none (authoritative totals already in summary endpoint).
- **Risk**: MED. **Approach**: fix totals source + budget window, then extract TransactionsTable on the shared Table, then restyle.

### Patrimoine
- **Current**: 907 lines mixing hero viewer (3 decorative layers), buckets, connections, assets, external investments, and a 260-line admin manual-asset CRUD.
- **Preserve**: query/mutation wiring, draft converters, bucket reducers, 45-day stale heuristic, the `'Valeur inconnue'` pattern.
- **Visual delta**: hero → canonical Patrimoine frame; valuation states surfaced per asset; "Détail valorisation" frame is new.
- **FLAGGED**: the evolution chart is retro-extrapolated (server `buildDailyWealthSnapshots` unwinds only bank flows from today's total — market movement flattened, history mutates retroactively; demo mirror same flaw). UI must stop labeling it "Évolution du patrimoine" without a reconstruction caveat; the delta badge derived from it is fabricated period performance.
- **Missing states**: error (none); stale only via local heuristic, ignores `valuationStatus`/`asOf`.
- **Backend dependency**: honest history series = BACKEND REQUIRED; everything else presentational.
- **Risk**: HIGH. **Approach**: extract admin CRUD first, switch hero to `valuation.totalValueBase` + coverage, then restyle.

### Investissements
- **Current**: external portfolio (bundle + positions + trades + cash flows), Powens accounts, internal positions, URL-driven filters, ActionDock.
- **Preserve**: external P&L convention (`null → '-'`, quality badges — the reference pattern), URL filter state, `powens-investment-assets` helpers.
- **Visual delta**: canonical Investissements + Détail position frames; coverage footer promoted from 12px muted text.
- **Correctness before restyle**: internal positions fabricate −costBasis losses when value unknown (HIGH); four `?? 0` provider/crypto tiles (HIGH); ActionDock actions claim success without doing anything (HIGH — wire or remove); `costBasisSource` never surfaced.
- **Missing states**: error (none); stale fields in type unused.
- **Backend dependency**: none for the fixes above.
- **Risk**: HIGH. **Approach**: unify on the external rendering convention via the new Amount/ValuationState primitives, then restyle.

### Objectifs
- **Current**: 89-line route + 936-line goals card (data+mutations+status machine+alerts+hand-rolled overlay editor).
- **Preserve**: `clampProgress`, `getGoalStatus` state machine, mutations + `retryLastAction`, the typed recoverable error banner (best-in-repo — generalize it app-wide).
- **Visual delta**: canonical Objectifs + Édition frames; editor overlay → real Drawer/Modal primitive.
- **Correctness**: giant "0%" hero with zero goals; archived goals in the average; three duplicate progress formulas.
- **Risk**: LOW (route) / HIGH (card split). **Approach**: fix the aggregate, split the card (surface / editor / logic), restyle. Simple page — good early Argent candidate after Cockpit.

### Advisor (`/ia`)
- **Current**: KPI tiles from untyped `snapshot.metrics`, daily brief, 5 `AdvisorRecommendationCard`s (model without amounts/destinations), assumptions panel, flag-gated learning-loop cards, static guardrail copy.
- **Preserve**: manual-run polling contract (3s poll → 4s refetchInterval while active), invalidation fan-out, `missingItems` aggregation, the recommendation contract guardrail (server downgrades `buy` → `insufficient_data` without fresh provenance).
- **UI CAN IMPLEMENT WITH EXISTING DATA**: the entire Monthly-Plan hierarchy (amount/asset/destination/risk/action/why) from `advisor_action_plan_item` + buckets = Socle/Croissance/Opportuniste + contribution split + drift + degraded states + decision capture (journal API live) + Investment Profile *read*.
- **REQUIRES BACKEND OR DOMAIN WORK**: "when"/plan-month identity (no date model), Flash entity, Investment Profile *write* client fn (endpoint `PUT /dashboard/advisor/investment-strategy` exists — only the fetcher is missing), salary exposure, unifying the two recommendation models into one contract.
- **PRODUCT CONCEPT ONLY, NOT CURRENTLY IMPLEMENTED**: Flash lifecycle, automatic scheduling, anything execution-shaped (repeatedly forbidden in the domain).
- **Risk**: HIGH (product restructure, two models, 1216-line donor page). **Approach**: make `/ia` render the plan model (donor: strategie-investissement + its tested view-model), add the profile write, retire the donor route; fix `AdvisorDecisionJournal`'s false "nothing persists" copy; keep learning-loop cards flag-gated off.

### Chat
- **Current**: single hardcoded thread, Input composer, right-rail parallel knowledge Q&A system.
- **Preserve**: admin-only send gates, demo read-only, knowledge-answer demo fixture short-circuit.
- **Visual delta**: canonical focused 780px layout; remove 8 metadata leaks (model badge, `thread: default`, raw status enums, raw confidence % — `confidenceLabel` already exists unused); decide the knowledge-panel merge (the structural conflict with "minimal").
- **Missing states**: thread fetch errors unsurfaced; no auto-scroll; fixed-height list on mobile. Structured payloads (`citations/assumptions/caveats/simulations`) are fetched and dropped — the canonical "structured financial responses" can be built from existing data.
- **Risk**: LOW/MED. **Approach**: JSX-level leak removal + layout; merge Q&A panel only with the demo path understood.

### Mémoire
- **Current**: index = infra console (15 leaks: Neo4j/Qdrant names, retrieval-mode buttons, BM25 scores, schemaVersion, latency, tokens); graph = 1884-line signature experience with lenses/tours/pins/search/path-finding, `KnowledgeGraph3D` renderer.
- **Preserve**: origin/trust contract (`demo/real/mixed/empty`, opt-in example preview, `isExample` marking), pins persistence, URL sync, reduced-motion → performance preset, admin rebuild mutation.
- **Visual delta**: graph becomes the primary immersive surface (canonical has 8 Mémoire frames); index either disappears or becomes a thin entry; fix leaks (raw IDs in tooltips/URL/panels, raw confidence %, token counts).
- **Backend dependency**: none — leak removal is deletion; human-readable node slugs for URLs would be nice-to-have (VERIFY).
- **Risk**: LOW (index) / HIGH (graph). **Approach**: keep the engine and feature modules (all unit-tested), rebuild chrome around them; make `three` lazy; add WebGL-failure fallback; mobile left-rail collapse.

### Radar
- **Current**: `/signaux` (self-described temporary hub) + `/signaux/marches` → 681-line `MarketsDashboard` (panorama, macro, watchlist, deterministic signals, freshness/provenance… plus a debug `#bundle` section and anchor-link nav). Both read independent stable endpoints — **convergence needs no pipeline rewrite**.
- **Preserve**: demo fallback + watchlist/macro back-fill in `fetchMarketsOverview`, offline detection, admin-gated refresh, `createScenarioFromSignal`, severity sorting.
- **Visual delta**: single Radar surface per canonical frames; delete `#bundle`, legend card, anchors, ingestion-run strip (→ Orchestration); un-gate from admin (canonical Radar is not Ops); signature visualization is genuinely new design work.
- **Missing states**: signals hub has no error/pending; non-admin currently gets silent blank.
- **Backend dependency**: none.
- **Risk**: MED. **Approach**: compose a `/radar` route from both query sets; keep `MarketsDashboard` sections as extracted components; 301 the old routes like the existing stubs.

### Social Intelligence
- **Current**: closest page to canonical already (avatar/name/handle/bio/provider/tags/status cards). No cost leaks (X health/cost panels already removed — their client fns are dead code).
- **Preserve**: enable/disable/delete mutations, lookup→create hydration chain (move wholesale), `updated_existing` branch, dedupe consuming only `.sources`.
- **Visual delta**: canonical SourceCard + Filtres/Sélection frames; remove raw enums, raw API `message`s, "Listed" metric, pipeline vocabulary, JSON `ManualImportPanel` (relocate to an admin context or drilldown), native `confirm()`.
- **Risk**: LOW/MED.

### Orchestration
- **Current**: 14 registered jobs, refresh-all/per-job/recover/cancel + valuation dry-run; rich 17-state descriptor map; status filter bar; legend card leaking `/ops/env/diagnostics` and repo doc paths.
- **Preserve**: stale-recovery/cancel semantics (encode real incidents; tested in `view-state.test.ts`/`invalidate.test.ts`), polling gate, `manualTriggerAllowed` handling, invalidation helper.
- **Visual delta vs "one job = one interaction"**: remove filter bar, 4-card summary, deps line, legend; add duration (already in the response type, never shown); job drilldown pattern (only valuation has one — relocate `ValuationOpsPanel` coverage data to Santé, keep the dry-run action here as drilldown).
- **Known defects to resolve during redesign (VERIFY, do not invent controls)**: 5 of 14 jobs can never show status (missing step-key mappings), news-finance/news-crypto share one key, `ManualTriggerHint` points to a dead end (`/signaux/social` has no sync trigger), and 7 backend capabilities have client code but no UI (Firehose estimate/run with dry-run, X daily sync, X resolve-all, X health, knowledge enrichment ensure, derived recompute POST) — each needs a wire-or-delete product decision.
- **Risk**: HIGH.

### Coûts
- **Current**: `/ia/couts` — advisor spend (real, ledger), X/Twitter tri-state real/estimated/mixed via `describeCostBasis` (best honesty pattern in the IA area), fixed recurring subscriptions. `spend.byFeature[]`/`byModel[]` returned and never rendered.
- **Not supported by data (do not invent)**: embeddings, per-provider, enrichment, infrastructure cost lines.
- **Defects**: no error state at all (silently zeroed page — several `$0.0000` false zeros), 480px fixed sparkline, unaccented copy, gated by the *Advisor* flag rather than its own.
- **Risk**: LOW. **Approach**: move to the Ops group/URL, add error states, render the existing breakdowns, restyle.

### Intégrations
- **Current**: Powens connect/sync/disconnect (cooldown store, 2-step confirm, wide invalidations), IBKR/Binance server-configured sync-only. **Credential UI: CLEAN — zero fields for keys/secrets/Flex tokens/Query IDs anywhere** (verified by repo-wide grep).
- **Gaps/leaks**: no reconnect CTA despite `reconnect_required` status existing; request IDs, raw provider refs, raw error strings, raw English status enums rendered; duplicate header/ActionDock controls; `⟳` glyph.
- **Preserve**: cooldown + confirm state machines, admin re-checks inside mutationFns, invalidation sets.
- **Risk**: MED.

### Santé
- **Current**: 9-signal derivation → global status (good, keep, including its never-color-alone convention); then two raw run-log panels with request IDs, error strings, row counts (→ belong in Orchestration drilldowns).
- **Missing at product level (data exists)**: asset-valuation coverage + unresolved assets (currently on Orchestration), market freshness (in `overview.freshness`, unread), signal ingestion freshness.
- **No Env Diagnostics/CPU/logs UI exists** — the backend env-diagnostics route is unconsumed; keep it that way.
- **Risk**: LOW/MED. **Approach**: mechanical panel moves + signal derivation kept verbatim.

### Login
- **Current**: auth fully isolated (validated `reason` search param, loader redirect for admins, uncontrolled form, mutation + cache removals + toast) — all decoration-independent. Visual layer = PixelBlast backdrop + scrim + two unguarded motion entrances.
- **Visual delta**: complete signature redesign per 7 Login frames (composition/typography/lighting/depth, no particle replacement).
- **Risk**: LOW. Deleting 4 blocks yields a working login with zero auth changes; add reduced-motion guards; note theme is never restored on this route today.

# FINANCIAL CORRECTNESS RISKS

HIGH (unknown → precise zero, or fabricated values), by root cause:

1. **Unrendered valuation truth**: all headline totals use `totals.balance` (naive, cross-currency, EUR-labelled) instead of the served `valuation.totalValueBase` (null-aware) + coverage/status counts — `index.tsx:258`, `patrimoine.tsx:369`.
2. **Adapter zero-fallback**: `toTotalsWithFallback` → `{balance:0, incomes:0, expenses:0}` feeding 6 KPIs (`dashboard-legacy-adapter.ts:107`).
3. **Silent demo fixtures in admin on API failure** (`dashboard-api.ts:132-195`, external-investments api) — fictional wealth labelled fresh; makes error/stale UI unreachable.
4. **Retro-extrapolated wealth series** (server `buildDailyWealthSnapshots` + demo mirror) presented as "Évolution du patrimoine" with a derived performance badge.
5. **Investissements**: `?? 0` portfolio total / provider / crypto tiles (`investissements.tsx:143-159,239-248`); fabricated −costBasis P&L at `:612-614`; non-functional ActionDock claiming "Données revalidées" (`:722-771`).
6. **Dépenses**: loaded-pages-only period KPIs (`:83-93`), mixed-currency EUR sums, monthly budget vs range spend (`monthly-category-budgets-card.tsx:149-181`).
7. **Cockpit**: "Argent disponible" false `0,00 €` (`:112-115`), `mode: authMode ?? 'demo'` rendering fixtures while auth unresolved (`:91`).
8. **Coûts**: `$0.0000` spend while endpoint down/pending, no error branches (`ia/couts.tsx:110-134`).
9. **Advisor/Plan**: `?? 0` allocation/cash/hit-rate percentages (`ia/index.tsx:306,314`, `strategie-investissement.tsx:298-322`).
10. **Objectifs**: giant "0%" hero for zero goals, archived goals in the average (`:48-54`).

MEDIUM/LOW registers are itemized in the page sections above (~25 more hits: currency `?? 'EUR'` labels, `parseAmount → 0` persisting, unknown-age treated as fresh, silent `slice(0,4)` truncation, `formatMoney` accepting only `number` as the structural root cause). Positive patterns to generalize: external P&L `null → '-'` + quality badges, `'Valeur inconnue'`, `DataSourceBadge`, `describeCostBasis`.

# REACT BITS / PIXELBLAST AUDIT

- Vendored, not an npm dep: `apps/web/src/components/reactbits/pixel-blast.tsx` (705 lines, `@ts-nocheck`, MIT + Commons Clause) + `apps/web/src/components/brand/pixel-blast-backdrop.tsx` wrapper. Complete import graph: `login.tsx` → backdrop → pixel-blast. Nothing else.
- Dependency cascade on removal: drop `postprocessing` (sole consumer); `gsap` is already dead (zero imports repo-wide); `three` **must stay** (Mémoire 3D). Also removes the Commons-Clause-licensed file.
- Stale config: `biome.json:25-37` excludes 13 reactbits files of which 12 no longer exist.
- No CSS/assets/e2e references. Classification: REMOVE LATER, conditional on the Login rebuild landing first (mandated by DESIGN.md and IMPLEMENTATION_RULES.md).

# LEGACY UI DEBT

**SAFE TO REMOVE LATER**: 5 redirect stubs (only behavior change: 301 → 404 for old bookmarks — VERIFY acceptable); `dashboard/push-notification-card.tsx` (0 importers); `dashboard/dashboard-health.ts` (726 lines, 0 importers) + its test; `gsap` dep; biome dead exclusions; `SidebarFooterBlock`; aurora backdrop + 13 dead CSS utilities + 8 `--sidebar-*` tokens; `tw-animate-css` (0 usages, version-skewed); reactbits + backdrop + `postprocessing` (post-Login); no-op branch in `dashboard-view-model-adapter.ts`.

**VERIFY BEFORE REMOVAL**: `dashboard/wealth-history.tsx` (491 lines — component never rendered, only its helpers are used by its own test); `ops-refresh/free-firehose-api.ts` + the 4 dead X-twitter client fns (orphaned clients for live endpoints — tied to the Orchestration wire-or-delete decisions); `AdvisorDecisionJournal` (ship-or-cut); `Avatar` exports (keep only if UserMenu uses them); `—` null-glyph convention; `@tanstack/react-table` (adopt for the shared Table or drop).

**STILL IN ACTIVE USE**: everything else — notably trading-lab, strategie-investissement (until merged), couts, all shell/surfaces/advisor/dashboard components except the two above. No old-sidebar remnants or duplicate responsive trees exist.

# PERFORMANCE RISKS

- `import * as d3` lands on the **Cockpit landing route** via `D3Sparkline` — switch to `d3-scale`/`d3-shape`/`d3-array` submodule imports during the shared-chart phase.
- `three` is statically imported by both PixelBlast (login) and `knowledge-graph-3d` (only `react-force-graph-3d` is lazy) — make it lazy in the graph; removal handles login.
- No `React.lazy`/`Suspense` anywhere; route-level chunking only. Lightweight-charts is already correctly dynamic.
- Fonts: two variable families via CSS `@import`, no preload/`font-display` control — fix during the Geist swap; load Geist Pixel lazily.
- `AnimatePresence mode="wait"` adds ~250ms perceived latency to every nav; `defaultPreloadStaleTime: 0` + intent preload refetches on hover; devtools mounted without a visible DEV guard (VERIFY tree-shaking in prod build).
- Demo fixtures (1261-line `demo-data.ts` + siblings) ship statically in the admin bundle via the query-options modules.
- Signature-page budget rule is respected in reverse today: Login carries a WebGL stack it must lose, while normal pages are mostly light. Radar's new signature visualization must be scoped to Radar only.

# DEPENDENCY IMPACT

KEEP: tailwindcss v4, radix-ui (finally use it), cmdk, motion, lightweight-charts (lazy; or consolidate on d3 later — VERIFY against `apps/web/AGENTS.md`'s one-chart-system rule), three + react-force-graph-3d, cva, `@tanstack/react-store`. MIGRATE USAGE: `@phosphor-icons/react` (governed fallback tier — keep, per icon skill), d3 (submodules). REMOVE LATER: `@fontsource-variable/inter`, `@fontsource-variable/jetbrains-mono` (→ Geist), `gsap`, `postprocessing` (post-Login), `tw-animate-css`, `radix-ui` from `apps/web` deps (packages/ui owns it), `@tanstack/react-table` + `react-form` + `react-db` + `query-db-collection` + `match-sorter-utils` (all 0 imports). ADD (prerequisite): Geist Sans/Mono (+ Pixel if sourceable). No new UI libraries needed — the design system builds on radix + existing surfaces.

# TEST AND VERIFICATION BASELINE

- 50 vitest files in `apps/web` (strong: auth/SSR, adapters, powens, ops view-state, advisor-graph, learning-loop; 1 DOM test: learning-loop smoke). `packages/ui`: zero tests. 1 Playwright spec (`e2e/demo-smoke.spec.ts`) asserting API contracts + homepage strings incl. `/cockpit/i` (currently supplied by the sidebar — shell phase must keep the string visible or update the spec deliberately).
- Zero coverage: financial formatting (`lib/format.ts` untested), shell/nav, loading/empty/error states, theme, responsive, a11y.
- Coverage to add during migration: unit tests for the new `Amount`/`PercentChange`/`ValuationState` null-handling (the financial-honesty enforcement point), nav-items grouping/gating selectors, theme bootstrap, and one e2e per migrated shell state.
- **Canonical commands** (verified): `pnpm lint` (biome), `pnpm format:check`, `pnpm typecheck` (`-r`), `pnpm -r --if-present test`, `pnpm -r --if-present build`, `pnpm test:e2e`, aggregate `pnpm check:ci` (11 steps incl. `agent:skills:check`, `docs:check`, `docker:check`; e2e NOT included), per-package `pnpm --filter @finance-os/web typecheck|test|build`, `pnpm --filter @finance-os/ui typecheck`. Affected variants: `pnpm affected:{lint,typecheck,test,build}`.
- GitNexus: index is **140 commits behind HEAD** (pre-reset). Run `pnpm gitnexus:analyze` before UI-1.

# IMPLEMENTATION DEPENDENCY ORDER

Adapted to this repo (differs from the generic list mainly in pulling correctness primitives before pages, and Login earlier since it's isolated):

1. **Prerequisites** — acquire Geist fonts; refresh GitNexus; decide the open questions below.
2. **Foundations (UI-1)** — token rotation, font swap, radius ladder, missing tokens, SSR-safe theme bootstrap. Unblocks everything; no page edits.
3. **Shared primitives** — radix overlay family (Tooltip/Popover/Modal/Drawer/Select/SegmentedControl); promote Panel/PageHeader/KpiTile/StatusDot into `packages/ui`; converge Card/Panel.
4. **Finance + status primitives** — null-aware `Amount`/`CurrencyAmount`/`PercentChange`/`TrendIndicator`, `Progress`, `Status/ProviderStatus/Freshness/ValuationState`, unified formatters. This is where the false-zero class of bugs gets structurally fixed, so it must precede page migrations.
5. **Shell** — AppShell + floating TopNavbar + NavDropdown/NavIconTile + UserMenu + regrouped nav-items + mobile bottom nav/Plus drawer + palette restyle. Depends on 3 (Popover/Drawer) and 2.
6. **Tables + chart grammar** — shared Table (decide react-table adopt-or-drop), chart container/tooltip, d3 submodule diet.
7. **Cockpit** (baseline normal page) → **Argent** (Objectifs → Dépenses → Investissements → Patrimoine, easiest-to-hardest with their correctness fixes inline).
8. **IA** — Advisor restructure (plan model to `/ia`, profile write, retire donor route), Chat, Mémoire (index replacement, graph chrome).
9. **Radar + Social** — route convergence + signature visualization.
10. **Ops** — Orchestration (with the 7 wire-or-delete decisions), Coûts move, Intégrations, Santé panel moves.
11. **Login** — independent; can run in parallel any time after Foundations; unlocks the reactbits/postprocessing cleanup.
12. **Responsive + Light mode** — light palette is native design work; JS chart token bridge lands here.
13. **Cleanup** — dead deps/files/stubs/biome exclusions/legacy tokens.
14. **Verification + Visual QA + Debug** — `pnpm check:ci` + e2e + frame-by-frame comparison (use `finance-os-browser-qa` / `finance-os-ui-review` skills).

# PROPOSED PHASES

Maps 1:1 onto `.design/command-pixel-v1/IMPLEMENTATION_PHASES.md` with these repo-specific amendments: Phase 01 must include the Geist acquisition + theme bootstrap; insert the finance/status primitives into Phase 03 explicitly (they gate financial honesty); Phase 05 order Objectifs→Dépenses→Investissements→Patrimoine; Phase 06 Advisor is a product restructure (plan-model move), not a reskin; Phase 09 Login can be parallelized earlier; Phase 11 cleanup list is enumerated in "Legacy UI Debt" above.

# BLOCKERS AND OPEN QUESTIONS

1. **Geist sourcing** — no Geist package/files exist. Geist Sans/Mono are readily available (Vercel, OFL); **Geist Pixel availability and license must be verified** before the typography lock is fully implementable. If unavailable, the pixel micro-accent needs a documented deviation.
2. **Silent demo-fallback in admin** (`dashboard-api.ts:132-152` et al.) — the canonical stale/degraded/error states cannot be honest while all failures return fixtures. Decision needed: surface a `live/cache/demo_fallback` source marker (presentation change, recommended) vs change the fallback behavior (domain change).
3. **Advisor "when" + plan identity + Flash** — BACKEND REQUIRED. Decide UI-6 scope: ship Monthly Plan/Profile from existing data (fully possible) and stage Flash + plan-month as a later backend task, or block UI-6 on schema work. Recommended: ship what exists, document Flash as concept-only.
4. **Orchestration wire-or-delete** — 7 backend capabilities with orphaned clients (Firehose, X sync/resolve/health, enrichment ensure, derived recompute) and 5 jobs with no status mapping. Each needs a product call during the Ops phase; the audit deliberately did not invent controls.
5. **`—` as null placeholder** — forbidden character vs systemic glyph (~16 call sites, one origin at `kpi-tile.tsx:89`). Recommend `Indisponible`/`-` per DESIGN_SYSTEM examples; needs a one-line product confirmation.
6. Non-blocking but required before UI-1: run `pnpm gitnexus:analyze`, and commit or stash the current mid-migration working tree so Foundations lands on a clean baseline.

# RECOMMENDED UI-1 SCOPE

**UI-1 = Phase 01 Foundations: token rotation + Geist + SSR-safe theming. No page or shell layout changes.**

**Files involved**:
- `packages/ui/src/styles/globals.css` — rotate all 11 dark + 11 light canonical hues in `:root`/`.dark` (oklch equivalents of the design-tokens.json hexes); add `--teal`, `--warm-accent`, `--ai`; rescale the radius ladder to the 6/7/8/10/12/14 ceiling; swap `--font-sans`/`--font-mono` to Geist (add `--font-pixel` if sourced); retint shadows; add a z-index scale; rewrite the stale header comment. Keep `--accent-2`/`--aurora-*`/`--sidebar-*` defined (legacy compat, explicitly permitted by DESIGN.md) with values tamed toward the new palette; their deletion belongs to later phases.
- `apps/web/src/styles.css` — replace the two fontsource imports with Geist loading (self-hosted `@font-face` + `font-display: swap`, preload hints).
- `apps/web/package.json` — swap font deps (the only dependency change in UI-1).
- `apps/web/src/routes/__root.tsx` — blocking theme bootstrap (inline script or cookie read) replacing the hardcoded `className="dark"`; update `theme-color`.
- `apps/web/src/components/shell/theme-toggle.tsx` — extract a real theme provider (localStorage + system preference + defined `.light` semantics), keep the toggle's behavior.
- `apps/web/public/manifest.json` — theme/background colors.

**Must remain untouched**: all routes/pages/layout structure, nav-items grouping, business logic, query layer, demo/admin handling, icons, the ~200 raw palette classes (later phases), reactbits (Login phase), all copy.

**Expected visible result**: the whole app shifts to Soft Orange Cream + Geist with existing layouts intact; light mode stops flashing dark; some purple/aurora surfaces will look transitional — acceptable and expected until Phase 02+.

**Verification required**: `pnpm --filter @finance-os/web typecheck && pnpm --filter @finance-os/web test`, `pnpm --filter @finance-os/ui typecheck`, `pnpm lint`, `pnpm -r --if-present build`, `pnpm test:e2e` (demo smoke), plus a browser pass (dark + light, 390px + desktop, reduced motion) on Cockpit / Patrimoine / Chat / Login via the `finance-os-browser-qa` skill, and `pnpm docs:check` if any doc is touched. Run `pnpm gitnexus:analyze` first so impact analysis is trustworthy.

---

Each page phase should carry its "correctness before restyle" register above as a pre-restyle checklist.
