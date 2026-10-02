import { type Token, token } from '@finance-os/styled-system/tokens'

/** Removes a lightweight-charts instance (and its canvas); safe on null or twice. */
export const removeChart = (chart: { remove: () => void } | null): void => {
  try {
    chart?.remove()
  } catch {
    // Already removed (the library throws on a second `remove`).
  }
}

const toRgba = (hex: string, alpha: number): string => {
  const value = hex.trim()
  const match = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(value)
  if (!match) return value
  const red = match[1] ?? '00'
  const green = match[2] ?? '00'
  const blue = match[3] ?? '00'
  return `rgba(${Number.parseInt(red, 16)}, ${Number.parseInt(green, 16)}, ${Number.parseInt(blue, 16)}, ${alpha})`
}

// `token.var('colors.border')` is `var(--colors-border)`; getPropertyValue wants
// the bare custom property name.
const toCustomPropertyName = (reference: string): string =>
  reference.startsWith('var(') ? reference.slice('var('.length, -1) : reference

// The chart runtime needs resolved colors: read Panda's semantic color variables
// from <html> so they follow the `.dark` class like the DOM does.
export const getTradingChartColors = () => {
  const styles = getComputedStyle(document.documentElement)
  const read = (path: Token, fallback: string) =>
    styles.getPropertyValue(toCustomPropertyName(token.var(path))).trim() || fallback
  const border = read('colors.border', '#f6f1e629')
  const negative = read('colors.negative', '#e0685a')
  const teal = read('colors.teal', '#6fb5aa')

  return {
    text: read('colors.muted.foreground', '#a89e8b'),
    border,
    grid: toRgba(read('colors.foreground', '#f6f1e6'), 0.04),
    negative,
    negativeSoft: toRgba(negative, 0.3),
    negativeFaint: toRgba(negative, 0.05),
    teal,
    tealSoft: toRgba(teal, 0.32),
    tealFaint: toRgba(teal, 0.03),
  }
}
