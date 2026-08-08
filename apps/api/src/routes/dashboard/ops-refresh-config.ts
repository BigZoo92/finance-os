export type DashboardOpsRefreshConfigInput = {
  externalInvestmentsEnabled: boolean
  ibkrFlexEnabled: boolean
  binanceSpotEnabled: boolean
  liveNewsIngestionEnabled: boolean
  marketDataEnabled: boolean
  marketDataRefreshEnabled: boolean
  aiAdvisorEnabled: boolean
  signalsSocialPollingEnabled: boolean
  assetValuationEnabled: boolean
}

export const createDashboardOpsRefreshConfig = ({
  externalInvestmentsEnabled,
  ibkrFlexEnabled,
  binanceSpotEnabled,
  liveNewsIngestionEnabled,
  marketDataEnabled,
  marketDataRefreshEnabled,
  aiAdvisorEnabled,
  signalsSocialPollingEnabled,
  assetValuationEnabled,
}: DashboardOpsRefreshConfigInput) => ({
  externalInvestmentsEnabled,
  ibkrFlexEnabled,
  binanceSpotEnabled,
  newsEnabled: liveNewsIngestionEnabled,
  marketsEnabled: marketDataEnabled && marketDataRefreshEnabled,
  advisorEnabled: aiAdvisorEnabled,
  socialEnabled: signalsSocialPollingEnabled,
  assetValuationEnabled,
})
