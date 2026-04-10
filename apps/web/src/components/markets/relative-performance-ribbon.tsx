import { useMemo } from 'react'
import * as d3 from 'd3'
import type { DashboardMarketQuote } from '@/features/markets/types'

const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--primary)',
]

export function RelativePerformanceRibbon({
  items,
}: {
  items: DashboardMarketQuote[]
}) {
  const width = 760
  const height = 260
  const margin = { top: 18, right: 24, bottom: 30, left: 12 }

  const data = useMemo(() => {
    return items
      .slice(0, 6)
      .map((item, index) => {
        const base = item.history[0]?.value ?? 0
        const normalizedHistory = item.history.map(point => ({
          date: point.date,
          value: base > 0 ? (point.value / base) * 100 : 100,
        }))

        return {
          id: item.instrumentId,
          label: item.shortLabel,
          color: CHART_COLORS[index % CHART_COLORS.length] ?? 'var(--primary)',
          values: normalizedHistory,
          latest:
            normalizedHistory[normalizedHistory.length - 1]?.value ?? 100,
        }
      })
      .filter(item => item.values.length >= 2)
  }, [items])

  const chart = useMemo(() => {
    const flat = data.flatMap(item => item.values)
    if (flat.length === 0) {
      return null
    }

    const x = d3
      .scaleLinear()
      .domain([0, Math.max(1, Math.max(...data.map(item => item.values.length - 1)))])
      .range([margin.left, width - margin.right])
    const values = flat.map(point => point.value)
    const extent = d3.extent(values) as [number, number]
    const pad = Math.max(1.5, ((extent[1] ?? 100) - (extent[0] ?? 100)) * 0.16)
    const y = d3
      .scaleLinear()
      .domain([(extent[0] ?? 100) - pad, (extent[1] ?? 100) + pad])
      .range([height - margin.bottom, margin.top])

    const line = d3
      .line<{ date: string; value: number }>()
      .x((_, index) => x(index))
      .y(point => y(point.value))
      .curve(d3.curveCatmullRom.alpha(0.5))

    const baselineY = y(100)
    const gridValues = y.ticks(4)

    return {
      x,
      y,
      line,
      baselineY,
      gridValues,
    }
  }, [data])

  if (!chart || data.length === 0) {
    return (
      <div className="flex h-[260px] items-center justify-center rounded-2xl border border-border/60 bg-surface-1">
        <span className="font-mono text-xs text-muted-foreground/60">[ performance indisponible ]</span>
      </div>
    )
  }

  return (
    <div className="rounded-[28px] border border-border/60 bg-[radial-gradient(circle_at_top,_oklch(from_var(--primary)_l_c_h/16%),_transparent_42%),linear-gradient(180deg,var(--surface-1),var(--surface-0))] p-4 shadow-[var(--shadow-lg)]">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-primary/70">Relative Performance Ribbon</p>
          <h3 className="mt-1 text-lg font-semibold text-foreground">Base 100 sur l'historique visible</h3>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {data.map(item => (
            <span
              key={item.id}
              className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-background/70 px-2.5 py-1 text-muted-foreground"
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              {item.label}
            </span>
          ))}
        </div>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-[260px] w-full"
        role="img"
        aria-label="Performance relative des actifs suivis"
      >
        {chart.gridValues.map(value => {
          const y = chart.y(value)
          return (
            <g key={`grid-${value}`}>
              <line
                x1={margin.left}
                x2={width - margin.right}
                y1={y}
                y2={y}
                stroke="oklch(from var(--border) l c h / 35%)"
                strokeDasharray="4 6"
              />
              <text
                x={width - margin.right}
                y={y - 6}
                textAnchor="end"
                className="fill-muted-foreground/70 text-[11px]"
              >
                {value.toFixed(0)}
              </text>
            </g>
          )
        })}

        <line
          x1={margin.left}
          x2={width - margin.right}
          y1={chart.baselineY}
          y2={chart.baselineY}
          stroke="oklch(from var(--primary) l c h / 55%)"
          strokeWidth="1.5"
        />

        {data.map(item => {
          const path = chart.line(item.values) ?? ''
          const lastPoint = item.values[item.values.length - 1]
          const lastIndex = item.values.length - 1
          if (!lastPoint) {
            return null
          }

          return (
            <g key={item.id}>
              <path
                d={path}
                fill="none"
                stroke={item.color}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle
                cx={chart.x(lastIndex)}
                cy={chart.y(lastPoint.value)}
                r="4"
                fill={item.color}
              />
              <text
                x={chart.x(lastIndex) + 10}
                y={chart.y(lastPoint.value) + 4}
                className="fill-foreground text-[11px] font-medium"
              >
                {item.label}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
