import { decryptString, encryptString } from '@finance-os/powens'
import type {
  BinanceSpotCredentialPayload,
  ExternalInvestmentCredentialPayload,
  ExternalInvestmentMaskedCredential,
  IbkrFlexCredentialPayload,
} from './types'

const maskTail = (value: string, visible = 4) => {
  const trimmed = value.trim()
  if (trimmed.length <= visible) {
    return '*'.repeat(trimmed.length)
  }

  return `${'*'.repeat(Math.max(4, trimmed.length - visible))}${trimmed.slice(-visible)}`
}

const omitEmpty = <T extends Record<string, unknown>>(value: T) =>
  Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== null))

export const assertExternalInvestmentCredentialPayload = (
  payload: ExternalInvestmentCredentialPayload
) => {
  if (payload.provider === 'ibkr') {
    if (payload.kind !== 'ibkr_flex') {
      throw new Error('IBKR credentials must use ibkr_flex kind.')
    }
    if (!payload.flexToken.trim()) {
      throw new Error('IBKR Flex token is required.')
    }
    if (payload.queryIds.length === 0 || payload.queryIds.some(queryId => !queryId.trim())) {
      throw new Error('At least one IBKR Flex query id is required.')
    }
    return
  }

  if (payload.kind !== 'binance_spot') {
    throw new Error('Binance credentials must use binance_spot kind.')
  }
  if (!payload.apiKey.trim() || !payload.apiSecret.trim()) {
    throw new Error('Binance API key and secret are required.')
  }
  if (
    payload.permissionsMetadata?.tradingEnabled === true ||
    payload.permissionsMetadata?.withdrawEnabled === true
  ) {
    throw new Error('Binance key has unsafe trading or withdrawal permissions.')
  }
}

export const encryptExternalInvestmentCredential = (
  payload: ExternalInvestmentCredentialPayload,
  encryptionKey: string
) => {
  assertExternalInvestmentCredentialPayload(payload)
  return encryptString(JSON.stringify(payload), encryptionKey)
}

export const decryptExternalInvestmentCredential = (
  encryptedPayload: string,
  encryptionKey: string
): ExternalInvestmentCredentialPayload => {
  const decrypted = decryptString(encryptedPayload, encryptionKey)
  const parsed = JSON.parse(decrypted) as ExternalInvestmentCredentialPayload
  assertExternalInvestmentCredentialPayload(parsed)
  return parsed
}

const maskIbkrCredential = (payload: IbkrFlexCredentialPayload): ExternalInvestmentMaskedCredential => ({
  provider: 'ibkr',
  kind: 'ibkr_flex',
  accountAlias: payload.accountAlias ?? null,
  maskedSecretRefs: {
    flexToken: maskTail(payload.flexToken),
  },
  metadata: omitEmpty({
    queryCount: payload.queryIds.length,
    queryIds: payload.queryIds.map(queryId => maskTail(queryId, 3)),
    expectedAccountIds: payload.expectedAccountIds?.map(accountId => maskTail(accountId, 3)),
    baseUrl: payload.baseUrl,
    userAgentConfigured: Boolean(payload.userAgent),
  }),
  warnings: [],
})

const maskBinanceCredential = (
  payload: BinanceSpotCredentialPayload
): ExternalInvestmentMaskedCredential => {
  const warnings: string[] = []
  if (payload.permissionsMetadata?.tradingEnabled === true) {
    warnings.push('PROVIDER_PERMISSION_UNSAFE: trading permission is enabled and must be removed.')
  }
  if (payload.permissionsMetadata?.withdrawEnabled === true) {
    warnings.push('PROVIDER_PERMISSION_UNSAFE: withdrawal permission is enabled and must be removed.')
  }
  if (payload.permissionsMetadata?.ipRestricted === false) {
    warnings.push('Binance API key is not marked as IP restricted.')
  }

  return {
    provider: 'binance',
    kind: 'binance_spot',
    accountAlias: payload.accountAlias ?? null,
    maskedSecretRefs: {
      apiKey: maskTail(payload.apiKey),
      apiSecret: maskTail(payload.apiSecret),
    },
    metadata: omitEmpty({
      baseUrl: payload.baseUrl,
      permissionsMetadata: payload.permissionsMetadata,
      ipRestrictionNote: payload.ipRestrictionNote,
    }),
    warnings,
  }
}

export const maskExternalInvestmentCredential = (
  payload: ExternalInvestmentCredentialPayload
): ExternalInvestmentMaskedCredential =>
  payload.provider === 'ibkr' ? maskIbkrCredential(payload) : maskBinanceCredential(payload)
