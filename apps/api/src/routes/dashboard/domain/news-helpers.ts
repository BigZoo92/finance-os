import { createHash } from 'node:crypto'
import type { NewsDirection } from './news-types'
import type { NewsScoreLabel } from './news-taxonomy'

export const clampScore = (value: number, min = 0, max = 100) => {
  return Math.min(max, Math.max(min, Math.round(value)))
}

export const normalizeWhitespace = (value: string) => {
  return value.replace(/\s+/g, ' ').trim()
}

export const trimToLength = (value: string, maxLength: number) => {
  const normalized = normalizeWhitespace(value)
  if (normalized.length <= maxLength) {
    return normalized
  }

  return normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()
}

export const normalizeNewsTitle = (value: string) => {
  return normalizeWhitespace(
    value
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/\s+\|\s+.+$/, '')
      .replace(/\s+-\s+Reuters$/, '')
      .replace(/\s+-\s+Bloomberg$/, '')
      .replace(/\s+-\s+Financial Times$/, '')
  ).toLowerCase()
}

export const canonicalizeUrl = (value: string | null | undefined) => {
  if (!value) {
    return null
  }

  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null
    }

    url.hash = ''
    const removableParams = [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_term',
      'utm_content',
      'ref',
      'ref_src',
      'fbclid',
      'gclid',
      'mc_cid',
      'mc_eid',
      'guccounter',
      'guce_referrer',
      'guce_referrer_sig',
    ]
    for (const param of removableParams) {
      url.searchParams.delete(param)
    }

    const pathname = url.pathname.replace(/\/+$/, '') || '/'
    url.pathname = pathname
    const search = url.searchParams.toString()
    url.search = search.length > 0 ? `?${search}` : ''

    return url.toString()
  } catch {
    return null
  }
}

export const extractHostname = (value: string | null | undefined) => {
  if (!value) {
    return null
  }

  try {
    return new URL(value).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return null
  }
}

export const toStableHash = (value: string, length = 48) => {
  return createHash('sha256').update(value).digest('hex').slice(0, length)
}

export const uniqueStrings = (values: Array<string | null | undefined>) => {
  return Array.from(
    new Set(
      values
        .map(value => value?.trim())
        .filter((value): value is string => Boolean(value))
    )
  )
}

export const toScoreLabel = (score: number): NewsScoreLabel => {
  if (score >= 85) {
    return 'critical'
  }
  if (score >= 65) {
    return 'high'
  }
  if (score >= 35) {
    return 'medium'
  }
  return 'low'
}

export const inferDirection = (params: {
  riskFlags: string[]
  opportunityFlags: string[]
}): NewsDirection => {
  if (params.riskFlags.length > 0 && params.opportunityFlags.length > 0) {
    return 'mixed'
  }
  if (params.opportunityFlags.length > 0) {
    return 'opportunity'
  }
  return 'risk'
}

export const toIsoOrNull = (value: Date | null | undefined) => {
  if (!value) {
    return null
  }

  return Number.isNaN(value.getTime()) ? null : value.toISOString()
}

export const scoreRecency = (publishedAt: Date, now = new Date()) => {
  const ageHours = (now.getTime() - publishedAt.getTime()) / 3_600_000

  if (!Number.isFinite(ageHours) || ageHours < 0) {
    return 0
  }

  if (ageHours <= 6) {
    return 28
  }
  if (ageHours <= 24) {
    return 22
  }
  if (ageHours <= 72) {
    return 14
  }
  if (ageHours <= 168) {
    return 8
  }

  return 2
}
