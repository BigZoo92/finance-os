import { cva, cx } from '@finance-os/styled-system/css'
import type { IChartApi } from 'lightweight-charts'
import { useEffect, useRef, useState } from 'react'
import { getTradingChartColors, removeChart } from './chart-colors'

export type DrawdownPoint = { date: string; drawdown: number }

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
  data: DrawdownPoint[]
  chartHeight?: number
  className?: string
}

/**
 * Drawdown chart (negative-only area), client-only.
 * Lazy-loads `lightweight-charts`. Falls back to text summary on failure.
 */
export function DrawdownChart({ data, chartHeight = 180, className }: Props) {
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
          rightPriceScale: {
            borderColor: colors.border,
            mode: 0,
          },
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
          lineColor: colors.negative,
          topColor: colors.negativeFaint,
          bottomColor: colors.negativeSoft,
          lineWidth: 2,
          priceLineVisible: false,
          priceFormat: { type: 'percent', precision: 2, minMove: 0.01 },
        })
        const chartData = data
          .filter(p => p.date && Number.isFinite(p.drawdown))
          .map(p => ({ time: p.date, value: -Math.abs(p.drawdown) * 100 }))
        series.setData(chartData)
        if (!cancelled) setReady(true)
      } catch (e) {
        removeChart(chart)
        chart = null
        if (!cancelled) setError(e instanceof Error ? e.message : 'chart_failed_to_load')
      }
    })()

    return () => {
      cancelled = true
      removeChart(chart)
    }
  }, [data, chartHeight, isClient])

  if (!isClient) {
    return (
      <div
        className={cx(chartBox({ placeholder: true }), className)}
        style={{ height: chartHeight }}
        role="img"
        aria-label="Drawdown chart loading"
        data-chart-state="loading"
      >
        <div className={chartMessage()}>Chargement du graphique…</div>
      </div>
    )
  }

  if (error || data.length === 0) {
    const max = data.reduce((acc, p) => Math.max(acc, Math.abs(p.drawdown)), 0)
    const summary =
      data.length > 0
        ? `Baisse maximale de ${(max * 100).toFixed(2)}% sur ${data.length} points`
        : 'Données de baisse indisponibles'
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
      aria-label={`Graphique de baisse sur ${data.length} points`}
    />
  )
}
