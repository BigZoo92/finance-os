import { createFxConverter, type FxConverter } from './fx'
import { resolveStaleAfterSeconds } from './freshness'
import { resolveAssetIdentity } from './resolve-asset-identity'
import type {
  FxRateInput,
  ItemValuation,
  ValuationItemInput,
  ValuationSource,
  ValuationStatus,
} from './types'
import { VALUATION_BASE_CURRENCY } from './types'

const round2 = (value: number) => Math.round(value * 100) / 100
const round4 = (value: number) => Math.round(value * 1e4) / 1e4

const CONFIDENCE_BY_STATUS: Record<ValuationStatus, number> = {
  priced: 0.95,
  derived: 0.95,
  manual: 0.9,
  estimated: 0.7,
  stale: 0.5,
  unresolved: 0,
  unavailable: 0,
}

const resolveSource = (item: ValuationItemInput): ValuationSource => {
  if (item.isManual) {
    return 'manual_entry'
  }
  if (item.kind === 'cash') {
    return 'bank_balance'
  }
  return 'provider_native'
}

const isValueStale = ({
  asOf,
  staleAfterSeconds,
  now,
}: {
  asOf: string | null
  staleAfterSeconds: number
  now: Date
}): boolean => {
  if (asOf === null) {
    return true
  }
  const asOfMs = new Date(asOf).getTime()
  if (!Number.isFinite(asOfMs)) {
    return true
  }
  return now.getTime() - asOfMs > staleAfterSeconds * 1000
}

const computePnl = ({
  item,
  valueBase,
  fx,
}: {
  item: ValuationItemInput
  valueBase: number | null
  fx: FxConverter
}): { costBasisBase: number | null; unrealizedPnlBase: number | null; unrealizedPnlPercent: number | null } => {
  const empty = { costBasisBase: null, unrealizedPnlBase: null, unrealizedPnlPercent: null }

  if (
    valueBase === null ||
    item.costBasis === null ||
    !Number.isFinite(item.costBasis) ||
    item.costBasisSource === 'unknown'
  ) {
    return empty
  }

  const costCurrency = item.costBasisCurrency ?? item.currency
  if (costCurrency === null) {
    return empty
  }

  const conversion = fx.toBase(item.costBasis, costCurrency)
  if (conversion === null) {
    return empty
  }

  const costBasisBase = round2(conversion.value)
  const unrealizedPnlBase = round2(valueBase - costBasisBase)
  const unrealizedPnlPercent =
    costBasisBase > 0 ? round4((unrealizedPnlBase / costBasisBase) * 100) : null

  if (!Number.isFinite(unrealizedPnlBase)) {
    return empty
  }

  return {
    costBasisBase,
    unrealizedPnlBase,
    unrealizedPnlPercent:
      unrealizedPnlPercent !== null && Number.isFinite(unrealizedPnlPercent)
        ? unrealizedPnlPercent
        : null,
  }
}

export const valuateItem = ({
  item,
  fx,
  now,
}: {
  item: ValuationItemInput
  fx: FxConverter
  now: Date
}): ItemValuation => {
  const identity = resolveAssetIdentity({
    kind: item.kind,
    isManual: item.isManual,
    identity: item.identity,
  })
  const staleAfterSeconds = item.isManual
    ? null
    : resolveStaleAfterSeconds(
        item.staleAfterSecondsOverride === undefined
          ? { assetClass: item.assetClass }
          : { assetClass: item.assetClass, override: item.staleAfterSecondsOverride }
      )

  const base: Omit<
    ItemValuation,
    | 'valueOriginal'
    | 'valueBase'
    | 'fxRate'
    | 'fxProvider'
    | 'fxTimestamp'
    | 'costBasisBase'
    | 'unrealizedPnlBase'
    | 'unrealizedPnlPercent'
    | 'status'
    | 'confidence'
    | 'errorCode'
    | 'safeErrorMessage'
  > = {
    itemKey: item.itemKey,
    kind: item.kind,
    name: item.name,
    provider: item.provider,
    assetClass: item.assetClass,
    currency: item.currency,
    quantity: item.quantity,
    baseCurrency: VALUATION_BASE_CURRENCY,
    source: resolveSource(item),
    identityStatus: identity.status,
    identityKey: identity.identityKey,
    asOf: item.asOf,
    staleAfterSeconds,
  }

  const withStatus = (
    status: ValuationStatus,
    fields: Partial<
      Pick<
        ItemValuation,
        | 'valueOriginal'
        | 'valueBase'
        | 'fxRate'
        | 'fxProvider'
        | 'fxTimestamp'
        | 'costBasisBase'
        | 'unrealizedPnlBase'
        | 'unrealizedPnlPercent'
        | 'errorCode'
        | 'safeErrorMessage'
      >
    > = {}
  ): ItemValuation => ({
    ...base,
    valueOriginal: null,
    valueBase: null,
    fxRate: null,
    fxProvider: null,
    fxTimestamp: null,
    costBasisBase: null,
    unrealizedPnlBase: null,
    unrealizedPnlPercent: null,
    errorCode: null,
    safeErrorMessage: null,
    status,
    confidence: CONFIDENCE_BY_STATUS[status],
    source: status === 'unresolved' || status === 'unavailable' ? 'none' : base.source,
    ...fields,
  })

  // 1. No native value: unresolved when the identity itself is unknown,
  //    unavailable when the asset is identified but no price was obtainable.
  if (item.nativeValue === null || !Number.isFinite(item.nativeValue)) {
    const degradedReason = item.degradedReasons[0] ?? null
    if (identity.status === 'unresolved' || identity.status === 'ambiguous') {
      return withStatus('unresolved', {
        errorCode: degradedReason ?? 'IDENTITY_UNRESOLVED',
        safeErrorMessage: 'Actif non identifiable: aucune valorisation possible.',
      })
    }
    return withStatus('unavailable', {
      errorCode: degradedReason ?? 'VALUE_UNAVAILABLE',
      safeErrorMessage: 'Prix indisponible pour cet actif.',
    })
  }

  // 2. Native value present but currency unknown: cannot convert honestly.
  if (item.currency === null) {
    return withStatus('unavailable', {
      valueOriginal: round2(item.nativeValue),
      errorCode: 'CURRENCY_UNKNOWN',
      safeErrorMessage: 'Devise inconnue: conversion EUR impossible.',
    })
  }

  // 3. Convert to base currency.
  const conversion = fx.toBase(item.nativeValue, item.currency)
  if (conversion === null) {
    return withStatus('unavailable', {
      valueOriginal: round2(item.nativeValue),
      errorCode: 'FX_RATE_UNAVAILABLE',
      safeErrorMessage: `Taux ${item.currency}/EUR indisponible: valeur EUR non calculable.`,
    })
  }

  const valueBase = round2(conversion.value)
  const pnl = computePnl({ item, valueBase, fx })

  let status: ValuationStatus
  if (item.isManual) {
    status = 'manual'
  } else if (
    staleAfterSeconds !== null &&
    isValueStale({ asOf: item.asOf, staleAfterSeconds, now })
  ) {
    status = 'stale'
  } else if (conversion.isStale || item.approximateValue === true) {
    // Fresh value but old FX rate (here or upstream): usable, approximate.
    status = 'estimated'
  } else if (item.kind === 'cash') {
    status = 'derived'
  } else {
    status = 'priced'
  }

  // Manual assets converted with a stale/foreign FX rate are estimates.
  if (item.isManual && conversion.isStale) {
    status = 'estimated'
  }

  return withStatus(status, {
    valueOriginal: round2(item.nativeValue),
    valueBase,
    fxRate: conversion.rate,
    fxProvider: conversion.provider,
    fxTimestamp: conversion.rateTimestamp,
    ...pnl,
  })
}

export const valuateItems = ({
  items,
  fxRates,
  now,
  baseCurrency = VALUATION_BASE_CURRENCY,
}: {
  items: ValuationItemInput[]
  fxRates: FxRateInput[]
  now: Date
  baseCurrency?: string
}): ItemValuation[] => {
  const fx = createFxConverter({ baseCurrency, rates: fxRates, now })
  return items.map(item => valuateItem({ item, fx, now }))
}
