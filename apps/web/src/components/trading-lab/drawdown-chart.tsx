import { useEffect, useRef, useState } from 'react'

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
        const created = mod.createChart(containerRef.current, {
          height,
          autoSize: true,
          layout: {
            background: { color: 'transparent' },
            textColor: 'rgb(180,180,200)',
            fontSize: 11,
            attributionLogo: false,
          },
          rightPriceScale: {
            borderColor: 'rgba(255,255,255,0.06)',
            mode: 0,
          },
          timeScale: { borderColor: 'rgba(255,255,255,0.06)' },
          grid: {
            horzLines: { color: 'rgba(255,255,255,0.04)' },
            vertLines: { color: 'rgba(255,255,255,0.04)' },
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
          lineColor: 'rgb(248,113,113)',
          topColor: 'rgba(248,113,113,0.05)',
          bottomColor: 'rgba(248,113,113,0.30)',
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
          chart loading…
        </div>
      </div>
    )
  }

  if (error || data.length === 0) {
    const max = data.reduce((acc, p) => Math.max(acc, Math.abs(p.drawdown)), 0)
    const summary =
      data.length > 0
        ? `Max drawdown ${(max * 100).toFixed(2)}% over ${data.length} points`
        : 'No drawdown data available'
    return (
      <div
        className={`relative w-full rounded-md border border-dashed border-border/40 bg-surface-1 ${className ?? ''}`}
        style={{ height }}
        role="img"
        aria-label={summary}
      >
        <div className="absolute inset-0 grid place-items-center px-3 text-center text-xs text-muted-foreground">
          {error ? `Chart unavailable: ${error}` : summary}
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
      aria-label={`Drawdown chart with ${data.length} data points`}
    />
  )
}
