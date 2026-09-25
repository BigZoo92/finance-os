import { describe, expect, it } from 'bun:test'

// Server-only modules (node:crypto, drizzle/db, provider credentials) must stay
// on their subpath exports so the root barrel remains safe to import anywhere.
const SERVER_ONLY_EXPORTS: readonly string[] = [
  // ./binance (binance-readonly-client)
  'BINANCE_READONLY_ALLOWED_ENDPOINTS',
  'assertBinanceReadonlyEndpoint',
  'createBinanceReadonlyClient',
  'signBinanceUserDataParams',
  // ./ibkr (ibkr-flex-client)
  'createIbkrFlexClient',
  'parseIbkrFlexXml',
  // ./normalizer
  'normalizeBinanceSnapshot',
  'normalizeIbkrFlexStatement',
  'parseIbkrCashReport',
  'parseIbkrEquitySummary',
  // ./repository
  'createExternalInvestmentsRepository',
  // ./server-config
  'resolveExternalInvestmentServerConfig',
]

const ISOMORPHIC_EXPORTS: readonly string[] = [
  // binance-price-resolver
  'resolveBinanceAssetValue',
  // binance-valuation-enrichment
  'createBinanceUsdEurFxFetcher',
  'createSnapshotFxFetcher',
  'enrichBinanceValuations',
  // context-bundle
  'buildExternalInvestmentContextBundle',
  // errors
  'ExternalInvestmentProviderError',
  'isSoftExternalInvestmentError',
  'toExternalInvestmentErrorCode',
  'toSafeExternalInvestmentErrorMessage',
  // jobs
  'EXTERNAL_INVESTMENTS_JOB_QUEUE_KEY',
  'parseExternalInvestmentsJob',
  'serializeExternalInvestmentsJob',
  // market-quoted-valuation
  'enrichMarketQuotedValuations',
  // provider-operation
  'ExternalInvestmentProviderOperationError',
  'redactExternalProviderErrorMessage',
  'runExternalInvestmentProviderOperation',
  // types
  'isExternalInvestmentProvider',
]

describe('@finance-os/external-investments root barrel', () => {
  it('exports the isomorphic modules', async () => {
    const exported = Object.keys(await import('./index'))
    const missing = ISOMORPHIC_EXPORTS.filter(name => !exported.includes(name))

    expect(missing).toEqual([])
  })

  it('does not leak server-only modules', async () => {
    const exported = Object.keys(await import('./index'))
    const leaked = SERVER_ONLY_EXPORTS.filter(name => exported.includes(name))

    expect(leaked).toEqual([])
  })
})
