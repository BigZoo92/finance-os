import { describe, expect, it } from 'bun:test'
import { ExternalInvestmentProviderError } from './errors'
import { normalizeIbkrFlexStatement } from './normalizer'

const GENERATED_AT = '2026-05-18T08:30:00.000Z'

/**
 * The producer-side contract for "Last Business Day with no activity":
 *
 *   - statement has zero positions / trades / cash transactions / cash
 *     report rows / equity summary rows
 *   - normalizer raises `PROVIDER_NO_ACTIVITY` (a soft sentinel)
 *   - orchestrator (worker sync, see external-investments-sync.ts) treats
 *     it as a clean empty outcome, NOT a normalization failure
 *
 * These tests pin the contract at the normalizer boundary. The end-to-end
 * worker behavior is covered by `external-investments-sync.test.ts`.
 */
describe('IBKR normalizer — PROVIDER_NO_ACTIVITY', () => {
  it('raises PROVIDER_NO_ACTIVITY when Last-Business-Day report is fully empty', () => {
    expect(() =>
      normalizeIbkrFlexStatement({
        connectionId: 'ibkr:flex',
        generatedAt: GENERATED_AT,
        accountAlias: 'IBKR',
        queryId: 'q-lbd-weekend',
        statement: {
          FlexStatement: {
            AccountInformation: {
              AccountInformation: {
                accountId: 'U777',
                accountType: 'Individual',
                currency: 'EUR',
              },
            },
            // No OpenPositions, no Trades, no CashTransactions, no CashReport,
            // no EquitySummary. This is the canonical "weekend LBD" shape.
          },
        },
      })
    ).toThrow(ExternalInvestmentProviderError)
  })

  it('exposes the PROVIDER_NO_ACTIVITY code on the thrown error', () => {
    let captured: ExternalInvestmentProviderError | null = null
    try {
      normalizeIbkrFlexStatement({
        connectionId: 'ibkr:flex',
        generatedAt: GENERATED_AT,
        accountAlias: null,
        queryId: 'q-empty',
        statement: { FlexStatement: {} },
      })
    } catch (error) {
      if (error instanceof ExternalInvestmentProviderError) {
        captured = error
      } else {
        throw error
      }
    }
    expect(captured?.code).toBe('PROVIDER_NO_ACTIVITY')
    expect(captured?.retryable).toBe(false)
  })

  it('does NOT raise when statement contains at least one position', () => {
    const snapshot = normalizeIbkrFlexStatement({
      connectionId: 'ibkr:flex',
      generatedAt: GENERATED_AT,
      accountAlias: null,
      queryId: 'q-with-position',
      statement: {
        FlexStatement: {
          AccountInformation: {
            AccountInformation: { accountId: 'U001', currency: 'EUR' },
          },
          OpenPositions: {
            OpenPosition: {
              accountId: 'U001',
              symbol: 'CW8',
              conid: '123',
              currency: 'EUR',
              position: '1',
              positionValue: '100',
            },
          },
        },
      },
    })
    expect(snapshot.positions.length).toBe(1)
  })

  it('does NOT raise when statement contains only trades (e.g. day-trade flat at close)', () => {
    const snapshot = normalizeIbkrFlexStatement({
      connectionId: 'ibkr:flex',
      generatedAt: GENERATED_AT,
      accountAlias: null,
      queryId: 'q-trades-only',
      statement: {
        FlexStatement: {
          AccountInformation: {
            AccountInformation: { accountId: 'U002', currency: 'EUR' },
          },
          Trades: {
            Trade: {
              accountId: 'U002',
              tradeID: 'T1',
              symbol: 'SPY',
              buySell: 'BUY',
              quantity: '1',
              tradePrice: '500',
              currency: 'USD',
              dateTime: GENERATED_AT,
            },
          },
        },
      },
    })
    expect(snapshot.trades.length).toBe(1)
    expect(snapshot.positions.length).toBe(0)
  })

  it('does NOT raise when only CashReport is present (cash-only inactive account)', () => {
    const snapshot = normalizeIbkrFlexStatement({
      connectionId: 'ibkr:flex',
      generatedAt: GENERATED_AT,
      accountAlias: null,
      queryId: 'q-cash-report-only',
      statement: {
        FlexStatement: {
          AccountInformation: {
            AccountInformation: { accountId: 'U003', currency: 'EUR' },
          },
          CashReport: {
            CashReportCurrency: { accountId: 'U003', currency: 'EUR', endingCash: '1000' },
          },
        },
      },
    })
    expect(snapshot.positions.length).toBe(1)
    expect(snapshot.positions[0]?.assetClass).toBe('cash')
  })

  it('does NOT raise when only EquitySummary is present (legacy minimal report)', () => {
    const snapshot = normalizeIbkrFlexStatement({
      connectionId: 'ibkr:flex',
      generatedAt: GENERATED_AT,
      accountAlias: null,
      queryId: 'q-equity-only',
      statement: {
        FlexStatement: {
          AccountInformation: {
            AccountInformation: { accountId: 'U004', currency: 'EUR' },
          },
          EquitySummaryInBase: {
            EquitySummaryByReportDateInBase: {
              accountId: 'U004',
              cash: '500',
              reportDate: '2026-05-18',
            },
          },
        },
      },
    })
    // Account is present; cash-only synthetic position should appear.
    expect(snapshot.accounts.length).toBe(1)
    expect(snapshot.positions.length).toBeGreaterThan(0)
  })

  it('partial statement (positions + EquitySummary missing cash report) emits VALUATION_PARTIAL warnings', () => {
    const snapshot = normalizeIbkrFlexStatement({
      connectionId: 'ibkr:flex',
      generatedAt: GENERATED_AT,
      accountAlias: null,
      queryId: 'q-partial',
      statement: {
        FlexStatement: {
          AccountInformation: {
            AccountInformation: { accountId: 'U005', currency: 'EUR' },
          },
          OpenPositions: {
            OpenPosition: {
              accountId: 'U005',
              symbol: 'TLT',
              conid: '987',
              currency: 'USD',
              position: '10',
              // No positionValue → triggers VALUATION_PARTIAL on this position
            },
          },
        },
      },
    })
    expect(snapshot.positions.length).toBe(1)
    expect(snapshot.positions[0]?.degradedReasons).toContain('VALUATION_PARTIAL')
  })

  it('completely malformed statement (non-object root) does NOT raise NO_ACTIVITY (would fall to NORMALIZATION_FAILED upstream)', () => {
    // The normalizer is defensive — given an empty FlexStatement it raises
    // NO_ACTIVITY. Given a totally absent FlexStatement, parsers return
    // empty arrays too, so we still hit NO_ACTIVITY. The "malformed XML
    // shape" case is handled upstream by parseIbkrFlexXml in the client,
    // which raises PROVIDER_PARTIAL_DATA, not NO_ACTIVITY.
    let captured: ExternalInvestmentProviderError | null = null
    try {
      normalizeIbkrFlexStatement({
        connectionId: 'ibkr:flex',
        generatedAt: GENERATED_AT,
        accountAlias: null,
        queryId: 'q-malformed',
        statement: {},
      })
    } catch (error) {
      if (error instanceof ExternalInvestmentProviderError) captured = error
    }
    expect(captured?.code).toBe('PROVIDER_NO_ACTIVITY')
  })
})
