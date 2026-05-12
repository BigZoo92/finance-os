// Macro Prompt 5 — Snapshot builder for /dashboard/data-quality.
//
// Maps existing local repository rows (already-stripped at the SELECT layer)
// into the closed-vocab `DataQualityDimensionInput` array consumed by the
// pure compute helper. NO live provider calls. NO LLM. NO graph calls. NO
// raw payload exposure. Strictly read-only over already-cached state.

import type { ProviderDiagnosticsResponse } from '@finance-os/provider-runtime'
import type {
  DataQualityDimensionInput,
  DataQualityDimensionInputStatus,
} from './data-quality-types'

const toIso = (value: Date | null | undefined): string | null =>
  value ? value.toISOString() : null

export interface BankingSnapshotInput {
  readonly powensConfigured: boolean
  readonly connections: ReadonlyArray<{
    readonly status: 'connected' | 'syncing' | 'error' | 'reconnect_required' | string
    readonly lastSuccessAt: Date | null
    readonly lastFailedAt: Date | null
    readonly lastSyncStatus: 'OK' | 'KO' | null | string
  }>
}

export interface ExternalInvestmentsHealthRow {
  readonly provider: 'ibkr' | 'binance' | string
  readonly enabled: boolean
  readonly status: 'healthy' | 'degraded' | 'failing' | 'idle' | string
  readonly lastSuccessAt: string | null
  readonly lastFailureAt: string | null
}

export interface ExternalInvestmentsConnectionRow {
  readonly provider: 'ibkr' | 'binance' | string
  readonly credentialStatus: 'configured' | 'disabled' | string
  readonly lastSuccessAt: string | null
  readonly lastFailedAt: string | null
}

export interface MarketCacheStateInput {
  readonly lastSuccessAt: Date | null
  readonly lastFailureAt: Date | null
}

export interface NewsCacheStateInput {
  readonly lastSuccessAt: Date | null
  readonly lastFailureAt: Date | null
}

export interface EvalRunInput {
  readonly status: string
  readonly createdAt: string
  readonly totalCases: number
  readonly passedCases: number
  readonly failedCases: number
}

export interface PostMortemSummaryInput {
  readonly latestEvaluatedAt: string | null
  readonly status: string
}

export interface DataQualityStaleThresholds {
  readonly bankingMinutes: number
  readonly investmentsMinutes: number
  readonly cryptoMinutes: number
  readonly marketDataMinutes: number
  readonly newsMinutes: number
  readonly advisorMemoryMinutes: number
  readonly evalsMinutes: number
  readonly postMortemsMinutes: number
}

export const DEFAULT_DATA_QUALITY_STALE_THRESHOLDS: DataQualityStaleThresholds = {
  bankingMinutes: 1440, // 24h
  investmentsMinutes: 1440,
  cryptoMinutes: 1440,
  marketDataMinutes: 60,
  newsMinutes: 360, // 6h
  advisorMemoryMinutes: 10080, // 7d
  evalsMinutes: 43200, // 30d
  postMortemsMinutes: 86400, // 60d
}

export interface BuildDataQualitySnapshotInput {
  readonly providerDiagnostics: ProviderDiagnosticsResponse
  readonly banking: BankingSnapshotInput
  readonly externalInvestments: {
    readonly enabled: boolean
    readonly safeMode: boolean
    readonly ibkrEnabledByFlag: boolean
    readonly binanceEnabledByFlag: boolean
    readonly health: ReadonlyArray<ExternalInvestmentsHealthRow>
    readonly connections: ReadonlyArray<ExternalInvestmentsConnectionRow>
  }
  readonly marketData: {
    readonly featureEnabled: boolean
    readonly cacheState: MarketCacheStateInput | null
  }
  readonly news: {
    readonly liveIngestionEnabled: boolean
    readonly cacheState: NewsCacheStateInput | null
  }
  readonly advisorMemory: {
    readonly knowledgeServiceEnabled: boolean
  }
  readonly evals: {
    readonly latestRun: EvalRunInput | null
  }
  readonly postMortems: {
    readonly enabled: boolean
    readonly latest: PostMortemSummaryInput | null
  }
  readonly thresholds?: DataQualityStaleThresholds
}

const buildBankingDimension = (
  input: BankingSnapshotInput,
  staleAfterMinutes: number
): DataQualityDimensionInput => {
  if (!input.powensConfigured) {
    return {
      key: 'banking',
      status: 'unconfigured',
      lastSuccessAt: null,
      lastFailureAt: null,
      providers: ['powens'],
      staleAfterMinutes,
    }
  }
  if (input.connections.length === 0) {
    return {
      key: 'banking',
      status: 'missing',
      lastSuccessAt: null,
      lastFailureAt: null,
      providers: ['powens'],
      staleAfterMinutes,
    }
  }

  let lastSuccessMs: number | null = null
  let lastFailureMs: number | null = null
  let errorCount = 0
  let reconnectCount = 0
  let okCount = 0

  for (const connection of input.connections) {
    if (connection.lastSuccessAt) {
      const ms = connection.lastSuccessAt.getTime()
      if (lastSuccessMs === null || ms > lastSuccessMs) lastSuccessMs = ms
    }
    if (connection.lastFailedAt) {
      const ms = connection.lastFailedAt.getTime()
      if (lastFailureMs === null || ms > lastFailureMs) lastFailureMs = ms
    }
    if (connection.status === 'error') errorCount += 1
    if (connection.status === 'reconnect_required') reconnectCount += 1
    if (connection.lastSyncStatus === 'OK') okCount += 1
  }

  let status: DataQualityDimensionInputStatus
  if (errorCount === input.connections.length && lastSuccessMs === null) {
    status = 'down'
  } else if (reconnectCount > 0 || errorCount > 0) {
    status = 'degraded'
  } else if (okCount > 0 || lastSuccessMs !== null) {
    status = 'ok'
  } else {
    status = 'missing'
  }

  return {
    key: 'banking',
    status,
    lastSuccessAt: lastSuccessMs !== null ? new Date(lastSuccessMs).toISOString() : null,
    lastFailureAt: lastFailureMs !== null ? new Date(lastFailureMs).toISOString() : null,
    providers: ['powens'],
    staleAfterMinutes,
  }
}

const buildExternalInvestmentsDimension = (
  key: 'investments' | 'crypto',
  providerId: 'ibkr' | 'binance',
  input: BuildDataQualitySnapshotInput['externalInvestments'],
  enabledByFlag: boolean,
  staleAfterMinutes: number
): DataQualityDimensionInput => {
  if (!input.enabled) {
    return {
      key,
      status: 'disabled_by_flag',
      lastSuccessAt: null,
      lastFailureAt: null,
      providers: [providerId],
      staleAfterMinutes,
      extraReasons: ['external investments feature disabled'],
    }
  }
  if (!enabledByFlag) {
    return {
      key,
      status: 'disabled_by_flag',
      lastSuccessAt: null,
      lastFailureAt: null,
      providers: [providerId],
      staleAfterMinutes,
    }
  }
  const connection = input.connections.find(c => c.provider === providerId) ?? null
  const health = input.health.find(h => h.provider === providerId) ?? null
  if (!connection || connection.credentialStatus !== 'configured') {
    return {
      key,
      status: 'unconfigured',
      lastSuccessAt: health?.lastSuccessAt ?? null,
      lastFailureAt: health?.lastFailureAt ?? null,
      providers: [providerId],
      staleAfterMinutes,
    }
  }
  if (!health) {
    return {
      key,
      status: 'missing',
      lastSuccessAt: null,
      lastFailureAt: null,
      providers: [providerId],
      staleAfterMinutes,
    }
  }
  let status: DataQualityDimensionInputStatus
  switch (health.status) {
    case 'healthy':
      status = 'ok'
      break
    case 'degraded':
      status = 'degraded'
      break
    case 'failing':
      status = 'down'
      break
    case 'idle':
      status = 'missing'
      break
    default:
      status = 'unknown'
  }
  return {
    key,
    status,
    lastSuccessAt: health.lastSuccessAt,
    lastFailureAt: health.lastFailureAt,
    providers: [providerId],
    staleAfterMinutes,
    ...(input.safeMode ? { extraReasons: ['safe mode active'] } : {}),
  }
}

const buildCacheStateDimension = (
  key: 'market_data' | 'news',
  providers: ReadonlyArray<string>,
  cacheState: { lastSuccessAt: Date | null; lastFailureAt: Date | null } | null,
  featureEnabled: boolean,
  staleAfterMinutes: number
): DataQualityDimensionInput => {
  if (!featureEnabled) {
    return {
      key,
      status: 'disabled_by_flag',
      lastSuccessAt: null,
      lastFailureAt: null,
      providers,
      staleAfterMinutes,
    }
  }
  if (!cacheState || (cacheState.lastSuccessAt === null && cacheState.lastFailureAt === null)) {
    return {
      key,
      status: 'missing',
      lastSuccessAt: null,
      lastFailureAt: null,
      providers,
      staleAfterMinutes,
    }
  }
  let status: DataQualityDimensionInputStatus
  if (cacheState.lastSuccessAt === null) {
    status = 'down'
  } else if (
    cacheState.lastFailureAt !== null &&
    cacheState.lastSuccessAt !== null &&
    cacheState.lastFailureAt.getTime() > cacheState.lastSuccessAt.getTime()
  ) {
    status = 'degraded'
  } else {
    status = 'ok'
  }
  return {
    key,
    status,
    lastSuccessAt: toIso(cacheState.lastSuccessAt),
    lastFailureAt: toIso(cacheState.lastFailureAt),
    providers,
    staleAfterMinutes,
  }
}

const buildAdvisorMemoryDimension = (
  input: BuildDataQualitySnapshotInput,
  staleAfterMinutes: number
): DataQualityDimensionInput => {
  if (!input.advisorMemory.knowledgeServiceEnabled) {
    return {
      key: 'advisor_memory',
      status: 'disabled_by_flag',
      lastSuccessAt: null,
      lastFailureAt: null,
      providers: ['knowledge-service'],
      staleAfterMinutes,
    }
  }
  const knowledge = input.providerDiagnostics.providers.find(
    p => p.providerId === 'knowledge-service'
  )
  if (!knowledge) {
    return {
      key: 'advisor_memory',
      status: 'missing',
      lastSuccessAt: null,
      lastFailureAt: null,
      providers: ['knowledge-service'],
      staleAfterMinutes,
    }
  }
  let status: DataQualityDimensionInputStatus
  switch (knowledge.status) {
    case 'ok':
      status = 'ok'
      break
    case 'degraded':
      status = 'degraded'
      break
    case 'down':
      status = 'down'
      break
    case 'disabled':
      status = 'disabled_by_flag'
      break
    default:
      status = 'unknown'
  }
  return {
    key: 'advisor_memory',
    status,
    lastSuccessAt: knowledge.lastCheckedAt,
    lastFailureAt: null,
    providers: ['knowledge-service'],
    staleAfterMinutes,
  }
}

const buildEvalsDimension = (
  input: BuildDataQualitySnapshotInput['evals'],
  staleAfterMinutes: number
): DataQualityDimensionInput => {
  if (!input.latestRun) {
    return {
      key: 'evals',
      status: 'missing',
      lastSuccessAt: null,
      lastFailureAt: null,
      providers: [],
      staleAfterMinutes,
    }
  }
  const { status: runStatus, createdAt, failedCases, totalCases } = input.latestRun
  let status: DataQualityDimensionInputStatus
  if (runStatus === 'completed' && failedCases === 0 && totalCases > 0) {
    status = 'ok'
  } else if (runStatus === 'completed') {
    status = 'degraded'
  } else if (runStatus === 'failed') {
    status = 'down'
  } else if (runStatus === 'degraded') {
    status = 'degraded'
  } else if (runStatus === 'skipped') {
    status = 'unknown'
  } else {
    status = 'unknown'
  }
  return {
    key: 'evals',
    status,
    lastSuccessAt: createdAt,
    lastFailureAt: null,
    providers: [],
    staleAfterMinutes,
  }
}

const buildPostMortemsDimension = (
  input: BuildDataQualitySnapshotInput['postMortems'],
  staleAfterMinutes: number
): DataQualityDimensionInput => {
  if (!input.enabled) {
    return {
      key: 'post_mortems',
      status: 'disabled_by_flag',
      lastSuccessAt: null,
      lastFailureAt: null,
      providers: [],
      staleAfterMinutes,
    }
  }
  if (!input.latest || input.latest.latestEvaluatedAt === null) {
    return {
      key: 'post_mortems',
      status: 'missing',
      lastSuccessAt: null,
      lastFailureAt: null,
      providers: [],
      staleAfterMinutes,
    }
  }
  let status: DataQualityDimensionInputStatus
  switch (input.latest.status) {
    case 'completed':
      status = 'ok'
      break
    case 'pending':
      status = 'degraded'
      break
    case 'failed':
      status = 'down'
      break
    case 'skipped':
      status = 'unknown'
      break
    default:
      status = 'unknown'
  }
  return {
    key: 'post_mortems',
    status,
    lastSuccessAt: input.latest.latestEvaluatedAt,
    lastFailureAt: null,
    providers: [],
    staleAfterMinutes,
  }
}

export const buildDataQualityDimensions = (
  input: BuildDataQualitySnapshotInput
): ReadonlyArray<DataQualityDimensionInput> => {
  const thresholds = input.thresholds ?? DEFAULT_DATA_QUALITY_STALE_THRESHOLDS
  return [
    buildBankingDimension(input.banking, thresholds.bankingMinutes),
    buildExternalInvestmentsDimension(
      'investments',
      'ibkr',
      input.externalInvestments,
      input.externalInvestments.ibkrEnabledByFlag,
      thresholds.investmentsMinutes
    ),
    buildExternalInvestmentsDimension(
      'crypto',
      'binance',
      input.externalInvestments,
      input.externalInvestments.binanceEnabledByFlag,
      thresholds.cryptoMinutes
    ),
    buildCacheStateDimension(
      'market_data',
      ['eodhd', 'fred', 'twelve_data'],
      input.marketData.cacheState,
      input.marketData.featureEnabled,
      thresholds.marketDataMinutes
    ),
    buildCacheStateDimension(
      'news',
      ['news-service'],
      input.news.cacheState,
      input.news.liveIngestionEnabled,
      thresholds.newsMinutes
    ),
    buildAdvisorMemoryDimension(input, thresholds.advisorMemoryMinutes),
    buildEvalsDimension(input.evals, thresholds.evalsMinutes),
    buildPostMortemsDimension(input.postMortems, thresholds.postMortemsMinutes),
  ]
}
