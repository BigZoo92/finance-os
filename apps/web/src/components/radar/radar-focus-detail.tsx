/**
 * RadarFocusDetail — concise detail surface for the focused signal, market
 * or event. Observation first, then the few fields that help read it.
 * No raw score, no pipeline identifier, no provenance internals.
 */
import { css, cva } from '@finance-os/styled-system/css'
import { styled } from '@finance-os/styled-system/jsx'
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

const detailRow = css({
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: '4',
  textStyle: 'xs',
})

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={detailRow}>
      <styled.dt flexShrink="0" color="foreground/45">
        {label}
      </styled.dt>
      <styled.dd minW="0" textAlign="right" color="foreground">
        {children}
      </styled.dd>
    </div>
  )
}

const chip = cva({
  base: {
    rounded: '5px',
    borderWidth: '1px',
    px: '2',
    py: '0.5',
    fontFamily: 'mono',
    fontSize: '10px',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  variants: {
    tone: {
      neutral: { borderColor: 'foreground/16', color: 'foreground/65' },
      primary: { borderColor: 'primary/40', color: 'primary' },
      teal: { borderColor: 'teal/40', color: 'teal' },
    },
  },
})

function Chip({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode
  tone?: 'neutral' | 'primary' | 'teal'
}) {
  return <span className={chip({ tone })}>{children}</span>
}

const closeButton = css({
  display: 'grid',
  boxSize: '8',
  flexShrink: '0',
  placeItems: 'center',
  rounded: 'tile',
  color: 'foreground/60',
  outlineStyle: 'none',
  transitionProperty: 'colors',
  transitionDuration: '150ms',
  transitionTimingFunction: 'default',
  _hover: { color: 'foreground' },
  _focusVisible: { boxShadow: '0 0 0 2px color-mix(in srgb, {colors.ring} 70%, transparent)' },
})

const escapeHint = css({ fontFamily: 'mono', fontSize: '10px', color: 'foreground/35' })

const chipRow = css({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '2' })

const leadText = css({
  fontSize: 'sm',
  lineHeight: 'snug',
  fontWeight: 'medium',
  color: 'foreground',
})

// The dated rule between each block of the detail.
const detailBlock = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '2',
  borderTopWidth: '1px',
  borderColor: 'foreground/9',
  pt: '3',
})

const monoValue = css({ fontFamily: 'mono', fontSize: '11px' })

const detailActions = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'flex-end',
  columnGap: '4',
  rowGap: '2',
  borderTopWidth: '1px',
  borderColor: 'foreground/9',
  pt: '3',
  textStyle: 'xs',
  fontWeight: 'medium',
})

const sourceLink = css({
  color: 'primary',
  outlineStyle: 'none',
  _hover: { textDecorationLine: 'underline' },
  _focusVisible: { boxShadow: '0 0 0 2px color-mix(in srgb, {colors.ring} 70%, transparent)' },
})

const externalLink = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '1',
  color: 'foreground/70',
  outlineStyle: 'none',
  _hover: { color: 'foreground' },
  _focusVisible: { boxShadow: '0 0 0 2px color-mix(in srgb, {colors.ring} 70%, transparent)' },
})

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
    <styled.div display="flex" flexDirection="column" gap="3.5">
      <styled.div display="flex" alignItems="center" gap="3">
        <styled.h3
          id={headingId}
          minW="0"
          flex="1"
          truncate
          fontSize="15px"
          fontWeight="semibold"
          color="foreground"
        >
          {heading}
        </styled.h3>
        {showEscapeHint ? (
          <span aria-hidden="true" className={escapeHint}>
            ESC
          </span>
        ) : null}
        <button type="button" onClick={onClose} aria-label="Fermer" className={closeButton}>
          <TimesPixelIcon size={13} />
        </button>
      </styled.div>

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
    </styled.div>
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
      <div className={chipRow}>
        <SeverityChip severity={signal.severity} />
        <Chip>{TONE_LABEL[signal.tone]}</Chip>
      </div>
      {signal.value ? <SignalValue signal={signal} fontSize="22px" fontWeight="medium" /> : null}
      <p className={leadText}>{signal.observation}</p>
      {signal.detail ? (
        <styled.p fontSize="xs" lineHeight="relaxed" color="foreground/65">
          {signal.detail}
        </styled.p>
      ) : null}
      <dl className={detailBlock}>
        {signal.evidence.map(item => (
          <DetailRow key={item} label="Donnée">
            <span className={monoValue}>{item}</span>
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
      <styled.div display="flex" flexWrap="wrap" alignItems="baseline" gap="2.5">
        <CurrencyAmount
          value={market.price}
          currency={market.currency}
          fontSize="22px"
          fontWeight="medium"
        />
        <PercentChange value={market.changePct} fontSize="13px" />
      </styled.div>
      <dl className={detailBlock}>
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
        <ul className={detailBlock} aria-label="Signaux liés">
          {signals.map(signal => (
            <styled.li
              key={signal.id}
              display="flex"
              alignItems="flex-start"
              gap="2"
              textStyle="xs"
              color="foreground/75"
            >
              <SeverityChip severity={signal.severity} />
              <styled.span lineHeight="snug">{signal.observation}</styled.span>
            </styled.li>
          ))}
        </ul>
      ) : (
        <styled.p
          borderTopWidth="1px"
          borderColor="foreground/9"
          pt="3"
          textStyle="xs"
          color="foreground/50"
        >
          Aucun signal sur ce marché
        </styled.p>
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
      <div className={chipRow}>
        {event.requiresAttention ? <Chip tone="primary">Attention</Chip> : null}
        {event.usedByAdvisor ? <Chip tone="teal">Utilisé par Advisor</Chip> : null}
      </div>
      <p className={leadText}>{event.title}</p>
      <dl className={detailBlock}>
        {event.author ? (
          <DetailRow label="Compte">
            <span className={monoValue}>{event.author}</span>
          </DetailRow>
        ) : null}
        {moment ? (
          <DetailRow label="Publié">
            <time dateTime={event.publishedAt} className={monoValue}>
              {moment}
            </time>
          </DetailRow>
        ) : null}
        {relatedLabels.length > 0 ? (
          <DetailRow label="Marchés">{relatedLabels.join(', ')}</DetailRow>
        ) : null}
      </dl>
      <div className={detailActions}>
        {event.social && event.author ? (
          <Link
            to="/social-intelligence"
            search={{ q: event.author.replace(/^@/, '') }}
            className={sourceLink}
          >
            Voir la source
          </Link>
        ) : null}
        {event.url ? (
          <a href={event.url} target="_blank" rel="noreferrer noopener" className={externalLink}>
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
