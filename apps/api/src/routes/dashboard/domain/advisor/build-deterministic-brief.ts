import type {
  AdvisorSnapshot,
  DeterministicRecommendation,
  ExternalSignalSummary,
} from '@finance-os/finance-engine'

const round = (value: number, digits = 1) => {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

// Unknown liquidity or an unvalued portfolio is worded as unavailable. The
// brief never prints a 0 that the engine did not observe.
const UNAVAILABLE = 'indisponible'
const describeMonths = (value: number | null) =>
  value === null ? UNAVAILABLE : `${value} mois`

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
  const portfolioValued = snapshot.metrics.totalValue > 0

  return {
    title:
      topRecommendation?.title ??
      (portfolioValued
        ? `Point quotidien ${snapshot.riskProfile}: cash ${round(snapshot.metrics.cashAllocationPct)}%`
        : `Point quotidien ${snapshot.riskProfile}: valorisation ${UNAVAILABLE}`),
    summary: [
      portfolioValued
        ? `Le portefeuille reste calibre ${snapshot.riskProfile} avec un rendement annuel attendu proche de ${round(snapshot.metrics.expectedAnnualReturnPct)}%.`
        : `Aucune position valorisee: le profil ${snapshot.riskProfile} est retenu mais rendement attendu, allocation et diversification restent ${UNAVAILABLE}s.`,
      portfolioValued
        ? `Le cash represente ${round(snapshot.metrics.cashAllocationPct)}% et le score de diversification est de ${round(snapshot.metrics.diversificationScore)}.`
        : 'Les poids d allocation ne sont pas calcules tant qu aucune valorisation n est disponible.',
      riskSignals > opportunitySignals
        ? 'Les signaux externes recents invitent davantage a la prudence qu a l aggression tactique.'
        : 'Les signaux externes restent mitiges et ne justifient pas une surreaction tactique.',
    ].join(' '),
    keyFacts: [
      `Cashflow mensuel net estime: ${round(snapshot.metrics.netMonthlyCashflow)} ${snapshot.currency}`,
      `Fonds d urgence: ${
        snapshot.metrics.emergencyFundMonths === null
          ? UNAVAILABLE
          : `${snapshot.metrics.emergencyFundMonths} mois de depenses`
      }`,
      `Cash drag estime: ${portfolioValued ? `${round(snapshot.metrics.cashDragPct)}%/an` : UNAVAILABLE}`,
      `Concentration max: ${
        portfolioValued
          ? `${round(snapshot.metrics.topPositionSharePct)}% sur une seule ligne`
          : UNAVAILABLE
      }`,
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
      `Runway estime: ${describeMonths(snapshot.metrics.runwayMonths)}`,
      `Risk budget skew: ${portfolioValued ? `${round(snapshot.metrics.riskBudgetSkewPct)}%` : UNAVAILABLE}`,
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
