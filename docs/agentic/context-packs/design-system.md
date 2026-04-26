# Design System Context Pack — Finance-OS

> Auto-generated. Sources: DESIGN.md, docs/frontend/design-system.md
> Do not edit directly — regenerate with `pnpm agent:context:pack`

## Identity: Aurora Pink

- Primary: rose magenta (oklch ~355 hue)
- Accent-2: electric violet (oklch ~295 hue)
- Typography: Inter (display/body), JetBrains Mono (financial data)
- Surface depth: 4 levels (surface-0 through surface-3)

## Component Conventions

- Use existing components: KpiTile, Panel, PageHeader, RangePill, BrandMark, AuroraBackdrop, StatusDot
- Financial amounts: .font-financial class (monospace, tabular figures)
- Semantic colors: positive/negative/warning (never brand rose for signal)
- React Bits components in apps/web/src/components/reactbits/ (MIT + Commons Clause)

## States Matrix (every widget)

- Loading (skeleton)
- Empty (no data)
- Error (failed fetch)
- Degraded (partial data)
- Normal (full data)

## Motion

- respect prefers-reduced-motion
- enter: fade + translate (200ms ease-out)
- exit: fade (150ms ease-in)
