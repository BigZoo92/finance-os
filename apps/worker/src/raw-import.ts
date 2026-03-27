import { createHash } from 'node:crypto'
import {
  derivePowensAccountBalance,
  derivePowensAccountMetadata,
  derivePowensTransactionCategory,
  derivePowensTransactionFields,
  derivePowensTransactionLabel,
  derivePowensTransactionMerchant,
  derivePowensTransactionProviderObjectAt,
} from '@finance-os/powens'
import { schema } from '@finance-os/db'

const SENSITIVE_PAYLOAD_KEYS = new Set([
  'access_token',
  'refresh_token',
  'authorization',
  'authorization_code',
  'client_secret',
  'secret',
  'token',
  'code',
])

export type RawImportObjectType = 'account' | 'transaction'
export type RawImportStatus = 'failed' | 'imported' | 'normalized'
export type ProviderRawImportInsert = typeof schema.providerRawImport.$inferInsert

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return Object.prototype.toString.call(value) === '[object Object]'
}

export const sanitizeProviderPayload = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(entry => sanitizeProviderPayload(entry))
  }

  if (isPlainObject(value)) {
    const sanitized: Record<string, unknown> = {}

    for (const [key, nestedValue] of Object.entries(value)) {
      if (SENSITIVE_PAYLOAD_KEYS.has(key.toLowerCase())) {
        continue
      }

      sanitized[key] = sanitizeProviderPayload(nestedValue)
    }

    return sanitized
  }

  return value
}

const stableSerialize = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map(entry => stableSerialize(entry)).join(',')}]`
  }

  if (isPlainObject(value)) {
    return `{${Object.keys(value)
      .sort((left, right) => left.localeCompare(right))
      .map(key => `${JSON.stringify(key)}:${stableSerialize(value[key])}`)
      .join(',')}}`
  }

  return JSON.stringify(value)
}

const buildPayloadChecksum = (payload: unknown) => {
  return createHash('sha256').update(stableSerialize(payload), 'utf8').digest('hex')
}

const toStringValue = (value: unknown) => {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  }

  if (typeof value === 'number' || typeof value === 'bigint') {
    return String(value)
  }

  return null
}

const buildFallbackExternalObjectId = (payload: unknown) => {
  return `sha256:${buildPayloadChecksum(payload)}`
}

export const buildProviderRawImportRow = (params: {
  source: string
  provider: string
  providerConnectionId: string
  objectType: RawImportObjectType
  externalObjectId?: string | null
  parentExternalObjectId?: string | null
  importStatus: RawImportStatus
  payload: unknown
  providerObjectAt?: Date | null
  requestId?: string
  importedAt: Date
  lastSeenAt: Date
}): ProviderRawImportInsert => {
  const sanitizedPayload = sanitizeProviderPayload(params.payload)
  const payloadChecksum = buildPayloadChecksum(sanitizedPayload)

  return {
    source: params.source,
    provider: params.provider,
    providerConnectionId: params.providerConnectionId,
    objectType: params.objectType,
    externalObjectId:
      params.externalObjectId && params.externalObjectId.length > 0
        ? params.externalObjectId
        : buildFallbackExternalObjectId(sanitizedPayload),
    parentExternalObjectId: params.parentExternalObjectId ?? null,
    importStatus: params.importStatus,
    providerObjectAt: params.providerObjectAt ?? null,
    importedAt: params.importedAt,
    lastSeenAt: params.lastSeenAt,
    payload: sanitizedPayload as Record<string, unknown>,
    payloadChecksum,
    ...(params.requestId ? { requestId: params.requestId } : {}),
  }
}

export const deriveAccountBalance = derivePowensAccountBalance
export const deriveAccountMetadata = derivePowensAccountMetadata
export const deriveTransactionCategory = derivePowensTransactionCategory
export const deriveTransactionLabel = derivePowensTransactionLabel
export const deriveTransactionMerchant = derivePowensTransactionMerchant
export const deriveTransactionProviderObjectAt = derivePowensTransactionProviderObjectAt
export { derivePowensTransactionFields }
