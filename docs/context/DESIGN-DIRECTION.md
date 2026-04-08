# Finance-OS -- Direction Artistique

> **Derniere mise a jour** : 2026-04-08
> **Maintenu par** : agents (Claude, Codex) + humain
> Source de verite pour l'identite visuelle. Toute modification UI doit s'aligner sur ce document.

---

## Vision

Finance-OS est un **cockpit de finances personnelles haut de gamme** : un systeme vivant, elegant et precis. L'esthetique doit evoquer un tableau de bord financier professionnel, pas un SaaS generique.

---

## Principes fondateurs

| Principe | Description |
|---|---|
| **Clarte avant densite** | L'information est structuree pour une lecture rapide. Pas de surcharge. |
| **Hierarchie typographique forte** | Les niveaux de lecture sont immediatement perceptibles. |
| **Respiration intentionnelle** | Les espaces blancs sont des choix de design, pas du vide. |
| **Motion communicative** | L'animation sert la comprehension, jamais la decoration. |
| **Identite distinctive** | Finance-OS ne ressemble pas a un template SaaS. |

---

## Palette de couleurs (OKLch)

L'ensemble du systeme utilise l'espace colorimetrique **OKLch** (perceptuellement uniforme), ideal pour le dark mode.

### Tokens semantiques

| Token | Light | Dark |
|---|---|---|
| `--background` | `oklch(0.955 0.008 75)` ivoire chaud | `oklch(0.13 0.015 260)` navy-slate profond |
| `--foreground` | `oklch(0.20 0.02 260)` quasi noir | `oklch(0.93 0.01 80)` blanc chaud |
| `--card` | `oklch(0.98 0.005 80)` | `oklch(0.17 0.015 260)` |
| `--primary` | `oklch(0.65 0.18 75)` ambre/or | `oklch(0.75 0.16 75)` ambre/or clair |
| `--secondary` | `oklch(0.94 0.01 260)` | `oklch(0.22 0.015 260)` |
| `--destructive` | `oklch(0.55 0.22 25)` corail | `oklch(0.65 0.20 25)` corail clair |
| `--border` | `oklch(0.88 0.015 75)` | `oklch(1 0 0 / 8%)` blanc transparent |
| `--ring` | `oklch(0.70 0.16 75)` focus ambre | `oklch(0.75 0.16 75)` |

### Couleurs financieres

| Token | Valeur | Usage |
|---|---|---|
| `--positive` | emerald-500 | Revenus, tendances positives |
| `--negative` | corail (destructive) | Depenses, tendances negatives |
| `--warning` | amber | Cooldown, alertes moderees |
| `--info` | sky | Sync en cours, informations |

### Couleur primaire : Ambre/Or

- Hue OKLch ~75 degres
- C'est la signature visuelle de Finance-OS
- Utilisee pour : actions primaires, focus rings, etats actifs, accents
- **Jamais de bleu generique SaaS** comme couleur primaire

### Palette de graphiques (7 series)

```
chart-1 -> chart-7 : palette harmonieuse basee sur la famille ambre/or
```

---

## Profondeur de surface

3 niveaux de profondeur pour la hierarchie visuelle :

| Niveau | Token | Usage |
|---|---|---|
| Surface-0 | `--surface-0` | Arriere-plan page |
| Surface-1 | `--surface-1` | Cartes, elements de contenu |
| Surface-2 | `--surface-2` | Hover, elements eleves, popovers |

---

## Typographie

| Role | Font | Exemple |
|---|---|---|
| Corps et titres | **Inter Variable** | Texte general, labels, headings |
| Montants financiers | **JetBrains Mono Variable** | `12 450,00 EUR` |
| Display | **Inter Variable** | Grands titres decoratifs |

### Classe utilitaire
```css
.font-financial {
  font-family: var(--font-mono);  /* JetBrains Mono */
  font-variant-numeric: tabular-nums;
}
```

### Echelle typographique
- `text-xs` (12px), `text-sm` (14px), `text-base` (16px)
- `text-2xl`, `text-3xl`, `text-4xl` pour les KPI et grands chiffres
- Poids : `font-medium`, `font-semibold`, `font-bold`

---

## Accents ASCII

Finance-OS utilise des **accents ASCII** comme ponctuation visuelle distinctive :

```
◈  ↔  ◆  △  ◎  ▣  ⊞  ⚙  ♡
```

Usage : separateurs, labels de section, indicateurs d'etat. Ne jamais forcer -- utiliser quand ca sert la lisibilite.

---

## Theme Dark Mode

- Activation par classe `.dark` sur `<html>`
- **Le dark mode est le mode par defaut**
- Theme color PWA : `#0b1020`
- Pas de blanc pur -- fond `oklch(0.13 0.015 260)` (navy-slate profond)
- Texte `oklch(0.93 0.01 80)` (blanc chaud, pas blanc pur)
- La sidebar a ses propres tokens separes pour distinction visuelle

---

## Textures CSS

| Classe | Effet |
|---|---|
| `.texture-scanlines` | Effet retro digital (lignes horizontales subtiles) |
| `.texture-grain` | Bruit subtil overlay |
| `.bg-grid-dots` | Fond pointille |
| `.animate-shimmer` | Animation skeleton loading |
| `.glow-primary` | Halo premium sur elements primaires |
| `.surface-elevated` | Gradient carte eleve |

---

## Composants UI

### Bibliotheque
- **shadcn/ui** style "new-york" avec **Radix UI** comme primitives headless
- **CVA** (Class Variance Authority) pour la gestion des variantes
- **tailwind-merge** + **clsx** via utilitaire `cn()`

### Composants disponibles

| Composant | Variantes | Particularites |
|---|---|---|
| **Button** | 6 variantes x 7 tailles | Active scale 97%, SVG auto-size, focus ring 60% |
| **Badge** | 6 variantes, rounded-full | Pills pour statuts, couleurs contextuelles |
| **Card** | Header/Title/Description/Action/Content/Footer | Container queries pour responsive interne |
| **Input** | File support, selection colors | Etats disabled, aria-invalid |
| **Avatar** | Image + Fallback + Badge + Group | Radix-based |
| **Separator** | Horizontal/Vertical | Divider line |

### Pattern CVA

```tsx
const buttonVariants = cva("base-classes", {
  variants: {
    variant: { default: "...", destructive: "...", ghost: "..." },
    size: { default: "h-9 px-4", sm: "h-8 px-3", lg: "h-11 px-6" },
  },
  defaultVariants: { variant: "default", size: "default" },
})
```

### Attributs data
- `data-slot` : debugging et styling flexible
- `data-variant`, `data-size` : scoping additionnel

---

## Icones

- **lucide-react** exclusivement
- Sizing via `[&_svg]:size-4` (auto-sizing dans les composants)
- Tailles : `size-3` (small), `size-4` (default), `size-5` (large)
- `pointer-events-none` + `shrink-0` sur tous les SVG

---

## Motion & Interactions

### Philosophie
**Le mouvement sert la comprehension, jamais la decoration.**

### Dependances
- **motion/react** (Framer Motion v12+) : page transitions, layout animations, springs
- **CSS transitions** : hover, focus, color changes
- **CSS keyframes** : shimmer, pulse
- **Regle** : CSS d'abord, motion seulement si CSS insuffisant (layout, spring, exit)

### Courbes d'animation

| Courbe | Bezier | Usage |
|---|---|---|
| `--ease-out-expo` | `cubic-bezier(0.16, 1, 0.3, 1)` | Entrees rapides |
| `--ease-out-quart` | `cubic-bezier(0.25, 1, 0.5, 1)` | Standard |
| `--ease-in-out-quart` | `cubic-bezier(0.76, 0, 0.24, 1)` | Symétrique |
| `--ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Rebond subtil |

### Durees

| Token | Valeur | Usage |
|---|---|---|
| `--duration-fast` | 120ms | Hover, micro-interactions |
| `--duration-normal` | 200ms | Transitions standard |
| `--duration-slow` | 350ms | Transitions complexes |
| `--duration-enter` | 250ms | Entrees |
| `--duration-exit` | 180ms | Sorties (plus rapide) |

### Micro-interactions implementees
- Sidebar active indicator (layoutId spring)
- Mobile tab indicator
- Barres de progression animees
- Page-enter fade + translateY
- Mobile drawer bottom-sheet
- Sidebar collapse (CSS transition)
- Hover states subtils
- Focus ring 3px avec 50% opacite

### Interdit
- Stagger animations sur les listes
- Parallax
- SVG morphing
- Auto-play loops
- Scroll-jacking
- Librairies d'animation tierces (autre que motion/react)

### Inspirations
- **Apple Stocks** : transitions claires
- **Linear** : sidebar indicators
- **Vercel Dashboard** : motion restrainte

### Anti-inspirations
- Dribbble-style spectacle
- "Everything bounces"
- Delay chains
- Shape morphing

---

## Layout

### Structure desktop

```
+--sidebar (240px / 68px collapsed)--+--main content (max-w-7xl, mx-auto)--+
|                                     |                                      |
| Logo                                | Topbar (search + avatar)             |
| Navigation                          | Range selector + auth indicator      |
| (5 items + soon badges)             | Secondary nav (ancres sections)      |
|                                     |                                      |
|                                     | Sections dashboard                   |
|                                     | (grilles responsives)                |
+-------------------------------------+--------------------------------------+
```

### Structure mobile
- Sidebar cachee (bottom nav 5 items + drawer)
- Touch targets minimum 44px
- Safe area respectee
- Tables en scroll horizontal

### Grilles responsives

| Breakpoint | Columns | Usage |
|---|---|---|
| Default (mobile) | 1 | Stack vertical |
| `sm:` (640px) | 2 | Grilles simples |
| `md:` (768px) | 2 | Sidebar visible |
| `lg:` (1024px) | 2 | Grilles dashboard |
| `xl:` (1280px) | 4 | Full dashboard grid |

### Container queries
- `@container/card-header` pour le responsive interne aux cards

---

## Spacing

| Token | Valeur | Usage |
|---|---|---|
| Base | 4px | Unite de spacing |
| `gap-2` | 8px | Espacement elements proches |
| `gap-3` | 12px | Espacement cards |
| `gap-4` | 16px | Espacement sections |
| `gap-6` | 24px | Espacement majeur |
| Card padding | `py-6 px-6` | Contenu des cards |
| Section spacing | `space-y-8` | Entre sections |

### Radius

| Token | Valeur |
|---|---|
| `--radius-sm` | Badges |
| Base (`--radius`) | `0.625rem` (10px) |
| `--radius-2xl` | Bottom sheets |

---

## Ombres

| Token | Usage |
|---|---|
| `--shadow-xs` | Elements subtils |
| `--shadow-sm` | Cards |
| `--shadow-md` | Popovers |
| `--shadow-lg` | Modals |
| `--shadow-glow` | Effet premium (halo ambre) |

---

## Data visualization

- **Pas de librairie tierce** (pas de recharts, d3 chart lib, visx)
- Sparklines SVG custom : viewbox `320x112`, stroke 3px, caps arrondis
- Couleur : `var(--color-chart-2)`
- Hover interactif avec point highlighting
- Tables de donnees minimalistes : borders sur rows uniquement, headers muted
- Montants alignes a droite en `font-financial`
- Couleurs semantiques : `text-destructive` (depenses), `text-emerald-500` (revenus)

---

## Etats UI

Chaque widget doit supporter ces etats :

| Etat | Pattern |
|---|---|
| **Loading** | "Chargement..." + skeleton pulse |
| **Empty** | Texte muted centre ("Aucune donnee exploitable") |
| **Success** | Donnees normales |
| **Degraded** | Donnees stale avec badge warning |
| **Error** | Texte destructive + request ID + bouton retry |
| **Offline** | Message "Reseau requis" |
| **Permission-gated** | Admin-only avec CTA login |

---

## Patterns recurrents

| Pattern | Implementation |
|---|---|
| **Metric cards** | Grand chiffre + label + indicateur tendance (up/down/flat) |
| **Status badges** | Couleur par etat (emerald/amber/sky/destructive) |
| **Range selector** | Boutons 7j/30j/90j |
| **Toast notifications** | Fixed bottom-right, titre + description, couleurs par severite |
| **Banners** | Pleine largeur, gradient, CTA, role alert |
| **PWA install prompt** | Fixed bottom-center, cooldown 7j |
| **Empty states** | Texte muted, message contextuel |

---

## A eviter absolument

- AI slop / esthetique generique IA
- Clone de template SaaS
- Blanc pur (`#fff`) en dark mode
- Animations bloquantes
- Dependencies de visualization injustifiees
- Emojis dans l'interface (sauf demande explicite)
- Couleur primaire bleue
