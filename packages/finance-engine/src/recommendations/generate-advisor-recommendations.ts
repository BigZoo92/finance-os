import type {
  AdvisorSnapshot,
  DeterministicRecommendation,
  ExternalSignalSummary,
} from '../types'

const round = (value: number, digits = 2) => {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

const sortByPriority = (recommendations: DeterministicRecommendation[]) =>
  [...recommendations].sort((left, right) => right.priorityScore - left.priorityScore)

export const generateAdvisorRecommendations = ({
  snapshot,
  signals = [],
}: {
  snapshot: AdvisorSnapshot
  signals?: ExternalSignalSummary[]
}): DeterministicRecommendation[] => {
  const recommendations: DeterministicRecommendation[] = []
  const emergencyGapMonths =
    snapshot.metrics.emergencyFundMonths === null
      ? null
      : round(snapshot.targets.emergencyFundMonths - snapshot.metrics.emergencyFundMonths)

  if (snapshot.metrics.cashDragPct >= 0.6) {
    const annualOpportunityCost = round(
      snapshot.metrics.totalValue * (snapshot.metrics.cashDragPct / 100)
    )

    recommendations.push({
      id: 'cash-drag-reduction',
      type: 'rebalance_cash_drag',
      title: 'Reduire le cash drag non strategique',
      description:
        'Une partie du cash depasse la bande cible implicite et pèse sur le rendement attendu du portefeuille.',
      category: 'cash_optimization',
      whyNow:
        'Le surplus de cash au-dessus de la bande cible peut rester utile comme optionalite, mais son cout d opportunite devient material au niveau actuel.',
      evidence: [
        `Poids cash observe: ${snapshot.metrics.cashAllocationPct}%`,
        `Bande cible cash (${snapshot.riskProfile}): ${snapshot.targets.targetAllocations.cash.min}-${snapshot.targets.targetAllocations.cash.max}%`,
        `Cash drag estime: ${snapshot.metrics.cashDragPct}%/an`,
      ],
      assumptions: [
        'Le cash excedentaire n est pas reserve a une depense proche identifiee.',
        'Le profil de risque implicite est une approximation et peut etre ajuste manuellement.',
      ],
      confidence: 0.78,
      riskLevel: 'medium',
      expectedImpact: {
        summary: `Gain annualise potentiel d environ ${annualOpportunityCost.toFixed(0)} ${snapshot.currency}`,
        value: annualOpportunityCost,
        unit: 'eur_per_year',
      },
      effort: 'medium',
      reversibility: 'high',
      blockingFactors: [
        'Besoin de tresorerie proche non modelise',
        'Confort psychologique avec un niveau de cash eleve',
      ],
      alternatives: [
        'Mettre seulement la moitie du surplus au travail progressivement',
        'Conserver le cash mais le flécher comme poche opportuniste explicite',
      ],
      deterministicMetricsUsed: [
        'cashAllocationPct',
        'cashDragPct',
        'riskProfile',
        'targetAllocations.cash',
      ],
      priorityScore: 82,
    })
  }

  if ((snapshot.metrics.savingsRatePct ?? 0) < 10 || snapshot.diagnostics.topExpenseSharePct >= 20) {
    recommendations.push({
      id: 'spend-discipline',
      type: 'trim_variable_spend',
      title: 'Redonner de la marge au cashflow',
      description:
        'Le taux d epargne observe reste fragile au regard des depenses mensuelles et du poids du principal poste de depense.',
      category: 'spend_reduction',
      whyNow:
        'Ameliorer la marge de cashflow augmente a la fois la capacite d epargne, le fonds d urgence et la tolerance aux chocs.',
      evidence: [
        `Taux d epargne observe: ${snapshot.metrics.savingsRatePct ?? 0}%`,
        `Part du premier poste de depense: ${snapshot.diagnostics.topExpenseSharePct}%`,
        `Cashflow mensuel net: ${snapshot.metrics.netMonthlyCashflow} ${snapshot.currency}`,
      ],
      assumptions: [
        'Les depenses variables peuvent etre reduites sans degradation excessive de la qualite de vie.',
      ],
      confidence: 0.73,
      riskLevel: 'low',
      expectedImpact: {
        summary: 'Objectif raisonnable: recuperer 5% a 10% des depenses variables.',
        value: round(
          Math.max(snapshot.metrics.netMonthlyCashflow * -1, 0) +
            snapshot.metrics.totalValue * 0.001
        ),
        unit: 'eur_per_month',
      },
      effort: 'medium',
      reversibility: 'high',
      blockingFactors: ['Charges fixes deja elevees', 'Peu de categories flexibles restantes'],
      alternatives: [
        'Commencer par les abonnements et achats impulsifs',
        'Se fixer un plafond hebdomadaire sur le principal poste variable',
      ],
      deterministicMetricsUsed: ['savingsRatePct', 'netMonthlyCashflow', 'topExpenseSharePct'],
      priorityScore: 76,
    })
  }

  if (emergencyGapMonths !== null && emergencyGapMonths > 0.5) {
    recommendations.push({
      id: 'emergency-fund-gap',
      type: 'build_emergency_fund',
      title: 'Completer le fonds d urgence avant de monter le risque',
      description:
        'Le coussin liquide reste sous la cible implicite du profil de risque et du niveau de depenses courant.',
      category: 'emergency_fund',
      whyNow:
        'Un fonds d urgence plus solide reduit le risque de vendre des actifs au mauvais moment en cas de choc personnel ou macro.',
      evidence: [
        `Couverture observee: ${snapshot.metrics.emergencyFundMonths ?? 0} mois`,
        `Cible implicite (${snapshot.riskProfile}): ${snapshot.targets.emergencyFundMonths} mois`,
        `Runway estime: ${snapshot.metrics.runwayMonths ?? 0} mois`,
      ],
      assumptions: [
        'Les depenses mensuelles observees sont representatives des besoins normaux.',
      ],
      confidence: 0.84,
      riskLevel: 'low',
      expectedImpact: {
        summary: 'La priorite est de gagner des mois de resilience avant tout arbitrage offensif.',
        value: emergencyGapMonths,
        unit: 'months',
      },
      effort: 'medium',
      reversibility: 'high',
      blockingFactors: ['Capacite d epargne limitee a court terme'],
      alternatives: [
        'Construire le fonds en deux paliers',
        'Prioriser un palier minimal avant tout arbitrage opportuniste',
      ],
      deterministicMetricsUsed: [
        'emergencyFundMonths',
        'runwayMonths',
        'targetAllocations.cash',
      ],
      priorityScore: 88,
    })
  }

  if (snapshot.driftSignals.some(signal => signal.status !== 'within_band')) {
    const strongestDrift = snapshot.driftSignals
      .filter(signal => signal.status !== 'within_band')
      .sort((left, right) => Math.abs(right.driftPct) - Math.abs(left.driftPct))[0]

    if (strongestDrift) {
      recommendations.push({
        id: `allocation-drift-${strongestDrift.bucket}`,
        type: 'rebalance_band',
        title: 'Rentrer dans la bande de rebalancing',
        description:
          'L allocation implicite a derive au-dela de la bande definie pour le profil de risque courant.',
        category: 'allocation_drift',
        whyNow:
          'Le drift modifie le risque reel du portefeuille et peut rendre la performance future trop dependante d un seul moteur.',
        evidence: [
          `Bucket ${strongestDrift.bucket}: ${strongestDrift.weightPct}%`,
          `Bande cible: ${strongestDrift.targetMinPct}-${strongestDrift.targetMaxPct}%`,
          `Ecart au point milieu: ${strongestDrift.driftPct}%`,
        ],
        assumptions: [
          'Le profil de risque implicite reste pertinent pour les 3 a 12 prochains mois.',
        ],
        confidence: 0.81,
        riskLevel: 'medium',
        expectedImpact: {
          summary:
            'Reduction du risque de drift et meilleure discipline de portefeuille.',
          value: Math.abs(strongestDrift.driftPct),
          unit: 'pct',
        },
        effort: 'medium',
        reversibility: 'medium',
        blockingFactors: [
          'Fiscalite ou frais de transaction non modelises',
          'Conviction tactique contraire',
        ],
        alternatives: [
          'Rebalancer par nouveaux versements plutot que par ventes',
          'Elargir temporairement les bandes si la conviction tactique est explicite',
        ],
        deterministicMetricsUsed: ['allocationBuckets', 'driftSignals', 'riskProfile'],
        priorityScore: 80,
      })
    }
  }

  if (snapshot.metrics.topPositionSharePct >= 35 || snapshot.metrics.riskBudgetSkewPct >= 10) {
    recommendations.push({
      id: 'concentration-risk',
      type: 'reduce_concentration',
      title: 'Mieux repartir le risque de concentration',
      description:
        'Une poche ou une position porte une part trop importante du risque total au regard du reste du portefeuille.',
      category: 'risk_concentration',
      whyNow:
        'La concentration cree une asymetrie: un seul choc peut effacer une part disproportionnee du rendement attendu.',
      evidence: [
        `Poids de la plus grosse position: ${snapshot.metrics.topPositionSharePct}%`,
        `Skew du budget risque: ${snapshot.metrics.riskBudgetSkewPct}%`,
        `Score de diversification: ${snapshot.metrics.diversificationScore}/100`,
      ],
      assumptions: [
        'La concentration actuelle n est pas entierement intentionnelle ni couverte ailleurs.',
      ],
      confidence: 0.79,
      riskLevel: 'high',
      expectedImpact: {
        summary: 'Baisse du risque idiosyncratique et du drawdown possible.',
        value: snapshot.metrics.topPositionSharePct,
        unit: 'pct',
      },
      effort: 'medium',
      reversibility: 'medium',
      blockingFactors: ['Conviction forte sur un actif', 'Fiscalite latente', 'Frais de sortie'],
      alternatives: [
        'Reallouer seulement les futurs apports',
        'Introduire une deuxieme exposition decorrelante plutot qu une vente nette immediate',
      ],
      deterministicMetricsUsed: [
        'topPositionSharePct',
        'riskBudgetSkewPct',
        'diversificationScore',
      ],
      priorityScore: 86,
    })
  }

  if ((signals.filter(signal => signal.direction === 'risk' && signal.severity >= 60).length ?? 0) >= 2) {
    recommendations.push({
      id: 'macro-caution',
      type: 'increase_prudence',
      title: 'Renforcer la prudence tactique',
      description:
        'Les signaux externes recents penchent davantage vers le risque que vers l opportunite, sans justifier une reaction panique.',
      category: 'caution',
      whyNow:
        'Une hausse recente de l incertitude macro ou geopolitique justifie de reduire la sur-confiance et de privilegier les mouvements reversibles.',
      evidence: signals
        .filter(signal => signal.direction === 'risk')
        .slice(0, 3)
        .map(
          signal =>
            `${signal.title} (sev. ${signal.severity}, conf. ${signal.confidence})`
        ),
      assumptions: [
        'Les signaux recents peuvent etre bruyants et ne constituent pas une prevision fiable du marche.',
      ],
      confidence: 0.66,
      riskLevel: 'medium',
      expectedImpact: {
        summary:
          'Meilleure discipline de risque plutot qu un gain de performance attendu.',
        value: null,
        unit: 'pct',
      },
      effort: 'low',
      reversibility: 'high',
      blockingFactors: ['Bruit informationnel eleve', 'Absence de preuve que le signal se materialise'],
      alternatives: [
        'Documenter les seuils qui justifieraient une vraie action',
        'Limiter la reponse a un simple ralentissement des nouveaux risques',
      ],
      deterministicMetricsUsed: ['signalsRiskCount', 'contradictorySignalCount'],
      priorityScore: 69,
    })
  }

  return sortByPriority(recommendations)
}
