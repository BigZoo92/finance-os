import type { AuthMode } from '@/features/auth-types'
import { readPublicRuntimeEnv } from '@/lib/public-runtime-env'
import type { DashboardSummaryResponse } from './dashboard-types'

const EXPLAINABILITY_SCOPE = '[web:social-benchmark-explainability]'

export type ExplainabilityFallbackReason =
  | 'kill_switch_disabled'
  | 'insufficient_positions'
  | 'admin_analytics_unavailable'
  | 'low_confidence_signal'

export type ExplainabilityConfidence = 'high' | 'medium' | 'low'

export type BenchmarkExplainabilityInsight = {
  id: string
  title: string
  summary: string
  detail: string
  confidence: ExplainabilityConfidence
  ruleHits: string[]
  fallbackReason: ExplainabilityFallbackReason | null
}

export type SocialBenchmarkExplainabilityModel = {
  enabled: boolean
  traceId: string
  generatedAt: string
  mode: AuthMode | 'unknown'
  staleInsight: boolean
  generationFailed: boolean
  failureReason: string | null
  insights: BenchmarkExplainabilityInsight[]
}

const createTraceId = () => {
  const rand = Math.random().toString(36).slice(2, 8)
  return `bench-exp-${Date.now().toString(36)}-${rand}`
}

const toOptionalEnv = (value: string | undefined) => {
  if (!value) {
    return undefined
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : undefined
}

const parseBooleanUiFlag = (value: string | undefined) => {
  const normalized = toOptionalEnv(value)?.toLowerCase()
  if (!normalized) {
    return undefined
  }

  if (normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on') {
    return true
  }

  if (normalized === '0' || normalized === 'false' || normalized === 'no' || normalized === 'off') {
    return false
  }

  return undefined
}

const formatPct = (value: number) => `${Math.round(value * 100)}%`

const buildDeterministicInsights = ({
  positions,
  cashValue,
  totalValue,
}: {
  positions: DashboardSummaryResponse['positions']
  cashValue: number
  totalValue: number
}): BenchmarkExplainabilityInsight[] => {
  if (positions.length === 0 || totalValue <= 0) {
    return [
      {
        id: 'fallback-generic',
        title: 'Repère prudent par défaut',
        summary: 'Pas assez de positions pour comparer finement votre portefeuille à un benchmark social.',
        detail:
          'Le panel reste actif mais applique une règle générique : diversification progressive et suivi hebdomadaire des écarts.',
        confidence: 'low',
        ruleHits: ['positions_missing'],
        fallbackReason: 'insufficient_positions',
      },
    ]
  }

  const sorted = [...positions]
    .map(item => ({
      name: item.name,
      value: item.currentValue ?? item.lastKnownValue ?? 0,
      source: item.costBasisSource,
    }))
    .filter(item => item.value > 0)
    .sort((a, b) => b.value - a.value)

  const largest = sorted[0]
  const concentration = largest ? largest.value / totalValue : 0
  const cashDrag = totalValue > 0 ? cashValue / totalValue : 0
  const lowQualityCoverage = sorted.filter(position => position.source === 'minimal' || position.source === 'unknown').length

  const insights: BenchmarkExplainabilityInsight[] = [
    {
      id: 'concentration-gap',
      title: 'Écart de concentration',
      summary: largest
        ? `${largest.name} pèse ${formatPct(concentration)} de votre exposition totale.`
        : 'Concentration non mesurable avec les données actuelles.',
      detail:
        concentration >= 0.35
          ? 'Votre portefeuille est plus concentré que la plupart des profils diversifiés. Cet écart peut expliquer une volatilité perçue plus forte que le benchmark.'
          : 'La concentration reste modérée, proche d’un portefeuille diversifié. Les écarts de performance viennent probablement d’autres facteurs.',
      confidence: concentration >= 0.2 ? 'high' : 'medium',
      ruleHits: ['largest_position_share'],
      fallbackReason: null,
    },
    {
      id: 'cash-drag-gap',
      title: 'Écart de cash drag',
      summary: `La poche cash représente ${formatPct(cashDrag)} de la valeur suivie.`,
      detail:
        cashDrag >= 0.25
          ? 'Un niveau de cash élevé tend à réduire la participation aux hausses des marchés. Cela peut créer un différentiel durable face aux benchmarks investis.'
          : 'Le niveau de cash reste compatible avec un benchmark investi. Le différentiel provient plutôt de la sélection ou du timing des positions.',
      confidence: cashDrag >= 0.1 ? 'medium' : 'high',
      ruleHits: ['cash_drag_ratio'],
      fallbackReason: null,
    },
  ]

  if (lowQualityCoverage > 0) {
    insights.push({
      id: 'coverage-fallback',
      title: 'Qualité des données incomplète',
      summary: `${lowQualityCoverage} position(s) utilisent une base de coût partielle ou inconnue.`,
      detail:
        'En mode admin, l’enrichissement analytics peut affiner cette lecture. Sans enrichissement, la narration reste volontairement prudente.',
      confidence: 'low',
      ruleHits: ['cost_basis_partial'],
      fallbackReason: 'admin_analytics_unavailable',
    })
  }

  return insights
}

export const getSocialBenchmarkExplainabilityEnabled = () => {
  return parseBooleanUiFlag(readPublicRuntimeEnv('VITE_SOCIAL_BENCHMARK_EXPLAINABILITY_ENABLED')) ?? true
}

export const buildSocialBenchmarkExplainability = ({
  mode,
  positions,
  assets,
}: {
  mode: AuthMode | 'unknown'
  positions: DashboardSummaryResponse['positions']
  assets: DashboardSummaryResponse['assets']
}): SocialBenchmarkExplainabilityModel => {
  const enabled = getSocialBenchmarkExplainabilityEnabled()
  const traceId = createTraceId()
  const generatedAt = new Date().toISOString()

  if (!enabled) {
    return {
      enabled: false,
      traceId,
      generatedAt,
      mode,
      staleInsight: false,
      generationFailed: false,
      failureReason: null,
      insights: [],
    }
  }

  try {
    const cashValue = assets
      .filter(asset => asset.type === 'cash')
      .reduce((sum, asset) => sum + asset.valuation, 0)
    const totalValue = positions.reduce((sum, p) => sum + (p.currentValue ?? p.lastKnownValue ?? 0), 0)

    const insights = buildDeterministicInsights({ positions, cashValue, totalValue })
    const staleInsight = positions.every(position => !position.valuedAt)

    return {
      enabled,
      traceId,
      generatedAt,
      mode,
      staleInsight,
      generationFailed: false,
      failureReason: null,
      insights,
    }
  } catch {
    return {
      enabled,
      traceId,
      generatedAt,
      mode,
      staleInsight: true,
      generationFailed: true,
      failureReason: 'rule_engine_error',
      insights: [
        {
          id: 'fallback-safe-copy',
          title: 'Lecture prudente indisponible',
          summary: 'Nous affichons temporairement les benchmarks sans explication narrative.',
          detail:
            'La base benchmark reste visible pour éviter une interruption. Vérifiez ultérieurement les écarts détaillés.',
          confidence: 'low',
          ruleHits: ['fallback_safe_mode'],
          fallbackReason: 'low_confidence_signal',
        },
      ],
    }
  }
}

export const logSocialBenchmarkExplainabilityEvent = (model: SocialBenchmarkExplainabilityModel) => {
  console.info(EXPLAINABILITY_SCOPE, {
    event: 'explainability_generated',
    traceId: model.traceId,
    mode: model.mode,
    generatedAt: model.generatedAt,
    enabled: model.enabled,
    staleInsight: model.staleInsight,
    generationFailed: model.generationFailed,
    failureReason: model.failureReason,
    insightCount: model.insights.length,
    fallbackReasonCodes: model.insights.map(insight => insight.fallbackReason).filter(Boolean),
    ruleHits: model.insights.flatMap(insight => insight.ruleHits),
  })
}
