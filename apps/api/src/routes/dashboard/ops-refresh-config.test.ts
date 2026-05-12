import { describe, expect, it } from 'bun:test'
import { createDashboardOpsRefreshConfig } from './ops-refresh-config'

const baseInput = {
  externalInvestmentsEnabled: true,
  ibkrFlexEnabled: true,
  binanceSpotEnabled: true,
  liveNewsIngestionEnabled: true,
  marketDataEnabled: true,
  marketDataRefreshEnabled: true,
  aiAdvisorEnabled: true,
}

describe('createDashboardOpsRefreshConfig', () => {
  it('enables social jobs when social polling is enabled', () => {
    expect(
      createDashboardOpsRefreshConfig({
        ...baseInput,
        signalsSocialPollingEnabled: true,
      }).socialEnabled
    ).toBe(true)
  })

  it('keeps social jobs disabled when social polling is disabled', () => {
    expect(
      createDashboardOpsRefreshConfig({
        ...baseInput,
        signalsSocialPollingEnabled: false,
      }).socialEnabled
    ).toBe(false)
  })
})
