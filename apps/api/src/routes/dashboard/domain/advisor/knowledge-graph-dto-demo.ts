/**
 * Deterministic curated graph DTO for `GET /dashboard/advisor/knowledge/graph`
 * in demo mode (and as the example overlay when `includeExamples=true`).
 *
 * Hand-crafted to showcase clusters, evidence, contradictions and weak
 * confidence without exposing any provider data. No DB / no LLM / no
 * provider calls, by construction.
 */
import type {
  AdvisorGraphLinkDto,
  AdvisorGraphNodeDto,
  AdvisorKnowledgeGraphDto,
  AdvisorKnowledgeGraphScope,
} from './knowledge-graph-dto'
import { filterByScope, hardenGraphDto } from './knowledge-graph-dto'

const FIXED_GENERATED_AT = '2026-04-26T00:00:00.000Z'

const CURATED_NODES: ReadonlyArray<Omit<AdvisorGraphNodeDto, 'origin'>> = [
  {
    id: 'snapshot:me',
    label: 'Toi · snapshot mensuel',
    kind: 'personal_snapshot',
    summary: 'Vue agrégée et anonymisée de ton patrimoine et flux courants.',
    confidence: 1,
    freshness: 'fresh',
    importance: 1,
    isPersonal: true,
    observedAt: FIXED_GENERATED_AT,
    source: 'finance-engine',
    whyItMatters: 'Point d’ancrage. Tout le reste s’y rattache.',
  },
  {
    id: 'goal:retirement',
    label: 'Retraite — 2055',
    kind: 'goal',
    summary: 'Objectif long terme, allocation diversifiée mondiale.',
    confidence: 0.82,
    freshness: 'fresh',
    importance: 0.9,
    isPersonal: true,
    whyItMatters: 'Pilote la tolérance au risque long terme.',
  },
  {
    id: 'goal:emergency_fund',
    label: 'Coussin de sécurité',
    kind: 'goal',
    summary: '6 mois de dépenses essentielles en liquidités.',
    confidence: 0.76,
    freshness: 'stale',
    importance: 0.7,
    isPersonal: true,
  },
  {
    id: 'goal:real_estate',
    label: 'Apport immobilier — 2028',
    kind: 'goal',
    summary: 'Cible court-moyen terme, sensibilité élevée à la volatilité.',
    confidence: 0.7,
    freshness: 'fresh',
    importance: 0.8,
    isPersonal: true,
  },
  {
    id: 'account:checking',
    label: 'Compte courant',
    kind: 'financial_account',
    summary: 'Liquidité de transit, soldes agrégés uniquement.',
    confidence: 1,
    freshness: 'fresh',
    importance: 0.5,
    isPersonal: true,
  },
  {
    id: 'account:savings',
    label: 'Livrets & épargne',
    kind: 'financial_account',
    summary: 'Épargne disponible, rendements bornés.',
    confidence: 0.95,
    freshness: 'fresh',
    importance: 0.6,
    isPersonal: true,
  },
  {
    id: 'account:broker',
    label: 'Courtier titres',
    kind: 'financial_account',
    summary: 'Compte titres ordinaire, positions agrégées.',
    confidence: 0.95,
    freshness: 'fresh',
    importance: 0.7,
    isPersonal: true,
  },
  {
    id: 'tx:subscriptions',
    label: 'Abonnements récurrents',
    kind: 'transaction_cluster',
    summary: '12 abonnements actifs, dont 3 redondants détectés.',
    confidence: 0.88,
    freshness: 'fresh',
    importance: 0.4,
    isPersonal: true,
  },
  {
    id: 'tx:dining',
    label: 'Restauration',
    kind: 'transaction_cluster',
    summary: 'Variabilité élevée, en hausse ce trimestre.',
    confidence: 0.7,
    freshness: 'fresh',
    importance: 0.4,
    isPersonal: true,
  },
  {
    id: 'tx:utilities',
    label: 'Charges récurrentes',
    kind: 'transaction_cluster',
    summary: 'Loyers, énergie, télécom — peu volatil.',
    confidence: 0.92,
    freshness: 'fresh',
    importance: 0.5,
    isPersonal: true,
  },
  {
    id: 'invest:etf_world',
    label: 'ETF Monde diversifié',
    kind: 'investment',
    summary: 'Cœur d’allocation, exposition globale.',
    confidence: 0.88,
    freshness: 'fresh',
    importance: 0.85,
    isPersonal: true,
  },
  {
    id: 'invest:us_tech',
    label: 'Concentration US Tech',
    kind: 'investment',
    summary: 'Position individuelle élevée, surveiller la concentration.',
    confidence: 0.78,
    freshness: 'fresh',
    importance: 0.75,
    isPersonal: true,
    isContradicted: true,
  },
  {
    id: 'invest:crypto',
    label: 'Crypto satellite',
    kind: 'investment',
    summary: 'Allocation satellite, volatilité élevée.',
    confidence: 0.6,
    freshness: 'fresh',
    importance: 0.5,
    isPersonal: true,
  },
  {
    id: 'asset:eur_cash',
    label: 'Liquidités EUR',
    kind: 'asset',
    summary: 'Cash dispatch entre comptes, exposé à l’inflation.',
    confidence: 0.95,
    freshness: 'fresh',
    importance: 0.6,
    isPersonal: true,
  },
  {
    id: 'concept:cash_drag',
    label: 'Cash drag',
    kind: 'concept',
    summary: 'Manque à gagner dû à un cash excédentaire non alloué.',
    confidence: 0.86,
    freshness: 'fresh',
    importance: 0.7,
    source: 'finance-os-curated-seed',
    whyItMatters: 'Concept clé pour challenger le “rester en cash”.',
  },
  {
    id: 'concept:inflation_adjusted_returns',
    label: 'Rendement réel',
    kind: 'concept',
    summary: 'Rendement net d’inflation pour mesurer le pouvoir d’achat.',
    confidence: 0.88,
    freshness: 'fresh',
    importance: 0.7,
    source: 'finance-os-curated-seed',
  },
  {
    id: 'concept:diversification',
    label: 'Diversification',
    kind: 'concept',
    summary: 'Réduction de la variance via décorrélation des actifs.',
    confidence: 0.9,
    freshness: 'fresh',
    importance: 0.85,
  },
  {
    id: 'concept:dca',
    label: 'DCA — investissement programmé',
    kind: 'concept',
    summary: 'Lissage du point d’entrée pour réduire le timing risk.',
    confidence: 0.82,
    freshness: 'fresh',
    importance: 0.6,
  },
  {
    id: 'concept:risk_adjusted_return',
    label: 'Rendement ajusté du risque',
    kind: 'concept',
    summary: 'Performance par unité de volatilité (Sharpe, Sortino).',
    confidence: 0.84,
    freshness: 'fresh',
    importance: 0.7,
  },
  {
    id: 'formula:sharpe',
    label: 'Sharpe ratio',
    kind: 'formula',
    summary: '(R_p − R_f) / σ_p — compare excess return à la volatilité.',
    confidence: 0.92,
    freshness: 'fresh',
    importance: 0.5,
  },
  {
    id: 'signal:eur_inflation',
    label: 'Inflation EUR',
    kind: 'market_signal',
    summary: 'Tendance désinflationniste, encore au-dessus de 2 %.',
    confidence: 0.82,
    freshness: 'fresh',
    importance: 0.7,
    source: 'macro-feed',
  },
  {
    id: 'signal:sp500_trend',
    label: 'Tendance S&P 500',
    kind: 'market_signal',
    summary: 'Tendance haussière, valorisation tendue.',
    confidence: 0.7,
    freshness: 'fresh',
    importance: 0.6,
  },
  {
    id: 'signal:btc_volatility',
    label: 'Volatilité BTC',
    kind: 'market_signal',
    summary: 'Volatilité élevée et drawdowns asymétriques historiques.',
    confidence: 0.78,
    freshness: 'fresh',
    importance: 0.55,
  },
  {
    id: 'news:ecb_rate',
    label: 'Décision BCE — taux',
    kind: 'news_signal',
    summary: 'Statu quo, biais accommodant si l’inflation poursuit sa baisse.',
    confidence: 0.74,
    freshness: 'fresh',
    importance: 0.65,
    source: 'ECB',
  },
  {
    id: 'news:tech_earnings',
    label: 'Saison résultats Tech',
    kind: 'news_signal',
    summary: 'Concentration de la performance sur quelques noms.',
    confidence: 0.68,
    freshness: 'stale',
    importance: 0.6,
  },
  {
    id: 'reco:reduce_cash_drag',
    label: 'Réduire le cash drag',
    kind: 'recommendation',
    summary: 'Allouer une partie du cash excédentaire vers le cœur diversifié.',
    confidence: 0.84,
    freshness: 'fresh',
    importance: 0.9,
    whyItMatters: 'Améliore le rendement réel à long terme sans levier.',
  },
  {
    id: 'reco:rebalance',
    label: 'Rééquilibrer la concentration Tech',
    kind: 'recommendation',
    summary: 'Réduire l’exposition individuelle pour ramener la part cible.',
    confidence: 0.78,
    freshness: 'fresh',
    importance: 0.85,
  },
  {
    id: 'reco:emergency_topup',
    label: 'Compléter le coussin de sécurité',
    kind: 'recommendation',
    summary: 'Atteindre 6 mois de dépenses essentielles avant nouveau risque.',
    confidence: 0.82,
    freshness: 'fresh',
    importance: 0.8,
  },
  {
    id: 'reco:diversify_satellite',
    label: 'Diversifier la poche satellite',
    kind: 'recommendation',
    summary: 'Limiter la corrélation entre les positions satellites volatiles.',
    confidence: 0.66,
    freshness: 'fresh',
    importance: 0.55,
  },
  {
    id: 'risk:concentration',
    label: 'Risque de concentration',
    kind: 'risk',
    summary: 'Position individuelle au-dessus du seuil cible.',
    confidence: 0.8,
    freshness: 'fresh',
    importance: 0.85,
  },
  {
    id: 'risk:lookahead_bias',
    label: 'Biais de lookahead',
    kind: 'risk',
    summary: 'Garde-fou pour toute affirmation issue de backtests.',
    confidence: 0.9,
    freshness: 'fresh',
    importance: 0.6,
  },
  {
    id: 'risk:currency_exposure',
    label: 'Exposition devise',
    kind: 'risk',
    summary: 'Exposition USD non couverte sur le cœur diversifié.',
    confidence: 0.7,
    freshness: 'fresh',
    importance: 0.55,
  },
  {
    id: 'contradiction:market_timing',
    label: 'Timing marché vs DCA',
    kind: 'contradiction',
    summary: 'Affirmation timing intuitif contredite par DCA déterministe.',
    confidence: 0.55,
    freshness: 'unknown',
    importance: 0.5,
  },
  {
    id: 'assumption:inflation_3pct',
    label: 'Inflation moyenne 3 %',
    kind: 'assumption',
    summary: 'Hypothèse long terme révisable selon les données BCE.',
    confidence: 0.6,
    freshness: 'stale',
    importance: 0.5,
  },
  {
    id: 'assumption:equity_7pct',
    label: 'Rendement actions 7 %',
    kind: 'assumption',
    summary: 'Hypothèse historique long terme, sensible à la décennie observée.',
    confidence: 0.55,
    freshness: 'stale',
    importance: 0.55,
  },
  {
    id: 'source:internal_engine',
    label: 'Finance-engine déterministe',
    kind: 'source',
    summary: 'Source de vérité pour positions, soldes et flux.',
    confidence: 1,
    freshness: 'fresh',
    importance: 0.4,
  },
  {
    id: 'source:curated_seed',
    label: 'Seed concepts curatés',
    kind: 'source',
    summary: 'Concepts financiers de référence intégrés à la mémoire.',
    confidence: 0.95,
    freshness: 'fresh',
    importance: 0.3,
  },
  {
    id: 'source:macro_feed',
    label: 'Flux macro public',
    kind: 'source',
    summary: 'Indices macro publics, agrégation seulement.',
    confidence: 0.8,
    freshness: 'fresh',
    importance: 0.3,
  },
]

const CURATED_LINKS: ReadonlyArray<Omit<AdvisorGraphLinkDto, 'origin'>> = [
  { source: 'snapshot:me', target: 'goal:retirement', kind: 'belongs_to', confidence: 0.95 },
  { source: 'snapshot:me', target: 'goal:emergency_fund', kind: 'belongs_to', confidence: 0.95 },
  { source: 'snapshot:me', target: 'goal:real_estate', kind: 'belongs_to', confidence: 0.95 },
  { source: 'snapshot:me', target: 'account:checking', kind: 'belongs_to', confidence: 1 },
  { source: 'snapshot:me', target: 'account:savings', kind: 'belongs_to', confidence: 1 },
  { source: 'snapshot:me', target: 'account:broker', kind: 'belongs_to', confidence: 1 },
  { source: 'account:checking', target: 'asset:eur_cash', kind: 'belongs_to', confidence: 0.95 },
  { source: 'account:savings', target: 'asset:eur_cash', kind: 'belongs_to', confidence: 0.9 },
  { source: 'account:broker', target: 'invest:etf_world', kind: 'belongs_to', confidence: 0.95 },
  { source: 'account:broker', target: 'invest:us_tech', kind: 'belongs_to', confidence: 0.95 },
  { source: 'account:broker', target: 'invest:crypto', kind: 'belongs_to', confidence: 0.85 },
  { source: 'snapshot:me', target: 'tx:subscriptions', kind: 'belongs_to', confidence: 0.9 },
  { source: 'snapshot:me', target: 'tx:dining', kind: 'belongs_to', confidence: 0.9 },
  { source: 'snapshot:me', target: 'tx:utilities', kind: 'belongs_to', confidence: 0.9 },
  { source: 'reco:reduce_cash_drag', target: 'concept:cash_drag', kind: 'explains', confidence: 0.86 },
  { source: 'reco:reduce_cash_drag', target: 'asset:eur_cash', kind: 'affects', confidence: 0.84 },
  { source: 'reco:reduce_cash_drag', target: 'signal:eur_inflation', kind: 'supports', confidence: 0.78 },
  { source: 'reco:reduce_cash_drag', target: 'concept:inflation_adjusted_returns', kind: 'supports', confidence: 0.82 },
  { source: 'reco:rebalance', target: 'invest:us_tech', kind: 'affects', confidence: 0.85 },
  { source: 'reco:rebalance', target: 'risk:concentration', kind: 'supports', confidence: 0.84 },
  { source: 'reco:rebalance', target: 'concept:diversification', kind: 'explains', confidence: 0.88 },
  { source: 'reco:rebalance', target: 'news:tech_earnings', kind: 'mentions', confidence: 0.6 },
  { source: 'reco:emergency_topup', target: 'goal:emergency_fund', kind: 'affects', confidence: 0.92 },
  { source: 'reco:emergency_topup', target: 'tx:dining', kind: 'mentions', confidence: 0.6 },
  { source: 'reco:diversify_satellite', target: 'invest:crypto', kind: 'affects', confidence: 0.7 },
  { source: 'reco:diversify_satellite', target: 'concept:diversification', kind: 'supports', confidence: 0.78 },
  { source: 'reco:diversify_satellite', target: 'signal:btc_volatility', kind: 'mentions', confidence: 0.62 },
  { source: 'concept:risk_adjusted_return', target: 'formula:sharpe', kind: 'derived_from', confidence: 0.95 },
  { source: 'concept:diversification', target: 'concept:risk_adjusted_return', kind: 'related_to', confidence: 0.7 },
  { source: 'concept:dca', target: 'concept:diversification', kind: 'related_to', confidence: 0.55 },
  { source: 'reco:reduce_cash_drag', target: 'concept:dca', kind: 'mentions', confidence: 0.5 },
  { source: 'signal:eur_inflation', target: 'asset:eur_cash', kind: 'affects', confidence: 0.78 },
  { source: 'signal:sp500_trend', target: 'invest:etf_world', kind: 'affects', confidence: 0.62 },
  { source: 'signal:sp500_trend', target: 'invest:us_tech', kind: 'affects', confidence: 0.7 },
  { source: 'signal:btc_volatility', target: 'invest:crypto', kind: 'affects', confidence: 0.74 },
  { source: 'news:ecb_rate', target: 'signal:eur_inflation', kind: 'related_to', confidence: 0.68 },
  { source: 'news:tech_earnings', target: 'signal:sp500_trend', kind: 'mentions', confidence: 0.6 },
  { source: 'news:tech_earnings', target: 'invest:us_tech', kind: 'mentions', confidence: 0.66 },
  { source: 'risk:concentration', target: 'invest:us_tech', kind: 'affects', confidence: 0.86 },
  { source: 'risk:currency_exposure', target: 'invest:etf_world', kind: 'affects', confidence: 0.7 },
  { source: 'risk:lookahead_bias', target: 'concept:risk_adjusted_return', kind: 'weakens', confidence: 0.7 },
  { source: 'contradiction:market_timing', target: 'concept:dca', kind: 'contradicts', confidence: 0.6 },
  { source: 'contradiction:market_timing', target: 'reco:rebalance', kind: 'weakens', confidence: 0.45 },
  { source: 'reco:reduce_cash_drag', target: 'assumption:inflation_3pct', kind: 'uses_assumption', confidence: 0.6 },
  { source: 'reco:emergency_topup', target: 'assumption:inflation_3pct', kind: 'uses_assumption', confidence: 0.55 },
  { source: 'reco:rebalance', target: 'assumption:equity_7pct', kind: 'uses_assumption', confidence: 0.6 },
  { source: 'reco:diversify_satellite', target: 'assumption:equity_7pct', kind: 'uses_assumption', confidence: 0.5 },
  { source: 'snapshot:me', target: 'source:internal_engine', kind: 'derived_from', confidence: 1 },
  { source: 'concept:cash_drag', target: 'source:curated_seed', kind: 'derived_from', confidence: 0.95 },
  { source: 'concept:inflation_adjusted_returns', target: 'source:curated_seed', kind: 'derived_from', confidence: 0.95 },
  { source: 'concept:risk_adjusted_return', target: 'source:curated_seed', kind: 'derived_from', confidence: 0.9 },
  { source: 'signal:eur_inflation', target: 'source:macro_feed', kind: 'derived_from', confidence: 0.85 },
  { source: 'news:ecb_rate', target: 'source:macro_feed', kind: 'derived_from', confidence: 0.8 },
]

const tagWithOrigin = <T,>(items: ReadonlyArray<T>, origin: 'demo' | 'example'): Array<T & { origin: typeof origin }> =>
  items.map(item => ({ ...item, origin }))

export interface BuildDemoGraphArgs {
  scope: AdvisorKnowledgeGraphScope
  limit: number
}

/**
 * Demo-mode DTO. Deterministic. No DB / provider / LLM access.
 */
export const buildDemoKnowledgeGraphDto = ({
  scope,
  limit,
}: BuildDemoGraphArgs): AdvisorKnowledgeGraphDto => {
  const allNodes = tagWithOrigin(CURATED_NODES, 'demo')
  const scoped = filterByScope(allNodes, scope).slice(0, limit)
  const ids = new Set(scoped.map(n => n.id))
  const links = tagWithOrigin(CURATED_LINKS, 'demo').filter(
    l => ids.has(l.source) && ids.has(l.target)
  )
  return hardenGraphDto({
    nodes: scoped,
    links,
    meta: {
      origin: 'demo',
      generatedAt: FIXED_GENERATED_AT,
      scope,
      nodeCount: scoped.length,
      linkCount: links.length,
      freshness: 'fresh',
      source: 'demo',
    },
  })
}

/**
 * Build the example-tagged overlay used when admins explicitly request
 * `?includeExamples=true`. IDs are prefixed `example:` so they cannot
 * collide with real Advisor memory IDs.
 */
export const buildExampleOverlay = (
  scope: AdvisorKnowledgeGraphScope,
  limit: number
): { nodes: AdvisorGraphNodeDto[]; links: AdvisorGraphLinkDto[] } => {
  const tagged = tagWithOrigin(CURATED_NODES, 'example')
  const scoped = filterByScope(tagged, scope).slice(0, limit)
  const idMap = new Map<string, string>()
  const nodes: AdvisorGraphNodeDto[] = scoped.map(node => {
    const newId = `example:${node.id}`
    idMap.set(node.id, newId)
    return { ...node, id: newId }
  })
  const links: AdvisorGraphLinkDto[] = tagWithOrigin(CURATED_LINKS, 'example')
    .filter(l => idMap.has(l.source) && idMap.has(l.target))
    .map(l => ({
      ...l,
      source: idMap.get(l.source) as string,
      target: idMap.get(l.target) as string,
    }))
  return { nodes, links }
}
