/**
 * Radar events — short, scannable, time-aware rows.
 *
 * Attention events carry the signal orange marker; everything else stays
 * quiet. No ingestion status, no provider diagnostics. Mobile shows fewer
 * rows through CSS so server and client markup stay identical.
 */
import { formatEventMoment, type RadarEvent } from '@/features/radar/view-model'

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
          <li
            key={event.id}
            className={`border-b border-foreground/9 last:border-b-0 ${
              index >= mobileLimit ? 'hidden lg:block' : ''
            }`}
          >
            <button
              type="button"
              aria-pressed={focused}
              onClick={element => onSelect(event, element.currentTarget)}
              className={`flex min-h-11 w-full items-center gap-3 py-2.5 text-left outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring/70 ${
                focused ? 'text-foreground' : 'hover:text-foreground'
              }`}
            >
              <span
                aria-hidden="true"
                className={`size-1.5 shrink-0 rounded-[1px] ${
                  event.requiresAttention ? 'bg-primary' : 'bg-foreground/40'
                }`}
              />
              <span className="shrink-0 text-[13px] text-foreground">{event.sourceLabel}</span>
              <span className="min-w-0 flex-1 truncate text-xs text-foreground/55">
                {event.author ?? event.title}
              </span>
              {moment ? (
                <time
                  dateTime={event.publishedAt}
                  className="ml-auto shrink-0 font-mono text-[11px] text-foreground/55"
                >
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
