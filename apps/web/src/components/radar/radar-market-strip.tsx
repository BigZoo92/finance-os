/**
 * RadarMarketStrip — the first-glance row of monitored markets.
 *
 * Desktop: labels spread across the page width. Mobile: horizontally
 * scrollable chips. The two compositions are CSS-only so server and client
 * render the same markup. Each item is a real button that focuses the
 * market in the field; unknown variations are omitted, never shown as zero.
 */
import { PercentChange } from '@finance-os/ui/components'
import type { RadarScope } from '@/features/radar/view-model'

type RadarMarketStripProps = {
  items: RadarScope['strip']
  focusedId: string | null
  onSelect: (id: string, trigger: HTMLElement) => void
}

export function RadarMarketStrip({ items, focusedId, onSelect }: RadarMarketStripProps) {
  if (items.length === 0) return null

  return (
    <ul
      aria-label="Marchés suivis"
      className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:flex-wrap lg:items-baseline lg:justify-between lg:gap-x-6 lg:gap-y-2 lg:overflow-visible lg:pb-0"
    >
      {items.map(item => {
        const focused = focusedId === item.id
        return (
          <li key={item.id} className="shrink-0">
            <button
              type="button"
              aria-pressed={focused}
              onClick={event => onSelect(item.id, event.currentTarget)}
              className={`flex min-h-9 items-baseline gap-2 whitespace-nowrap rounded-control border border-foreground/10 bg-surface-1 px-2.5 py-1.5 outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring/70 lg:min-h-7 lg:border-0 lg:bg-transparent lg:px-0.5 lg:py-0 ${
                focused ? 'text-foreground' : 'text-foreground/85 hover:text-foreground'
              }`}
            >
              <span className="text-xs lg:text-[13px]">{item.label}</span>
              {item.kind === 'market' ? (
                item.changePct !== null ? (
                  <PercentChange
                    value={item.changePct}
                    decimals={1}
                    className="text-[11px] lg:text-xs"
                  />
                ) : null
              ) : (
                <span className="font-financial text-[11px] tabular-nums text-foreground/65 lg:text-xs">
                  {item.display}
                </span>
              )}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
