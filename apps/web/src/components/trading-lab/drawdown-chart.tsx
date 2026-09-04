import { useEffect, useRef, useState } from 'react'
import { getTradingChartColors } from './chart-colors'

export type DrawdownPoint = { date: string; drawdown: number }

type Props = {
  data: DrawdownPoint[]
  height?: number
  className?: string
}

/**
 * Drawdown chart (negative-only area), client-only.
 * Lazy-loads `lightweight-charts`. Falls back to text summary on failure.
 */
export function DrawdownChart({ data, height = 180, className }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [isClient, setIsClient] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (!isClient || !containerRef.current || data.length === 0) return
    let chart: { remove: () => void } | null = null

    let cancelled = false
    ;(async () => {
      try {
        const mod = await import('lightweight-charts')
        if (cancelled || !containerRef.current) return
        const colors = getTradingChartColors()
        const created = mod.createChart(containerRef.current, {
          height,
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
        const series = (created as unknown as {
          addAreaSeries: (opts: Record<string, unknown>) => {
            setData: (d: Array<{ time: string; value: number }>) => void
          }
        }).addAreaSeries({
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
        chart = created as unknown as { remove: () => void }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'chart_failed_to_load')
      }
    })()

    return () => {
      cancelled = true
      try {
        chart?.remove()
      } catch {
        /* ignore */
      }
    }
  }, [data, height, isClient])

  if (!isClient) {
    return (
      <div
        className={`relative w-full rounded-md border border-dashed border-border/40 bg-surface-1 ${className ?? ''}`}
        style={{ height }}
        role="img"
        aria-label="Drawdown chart loading"
      >
        <div className="absolute inset-0 grid place-items-center text-xs text-muted-foreground">
          Chargement du graphique…
        </div>
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
        className={`relative w-full rounded-md border border-dashed border-border/40 bg-surface-1 ${className ?? ''}`}
        style={{ height }}
        role="img"
        aria-label={summary}
      >
        <div className="absolute inset-0 grid place-items-center px-3 text-center text-xs text-muted-foreground">
          {error ? 'Graphique indisponible' : summary}
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${className ?? ''}`}
      style={{ height }}
      role="img"
      aria-label={`Graphique de baisse sur ${data.length} points`}
    />
  )
}
