import { useEffect, useRef, useState } from 'react'

export type Candle = {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume?: number
}

type Props = {
  data: Candle[]
  height?: number
  className?: string
  /** Optional human label for ARIA / fallback text. */
  symbol?: string
}

/**
 * Lazy-loaded candlestick chart for Trading Lab OHLCV previews.
 * Falls back to a textual summary on SSR / no data / load failure.
 */
export function CandleChart({ data, height = 220, className, symbol = 'symbol' }: Props) {
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
          rightPriceScale: { borderColor: 'rgba(255,255,255,0.06)' },
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
          addCandlestickSeries: (opts: Record<string, unknown>) => {
            setData: (
              d: Array<{
                time: string
                open: number
                high: number
                low: number
                close: number
              }>
            ) => void
          }
        }).addCandlestickSeries({
          upColor: 'rgb(74,222,128)',
          downColor: 'rgb(239,68,68)',
          borderVisible: false,
          wickUpColor: 'rgb(74,222,128)',
          wickDownColor: 'rgb(239,68,68)',
        })
        const formatted = data
          .filter(c => c.date && Number.isFinite(c.open))
          .map(c => ({
            time: c.date,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
          }))
        series.setData(formatted)
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
        aria-label={`Candlestick chart of ${symbol} loading`}
      >
        <div className="absolute inset-0 grid place-items-center text-xs text-muted-foreground">
          chart loading…
        </div>
      </div>
    )
  }

  if (error || data.length === 0) {
    const first = data[0]
    const last = data[data.length - 1]
    const summary =
      first && last
        ? `${symbol}: ${first.close.toFixed(2)} → ${last.close.toFixed(2)} (${data.length} bougies)`
        : `Aucune bougie disponible pour ${symbol}`
    return (
      <div
        className={`relative w-full rounded-md border border-dashed border-border/40 bg-surface-1 ${className ?? ''}`}
        style={{ height }}
        role="img"
        aria-label={summary}
      >
        <div className="absolute inset-0 grid place-items-center px-3 text-center text-xs text-muted-foreground">
          {error ? `Chart indisponible : ${error}` : summary}
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
      aria-label={`Candlestick chart of ${symbol} with ${data.length} candles`}
    />
  )
}
