import { describe, expect, it } from 'bun:test'
import {
  assertBinanceReadonlyEndpoint,
  createBinanceReadonlyClient,
  signBinanceUserDataParams,
} from './binance-readonly-client'
import { buildExternalInvestmentContextBundle } from './context-bundle'
import {
  decryptExternalInvestmentCredential,
  encryptExternalInvestmentCredential,
  maskExternalInvestmentCredential,
} from './credentials'
import { createIbkrFlexClient, parseIbkrFlexXml } from './ibkr-flex-client'
import { normalizeBinanceSnapshot, normalizeIbkrFlexStatement } from './normalizer'

const ENCRYPTION_KEY = '12345678901234567890123456789012'
const GENERATED_AT = '2026-05-01T08:00:00.000Z'

describe('Binance read-only client guards', () => {
  it('signs USER_DATA params deterministically without exposing the secret', () => {
    const signed = signBinanceUserDataParams({
      secret: 'test-secret',
      params: {
        recvWindow: 5000,
        timestamp: 1710000000000,
      },
    })

    expect(signed.queryString).toBe('recvWindow=5000&timestamp=1710000000000')
    expect(signed.signature).toBe(
      '47bbcbe5fb58904e855a431a240d7c9d64892979f504013c27269a66359a321c'
    )
    expect(signed.signedQueryString).not.toContain('test-secret')
  })

  it('rejects mutating or non-allowlisted Binance endpoints', () => {
    expect(() =>
      assertBinanceReadonlyEndpoint({ method: 'GET', path: '/api/v3/account' })
    ).not.toThrow()
    expect(() =>
      assertBinanceReadonlyEndpoint({ method: 'POST', path: '/api/v3/account' })
    ).toThrow(/non-read-only/)
    expect(() => assertBinanceReadonlyEndpoint({ method: 'GET', path: '/api/v3/order' })).toThrow(
      /non-allowlisted/
    )
    expect(() =>
      assertBinanceReadonlyEndpoint({
        method: 'GET',
        path: '/sapi/v1/capital/withdraw/apply',
      })
    ).toThrow(/non-allowlisted/)
  })

  it('fetches public Binance metadata without signing the query string', async () => {
    const urls: string[] = []
    const client = createBinanceReadonlyClient({
      apiKey: 'binance-key',
      apiSecret: 'binance-secret',
      recvWindowMs: 5000,
      timeoutMs: 1000,
      fetchImpl: async input => {
        urls.push(String(input))
        return Response.json({ symbols: [] })
      },
    })

    await client.getExchangeInfo({ symbols: '["BTCEUR"]' })

    expect(urls[0]).toContain('/api/v3/exchangeInfo?symbols=%5B%22BTCEUR%22%5D')
    expect(urls[0]).not.toContain('signature=')
    expect(urls[0]).not.toContain('timestamp=')
  })
})

describe('external investment credentials', () => {
  it('encrypts, decrypts and masks IBKR credentials without returning secrets', () => {
    const payload = {
      provider: 'ibkr',
      kind: 'ibkr_flex',
      flexToken: 'ibkr-flex-token-secret',
      queryIds: ['123456789'],
      accountAlias: 'IBKR',
    } as const

    const encrypted = encryptExternalInvestmentCredential(payload, ENCRYPTION_KEY)
    expect(encrypted).not.toContain(payload.flexToken)

    const decrypted = decryptExternalInvestmentCredential(encrypted, ENCRYPTION_KEY)
    expect(decrypted).toEqual(payload)

    const masked = maskExternalInvestmentCredential(payload)
    expect(masked.maskedSecretRefs.flexToken).toEndWith('cret')
    expect(JSON.stringify(masked)).not.toContain(payload.flexToken)
  })

  it('rejects Binance credentials with unsafe permissions', () => {
    expect(() =>
      encryptExternalInvestmentCredential(
        {
          provider: 'binance',
          kind: 'binance_spot',
          apiKey: 'binance-key',
          apiSecret: 'binance-secret',
          permissionsMetadata: {
            canRead: true,
            tradingEnabled: true,
            withdrawEnabled: false,
          },
        },
        ENCRYPTION_KEY
      )
    ).toThrow(/unsafe trading or withdrawal/)
  })
})

describe('IBKR Flex XML parsing', () => {
  it('parses report references and statement payloads', () => {
    expect(
      parseIbkrFlexXml(`
        <FlexStatementResponse>
          <Status>Success</Status>
          <ReferenceCode>ABC123</ReferenceCode>
        </FlexStatementResponse>
      `)
    ).toEqual({ kind: 'request', referenceCode: 'ABC123' })

    const parsed = parseIbkrFlexXml(`
      <FlexQueryResponse>
        <FlexStatements>
          <FlexStatement accountId="U123">
            <OpenPositions />
          </FlexStatement>
        </FlexStatements>
      </FlexQueryResponse>
    `)
    expect(parsed.kind).toBe('statement')
  })

  it('normalizes provider errors into safe errors', () => {
    expect(() =>
      parseIbkrFlexXml(`
        <FlexStatementResponse>
          <ErrorCode>1019</ErrorCode>
          <ErrorMessage>Invalid token</ErrorMessage>
        </FlexStatementResponse>
      `)
    ).toThrow(/IBKR Flex error/)
  })

  it('uses the current AccountManagement Flex Web Service endpoints by default', async () => {
    const urls: string[] = []
    const fetchImpl: typeof fetch = async input => {
      urls.push(String(input))
      if (urls.length === 1) {
        return new Response(`
          <FlexStatementResponse>
            <Status>Success</Status>
            <ReferenceCode>REF123</ReferenceCode>
          </FlexStatementResponse>
        `)
      }

      return new Response(`
        <FlexQueryResponse>
          <FlexStatements>
            <FlexStatement accountId="U123">
              <OpenPositions />
            </FlexStatement>
          </FlexStatements>
        </FlexQueryResponse>
      `)
    }

    const client = createIbkrFlexClient({
      token: 'token',
      userAgent: 'finance-os-test',
      timeoutMs: 1000,
      fetchImpl,
    })

    await client.runQuery('800969')

    expect(urls[0]).toContain(
      'https://ndcdyn.interactivebrokers.com/AccountManagement/FlexWebService/SendRequest'
    )
    expect(urls[0]).toContain('q=800969')
    expect(urls[1]).toContain(
      'https://ndcdyn.interactivebrokers.com/AccountManagement/FlexWebService/GetStatement'
    )
    expect(urls[1]).toContain('q=REF123')
  })

  it('retries GetStatement while IBKR is still generating the report', async () => {
    const urls: string[] = []
    const fetchImpl: typeof fetch = async input => {
      urls.push(String(input))
      if (urls.length === 1) {
        return new Response(`
          <FlexStatementResponse>
            <Status>Success</Status>
            <ReferenceCode>REF123</ReferenceCode>
          </FlexStatementResponse>
        `)
      }

      if (urls.length === 2) {
        return new Response(`
          <FlexStatementResponse>
            <Status>Fail</Status>
            <ErrorCode>1019</ErrorCode>
            <ErrorMessage>Statement generation in progress. Please try again shortly.</ErrorMessage>
          </FlexStatementResponse>
        `)
      }

      return new Response(`
        <FlexQueryResponse>
          <FlexStatements>
            <FlexStatement accountId="U123" />
          </FlexStatements>
        </FlexQueryResponse>
      `)
    }

    const client = createIbkrFlexClient({
      token: 'token',
      userAgent: 'finance-os-test',
      timeoutMs: 1000,
      statementMaxAttempts: 2,
      statementRetryDelayMs: 0,
      fetchImpl,
    })

    const statement = await client.runQuery('800969')

    expect(statement).toEqual({ FlexStatement: { accountId: 'U123' } })
    expect(urls).toHaveLength(3)
    expect(urls[1]).toContain('/GetStatement')
    expect(urls[2]).toContain('/GetStatement')
  })

  it('preserves legacy Universal servlet endpoint compatibility', async () => {
    const urls: string[] = []
    const fetchImpl: typeof fetch = async input => {
      urls.push(String(input))
      return new Response(
        urls.length === 1
          ? '<FlexStatementResponse><ReferenceCode>REF123</ReferenceCode></FlexStatementResponse>'
          : '<FlexQueryResponse><FlexStatements><FlexStatement accountId="U123" /></FlexStatements></FlexQueryResponse>'
      )
    }

    const client = createIbkrFlexClient({
      token: 'token',
      baseUrl: 'https://gdcdyn.interactivebrokers.com/Universal/servlet',
      userAgent: 'finance-os-test',
      timeoutMs: 1000,
      fetchImpl,
    })

    await client.runQuery('800969')

    expect(urls[0]).toContain(
      'https://gdcdyn.interactivebrokers.com/Universal/servlet/FlexStatementService.SendRequest'
    )
    expect(urls[1]).toContain(
      'https://gdcdyn.interactivebrokers.com/Universal/servlet/FlexStatementService.GetStatement'
    )
  })
})

describe('provider normalization', () => {
  it('normalizes Binance balances, trades and cash flows as read-only facts', () => {
    const snapshot = normalizeBinanceSnapshot({
      connectionId: 'binance:spot',
      generatedAt: GENERATED_AT,
      accountAlias: 'Binance Spot',
      accountInfo: {
        accountType: 'SPOT',
        balances: [
          { asset: 'BTC', free: '0.1', locked: '0.0' },
          { asset: 'EUR', free: '125.5', locked: '0' },
          { asset: 'USDT', free: '500', locked: '0' },
          { asset: 'ETH', free: '0', locked: '0' },
        ],
      },
      trades: [
        {
          id: 42,
          symbol: 'BTCUSDT',
          price: '40000',
          qty: '0.1',
          quoteQty: '4000',
          commission: '4',
          commissionAsset: 'USDT',
          time: Date.parse(GENERATED_AT),
          isBuyer: true,
        },
      ],
      deposits: [
        {
          id: 'dep-1',
          amount: '500',
          coin: 'USDT',
          insertTime: Date.parse(GENERATED_AT),
          transactionFee: '0',
        },
      ],
      withdrawals: [
        {
          id: 'wd-1',
          amount: '0.01',
          coin: 'BTC',
          insertTime: Date.parse(GENERATED_AT),
          transactionFee: '0.0001',
        },
      ],
      coins: [{ coin: 'BTC', name: 'Bitcoin' }],
    })

    expect(snapshot.positions).toHaveLength(3)
    expect(snapshot.positions.find(position => position.symbol === 'BTC')?.valueSource).toBe(
      'unknown'
    )
    expect(snapshot.positions.find(position => position.symbol === 'EUR')?.normalizedValue).toBe(
      '125.5'
    )
    expect(snapshot.positions.find(position => position.symbol === 'EUR')?.costBasis).toBe('125.5')
    expect(snapshot.positions.find(position => position.symbol === 'USDT')?.assetClass).toBe(
      'stablecoin'
    )
    expect(snapshot.trades[0]?.side).toBe('buy')
    expect(snapshot.cashFlows.map(flow => flow.type)).toEqual(['deposit', 'withdrawal'])
    expect(snapshot.degradedReasons).toContain('VALUATION_PARTIAL')
  })

  it('normalizes IBKR Flex statement positions, trades and cash movements', () => {
    const snapshot = normalizeIbkrFlexStatement({
      connectionId: 'ibkr:flex',
      generatedAt: GENERATED_AT,
      accountAlias: 'IBKR',
      queryId: '123',
      statement: {
        FlexStatement: {
          AccountInformation: {
            AccountInformation: {
              accountId: 'U123',
              accountType: 'Individual',
              currency: 'EUR',
            },
          },
          OpenPositions: {
            OpenPosition: {
              accountId: 'U123',
              conid: '756733',
              symbol: 'CW8',
              description: 'Amundi MSCI World',
              assetCategory: 'ETF',
              currency: 'EUR',
              position: '3',
              positionValue: '1200',
              costBasisMoney: '1000',
              unrealizedPL: '200',
            },
          },
          Trades: {
            Trade: {
              accountId: 'U123',
              tradeID: 'T1',
              symbol: 'CW8',
              conid: '756733',
              buySell: 'BUY',
              quantity: '1',
              tradePrice: '400',
              tradeMoney: '400',
              netCash: '-401',
              currency: 'EUR',
              ibCommission: '1',
              dateTime: GENERATED_AT,
            },
          },
          CashTransactions: {
            CashTransaction: {
              accountId: 'U123',
              transactionID: 'C1',
              type: 'Dividend',
              amount: '5',
              currency: 'EUR',
              dateTime: GENERATED_AT,
            },
          },
        },
      },
    })

    expect(snapshot.accounts[0]?.accountExternalId).toBe('U123')
    expect(snapshot.positions[0]?.assetClass).toBe('etf')
    expect(snapshot.positions[0]?.normalizedValue).toBe('1200')
    expect(snapshot.positions[0]?.unrealizedPnl).toBe('200')
    expect(snapshot.trades[0]?.side).toBe('buy')
    expect(snapshot.cashFlows[0]?.type).toBe('dividend')
  })

  it('surfaces an IBKR cash-only account via CashReport.endingCash as a synthetic position', () => {
    const snapshot = normalizeIbkrFlexStatement({
      connectionId: 'ibkr:flex',
      generatedAt: GENERATED_AT,
      accountAlias: 'IBKR Cash',
      queryId: 'q-cash-only',
      statement: {
        FlexStatement: {
          AccountInformation: {
            AccountInformation: {
              accountId: 'U999',
              accountType: 'Individual',
              currency: 'EUR',
            },
          },
          // No OpenPositions / Trades / CashTransactions — purely cash account
          CashReport: {
            CashReportCurrency: [
              {
                accountId: 'U999',
                currency: 'BASE_SUMMARY',
                endingCash: '5000',
                netCashBalance: '5000',
              },
              {
                accountId: 'U999',
                currency: 'EUR',
                endingCash: '4000',
                endingSettledCash: '4000',
                netCashBalance: '4000',
              },
              {
                accountId: 'U999',
                currency: 'USD',
                endingCash: '1000',
                netCashBalance: '1000',
              },
            ],
          },
          EquitySummaryInBase: {
            EquitySummaryByReportDateInBase: {
              accountId: 'U999',
              reportDate: '20260512',
              cash: '5000',
              total: '5000',
            },
          },
        },
      },
    })

    // Account is visible
    expect(snapshot.accounts).toHaveLength(1)
    expect(snapshot.accounts[0]?.accountExternalId).toBe('U999')

    // BASE_SUMMARY is filtered (would otherwise double-count)
    const cashPositions = snapshot.positions.filter(p => p.assetClass === 'cash')
    expect(cashPositions.map(p => p.currency).sort()).toEqual(['EUR', 'USD'])
    expect(cashPositions.find(p => p.currency === 'EUR')?.normalizedValue).toBe('4000')
    expect(cashPositions.find(p => p.currency === 'USD')?.normalizedValue).toBe('1000')
    expect(cashPositions.every(p => p.valueSource === 'provider_reported')).toBe(true)

    // Account metadata carries the cash report + NAV
    const metadata = snapshot.accounts[0]?.metadata as Record<string, unknown> | null
    expect(metadata).toBeTruthy()
    expect(metadata?.cashBalances).toBeDefined()
    expect(metadata?.equitySummary).toBeDefined()

    // Raw imports trace the cash balance entries
    const cashRawImports = snapshot.rawImports.filter(r => r.objectType === 'cash_balance')
    expect(cashRawImports).toHaveLength(2)

    // No degraded reason (cash is fully valued)
    expect(snapshot.degradedReasons).not.toContain('VALUATION_PARTIAL')
  })

  it('does not duplicate cash already present in OpenPositions', () => {
    const snapshot = normalizeIbkrFlexStatement({
      connectionId: 'ibkr:flex',
      generatedAt: GENERATED_AT,
      accountAlias: null,
      queryId: 'q-mixed',
      statement: {
        FlexStatement: {
          AccountInformation: { AccountInformation: { accountId: 'U777', currency: 'EUR' } },
          OpenPositions: {
            OpenPosition: {
              accountId: 'U777',
              symbol: 'EUR',
              description: 'EUR cash',
              assetCategory: 'CASH',
              currency: 'EUR',
              position: '2000',
              positionValue: '2000',
              costBasisMoney: '2000',
            },
          },
          CashReport: {
            CashReportCurrency: {
              accountId: 'U777',
              currency: 'EUR',
              endingCash: '2000',
            },
          },
        },
      },
    })

    const eurPositions = snapshot.positions.filter(
      p => p.currency === 'EUR' && p.assetClass === 'cash'
    )
    // Exactly one EUR cash position — no duplicate from CashReport
    expect(eurPositions).toHaveLength(1)
    expect(eurPositions[0]?.metadata).not.toMatchObject({ synthetic: true })
  })

  it('flags accounts with CASH_REPORT_MISSING and PROVIDER_REPORTED_ZERO_CASH when no cash data is returned', () => {
    const snapshot = normalizeIbkrFlexStatement({
      connectionId: 'ibkr:flex',
      generatedAt: GENERATED_AT,
      accountAlias: 'IBKR U25659092',
      queryId: '1505333',
      statement: {
        FlexStatement: {
          AccountInformation: {
            AccountInformation: {
              accountId: 'U25659092',
              accountType: 'Individual',
              currency: 'EUR',
            },
          },
          EquitySummaryInBase: {
            EquitySummaryByReportDateInBase: {
              accountId: 'U25659092',
              reportDate: '2026-05-12',
              cash: '0',
              total: '0',
            },
          },
        },
      },
    })

    expect(snapshot.accounts).toHaveLength(1)
    const account = snapshot.accounts[0]
    expect(account).toBeDefined()
    if (!account) throw new Error('Expected one account')
    expect(account.degradedReasons).toContain('CASH_REPORT_MISSING')
    expect(account.degradedReasons).toContain('PROVIDER_REPORTED_ZERO_CASH')
    expect(account.degradedReasons).not.toContain('STALE_PROVIDER_REPORT_DATE')

    const metadata = account.metadata as Record<string, unknown>
    expect(metadata.cashReportPresent).toBe(false)
    expect(metadata.equitySummaryPresent).toBe(true)

    // Snapshot-level degraded reasons aggregate account-level diagnostics.
    expect(snapshot.degradedReasons).toContain('CASH_REPORT_MISSING')
    expect(snapshot.degradedReasons).toContain('PROVIDER_REPORTED_ZERO_CASH')

    // Account remains visible with no synthetic fake cash.
    expect(snapshot.positions.filter(p => p.assetClass === 'cash')).toHaveLength(0)
  })

  it('flags STALE_PROVIDER_REPORT_DATE when EquitySummary reportDate is older than 30 days', () => {
    const snapshot = normalizeIbkrFlexStatement({
      connectionId: 'ibkr:flex',
      generatedAt: GENERATED_AT, // '2026-04-09T12:00:00.000Z'
      accountAlias: 'IBKR Stale',
      queryId: 'q-stale',
      statement: {
        FlexStatement: {
          AccountInformation: { AccountInformation: { accountId: 'UST', currency: 'EUR' } },
          EquitySummaryInBase: {
            EquitySummaryByReportDateInBase: {
              accountId: 'UST',
              reportDate: '2025-05-12',
              cash: '0',
              total: '0',
            },
          },
        },
      },
    })

    const account = snapshot.accounts[0]
    expect(account).toBeDefined()
    if (!account) throw new Error('Expected one account')
    expect(account.degradedReasons).toContain('STALE_PROVIDER_REPORT_DATE')
  })

  it('synthesises a cash position from EquitySummary when CashReport is empty but EquitySummary.cash > 0', () => {
    const snapshot = normalizeIbkrFlexStatement({
      connectionId: 'ibkr:flex',
      generatedAt: GENERATED_AT,
      accountAlias: 'IBKR EquitySummary fallback',
      queryId: 'q-equity-only',
      statement: {
        FlexStatement: {
          AccountInformation: {
            AccountInformation: {
              accountId: 'U_EQ',
              accountType: 'Individual',
              currency: 'EUR',
            },
          },
          EquitySummaryInBase: {
            EquitySummaryByReportDateInBase: {
              accountId: 'U_EQ',
              reportDate: '2026-04-09',
              cash: '1250',
              total: '1250',
            },
          },
        },
      },
    })

    const cashPositions = snapshot.positions.filter(p => p.assetClass === 'cash')
    expect(cashPositions).toHaveLength(1)
    expect(cashPositions[0]?.normalizedValue).toBe('1250')
    expect(cashPositions[0]?.metadata).toMatchObject({ source: 'EquitySummary' })
    const account = snapshot.accounts[0]
    expect(account).toBeDefined()
    if (!account) throw new Error('Expected one account')
    expect(account.degradedReasons).toContain('CASH_REPORT_MISSING')
    expect(account.degradedReasons).not.toContain('PROVIDER_REPORTED_ZERO_CASH')
  })

  it('skips a CashReport currency with zero or negative endingCash', () => {
    const snapshot = normalizeIbkrFlexStatement({
      connectionId: 'ibkr:flex',
      generatedAt: GENERATED_AT,
      accountAlias: null,
      queryId: 'q-zero-cash',
      statement: {
        FlexStatement: {
          AccountInformation: { AccountInformation: { accountId: 'U000', currency: 'EUR' } },
          CashReport: {
            CashReportCurrency: [
              { accountId: 'U000', currency: 'EUR', endingCash: '0' },
              { accountId: 'U000', currency: 'CHF', endingCash: '-5' },
              { accountId: 'U000', currency: 'GBP', endingCash: '12.34' },
            ],
          },
        },
      },
    })

    const cashCurrencies = snapshot.positions
      .filter(p => p.assetClass === 'cash')
      .map(p => p.currency)
    expect(cashCurrencies).toEqual(['GBP'])
  })
})

describe('investment context bundle', () => {
  it('preserves unknown valuation and cost basis as degraded Advisor context', () => {
    const bundle = buildExternalInvestmentContextBundle({
      generatedAt: GENERATED_AT,
      staleAfterMinutes: 1440,
      providerCoverage: [
        {
          provider: 'ibkr',
          configured: true,
          status: 'healthy',
          lastSuccessAt: GENERATED_AT,
          lastAttemptAt: GENERATED_AT,
          stale: false,
          degradedReasons: [],
        },
        {
          provider: 'binance',
          configured: true,
          status: 'degraded',
          lastSuccessAt: GENERATED_AT,
          lastAttemptAt: GENERATED_AT,
          stale: false,
          degradedReasons: ['VALUATION_PARTIAL'],
        },
      ],
      positions: [
        {
          provider: 'ibkr',
          connectionId: 'ibkr:flex',
          accountExternalId: 'U123',
          accountAlias: 'IBKR',
          positionKey: 'ibkr-cw8',
          name: 'Amundi MSCI World',
          symbol: 'CW8',
          assetClass: 'etf',
          currency: 'EUR',
          quantity: 3,
          value: 1200,
          valueCurrency: 'EUR',
          valueSource: 'provider_reported',
          valueAsOf: GENERATED_AT,
          costBasis: 1000,
          costBasisSource: 'provider',
          unrealizedPnl: 200,
          degradedReasons: [],
          assumptions: [],
        },
        {
          provider: 'binance',
          connectionId: 'binance:spot',
          accountExternalId: 'binance:spot',
          accountAlias: 'Binance',
          positionKey: 'binance-eur',
          name: 'EUR',
          symbol: 'EUR',
          assetClass: 'cash',
          currency: 'EUR',
          quantity: 125.5,
          value: 125.5,
          valueCurrency: 'EUR',
          valueSource: 'provider_reported',
          valueAsOf: GENERATED_AT,
          costBasis: 125.5,
          costBasisSource: 'provider',
          unrealizedPnl: null,
          degradedReasons: [],
          assumptions: ['EUR cash balance is valued at its nominal amount.'],
        },
        {
          provider: 'binance',
          connectionId: 'binance:spot',
          accountExternalId: 'binance:spot',
          accountAlias: 'Binance',
          positionKey: 'binance-btc',
          name: 'Bitcoin',
          symbol: 'BTC',
          assetClass: 'crypto',
          currency: 'BTC',
          quantity: 0.1,
          value: null,
          valueCurrency: null,
          valueSource: 'unknown',
          valueAsOf: GENERATED_AT,
          costBasis: null,
          costBasisSource: 'unknown',
          unrealizedPnl: null,
          degradedReasons: ['VALUATION_PARTIAL'],
          assumptions: ['No EUR valuation is inferred from Spot balances.'],
        },
      ],
      recentTrades: [{ provider: 'ibkr', side: 'buy', feeAmount: 1 }],
      recentCashFlows: [{ provider: 'binance', type: 'deposit' }],
    })

    expect(bundle.totalKnownValue).toBe(1325.5)
    expect(bundle.unknownValuePositionCount).toBe(1)
    expect(bundle.missingMarketDataWarnings).toContain('binance:BTC')
    expect(bundle.missingMarketDataWarnings).not.toContain('binance:EUR')
    expect(bundle.unknownCostBasisWarnings).toContain('binance:BTC')
    expect(bundle.unknownCostBasisWarnings).not.toContain('binance:EUR')
    expect(bundle.riskFlags).toContain('unknown_external_investment_value')
    expect(bundle.confidence).toBe('medium')
  })
})
