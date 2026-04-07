# Finance-OS — Design Direction

> Source de vérité pour l'identité visuelle, les principes UX/UI et la direction artistique.

## Vision

Finance-OS est un cockpit financier personnel haut de gamme. Pas un dashboard SaaS, pas un tableau admin. C'est un **système vivant, élégant et précis** — l'impression d'un OS personnel, dense mais maîtrisé.

## Principes fondateurs

### 1. Clarté avant densité
Chaque page compréhensible en quelques secondes. L'essentiel d'abord, le détail accessible sans saturer.

### 2. Hiérarchie typographique forte
Taille, poids et espacement créent la hiérarchie — pas les bordures. Montants financiers en `font-financial` (JetBrains Mono, tabular figures).

### 3. Respiration intentionnelle
L'espace blanc guide le regard et réduit la charge cognitive. `space-y-8` entre sections, `gap-4` à `gap-6` dans les grilles.

### 4. Motion qui communique
Animations pour signaler un changement d'état, pas pour décorer. Page transitions (`AnimatePresence`), navigation indicators (`layoutId` spring), progress bars animées.

### 5. Identité distinctive
Finance-OS n'est pas un clone shadcn. Signature ambre/or (`oklch ~75°`), surfaces à 3 niveaux de profondeur, accents ASCII comme ponctuation visuelle.

## Identité visuelle

### Palette de couleurs (OKLch)

| Rôle | Dark mode | Light mode |
|------|-----------|------------|
| Background | `oklch(0.13 0.015 260)` — navy-slate | `oklch(0.98 0.004 75)` — warm off-white |
| Card | `oklch(0.17 0.012 260)` | `oklch(1 0 0)` |
| Primary | `oklch(0.78 0.155 75)` — ambre/or | `oklch(0.62 0.17 70)` |
| Positive | Emerald teal | Emerald |
| Negative | Soft coral | Coral/red |
| Warning | Amber | Amber |

### Typographie

- **Inter Variable** — Corps, titres, navigation. Feature settings : `cv11`, `ss01`, `ss03`.
- **JetBrains Mono Variable** — Montants (`.font-financial`), accents ASCII, code. `tnum`, `zero`.

### Accents ASCII

Les glyphes ASCII (◈, ↔, ◆, △, ◎, ▣, ⊞, ⚙, ♡) servent d'accent visuel distinctif dans la navigation et les en-têtes de section. Composants disponibles :
- `AsciiLogo` — logo ASCII du produit
- `AsciiDivider` — séparateurs typographiques (thin/bold)
- `AsciiFrame` — cadre corner pour mettre en valeur un élément
- `AsciiStatusLine` — ligne de statut monospace style terminal
- `SectionGlyph` — glyphe de section individuel

Les accents ASCII doivent rester **au service** de l'interface. Jamais de mur d'ASCII art, jamais au détriment de la lisibilité.

### Textures CSS

- `.texture-scanlines` — lignes de scan subtiles (retro-digital)
- `.texture-grain` — bruit de grain en overlay
- `.bg-grid-dots` — grille de points pour sections hero
- `.animate-shimmer` — chargement shimmer premium (remplace `animate-pulse`)

### Surfaces et profondeur

3 niveaux : `surface-0` (fond), `surface-1` (éléments dans cartes), `surface-2` (hover/élevé). Les cartes utilisent `rounded-2xl` avec shadow subtile et hover shadow lift.

## Charts et data-viz

- **D3.js** pour tous les graphiques — liberté créative maximale
- `D3Sparkline` — sparkline interactive avec tooltip, crosshair, gradient area fill, animation d'entrée
- `MiniSparkline` — mini sparkline inline pour tableaux et KPI cards
- Courbes en `curveCatmullRom` (smooth, naturel)
- Palette chart : 7 couleurs harmonieuses (`chart-1` → `chart-7`)

## Navigation et shell

- **Sidebar desktop** (240px / 68px collapsed) avec sections finances/système, ASCII accents, logo
- **Bottom nav mobile** avec 5 tabs + drawer "Plus"
- **Command palette** (`Cmd+K`) — recherche et navigation rapide
- **Theme toggle** — dark/light avec persistence localStorage
- **Page transitions** — `AnimatePresence` avec fade + translateY

## Micro-interactions

- Navigation active indicator : spring `layoutId` (sidebar + mobile tabs)
- Range filter pill : `layoutId` animated pill background
- Sidebar collapse : `motion.span` rotation du chevron
- Mobile icon scale bounce : `motion.span` scale sur tab actif
- KPI cards : stagger d'entrée avec `motion.div` delay
- Top expenses list : stagger d'entrée latéral
- Progress bars objectifs : animated width + gradient
- Button active : `active:scale-[0.97]` press effect
- Card hover : shadow lift transition

## Ce qu'il faut éviter

- AI slop (gradients arc-en-ciel, glow partout, glassmorphism gratuit)
- Clone SaaS (sidebar 30 items, shadcn default non modifié)
- Surcharge (15 badges par ligne, cartes identiques)
- ASCII forcé (jamais de mur ASCII, toujours au service de l'UI)
- Animations bloquantes (stagger lists, parallax, scroll jacking)
- Dépendances non justifiées

## Relation marque ↔ design system ↔ produit

1. **Marque** (ambre/or, Inter/JetBrains Mono, ASCII accents, surface depth) → identité
2. **Design system** (`packages/ui` + `globals.css`) → tokens et composants
3. **Produit** (`apps/web`) → application aux surfaces métier

Toute modification visuelle doit être documentée. Tout nouveau composant s'appuie sur les tokens existants.
