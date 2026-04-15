import { describe, expect, it } from 'bun:test'
import {
  AI_PRICING_REGISTRY_VERSION,
  estimateModelUsageCost,
  getPricingEntry,
} from './registry'

describe('AI pricing registry', () => {
  it('exposes versioned entries for configured models', () => {
    const entry = getPricingEntry('openai', 'gpt-5.4-mini')

    expect(entry).not.toBeUndefined()
    expect(entry?.pricingVersion).toBe(AI_PRICING_REGISTRY_VERSION)
    expect(entry?.sourceUrl).toBe('https://openai.com/api/pricing/')
  })

  it('estimates mixed cached and uncached usage costs', () => {
    const usage = estimateModelUsageCost({
      provider: 'openai',
      model: 'gpt-5.4-mini',
      feature: 'advisor_daily_brief',
      endpointType: 'responses',
      status: 'completed',
      inputTokens: 1_000_000,
      outputTokens: 500_000,
      cachedInputTokens: 200_000,
      latencyMs: 820,
      usdToEurRate: 0.92,
    })

    expect(usage.estimatedCostUsd).toBe(2.865)
    expect(usage.estimatedCostEur).toBe(2.6358)
    expect(usage.pricingVersion).toBe(AI_PRICING_REGISTRY_VERSION)
  })

  it('uses batch pricing when requested', () => {
    const usage = estimateModelUsageCost({
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      feature: 'advisor_challenger',
      endpointType: 'messages',
      status: 'completed',
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
      batch: true,
      latencyMs: 2_500,
      usdToEurRate: 0.92,
    })

    expect(usage.estimatedCostUsd).toBe(9)
  })

  it('fails fast when a model is missing from the registry', () => {
    expect(() =>
      estimateModelUsageCost({
        provider: 'openai',
        model: 'missing-model',
        feature: 'advisor_chat',
        endpointType: 'responses',
        status: 'completed',
        inputTokens: 1_000,
        outputTokens: 1_000,
        latencyMs: 100,
        usdToEurRate: 0.92,
      })
    ).toThrow('Missing pricing entry for openai:missing-model')
  })
})
