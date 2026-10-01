import { formatPercent } from '@finance-os/ui/lib/format'
/**
 * Signal Field layout.
 *
 * The signature Radar visualization: every monitored market is a
 * trajectory through the observed window (x = real time, y = variation since
 * the first observation), converging on the right edge where the latest
 * point is drawn. Importance (from signals and attention events) drives the
 * endpoint emphasis, freshness and focus drive opacity, dated context
 * (macro observations, events) sits in the band above the field and links
 * to the markets it references.
 *
 * Pure D3 scale and shape math. No DOM, so the encoding is unit-testable.
 */
import { max } from 'd3-array'
import { scaleLinear, scaleTime } from 'd3-scale'
import { curveMonotoneX, line } from 'd3-shape'
import { formatDayMonth, type RadarMarket, type RadarTone, toneForChange } from './view-model'

export type FieldTier = 'desktop' | 'compact' | 'mobile'

export type FieldPoint = { t: number; pct: number }

export type FieldSeries = {
  id: string
  label: string
  points: FieldPoint[]
  endPct: number
  endT: number
  tone: RadarTone
  importance: number
}

export type FieldMarkerInput = {
  id: string
  kind: 'macro' | 'event'
  label: string
  t: number
  relatedIds: string[]
  attention: boolean
}

export type LaidOutSeries = {
  id: string
  label: string
  d: string
  end: { x: number; y: number }
  endPct: number
  tone: RadarTone
  importance: number
  /** Null when the label is intentionally hidden at this tier. */
  labelY: number | null
}

export type LaidOutMarker = {
  id: string
  kind: 'macro' | 'event'
  label: string
  x: number
  y: number
  attention: boolean
  links: Array<{ targetId: string; x2: number; y2: number }>
}

export type FieldLayout = {
  width: number
  height: number
  tier: FieldTier
  window: { start: number; end: number }
  plot: { left: number; right: number; top: number; bottom: number }
  baselineY: number
  yTicks: Array<{ value: number; y: number; label: string }>
  xTicks: Array<{ t: number; x: number; label: string | null }>
  series: LaidOutSeries[]
  markers: LaidOutMarker[]
  hiddenSeriesCount: number
}

const MARGIN: Record<FieldTier, { top: number; right: number; bottom: number; left: number }> = {
  desktop: { top: 76, right: 136, bottom: 36, left: 40 },
  compact: { top: 64, right: 112, bottom: 32, left: 36 },
  mobile: { top: 22, right: 92, bottom: 20, left: 16 },
}

const MAX_SERIES: Record<FieldTier, number> = { desktop: 18, compact: 10, mobile: 6 }
const MAX_MARKERS = 6
const MARKER_ROWS = 3
const MARKER_ROW_GAP = 16
const MAX_LABELS: Record<FieldTier, number> = { desktop: 18, compact: 6, mobile: 3 }
const LABEL_GAP: Record<FieldTier, number> = { desktop: 14, compact: 13, mobile: 12 }

/** The 1240px layout gives the field about 874px: that is the full desktop tier. */
export const resolveFieldTier = (width: number): FieldTier =>
  width < 480 ? 'mobile' : width < 720 ? 'compact' : 'desktop'

export const fieldHeightFor = (tier: FieldTier, width: number): number => {
  if (tier === 'mobile') return 250
  if (tier === 'compact') return Math.round(Math.min(420, Math.max(320, width * 0.5)))
  return Math.round(Math.min(620, Math.max(440, width * 0.66)))
}

const parseDay = (date: string): number | null => {
  const time = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T00:00:00Z` : date)
  return Number.isFinite(time) ? time : null
}

/**
 * A market becomes a trajectory when at least two dated observations exist.
 * Variation is measured against the first observation of the window, so a
 * market with a single quote is honestly left out of the field.
 */
export const toFieldSeries = (market: RadarMarket, importance: number): FieldSeries | null => {
  const points: FieldPoint[] = []
  let base: number | null = null
  for (const observation of market.history) {
    const t = parseDay(observation.date)
    if (t === null) continue
    if (base === null) {
      if (observation.value <= 0) continue
      base = observation.value
    }
    points.push({ t, pct: (observation.value / base - 1) * 100 })
  }
  points.sort((left, right) => left.t - right.t)
  const last = points.at(-1)
  if (points.length < 2 || !last) return null
  return {
    id: market.id,
    label: market.label,
    points,
    endPct: last.pct,
    endT: last.t,
    tone: toneForChange(last.pct),
    importance,
  }
}

const rankSeries = (series: FieldSeries[]): FieldSeries[] =>
  [...series].sort(
    (left, right) =>
      right.importance - left.importance || Math.abs(right.endPct) - Math.abs(left.endPct)
  )

/** Fewer trajectories on small fields: the strongest first, the focused ones always. */
export const selectVisibleSeries = (
  series: FieldSeries[],
  tier: FieldTier,
  focusIds: ReadonlySet<string> = new Set()
): FieldSeries[] => {
  const limit = MAX_SERIES[tier]
  if (series.length <= limit) return series
  const ranked = rankSeries(series)
  const kept = new Set<string>()
  for (const item of ranked) {
    if (focusIds.has(item.id)) kept.add(item.id)
  }
  for (const item of ranked) {
    if (kept.size >= limit) break
    kept.add(item.id)
  }
  return series.filter(item => kept.has(item.id))
}

/** Which series get a direct label at this tier. */
export const selectLabelledIds = (
  series: FieldSeries[],
  tier: FieldTier,
  focusIds: ReadonlySet<string> = new Set()
): Set<string> => {
  const limit = MAX_LABELS[tier]
  const ids = new Set<string>()
  for (const item of series) if (focusIds.has(item.id)) ids.add(item.id)
  for (const item of rankSeries(series)) {
    if (ids.size >= limit) break
    ids.add(item.id)
  }
  return ids
}

/**
 * One-dimensional label relaxation: keeps the vertical order of the
 * endpoints, guarantees `minGap` between consecutive labels and stays inside
 * `[top, bottom]`.
 */
export const relaxLabels = (
  items: Array<{ id: string; y: number }>,
  { minGap, top, bottom }: { minGap: number; top: number; bottom: number }
): Map<string, number> => {
  const sorted = [...items].sort((left, right) => left.y - right.y)
  const positions = sorted.map(item => item.y)

  for (let index = 1; index < positions.length; index += 1) {
    const previous = positions[index - 1] ?? top
    const current = positions[index] ?? previous
    if (current - previous < minGap) positions[index] = previous + minGap
  }
  const last = positions.length - 1
  if (last >= 0 && (positions[last] ?? 0) > bottom) positions[last] = bottom
  for (let index = last - 1; index >= 0; index -= 1) {
    const next = positions[index + 1] ?? bottom
    const current = positions[index] ?? next
    if (next - current < minGap) positions[index] = next - minGap
  }
  if (positions.length > 0 && (positions[0] ?? top) < top) {
    positions[0] = top
    for (let index = 1; index < positions.length; index += 1) {
      const previous = positions[index - 1] ?? top
      const current = positions[index] ?? previous
      if (current - previous < minGap) positions[index] = previous + minGap
    }
  }

  const result = new Map<string, number>()
  sorted.forEach((item, index) => {
    result.set(item.id, positions[index] ?? item.y)
  })
  return result
}

export const computeTimeWindow = (series: FieldSeries[]): { start: number; end: number } | null => {
  let start = Number.POSITIVE_INFINITY
  let end = Number.NEGATIVE_INFINITY
  for (const item of series) {
    for (const point of item.points) {
      start = Math.min(start, point.t)
      end = Math.max(end, point.t)
    }
  }
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null
  if (start === end) end = start + 24 * 60 * 60 * 1000
  return { start, end }
}

/** Symmetric amplitude around zero, padded and rounded to a readable step. */
export const computeYAmplitude = (series: FieldSeries[]): number => {
  const largest = max(series, item => max(item.points, point => Math.abs(point.pct)) ?? 0) ?? 0
  const padded = largest * 1.15
  if (padded <= 1) return 1
  const step = NICE_AMPLITUDES.find(candidate => padded <= candidate)
  return step ?? Math.ceil(padded / 50) * 50
}

const NICE_AMPLITUDES = [1, 1.5, 2, 3, 5, 7.5, 10, 12, 15, 20, 30, 50, 100]

/** Endpoint emphasis radius (px) from importance. */
export const radiusForImportance = (importance: number, tier: FieldTier): number => {
  const base = tier === 'mobile' ? 3 : 3.5
  if (importance >= 3) return tier === 'mobile' ? 6 : 7
  if (importance === 2) return base + 2
  if (importance === 1) return base + 1
  return base
}

const formatTick = (value: number): string =>
  value === 0 ? '0' : (formatPercent(value, { decimals: 0 }) ?? '')

export const buildFieldLayout = ({
  series,
  markers,
  width,
  height,
  tier,
  focusIds = new Set(),
  today = new Date(),
}: {
  series: FieldSeries[]
  markers: FieldMarkerInput[]
  width: number
  height: number
  tier: FieldTier
  focusIds?: ReadonlySet<string>
  today?: Date
}): FieldLayout | null => {
  const margin = MARGIN[tier]
  const visible = selectVisibleSeries(series, tier, focusIds)
  const window = computeTimeWindow(visible)
  if (!window || width <= margin.left + margin.right) return null

  const plot = {
    left: margin.left,
    right: width - margin.right,
    top: margin.top,
    bottom: height - margin.bottom,
  }
  const x = scaleTime()
    .domain([window.start, window.end])
    .range([plot.left + 8, plot.right])
  const amplitude = computeYAmplitude(visible)
  const y = scaleLinear().domain([-amplitude, amplitude]).range([plot.bottom, plot.top])
  const path = line<FieldPoint>()
    .x(point => x(point.t))
    .y(point => y(point.pct))
    .curve(curveMonotoneX)

  const labelled = selectLabelledIds(visible, tier, focusIds)
  const labelPositions = relaxLabels(
    visible.filter(item => labelled.has(item.id)).map(item => ({ id: item.id, y: y(item.endPct) })),
    { minGap: LABEL_GAP[tier], top: plot.top + 4, bottom: plot.bottom - 2 }
  )

  const laidOut: LaidOutSeries[] = visible.map(item => ({
    id: item.id,
    label: item.label,
    d: path(item.points) ?? '',
    end: { x: x(item.endT), y: y(item.endPct) },
    endPct: item.endPct,
    tone: item.tone,
    importance: item.importance,
    labelY: labelPositions.get(item.id) ?? null,
  }))
  const endById = new Map(laidOut.map(item => [item.id, item.end]))

  const yTicks = [amplitude, 0, -amplitude].map(value => ({
    value,
    y: y(value),
    label: formatTick(value),
  }))

  // Grid rules follow D3's nice time ticks; only the window edges (and its
  // middle on desktop) are labelled so dates never crowd each other.
  const endIsToday = formatDayMonth(window.end) === formatDayMonth(today.getTime())
  const midpoint = window.start + (window.end - window.start) / 2
  const xTicks: FieldLayout['xTicks'] = x.ticks(tier === 'mobile' ? 2 : 4).map(date => ({
    t: date.getTime(),
    x: x(date.getTime()),
    label: null,
  }))
  xTicks.unshift({ t: window.start, x: x(window.start), label: formatDayMonth(window.start) })
  if (tier === 'desktop')
    xTicks.push({ t: midpoint, x: x(midpoint), label: formatDayMonth(midpoint) })
  xTicks.push({
    t: window.end,
    x: x(window.end),
    label: endIsToday ? 'aujourd’hui' : formatDayMonth(window.end),
  })

  const bandTop = 14
  const markerPriority = (marker: FieldMarkerInput): number =>
    (marker.attention ? 2 : 0) + (marker.relatedIds.length > 0 ? 1 : 0)
  const laidOutMarkers: LaidOutMarker[] =
    tier === 'mobile'
      ? []
      : markers
          .filter(marker => marker.t >= window.start && marker.t <= window.end)
          .sort((left, right) => markerPriority(right) - markerPriority(left))
          .slice(0, MAX_MARKERS)
          .sort((left, right) => left.t - right.t)
          .map((marker, index) => ({
            id: marker.id,
            kind: marker.kind,
            label: marker.label,
            x: x(marker.t),
            y: bandTop + (index % MARKER_ROWS) * MARKER_ROW_GAP,
            attention: marker.attention,
            links: marker.relatedIds.flatMap(targetId => {
              const end = endById.get(targetId)
              return end ? [{ targetId, x2: end.x, y2: end.y }] : []
            }),
          }))

  return {
    width,
    height,
    tier,
    window,
    plot,
    baselineY: y(0),
    yTicks,
    xTicks,
    series: laidOut,
    markers: laidOutMarkers,
    hiddenSeriesCount: series.length - visible.length,
  }
}
