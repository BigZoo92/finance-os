import type { AssetIdentityInput, AssetIdentityResolution, ValuationItemKind } from './types'

const clean = (value: string | null | undefined) => {
  const trimmed = value?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : null
}

/**
 * Deterministic identity resolution priority for a valued item:
 *
 *   provider-native stable id (CONID) → ISIN → Binance asset
 *   → ticker+exchange → ticker+currency → account/manual → unresolved
 *
 * A bare ticker without exchange or currency is ambiguous (e.g. `AIR` exists
 * on several exchanges) and is never auto-resolved.
 */
export const resolveAssetIdentity = ({
  kind,
  isManual,
  identity,
}: {
  kind: ValuationItemKind
  isManual: boolean
  identity: AssetIdentityInput
}): AssetIdentityResolution => {
  if (isManual) {
    return { status: 'resolved', identityKey: null, resolvedBy: 'manual' }
  }

  if (kind === 'cash') {
    // A cash account is identified by its account row; there is nothing to map.
    return { status: 'resolved', identityKey: null, resolvedBy: 'account' }
  }

  const conid = clean(identity.conid)
  if (conid) {
    return { status: 'resolved', identityKey: `conid:${conid}`, resolvedBy: 'conid' }
  }

  const isin = clean(identity.isin)
  if (isin) {
    return { status: 'resolved', identityKey: `isin:${isin.toUpperCase()}`, resolvedBy: 'isin' }
  }

  const binanceAsset = clean(identity.binanceAsset)
  if (binanceAsset) {
    return {
      status: 'resolved',
      identityKey: `binance:${binanceAsset.toUpperCase()}`,
      resolvedBy: 'binance_asset',
    }
  }

  const symbol = clean(identity.symbol)
  if (symbol) {
    const exchange = clean(identity.exchange)
    if (exchange) {
      return {
        status: 'resolved',
        identityKey: `symbol:${symbol.toUpperCase()}:${exchange.toUpperCase()}`,
        resolvedBy: 'symbol_exchange',
      }
    }

    const currency = clean(identity.currency)
    if (currency) {
      return {
        status: 'resolved',
        identityKey: `symbol:${symbol.toUpperCase()}:${currency.toUpperCase()}`,
        resolvedBy: 'symbol_currency',
      }
    }

    return { status: 'ambiguous', identityKey: null, resolvedBy: null }
  }

  return { status: 'unresolved', identityKey: null, resolvedBy: null }
}
