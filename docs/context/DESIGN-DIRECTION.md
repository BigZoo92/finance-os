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
| `--card` | `oklch(0.99 0.004 355)` | `oklch(0.16 0.025 325)` |
| `--primary` | `oklch(0.58 0.21 355)` rose profond | `oklch(0.72 0.19 355)` rose magenta |
| `--accent-2` | `oklch(0.52 0.24 295)` plum riche | `oklch(0.70 0.22 295)` violet électrique |
| `--destructive` | `oklch(0.54 0.24 25)` coral | `oklch(0.68 0.20 25)` coral clair |
| `--border` | `oklch(0.88 0.012 325)` | `oklch(1 0 0 / 9%)` |
| `--ring` | `oklch(0.58 0.21 355)` rose | `oklch(0.72 0.19 355)` rose |

### Aurora triad (gradients brand)

| Token | Rôle |
|---|---|
| `--aurora-a` | Pôle rose |
| `--aurora-b` | Passage magenta-plum |
| `--aurora-c` | Ancrage indigo-violet |

Usage : `.text-aurora`, `.bg-aurora-mesh`, `Button variant="aurora"`,
`BrandMark`, `RangePill`, `BorderGlow`.

### Couleurs financières

| Token | Valeur | Usage |
|---|---|---|
| `--positive` | emerald H=160° | Revenus, tendances positives |
| `--negative` | coral H=25° (≠ rose brand) | Dépenses, tendances négatives |
| `--warning` | amber H=70-75° | Cooldown, alertes modérées |

**Règle non négociable :** jamais de rose ou de violet pour communiquer un
statut financier. Le rose = identité, pas signal.

### Couleur primaire : rose magenta

- Hue OKLCH ~355°
- Signature visuelle de Finance-OS
- Utilisée pour : actions primaires, focus rings, états actifs, accents
- **Jamais d'amber/or, plus jamais de bleu SaaS** comme couleur primaire

### Couleur secondaire : violet électrique

- Hue OKLCH ~295°
- Utilisée pour : admin badges, accents complémentaires, accent-2 surfaces
- Pair idéalement avec le rose pour le dégradé Aurora (rose → magenta → violet)

### Palette de graphiques (7 séries)

`--chart-1` à `--chart-7` : rose → violet → indigo → teal → emerald → gold → coral.
Ordre stable pour garantir la cohérence entre les widgets.

---

## Typographie

- **Inter Variable** — Sans-serif, corps + titres. Axes variables : `wght`, `opsz`. Features : `cv11`, `ss01`, `ss03`.
- **JetBrains Mono Variable** — Mono, montants via `.font-financial`, glyphes ASCII, terminal accents.
- **Compressa VF** — Chargée à la demande, **uniquement** par le composant `TextPressure` pour le hero "Cockpit".

---

## Composants signature

### React Bits (TS + Tailwind)

Copiés manuellement et adaptés dans `apps/web/src/components/reactbits/`
avec attribution MIT + Commons Clause. Installés : `TextPressure`,
`RotatingText`, `ShinyText`, `VariableProximity`, `CountUp`, `SpotlightCard`,
`BorderGlow`, `AuroraShape`.

### Surfaces canoniques Finance-OS

- **`BrandMark`** — logo avec halo conic rotatif
- **`AuroraBackdrop`** — wash ambiant pour hero
- **`KpiTile`** — KPI unique source de vérité (SpotlightCard + CountUp)
- **`Panel`** — workhorse data-dense avec rail coloré optionnel
- **`RangePill`** — segmented control animé brand
- **`PageHeader`** — eyebrow + titre display + description + actions
- **`StatusDot`** — indicateur `ok/warn/err/idle/live/brand/violet`

---

## Motion

- Courbes : `--ease-out-expo` (entrées), `--ease-spring` (micro-interactions), `--ease-aurora` (brand drift)
- Durées : `fast 120ms`, `normal 200ms`, `slow 350ms`, `enter 280ms`, `exit 180ms`
- Animations décoratives (`halo-spin`, `aurora-drift`, `pulse-glow`,
  `animate-shimmer`) figées automatiquement sous `prefers-reduced-motion`

---

## Anti-patterns

- **AI slop** : gradients arc-en-ciel, glow gratuit, glassmorphism partout
- **Clone SaaS** : sidebar à 30 items, shadcn par défaut
- **Rose sémantique** : le rose signale l'identité, pas un état métier
- **Mur ASCII** : les glyphes au service, jamais du motif
- **Animations bloquantes** : scroll-jacking, parallax excessif
- **Dépendances non justifiées** : React Bits est copie manuelle, pas un package npm

---

## Historique

- **2026-04-15** — Refonte complète "Aurora Pink" : rose magenta primary,
  violet accent-2, midnight plum dark / pearl chaud light, intégration
  React Bits (TextPressure, RotatingText, etc.), nouvelles surfaces
  canoniques (`KpiTile`, `Panel`, `PageHeader`, `RangePill`, `BrandMark`,
  `AuroraBackdrop`, `StatusDot`).
- **Avant 2026-04** — Ancienne direction amber/or + navy-slate. Toutes les
  occurrences doivent avoir été migrées vers Aurora Pink.
