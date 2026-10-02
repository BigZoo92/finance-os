/**
 * RadarMarketStrip — the first-glance row of monitored markets.
 *
 * Desktop: labels spread across the page width. Mobile: horizontally
 * scrollable chips. The two compositions are CSS-only so server and client
 * render the same markup. Each item is a real button that focuses the
 * market in the field; unknown variations are omitted, never shown as zero.
 */
import { css, cva } from '@finance-os/styled-system/css'
import { PercentChange } from '@finance-os/ui/components'
import type { RadarScope } from '@/features/radar/view-model'

// `scrollbar: 'hidden'` is the former `[-ms-overflow-style:none] [scrollbar-width:none]
// [&::-webkit-scrollbar]:hidden` trio.
const strip = css({
  display: 'flex',
  gap: '2',
  overflowX: 'auto',
  pb: '1',
  scrollbar: 'hidden',
  lg: {
    flexWrap: 'wrap',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    columnGap: '6',
    rowGap: '2',
    overflow: 'visible',
    pb: '0',
  },
})

const stripItem = css({ flexShrink: '0' })

const stripButton = cva({
  base: {
    display: 'flex',
    minH: '9',
    alignItems: 'baseline',
    gap: '2',
    whiteSpace: 'nowrap',
    rounded: 'control',
    borderWidth: '1px',
    borderColor: 'foreground/10',
    bg: 'surface.1',
    px: '2.5',
    py: '1.5',
    outlineStyle: 'none',
    transitionProperty: 'colors',
    transitionDuration: '150ms',
    transitionTimingFunction: 'default',
    _focusVisible: { boxShadow: '0 0 0 2px color-mix(in srgb, {colors.ring} 70%, transparent)' },
    lg: { minH: '7', borderWidth: '0', bg: 'transparent', px: '0.5', py: '0' },
  },
  variants: {
    focused: {
      true: { color: 'foreground' },
      false: { color: 'foreground/85', _hover: { color: 'foreground' } },
    },
  },
})

const stripLabel = css({ textStyle: 'xs', lg: { fontSize: '13px' } })

// `font-financial text-[11px] tabular-nums lg:text-xs`. The `lg` size is written as
// longhands: a conditional `textStyle` sits in the compositions layer and would lose
// to the base `fontSize` atom.
const stripValue = css({
  textStyle: 'financial',
  fontSize: '11px',
  fontVariantNumeric: 'tabular-nums',
  color: 'foreground/65',
  lg: { fontSize: 'xs', lineHeight: 'xs' },
})

type RadarMarketStripProps = {
  items: RadarScope['strip']
  focusedId: string | null
  onSelect: (id: string, trigger: HTMLElement) => void
}

export function RadarMarketStrip({ items, focusedId, onSelect }: RadarMarketStripProps) {
  if (items.length === 0) return null

  return (
    <ul aria-label="Marchés suivis" className={strip}>
      {items.map(item => {
        const focused = focusedId === item.id
        return (
          <li key={item.id} className={stripItem}>
            <button
              type="button"
              aria-pressed={focused}
              onClick={event => onSelect(item.id, event.currentTarget)}
              className={stripButton({ focused })}
            >
              <span className={stripLabel}>{item.label}</span>
              {item.kind === 'market' ? (
                item.changePct !== null ? (
                  <PercentChange
                    value={item.changePct}
                    decimals={1}
                    fontSize="11px"
                    lg={{ fontSize: 'xs', lineHeight: 'xs' }}
                  />
                ) : null
              ) : (
                <span className={stripValue}>{item.display}</span>
              )}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
