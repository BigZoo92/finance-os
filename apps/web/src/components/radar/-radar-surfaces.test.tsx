// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getDemoMarketsOverview } from '@/features/markets/demo-data'
import { buildRadarViewModel, resolveRadarFocus } from '@/features/radar/view-model'
import { RadarEvents } from './radar-events'
import { RadarFocusDetail } from './radar-focus-detail'
import { RadarSignalList } from './radar-signal-list'

afterEach(cleanup)

const vm = buildRadarViewModel({
  overview: getDemoMarketsOverview(),
  signalItems: [
    {
      id: 7,
      sourceProvider: 'hn_algolia',
      sourceType: 'news',
      externalId: 'ext',
      url: 'https://news.example/item',
      title: 'Fed holds rates steady',
      body: null,
      author: null,
      publishedAt: '2026-03-09T13:30:00.000Z',
      signalDomain: 'macro',
      relevanceScore: 88,
      impactScore: 70,
      urgencyScore: 61,
      requiresAttention: true,
      attentionReason: 'High urgency',
      tickers: ['SPY'],
      sectors: [],
      topics: ['rates'],
      graphIngestStatus: 'pending',
      advisorIngestStatus: 'skipped',
      createdAt: '2026-03-09T13:30:00.000Z',
    },
  ],
})

const TECHNICAL_LEAKS = /requestId|schemaVersion|pipeline|ingest|relevance|score|run\b/i
const RECOMMENDATIONS = /\b(acheter|vendre|renforcer|alléger|investir)\b/i

describe('RadarSignalList', () => {
  it('renders observations with human severity and toggles focus', () => {
    const onSelect = vi.fn()
    render(<RadarSignalList signals={vm.signals} focusedId="rates-high" onSelect={onSelect} />)

    const rows = screen.getAllByRole('button')
    expect(rows).toHaveLength(2)
    expect(rows[0]?.getAttribute('aria-pressed')).toBe('true')
    expect(rows[1]?.getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByText('Fed funds')).toBeTruthy()
    expect(screen.getByText('Important')).toBeTruthy()
    expect(screen.getByText('Les taux courts restent élevés')).toBeTruthy()
    expect(screen.getByText('4,50 %')).toBeTruthy()
    expect(document.body.textContent).not.toMatch(RECOMMENDATIONS)
    expect(document.body.textContent).not.toMatch(TECHNICAL_LEAKS)

    const second = rows[1]
    if (!second) throw new Error('missing row')
    fireEvent.click(second)
    expect(onSelect).toHaveBeenCalledWith(vm.signals[1], second)
  })
})

describe('RadarFocusDetail', () => {
  it('shows the signal observation and freshness without internal fields or Advisor links', () => {
    const focus = resolveRadarFocus(vm, 'signal:rates-high')
    if (!focus) throw new Error('focus expected')
    const onClose = vi.fn()

    render(
      <RadarFocusDetail
        focus={focus}
        freshness={{ asOf: null, staleAfterMinutes: 960, stale: true }}
        marketSignals={[]}
        periodChangePct={null}
        marketLabelById={new Map()}
        isAdmin={false}
        showEscapeHint
        headingId="detail-title"
        onClose={onClose}
      />
    )

    expect(screen.getByRole('heading', { level: 3, name: 'Fed funds' })).toBeTruthy()
    expect(screen.getByText('Les taux courts restent élevés')).toBeTruthy()
    expect(screen.getByText('Vigilance')).toBeTruthy()
    expect(screen.getByText('Fed funds: 4,50 %')).toBeTruthy()
    expect(screen.getByText('Indisponible')).toBeTruthy()
    expect(screen.queryByText(/Advisor/)).toBeNull()
    expect(document.body.textContent).not.toMatch(TECHNICAL_LEAKS)

    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('renders an unknown market variation as unavailable, never as zero', () => {
    const focus = resolveRadarFocus(vm, 'market:spy-us')
    if (!focus) throw new Error('focus expected')

    render(
      <RadarFocusDetail
        focus={focus}
        freshness={{ asOf: '2026-04-10T06:40:00.000Z', staleAfterMinutes: 960, stale: false }}
        marketSignals={[]}
        periodChangePct={null}
        marketLabelById={new Map()}
        isAdmin={false}
        showEscapeHint={false}
        headingId="detail-title"
        onClose={vi.fn()}
      />
    )

    expect(screen.getByRole('heading', { level: 3, name: 'S&P 500' })).toBeTruthy()
    expect(screen.getByText('+0,96 %')).toBeTruthy()
    expect(screen.getByText('Sur la période').nextElementSibling?.textContent).toBe('Indisponible')
    expect(screen.getByText('Cours intraday')).toBeTruthy()
    expect(screen.getByText('Aucun signal sur ce marché')).toBeTruthy()
    expect(document.body.textContent).not.toMatch(/0,00 %/)
  })
})

describe('RadarEvents', () => {
  it('shows human sources, time and the attention marker without ingestion vocabulary', () => {
    render(
      <RadarEvents
        events={vm.events}
        focusedId={null}
        limit={5}
        mobileLimit={3}
        onSelect={vi.fn()}
      />
    )

    expect(screen.getByText('Hacker News')).toBeTruthy()
    expect(screen.getByText('Fed holds rates steady')).toBeTruthy()
    expect(screen.getByRole('button').textContent).toMatch(/9 mars \d{2}:\d{2}/)
    expect(document.body.textContent).not.toMatch(/hn_algolia|pending|skipped/)
  })
})
