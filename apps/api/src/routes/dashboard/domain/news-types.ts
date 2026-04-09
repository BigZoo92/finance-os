import type {
  NewsContextBundleRange,
  NewsDomainId,
  NewsEventType,
  NewsOpportunityFlag,
  NewsProviderId,
  NewsRiskFlag,
  NewsScoreLabel,
  NewsSourceType,
} from './news-taxonomy'

export type NewsDirection = 'risk' | 'opportunity' | 'mixed'

export type NewsGeoScope = 'global' | 'regional' | 'country' | 'company' | 'market' | 'sector'

export type NewsMetadataFetchStatus = 'not_requested' | 'pending' | 'fetched' | 'failed' | 'skipped'

export type NewsProviderRunStatus = 'success' | 'failed' | 'skipped'

export interface NewsAffectedEntity {
  name: string
  type:
    | 'company'
    | 'institution'
    | 'country'
    | 'currency'
    | 'commodity'
    | 'sector'
    | 'technology'
    | 'regulator'
    | 'person'
    | 'theme'
  role: 'primary' | 'affected' | 'reference'
  confidence: number
}

export interface NewsTransmissionHypothesis {
  id: string
  label: string
  direction: NewsDirection
  confidence: number
}

export interface NewsLinkRef {
  label: string
  url: string
}

export interface NewsMetadataCard {
  title: string
  description: string | null
  canonicalUrl: string | null
  imageUrl: string | null
  siteName: string | null
  displayUrl: string
  faviconUrl: string | null
  publishedAt: string | null
  author: string | null
  articleType: string | null
}

export interface NewsProviderRawItem {
  provider: NewsProviderId
  providerArticleId: string
  providerUrl: string | null
  canonicalUrl: string | null
  sourceName: string
  sourceDomain: string | null
  sourceType: NewsSourceType
  title: string
  summary: string | null
  contentSnippet: string | null
  language: string
  country: string | null
  region: string | null
  geoScope: NewsGeoScope
  publishedAt: Date
  metadata: Record<string, unknown> | null
  rawPayload: Record<string, unknown> | null
}

export interface NormalizedNewsSignalDraft {
  provider: NewsProviderId
  providerArticleId: string
  providerUrl: string | null
  canonicalUrl: string | null
  sourceName: string
  sourceDomain: string | null
  sourceType: NewsSourceType
  title: string
  normalizedTitle: string
  summary: string | null
  contentSnippet: string | null
  topic: string
  language: string
  country: string | null
  region: string | null
  geoScope: NewsGeoScope
  domains: NewsDomainId[]
  categories: string[]
  subcategories: string[]
  eventType: NewsEventType
  severity: number
  confidence: number
  novelty: number
  marketImpactScore: number
  relevanceScore: number
  riskFlags: NewsRiskFlag[]
  opportunityFlags: NewsOpportunityFlag[]
  affectedEntities: NewsAffectedEntity[]
  affectedTickers: string[]
  affectedSectors: string[]
  affectedThemes: string[]
  transmissionHypotheses: NewsTransmissionHypothesis[]
  macroLinks: NewsLinkRef[]
  policyLinks: NewsLinkRef[]
  filingLinks: NewsLinkRef[]
  whyItMatters: string[]
  scoringReasons: string[]
  dedupeKey: string
  clusteringKey: string
  eventClusterId: string
  canonicalUrlFingerprint: string | null
  publishedAt: Date
  metadata: Record<string, unknown> | null
  rawProviderPayload: Record<string, unknown> | null
}

export interface NewsSourceReferenceDraft {
  provider: NewsProviderId
  providerArticleId: string
  providerUrl: string | null
  canonicalUrl: string | null
  sourceName: string
  sourceDomain: string | null
  sourceType: NewsSourceType
  title: string
  normalizedTitle: string
  language: string
  publishedAt: Date
  metadata: Record<string, unknown> | null
  rawProviderPayload: Record<string, unknown> | null
  dedupeEvidence: Record<string, unknown> | null
}

export interface NewsPersistableSignalDraft extends NormalizedNewsSignalDraft {
  metadataFetchStatus: NewsMetadataFetchStatus
  metadataCard: NewsMetadataCard | null
  metadataFetchedAt: Date | null
  firstSeenAt: Date
  ingestedAt: Date
  lastEnrichedAt: Date
  provenance: {
    sourceCount: number
    providerCount: number
    providers: NewsProviderId[]
    sourceDomains: string[]
    primaryReason: string | null
  }
  sourceRefs: NewsSourceReferenceDraft[]
}

export interface NewsProviderRunResult {
  provider: NewsProviderId
  status: NewsProviderRunStatus
  fetchedCount: number
  insertedCount: number
  mergedCount: number
  dedupeDropCount: number
  durationMs: number
  requestId: string
  errorCode: string | null
  errorMessage: string | null
  cooldownUntil: Date | null
}

export interface NewsProviderHealth {
  provider: NewsProviderId
  label: string
  enabled: boolean
  status: 'healthy' | 'degraded' | 'failing' | 'idle'
  lastSuccessAt: string | null
  lastAttemptAt: string | null
  lastFailureAt: string | null
  lastErrorCode: string | null
  lastErrorMessage: string | null
  successCount: number
  failureCount: number
  skippedCount: number
  lastFetchedCount: number
  lastInsertedCount: number
  lastMergedCount: number
  cooldownUntil: string | null
}

export interface NewsContextBundleSignal {
  id: string
  title: string
  publishedAt: string
  eventType: NewsEventType
  direction: NewsDirection
  severity: number
  confidence: number
  novelty: number
  marketImpactScore: number
  relevanceScore: number
  sourceCount: number
  providerCount: number
  affectedEntities: string[]
  affectedSectors: string[]
  affectedTickers: string[]
  whyItMatters: string[]
  supportingUrls: string[]
}

export interface NewsContextBundleCluster {
  clusterId: string
  title: string
  eventType: NewsEventType
  direction: NewsDirection
  signalCount: number
  sourceCount: number
  latestPublishedAt: string
  topDomains: string[]
  topSectors: string[]
  headlineIds: string[]
}

export interface NewsContextBundle {
  range: NewsContextBundleRange
  generatedAt: string
  freshness: {
    lastUpdatedAt: string | null
    staleCache: boolean
    providerFailureRate: number
    requestId: string
  }
  topSignals: NewsContextBundleSignal[]
  clusteredEvents: NewsContextBundleCluster[]
  mostImpactedSectors: Array<{ sector: string; score: number }>
  mostImpactedEntities: Array<{ entity: string; score: number }>
  regulatorHighlights: NewsContextBundleSignal[]
  centralBankHighlights: NewsContextBundleSignal[]
  filingsHighlights: NewsContextBundleSignal[]
  thematicHighlights: {
    ai: NewsContextBundleSignal[]
    cyber: NewsContextBundleSignal[]
    geopolitics: NewsContextBundleSignal[]
    macro: NewsContextBundleSignal[]
  }
  contradictorySignals: Array<{
    topic: string
    bullishCount: number
    bearishCount: number
    signalIds: string[]
  }>
  causalHypotheses: string[]
  references: Array<{
    id: string
    title: string
    url: string
    sourceName: string
    publishedAt: string
  }>
}

export interface DashboardNewsFilters {
  topic?: string
  sourceName?: string
  sourceType?: NewsSourceType | string
  domain?: NewsDomainId | string
  eventType?: NewsEventType | string
  minSeverity?: number
  region?: string
  ticker?: string
  sector?: string
  direction?: NewsDirection
  from?: string
  to?: string
  limit: number
}

export interface DashboardNewsSignalCard {
  id: string
  title: string
  summary: string | null
  contentSnippet: string | null
  url: string
  canonicalUrl: string | null
  sourceName: string
  sourceDomain: string | null
  sourceType: NewsSourceType
  topic: string
  language: string
  publishedAt: string
  domains: NewsDomainId[]
  categories: string[]
  subcategories: string[]
  eventType: NewsEventType
  severity: number
  severityLabel: NewsScoreLabel
  confidence: number
  novelty: number
  marketImpactScore: number
  relevanceScore: number
  direction: NewsDirection
  riskFlags: NewsRiskFlag[]
  opportunityFlags: NewsOpportunityFlag[]
  affectedEntities: NewsAffectedEntity[]
  affectedTickers: string[]
  affectedSectors: string[]
  affectedThemes: string[]
  transmissionHypotheses: NewsTransmissionHypothesis[]
  whyItMatters: string[]
  scoringReasons: string[]
  metadataCard: NewsMetadataCard | null
  metadataFetchStatus: NewsMetadataFetchStatus
  eventClusterId: string
  provenance: {
    sourceCount: number
    providerCount: number
    providers: NewsProviderId[]
    sourceDomains: string[]
  }
  sources: Array<{
    provider: NewsProviderId
    providerArticleId: string
    sourceName: string
    sourceDomain: string | null
    sourceType: NewsSourceType
    publishedAt: string
    providerUrl: string | null
  }>
}
