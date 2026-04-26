# Web UI Context Pack — Finance-OS

> Auto-generated. Sources: DESIGN.md, apps/web/AGENTS.md, docs/context/DESIGN-DIRECTION.md
> Do not edit directly — regenerate with `pnpm agent:context:pack`

## Design System

# Finance-OS — Direction artistique

> **Source de vérité visuelle.** Toute modification UI doit partir d'ici.
> Complément : [`docs/frontend/design-system.md`](docs/frontend/design-system.md)
> (tokens, composants, patterns) et [`docs/context/DESIGN-DIRECTION.md`](docs/context/DESIGN-DIRECTION.md)
> (contexte produit plus large).

## Vision — "Aurora Pink"

Finance-OS est un **cockpit financier personnel haut de gamme**. Pas un
dashboard SaaS, pas un tableau admin générique. C'est un produit personnel,
dense mais maîtrisé, qui donne l'impression d'un OS intime — chaud, vivant,
précis.

La direction actuelle, "Aurora Pink", s'inspire de l'aurore urbaine, du néon
parisien au coucher de soleil et des interfaces ciné-SF contemporaines
(Dune, Blade Runner 2049), retenues pour un usage quotidien.

**Parti pris en une phrase :** *un cockpit dense et chaud où le rose pulse
comme une signature, le violet étend l'intention en secondaire, et les
données restent lisibles comme un tableau de bord d'avion.*

## Principes

1. **Clarté avant densité.** Chaque page compréhensible en quelques secondes.
2. **Hiérarchie typographique forte.** Taille, poids, espacement. Jamais les
   bordures. Montants en `font-financial` (JetBrains Mono, tabular).
3. **Respiration intentionnelle.** `space-y-10` entre sections, `gap-6` en
   grille. L'espace guide le regard.
4. **Motion qui communique.** Anime pour signaler un état, pas pour décorer.
   Respecte `prefers-reduced-motion` partout.
5. **Identité distinctive.** La palette Aurora Pink + l'accent ASCII + le
   composite TextPressure/RotatingText en hero font que Finance-OS ne peut
   être confondu avec aucun clone shadcn.

## Palette Aurora Pink

### Couleurs fondatrices (OKLCH)

| Rôle | Dark mode | Light mode | Usage |
|------|-----------|------------|-------|
| `--primary` | `oklch(0.72 0.19 355)` rose magenta | `oklch(0.58 0.21 355)` rose profond | Signature brand, CTA, actifs nav |
| `--accent-2` | `oklch(0.70 0.22 295)` violet électrique | `oklch(0.52 0.24 295)` plum riche | Accent secondaire, admin badges |
| `--background` | `oklch(0.12 0.02 325)` midnight plum | `oklch(0.975 0.006 355)` pearl chaud | Fond de page |
| `--card` | `oklch(0.16 0.025 325)` | `oklch(0.99 0.004 355)` | Surfaces containers |
| `--surface-0/1/2/3` | 4 niveaux progressifs | 4 niveaux progressifs | Élévation |

### Triade Aurora (gradients décoratifs)

- `--aurora-a` : rose, pôle brand
- `--aurora-b` : magenta-plum, passage
- `--aurora-c` : indigo-violet, ancrage froid

Utilisée dans `.text-aurora`, `.bg-aurora-mesh`, Button `variant="aurora"`,
BrandMark, RangePill actif, bordure `BorderGlow`.

### Sémantique finance (toujours dissociée de la brand)

| Token | Dark | Light | Usage strict |
|-------|------|-------|-------------|
| `--positive` | emerald `H=160` | emerald foncé | Revenus, gains, haussier |
| `--negative` | coral `H=25` | coral foncé | Dépenses, pertes, baissier |
| `--warning` | amber `H=75` | amber foncé | Attente, cooldown, dégradation |

**Règle non négociable :** jamais de rose ou de violet pour communiquer un
statut financier. Le rose = identité, pas signal.

### Chart palette

7 couleurs harmonieuses, rose → violet → indigo → emerald → gold → plum →
coral (`--chart-1` à `--chart-7`). Utiliser par ordre dans les séries pour
garder la cohérence.

## Typographie

- **Inter Variable** (`--font-sans`) — corps, titres, navigation. Features :
  `cv11`, `ss01`, `ss03`. Axes variables utilisables : `wght`, `opsz`.
- **JetBrains Mono Variable** (`--font-mono`) — montants via `.font-financial`
  (auto `tnum`, `zero`), accents ASCII, code, status lines cockpit.
- **Compressa VF** (chargée à la demande par le composant `TextPressure`) —
  uniquement pour le titre hero du cockpit, où la pression typographique
  fait partie de la signature.

## Composants signature (React Bits)

Les composants React Bits officiels (TS + Tailwind) sont copiés dans
`apps/web/src/components/reactbits/` avec attribution, puis adaptés aux
tokens Aurora Pink. Voir
[`apps/web/src/components/reactbits/README.md`](apps/web/src/components/reactbits/README.md).

| Composant | Emplacement canonique | Pourquoi |
|---|---|---|
| `TextPressure` | Hero cockpit ("Cockpit") | Pression variable-font = signature unique |
| `RotatingText` | Sous-titre cockpit | Rotation contenue de la tagline |
| `ShinyText` | Titre login | Moment de brillance sur la marque |
| `VariableProximity` | Titres de section (hover-flourish) | Respiration discrète |
| `CountUp` | KPI tiles | Révélation numérique premium |
| `SpotlightCard` | KPI tiles (`KpiTile`) | Suivi du curseur sur les données |
| `BorderGlow` | Login / hero signature | Halo rose→violet animé |
| `AuroraShape` | Backdrop hero + login | Blob décoratif léger (pas de WebGL) |

**Règle d'or :** un composant React Bits n'est utilisé que s'il renforce
l'identité ou la lisibilité dans une surface concrète. Pas de "démo
technique".

## Surfaces canoniques Finance-OS

| Composant | Rôle |
|---|---|
| `BrandMark` | Logo avec halo conic rotatif (4 tailles) |
| `AuroraBackdrop` | Wash ambiant radial + grille pointillée pour hero |
| `KpiTile` | KPI unique source de vérité (SpotlightCard + CountUp) |
| `Panel` | Workhorse data-dense, rail coloré optionnel, header `tone` |
| `RangePill` | Segmented control animé via `layoutId` |
| `PageHeader` | Eyebrow + titre display + description + actions |
| `StatusDot` | Indicateur `ok / warn / err / idle / live / brand / violet` |

Ces composants sont la **première intention** sur toute nouvelle surface.
Ne pas coder à la main un KPI, un panel ou un range-pill si l'une de ces
primitives convient.

## Motion

- `--ease-out-expo` pour les entrées premium
- `--ease-spring` pour les micro-interactions
- `--ease-aurora` pour les transitions brand (reveal, gradient drift)
- Durées : `fast 120ms`, `normal 200ms`, `slow 350ms`, `enter 280ms`, `exit 180ms`
- Animations décoratives (`halo-spin`, `aurora-drift`, `pulse-glow`) gelées
  sous `prefers-reduced-motion`

## Textures / effets

- `.bg-aurora-mesh` — wash brand pour hero
- `.bg-aurora-mesh-soft` — version atténuée pour l'ambiance globale du shell
- `.bg-grid-dots` — grille pointillée (hero, empty states)
- `.bg-stripe-pattern` — bandes diagonales brand (démo/admin strips)
- `.texture-scanlines` / `.texture-grain` — accents retro-cockpit
- `.glass-surface` — glassmorphism tinted brand, usage parcimonieux
- `.hair-rule` — séparateur en gradient doux
- `.animate-shimmer` — loading premium, remplace `animate-pulse`
- `.text-aurora` — texte en gradient rose→magenta→violet
- `.focus-glow` — ring de focus brand

## Ce qu'on évite

- **AI slop** : gradients arc-en-ciel, glow gratuit, glassmorphism partout.
- **Clone SaaS** : sidebar à 30 items, shadcn par défaut non modifié.
- **Sur-design** : KPI tiles qui luttent contre les chiffres.
- **Mur ASCII** : les glyphes restent au service, jamais du motif.
- **Rose sémantique** : le rose signale l'identité, pas un état métier.
- **Animations bloquantes** : scroll-jacking, parallax, stagger > 400ms.
- **Dépendances non justifiées** : React Bits est installé manuellement
  (copie TS-Tailwind officielle), pas un package npm.

## Relation marque ↔ design system ↔ produit

1. **Marque Aurora Pink** (rose + violet + Inter/JetBrains Mono + ASCII + Compressa hero) → identité
2. **Design system** (`packages/ui` + `globals.css` + `apps/web/src/components/{surfaces,brand,reactbits}`) → tokens et primitives
3. **Produit** (`apps/web/src/routes/_app/*`) → surfaces métier qui composent ces primitives

Toute modification visuelle doit :
- partir des tokens (`var(--primary)`, `var(--accent-2)`, `var(--aurora-*)`)
- réutiliser les surfaces (`KpiTile`, `Panel`, `PageHeader`, `RangePill`)
- garder les sémantiques finance intactes
- mettre à jour cette doc + `docs/frontend/*.md` dans le même change.


## Web App Rules

# AGENTS.md - apps/web

Scope: `apps/web/**`

## Local Rules

- Stay loader-first. Route-critical data belongs in loaders and should prewarm Query with `ensureQueryData` or `ensureInfiniteQueryData`.
- Keep auth SSR-consistent: prefetch `/auth/me`, avoid demo-to-admin flashes, and fall back to demo instead of crashing SSR when auth is unavailable.
- Keep server state in Query options under `src/features/**`; do not mirror server state into local component state.
- Keep dashboard goals in [src/features/goals/query-options.ts](src/features/goals/query-options.ts) and route admin writes through the feature API helpers so `x-request-id`, safe error normalization, and admin gating stay consistent.
- Keep dashboard budget/objective/projection/alert conventions aligned with the existing card modules:
  - category budgets stay in [src/components/dashboard/monthly-category-budgets-card.tsx](src/components/dashboard/monthly-category-budgets-card.tsx) with deterministic demo read-only behavior and admin-only edits.
  - personal objectives stay in [src/components/dashboard/personal-financial-goals-card.tsx](src/components/dashboard/personal-financial-goals-card.tsx) with safe local persistence and explicit non-blocking alert copy.
  - month-end projections stay in [src/components/dashboard/month-end-projection-card.tsx](src/components/dashboard/month-end-projection-card.tsx) as informative calculations that never trigger hidden writes or provider calls.
  - alert copy must remain fail-soft and action-guiding (informative in demo, actionable in admin) without implying hard-blocking errors.
- Keep dashboard derived recompute status and trigger behavior in the shared dashboard feature helpers so admin gating, retry-safe errors, and demo mocks stay consistent with the API contract.
- Keep the news experience (`/_app/actualites`, `news-feed.tsx`, `dashboard-query-options.ts`, `dashboard-api.ts`, demo fixtures, client fallback behavior, provider health, clusters, and context preview) aligned with [../../docs/context/NEWS-FETCH.md](../../docs/context/NEWS-FETCH.md), and update that document whenever this feature changes.
- Keep the markets experience (`/_app/marches`, `src/components/markets/*`, `src/features/markets/*`, demo fixtures, source/freshness badges, D3 visuals, and refresh affordances) aligned with [../../docs/context/MARKETS-MACRO.md](../../docs/context/MARKETS-MACRO.md); demo must stay deterministic, admin reads must stay snapshot-first, and the UI must never imply fake real-time precision.
- Keep dashboard health signals in [src/components/dashboard/dashboard-health.ts](src/components/dashboard/dashboard-health.ts) and [src/components/dashboard/dashboard-health-panel.tsx](src/components/dashboard/dashboard-health-panel.tsx); demo must stay deterministic from the fixture matrix, admin must derive one global summary plus selective widget badges from loader/query data only.
- Keep the Powens manual sync cooldown UI in [src/features/powens/manual-sync-coo

## Design Direction

# Finance-OS — Direction Artistique

> **Dernière mise à jour** : 2026-04-15
> **Maintenu par** : agents (Claude, Codex) + humain
> Source de vérité pour l'identité visuelle. Toute modification UI doit s'aligner sur ce document.
>
> La référence détaillée reste [`DESIGN.md`](../../DESIGN.md) et
> [`docs/frontend/design-system.md`](../frontend/design-system.md) ;
> ce document est le résumé tenu pour les chats externes et les agents
> qui n'ont pas accès à la racine du repo.

---

## Vision — Aurora Pink

Finance-OS est un **cockpit financier personnel haut de gamme**.
Pas un SaaS B2B. Pas un dashboard admin générique.

La direction artistique actuelle, **Aurora Pink**, s'inspire de l'aurore
urbaine, du néon parisien au coucher de soleil, et des interfaces ciné-SF
contemporaines, retenues pour un usage quotidien. Le rose est la signature
de la marque ; le violet l'étend en secondaire ; les données financières
gardent leurs couleurs sémantiques intactes.

**Parti pris en une phrase :** *un cockpit dense et chaud où le rose pulse
comme une signature, le violet étend l'intention en secondaire, et les
données restent lisibles comme un tableau de bord d'avion.*

---

## Principes fondateurs

| Principe | Description |
|---|---|
| **Clarté avant densité** | L'information structurée pour une lecture rapide. Pas de surcharge. |
| **Hiérarchie typographique forte** | Les niveaux de lecture sont immédiatement perceptibles. |
| **Respiration intentionnelle** | Les espaces blancs sont des choix de design, pas du vide. |
| **Motion communicative** | L'animation sert la compréhension, jamais la décoration. |
| **Identité distinctive** | Finance-OS ne ressemble pas à un template SaaS. |

---

## Palette — OKLCH

### Tokens sémantiques

| Token | Light | Dark |
|---|---|---|
| `--background` | `oklch(0.975 0.006 355)` pearl chaud | `oklch(0.12 0.02 325)` midnight plum |
| `--foreground` | `oklch(0.16 0.02 325)` quasi-noir plum | `oklch(0.96 0.01 355)` blanc rosé |
| `--card` | `oklc

## Key Constraints

- Aurora Pink brand identity (rose magenta primary, electric violet accent-2)
- Inter + JetBrains Mono typography
- 4-step surface depth system (surface-0/1/2/3)
- Financial amounts use .font-financial class
- Semantic color tokens for financial data (positive/negative/warning)
- Mobile-responsive, prefers-reduced-motion
- Do not touch the Liquid Ether hero on the cockpit page
