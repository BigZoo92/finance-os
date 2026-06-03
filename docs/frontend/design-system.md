# Design System - Finance-OS (Command Pixel)

> Tokens, components, and usage rules for the current design system.
> Direction source: `DESIGN.md`.

## Source Of Truth

- CSS tokens: `packages/ui/src/styles/globals.css`
- Shared UI primitives: `packages/ui/src/components/ui/`
- Finance-OS surfaces: `apps/web/src/components/surfaces/`
- Brand primitives: `apps/web/src/components/brand/`
- React Bits copies: `apps/web/src/components/reactbits/`

## Token Policy

Command Pixel reuses the current token names to avoid pre-mockup churn. Some
names still say `aurora`; treat them as compatibility aliases, not as a product
direction.

| Token | Role |
|---|---|
| `--background` / `--foreground` | Page base and text |
| `--card` / `--card-foreground` | Card containers |
| `--primary` | Command accent, focus, active nav |
| `--accent-2` | Secondary/admin accent |
| `--surface-0/1/2/3` | Four-step surface depth |
| `--positive` | Gains, income, positive financial signal |
| `--negative` | Losses, expenses, negative financial signal |
| `--warning` | Waiting, degraded, thresholds |

Rules:

- Reuse or extend tokens before adding isolated values.
- Never use brand accents for financial signal.
- Keep `surface-0/1/2/3` depth consistent across pages.

## Typography

- Inter Variable: body, headings, nav.
- JetBrains Mono Variable: financial amounts, status rows, identifiers.
- `.font-financial`: required for money values.
- Avoid viewport-scaled font sizes and negative letter spacing.

## Spacing And Radius

- Standard page rhythm: `space-y-8` or `space-y-10`.
- Dense grids: `gap-3` to `gap-4`; broader dashboard grids: `gap-6`.
- Cards and panels should stay at established radii; avoid nested card stacks.

## Canonical Components

Use these before creating bespoke equivalents:

| Component | Role |
|---|---|
| `PageHeader` | First child of app pages |
| `KpiTile` | KPI and numeric summary |
| `Panel` | Data-dense work surface |
| `RangePill` | Period/filter segmented control |
| `StatusDot` | Compact status indicator |
| `BrandMark` | Finance-OS mark |
| `AuroraBackdrop` | Legacy-named ambient backdrop primitive |

## Layout Patterns

Page shell:

```tsx
<div className="space-y-8">
  <PageHeader title="Depenses" />
  <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
    <KpiTile label="Flux net" value={0} display="0 EUR" />
  </section>
  <Panel title="Transactions">...</Panel>
</div>
```

Operational pages should expose controls directly. Do not make a marketing
landing page when the route is a tool.

## Motion

- Use motion for loading, state changes, and navigation feedback.
- Respect `prefers-reduced-motion`.
- Avoid decorative continuous motion on data-heavy surfaces.

## Accessibility

- Preserve keyboard focus states.
- Keep text inside containers at mobile and desktop widths.
- Use semantic tokens for financial signals.
- Tool icons need labels or tooltips when meaning is not obvious.
