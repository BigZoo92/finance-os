import { createHash } from 'node:crypto'

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return Object.prototype.toString.call(value) === '[object Object]'
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

const normalizeTransactionText = (value: string) => {
  return value.normalize('NFKC').replace(/\s+/g, ' ').trim()
}

const normalizeTransactionToken = (value: unknown) => {
  const parsed = toStringValue(value)
  if (!parsed) {
    return null
  }

  const normalized = normalizeTransactionText(parsed)
  return normalized.length > 0 ? normalized : null
}

const sanitizeMetadataText = (value: unknown) => {
  const parsed = toStringValue(value)
  if (!parsed) {
    return null
  }

  const normalized = parsed.normalize('NFKC').replace(/\s+/g, ' ').trim()
  return normalized.length > 0 ? normalized : null
}

const readMetadataValue = (
  raw: Record<string, unknown>,
  candidates: readonly string[]
): string | null => {
  for (const key of candidates) {
    const candidate = sanitizeMetadataText(raw[key])
    if (candidate) {
      return candidate
    }
  }

  return null
}

const parseProviderObjectAt = (value: unknown) => {
  const raw = toStringValue(value)
  if (!raw) {
    return null
  }

  const isoCandidate = raw.length === 10 ? `${raw}T00:00:00.000Z` : raw
  const parsed = new Date(isoCandidate)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const MERCHANT_PREFIX_PATTERNS = [
  /^paiement(?:\s+par)?(?:\s+carte)?\s+/i,
  /^carte\s+/i,
  /^cb\s+/i,
  /^prelevement(?:\s+sepa)?\s+/i,
  /^prlv(?:\s+sepa)?\s+/i,
  /^virement(?:\s+sepa)?\s+/i,
  /^vir(?:\s+sepa)?\s+/i,
  /^retrait(?:\s+dab)?\s+/i,
]

const cleanDerivedMerchant = (value: string) => {
  let normalized = normalizeTransactionText(value)

  for (const pattern of MERCHANT_PREFIX_PATTERNS) {
    normalized = normalized.replace(pattern, '')
  }

  normalized = normalized.replace(/^[^0-9\p{L}]+|[^0-9\p{L}]+$/gu, '').trim()

  return normalized.length > 0 ? normalized : null
}

const normalizeLabel = (label: string) => {
  return label.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase()
}

export const createDerivedTransactionLabelHash = (label: string) => {
  return createHash('sha256').update(normalizeLabel(label), 'utf8').digest('hex')
}

export const derivePowensAccountBalance = (raw: unknown) => {
  if (!isPlainObject(raw)) {
    return null
  }

  const candidates = ['balance', 'current_balance', 'available_balance']

  for (const key of candidates) {
    const candidate = raw[key]

    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return candidate.toFixed(2)
    }

    if (typeof candidate === 'string') {
      const parsed = Number(candidate)
      if (Number.isFinite(parsed)) {
        return parsed.toFixed(2)
      }
    }

    if (isPlainObject(candidate) && 'value' in candidate) {
      const nestedValue = (candidate as { value?: string | number }).value

      if (typeof nestedValue === 'number' && Number.isFinite(nestedValue)) {
        return nestedValue.toFixed(2)
      }

      if (typeof nestedValue === 'string') {
        const parsed = Number(nestedValue)
        if (Number.isFinite(parsed)) {
          return parsed.toFixed(2)
        }
      }
    }
  }

  return null
}

export interface DerivedPowensAccountMetadata extends Record<string, unknown> {
  accountNumber?: string
  ownership?: string
  usage?: string
  ownerName?: string
  originalName?: string
}

export const derivePowensAccountMetadata = (raw: unknown): DerivedPowensAccountMetadata | null => {
  if (!isPlainObject(raw)) {
    return null
  }

  const metadata: DerivedPowensAccountMetadata = {}

  const accountNumber = readMetadataValue(raw, ['number', 'account_number'])
  if (accountNumber) {
    metadata.accountNumber = accountNumber
  }

  const ownership = readMetadataValue(raw, ['ownership'])
  if (ownership) {
    metadata.ownership = ownership
  }

  const usage = readMetadataValue(raw, ['usage'])
  if (usage) {
    metadata.usage = usage
  }

  const ownerName = readMetadataValue(raw, ['owner_name', 'owner'])
  if (ownerName) {
    metadata.ownerName = ownerName
  }

  const originalName = readMetadataValue(raw, ['original_name'])
  if (originalName) {
    metadata.originalName = originalName
  }

  return Object.keys(metadata).length > 0 ? metadata : null
}

export const derivePowensTransactionCategory = (raw: unknown) => {
  if (!isPlainObject(raw)) {
    return 'Unknown'
  }

  const category = toStringValue(raw.category) ?? toStringValue(raw.category_name)
  return category ?? 'Unknown'
}

export const derivePowensTransactionLabel = (raw: unknown) => {
  if (!isPlainObject(raw)) {
    return 'Transaction'
  }

  const candidates = [
    raw.label,
    raw.wording,
    typeof raw.raw === 'string' ? raw.raw : null,
    raw.original_wording,
  ]

  for (const candidate of candidates) {
    const normalized = normalizeTransactionToken(candidate)
    if (normalized) {
      return normalized
    }
  }

  return 'Transaction'
}

export const derivePowensTransactionMerchant = (raw: unknown, fallbackLabel: string) => {
  if (!isPlainObject(raw)) {
    return fallbackLabel
  }

  const candidates = [raw.merchant, raw.original_wording, raw.wording, raw.label, fallbackLabel]

  for (const candidate of candidates) {
    const normalized = normalizeTransactionToken(candidate)
    if (!normalized) {
      continue
    }

    const cleaned = cleanDerivedMerchant(normalized)
    if (cleaned) {
      return cleaned
    }
  }

  return fallbackLabel
}

export const derivePowensTransactionProviderObjectAt = (raw: unknown) => {
  if (!isPlainObject(raw)) {
    return null
  }

  return parseProviderObjectAt(raw.date ?? raw.rdate)
}

export const derivePowensTransactionExternalId = (raw: unknown) => {
  if (!isPlainObject(raw)) {
    return null
  }

  return toStringValue(raw.id)
}

export const parsePowensTransactionBookingDate = (raw: unknown) => {
  if (!isPlainObject(raw)) {
    return null
  }

  const rawDate = raw.date ?? raw.rdate
  if (typeof rawDate !== 'string' || rawDate.length < 10) {
    return null
  }

  const datePart = rawDate.slice(0, 10)
  const parsed = new Date(`${datePart}T00:00:00Z`)

  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed.toISOString().slice(0, 10)
}

export const parsePowensTransactionAmount = (raw: unknown) => {
  if (!isPlainObject(raw)) {
    return null
  }

  const candidates = [raw.amount, raw.value, raw.gross_value]

  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return candidate.toFixed(2)
    }

    if (typeof candidate !== 'string' || candidate.trim().length === 0) {
      continue
    }

    const parsed = Number(candidate)
    if (Number.isFinite(parsed)) {
      return parsed.toFixed(2)
    }
  }

  return null
}

export interface DerivedPowensTransactionFields {
  bookingDate: string
  amount: string
  label: string
  labelHash: string
  category: string
  merchant: string
  providerObjectAt: Date | null
}

export const derivePowensTransactionFields = (
  raw: unknown
): DerivedPowensTransactionFields | null => {
  const bookingDate = parsePowensTransactionBookingDate(raw)
  const amount = parsePowensTransactionAmount(raw)

  if (!bookingDate || !amount) {
    return null
  }

  const label = derivePowensTransactionLabel(raw)

  return {
    bookingDate,
    amount,
    label,
    labelHash: createDerivedTransactionLabelHash(label),
    category: derivePowensTransactionCategory(raw),
    merchant: derivePowensTransactionMerchant(raw, label),
    providerObjectAt: derivePowensTransactionProviderObjectAt(raw),
  }
}
