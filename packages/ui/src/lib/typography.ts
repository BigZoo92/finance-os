import { css } from '@finance-os/styled-system/css'

/**
 * Financial figures as longhands: the `financial` text style's values plus
 * tabular numerals.
 *
 * Components whose callers pick the size through `textStyle` (Amount,
 * PercentChange, numeric table cells) must not put `textStyle: 'financial'`
 * in their own styles: the caller's `textStyle: 'sm'` would replace it
 * wholesale and the figures would fall back to the sans font. Plain spans
 * that never receive a size override can keep `textStyle: 'financial'`.
 */
export const financialFigures = css.raw({
  fontFamily: 'mono',
  fontFeatureSettings: '"tnum", "zero", "ss01"',
  letterSpacing: '-0.01em',
  fontVariantNumeric: 'tabular-nums',
})
