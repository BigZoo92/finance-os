import type {
  AdvisorSnapshot,
  DeterministicRecommendation,
  ExternalSignalSummary,
} from '@finance-os/finance-engine'

const round = (value: number, digits = 1) => {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

export const buildDeterministicBrief = ({
  snapshot,
  recommendations,
  signals,
}: {
  snapshot: AdvisorSnapshot
  recommendations: DeterministicRecommendation[]
  signals: ExternalSignalSummary[]
}) => {
  const topRecommendation = recommendations[0]
  const riskSignals = signals.filter(signal => signal.direction === 'risk').length
  const opportunitySignals = signals.filter(signal => signal.direction === 'opportunity').length

  return {
    title:
      topRecommendation?.title ??
      `Point quotidien ${snapshot.riskProfile}: cash ${round(snapshot.metrics.cashAllocationPct)}%`,
    summary: [
      `Le portefeuille reste calibre ${snapshot.riskProfile} avec un rendement annuel attendu proche de ${round(snapshot.metrics.expectedAnnualReturnPct)}%.`,
      `Le cash represente ${round(snapshot.metrics.cashAllocationPct)}% et le score de diversification est de ${round(snapshot.metrics.diversificationScore)}.`,
      riskSignals > opportunitySignals
        ? 'Les signaux externes recents invitent davantage a la prudence qu a l aggression tactique.'
        : 'Les signaux externes restent mitiges et ne justifient pas une surreaction tactique.',
    ].join(' '),
    keyFacts: [
      `Cashflow mensuel net estime: ${round(snapshot.metrics.netMonthlyCashflow)} ${snapshot.currency}`,
      `Fonds d urgence: ${snapshot.metrics.emergencyFundMonths ?? 0} mois de depenses`,
      `Cash drag estime: ${round(snapshot.metrics.cashDragPct)}%/an`,
      `Concentration max: ${round(snapshot.metrics.topPositionSharePct)}% sur une seule ligne`,
    ],
    opportunities: recommendations
      .filter(item => item.category === 'cash_optimization' || item.category === 'allocation_drift')
      .slice(0, 3)
      .map(item => item.title),
    risks: recommendations
      .filter(item => item.category === 'risk_concentration' || item.category === 'caution')
      .slice(0, 3)
      .map(item => item.title),
    watchItems: [
      `Runway estime: ${snapshot.metrics.runwayMonths ?? 0} mois`,
      `Risk budget skew: ${round(snapshot.metrics.riskBudgetSkewPct)}%`,
      `Signaux externes: ${riskSignals} risque / ${opportunitySignals} opportunite`,
    ],
    recommendationNotes: recommendations.slice(0, 5).map(item => ({
      recommendationId: item.id,
      whyNow: item.whyNow,
      narrative: item.description,
      confidenceDelta: 0,
      impactSummary: item.expectedImpact.summary,
      alternatives: item.alternatives,
    })),
  }
}
