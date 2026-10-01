import { cva, cx } from '@finance-os/styled-system/css'
import type { IChartApi } from 'lightweight-charts'
import { useEffect, useRef, useState } from 'react'
import { getTradingChartColors, removeChart } from './chart-colors'

export type EquityPoint = { date: string; equity: number }

// The placeholder frame (SSR and fallback) is dashed; the live chart container is bare.
const chartBox = cva({
  base: { position: 'relative', w: 'full' },
  variants: {
    placeholder: {
      true: {
        rounded: 'md',
        borderWidth: '1px',
        borderStyle: 'dashed',
        borderColor: 'border/40',
        bg: 'surface.1',
      },
    },
  },
})

const chartMessage = cva({
  base: {
    position: 'absolute',
    inset: '0',
    display: 'grid',
    placeItems: 'center',
    textStyle: 'xs',
    color: 'muted.foreground',
  },
  variants: {
    summary: { true: { px: '3', textAlign: 'center' } },
  },
})

type Props = {
  data: EquityPoint[]
  chartHeight?: number
  className?: string
  /** Currency label for tooltip / a11y. */
  currency?: string
}

/**
 * Equity-curve chart, client-only.
 * Lazy-loads `lightweight-charts` to keep initial bundle small.
 * Falls back to a text summary if rendering is not possible.
 */
export function EquityCurveChart({ data, chartHeight = 240, className, currency = 'USD' }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [isClient, setIsClient] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Terminal render state, exposed as `data-chart-state` for tests that must
  // wait for the lazy chart (loading, pending, ready or unavailable).
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (!isClient || !containerRef.current || data.length === 0) return
    let chart: IChartApi | null = null
    let resizeObserver: ResizeObserver | null = null

    let cancelled = false
    ;(async () => {
      try {
        const { AreaSeries, createChart } = await import('lightweight-charts')
        if (cancelled || !containerRef.current) return
        const colors = getTradingChartColors()
        // Assigned before the series is added so a failure below still removes
        // the canvas the library already mounted in the container.
        chart = createChart(containerRef.current, {
          height: chartHeight,
          autoSize: true,
          layout: {
            background: { color: 'transparent' },
            textColor: colors.text,
            fontSize: 11,
            attributionLogo: false,
          },
          rightPriceScale: { borderColor: colors.border },
          timeScale: { borderColor: colors.border },
          grid: {
            horzLines: { color: colors.grid },
            vertLines: { color: colors.grid },
          },
          crosshair: { mode: 1 },
          handleScroll: false,
          handleScale: false,
        })
        // lightweight-charts 5 API: series are added through their definition
        // (`addAreaSeries` was removed in v5, which left the chart unavailable).
        const series = chart.addSeries(AreaSeries, {
          lineColor: colors.teal,
          topColor: colors.tealSoft,
          bottomColor: colors.tealFaint,
          lineWidth: 2,
          priceLineVisible: false,
        })
        const chartData = data
          .filter(p => p.date && Number.isFinite(p.equity))
          .map(p => ({ time: p.date, value: p.equity }))
        series.setData(chartData)
        if (!cancelled) setReady(true)

        // Resize handling
        if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
          resizeObserver = new ResizeObserver(() => {
            // autoSize=true handles the rest; keep observer to retain layout
          })
          resizeObserver.observe(containerRef.current)
        }
      } catch (e) {
        removeChart(chart)
        chart = null
        if (!cancelled) setError(e instanceof Error ? e.message : 'chart_failed_to_load')
      }
    })()

    return () => {
      cancelled = true
      removeChart(chart)
      resizeObserver?.disconnect()
    }
  }, [data, chartHeight, isClient])

  if (!isClient) {
    return (
      <div
        className={cx(chartBox({ placeholder: true }), className)}
        style={{ height: chartHeight }}
        role="img"
        aria-label="Equity curve chart loading"
        data-chart-state="loading"
      >
        <div className={chartMessage()}>Chargement du graphique…</div>
      </div>
    )
  }

  if (error || data.length === 0) {
    const first = data[0]
    const last = data[data.length - 1]
    const summary =
      first && last
        ? `Capital de ${first.equity.toFixed(2)} ${currency} à ${last.equity.toFixed(2)} ${currency} sur ${data.length} points`
        : 'Données de capital indisponibles'
    return (
      <div
        className={cx(chartBox({ placeholder: true }), className)}
        style={{ height: chartHeight }}
        role="img"
        aria-label={summary}
        data-chart-state="unavailable"
      >
        <div className={chartMessage({ summary: true })}>
          {error ? 'Graphique indisponible' : summary}
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={cx(chartBox(), className)}
      style={{ height: chartHeight }}
      role="img"
      data-chart-state={ready ? 'ready' : 'pending'}
      aria-label={`Courbe de capital sur ${data.length} points`}
    />
  )
}
