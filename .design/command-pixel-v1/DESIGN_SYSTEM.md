# Design System

## Identity

Name: Command Pixel V1

Direction: premium personal financial operating system with restrained software nostalgia and rare pixel accents.

Primary palette: Soft Orange Cream.

## Dark colors

| Token | Value | Role |
|---|---|---|
| Background | `#242019` | Main warm graphite foundation |
| Surface | `#2C2720` | Primary surface |
| Floating surface | `#302B23` | Dropdowns and elevated surfaces |
| Cream | `#F6F1E6` | Primary text |
| Signal orange | `#F97A3C` | Signature accent |
| Positive | `#4CBB82` | Positive financial state |
| Attention | `#D9A441` | Attention state |
| Negative | `#E0685A` | Error or negative state |
| Teal | `#6FB5AA` | Restrained secondary support |
| Warm accent | `#DCCBA6` | Secondary warm accent |
| AI semantic | `#9B8CE8` | Rare semantic AI use only |

## Light colors

| Token | Value |
|---|---|
| Background | `#F5EFE3` |
| Surface | `#FCFAF4` |
| Raised surface | `#FFFFFF` |
| Ink | `#221E17` |
| Signal orange | `#DE5E1E` |
| Positive | `#1C8A52` |
| Attention | `#A97614` |
| Negative | `#B23E2C` |
| Teal | `#3E8578` |
| Warm accent | `#9C8557` |
| AI semantic | `#6C5BD4` |

## Typography

Use the Geist family only.

### Geist Sans

Primary UI, navigation, titles, body copy, labels and controls.

### Geist Mono

Amounts, percentages, dates, timestamps and compact metadata.

### Geist Pixel

Rare micro-signature only. Suitable for loading, run states and tiny signature details. Never use it for paragraphs.

### Canonical scale from the final design frame

- Page title: Geist Sans, 24 px, weight 600
- Section title: Geist Mono, 11 px, uppercase, letter spacing around 0.16 em
- Body: Geist Sans, 14 px
- Secondary: Geist Sans, 13 px with reduced emphasis
- Metadata: Geist Mono, 11 or 12 px
- XL financial amount: 44 px, weight 500
- Medium amount: 20 px
- Compact amount: 13 px

## Financial values

Use French and European formatting.

Examples:

- `67 070,44 €`
- `+2 310,00 € (+8,51 %)`
- `Indisponible`
- `Données insuffisantes`

Unknown values are never rendered as zero.

## Spacing

Canonical spacing scale:

`8, 12, 16, 20, 26, 36, 44, 56`

Prefer this scale over arbitrary page specific values.

## Radius

- Tile: 6 px
- Icon tile: 7 px
- Control: 8 px
- Dropdown: 10 px
- Surface: 12 px
- Frame: 14 px

Avoid pill geometry.

## Borders

The final design system uses restrained warm technical lines.

- Low emphasis separator around 0.09 opacity
- Standard contour around 0.16 opacity
- Dashed treatment reserved for empty states where useful

## Page widths

- Standard: 1240 px for normal product and Ops pages
- Focused: 780 px for Chat
- Immersive: full frame for Mémoire 3D and Radar
- Signature: free composition for Login

## Shell

Desktop navbar is contained, floating and centered.

- Maximum width: 1240 px
- Visible page background above and around it
- Low radius
- Detached dropdowns
- Framed icon tiles
- Geist Sans navigation labels
- Hover and persistent active states must remain distinct

## Controls

Canonical control family includes:

- Primary button
- Secondary button
- Ghost button
- Icon button
- Input
- Search
- Segmented control
- Select where required
- Tooltip
- Popover
- Drawer
- Modal

All controls inherit the same low radius geometry, focus language and Soft Orange Cream palette.

## Status vocabulary

Prefer short human states:

- À jour
- Terminé
- Connecté
- En cours
- Attention
- Reconnexion requise
- Ancien
- Échec
- Prêt
- Configuré
- Non configuré
- Indisponible
- Réel
- Estimé
- Fixe

Do not surface backend enums when a human label exists.

## Motion

Normal product motion is fast and functional, generally 120 to 180 ms.

Richer signature motion is reserved for:

- Login
- Mémoire 3D
- Radar

Pixel motion is reserved for:

- loading
- run states
- selected memory details

Reduced motion must always have a static equivalent.
