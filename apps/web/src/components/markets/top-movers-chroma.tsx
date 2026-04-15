/**
 * TopMoversChroma — interactive "top movers" hero strip using React Bits
 * ChromaGrid. The image slot is replaced with an SVG data-URI showing the
 * ticker symbol, and the gradient/border are derived from the day change.
 *
 * Used at the top of `/marches` to give the page an editorial entry point
 * without losing the dense detail underneath.
 */
import type { DashboardMarketsOverviewResponse } from '@/features/markets/types'
import ChromaGrid, { type ChromaItem } from '@/components/reactbits/chroma-grid'

type Item = DashboardMarketsOverviewResponse['panorama']['items'][number]

function tickerSvg(symbol: string, label: string, accent: string) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 300'>
    <defs>
      <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
        <stop offset='0' stop-color='${accent}' stop-opacity='0.95'/>
        <stop offset='1' stop-color='#0d0814' stop-opacity='0.95'/>
      </linearGradient>
      <radialGradient id='h' cx='30%' cy='20%' r='80%'>
        <stop offset='0' stop-color='#fff' stop-opacity='0.18'/>
        <stop offset='1' stop-color='#fff' stop-opacity='0'/>
      </radialGradient>
    </defs>
    <rect width='300' height='300' fill='url(#g)'/>
    <rect width='300' height='300' fill='url(#h)'/>
    <text x='30' y='70' fill='rgba(255,255,255,0.55)' font-family='JetBrains Mono, monospace' font-size='13' letter-spacing='4'>· ${label.toUpperCase()}</text>
    <text x='30' y='200' fill='#fff' font-family='Inter, sans-serif' font-weight='800' font-size='80' letter-spacing='-3'>${symbol}</text>
  </svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

function toChromaItem(item: Item): ChromaItem {
  const positive = (item.dayChangePct ?? 0) >= 0
  const accent = positive ? '#5fe39d' : '#ff6b8a'
  const formatted = item.dayChangePct === null
    ? 'n/d'
    : `${positive ? '+' : ''}${item.dayChangePct.toFixed(2)} %`
  return {
    image: tickerSvg(item.symbol, item.shortLabel, accent),
    title: item.shortLabel,
    subtitle: `${item.exchange} · ${formatted}`,
    handle: item.symbol,
    borderColor: accent,
    gradient: `linear-gradient(160deg, ${accent}33, oklch(from var(--card) l c h / 90%))`,
  }
}

export function TopMoversChroma({
  items,
  className = '',
}: {
  items: Item[]
  className?: string
}) {
  if (!items.length) return null
  // Sort by absolute day-change to surface the strongest movers
  const movers = [...items]
    .filter(i => i.dayChangePct !== null)
    .sort((a, b) => Math.abs((b.dayChangePct ?? 0)) - Math.abs((a.dayChangePct ?? 0)))
    .slice(0, 6)
    .map(toChromaItem)

  return (
    <section className={`relative ${className}`}>
      <header className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-primary/80">Movers</p>
          <h3 className="mt-0.5 text-lg font-semibold tracking-tight">Top mouvements du jour</h3>
        </div>
      </header>
      <div className="min-h-[360px]">
        <ChromaGrid items={movers} radius={300} />
      </div>
    </section>
  )
}

export default TopMoversChroma
