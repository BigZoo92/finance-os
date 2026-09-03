/**
 * RadarFocusDetail — concise detail surface for the focused signal, market
 * or event. Observation first, then the few fields that help read it.
 * No raw score, no pipeline identifier, no provenance internals.
 */
import { Button, CurrencyAmount, Freshness, PercentChange } from '@finance-os/ui/components'
import { ExternalLinkPixelIcon, TimesPixelIcon } from '@finance-os/ui/icons/pixel'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import {
  formatEventMoment,
  QUOTE_MODE_LABEL,
  type RadarEvent,
  type RadarFreshness,
  type RadarMarket,
  type RadarSignal,
  type ResolvedRadarFocus,
  TONE_LABEL,
} from '@/features/radar/view-model'
import { createScenarioFromSignal } from '@/features/trading-lab-api'
import { pushToast } from '@/lib/toast-store'
import { SeverityChip, SignalValue } from './radar-signal-list'

type RadarFocusDetailProps = {
  focus: ResolvedRadarFocus
  freshness: RadarFreshness
  /** Signals pointing at the focused market. */
  marketSignals: RadarSignal[]
  /** Variation over the observed window for the focused market. */
  periodChangePct: number | null
  marketLabelById: ReadonlyMap<string, string>
  isAdmin: boolean
  /** Desktop shows the ESC hint, mobile relies on the drawer. */
  showEscapeHint: boolean
  headingId: string
  onClose: () => void
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-xs">
      <dt className="shrink-0 text-foreground/45">{label}</dt>
      <dd className="min-w-0 text-right text-foreground">{children}</dd>
    </div>
  )
}

function Chip({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode
  tone?: 'neutral' | 'primary' | 'teal'
}) {
  const classes =
    tone === 'primary'
      ? 'border-primary/40 text-primary'
      : tone === 'teal'
        ? 'border-teal/40 text-teal'
        : 'border-foreground/16 text-foreground/65'
  return (
    <span
      className={`rounded-[5px] border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] ${classes}`}
    >
      {children}
    </span>
  )
}

export function RadarFocusDetail({
  focus,
  freshness,
  marketSignals,
  periodChangePct,
  marketLabelById,
  isAdmin,
  showEscapeHint,
  headingId,
  onClose,
}: RadarFocusDetailProps) {
  const heading =
    focus.kind === 'signal'
      ? focus.signal.subject
      : focus.kind === 'market'
        ? focus.market.label
        : focus.event.sourceLabel

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center gap-3">
        <h3
          id={headingId}
          className="min-w-0 flex-1 truncate text-[15px] font-semibold text-foreground"
        >
          {heading}
        </h3>
        {showEscapeHint ? (
          <span aria-hidden="true" className="font-mono text-[10px] text-foreground/35">
            ESC
          </span>
        ) : null}
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="grid size-8 shrink-0 place-items-center rounded-tile text-foreground/60 outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/70"
        >
          <TimesPixelIcon size={13} />
        </button>
      </div>

      {focus.kind === 'signal' ? (
        <SignalDetail
          signal={focus.signal}
          freshness={freshness}
          marketLabelById={marketLabelById}
        />
      ) : focus.kind === 'market' ? (
        <MarketDetail
          market={focus.market}
          signals={marketSignals}
          periodChangePct={periodChangePct}
        />
      ) : (
        <EventDetail event={focus.event} marketLabelById={marketLabelById} isAdmin={isAdmin} />
      )}
    </div>
  )
}

function SignalDetail({
  signal,
  freshness,
  marketLabelById,
}: {
  signal: RadarSignal
  freshness: RadarFreshness
  marketLabelById: ReadonlyMap<string, string>
}) {
  const relatedLabels = signal.relatedMarketIds
    .map(id => marketLabelById.get(id))
    .filter((label): label is string => label !== undefined)

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <SeverityChip severity={signal.severity} />
        <Chip>{TONE_LABEL[signal.tone]}</Chip>
      </div>
      {signal.value ? <SignalValue signal={signal} className="text-[22px] font-medium" /> : null}
      <p className="text-sm font-medium leading-snug text-foreground">{signal.observation}</p>
      {signal.detail ? (
        <p className="text-xs leading-relaxed text-foreground/65">{signal.detail}</p>
      ) : null}
      <dl className="flex flex-col gap-2 border-t border-foreground/9 pt-3">
        {signal.evidence.map(item => (
          <DetailRow key={item} label="Donnée">
            <span className="font-mono text-[11px]">{item}</span>
          </DetailRow>
        ))}
        {relatedLabels.length > 0 ? (
          <DetailRow label="Marchés">
            {relatedLabels.length > 4
              ? `${relatedLabels.slice(0, 4).join(', ')} et ${relatedLabels.length - 4} autres`
              : relatedLabels.join(', ')}
          </DetailRow>
        ) : null}
        <DetailRow label="Fraîcheur">
          <Freshness asOf={freshness.asOf} staleAfterMinutes={freshness.staleAfterMinutes} />
        </DetailRow>
      </dl>
    </>
  )
}

function MarketDetail({
  market,
  signals,
  periodChangePct,
}: {
  market: RadarMarket
  signals: RadarSignal[]
  periodChangePct: number | null
}) {
  return (
    <>
      <div className="flex flex-wrap items-baseline gap-2.5">
        <CurrencyAmount
          value={market.price}
          currency={market.currency}
          className="text-[22px] font-medium"
        />
        <PercentChange value={market.changePct} className="text-[13px]" />
      </div>
      <dl className="flex flex-col gap-2 border-t border-foreground/9 pt-3">
        <DetailRow label="Sur la période">
          <PercentChange value={periodChangePct} decimals={1} />
        </DetailRow>
        <DetailRow label="Séance">{market.sessionLabel}</DetailRow>
        <DetailRow label="Cours">{QUOTE_MODE_LABEL[market.quoteMode]}</DetailRow>
        <DetailRow label="Fraîcheur">
          <Freshness asOf={market.asOf} />
        </DetailRow>
      </dl>
      {signals.length > 0 ? (
        <ul
          className="flex flex-col gap-2 border-t border-foreground/9 pt-3"
          aria-label="Signaux liés"
        >
          {signals.map(signal => (
            <li key={signal.id} className="flex items-start gap-2 text-xs text-foreground/75">
              <SeverityChip severity={signal.severity} />
              <span className="leading-snug">{signal.observation}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="border-t border-foreground/9 pt-3 text-xs text-foreground/50">
          Aucun signal sur ce marché
        </p>
      )}
    </>
  )
}

function EventDetail({
  event,
  marketLabelById,
  isAdmin,
}: {
  event: RadarEvent
  marketLabelById: ReadonlyMap<string, string>
  isAdmin: boolean
}) {
  const queryClient = useQueryClient()
  const [created, setCreated] = useState(false)
  const scenarioMutation = useMutation({
    mutationFn: () => createScenarioFromSignal({ signalItemId: Number(event.id) }),
    onSuccess: () => {
      setCreated(true)
      void queryClient.invalidateQueries({ queryKey: ['tradingLab', 'scenarios'] })
      pushToast({ title: 'Scénario papier créé', tone: 'success' })
    },
    onError: () => {
      pushToast({ title: 'Création impossible pour le moment', tone: 'error' })
    },
  })
  const moment = formatEventMoment(event.publishedAt)
  const relatedLabels = event.relatedMarketIds
    .map(id => marketLabelById.get(id))
    .filter((label): label is string => label !== undefined)

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {event.requiresAttention ? <Chip tone="primary">Attention</Chip> : null}
        {event.usedByAdvisor ? <Chip tone="teal">Utilisé par Advisor</Chip> : null}
      </div>
      <p className="text-sm font-medium leading-snug text-foreground">{event.title}</p>
      <dl className="flex flex-col gap-2 border-t border-foreground/9 pt-3">
        {event.author ? (
          <DetailRow label="Compte">
            <span className="font-mono text-[11px]">{event.author}</span>
          </DetailRow>
        ) : null}
        {moment ? (
          <DetailRow label="Publié">
            <time dateTime={event.publishedAt} className="font-mono text-[11px]">
              {moment}
            </time>
          </DetailRow>
        ) : null}
        {relatedLabels.length > 0 ? (
          <DetailRow label="Marchés">{relatedLabels.join(', ')}</DetailRow>
        ) : null}
      </dl>
      <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 border-t border-foreground/9 pt-3 text-xs font-medium">
        {event.social && event.author ? (
          <Link
            to="/social-intelligence"
            search={{ q: event.author.replace(/^@/, '') }}
            className="text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/70"
          >
            Voir la source
          </Link>
        ) : null}
        {event.url ? (
          <a
            href={event.url}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1 text-foreground/70 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/70"
          >
            Ouvrir
            <ExternalLinkPixelIcon size={11} />
          </a>
        ) : null}
        {isAdmin ? (
          <Button
            type="button"
            size="xs"
            variant="outline"
            disabled={scenarioMutation.isPending || created}
            onClick={() => scenarioMutation.mutate()}
          >
            {created ? 'Scénario créé' : 'Scénario papier'}
          </Button>
        ) : null}
      </div>
    </>
  )
}
