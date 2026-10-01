import { defineGlobalStyles } from '@pandacss/dev'

/**
 * Global styles that used to live in Tailwind's `@layer base` and in the
 * app stylesheet: theme color scheme, default contour and outline colors,
 * body surface and font smoothing, the global reduced-motion override, the
 * scrollbar treatment and the selection tint. The element reset itself is
 * `packages/ui/src/styles/preflight.css` (vendored Tailwind preflight).
 */
export const financeOsGlobalCss = defineGlobalStyles({
  ':root': { colorScheme: 'light' },
  '.dark': { colorScheme: 'dark' },
  '*': { borderColor: 'border', outlineColor: 'ring/50' },
  body: {
    bg: 'background',
    color: 'foreground',
    WebkitFontSmoothing: 'antialiased',
    MozOsxFontSmoothing: 'grayscale',
  },
  // Accessibility override for decorative animations: must beat component
  // animation declarations, hence the `!important`.
  '*, *::before, *::after': {
    _motionReduce: {
      animationDuration: '0.01ms !important',
      animationIterationCount: '1 !important',
      transitionDuration: '0.01ms !important',
    },
  },
  '::-webkit-scrollbar': { width: '6px', height: '6px' },
  '::-webkit-scrollbar-track': { background: 'transparent' },
  '::-webkit-scrollbar-thumb': { background: 'oklch(0.5 0 0 / 20%)', borderRadius: '3px' },
  '::-webkit-scrollbar-thumb:hover': { background: 'oklch(0.5 0 0 / 35%)' },
  '::selection': { background: 'oklch(from {colors.primary} l c h / 25%)' },
})
