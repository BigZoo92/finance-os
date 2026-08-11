# Finance-OS design system

## Command Pixel

Finance-OS should feel like a precise personal financial instrument with the character of a compact command OS. The balance is approximately 85% contemporary premium finance and 15% controlled software nostalgia. Financial clarity always wins.

The visual system combines:

- dark software precision, restrained navigation, and calm technical framing;
- credible numeric hierarchy and monochrome-first data visualization;
- graphite surfaces, thin rules, compact rhythm, and one controlled accent at a time;
- rare pixel pictograms, micro-labels, bracket language, and tiny system readouts.

It is not a trading terminal, generic SaaS dashboard, marketing landing page, or retro poster.

## Typography lock

- Geist Sans: navigation, titles, labels, and body text.
- Geist Mono: amounts, percentages, dates, metadata, and operational values.
- Geist Pixel: exceptionally rare wordmark, loader, empty-state, or micro-label accents.
- `.font-financial` is required for financial amounts and tabular figures.

Do not introduce another family. Existing Inter/JetBrains declarations are migration debt from the previous direction; do not expand their use while the product tokens move to the Geist lock.

## Surfaces and tokens

Use the tokens in `packages/ui/src/styles/globals.css`; do not create isolated color, radius, spacing, shadow, or motion values.

The four levels are:

- `surface-0`: application canvas;
- `surface-1`: primary working plane;
- `surface-2`: panels and grouped controls;
- `surface-3`: overlays, menus, and focused controls.

Separation comes from depth, whitespace, and thin technical rules—not a wall of rounded cards. `aurora` token/component names are compatibility aliases only.

Financial semantics are stable:

- `positive` for gains/inflows;
- `negative` for losses/outflows;
- `warning` for caution, stale data, or intervention;
- brand accents never encode financial meaning.

## Canonical building blocks

Prefer the existing `KpiTile`, `Panel`, `PageHeader`, `RangePill`, `BrandMark`, and `StatusDot` components before creating an equivalent. The only retained React Bits component is `pixel-blast.tsx`, wrapped by the login backdrop; do not add another React Bits component.

Navigation is compact and anchored. Dropdowns use a concise icon/title/description hierarchy; avoid giant mega-menus and permanent new sidebars. Pixel icon tiles may add character but never outweigh the data.

## Data presentation

- Lead with the total, its period/context, and data freshness.
- Align comparable numbers and preserve tabular figures.
- Prefer a small number of legible charts to a grid of decorative widgets.
- Use semantic colors sparingly and label signals; do not rely on color alone.
- Show provenance or degraded status when a figure is cached, partial, stale, or estimated.

Every applicable remote surface covers loading, empty, degraded, error, offline/cache, and gated states.

## Motion

Motion explains causality, continuity, or state change. Use existing tokens, favor opacity/transform, and keep interactions available immediately. Avoid scroll-jacking, cursor followers, ambient loops, large staggered lists, and animations that delay financial values.

`prefers-reduced-motion` removes nonessential movement and keeps the same information hierarchy.

## Accessibility and responsive behavior

Maintain semantic structure, visible focus, keyboard flow, contrast, 44px touch targets, zoom support, safe areas, and usable tables/charts from 320px through wide desktop. Mobile is a deliberate information hierarchy, not a compressed desktop grid.

## Anti-patterns

- generic rounded KPI-card walls;
- glassy or purple AI identity;
- giant hero text inside the cockpit;
- full terminal, hacker, Y2K, or nostalgic cosplay;
- hardcoded financial colors;
- pixel body text or decorative diagrams that compete with data;
- new UI libraries that duplicate the current system.

UI changes require rationale plus desktop/mobile screenshot notes. Use the `finance-os-command-pixel`, `finance-os-ui-review`, and `finance-os-ui-motion` skills for implementation and review.
