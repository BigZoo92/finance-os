---
name: panda-css
description: Author and review styling in Finance-OS with Panda CSS (styled() factory, recipes, slot recipes, tokens, semantic tokens, patterns, global styles). Use whenever touching component styles, design tokens, theming, dark mode, layout primitives, the element reset, global CSS, or the styled-system package.
---

# Panda CSS in Finance-OS

Panda is the only styling system. It is build-time only: styles are statically
extracted into cascade layers, there is no CSS-in-JS runtime, and
`styled-components`, Emotion or any runtime styling library must never be added.

## Where things live

```text
packages/styled-system/src/preset.ts      Command Pixel tokens (colors, radii, fonts, motion, elevation, z-index, keyframes, text styles)
packages/styled-system/src/global-css.ts  global element styles (body surface, contour colors, reduced motion, scrollbar, selection)
packages/styled-system/panda.config.ts    the single Panda config (extracts packages/ui/src and apps/web/src)
packages/styled-system/generated/         generated runtime, gitignored, rebuilt by `pnpm panda:codegen` and on install
packages/ui/src/styles/preflight.css      element reset (vendored Tailwind 4.3.3 preflight, MIT), cascade layer `preflight`
packages/ui/src/components/**             shared components (styled() + recipes + slot recipes)
apps/web/src/styles.css                   cascade order, fonts, the reset import and Panda's layer anchor
apps/web/src/**                           product screens (styled elements, patterns, css())
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

## Cascade, reset and global styles

- `apps/web/src/styles.css` declares the cascade order `preflight, reset, base, tokens, recipes, utilities` before any import, then Panda's own layer statement, which is the anchor its PostCSS plugin fills. Unlayered CSS is reserved for `@font-face`; everything else is layered.
- The element reset is `packages/ui/src/styles/preflight.css` (layer `preflight`), vendored from Tailwind 4.3.3 because the product was designed on it. Panda's `preflight` stays `false`: its reset sets `body { height: 100% }`, balances headings and tints the selection, which moves layouts. Keep the vendored file byte-for-byte except for the documented font-token substitution, and keep the attribution in `docs/third-party-notices.md`.
- Global element styles (body surface, `*` contour and outline colors, the reduced-motion override, scrollbar, selection) live in `packages/styled-system/src/global-css.ts` and use tokens. Do not add hand-written class names to a stylesheet; signature surfaces (login canvas, radar wash, shimmer) are `css()`/recipes next to the component that owns them.
- Runtime code that needs a resolved color (charts, the 3D graph, canvas) reads Panda's variable through `token.var('colors.primary')` (strip the `var()` wrapper before `getPropertyValue`) on `document.documentElement`; the `.dark` class holds the dark set on `<html>` itself. SVG attributes and inline gradients use `token('colors.primary')`.
- Line-height ratios are `lineHeights` tokens (`calc(1.25 / 0.875)`) referenced from the text styles: a bare `calc()` in an atom is folded to five decimals by the minifier and a 12px line box becomes 15.98px.
- A `fontSize` override on a component whose recipe owns a `textStyle` (Status, Button, Input, CardDescription, Badge) also needs `lineHeight: 'inherit'` (or the intended value): the recipe's text style keeps its line height. Named sizes (`textStyle: 'xs'`) carry their own line height and need nothing. `Button` sets `textStyle` per size and `lineHeight: 'inherit'` for its pixel sizes (`lg`, `xl`).
- Panda extracts style props from any capitalized JSX tag it can see. Do not name custom component props after style props (`display`, `h`, `w`, `color`, `size`, `position`, `height` on non-styled components); rename them (`displayValue`, `chartHeight`) or the extractor emits junk atoms.
- `space-y-*`-style spacing over inline children: Panda's `spaceY` sets `margin-top` on every child but the first, which inline-block children honour. Where a child is inline-level, write the rule explicitly (`'& > :not(:last-child)': { marginBlockEnd: '2' }`).
- `packages/styled-system/panda.config.ts` is bundled to CommonJS by Panda: anchor paths with `__dirname`, not `import.meta.url`.
- No Tailwind, `tailwind-merge`, `class-variance-authority`, `clsx`, `tw-animate-css` or shadcn: Panda's `cva`/`sva`/`cx` and the preset keyframes cover them. Overlay motion uses the preset keyframes (`fadeIn`, `scaleIn`, `slideInFromBottom`, `nudgeFrom*`).

## Testing

- Unit tests assert behavior and semantics (`data-slot`, roles, text), not generated class names. If a class must be asserted, use the exact Panda atom (`c_positive`, `ff_mono`, `bdr_full`, `min-h_11`) rendered through `renderToStaticMarkup`, as `badge.test.tsx` does.
- Visual regression: `pnpm test:e2e:visual -- --update-snapshots` records local baselines (45 screenshots: desktop dark/light, mobile dark, every canonical route) in `e2e/__visual__` (gitignored); `pnpm test:e2e:visual` compares with a 100-pixel tolerance. The run pins the clock in the browser and in the SSR process (`e2e/support`), so relative labels never drift. Record before a styling change, compare after; a styling change is done only when the suite is green or the new baseline is an intended, reviewed change.
