# Design System — Finance-OS (Aurora Pink)

> Tokens, composants, patterns et règles d'usage du système de design actuel.
> Direction artistique : voir [`DESIGN.md`](../../DESIGN.md).

## Source de vérité

- **Tokens CSS** : [`packages/ui/src/styles/globals.css`](../../packages/ui/src/styles/globals.css)
- **Composants shadcn upgradés** : [`packages/ui/src/components/ui/`](../../packages/ui/src/components/ui/)
- **Surfaces Finance-OS** : [`apps/web/src/components/surfaces/`](../../apps/web/src/components/surfaces/)
- **Identité brand** : [`apps/web/src/components/brand/`](../../apps/web/src/components/brand/)
- **React Bits adaptés** : [`apps/web/src/components/reactbits/`](../../apps/web/src/components/reactbits/)

## Tokens

### Couleurs sémantiques

| Token | Rôle |
|-------|------|
| `--background` / `--foreground` | Fond et texte de page |
| `--card` / `--card-foreground` | Conteneurs Card |
| `--primary` / `--primary-foreground` | Accent de marque — rose magenta |
| `--secondary` | Arrière-plan secondaire |
| `--muted` / `--muted-foreground` | Texte et surfaces atténuées |
| `--accent` / `--accent-foreground` | Surfaces accentuées brand-adjacent |
| `--accent-2` / `--accent-2-foreground` | **Violet électrique — accent secondaire** |
| `--destructive` | Erreurs, suppressions (coral H≈25°, distinct du rose brand) |
| `--border` | Bordures globales |
| `--ring` | Focus ring (rose) |

### Aurora triad (gradients)

| Token | Rôle |
|-------|------|
| `--aurora-a` | Pôle rose de la triade |
| `--aurora-b` | Passage magenta-plum |
| `--aurora-c` | Ancrage indigo-violet |

Utilisée dans `.text-aurora`, `.bg-aurora-mesh`, `.bg-aurora-mesh-soft`,
`Button variant="aurora"`, `BrandMark`, `RangePill` actif.

### Couleurs financières

| Token | Règle |
|-------|-------|
| `--positive` | Revenus, gains, tendance haussière. Emerald H=160°. |
| `--negative` | Dépenses, pertes, tendance baissière. Coral H=25° (≠ rose brand). |
| `--warning` | Alertes, cooldowns, dégradations. Amber H=70-75°. |

### Surfaces (profondeur)

| Token | Usage |
|-------|-------|
| `--surface-0` | Fond de page |
| `--surface-1` | Éléments dans les cartes, hover |
| `--surface-2` | Hover élevé, panneaux premium |
| `--surface-3` | Très ponctuel (modals imbriqués) |

### Chart palette

7 couleurs harmonieuses : rose → violet → indigo → teal → emerald → gold → coral.
Utiliser `--chart-1` à `--chart-7` dans l'ordre.

### Typographie

| Variable | Valeur | Usage |
|----------|--------|-------|
| `--font-sans` | Inter Variable | Corps, titres, navigation |
| `--font-mono` | JetBrains Mono Variable | Montants via `.font-financial`, ASCII, code |
| `--font-display` | Inter Variable | Titres display |

**Compressa VF** est chargée à la demande par le composant `TextPressure`
uniquement pour le hero du cockpit. Ne pas l'utiliser ailleurs.

**Classes utilitaires :**
- `.font-financial` — `font-mono` + `tnum` + `zero` + `ss01`
- `.font-tnum` — `tnum` + `zero` sur Inter (pour tableaux denses)

### Espacement

Tailwind default scale (4px base).

- Entre sections de page : `space-y-8` à `space-y-10`
- Dans les grilles : `gap-4` (compact) à `gap-6` (aéré)
- Padding de carte : `p-4` (compact) à `p-6` (aéré)
- Padding de page : `px-4 py-6` (mobile) / `px-8` (desktop)

### Rayon

| Token | Valeur | Usage |
|-------|--------|-------|
| `radius-sm` | `calc(0.75rem - 4px)` | Badges, éléments inline |
| `radius-md` | `calc(0.75rem - 2px)` | Inputs, boutons secondaires |
| `radius-lg` | `0.75rem` | Cartes, boutons principaux |
| `radius-xl` | `calc(0.75rem + 4px)` | Modals, sheets |
| `radius-2xl` | `calc(0.75rem + 10px)` | KPI tiles, hero |
| `radius-3xl` | `calc(0.75rem + 18px)` | Bottom sheets, hero cockpit |

### Motion

| Variable | Valeur | Usage |
|----------|--------|-------|
| `--ease-out-expo` | `cubic-bezier(0.16, 1, 0.3, 1)` | Entrées premium |
| `--ease-out-quart` | `cubic-bezier(0.25, 1, 0.5, 1)` | Sorties |
| `--ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Micro-interactions |
| `--ease-aurora` | `cubic-bezier(0.22, 1, 0.36, 1)` | Transitions brand (gradient drift) |
| `--duration-fast` | `120ms` | Hover states |
| `--duration-normal` | `200ms` | Transitions standard |
| `--duration-slow` | `350ms` | Expansions, collapses |
| `--duration-enter` | `280ms` | Entrées de page |
| `--duration-exit` | `180ms` | Sorties |

`prefers-reduced-motion` désactive les animations décoratives via le layer
`@layer base` de `globals.css`.

### Shadows

| Token | Usage |
|-------|-------|
| `--shadow-xs` | Éléments subtils |
| `--shadow-sm` | Boutons, badges |
| `--shadow-md` | Cartes élevées |
| `--shadow-lg` | Popovers, modals |
| `--shadow-xl` | Hero cards, mobile sheet |
| `--shadow-brand` | Card avec ring brand (rose) |
| `--shadow-glow` | Accent lumineux rose |
| `--shadow-glow-violet` | Accent lumineux violet |

## Primitives shadcn upgradées (`packages/ui`)

| Composant | Variantes nouvelles / notables |
|-----------|----|
| `Button` | `default`, `aurora` (gradient brand), `soft` (brand-tinted), `destructive`, `outline`, `secondary`, `ghost`, `link` + tailles `xs/sm/default/lg/xl/icon*` |
| `Card` | `tone="plain|brand|violet|elevated"` |
| `Badge` | `default`, `solid`, `glass`, `positive`, `warning`, `violet`, `destructive`, `outline`, `ghost`, `link`, `secondary` |
| `Input` | Focus ring rose, radius `lg`, surface `bg-surface-1`, lisibilité dense |
| `Avatar`, `Separator` | Tokens propagés automatiquement |

## Surfaces Finance-OS (`apps/web/src/components/surfaces/`)

| Composant | Règle d'usage |
|---|---|
| `PageHeader` | **Premier enfant** de toute page `_app/*`. Eyebrow + titre + description + actions. |
| `KpiTile` | Tout KPI numérique, toute page. Props `tone`, `size`, `loading`, `animate`. |
| `Panel` | Workhorse data-dense. `tone` pour rail coloré, `icon` + `actions` pour header riche, `bleed` pour table full-bleed. |
| `RangePill` | Segmented control animé (période, filtres). `layoutId` obligatoire. |
| `StatusDot` | Indicateur `ok/warn/err/idle/live/brand/violet`, option `pulse`. |

## Brand (`apps/web/src/components/brand/`)

| Composant | Usage |
|---|---|
| `BrandMark` | Logo + halo conic (tailles `sm/md/lg/xl`). Sidebar, login, topbar mobile. |
| `AuroraBackdrop` | Wash ambiant derrière hero (cockpit, login). Intensité réglable. |

## React Bits adaptés (`apps/web/src/components/reactbits/`)

Voir [`README.md`](../../apps/web/src/components/reactbits/README.md) du dossier.

| Composant | Surface canonique |
|---|---|
| `TextPressure` | Hero cockpit ("Cockpit") |
| `RotatingText` | Tagline cockpit |
| `ShinyText` | Titre login |
| `VariableProximity` | Titres de section (hover flourish) |
| `CountUp` | Tous les montants révélés à l'entrée |
| `SpotlightCard` | Intégré dans `KpiTile` |
| `BorderGlow` | Login card, hero brand-mark |
| `AuroraShape` | Blob décoratif behind-hero |

## Patterns de layout

### Page standard

```tsx
<div className="space-y-8">
  <PageHeader
    eyebrow="Transactions & budgets"
    icon="↔"
    title="Dépenses"
    description="Vos transactions, structure, budgets et projection."
    actions={<RangePill layoutId="depenses-range" ... />}
  />

  <section className="grid gap-6 md:grid-cols-2">
    <Panel title="Structure" icon="▣" tone="brand">…</Panel>
    <Panel title="Budgets" icon="◈">…</Panel>
  </section>
</div>
```

### KPI grid

```tsx
<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
  <KpiTile label="Patrimoine" value={balance} display={formatMoney(balance)} tone="brand" size="lg" />
  <KpiTile label="Cashflow"   value={cf}      display={formatMoney(cf)}      tone="positive" />
  <KpiTile label="Revenus"    value={inc}     display={formatMoney(inc)}     tone="positive" />
  <KpiTile label="Dépenses"   value={exp}     display={formatMoney(exp)}     tone="negative" />
</div>
```

### Hero cockpit

```tsx
<section className="relative isolate overflow-hidden rounded-3xl border border-border/50 px-10 py-10">
  <AuroraBackdrop intensity={0.42} />
  <TextPressure text="Cockpit" ... />
</section>
```

## Patterns responsive

### Breakpoints

| Breakpoint | Largeur | Usage |
|------------|---------|-------|
| Default | <768px | Mobile portrait |
| `md:` | 768px | Tablette, desktop étroit |
| `lg:` | 1024px | Desktop — sidebar visible |
| `xl:` | 1280px | Desktop large |

### Règles mobile

- **Bottom navigation** flottante (mx-3 mb-3), glass-surface, avec 5 tabs
  + drawer "Plus"
- **Sidebar** cachée sous `lg:`, remplacée par bottom nav
- **Safe area** : `.safe-area-bottom` (iPhone), `.safe-area-top` si notch
- **Touch targets** : minimum 44px
- **Tables** : scroll horizontal `overflow-x-auto -mx-6` en mobile
- **Grilles** : `grid-cols-1` → `sm:grid-cols-2` → `lg:grid-cols-3/4`

## Patterns data-dense

### Tables financières

- Font `font-financial` pour les montants
- Couleurs sémantiques : `text-positive` / `text-negative`, **jamais `text-primary` pour un statut**
- Hover subtil : `hover:bg-surface-1`
- Labels en `uppercase tracking-[0.14em]` pour les en-têtes
- Alignement droit pour les montants

### Loading states

- `animate-shimmer` (rose tinted) — remplace `animate-pulse`
- Hauteur et largeur approximatives du contenu final

### Empty states

- Centré, `text-muted-foreground/50`, message court
- Optionnel : un glyph ASCII + invitation à agir

## Règles d'évolution

1. **Consulter `DESIGN.md`** avant toute modification UI.
2. **Réutiliser les tokens** avant d'en créer de nouveaux.
3. **Utiliser les surfaces (`KpiTile`, `Panel`, `PageHeader`, `RangePill`, `StatusDot`)**
   avant de coder une surface à la main.
4. **Tester responsive** : 375px, 768px, 1024px, 1440px.
5. **Tester les deux thèmes** : dark + light à chaque changement.
6. **Respecter `prefers-reduced-motion`** : animations décoratives doivent se
   figer quand l'utilisateur l'a demandé (le layer `@layer base` de
   `globals.css` couvre le cas général, mais vérifier les animations
   JS-driven également).
7. **Documenter les ajouts** : nouveau token, nouvelle surface, nouveau
   pattern → mettre à jour ce document et `DESIGN.md`.
