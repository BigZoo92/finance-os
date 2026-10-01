/**
 * Radar events — short, scannable, time-aware rows.
 *
 * Attention events carry the signal orange marker; everything else stays
 * quiet. No ingestion status, no provider diagnostics. Mobile shows fewer
 * rows through CSS so server and client markup stay identical.
 */
import { css, cva } from '@finance-os/styled-system/css'
import { formatEventMoment, type RadarEvent } from '@/features/radar/view-model'

const eventItem = cva({
  base: {
    borderBottomWidth: '1px',
    borderColor: 'foreground/9',
    _last: { borderBottomWidth: '0' },
  },
  variants: {
    desktopOnly: {
      true: { display: 'none', lg: { display: 'block' } },
      false: {},
    },
  },
})

const eventButton = cva({
  base: {
    display: 'flex',
    minH: '11',
    w: 'full',
    alignItems: 'center',
    gap: '3',
    py: '2.5',
    textAlign: 'left',
    outlineStyle: 'none',
    transitionProperty: 'colors',
    transitionDuration: '150ms',
    transitionTimingFunction: 'default',
    _focusVisible: { boxShadow: '0 0 0 2px color-mix(in srgb, {colors.ring} 70%, transparent)' },
  },
  variants: {
    focused: {
      true: { color: 'foreground' },
      false: { _hover: { color: 'foreground' } },
    },
  },
})

const eventMarker = cva({
  base: { boxSize: '1.5', flexShrink: '0', rounded: '1px' },
  variants: {
    attention: {
      true: { bg: 'primary' },
      false: { bg: 'foreground/40' },
    },
  },
})

const eventSource = css({ flexShrink: '0', fontSize: '13px', color: 'foreground' })

const eventLabel = css({
  minW: '0',
  flex: '1',
  truncate: true,
  textStyle: 'xs',
  color: 'foreground/55',
})

const eventTime = css({
  ml: 'auto',
  flexShrink: '0',
  fontFamily: 'mono',
  fontSize: '11px',
  color: 'foreground/55',
})

type RadarEventsProps = {
  events: RadarEvent[]
  focusedId: string | null
  limit: number
  mobileLimit: number
  onSelect: (event: RadarEvent, trigger: HTMLElement) => void
}

export function RadarEvents({ events, focusedId, limit, mobileLimit, onSelect }: RadarEventsProps) {
  const visible = events.slice(0, limit)

  return (
    <ul aria-label="Événements">
      {visible.map((event, index) => {
        const focused = focusedId === event.id
        const moment = formatEventMoment(event.publishedAt)
        return (
          <li key={event.id} className={eventItem({ desktopOnly: index >= mobileLimit })}>
            <button
              type="button"
              aria-pressed={focused}
              onClick={element => onSelect(event, element.currentTarget)}
              className={eventButton({ focused })}
            >
              <span
                aria-hidden="true"
                className={eventMarker({ attention: event.requiresAttention })}
              />
              <span className={eventSource}>{event.sourceLabel}</span>
              <span className={eventLabel}>{event.author ?? event.title}</span>
              {moment ? (
                <time dateTime={event.publishedAt} className={eventTime}>
                  {moment}
                </time>
              ) : null}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
