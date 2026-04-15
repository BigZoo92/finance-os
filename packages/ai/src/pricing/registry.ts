import type {
  EstimatedModelUsage,
  ModelPricingEntry,
} from '../types'

const round = (value: number, digits = 6) => {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

export const AI_PRICING_REGISTRY_VERSION = '2026-04-14'

export const AI_PRICING_REGISTRY: ModelPricingEntry[] = [
  {
    provider: 'openai',
    model: 'gpt-5.4',
    pricingVersion: AI_PRICING_REGISTRY_VERSION,
    effectiveDate: '2026-04-14',
    sourceUrl: 'https://openai.com/api/pricing/',
    inputUsdPerMillion: 2.5,
    cachedInputUsdPerMillion: 0.25,
    outputUsdPerMillion: 15,
    batchInputUsdPerMillion: 1.25,
    batchOutputUsdPerMillion: 7.5,
  },
  {
    provider: 'openai',
    model: 'gpt-5.4-mini',
    pricingVersion: AI_PRICING_REGISTRY_VERSION,
    effectiveDate: '2026-04-14',
    sourceUrl: 'https://openai.com/api/pricing/',
    inputUsdPerMillion: 0.75,
    cachedInputUsdPerMillion: 0.075,
    outputUsdPerMillion: 4.5,
    batchInputUsdPerMillion: 0.375,
    batchOutputUsdPerMillion: 2.25,
  },
  {
    provider: 'openai',
    model: 'gpt-5.4-nano',
    pricingVersion: AI_PRICING_REGISTRY_VERSION,
    effectiveDate: '2026-04-14',
    sourceUrl: 'https://openai.com/api/pricing/',
    inputUsdPerMillion: 0.2,
    cachedInputUsdPerMillion: 0.02,
    outputUsdPerMillion: 1.25,
    batchInputUsdPerMillion: 0.1,
    batchOutputUsdPerMillion: 0.625,
  },
  {
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
    pricingVersion: AI_PRICING_REGISTRY_VERSION,
    effectiveDate: '2026-04-14',
    sourceUrl: 'https://platform.claude.com/docs/en/about-claude/pricing',
    inputUsdPerMillion: 3,
    cacheReadUsdPerMillion: 0.3,
    cacheWriteUsdPerMillion5m: 3.75,
    cacheWriteUsdPerMillion1h: 6,
    outputUsdPerMillion: 15,
    batchInputUsdPerMillion: 1.5,
    batchOutputUsdPerMillion: 7.5,
  },
  {
    provider: 'anthropic',
    model: 'claude-haiku-4-5',
    pricingVersion: AI_PRICING_REGISTRY_VERSION,
    effectiveDate: '2026-04-14',
    sourceUrl: 'https://platform.claude.com/docs/en/about-claude/pricing',
    inputUsdPerMillion: 1,
    cacheReadUsdPerMillion: 0.1,
    cacheWriteUsdPerMillion5m: 1.25,
    cacheWriteUsdPerMillion1h: 2,
    outputUsdPerMillion: 5,
    batchInputUsdPerMillion: 0.5,
    batchOutputUsdPerMillion: 2.5,
  },
]

export const getPricingEntry = (provider: string, model: string) => {
  return AI_PRICING_REGISTRY.find(
    entry => entry.provider === provider && entry.model === model
  )
}

export const estimateModelUsageCost = ({
  provider,
  model,
  feature,
  endpointType,
  status,
  inputTokens,
  outputTokens,
  cachedInputTokens = 0,
  cacheWriteTokens = 0,
  cacheDuration = null,
  batch = false,
  latencyMs,
  requestId,
  responseId,
  usdToEurRate,
  rawUsage,
}: {
  provider: string
  model: string
  feature: string
  endpointType: string
  status: EstimatedModelUsage['status']
  inputTokens: number
  outputTokens: number
  cachedInputTokens?: number
  cacheWriteTokens?: number
  cacheDuration?: '5m' | '1h' | null
  batch?: boolean
  latencyMs: number
  requestId?: string | null
  responseId?: string | null
  usdToEurRate: number
  rawUsage?: Record<string, unknown> | null
}): EstimatedModelUsage => {
  const pricing = getPricingEntry(provider, model)
  if (!pricing) {
    throw new Error(`Missing pricing entry for ${provider}:${model}`)
  }

  const effectiveInputPrice = batch
    ? pricing.batchInputUsdPerMillion ?? pricing.inputUsdPerMillion
    : pricing.inputUsdPerMillion
  const effectiveOutputPrice = batch
    ? pricing.batchOutputUsdPerMillion ?? pricing.outputUsdPerMillion
    : pricing.outputUsdPerMillion
  const effectiveCachedPrice =
    pricing.cachedInputUsdPerMillion ?? pricing.cacheReadUsdPerMillion ?? effectiveInputPrice
  const effectiveCacheWritePrice =
    cacheDuration === '1h'
      ? pricing.cacheWriteUsdPerMillion1h ?? effectiveInputPrice
      : pricing.cacheWriteUsdPerMillion5m ?? effectiveInputPrice

  const baseInputTokens = Math.max(inputTokens - cachedInputTokens - cacheWriteTokens, 0)
  const estimatedCostUsd =
    (baseInputTokens / 1_000_000) * effectiveInputPrice +
    (cachedInputTokens / 1_000_000) * effectiveCachedPrice +
    (cacheWriteTokens / 1_000_000) * effectiveCacheWritePrice +
    (outputTokens / 1_000_000) * effectiveOutputPrice

  return {
    provider: pricing.provider,
    model: pricing.model,
    feature,
    endpointType,
    status,
    inputTokens,
    outputTokens,
    cachedInputTokens,
    cacheWriteTokens,
    cacheDuration,
    batch,
    latencyMs,
    requestId: requestId ?? null,
    responseId: responseId ?? null,
    pricingVersion: pricing.pricingVersion,
    estimatedCostUsd: round(estimatedCostUsd),
    estimatedCostEur: round(estimatedCostUsd * usdToEurRate),
    usdToEurRate,
    rawUsage: rawUsage ?? null,
  }
}
