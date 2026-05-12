import { createHash } from 'node:crypto'
import type {
  BinanceAccountInfo,
  BinanceCashFlow,
  BinanceCoinInfo,
  BinanceTrade,
} from './binance-readonly-client'
import type {
  ExternalInvestmentAssetClass,
  ExternalInvestmentCanonicalCashFlow,
  ExternalInvestmentCanonicalInstrument,
  ExternalInvestmentCanonicalPosition,
  ExternalInvestmentCanonicalTrade,
  ExternalInvestmentNormalizedSnapshot,
  ExternalInvestmentRawImportDraft,
} from './types'

const STABLECOINS = new Set(['USDT', 'USDC', 'DAI', 'BUSD', 'TUSD', 'FDUSD', 'USDP'])
const FIAT = new Set(['EUR', 'USD', 'GBP', 'CHF', 'JPY', 'CAD', 'AUD'])

const asArray = <T>(value: T | T[] | undefined | null): T[] => {
  if (value === undefined || value === null) {
    return []
  }
  return Array.isArray(value) ? value : [value]
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {}

const stringValue = (value: unknown): string | null => {
  if (typeof value === 'string' && value.length > 0) {
    return value
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }
  return null
}

const numberValue = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

const firstStringValue = (record: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = stringValue(record[key])
    if (value !== null) {
      return value
    }
  }
  return null
}

const positiveDecimalString = (left: string | null, right: string | null = null) => {
  const sum = (numberValue(left) ?? 0) + (numberValue(right) ?? 0)
  return sum > 0 ? sum.toFixed(12).replace(/0+$/, '').replace(/\.$/, '') : null
}

const digestKey = (parts: Array<string | null | undefined>) =>
  createHash('sha256')
    .update(parts.map(part => part ?? '').join('|'))
    .digest('hex')
    .slice(0, 24)

const classifyBinanceAsset = (asset: string): ExternalInvestmentAssetClass => {
  const upper = asset.toUpperCase()
  if (STABLECOINS.has(upper)) {
    return 'stablecoin'
  }
  if (FIAT.has(upper)) {
    return 'cash'
  }
  return 'crypto'
}

const classifyIbkrAsset = (
  assetCategory: string | null,
  symbol: string | null
): ExternalInvestmentAssetClass => {
  const normalized = `${assetCategory ?? ''} ${symbol ?? ''}`.toLowerCase()
  if (/cash|forex|fx/.test(normalized)) return 'cash'
  if (/etf|exchange traded fund/.test(normalized)) return 'etf'
  if (/stock|equity|common/.test(normalized)) return 'equity'
  if (/bond|bill|note/.test(normalized)) return 'bond'
  if (/fund|mutual/.test(normalized)) return 'fund'
  if (/commodity|future|metal|gold/.test(normalized)) return 'commodity'
  return 'unknown'
}

type RawImportInput = Omit<ExternalInvestmentRawImportDraft, 'importStatus'> & {
  importStatus?: ExternalInvestmentRawImportDraft['importStatus']
}

const rawImport = ({
  provider,
  connectionId,
  accountExternalId,
  objectType,
  externalObjectId,
  payload,
  providerObjectAt,
  importStatus = 'normalized',
}: RawImportInput): ExternalInvestmentRawImportDraft => ({
  provider,
  connectionId,
  accountExternalId,
  objectType,
  externalObjectId,
  payload,
  providerObjectAt,
  importStatus,
})

const getFlexStatementArray = (statement: Record<string, unknown>, key: string) => {
  const flexStatement = asArray(asRecord(statement).FlexStatement)[0] ?? asRecord(statement)
  const container = asRecord(flexStatement)[key]
  if (!container) return []
  const singularKey = key.endsWith('s') ? key.slice(0, -1) : key
  const direct = asRecord(container)[singularKey]
  return asArray(direct ?? container)
}

/**
 * Read child rows for a Flex Query section whose row tag does not follow the
 * "Container -> Container-without-s" convention. Used for CashReport
 * (rows tagged <CashReportCurrency>) and EquitySummaryInBase
 * (<EquitySummaryByReportDateInBase>).
 */
const getFlexStatementChildren = (
  statement: Record<string, unknown>,
  containerKey: string,
  rowKey: string
) => {
  const flexStatement = asArray(asRecord(statement).FlexStatement)[0] ?? asRecord(statement)
  const container = asRecord(flexStatement)[containerKey]
  if (!container) return []
  const rows = asRecord(container)[rowKey]
  if (rows !== undefined && rows !== null) {
    return asArray(rows)
  }
  // Some XML emitters inline the row attributes directly on the container when
  // there is only one entry. Fall back to treating the container itself as a
  // single row in that case.
  return asArray(container)
}

const positiveDecimal = (value: string | null) => {
  if (value === null) return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return value
}

type IbkrCashBalance = {
  currency: string
  endingCash: string | null
  endingSettledCash: string | null
  netCashBalance: string | null
}

type IbkrEquitySummary = {
  reportDate: string | null
  cash: string | null
  cashLong: string | null
  total: string | null
}

export const parseIbkrCashReport = (
  statement: Record<string, unknown>
): Map<string, IbkrCashBalance[]> => {
  const rows = getFlexStatementChildren(statement, 'CashReport', 'CashReportCurrency')
  const byAccount = new Map<string, IbkrCashBalance[]>()
  for (const rowValue of rows) {
    const row = asRecord(rowValue)
    const accountId = stringValue(row.accountId)
    const currency = stringValue(row.currency)
    if (!accountId || !currency || currency.toUpperCase() === 'BASE_SUMMARY') {
      // BASE_SUMMARY is an IBKR aggregate row that double-counts other currency
      // entries — skip it to avoid inflating cash positions.
      continue
    }
    const balance: IbkrCashBalance = {
      currency: currency.toUpperCase(),
      endingCash: firstStringValue(row, ['endingCash', 'EndingCash']),
      endingSettledCash: firstStringValue(row, ['endingSettledCash', 'EndingSettledCash']),
      netCashBalance: firstStringValue(row, [
        'netCashBalance',
        'NetCashBalance',
        'endingCashSettled',
      ]),
    }
    const list = byAccount.get(accountId) ?? []
    list.push(balance)
    byAccount.set(accountId, list)
  }
  return byAccount
}

export const parseIbkrEquitySummary = (
  statement: Record<string, unknown>
): Map<string, IbkrEquitySummary> => {
  const rows = getFlexStatementChildren(
    statement,
    'EquitySummaryInBase',
    'EquitySummaryByReportDateInBase'
  )
  // Pick the most recent reportDate per account.
  const byAccount = new Map<string, IbkrEquitySummary>()
  for (const rowValue of rows) {
    const row = asRecord(rowValue)
    const accountId = stringValue(row.accountId)
    if (!accountId) continue
    const reportDate = stringValue(row.reportDate)
    const previous = byAccount.get(accountId)
    if (previous && reportDate && previous.reportDate && reportDate <= previous.reportDate) {
      continue
    }
    byAccount.set(accountId, {
      reportDate,
      cash: firstStringValue(row, ['cash', 'Cash']),
      cashLong: firstStringValue(row, ['cashLong', 'CashLong']),
      total: firstStringValue(row, ['total', 'Total']),
    })
  }
  return byAccount
}

export const normalizeBinanceSnapshot = ({
  connectionId,
  generatedAt,
  accountAlias,
  accountInfo,
  trades,
  deposits,
  withdrawals,
  coins,
}: {
  connectionId: string
  generatedAt: string
  accountAlias: string | null
  accountInfo: BinanceAccountInfo
  trades: BinanceTrade[]
  deposits: BinanceCashFlow[]
  withdrawals: BinanceCashFlow[]
  coins: BinanceCoinInfo[]
}): ExternalInvestmentNormalizedSnapshot => {
  const accountExternalId = 'binance:spot'
  const rawImports: ExternalInvestmentRawImportDraft[] = [
    rawImport({
      provider: 'binance',
      connectionId,
      accountExternalId,
      objectType: 'account',
      externalObjectId: accountExternalId,
      payload: {
        accountType: accountInfo.accountType,
        balanceCount: accountInfo.balances?.length ?? 0,
      },
      providerObjectAt: generatedAt,
      importStatus: 'metadata_only',
    }),
  ]
  const coinByAsset = new Map(coins.map(coin => [coin.coin.toUpperCase(), coin]))
  const instruments: ExternalInvestmentCanonicalInstrument[] = []
  const positions: ExternalInvestmentCanonicalPosition[] = []

  for (const balance of accountInfo.balances ?? []) {
    const quantity = positiveDecimalString(balance.free, balance.locked)
    if (!quantity) {
      continue
    }
    const asset = balance.asset.toUpperCase()
    const instrumentKey = `binance:asset:${asset}`
    const assetClass = classifyBinanceAsset(asset)
    const nativeEurCashValue = assetClass === 'cash' && asset === 'EUR' ? quantity : null
    const coin = coinByAsset.get(asset)
    const rawImportKey = `binance:position:${asset}`
    rawImports.push(
      rawImport({
        provider: 'binance',
        connectionId,
        accountExternalId,
        objectType: 'position',
        externalObjectId: asset,
        payload: {
          asset,
          free: balance.free,
          locked: balance.locked,
        },
        providerObjectAt: generatedAt,
      })
    )
    instruments.push({
      provider: 'binance',
      connectionId,
      instrumentKey,
      symbol: asset,
      name: coin?.name ?? asset,
      currency: asset,
      assetClass,
      isin: null,
      cusip: null,
      conid: null,
      binanceAsset: asset,
      binanceSymbol: null,
      metadata: coin ? { networkCount: coin.networkList?.length ?? 0 } : null,
      sourceConfidence: 'high',
      rawImportKey,
    })
    positions.push({
      provider: 'binance',
      connectionId,
      accountExternalId,
      instrumentKey,
      positionKey: `binance:${connectionId}:${asset}`,
      providerPositionId: asset,
      name: coin?.name ?? asset,
      symbol: asset,
      assetClass,
      quantity,
      freeQuantity: balance.free,
      lockedQuantity: balance.locked,
      currency: asset,
      providerValue: nativeEurCashValue,
      normalizedValue: nativeEurCashValue,
      valueCurrency: nativeEurCashValue ? 'EUR' : null,
      valueSource: nativeEurCashValue ? 'provider_reported' : 'unknown',
      valueAsOf: generatedAt,
      costBasis: nativeEurCashValue,
      costBasisCurrency: nativeEurCashValue ? 'EUR' : null,
      realizedPnl: null,
      unrealizedPnl: null,
      metadata: {
        free: balance.free,
        locked: balance.locked,
      },
      assumptions: nativeEurCashValue
        ? ['EUR cash balance is valued at its nominal amount.']
        : ['Binance Spot balances do not include EUR valuation in USER_DATA account info.'],
      degradedReasons: nativeEurCashValue ? [] : ['VALUATION_PARTIAL', 'unknown_cost_basis'],
      sourceConfidence: 'high',
      rawImportKey,
    })
  }

  const normalizedTrades: ExternalInvestmentCanonicalTrade[] = trades.map(trade => {
    const baseAsset = trade.symbol.replace(/(USDT|USDC|BUSD|FDUSD|EUR|USD)$/i, '')
    const instrumentKey = `binance:asset:${baseAsset || trade.symbol}`
    const tradedAt = new Date(trade.time).toISOString()
    rawImports.push(
      rawImport({
        provider: 'binance',
        connectionId,
        accountExternalId,
        objectType: 'trade',
        externalObjectId: String(trade.id),
        payload: {
          id: trade.id,
          orderId: trade.orderId,
          symbol: trade.symbol,
          time: trade.time,
        },
        providerObjectAt: tradedAt,
      })
    )
    return {
      provider: 'binance',
      connectionId,
      accountExternalId,
      instrumentKey,
      tradeKey: `binance:${connectionId}:${trade.symbol}:${trade.id}`,
      providerTradeId: String(trade.id),
      symbol: trade.symbol,
      side: trade.isBuyer === true ? 'buy' : trade.isBuyer === false ? 'sell' : 'unknown',
      quantity: trade.qty,
      price: trade.price,
      grossAmount: trade.quoteQty,
      netAmount: trade.quoteQty,
      currency: null,
      feeAmount: trade.commission,
      feeAsset: trade.commissionAsset,
      tradedAt,
      metadata: {
        isMaker: trade.isMaker ?? null,
        orderId: trade.orderId ?? null,
      },
      sourceConfidence: 'high',
      rawImportKey: `binance:trade:${trade.id}`,
    }
  })

  const toCashFlow = (
    flow: BinanceCashFlow,
    type: 'deposit' | 'withdrawal'
  ): ExternalInvestmentCanonicalCashFlow => {
    const occurredAt =
      typeof flow.insertTime === 'number'
        ? new Date(flow.insertTime).toISOString()
        : (flow.completeTime ?? flow.applyTime ?? generatedAt)
    const externalObjectId =
      flow.id ?? flow.txId ?? digestKey([type, flow.coin, flow.amount, occurredAt])
    rawImports.push(
      rawImport({
        provider: 'binance',
        connectionId,
        accountExternalId,
        objectType: 'cash_flow',
        externalObjectId,
        payload: {
          id: flow.id,
          coin: flow.coin,
          amount: flow.amount,
          network: flow.network,
          status: flow.status,
          insertTime: flow.insertTime,
          transferType: flow.transferType,
        },
        providerObjectAt: occurredAt,
      })
    )
    return {
      provider: 'binance',
      connectionId,
      accountExternalId,
      cashFlowKey: `binance:${connectionId}:${type}:${externalObjectId}`,
      providerCashFlowId: externalObjectId,
      type,
      asset: flow.coin,
      amount: flow.amount,
      currency: flow.coin,
      feeAmount: flow.transactionFee ?? null,
      feeAsset: flow.transactionFee ? flow.coin : null,
      occurredAt,
      metadata: {
        network: flow.network ?? null,
        status: flow.status ?? null,
        transferType: flow.transferType ?? null,
      },
      sourceConfidence: 'high',
      rawImportKey: `binance:cash_flow:${externalObjectId}`,
    }
  }

  return {
    provider: 'binance',
    connectionId,
    generatedAt,
    accounts: [
      {
        provider: 'binance',
        connectionId,
        accountExternalId,
        accountType: accountInfo.accountType ?? 'spot',
        accountAlias,
        baseCurrency: null,
        metadata: { balanceCount: positions.length },
        degradedReasons: positions.some(position => position.normalizedValue === null)
          ? ['VALUATION_PARTIAL']
          : [],
        sourceConfidence: 'high',
        rawImportKey: 'binance:account',
      },
    ],
    instruments,
    positions,
    trades: normalizedTrades,
    cashFlows: [
      ...deposits.map(flow => toCashFlow(flow, 'deposit')),
      ...withdrawals.map(flow => toCashFlow(flow, 'withdrawal')),
    ],
    rawImports,
    degradedReasons: positions.some(position => position.normalizedValue === null)
      ? ['VALUATION_PARTIAL']
      : [],
    warnings: [],
  }
}

export const normalizeIbkrFlexStatement = ({
  connectionId,
  generatedAt,
  accountAlias,
  queryId,
  statement,
}: {
  connectionId: string
  generatedAt: string
  accountAlias: string | null
  queryId: string
  statement: Record<string, unknown>
}): ExternalInvestmentNormalizedSnapshot => {
  const accountRows = getFlexStatementArray(statement, 'AccountInformation')
  const positionRows = getFlexStatementArray(statement, 'OpenPositions')
  const tradeRows = getFlexStatementArray(statement, 'Trades')
  const cashRows = getFlexStatementArray(statement, 'CashTransactions')
  const cashReportByAccount = parseIbkrCashReport(statement)
  const equitySummaryByAccount = parseIbkrEquitySummary(statement)
  const rawImports: ExternalInvestmentRawImportDraft[] = [
    rawImport({
      provider: 'ibkr',
      connectionId,
      accountExternalId: null,
      objectType: 'statement',
      externalObjectId: queryId,
      payload: {
        queryId,
        accountRowCount: accountRows.length,
        positionRowCount: positionRows.length,
        tradeRowCount: tradeRows.length,
        cashRowCount: cashRows.length,
        cashReportAccountCount: cashReportByAccount.size,
        equitySummaryAccountCount: equitySummaryByAccount.size,
      },
      providerObjectAt: generatedAt,
      importStatus: 'metadata_only',
    }),
  ]
  const fallbackAccountId =
    stringValue(asRecord(accountRows[0]).accountId) ??
    stringValue(asRecord(positionRows[0]).accountId) ??
    [...cashReportByAccount.keys()][0] ??
    [...equitySummaryByAccount.keys()][0] ??
    `ibkr:flex:${queryId}`

  const STALE_REPORT_DATE_WARN_DAYS = 30
  const generatedAtMs = Date.parse(generatedAt)
  const isReportDateStale = (reportDate: string | null | undefined) => {
    if (!reportDate || Number.isNaN(generatedAtMs)) return false
    const reportMs = Date.parse(reportDate)
    if (Number.isNaN(reportMs)) return false
    return generatedAtMs - reportMs > STALE_REPORT_DATE_WARN_DAYS * 24 * 60 * 60 * 1000
  }

  const equitySummaryCashIsZeroOrEmpty = (summary: IbkrEquitySummary | null) => {
    if (!summary) return true
    const cash = summary.cash ?? summary.cashLong
    if (!cash) return true
    const parsed = Number(cash)
    return !Number.isFinite(parsed) || parsed <= 0
  }

  const accounts = (accountRows.length > 0 ? accountRows : [{ accountId: fallbackAccountId }]).map(
    rowValue => {
      const row = asRecord(rowValue)
      const accountExternalId = stringValue(row.accountId) ?? fallbackAccountId
      const cashBalances = cashReportByAccount.get(accountExternalId) ?? null
      const equitySummary = equitySummaryByAccount.get(accountExternalId) ?? null
      const accountDegradedReasons: string[] = []
      if (!cashBalances || cashBalances.length === 0) {
        accountDegradedReasons.push('CASH_REPORT_MISSING')
      }
      if (
        (!cashBalances || cashBalances.length === 0) &&
        equitySummaryCashIsZeroOrEmpty(equitySummary)
      ) {
        accountDegradedReasons.push('PROVIDER_REPORTED_ZERO_CASH')
      }
      if (equitySummary && isReportDateStale(equitySummary.reportDate)) {
        accountDegradedReasons.push('STALE_PROVIDER_REPORT_DATE')
      }
      return {
        provider: 'ibkr' as const,
        connectionId,
        accountExternalId,
        accountType: stringValue(row.accountType),
        accountAlias,
        baseCurrency: stringValue(row.currency) ?? stringValue(row.baseCurrency),
        metadata: {
          queryId,
          ...(cashBalances ? { cashBalances } : {}),
          ...(equitySummary ? { equitySummary } : {}),
          cashReportPresent: Boolean(cashBalances && cashBalances.length > 0),
          equitySummaryPresent: Boolean(equitySummary),
        },
        degradedReasons: accountDegradedReasons,
        sourceConfidence: 'high' as const,
        rawImportKey: `ibkr:account:${accountExternalId}`,
      }
    }
  )

  const instruments = new Map<string, ExternalInvestmentCanonicalInstrument>()
  const positions: ExternalInvestmentCanonicalPosition[] = []

  for (const rowValue of positionRows) {
    const row = asRecord(rowValue)
    const accountExternalId = stringValue(row.accountId) ?? fallbackAccountId
    const conid = stringValue(row.conid) ?? stringValue(row.conId)
    const symbol = stringValue(row.symbol)
    const isin = stringValue(row.isin)
    const instrumentKey = `ibkr:${conid ?? isin ?? symbol ?? digestKey([accountExternalId, stringValue(row.description)])}`
    const assetClass = classifyIbkrAsset(stringValue(row.assetCategory), symbol)
    const name = stringValue(row.description) ?? symbol ?? instrumentKey
    const providerValue = firstStringValue(row, ['marketValue', 'positionValue', 'value'])
    const costBasis = firstStringValue(row, ['costBasisMoney', 'costBasis'])
    const unrealizedPnl = firstStringValue(row, [
      'fifoPnlUnrealized',
      'unrealizedPnl',
      'unrealizedPL',
      'unrealized',
    ])
    rawImports.push(
      rawImport({
        provider: 'ibkr',
        connectionId,
        accountExternalId,
        objectType: 'position',
        externalObjectId: instrumentKey,
        payload: {
          accountId: accountExternalId,
          conid,
          symbol,
          description: name,
          assetCategory: stringValue(row.assetCategory),
        },
        providerObjectAt: generatedAt,
      })
    )
    instruments.set(instrumentKey, {
      provider: 'ibkr',
      connectionId,
      instrumentKey,
      symbol,
      name,
      currency: stringValue(row.currency),
      assetClass,
      isin,
      cusip: stringValue(row.cusip),
      conid,
      binanceAsset: null,
      binanceSymbol: null,
      metadata: { assetCategory: stringValue(row.assetCategory) },
      sourceConfidence: 'high',
      rawImportKey: `ibkr:instrument:${instrumentKey}`,
    })
    positions.push({
      provider: 'ibkr',
      connectionId,
      accountExternalId,
      instrumentKey,
      positionKey: `ibkr:${connectionId}:${accountExternalId}:${instrumentKey}`,
      providerPositionId: instrumentKey,
      name,
      symbol,
      assetClass,
      quantity: stringValue(row.position),
      freeQuantity: null,
      lockedQuantity: null,
      currency: stringValue(row.currency),
      providerValue,
      normalizedValue: providerValue,
      valueCurrency: stringValue(row.currency),
      valueSource: providerValue ? 'provider_reported' : 'unknown',
      valueAsOf: generatedAt,
      costBasis,
      costBasisCurrency: stringValue(row.currency),
      realizedPnl: null,
      unrealizedPnl,
      metadata: {
        reportDate: stringValue(row.reportDate),
        assetCategory: stringValue(row.assetCategory),
      },
      assumptions: providerValue
        ? []
        : ['IBKR Flex position did not include marketValue or positionValue.'],
      degradedReasons: [
        ...(providerValue ? [] : ['VALUATION_PARTIAL']),
        ...(costBasis ? [] : ['unknown_cost_basis']),
      ],
      sourceConfidence: 'high',
      rawImportKey: `ibkr:position:${instrumentKey}`,
    })
  }

  const trades: ExternalInvestmentCanonicalTrade[] = tradeRows.map(rowValue => {
    const row = asRecord(rowValue)
    const accountExternalId = stringValue(row.accountId) ?? fallbackAccountId
    const tradeId =
      stringValue(row.tradeID) ??
      stringValue(row.transactionID) ??
      digestKey([accountExternalId, stringValue(row.dateTime), stringValue(row.symbol)])
    const symbol = stringValue(row.symbol)
    const conid = stringValue(row.conid) ?? stringValue(row.conId)
    const instrumentKey = `ibkr:${conid ?? symbol ?? tradeId}`
    const tradedAt = stringValue(row.dateTime) ?? stringValue(row.tradeDate) ?? generatedAt
    return {
      provider: 'ibkr',
      connectionId,
      accountExternalId,
      instrumentKey,
      tradeKey: `ibkr:${connectionId}:${tradeId}`,
      providerTradeId: tradeId,
      symbol,
      side: /sell/i.test(stringValue(row.buySell) ?? '')
        ? 'sell'
        : /buy/i.test(stringValue(row.buySell) ?? '')
          ? 'buy'
          : 'unknown',
      quantity: stringValue(row.quantity),
      price: stringValue(row.tradePrice),
      grossAmount: stringValue(row.tradeMoney),
      netAmount: stringValue(row.netCash),
      currency: stringValue(row.currency),
      feeAmount: stringValue(row.ibCommission),
      feeAsset: stringValue(row.ibCommissionCurrency) ?? stringValue(row.currency),
      tradedAt,
      metadata: { assetCategory: stringValue(row.assetCategory) },
      sourceConfidence: 'high',
      rawImportKey: `ibkr:trade:${tradeId}`,
    }
  })

  const cashFlows: ExternalInvestmentCanonicalCashFlow[] = cashRows.map(rowValue => {
    const row = asRecord(rowValue)
    const accountExternalId = stringValue(row.accountId) ?? fallbackAccountId
    const cashFlowId =
      stringValue(row.transactionID) ??
      digestKey([
        accountExternalId,
        stringValue(row.dateTime),
        stringValue(row.amount),
        stringValue(row.type),
      ])
    const typeLabel = (stringValue(row.type) ?? stringValue(row.description) ?? '').toLowerCase()
    const type = /dividend/.test(typeLabel)
      ? 'dividend'
      : /interest/.test(typeLabel)
        ? 'interest'
        : /tax/.test(typeLabel)
          ? 'tax'
          : /fee|commission/.test(typeLabel)
            ? 'fee'
            : /deposit/.test(typeLabel)
              ? 'deposit'
              : /withdraw/.test(typeLabel)
                ? 'withdrawal'
                : /transfer/.test(typeLabel)
                  ? 'transfer'
                  : 'unknown'
    return {
      provider: 'ibkr',
      connectionId,
      accountExternalId,
      cashFlowKey: `ibkr:${connectionId}:${cashFlowId}`,
      providerCashFlowId: cashFlowId,
      type,
      asset: stringValue(row.symbol),
      amount: stringValue(row.amount),
      currency: stringValue(row.currency),
      feeAmount: null,
      feeAsset: null,
      occurredAt: stringValue(row.dateTime) ?? stringValue(row.reportDate) ?? generatedAt,
      metadata: { description: stringValue(row.description), rawType: stringValue(row.type) },
      sourceConfidence: 'medium',
      rawImportKey: `ibkr:cash_flow:${cashFlowId}`,
    }
  })

  // Synthesize cash positions from the CashReport section so that a fully
  // cash-only account is still visible in the bundle (and therefore in the UI).
  // We only emit a synthetic position when no IBKR OpenPosition already exists
  // for the same account+currency, to avoid double-counting.
  const existingCashCurrencyByAccount = new Map<string, Set<string>>()
  for (const position of positions) {
    if (position.assetClass === 'cash' && position.currency) {
      const set = existingCashCurrencyByAccount.get(position.accountExternalId) ?? new Set()
      set.add(position.currency.toUpperCase())
      existingCashCurrencyByAccount.set(position.accountExternalId, set)
    }
  }
  for (const [accountExternalId, balances] of cashReportByAccount.entries()) {
    const existingCurrencies =
      existingCashCurrencyByAccount.get(accountExternalId) ?? new Set<string>()
    for (const balance of balances) {
      const amount = positiveDecimal(balance.endingCash) ?? positiveDecimal(balance.netCashBalance)
      if (!amount) continue
      if (existingCurrencies.has(balance.currency)) continue
      const instrumentKey = `ibkr:cash:${balance.currency}`
      const rawImportKey = `ibkr:cash:${accountExternalId}:${balance.currency}`
      rawImports.push(
        rawImport({
          provider: 'ibkr',
          connectionId,
          accountExternalId,
          objectType: 'cash_balance',
          externalObjectId: `${accountExternalId}:${balance.currency}`,
          payload: {
            accountId: accountExternalId,
            currency: balance.currency,
            endingCash: balance.endingCash,
            endingSettledCash: balance.endingSettledCash,
            netCashBalance: balance.netCashBalance,
          },
          providerObjectAt: generatedAt,
        })
      )
      if (!instruments.has(instrumentKey)) {
        instruments.set(instrumentKey, {
          provider: 'ibkr',
          connectionId,
          instrumentKey,
          symbol: balance.currency,
          name: `${balance.currency} cash`,
          currency: balance.currency,
          assetClass: 'cash',
          isin: null,
          cusip: null,
          conid: null,
          binanceAsset: null,
          binanceSymbol: null,
          metadata: { synthetic: true, source: 'CashReport' },
          sourceConfidence: 'high',
          rawImportKey,
        })
      }
      positions.push({
        provider: 'ibkr',
        connectionId,
        accountExternalId,
        instrumentKey,
        positionKey: `ibkr:${accountExternalId}:cash:${balance.currency}`,
        providerPositionId: `${accountExternalId}:cash:${balance.currency}`,
        name: `${balance.currency} cash`,
        symbol: balance.currency,
        assetClass: 'cash',
        quantity: amount,
        freeQuantity: amount,
        lockedQuantity: null,
        currency: balance.currency,
        providerValue: amount,
        normalizedValue: amount,
        valueCurrency: balance.currency,
        valueSource: 'provider_reported',
        valueAsOf: generatedAt,
        costBasis: amount,
        costBasisCurrency: balance.currency,
        realizedPnl: null,
        unrealizedPnl: null,
        metadata: { synthetic: true, source: 'CashReport' },
        sourceConfidence: 'high',
        degradedReasons: [],
        assumptions: [
          `IBKR cash balance ${balance.currency} sourced from CashReport.endingCash; not a tradeable position.`,
        ],
        rawImportKey,
      })
    }
  }

  // Fallback: when CashReport is missing for an account but EquitySummary
  // reports a positive cash amount, synthesise a base-currency cash position
  // so the account isn't invisible in the dashboard. We tag it explicitly so
  // it can be distinguished from a real CashReport-sourced cash row.
  for (const account of accounts) {
    if (
      account.metadata &&
      typeof account.metadata === 'object' &&
      (account.metadata as Record<string, unknown>).cashReportPresent === true
    ) {
      continue
    }
    const equitySummary = equitySummaryByAccount.get(account.accountExternalId) ?? null
    if (!equitySummary) continue
    const cashStr = equitySummary.cash ?? equitySummary.cashLong
    const cash = cashStr ? Number(cashStr) : null
    if (!cash || !Number.isFinite(cash) || cash <= 0) continue
    const currency = account.baseCurrency ?? 'USD'
    const instrumentKey = `ibkr:cash:${currency}:equity-summary`
    const rawImportKey = `ibkr:cash:${account.accountExternalId}:${currency}:equity-summary`
    if (!instruments.has(instrumentKey)) {
      instruments.set(instrumentKey, {
        provider: 'ibkr',
        connectionId,
        instrumentKey,
        symbol: currency,
        name: `${currency} cash (EquitySummary fallback)`,
        currency,
        assetClass: 'cash',
        isin: null,
        cusip: null,
        conid: null,
        binanceAsset: null,
        binanceSymbol: null,
        metadata: { synthetic: true, source: 'EquitySummary' },
        sourceConfidence: 'medium',
        rawImportKey,
      })
    }
    positions.push({
      provider: 'ibkr',
      connectionId,
      accountExternalId: account.accountExternalId,
      instrumentKey,
      positionKey: `ibkr:${account.accountExternalId}:cash:${currency}:equity-summary`,
      providerPositionId: `${account.accountExternalId}:cash:${currency}:equity-summary`,
      name: `${currency} cash (EquitySummary fallback)`,
      symbol: currency,
      assetClass: 'cash',
      quantity: cashStr ?? null,
      freeQuantity: cashStr ?? null,
      lockedQuantity: null,
      currency,
      providerValue: cashStr ?? null,
      normalizedValue: cashStr ?? null,
      valueCurrency: currency,
      valueSource: 'provider_reported',
      valueAsOf: generatedAt,
      costBasis: cashStr ?? null,
      costBasisCurrency: currency,
      realizedPnl: null,
      unrealizedPnl: null,
      metadata: {
        synthetic: true,
        source: 'EquitySummary',
        reportDate: equitySummary.reportDate,
      },
      sourceConfidence: 'medium',
      degradedReasons: [],
      assumptions: [
        `IBKR cash balance ${currency} sourced from EquitySummary.cash because CashReport is empty.`,
      ],
      rawImportKey,
    })
  }

  const overallDegradedReasons = new Set<string>()
  if (positions.some(position => position.normalizedValue === null)) {
    overallDegradedReasons.add('VALUATION_PARTIAL')
  }
  for (const account of accounts) {
    for (const reason of account.degradedReasons) {
      overallDegradedReasons.add(reason)
    }
  }

  return {
    provider: 'ibkr',
    connectionId,
    generatedAt,
    accounts,
    instruments: [...instruments.values()],
    positions,
    trades,
    cashFlows,
    rawImports,
    degradedReasons: [...overallDegradedReasons],
    warnings: [],
  }
}
