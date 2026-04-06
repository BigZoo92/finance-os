export type FailsoftDomain = 'alerts' | 'news' | 'insights'

export type FailsoftStatus = 'ok' | 'degraded' | 'unavailable'

export type FailsoftSource = 'live' | 'cache' | 'demo'

export interface FailsoftEnvelope {
  domain: FailsoftDomain
  status: FailsoftStatus
  source: FailsoftSource
  requestId: string
  reasonCode: string | null
  policy: {
    enabled: boolean
    sourceOrder: FailsoftSource[]
  }
  slo: {
    degradedRate: number
    hardFailRate: number
    staleAgeSeconds: number | null
  }
}

export interface FailsoftPolicyInput {
  mode: 'demo' | 'admin'
  requestId: string
  domain: FailsoftDomain
  staleAgeSeconds: number | null
  hasCacheData: boolean
  providerFailureRate: number
  cacheStale: boolean
  sourceOrder: FailsoftSource[]
  policyEnabled: boolean
  domainEnabled: boolean
}

export const DEFAULT_FAILSOFT_SOURCE_ORDER: FailsoftSource[] = ['live', 'cache', 'demo']

export const parseFailsoftSourceOrder = (value: string | undefined): FailsoftSource[] => {
  if (!value) {
    return DEFAULT_FAILSOFT_SOURCE_ORDER
  }

  const values = value
    .split(',')
    .map(entry => entry.trim().toLowerCase())
    .filter(Boolean)

  const uniqueOrdered = Array.from(new Set(values))
  const allowed = uniqueOrdered.filter(
    (entry): entry is FailsoftSource => entry === 'live' || entry === 'cache' || entry === 'demo'
  )

  if (allowed.length === 0) {
    return DEFAULT_FAILSOFT_SOURCE_ORDER
  }

  return allowed
}

export const buildFailsoftEnvelope = ({
  mode,
  requestId,
  domain,
  staleAgeSeconds,
  hasCacheData,
  providerFailureRate,
  cacheStale,
  sourceOrder,
  policyEnabled,
  domainEnabled,
}: FailsoftPolicyInput): FailsoftEnvelope => {
  if (mode === 'demo') {
    return {
      domain,
      status: 'ok',
      source: 'demo',
      requestId,
      reasonCode: null,
      policy: {
        enabled: true,
        sourceOrder: ['demo'],
      },
      slo: {
        degradedRate: 0,
        hardFailRate: 0,
        staleAgeSeconds: null,
      },
    }
  }

  if (!policyEnabled || !domainEnabled) {
    return {
      domain,
      status: 'ok',
      source: 'cache',
      requestId,
      reasonCode: null,
      policy: {
        enabled: false,
        sourceOrder,
      },
      slo: {
        degradedRate: 0,
        hardFailRate: 0,
        staleAgeSeconds,
      },
    }
  }

  if (!hasCacheData) {
    return {
      domain,
      status: 'unavailable',
      source: sourceOrder.includes('demo') ? 'demo' : 'cache',
      requestId,
      reasonCode: 'cache_empty',
      policy: {
        enabled: true,
        sourceOrder,
      },
      slo: {
        degradedRate: 0,
        hardFailRate: 1,
        staleAgeSeconds,
      },
    }
  }

  const degraded = cacheStale || providerFailureRate > 0
  return {
    domain,
    status: degraded ? 'degraded' : 'ok',
    source: 'cache',
    requestId,
    reasonCode: cacheStale ? 'cache_stale' : providerFailureRate > 0 ? 'provider_unavailable' : null,
    policy: {
      enabled: true,
      sourceOrder,
    },
    slo: {
      degradedRate: degraded ? 1 : 0,
      hardFailRate: 0,
      staleAgeSeconds,
    },
  }
}
