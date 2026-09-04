import { useEffect, useRef, useState } from 'react'
import { getTradingChartColors } from './chart-colors'

export type EquityPoint = { date: string; equity: number }

type Props = {
  data: EquityPoint[]
  height?: number
  className?: string
  /** Currency label for tooltip / a11y. */
  currency?: string
}

/**
 * Equity-curve chart, client-only.
 * Lazy-loads `lightweight-charts` to keep initial bundle small.
 * Falls back to a text summary if rendering is not possible.
 */
export function EquityCurveChart({ data, height = 240, className, currency = 'USD' }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [isClient, setIsClient] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (!isClient || !containerRef.current || data.length === 0) return
    let chart: { remove: () => void } | null = null
    let resizeObserver: ResizeObserver | null = null

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
        // Type ref: lightweight-charts API differs across versions — use any-cast minimally
        const series = (created as unknown as {
          addAreaSeries: (opts: Record<string, unknown>) => {
            setData: (d: Array<{ time: string; value: number }>) => void
          }
        }).addAreaSeries({
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
        chart = created as unknown as { remove: () => void }

        // Resize handling
        if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
          resizeObserver = new ResizeObserver(() => {
            // autoSize=true handles the rest; keep observer to retain layout
          })
          resizeObserver.observe(containerRef.current)
        }
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
      resizeObserver?.disconnect()
    }
  }, [data, height, isClient])

  if (!isClient) {
    return (
      <div
        className={`relative w-full rounded-md border border-dashed border-border/40 bg-surface-1 ${className ?? ''}`}
        style={{ height }}
        role="img"
        aria-label="Equity curve chart loading"
      >
        <div className="absolute inset-0 grid place-items-center text-xs text-muted-foreground">
          Chargement du graphique…
        </div>
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
      aria-label={`Courbe de capital sur ${data.length} points`}
    />
  )
}
