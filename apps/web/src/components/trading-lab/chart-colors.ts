const toRgba = (hex: string, alpha: number): string => {
  const value = hex.trim()
  const match = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(value)
  if (!match) return value
  const red = match[1] ?? '00'
  const green = match[2] ?? '00'
  const blue = match[3] ?? '00'
  return `rgba(${Number.parseInt(red, 16)}, ${Number.parseInt(green, 16)}, ${Number.parseInt(blue, 16)}, ${alpha})`
}

export const getTradingChartColors = () => {
  const styles = getComputedStyle(document.documentElement)
  const read = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback
  const border = read('--border', '#f6f1e629')
  const negative = read('--negative', '#e0685a')
  const teal = read('--teal', '#6fb5aa')

  return {
    text: read('--muted-foreground', '#a89e8b'),
    border,
    grid: toRgba(read('--foreground', '#f6f1e6'), 0.04),
    negative,
    negativeSoft: toRgba(negative, 0.3),
    negativeFaint: toRgba(negative, 0.05),
    teal,
    tealSoft: toRgba(teal, 0.32),
    tealFaint: toRgba(teal, 0.03),
  }
}
