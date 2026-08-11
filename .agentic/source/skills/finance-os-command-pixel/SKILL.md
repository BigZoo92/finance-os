---
name: finance-os-command-pixel
description: Build Finance-OS UI in the Command Pixel design system. Use for any page, shell, navigation, shared surface, chart, typography, token, responsive layout, or visual styling change.
---

# Command Pixel implementation

Read `DESIGN.md` and `apps/web/AGENTS.md` before editing UI. `DESIGN.md` is the only visual source of truth.

## Direction

- Aim for contemporary premium finance with a small, controlled early-software signature.
- Financial hierarchy wins over nostalgia: dense enough to be useful, never a trading terminal or retro poster.
- Use the four surface levels, thin technical rules, compact operational rhythm, strong negative space, and restrained semantic accents.
- Typography is locked to Geist Sans, Geist Mono, and rare Geist Pixel accents. Pixel type is never body copy.
- Financial amounts use `.font-financial` and tabular figures.
- Positive, negative, and warning data use semantic tokens, never brand color or hardcoded hex values.

## Build from the system

- Reuse tokens from `packages/ui/src/styles/globals.css` before adding values.
- Prefer the canonical shared surfaces documented in `DESIGN.md`, including `KpiTile`, `Panel`, `PageHeader`, `RangePill`, `BrandMark`, and `StatusDot`.
- Customize the vendored React Bits copies in place when needed; do not reinstall them.
- Keep navigation sourced from `apps/web/src/components/shell/nav-items.ts` and update `docs/product.md` when product or route structure changes.
- Use pixel iconography as micro-expression, not decoration across every surface.

## Required states

Design applicable loading, empty, degraded/stale, error, offline/cache, and gated states. Keep mobile hierarchy and 44px touch targets, keyboard focus, contrast, and reduced-motion behavior intact.

Do not introduce generic rounded-card walls, glassy purple AI styling, a permanent new sidebar, giant marketing heroes, or full-terminal aesthetics.
