# React Bits — Finance-OS adaptations

These components originate from [React Bits (TS-Tailwind variant)](https://reactbits.dev/)
by **David Haz** — MIT + Commons Clause license, see
<https://github.com/DavidHDev/react-bits/blob/main/LICENSE.md>.

Each file keeps a reference back to the upstream source and adapts the
implementation to Finance-OS conventions:

- **Tokens** — colors are passed through CSS variables (`var(--primary)`,
  `var(--accent-2)`, etc.) instead of hard-coded hex so dark/light mode and
  the Aurora Pink direction stay consistent.
- **Reduced motion** — every decorative animation respects
  `prefers-reduced-motion: reduce` at the CSS layer (see `globals.css`).
- **Accessibility** — decorative layers are marked `aria-hidden`, keyboard
  focus is preserved on interactive surfaces.
- **SSR-safe** — animation setup gates on `typeof window !== 'undefined'` so
  TanStack Start SSR does not crash.

Selection rule: a React Bits component earns its place only if it supports
identity or readability in a concrete Finance-OS surface (hero brand mark,
KPI card, onboarding, empty state). Pure "demo" effects are excluded.

Currently installed:

| Component | File | Purpose |
|---|---|---|
| CountUp | `count-up.tsx` | Animated reveal of numeric values (KPIs, goals) |
| RotatingText | `rotating-text.tsx` | Cockpit subtitle rotator |
| ShinyText | `shiny-text.tsx` | Hero title shimmer, sparingly |
| VariableProximity | `variable-proximity.tsx` | Section title hover flourish |
| BorderGlow | `border-glow.tsx` | Hero / login brand mark halo |
| SpotlightCard | `spotlight-card.tsx` | KPI cards premium cursor-follow |
| AuroraShape | `aurora-shape.tsx` | Decorative brand blob (inspired by ShapeBlur) |
