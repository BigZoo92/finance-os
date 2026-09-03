import { describe, expect, it } from 'vitest'
import {
  buildFieldLayout,
  computeTimeWindow,
  computeYAmplitude,
  type FieldMarkerInput,
  type FieldSeries,
  fieldHeightFor,
  radiusForImportance,
  relaxLabels,
  resolveFieldTier,
  selectLabelledIds,
  selectVisibleSeries,
  toFieldSeries,
} from './field-layout'
import type { RadarMarket } from './view-model'

const DAY = 24 * 60 * 60 * 1000
const T0 = Date.parse('2026-03-01T00:00:00Z')

const market = (overrides: Partial<RadarMarket>): RadarMarket => ({
  id: 'spy-us',
  label: 'S&P 500',
  symbol: 'SPY',
  category: 'markets',
  region: 'us',
  currency: 'USD',
  price: 100,
  changePct: 1,
  asOf: null,
  quoteMode: 'eod',
  sessionLabel: 'Marché fermé',
  history: [
    { date: '2026-03-01', value: 100 },
    { date: '2026-03-05', value: 102 },
    { date: '2026-03-10', value: 99 },
  ],
  ...overrides,
})

const series = (id: string, endPct: number, importance = 0, days = 10): FieldSeries => ({
  id,
  label: id,
  points: [
    { t: T0, pct: 0 },
    { t: T0 + days * DAY, pct: endPct },
  ],
  endPct,
  endT: T0 + days * DAY,
  tone: endPct > 0 ? 'positive' : endPct < 0 ? 'negative' : 'neutral',
  importance,
})

describe('toFieldSeries', () => {
  it('measures variation against the first observation', () => {
    const result = toFieldSeries(market({}), 2)
    expect(result?.points.map(point => Math.round(point.pct * 100) / 100)).toEqual([0, 2, -1])
    expect(result?.endPct).toBeCloseTo(-1)
    expect(result?.tone).toBe('negative')
    expect(result?.importance).toBe(2)
  })

  it('leaves markets without at least two dated observations out of the field', () => {
    expect(toFieldSeries(market({ history: [{ date: '2026-03-01', value: 100 }] }), 0)).toBeNull()
    expect(toFieldSeries(market({ history: [] }), 0)).toBeNull()
    expect(
      toFieldSeries(
        market({
          history: [
            { date: 'bad', value: 1 },
            { date: 'worse', value: 2 },
          ],
        }),
        0
      )
    ).toBeNull()
  })

  it('skips non positive base values instead of dividing by them', () => {
    const result = toFieldSeries(
      market({
        history: [
          { date: '2026-03-01', value: 0 },
          { date: '2026-03-02', value: 50 },
          { date: '2026-03-03', value: 55 },
        ],
      }),
      0
    )
    expect(result?.points).toHaveLength(2)
    expect(result?.endPct).toBeCloseTo(10)
  })
})

describe('domains', () => {
  it('computes the shared time window and a readable symmetric amplitude', () => {
    const items = [series('a', 0.4), series('b', -1.2, 0, 8)]
    expect(computeTimeWindow(items)).toEqual({ start: T0, end: T0 + 10 * DAY })
    expect(computeTimeWindow([])).toBeNull()

    expect(computeYAmplitude([series('a', 0.5)])).toBe(1)
    expect(computeYAmplitude([series('a', 1.5)])).toBe(2)
    expect(computeYAmplitude([series('a', -3)])).toBe(5)
    expect(computeYAmplitude([series('a', 8)])).toBe(10)
    expect(computeYAmplitude([series('a', 23)])).toBe(30)
  })

  it('resolves tiers and heights from the measured width', () => {
    expect(resolveFieldTier(390)).toBe('mobile')
    expect(resolveFieldTier(700)).toBe('compact')
    expect(resolveFieldTier(874)).toBe('desktop')
    expect(resolveFieldTier(1024)).toBe('desktop')
    expect(fieldHeightFor('mobile', 390)).toBe(250)
    expect(fieldHeightFor('desktop', 2000)).toBe(620)
  })
})

describe('density control', () => {
  const many = Array.from({ length: 12 }, (_, index) =>
    series(`s${index}`, index - 6, index === 3 ? 3 : 0)
  )

  it('keeps the strongest trajectories on small fields and always the focused one', () => {
    const visible = selectVisibleSeries(many, 'mobile', new Set(['s0']))
    expect(visible).toHaveLength(6)
    expect(visible.map(item => item.id)).toContain('s3')
    expect(visible.map(item => item.id)).toContain('s0')
    expect(selectVisibleSeries(many, 'desktop')).toHaveLength(12)
  })

  it('labels only the top items on mobile', () => {
    expect(selectLabelledIds(many, 'mobile').size).toBe(3)
    expect(selectLabelledIds(many, 'mobile').has('s3')).toBe(true)
    expect(selectLabelledIds(many, 'desktop').size).toBe(12)
  })

  it('relaxes labels without overlap, in order, inside the bounds', () => {
    const positions = relaxLabels(
      [
        { id: 'a', y: 100 },
        { id: 'b', y: 104 },
        { id: 'c', y: 106 },
        { id: 'd', y: 398 },
      ],
      { minGap: 14, top: 20, bottom: 400 }
    )
    const a = positions.get('a') ?? 0
    const b = positions.get('b') ?? 0
    const c = positions.get('c') ?? 0
    const d = positions.get('d') ?? 0
    expect(b - a).toBeGreaterThanOrEqual(14)
    expect(c - b).toBeGreaterThanOrEqual(14)
    expect(d).toBeLessThanOrEqual(400)
    expect(a).toBeGreaterThanOrEqual(20)
  })

  it('grows the endpoint with importance', () => {
    const radii = [0, 1, 2, 3].map(importance => radiusForImportance(importance, 'desktop'))
    expect(radii).toEqual([...radii].sort((left, right) => left - right))
    expect(radiusForImportance(3, 'mobile')).toBeLessThan(radiusForImportance(3, 'desktop'))
  })
})

describe('buildFieldLayout', () => {
  const items = [series('spy', 1.2, 3), series('qqq', 0.5), series('ief', -0.8, 2)]
  const markers: FieldMarkerInput[] = [
    {
      id: 'macro:FEDFUNDS',
      kind: 'macro',
      label: 'Fed funds 4,50 %',
      t: T0 + 2 * DAY,
      relatedIds: [],
      attention: false,
    },
    {
      id: 'event:1',
      kind: 'event',
      label: 'X 8 mars',
      t: T0 + 7 * DAY,
      relatedIds: ['spy'],
      attention: true,
    },
    {
      id: 'event:2',
      kind: 'event',
      label: 'Hors fenêtre',
      t: T0 + 40 * DAY,
      relatedIds: [],
      attention: false,
    },
  ]

  it('returns nothing without room or data', () => {
    expect(
      buildFieldLayout({ series: [], markers: [], width: 900, height: 500, tier: 'desktop' })
    ).toBeNull()
    expect(
      buildFieldLayout({ series: items, markers: [], width: 100, height: 500, tier: 'desktop' })
    ).toBeNull()
  })

  it('converges every trajectory on the right edge and labels them all on desktop', () => {
    const layout = buildFieldLayout({
      series: items,
      markers,
      width: 1000,
      height: 560,
      tier: 'desktop',
      today: new Date('2026-03-12T00:00:00Z'),
    })
    if (!layout) throw new Error('layout expected')

    const endingToday = buildFieldLayout({
      series: items,
      markers: [],
      width: 1000,
      height: 560,
      tier: 'desktop',
      today: new Date('2026-03-11T15:00:00Z'),
    })
    expect(endingToday?.xTicks.at(-1)?.label).toBe('aujourd’hui')

    expect(layout.series).toHaveLength(3)
    for (const item of layout.series) {
      expect(item.end.x).toBeCloseTo(layout.plot.right)
      expect(item.labelY).not.toBeNull()
      expect(item.d.startsWith('M')).toBe(true)
    }
    const spy = layout.series.find(item => item.id === 'spy')
    const ief = layout.series.find(item => item.id === 'ief')
    expect((spy?.end.y ?? 0) < layout.baselineY).toBe(true)
    expect((ief?.end.y ?? 0) > layout.baselineY).toBe(true)
    expect(layout.yTicks.map(tick => tick.label.replace(/ /g, ' '))).toEqual(['+2 %', '0', '-2 %'])
    expect(layout.xTicks[0]?.label).toBe('1 mars')
    expect(layout.xTicks.at(-1)?.label).toBe('11 mars')
    expect(layout.hiddenSeriesCount).toBe(0)
  })

  it('places dated context inside the window only and links it to related markets', () => {
    const layout = buildFieldLayout({
      series: items,
      markers,
      width: 1000,
      height: 560,
      tier: 'desktop',
    })
    if (!layout) throw new Error('layout expected')

    expect(layout.markers.map(marker => marker.id)).toEqual(['macro:FEDFUNDS', 'event:1'])
    const event = layout.markers.find(marker => marker.id === 'event:1')
    const spy = layout.series.find(item => item.id === 'spy')
    expect(event?.links).toEqual([{ targetId: 'spy', x2: spy?.end.x, y2: spy?.end.y }])
    expect(event?.y).toBeLessThan(layout.plot.top)
  })

  it('drops the context band and most labels on mobile', () => {
    const layout = buildFieldLayout({
      series: items,
      markers,
      width: 390,
      height: 250,
      tier: 'mobile',
    })
    if (!layout) throw new Error('layout expected')

    expect(layout.markers).toEqual([])
    expect(layout.series.filter(item => item.labelY !== null)).toHaveLength(3)
    expect(layout.xTicks.filter(tick => tick.label !== null)).toHaveLength(2)
  })
})
