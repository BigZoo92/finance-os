import {
  DEFAULT_INFLATION_ASSUMPTION_PCT,
  estimateCashOpportunityCost,
  projectRecurringInvestment,
  type AdvisorSnapshot,
  type DeterministicRecommendation,
} from '@finance-os/finance-engine'

const euroAmountPattern = /(\d+(?:[.,]\d+)?)\s*(?:k|K|eur|euros?)/g
const monthlyContributionPattern = /(\d+(?:[.,]\d+)?)\s*(?:eur|euros?)\s*\/?\s*(?:par\s*)?mois/i

const parseAmount = (value: string) => Number(value.replace(',', '.'))

const formatAmount = (value: number, currency = 'EUR') =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value)

export const buildAdvisorChatFallback = ({
  question,
  snapshot,
  recommendations,
}: {
  question: string
  snapshot: AdvisorSnapshot
  recommendations: DeterministicRecommendation[]
}) => {
  const lower = question.toLowerCase()
  const citations: Array<{
    sourceType: 'recommendation' | 'snapshot'
    sourceId: string
    label: string
  }> = [
    {
      sourceType: 'snapshot',
      sourceId: 'latest-snapshot',
      label: `Snapshot ${snapshot.asOf}`,
    },
  ]
  const assumptions = [...snapshot.assumptions.map(item => item.justification)]
  const caveats = ['Ce systeme ne predit pas le futur et travaille avec des hypotheses prudentes.']
  const simulations: Array<{ label: string; value: string }> = []

  if (lower.includes('500') || monthlyContributionPattern.test(lower)) {
    const match = lower.match(monthlyContributionPattern)
    const monthlyContribution = parseAmount(match?.[1] ?? '500')
    const projections = projectRecurringInvestment({
      monthlyContribution,
      annualReturnPct: snapshot.metrics.expectedAnnualReturnPct,
      inflationPct: DEFAULT_INFLATION_ASSUMPTION_PCT,
      horizonsYears: [5, 10, 20],
    })

    for (const projection of projections) {
      simulations.push({
        label: `${projection.years} ans nominal`,
        value: formatAmount(projection.nominalFutureValue, snapshot.currency),
      })
      simulations.push({
        label: `${projection.years} ans reel`,
        value: formatAmount(projection.realFutureValue, snapshot.currency),
      })
    }

    return {
      answer: `En prenant le rendement annuel attendu du snapshot comme hypothese de travail, investir ${formatAmount(monthlyContribution, snapshot.currency)} par mois augmente progressivement le capital projete. Le resultat depend surtout de l horizon, du rendement reel apres inflation et de votre discipline de versement.`,
      citations,
      assumptions,
      caveats,
      simulations,
    }
  }

  if (lower.includes('compte courant') || lower.includes('cash')) {
    const matches = [...lower.matchAll(euroAmountPattern)]
    const raw = matches[0]?.[1]
    const amount = raw ? parseAmount(raw) * (matches[0]?.[0].includes('k') ? 1000 : 1) : 20000
    const opportunity = estimateCashOpportunityCost({
      idleCashAmount: amount,
      annualCashRatePct: 1.75,
      annualPortfolioReturnPct: snapshot.metrics.expectedAnnualReturnPct,
    })

    simulations.push({
      label: 'Cout d opportunite annuel',
      value: formatAmount(opportunity.annualOpportunityCost, snapshot.currency),
    })
    simulations.push({
      label: 'Ecart de rendement',
      value: `${opportunity.gapPct.toFixed(2)}%/an`,
    })

    return {
      answer: `Garder ${formatAmount(amount, snapshot.currency)} sur le compte courant preserve l optionalite et le confort psychologique, mais cree aussi un cout d opportunite si ce cash depasse votre bande cible. D apres le snapshot, ce manque a gagner potentiel reste surtout une question de cash drag, pas une certitude de performance future.`,
      citations,
      assumptions,
      caveats,
      simulations,
    }
  }

  const topRecommendation = recommendations[0]
  if (topRecommendation) {
    citations.push({
      sourceType: 'recommendation',
      sourceId: topRecommendation.id,
      label: topRecommendation.title,
    })
  }

  return {
    answer: topRecommendation
      ? `La priorite actuelle ressort surtout autour de "${topRecommendation.title}". Elle est motivee par ${topRecommendation.whyNow.toLowerCase()}`
      : 'Les artefacts actuels ne donnent pas assez de matiere pour une reponse forte. Lancez un run daily pour regenerer snapshot, brief et recommandations.',
    citations,
    assumptions,
    caveats,
    simulations,
  }
}
