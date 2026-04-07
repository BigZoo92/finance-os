# Design System — Finance-OS

> Tokens, composants, patterns et règles d'usage du système de design.

## Source de vérité

- **Tokens CSS** : `packages/ui/src/styles/globals.css`
- **Composants partagés** : `packages/ui/src/components/ui/`
- **Direction design** : `DESIGN.md` (racine)

## Tokens

### Couleurs sémantiques

| Token | Rôle |
|-------|------|
| `--background` / `--foreground` | Fond et texte de page |
| `--card` / `--card-foreground` | Conteneurs Card |
| `--primary` / `--primary-foreground` | Accent de marque (ambre/or) |
| `--secondary` | Arrière-plan secondaire |
| `--muted` / `--muted-foreground` | Texte et surfaces atténuées |
| `--accent` | Surfaces accentuées |
| `--destructive` | Erreurs, suppressions |
| `--border` | Bordures globales |
| `--ring` | Focus ring |

### Couleurs financières

| Token | Rôle |
|-------|------|
| `--positive` | Revenus, gains, tendance haussière |
| `--negative` | Dépenses, pertes, tendance baissière |
| `--warning` | Alertes, attentes, cooldowns |

### Surfaces (profondeur)

| Token | Dark | Light | Usage |
|-------|------|-------|-------|
| `surface-0` | `oklch(0.13...)` | `oklch(0.97...)` | Fond de page |
| `surface-1` | `oklch(0.17...)` | `oklch(0.99...)` | Éléments dans les cartes |
| `surface-2` | `oklch(0.21...)` | `oklch(1 0 0)` | Hover, éléments élevés |

### Chart palette

7 couleurs harmonieuses (`chart-1` → `chart-7`) du chaud au froid, utilisables dans les graphiques et data viz.

### Typographie

| Variable CSS | Valeur | Usage |
|-------------|--------|-------|
| `--font-sans` | Inter Variable | Corps de texte, titres |
| `--font-mono` | JetBrains Mono Variable | Montants financiers |
| `--font-display` | Inter Variable | Titres display |

**Classe utilitaire** : `.font-financial` — applique `font-mono` + `tnum` + `zero` pour les montants.

### Espacement

Tailwind default scale (4px base). Conventions inter-sections :
- Entre sections de page : `space-y-8`
- Dans les grilles : `gap-4` (compact) à `gap-6` (aéré)
- Padding de carte : `p-4` à `p-6`
- Padding de page : `px-4 py-6` (mobile) / `px-8` (desktop)

### Rayon

| Token | Valeur | Usage |
|-------|--------|-------|
| `radius-sm` | calc(0.625rem - 4px) | Badges, éléments inline |
| `radius-md` | calc(0.625rem - 2px) | Inputs, boutons secondaires |
| `radius-lg` | 0.625rem | Cartes, boutons principaux |
| `radius-xl` | calc(0.625rem + 4px) | Modals, sheets |
| `radius-2xl` | calc(0.625rem + 10px) | Bottom sheets mobile |

### Motion

| Variable | Valeur | Usage |
|----------|--------|-------|
| `--ease-out-expo` | `cubic-bezier(0.16, 1, 0.3, 1)` | Entrées premium |
| `--ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Micro-interactions |
| `--duration-fast` | `120ms` | Hover states |
| `--duration-normal` | `200ms` | Transitions standard |
| `--duration-slow` | `350ms` | Expansions, collapses |
| `--duration-enter` | `250ms` | Entrées de page |
| `--duration-exit` | `180ms` | Sorties |

### Shadows

| Token | Usage |
|-------|-------|
| `--shadow-xs` | Éléments subtils |
| `--shadow-sm` | Boutons, badges |
| `--shadow-md` | Cartes élevées |
| `--shadow-lg` | Modals, popovers |
| `--shadow-glow` | Accent lumineux primaire |

## Composants partagés

### Composants de base (`packages/ui`)

| Composant | Exports | Usage |
|-----------|---------|-------|
| Button | `Button`, `buttonVariants` | Actions, CTA |
| Card | `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardAction`, `CardContent`, `CardFooter` | Conteneurs |
| Badge | `Badge`, `badgeVariants` | Statuts, labels |
| Input | `Input` | Champs de saisie |
| Avatar | `Avatar`, `AvatarImage`, `AvatarFallback`, `AvatarBadge`, `AvatarGroup` | Avatars |
| Separator | `Separator` | Séparateurs |

### Conventions de composition

1. **Un composant = un `data-slot`** — permet le ciblage CSS fiable
2. **Variants via CVA** — `class-variance-authority` pour les variantes de style
3. **Classe merge via `cn()`** — `tailwind-merge` + `clsx` pour la composition
4. **Toujours accepter `className`** — tout composant peut être étendu

## Patterns de layout

### Page standard

```tsx
<div className="space-y-8">
  {/* Header — titre + description + actions */}
  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <h2 className="text-2xl font-semibold tracking-tight">{titre}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
    {/* Actions: filtres, boutons */}
  </div>

  {/* Contenu — grilles de cartes, tables, etc. */}
</div>
```

### KPI Card

```tsx
<Card>
  <CardContent className="p-5">
    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
    <p className="mt-1 font-financial text-2xl font-semibold tracking-tight">{value}</p>
    {/* Trend badge optionnel */}
  </CardContent>
</Card>
```

### Liste interactive

```tsx
<div className="rounded-lg border border-border/50 bg-surface-1 p-4 transition-colors hover:bg-surface-2"
     style={{ transitionDuration: 'var(--duration-fast)' }}>
  {/* Contenu de l'item */}
</div>
```

### Range filter (sélecteur de période)

```tsx
<div className="inline-flex items-center rounded-lg border border-border bg-surface-1 p-1">
  {options.map(option => (
    <button
      className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
        active ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
      }`}
      style={{ transitionDuration: 'var(--duration-fast)' }}
    >{option.label}</button>
  ))}
</div>
```

## Patterns responsive

### Breakpoints

| Breakpoint | Largeur | Usage |
|------------|---------|-------|
| Default | <768px | Mobile portrait |
| `md:` | 768px | Tablette, desktop étroit |
| `lg:` | 1024px | Desktop — sidebar visible |
| `xl:` | 1280px | Desktop large — grilles 3-4 colonnes |

### Règles mobile

- **Bottom navigation** fixe pour les 5 pages principales + "Plus" drawer
- **Tables** : scroll horizontal (`overflow-x-auto -mx-6`) sur mobile
- **Grilles** : `grid-cols-1` → `sm:grid-cols-2` → `xl:grid-cols-3/4`
- **Sidebar** : cachée sous `lg:`, remplacée par bottom nav
- **Touch targets** : minimum 44px (`py-2.5` + `py-3` pour les items de nav)
- **Safe area** : `.safe-area-bottom` sur la bottom nav (iPhone notch)

## Patterns data-dense

### Tables financières

- Font `font-financial` pour les montants
- Couleurs sémantiques : `text-positive` (revenus), `text-negative` (dépenses)
- Hover subtil : `hover:bg-surface-1` avec transition rapide
- Labels uppercase tracking-wider pour les en-têtes
- Alignement droit pour les montants

### Squelettes de chargement

- `animate-pulse rounded bg-muted` pour les loading states
- Hauteur et largeur approximatives du contenu final
- 3-5 squelettes pour les listes

## Règles d'évolution

1. **Consulter `DESIGN.md`** avant toute modification UI
2. **Réutiliser les tokens** avant d'en créer de nouveaux
3. **Documenter les ajouts** : nouveau token → mettre à jour ce document
4. **Tester responsive** : tout changement doit être vérifié à 375px (mobile) et 1280px (desktop)
5. **Préserver la cohérence** : utiliser les mêmes patterns pour les mêmes problèmes
