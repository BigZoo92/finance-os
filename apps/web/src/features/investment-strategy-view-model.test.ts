import { describe, expect, it } from 'vitest'
import type {
  DashboardInvestmentActionPlan,
  DashboardInvestmentPlanItem,
} from './dashboard-types'
import {
  actionableStepsForPlan,
  activeGraphStatusForPlan,
  buildInvestmentAccountSections,
  creativeIdeasForPlan,
  dataGapItemsForPlan,
  formatInvestmentConfidence,
  investmentFreshnessBadgeLabel,
  investmentFreshnessBadgeTone,
  investmentFreshnessOf,
  investmentListFor,
  normalizeInvestmentWarning,
  priceabilityLabel,
  recommendabilityLabel,
  userWatchlistItemsForPlan,
} from './investment-strategy-view-model'

const planItem = (overrides: Partial<DashboardInvestmentPlanItem> = {}) =>
  ({
    id: 1,
    planId: 10,
    accountLabel: 'PEA Trade Republic',
    accountType: 'pea',
    bucket: 'core',
    symbol: 'CORE_REVIEW',
    assetName: 'Core review',
    action: 'watch',
    amountValue: null,
    amountCurrency: 'EUR',
    targetWeightPct: 60,
    currentWeightPct: 56,
    confidence: 0.62,
    riskLevel: 'medium',
    horizon: 'long_term',
    thesis: 'Wait for manual approval.',
    argumentsFor: ['corrects core underweight'],
    argumentsAgainstJson: ['eligibility unknown'],
    invalidationCriteriaJson: ['price becomes stale'],
    dataFreshnessJson: {
      provider: 'eodhd',
      sourceType: 'delayed',
      price: 100,
      currency: 'EUR',
      marketTimestamp: '2026-05-23T07:55:00.000Z',
      fetchedAt: '2026-05-23T07:56:00.000Z',
      delaySeconds: 60,
      isStale: false,
      confidence: 0.82,
      providerHealth: 'ok',
      fallbackReason: null,
      staleReason: null,
    },
    humanValidationRequired: true,
    noAutoTrade: true,
    createsHypothesis: false,
    createdHypothesisId: null,
    createdAt: '2026-05-23T08:00:00.000Z',
    ...overrides,
  }) as DashboardInvestmentPlanItem

describe('investment strategy view model', () => {
  it('builds deterministic PEA / IBKR / Binance account sections from the latest plan', () => {
    const plan = {
      items: [
        planItem(),
        planItem({ id: 2, accountLabel: 'Binance', accountType: 'crypto', bucket: 'asymmetric' }),
      ],
    } as DashboardInvestmentActionPlan

    const sections = buildInvestmentAccountSections({
      plan,
      policies: [
        {
          id: 1,
          label: 'PEA Trade Republic',
          humanReadablePolicy: 'PEA policy',
        } as never,
      ],
    })

    expect(sections.map(section => section.label)).toEqual(['PEA Trade Republic', 'IBKR', 'Binance'])
    expect(sections[0]?.item?.accountLabel).toBe('PEA Trade Republic')
    expect(sections[0]?.policy?.humanReadablePolicy).toBe('PEA policy')
    expect(sections[1]?.item).toBeNull()
    expect(sections[2]?.item?.accountType).toBe('crypto')
  })

  it('exposes stale and fallback price badges without implying real-time certainty', () => {
    const stale = investmentFreshnessOf(
      planItem({
        dataFreshnessJson: {
          sourceType: 'delayed',
          isStale: true,
        },
      })
    )
    const fallback = investmentFreshnessOf(
      planItem({
        dataFreshness: {
          provider: 'fallback',
          sourceType: 'fallback',
          price: null,
          currency: 'EUR',
          marketTimestamp: null,
          fetchedAt: '2026-05-23T07:56:00.000Z',
          delaySeconds: null,
          ageSeconds: null,
          isStale: false,
          confidence: 0.4,
          providerHealth: 'degraded',
          fallbackReason: 'missing_primary_price',
          staleReason: null,
        },
      })
    )

    expect(investmentFreshnessBadgeLabel(stale)).toBe('prix stale')
    expect(investmentFreshnessBadgeTone(stale)).toBe('warning')
    expect(investmentFreshnessBadgeLabel(fallback)).toBe('fallback')
    expect(investmentFreshnessBadgeTone(fallback)).toBe('warning')
  })

  it('prefers explicit argument arrays but keeps persisted JSON fallback fields readable', () => {
    const item = planItem()

    expect(investmentListFor(item, 'for')).toEqual(['corrects core underweight'])
    expect(investmentListFor(item, 'against')).toEqual(['eligibility unknown'])
    expect(investmentListFor(item, 'invalidation')).toEqual(['price becomes stale'])
  })

  it('formats probabilities from 0-1 confidence values and already-percent values', () => {
    expect(formatInvestmentConfidence(0.62)).toBe('62%')
    expect(formatInvestmentConfidence(72)).toBe('72%')
    expect(formatInvestmentConfidence(null)).toBe('-')
  })

  it('uses last-run graph status and treats older failures as resolved history', () => {
    const graph = activeGraphStatusForPlan({
      plan: {
        graph: {
          lastRun: {
            attempted: 7,
            succeeded: 7,
            failed: 0,
            pending: 0,
            skipped: 0,
            warnings: [],
            lastError: null,
          },
          historical: {
            attempted: 14,
            succeeded: 7,
            failed: 7,
            pending: 0,
            skipped: 0,
            warnings: ['knowledge_service_status_500'],
            lastError: 'knowledge_service_status_500',
          },
          resolvedHistoricalFailures: 7,
        },
        items: [],
      } as never,
      status: {
        memory: {
          graphWritesSucceeded: 7,
          graphWritesFailed: 7,
          lastGraphError: 'knowledge_service_status_500',
        },
      } as never,
    })

    expect(graph.lastRun.failed).toBe(0)
    expect(graph.lastRun.warnings).toEqual([])
    expect(graph.resolvedHistoricalFailures).toBe(7)
  })

  it('derives useful no-buy steps and normalizes technical warnings', () => {
    const steps = actionableStepsForPlan({
      items: [planItem()],
      contribution: [{ bucket: 'core', amount: 200, currency: 'EUR', reason: 'underweight' }],
    } as never)

    expect(steps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'no_trade_today' }),
        expect.objectContaining({ type: 'allocate_contribution', amountValue: 200 }),
      ])
    )
    expect(normalizeInvestmentWarning('missing_price:BTCEUR')).toContain('BTCEUR')
    expect(normalizeInvestmentWarning('knowledge_service_status_500')).toBe(
      'Memoire graph indisponible, non bloquant'
    )
  })

  it('groups creative ideas, user watchlist and data gaps without requiring approved', () => {
    const plan = {
      items: [
        planItem({
          recommendationTier: 'speculative_watch',
          recommendabilityStatus: 'blocked_strategy_cap',
          userInterestLevel: 'high_interest',
          userIntent: 'consider_buy',
          symbol: 'BTC',
        }),
        planItem({
          id: 2,
          recommendationTier: 'user_watchlist',
          recommendabilityStatus: 'blocked_missing_price',
          userInterestLevel: 'watching',
          userIntent: 'watch',
          symbol: 'OBSCURE',
        }),
      ],
    } as DashboardInvestmentActionPlan

    expect(creativeIdeasForPlan(plan).map(item => item.symbol)).toContain('BTC')
    expect(userWatchlistItemsForPlan(plan).map(item => item.symbol)).toEqual(['BTC', 'OBSCURE'])
    expect(dataGapItemsForPlan(plan).map(item => item.symbol)).toEqual(['OBSCURE'])
    expect(priceabilityLabel('priceable')).toBe('prix exploitable')
    expect(recommendabilityLabel('blocked_strategy_cap')).toContain('cap')
  })
})
