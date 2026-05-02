import { createHash } from 'node:crypto'
import type { BinanceAccountInfo, BinanceCashFlow, BinanceCoinInfo, BinanceTrade } from './binance-readonly-client'
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

const classifyIbkrAsset = (assetCategory: string | null, symbol: string | null): ExternalInvestmentAssetClass => {
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
      providerValue: null,
      normalizedValue: null,
      valueCurrency: null,
      valueSource: 'unknown',
      valueAsOf: generatedAt,
      costBasis: null,
      costBasisCurrency: null,
      realizedPnl: null,
      unrealizedPnl: null,
      metadata: {
        free: balance.free,
        locked: balance.locked,
      },
      assumptions: ['Binance Spot balances do not include EUR valuation in USER_DATA account info.'],
      degradedReasons: ['VALUATION_PARTIAL', 'unknown_cost_basis'],
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
        : flow.completeTime ?? flow.applyTime ?? generatedAt
    const externalObjectId = flow.id ?? flow.txId ?? digestKey([type, flow.coin, flow.amount, occurredAt])
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
      },
      providerObjectAt: generatedAt,
      importStatus: 'metadata_only',
    }),
  ]
  const fallbackAccountId =
    stringValue(asRecord(accountRows[0]).accountId) ??
    stringValue(asRecord(positionRows[0]).accountId) ??
    `ibkr:flex:${queryId}`

  const accounts = (accountRows.length > 0 ? accountRows : [{ accountId: fallbackAccountId }]).map(rowValue => {
    const row = asRecord(rowValue)
    const accountExternalId = stringValue(row.accountId) ?? fallbackAccountId
    return {
      provider: 'ibkr' as const,
      connectionId,
      accountExternalId,
      accountType: stringValue(row.accountType),
      accountAlias,
      baseCurrency: stringValue(row.currency) ?? stringValue(row.baseCurrency),
      metadata: { queryId },
      degradedReasons: [],
      sourceConfidence: 'high' as const,
      rawImportKey: `ibkr:account:${accountExternalId}`,
    }
  })

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
    const providerValue = stringValue(row.marketValue)
    const costBasis = stringValue(row.costBasisMoney) ?? stringValue(row.costBasis)
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
      unrealizedPnl: stringValue(row.fifoPnlUnrealized) ?? stringValue(row.unrealizedPnl),
      metadata: {
        reportDate: stringValue(row.reportDate),
        assetCategory: stringValue(row.assetCategory),
      },
      assumptions: providerValue ? [] : ['IBKR Flex position did not include marketValue.'],
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
    const tradeId = stringValue(row.tradeID) ?? stringValue(row.transactionID) ?? digestKey([accountExternalId, stringValue(row.dateTime), stringValue(row.symbol)])
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
      side: /sell/i.test(stringValue(row.buySell) ?? '') ? 'sell' : /buy/i.test(stringValue(row.buySell) ?? '') ? 'buy' : 'unknown',
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
    const cashFlowId = stringValue(row.transactionID) ?? digestKey([accountExternalId, stringValue(row.dateTime), stringValue(row.amount), stringValue(row.type)])
    const typeLabel = (stringValue(row.type) ?? stringValue(row.description) ?? '').toLowerCase()
    const type =
      /dividend/.test(typeLabel) ? 'dividend' :
        /interest/.test(typeLabel) ? 'interest' :
          /tax/.test(typeLabel) ? 'tax' :
            /fee|commission/.test(typeLabel) ? 'fee' :
              /deposit/.test(typeLabel) ? 'deposit' :
                /withdraw/.test(typeLabel) ? 'withdrawal' :
                  /transfer/.test(typeLabel) ? 'transfer' :
                    'unknown'
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
    degradedReasons: positions.some(position => position.normalizedValue === null)
      ? ['VALUATION_PARTIAL']
      : [],
    warnings: [],
  }
}
