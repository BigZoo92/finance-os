# Motion & Interactions — Finance-OS

> Principes motion, micro-interactions autorisées, patterns d'états, contraintes performance.

## Philosophie

La motion dans Finance-OS sert **la compréhension**, jamais la décoration. Chaque animation doit répondre à une question : "qu'est-ce qui vient de changer ?" ou "où suis-je maintenant ?".

## Dépendances

- **`motion` (framer-motion v12+)** — pour les animations complexes (layout, gestures, AnimatePresence)
- **CSS transitions/transforms** — pour les hover states, focus states, et transitions simples
- **CSS keyframes** — pour les animations de page (`page-enter`)

**Règle** : utiliser CSS d'abord, `motion` uniquement quand CSS ne suffit pas (layout animations, spring physics, exit animations).

## Courbes d'animation (tokens CSS)

| Variable | Courbe | Usage |
|----------|--------|-------|
| `--ease-out-expo` | `cubic-bezier(0.16, 1, 0.3, 1)` | Entrées de page, expansions |
| `--ease-out-quart` | `cubic-bezier(0.25, 1, 0.5, 1)` | Transitions standard |
| `--ease-in-out-quart` | `cubic-bezier(0.76, 0, 0.24, 1)` | Transitions bidirectionnelles |
| `--ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Micro-interactions (attention) |
| `--ease-aurora` | `cubic-bezier(0.22, 1, 0.36, 1)` | Transitions brand (gradient drift, halo) |

## Durées (tokens CSS)

| Variable | Valeur | Usage |
|----------|--------|-------|
| `--duration-fast` | 120ms | Hover states, couleurs |
| `--duration-normal` | 200ms | Transitions de propriété standard |
| `--duration-slow` | 350ms | Sidebar collapse, expansions |
| `--duration-enter` | 280ms | Entrées de page, modals |
| `--duration-exit` | 180ms | Fermetures (sorties plus rapides) |

## Animations décoratives brand (Aurora Pink)

| Classe | Rôle | Durée |
|--------|------|-------|
| `.animate-aurora` | Drift lent du gradient brand sur les hero / shapes | 18s loop |
| `.halo-spin` | Rotation lente du halo conic du `BrandMark` | 18s loop |
| `.animate-pulse-glow` | Respiration subtile sur alertes actives | 2.2s loop |
| `.animate-shimmer` | Loading premium rose-tinted | 1.8s loop |
| `.animate-number-flip` | Révélation verticale d'un nombre (KPI diff) | 320ms |

Ces animations sont **figées automatiquement** sous `prefers-reduced-motion`
via le layer `@layer base` de `globals.css` (toute durée ramenée à 0.01ms).

## Composants motion signature (React Bits adaptés)

| Composant | Motion clé | Perf |
|---|---|---|
| `TextPressure` | RequestAnimationFrame + `font-variation-settings` | Coût CPU : faible, plafonné par le navigateur. Désactivé sous reduced-motion. |
| `RotatingText` | AnimatePresence + stagger per-character | Light. Auto-pause reduced-motion. |
| `SpotlightCard` | Radial gradient suivant curseur | CSS-only. Désactivé reduced-motion. |
| `BorderGlow` | Conic mask animé + box-shadow calc | Moyen — limite à 1 instance à la fois. Désactivé reduced-motion. |
| `CountUp` | Motion spring sur useMotionValue | Light. Tween skippé reduced-motion. |
| `VariableProximity` | RAF + fontVariationSettings | Light. Gèle au repos reduced-motion. |
| `AuroraShape` | `.animate-aurora` CSS | Quasi-gratuit. |

## Micro-interactions implémentées

### Navigation sidebar active indicator

```tsx
<motion.div
  layoutId="sidebar-active-indicator"
  className="absolute inset-0 rounded-lg bg-sidebar-accent"
  transition={{ type: 'spring', bounce: 0.15, duration: 0.5 }}
/>
```

L'indicateur de page active glisse en douceur entre les items de navigation. Utilise `layoutId` pour que Framer Motion interpole automatiquement la position.

### Navigation mobile tab indicator

```tsx
<motion.div
  layoutId="mobile-tab-indicator"
  className="absolute -top-px left-2 right-2 h-0.5 rounded-full bg-primary"
  transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
/>
```

Barre colorée qui suit le tab actif sur la bottom nav mobile.

### Progress bars (objectifs)

```tsx
<motion.div
  className="h-full rounded-full bg-primary"
  initial={{ width: 0 }}
  animate={{ width: `${progress}%` }}
  transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
/>
```

Animation d'entrée pour les barres de progression.

### Page enter

```css
.page-enter {
  animation: page-fade-in var(--duration-enter) var(--ease-out-expo);
}

@keyframes page-fade-in {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
```

Chaque page entrante fait un léger fade-in avec translation vers le haut.

### Mobile drawer (bottom sheet)

```tsx
<motion.div
  initial={{ y: '100%' }}
  animate={{ y: 0 }}
  exit={{ y: '100%' }}
  transition={{ type: 'spring', bounce: 0.1, duration: 0.4 }}
/>
```

Le drawer "Plus" sur mobile entre par le bas avec un spring naturel.

### Sidebar collapse

La sidebar utilise une transition CSS sur `width` :
```
transition-duration: var(--duration-slow)
transition-timing-function: var(--ease-out-expo)
```

### Hover states

Tous les éléments interactifs dans les cartes :
```tsx
className="transition-colors hover:bg-surface-2"
style={{ transitionDuration: 'var(--duration-fast)' }}
```

### Focus states

Géré globalement par shadcn/ui via le token `--ring` (ambre).

## Patterns d'états

### Loading

- **Squelettes** : `animate-pulse rounded bg-muted` avec dimensions approximatives
- **Texte placeholder** : "Chargement..." en `text-muted-foreground`
- **Progress indeterminate** : `h-2 animate-pulse rounded bg-amber-300/50`

### Empty

- Texte centré en `text-muted-foreground` avec padding vertical (`py-8 text-center`)
- Message clair en français : "Aucune transaction sur cette période."

### Error

- Texte en `text-destructive` avec message d'erreur
- Fail-soft : la page reste utilisable, seule la section en erreur affiche le message

### Success

- Toast via `pushToast({ tone: 'success' })` (système existant)
- Badge vert `secondary` pour les statuts positifs

## Contraintes performance

### Règles absolues

1. **Jamais de layout animation sur les listes** — `layoutId` est réservé aux indicateurs de navigation (1-2 éléments max)
2. **Préférer `transform` et `opacity`** — les seules propriétés animées par le GPU sans relayout
3. **CSS > motion** — si c'est faisable en CSS transition, ne pas utiliser `motion`
4. **`will-change: auto`** — ne pas forcer `will-change` sauf mesure prouvant un gain
5. **Aucune animation qui bloque le rendu initial** — `page-enter` est non bloquant (CSS)

### Ce qui est interdit

- Animations de listes (chaque item qui entre séquentiellement)
- Parallax ou scroll-driven effects
- Animations SVG complexes (paths, morphing)
- Auto-play ou animations en boucle permanente
- Libraries d'animation au-delà de `motion` (pas de GSAP, anime.js, etc.)

### Mesure

Avant d'ajouter une animation, vérifier dans Chrome DevTools > Performance :
- Pas de layout thrashing (forced reflow)
- Frame rate stable à 60fps
- Main thread occupé < 16ms par frame

## Comportements à reproduire

1. **Apple Stocks** : transition entre synthèse et détail, hiérarchie numérique claire
2. **Linear** : sidebar avec indicateur actif animé, transitions de page subtiles
3. **Vercel Dashboard** : densité maîtrisée, hover states subtils, motion minimale mais précise

## Comportements à éviter

1. Dribbble-style : animations spectaculaires mais inutilisables
2. "Everything bounces" : spring partout sans raison
3. Delay chains : éléments qui apparaissent les uns après les autres (stagger)
4. Morphing de formes : complexe, coûteux, pas nécessaire
5. Scroll-jacking : le scroll doit rester natif
