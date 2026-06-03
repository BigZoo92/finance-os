# Finance-OS - Direction Artistique

Last updated: 2026-06-03

## Current Direction: Command Pixel

Finance-OS is a personal finance cockpit, not a SaaS landing page and not a
generic admin dashboard. The current visual direction is **Command Pixel**:
compact operational surfaces, crisp typography, restrained motion, and clear
status hierarchy.

Aurora Pink is superseded. Existing token/component names that include
`aurora` are compatibility aliases until the final mockup pass renames or
reworks them.

## Product Feel

- Personal command center, not marketing.
- Dense but readable: panels, tables, KPI rows, timelines.
- Everyday nav stays small: Cockpit, Depenses, Patrimoine, Advisor, More.
- Expert/provider/diagnostic surfaces live under Ops/admin or are hidden in
  normal demo navigation.

## Palette Rules

- Reuse existing tokens: `--primary`, `--accent-2`, `--surface-0/1/2/3`,
  `--positive`, `--negative`, `--warning`.
- Do not introduce isolated colors for one component.
- Do not use brand colors for financial signal. Gains use `positive`, losses
  use `negative`, degraded/waiting states use `warning`.
- Avoid one-note palettes, decorative orbs, broad gradients, and heavy glow.

## Typography

- Inter Variable for product text, headings, navigation.
- JetBrains Mono for amounts, identifiers, status lines.
- `.font-financial` is mandatory for financial amounts.
- Keep page/tool headings compact unless the page is a true hero surface.

## Canonical Surfaces

Use existing Finance-OS primitives before building bespoke UI:

- `PageHeader`
- `KpiTile`
- `Panel`
- `RangePill`
- `BrandMark`
- `AuroraBackdrop` as a legacy-named backdrop primitive
- `StatusDot`

## Motion

Motion explains state changes. It must respect `prefers-reduced-motion` and
must not become continuous decoration in work surfaces.

## History

- 2026-06-03: Command Pixel becomes the source of truth before final mockups.
- 2026-04-15: Aurora Pink was the prior direction and is now legacy context.
