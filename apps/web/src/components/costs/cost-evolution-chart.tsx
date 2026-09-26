import { css } from '@finance-os/styled-system/css'
import { token } from '@finance-os/styled-system/tokens'
import { extent, sum } from 'd3-array'
import { scaleLinear } from 'd3-scale'
import { area, curveMonotoneX, line } from 'd3-shape'
import { useId, useMemo, useRef, useState } from 'react'
import type { DashboardAdvisorSpendSeriesPointResponse } from '@/features/dashboard-types'
import { useElementWidth } from '@/lib/use-element-width'

const formatUsd = (value: number) =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 4,
  }).format(value)

const emptyState = css({
  display: 'flex',
  minH: '48',
  alignItems: 'center',
  justifyContent: 'center',
  borderYWidth: '1px',
  borderColor: 'border/50',
  textStyle: 'sm',
  color: 'muted.foreground',
})

const chartFigure = css({ position: 'relative', minW: '0' })

const chartSurface = css({ overflow: 'visible' })

const pointTooltip = css({
  pointerEvents: 'none',
  position: 'absolute',
  top: '0',
  rounded: 'control',
  borderWidth: '1px',
  borderColor: 'border',
  bg: 'card',
  px: '2.5',
  py: '2',
  shadow: 'overlay',
})

const tooltipValue = css({ textStyle: 'financial', fontSize: 'xs', lineHeight: 'xs' })

const tooltipDate = css({ fontFamily: 'mono', fontSize: '10px', color: 'muted.foreground' })

const chartCaption = css({
  mt: '2',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '3',
  fontFamily: 'mono',
  fontSize: '10px',
  color: 'muted.foreground',
})

const visuallyHidden = css({ srOnly: true })

export function CostEvolutionChart({ data }: { data: DashboardAdvisorSpendSeriesPointResponse[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const width = useElementWidth(containerRef)
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const gradientId = `cost-gradient-${useId().replace(/:/g, '')}`
  const height = 210
  const margin = { top: 14, right: 10, bottom: 24, left: 10 }
  const innerWidth = Math.max(0, width - margin.left - margin.right)
  const innerHeight = height - margin.top - margin.bottom

  const chart = useMemo(() => {
    if (data.length < 2 || innerWidth === 0) return null
    const values = extent(data, point => point.usd)
    const maxValue = values[1] ?? 0
    const x = scaleLinear()
      .domain([0, data.length - 1])
      .range([0, innerWidth])
    const y = scaleLinear()
      .domain([0, Math.max(maxValue * 1.12, 0.01)])
      .range([innerHeight, 0])
      .nice()
    const linePath = line<DashboardAdvisorSpendSeriesPointResponse>()
      .x((_, index) => x(index))
      .y(point => y(point.usd))
      .curve(curveMonotoneX)(data)
    const areaPath = area<DashboardAdvisorSpendSeriesPointResponse>()
      .x((_, index) => x(index))
      .y0(innerHeight)
      .y1(point => y(point.usd))
      .curve(curveMonotoneX)(data)
    return {
      linePath,
      areaPath,
      points: data.map((point, index) => ({ ...point, x: x(index), y: y(point.usd) })),
    }
  }, [data, innerHeight, innerWidth])

  if (data.length < 2) {
    return (
      <figure ref={containerRef}>
        <div className={emptyState}>Historique indisponible</div>
      </figure>
    )
  }

  const active = chart && activeIndex !== null ? chart.points[activeIndex] : null

  return (
    <figure ref={containerRef} className={chartFigure}>
      {chart ? (
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
          height={height}
          role="img"
          aria-label="Évolution quotidienne des coûts Advisor en dollars"
          className={chartSurface}
          onPointerLeave={() => setActiveIndex(null)}
          onPointerMove={event => {
            const bounds = event.currentTarget.getBoundingClientRect()
            const relativeX = event.clientX - bounds.left - margin.left
            const index = Math.round((relativeX / Math.max(innerWidth, 1)) * (data.length - 1))
            setActiveIndex(Math.max(0, Math.min(data.length - 1, index)))
          }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={token('colors.primary')} stopOpacity="0.28" />
              <stop offset="100%" stopColor={token('colors.primary')} stopOpacity="0" />
            </linearGradient>
          </defs>
          <g transform={`translate(${margin.left},${margin.top})`}>
            <line
              x1="0"
              x2={innerWidth}
              y1={innerHeight}
              y2={innerHeight}
              stroke={token('colors.border')}
            />
            <path d={chart.areaPath ?? ''} fill={`url(#${gradientId})`} />
            <path
              d={chart.linePath ?? ''}
              fill="none"
              stroke={token('colors.primary')}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {active ? (
              <>
                <line
                  x1={active.x}
                  x2={active.x}
                  y1="0"
                  y2={innerHeight}
                  stroke={token('colors.muted.foreground')}
                  strokeDasharray="3 4"
                  opacity="0.5"
                />
                <circle
                  cx={active.x}
                  cy={active.y}
                  r="4"
                  fill={token('colors.card')}
                  stroke={token('colors.primary')}
                  strokeWidth="2"
                />
              </>
            ) : null}
          </g>
        </svg>
      ) : (
        <div style={{ height }} />
      )}
      {active ? (
        <div
          className={pointTooltip}
          style={{
            left: Math.min(Math.max(active.x + margin.left - 44, 0), Math.max(width - 112, 0)),
          }}
        >
          <p className={tooltipValue}>{formatUsd(active.usd)}</p>
          <p className={tooltipDate}>{active.date}</p>
        </div>
      ) : null}
      <figcaption className={chartCaption}>
        <span>{data[0]?.date}</span>
        <span>{formatUsd(sum(data, point => point.usd))} mesurés</span>
        <span>{data.at(-1)?.date}</span>
      </figcaption>
      <table className={visuallyHidden}>
        <caption>Coûts Advisor quotidiens</caption>
        <thead>
          <tr>
            <th>Date</th>
            <th>Coût en dollars</th>
          </tr>
        </thead>
        <tbody>
          {data.map(point => (
            <tr key={point.date}>
              <td>{point.date}</td>
              <td>{point.usd}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
