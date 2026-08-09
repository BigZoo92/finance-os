import type {
  BinanceSpotCredentialPayload,
  ExternalInvestmentCredentialPayload,
  ExternalInvestmentProvider,
  IbkrFlexCredentialPayload,
} from './types'

export type ExternalInvestmentServerConfigInput = {
  ibkr: {
    flexToken?: string
    queryIds: readonly string[]
    baseUrl: string
    userAgent: string
  }
  binance: {
    apiKey?: string
    apiSecret?: string
    baseUrl: string
  }
}

export type ExternalInvestmentServerConfig = {
  credentials: Record<ExternalInvestmentProvider, ExternalInvestmentCredentialPayload | null>
  configured: Record<ExternalInvestmentProvider, boolean>
}

const toOptionalTrimmed = (value: string | undefined) => {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

export const resolveExternalInvestmentServerConfig = (
  input: ExternalInvestmentServerConfigInput
): ExternalInvestmentServerConfig => {
  const flexToken = toOptionalTrimmed(input.ibkr.flexToken)
  const queryIds = Array.from(
    new Set(input.ibkr.queryIds.map(queryId => queryId.trim()).filter(Boolean))
  )
  const ibkr: IbkrFlexCredentialPayload | null =
    flexToken && queryIds.length > 0
      ? {
          provider: 'ibkr',
          kind: 'ibkr_flex',
          flexToken,
          queryIds,
          baseUrl: input.ibkr.baseUrl,
          userAgent: input.ibkr.userAgent,
        }
      : null

  const apiKey = toOptionalTrimmed(input.binance.apiKey)
  const apiSecret = toOptionalTrimmed(input.binance.apiSecret)
  const binance: BinanceSpotCredentialPayload | null =
    apiKey && apiSecret
      ? {
          provider: 'binance',
          kind: 'binance_spot',
          apiKey,
          apiSecret,
          baseUrl: input.binance.baseUrl,
        }
      : null

  return {
    credentials: { ibkr, binance },
    configured: {
      ibkr: ibkr !== null,
      binance: binance !== null,
    },
  }
}
