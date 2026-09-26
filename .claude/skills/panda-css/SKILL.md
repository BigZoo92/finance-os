---
name: panda-css
description: Author, migrate, and review styling in Finance-OS with Panda CSS (styled() factory, recipes, slot recipes, tokens, semantic tokens, patterns). Use whenever touching component styles, design tokens, theming, dark mode, layout primitives, the styled-system package, or when removing Tailwind classes.
---

# Panda CSS in Finance-OS

Panda is the only styling system. It is build-time only: styles are statically
extracted into cascade layers, there is no CSS-in-JS runtime, and
`styled-components`, Emotion or any runtime styling library must never be added.

## Where things live

```text
packages/styled-system/src/preset.ts   Command Pixel tokens (colors, radii, fonts, motion, elevation, z-index, keyframes)
packages/styled-system/panda.config.ts  the single Panda config (extracts packages/ui/src and apps/web/src)
packages/styled-system/generated/       generated runtime, gitignored, rebuilt by `pnpm panda:codegen` and on install
packages/ui/src/components/**           shared components (styled() + recipes + slot recipes)
apps/web/src/**                         product screens (styled elements, patterns, css())
```

Imports always go through the export map, never through relative paths into
`generated/`:

```ts
import { css, cx, cva, sva } from '@finance-os/styled-system/css'
import { styled, Box, Flex, HStack, VStack, Grid } from '@finance-os/styled-system/jsx'
import { hstack, stack, grid, flex } from '@finance-os/styled-system/patterns'
import { token } from '@finance-os/styled-system/tokens'
import type { HTMLStyledProps, StyledVariantProps } from '@finance-os/styled-system/jsx'
```

After changing `preset.ts` or `panda.config.ts`, run `pnpm panda:codegen`. CI and
Docker run it on install (`prepare`), so consumers never commit generated code.

## Authoring convention (styled-components-like, 100% Panda)

Prefer Panda's own `styled()` factory where it improves readability and gives a
component clear ownership of its styles. Use the API that keeps the call site
short and the styles static:

| Situation | Use |
|---|---|
| A reusable component with variants (button, badge, status chip) | `styled('button', recipe)` or `cva` + `styled()` |
| A component made of several styled parts (card, dialog, drawer, select) | `sva` slot recipe + `styled(Part, slotRecipe.part)` or `css(classes.part)` |
| Layout scaffolding (rows, stacks, grids, centering) | patterns: `hstack`, `vstack`, `stack`, `grid`, `flex`, `center`, or `<HStack>` / `<Grid>` JSX |
| A one-off element with a handful of static styles | `<styled.section px="4" py="3" bg="surface.1">` or `css({ ... })` |
| Composition of existing classes | `cx(recipe(), css({ ... }), className)` |
| A function component with its own logic (Amount, Status, Progress, Panel, KpiTile) that callers style | `withStyleProps(props, base.raw)` from `@finance-os/ui/lib/style-props`: accepts the same style props as `styled()` |

Rules:

- Do not force `styled()` onto trivial elements: `<span>` with one property is fine as `className={css({ fontFamily: 'mono' })}`.
- Avoid huge inline style-prop objects. When a `css({...})` grows beyond ~8 properties or repeats, promote it to a named recipe or a slot recipe next to the component.
- Keep every value static: no template strings inside `css()`, no runtime-computed property names, no `style` props for tokens. Conditional styling goes through recipe variants, boolean `_`-conditions (`_hover`, `_disabled`, `_dark`, `_open`), or `data-*` attribute conditions, all resolved at build time.
- Always use tokens: `bg: 'primary'`, `color: 'muted.foreground'`, `borderColor: 'border'`, `rounded: 'control'`, `shadow: 'floating'`, `fontFamily: 'mono'`, `zIndex: 'popover'`, `transitionDuration: 'normal'`, `transitionTimingFunction: 'outExpo'`. Opacity modifiers use `primary/10` style values.
- `data-slot` attributes on shared components are part of the DOM contract (E2E and tests select them). Keep them; do not rename.
- Recipes belong to the component that owns them; export the variant type with `StyledVariantProps<typeof Button>` when callers need it.
- Override a shared component through its style props (`<Amount textStyle="sm" mt="2" />`, `<Panel bg="surface.2" />`, `<Status display="flex" />`), never through `className={css({ ... })}`. Style props are merged into the component's own styles at the object level (one atom per property), whereas two atoms for the same property are resolved by their order in the generated sheet, which follows first-seen extraction order and changes when unrelated files change. Function components get this merge from `withStyleProps`; `className` stays for non-style classes.
- Because the merge is per property, a component whose callers choose the size through `textStyle` must not own `textStyle: 'financial'` itself (the caller's `textStyle: 'sm'` would replace it and drop the mono font). `Amount`, `PercentChange` and numeric table cells use the longhands from `@finance-os/ui/lib/typography` (`financialFigures`); `textStyle: 'financial'` stays for plain spans that never receive a size.
- No `!important`, no arbitrary selectors reaching into other components. Target children through slot recipes or `&` selectors scoped to the component.

### Example: variant component

```tsx
import { styled } from '@finance-os/styled-system/jsx'
import { cva } from '@finance-os/styled-system/css'

const badge = cva({
  base: {
    display: 'inline-flex', alignItems: 'center', gap: '1',
    rounded: 'tile', px: '2', py: '0.5', fontSize: 'xs', fontWeight: 'medium',
    borderWidth: '1px', borderColor: 'transparent',
  },
  variants: {
    variant: {
      default: { bg: 'primary', color: 'primary.foreground' },
      positive: { bg: 'positive/12', color: 'positive' },
      warning: { bg: 'warning/12', color: 'warning' },
      outline: { borderColor: 'border', color: 'foreground' },
    },
  },
  defaultVariants: { variant: 'default' },
})

export const Badge = styled('span', badge, { defaultProps: { 'data-slot': 'badge' } })
```

### Example: slot recipe

```tsx
import { sva } from '@finance-os/styled-system/css'

export const card = sva({
  slots: ['root', 'header', 'title', 'content'],
  base: {
    root: { bg: 'card', color: 'card.foreground', rounded: 'surface', borderWidth: '1px', borderColor: 'border', shadow: 'surface' },
    header: { display: 'grid', gap: '1.5', px: '5', pt: '5' },
    title: { fontWeight: 'semibold', lineHeight: 'none' },
    content: { px: '5', pb: '5' },
  },
})
```

## Theming and dark mode

- Colors are semantic tokens with `base` (light) and `_dark` values in the preset. The `.dark` class on `<html>` (set by `apps/web/src/lib/theme.ts`) switches the set; never add per-component `_dark` overrides for brand colors.
- Financial semantics (`positive`, `negative`, `warning`) are never the brand color. Money uses `fontFamily: 'mono'` with tabular figures (see the `Amount` component) and `null` renders as unavailable, never as 0.
- Signature compositions (login canvas, radar canvas) keep their tokens under `login.*` and `radar.*`.

## Coexistence and exit policy

- Until the Tailwind exit lands, Tailwind owns the preflight and `base` layer. `apps/web/src/styles.css` pins the cascade order `properties, theme, base, panda_*, components, utilities`: Tailwind's preflight stays below Panda utilities (otherwise `* { padding: 0; border: 0 }` erases migrated components), while Tailwind utilities passed by not-yet-migrated consumers still override migrated components, exactly as `twMerge` did. Migrate bottom-up (shared components first, then screens); a file is either Tailwind or Panda, never both.
- Legacy unlayered classes (`font-financial`, `font-tnum`, `login-*`, `animate-shimmer`, `bg-radar-canvas`) used to beat every utility. Their Panda replacements are layered, so a consumer class such as `tracking-tight` on an `Amount` now wins; remove such no-op overrides when migrating a screen instead of reproducing them.
- `twMerge` replaced same-group classes, so a consumer `text-[10px]` on a component with `text-xs` also dropped the component's line height. Panda keeps the recipe's `textStyle`, so such a consumer must set the line height explicitly: `leading-[inherit]` while the consumer is still Tailwind, `lineHeight: 'inherit'` (or the intended value) once migrated. Named sizes (`text-xs`, `textStyle: 'xs'`) carry their own line height and need nothing.
- Recipes put typography on the variant that owned it in Tailwind: `Button` sets `textStyle` per size and `lineHeight: 'inherit'` for the pixel sizes (`lg`, `xl`), because the old `text-[15px]` replaced `text-sm` instead of layering on it.
- Line-height ratios are `lineHeights` tokens (`calc(1.25 / 0.875)`) referenced from the text styles: a bare `calc()` in an atom is folded to five decimals by the minifier and a 12px line box becomes 15.98px.
- Panda extracts style props from any JSX element it can see. Do not name custom component props after style props (`display`, `h`, `w`, `color`, `size` on non-styled components); rename them (`displayValue`, `height`) or the extractor emits junk atoms.
- `packages/styled-system/panda.config.ts` is bundled to CommonJS by Panda: anchor paths with `__dirname`, not `import.meta.url`.
- After the exit, `preflight: true` and the former `@layer base` rules move into `globalCss`; `tailwindcss`, `@tailwindcss/vite`, `tw-animate-css`, `tailwind-merge`, `class-variance-authority`, `clsx` and `shadcn` are removed. Panda's `cva`/`sva`/`cx` replace them.

## Testing

- Unit tests assert behavior and semantics (`data-slot`, roles, text), not generated class names. If a class must be asserted, use the exact Panda atom (`c_positive`, `textStyle_financial`, `bdr_full`) rendered through `renderToStaticMarkup`, as `badge.test.tsx` does.
- Visual regression: `pnpm test:e2e:visual -- --update-snapshots` records local baselines (45 screenshots: desktop dark/light, mobile dark, every canonical route) in `e2e/__visual__` (gitignored); `pnpm test:e2e:visual` compares with a 100-pixel tolerance. Record before touching a family, compare after; a migration is done only when the suite is green.
