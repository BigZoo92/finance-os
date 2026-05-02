import { describe, expect, it } from 'bun:test'
import {
  assertBinanceReadonlyEndpoint,
  signBinanceUserDataParams,
} from './binance-readonly-client'
import {
  decryptExternalInvestmentCredential,
  encryptExternalInvestmentCredential,
  maskExternalInvestmentCredential,
} from './credentials'
import { parseIbkrFlexXml } from './ibkr-flex-client'
import { normalizeBinanceSnapshot, normalizeIbkrFlexStatement } from './normalizer'
import { buildExternalInvestmentContextBundle } from './context-bundle'

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
    expect(() =>
      assertBinanceReadonlyEndpoint({ method: 'GET', path: '/api/v3/order' })
    ).toThrow(/non-allowlisted/)
    expect(() =>
      assertBinanceReadonlyEndpoint({
        method: 'GET',
        path: '/sapi/v1/capital/withdraw/apply',
      })
    ).toThrow(/non-allowlisted/)
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

    expect(snapshot.positions).toHaveLength(2)
    expect(snapshot.positions.find(position => position.symbol === 'BTC')?.valueSource).toBe(
      'unknown'
    )
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
              marketValue: '1200',
              costBasisMoney: '1000',
              fifoPnlUnrealized: '200',
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
    expect(snapshot.trades[0]?.side).toBe('buy')
    expect(snapshot.cashFlows[0]?.type).toBe('dividend')
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

    expect(bundle.totalKnownValue).toBe(1200)
    expect(bundle.unknownValuePositionCount).toBe(1)
    expect(bundle.missingMarketDataWarnings).toContain('binance:BTC')
    expect(bundle.unknownCostBasisWarnings).toContain('binance:BTC')
    expect(bundle.riskFlags).toContain('unknown_external_investment_value')
    expect(bundle.confidence).toBe('medium')
  })
})
