/**
 * Advisor Knowledge Graph 3D — typed graph view model.
 *
 * This is the visualization layer over derived Advisor memory.
 * It is NOT a source-of-truth financial database — deterministic
 * finance-engine outputs remain primary. The graph enriches and
 * explains Advisor reasoning by surfacing concepts, evidence,
 * confidence, freshness, contradictions and provenance.
 *
 * Two builders are exposed:
 *   - buildAdvisorDemoGraph(): deterministic, provider-free demo;
 *   - buildAdvisorGraphFromKnowledge(): adapter from real
 *     KnowledgeStats / Schema / Bundle / Query responses.
 */
import type {
  KnowledgeContextBundleResponse,
  KnowledgeQueryResponse,
  KnowledgeRelation,
  KnowledgeStatsResponse,
} from '@/features/knowledge-types'

// ─── public types ─────────────────────────────────────────────────────────

export type AdvisorGraphNodeKind =
  | 'personal_snapshot'
  | 'financial_account'
  | 'transaction_cluster'
  | 'asset'
  | 'investment'
  | 'goal'
  | 'recommendation'
  | 'assumption'
  | 'market_signal'
  | 'news_signal'
  | 'social_signal'
  | 'concept'
  | 'formula'
  | 'risk'
  | 'source'
  | 'contradiction'
  | 'unknown'

export type AdvisorGraphFreshness = 'fresh' | 'stale' | 'unknown'

export interface AdvisorGraphNode {
  id: string
  label: string
  kind: AdvisorGraphNodeKind
  group?: string
  confidence?: number
  freshness?: AdvisorGraphFreshness
  importance?: number
  observedAt?: string
  source?: string
  summary?: string
  isPersonal?: boolean
  isSensitive?: boolean
  isContradicted?: boolean
  /**
   * True when this node is a curated/illustrative example, NOT real
   * Advisor memory. Set only when example nodes are intentionally
   * mixed into an admin graph after explicit user opt-in.
   */
  isExample?: boolean
}

export type AdvisorGraphLinkKind =
  | 'supports'
  | 'explains'
  | 'contradicts'
  | 'weakens'
  | 'derived_from'
  | 'related_to'
  | 'affects'
  | 'mentions'
  | 'uses_assumption'
  | 'belongs_to'

export interface AdvisorGraphLink {
  source: string
  target: string
  kind: AdvisorGraphLinkKind
  label?: string
  confidence?: number
  strength?: number
  observedAt?: string
  summary?: string
}

/**
 * Origin of a graph view.
 *  - 'demo'  — pure curated demo fixture (auth=demo); not mixed with real.
 *  - 'real'  — built strictly from admin/real Advisor memory.
 *  - 'mixed' — admin graph augmented with example nodes after explicit
 *              user opt-in (preview). Example nodes carry isExample=true.
 *  - 'empty' — admin memory exists but is too sparse to render alone,
 *              and no preview was requested.
 */
export type AdvisorGraphOrigin = 'demo' | 'real' | 'mixed' | 'empty'

export interface AdvisorGraph {
  nodes: AdvisorGraphNode[]
  links: AdvisorGraphLink[]
  meta: {
    origin: AdvisorGraphOrigin
    summary: string
    nodeCount: number
    linkCount: number
    /** Real Advisor-memory nodes (excludes examples). */
    realNodeCount: number
    /** Curated example/illustration nodes mixed in (admin preview only). */
    exampleNodeCount: number
    degraded?: boolean
  }
}

// ─── visual semantics ─────────────────────────────────────────────────────

/**
 * Color tokens for node kinds. Each is a hex string usable by three.js.
 * Stays semantic across themes: greens for personal, reds for risks,
 * blues for recommendations, violets for concepts, ambers for signals.
 */
export const NODE_KIND_COLOR: Record<AdvisorGraphNodeKind, string> = {
  personal_snapshot: '#6ee7b7',
  financial_account: '#34d399',
  transaction_cluster: '#10b981',
  asset: '#22d3ee',
  investment: '#06b6d4',
  goal: '#a3e635',
  recommendation: '#60a5fa',
  assumption: '#7dd3fc',
  market_signal: '#fbbf24',
  news_signal: '#f59e0b',
  social_signal: '#fb923c',
  concept: '#c084fc',
  formula: '#a78bfa',
  risk: '#f87171',
  contradiction: '#ef4444',
  source: '#94a3b8',
  unknown: '#64748b',
}

export const NODE_KIND_LABEL: Record<AdvisorGraphNodeKind, string> = {
  personal_snapshot: 'Snapshot personnel',
  financial_account: 'Compte',
  transaction_cluster: 'Cluster transactions',
  asset: 'Actif',
  investment: 'Investissement',
  goal: 'Objectif',
  recommendation: 'Recommandation',
  assumption: 'Hypothèse',
  market_signal: 'Signal marché',
  news_signal: 'Signal actu',
  social_signal: 'Signal social',
  concept: 'Concept',
  formula: 'Formule',
  risk: 'Risque',
  contradiction: 'Contradiction',
  source: 'Source',
  unknown: 'Inconnu',
}

export const LINK_KIND_LABEL: Record<AdvisorGraphLinkKind, string> = {
  supports: 'soutient',
  explains: 'explique',
  contradicts: 'contredit',
  weakens: 'affaiblit',
  derived_from: 'dérivé de',
  related_to: 'lié à',
  affects: 'affecte',
  mentions: 'mentionne',
  uses_assumption: 'utilise hypothèse',
  belongs_to: 'appartient à',
}

export const LINK_KIND_COLOR: Record<AdvisorGraphLinkKind, string> = {
  supports: '#34d399',
  explains: '#60a5fa',
  contradicts: '#ef4444',
  weakens: '#fb923c',
  derived_from: '#a78bfa',
  related_to: '#94a3b8',
  affects: '#c084fc',
  mentions: '#cbd5e1',
  uses_assumption: '#7dd3fc',
  belongs_to: '#cbd5e1',
}

export const NEGATIVE_LINK_KINDS = new Set<AdvisorGraphLinkKind>([
  'contradicts',
  'weakens',
])

export const POSITIVE_LINK_KINDS = new Set<AdvisorGraphLinkKind>([
  'supports',
  'explains',
])

// ─── demo graph (deterministic, no provider calls) ────────────────────────

const DEMO_GENERATED_AT = '2026-04-26T00:00:00.000Z'

/**
 * Hand-crafted Advisor knowledge graph for demo mode.
 * Showcases clusters, evidence, contradictions and weak confidence
 * without exposing any provider data.
 */
export function buildAdvisorDemoGraph(): AdvisorGraph {
  const nodes: AdvisorGraphNode[] = [
    // Personal snapshot
    {
      id: 'snapshot:me',
      label: 'Toi · snapshot mensuel',
      kind: 'personal_snapshot',
      summary: 'Vue agrégée et anonymisée de ton patrimoine et flux courants.',
      confidence: 1,
      freshness: 'fresh',
      importance: 1,
      isPersonal: true,
      observedAt: DEMO_GENERATED_AT,
      source: 'finance-engine',
    },

    // Goals
    {
      id: 'goal:retirement',
      label: 'Retraite — 2055',
      kind: 'goal',
      summary: 'Objectif long terme, allocation diversifiée mondiale.',
      confidence: 0.82,
      freshness: 'fresh',
      importance: 0.9,
      isPersonal: true,
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

    // Accounts
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

    // Transaction clusters
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

    // Investments / assets
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

    // Concepts (educational nodes — non personal)
    {
      id: 'concept:cash_drag',
      label: 'Cash drag',
      kind: 'concept',
      summary: 'Manque à gagner dû à un cash excédentaire non alloué.',
      confidence: 0.86,
      freshness: 'fresh',
      importance: 0.7,
      source: 'finance-os-curated-seed',
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

    // Market & news signals
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

    // Recommendations
    {
      id: 'reco:reduce_cash_drag',
      label: 'Réduire le cash drag',
      kind: 'recommendation',
      summary: 'Allouer une partie du cash excédentaire vers le cœur diversifié.',
      confidence: 0.84,
      freshness: 'fresh',
      importance: 0.9,
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

    // Risks / contradictions
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

    // Assumptions
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

    // Sources
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

  const links: AdvisorGraphLink[] = [
    // Snapshot anchors
    { source: 'snapshot:me', target: 'goal:retirement', kind: 'belongs_to', confidence: 0.95 },
    { source: 'snapshot:me', target: 'goal:emergency_fund', kind: 'belongs_to', confidence: 0.95 },
    { source: 'snapshot:me', target: 'goal:real_estate', kind: 'belongs_to', confidence: 0.95 },
    { source: 'snapshot:me', target: 'account:checking', kind: 'belongs_to', confidence: 1 },
    { source: 'snapshot:me', target: 'account:savings', kind: 'belongs_to', confidence: 1 },
    { source: 'snapshot:me', target: 'account:broker', kind: 'belongs_to', confidence: 1 },

    // Accounts to assets / investments
    { source: 'account:checking', target: 'asset:eur_cash', kind: 'belongs_to', confidence: 0.95 },
    { source: 'account:savings', target: 'asset:eur_cash', kind: 'belongs_to', confidence: 0.9 },
    { source: 'account:broker', target: 'invest:etf_world', kind: 'belongs_to', confidence: 0.95 },
    { source: 'account:broker', target: 'invest:us_tech', kind: 'belongs_to', confidence: 0.95 },
    { source: 'account:broker', target: 'invest:crypto', kind: 'belongs_to', confidence: 0.85 },

    // Transactions
    { source: 'snapshot:me', target: 'tx:subscriptions', kind: 'belongs_to', confidence: 0.9 },
    { source: 'snapshot:me', target: 'tx:dining', kind: 'belongs_to', confidence: 0.9 },
    { source: 'snapshot:me', target: 'tx:utilities', kind: 'belongs_to', confidence: 0.9 },

    // Recommendations supported by evidence/concepts
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

    // Concept relations
    { source: 'concept:risk_adjusted_return', target: 'formula:sharpe', kind: 'derived_from', confidence: 0.95 },
    { source: 'concept:diversification', target: 'concept:risk_adjusted_return', kind: 'related_to', confidence: 0.7 },
    { source: 'concept:dca', target: 'concept:diversification', kind: 'related_to', confidence: 0.55 },
    { source: 'reco:reduce_cash_drag', target: 'concept:dca', kind: 'mentions', confidence: 0.5 },

    // Signals to assets
    { source: 'signal:eur_inflation', target: 'asset:eur_cash', kind: 'affects', confidence: 0.78 },
    { source: 'signal:sp500_trend', target: 'invest:etf_world', kind: 'affects', confidence: 0.62 },
    { source: 'signal:sp500_trend', target: 'invest:us_tech', kind: 'affects', confidence: 0.7 },
    { source: 'signal:btc_volatility', target: 'invest:crypto', kind: 'affects', confidence: 0.74 },
    { source: 'news:ecb_rate', target: 'signal:eur_inflation', kind: 'related_to', confidence: 0.68 },
    { source: 'news:tech_earnings', target: 'signal:sp500_trend', kind: 'mentions', confidence: 0.6 },
    { source: 'news:tech_earnings', target: 'invest:us_tech', kind: 'mentions', confidence: 0.66 },

    // Risks
    { source: 'risk:concentration', target: 'invest:us_tech', kind: 'affects', confidence: 0.86 },
    { source: 'risk:currency_exposure', target: 'invest:etf_world', kind: 'affects', confidence: 0.7 },
    { source: 'risk:lookahead_bias', target: 'concept:risk_adjusted_return', kind: 'weakens', confidence: 0.7 },

    // Contradictions
    { source: 'contradiction:market_timing', target: 'concept:dca', kind: 'contradicts', confidence: 0.6 },
    { source: 'contradiction:market_timing', target: 'reco:rebalance', kind: 'weakens', confidence: 0.45 },

    // Assumptions
    { source: 'reco:reduce_cash_drag', target: 'assumption:inflation_3pct', kind: 'uses_assumption', confidence: 0.6 },
    { source: 'reco:emergency_topup', target: 'assumption:inflation_3pct', kind: 'uses_assumption', confidence: 0.55 },
    { source: 'reco:rebalance', target: 'assumption:equity_7pct', kind: 'uses_assumption', confidence: 0.6 },
    { source: 'reco:diversify_satellite', target: 'assumption:equity_7pct', kind: 'uses_assumption', confidence: 0.5 },

    // Sources
    { source: 'snapshot:me', target: 'source:internal_engine', kind: 'derived_from', confidence: 1 },
    { source: 'concept:cash_drag', target: 'source:curated_seed', kind: 'derived_from', confidence: 0.95 },
    { source: 'concept:inflation_adjusted_returns', target: 'source:curated_seed', kind: 'derived_from', confidence: 0.95 },
    { source: 'concept:risk_adjusted_return', target: 'source:curated_seed', kind: 'derived_from', confidence: 0.9 },
    { source: 'signal:eur_inflation', target: 'source:macro_feed', kind: 'derived_from', confidence: 0.85 },
    { source: 'news:ecb_rate', target: 'source:macro_feed', kind: 'derived_from', confidence: 0.8 },
  ]

  return {
    nodes,
    links,
    meta: {
      origin: 'demo',
      summary:
        'Carte mémoire déterministe du démo Advisor — concepts, signaux, recommandations, risques et contradictions, sans appel fournisseur.',
      nodeCount: nodes.length,
      linkCount: links.length,
      realNodeCount: 0,
      exampleNodeCount: 0,
    },
  }
}

// ─── example tagging ──────────────────────────────────────────────────────

export const EXAMPLE_ID_PREFIX = 'example:'

/**
 * Tag every node and link of a graph as illustrative example data.
 * Prefixes IDs with `example:` so they can never collide with real
 * Advisor-memory IDs and so a quick text inspection of any node ID
 * makes the example status obvious.
 */
function withExampleTag(graph: AdvisorGraph): AdvisorGraph {
  const nodes: AdvisorGraphNode[] = graph.nodes.map(node => ({
    ...node,
    id: EXAMPLE_ID_PREFIX + node.id,
    isExample: true,
  }))
  const links: AdvisorGraphLink[] = graph.links.map(link => ({
    ...link,
    source: EXAMPLE_ID_PREFIX + link.source,
    target: EXAMPLE_ID_PREFIX + link.target,
  }))
  return {
    nodes,
    links,
    meta: {
      ...graph.meta,
      origin: 'mixed',
      realNodeCount: 0,
      exampleNodeCount: nodes.length,
    },
  }
}

// ─── adapter from real knowledge endpoints ────────────────────────────────

const TYPE_TO_KIND_RULES: Array<{ test: RegExp; kind: AdvisorGraphNodeKind }> = [
  { test: /snapshot|userfinancialstate/i, kind: 'personal_snapshot' },
  { test: /goal/i, kind: 'goal' },
  { test: /transactioncluster|recurringcommitment|budget/i, kind: 'transaction_cluster' },
  { test: /account/i, kind: 'financial_account' },
  { test: /portfolio|investment|position/i, kind: 'investment' },
  { test: /asset|ticker|sector|region/i, kind: 'asset' },
  { test: /recommendation/i, kind: 'recommendation' },
  { test: /assumption/i, kind: 'assumption' },
  { test: /macrosignal|marketevent|indicator/i, kind: 'market_signal' },
  { test: /newssignal|news/i, kind: 'news_signal' },
  { test: /tweet|social/i, kind: 'social_signal' },
  { test: /formula|mathconcept/i, kind: 'formula' },
  { test: /concept|tradingstrategy|personalfinancerule/i, kind: 'concept' },
  { test: /risk/i, kind: 'risk' },
  { test: /contradiction/i, kind: 'contradiction' },
  { test: /source|provider|sourcedocument|evidence/i, kind: 'source' },
]

const RELATION_TO_KIND_RULES: Array<{ test: RegExp; kind: AdvisorGraphLinkKind }> = [
  { test: /supported_by|reinforces|justifies|generated_recommendation/i, kind: 'supports' },
  { test: /contradicted_by|invalidates/i, kind: 'contradicts' },
  { test: /weakens/i, kind: 'weakens' },
  { test: /derived_from|defines|uses_formula/i, kind: 'derived_from' },
  { test: /requires_assumption/i, kind: 'uses_assumption' },
  { test: /affects|impacts|increases_risk|decreases_risk|affects_asset|affects_sector|affects_goal|mitigates/i, kind: 'affects' },
  { test: /observed_in|mentions|triggered_by/i, kind: 'mentions' },
  { test: /belongs|part_of/i, kind: 'belongs_to' },
  { test: /correlates_with|similar_to|leads_to|causes/i, kind: 'related_to' },
  { test: /explain/i, kind: 'explains' },
]

const inferKind = (type: string): AdvisorGraphNodeKind => {
  for (const rule of TYPE_TO_KIND_RULES) if (rule.test.test(type)) return rule.kind
  return 'unknown'
}

const inferLinkKind = (type: string): AdvisorGraphLinkKind => {
  for (const rule of RELATION_TO_KIND_RULES) if (rule.test.test(type)) return rule.kind
  return 'related_to'
}

const inferFreshness = (recency: number | undefined): AdvisorGraphFreshness => {
  if (recency === undefined) return 'unknown'
  if (recency >= 0.7) return 'fresh'
  if (recency >= 0.3) return 'stale'
  return 'unknown'
}

/**
 * Minimum number of real nodes required for a graph to be considered
 * meaningfully rendered without preview help. Below this threshold and
 * without explicit user opt-in, the adapter returns origin='empty' so
 * the UI can prompt the user instead of silently mixing in examples.
 */
export const MIN_REAL_NODES_FOR_RENDER = 4

interface BuildArgs {
  bundle?: KnowledgeContextBundleResponse | undefined
  query?: KnowledgeQueryResponse | undefined
  stats?: KnowledgeStatsResponse | undefined
  /**
   * Explicit user opt-in to mix curated example nodes into the real
   * graph for illustration. Examples are tagged isExample=true and
   * prefixed with `example:`. Default false.
   */
  preview?: boolean
  /**
   * Override the sparse threshold. Mostly useful for tests.
   * @default MIN_REAL_NODES_FOR_RENDER
   */
  minRealNodes?: number
}

/**
 * Adapter: builds an AdvisorGraph strictly from real Advisor memory.
 *
 * Behavior:
 * - Real data only by default. Origin = 'real' when there are enough
 *   real nodes; 'empty' when memory is too sparse; the UI is responsible
 *   for offering a preview opt-in.
 * - With preview=true, curated example nodes are merged in, all tagged
 *   isExample=true and prefixed with `example:`. Origin = 'mixed'.
 * - Bundle entities/relations are the trunk; query hits add neighborhood.
 * - NEVER silently mixes example data — this is a trust requirement.
 */
export function buildAdvisorGraphFromKnowledge(args: BuildArgs): AdvisorGraph {
  const {
    bundle,
    query,
    stats,
    preview = false,
    minRealNodes = MIN_REAL_NODES_FOR_RENDER,
  } = args

  const nodeMap = new Map<string, AdvisorGraphNode>()
  const linkBag: AdvisorGraphLink[] = []

  const upsertNode = (node: AdvisorGraphNode) => {
    const existing = nodeMap.get(node.id)
    if (!existing) {
      nodeMap.set(node.id, node)
      return
    }
    const merged: AdvisorGraphNode = {
      ...existing,
      ...node,
      confidence: Math.max(existing.confidence ?? 0, node.confidence ?? 0),
      importance: Math.max(existing.importance ?? 0, node.importance ?? 0),
    }
    if (existing.isContradicted || node.isContradicted) merged.isContradicted = true
    nodeMap.set(node.id, merged)
  }

  const ingestRelation = (relation: KnowledgeRelation, sourceLabel?: string) => {
    if (!relation.fromId || !relation.toId) return
    const summary = relation.description ?? sourceLabel
    const link: AdvisorGraphLink = {
      source: relation.fromId,
      target: relation.toId,
      kind: inferLinkKind(relation.type),
      label: relation.label ?? relation.type,
      confidence: relation.confidence,
      strength: relation.weight ?? relation.confidence ?? 0.5,
    }
    if (summary !== undefined) link.summary = summary
    linkBag.push(link)
  }

  const fromContextItem = (
    item: { id: string; type: string; title: string; summary: string; confidence: number; recency: number; provenanceRefs: string[] },
    importanceScale: number,
    forceKind?: AdvisorGraphNodeKind
  ): AdvisorGraphNode => {
    const node: AdvisorGraphNode = {
      id: item.id,
      label: item.title,
      kind: forceKind ?? inferKind(item.type),
      summary: item.summary,
      confidence: item.confidence,
      freshness: inferFreshness(item.recency),
      importance: item.confidence * importanceScale,
    }
    const provenance = item.provenanceRefs[0]
    if (provenance !== undefined) node.source = provenance
    return node
  }

  // Bundle entities (most authoritative)
  if (bundle) {
    for (const entity of bundle.entities) upsertNode(fromContextItem(entity, 1))
    for (const evidence of bundle.evidence) upsertNode(fromContextItem(evidence, 0.9))
    for (const contradiction of bundle.contradictoryEvidence) {
      const node = fromContextItem(contradiction, 1, 'contradiction')
      node.isContradicted = true
      upsertNode(node)
    }
    for (const assumption of bundle.assumptions) {
      upsertNode(fromContextItem(assumption, 0.7, 'assumption'))
    }
    for (const relation of bundle.relations) ingestRelation(relation, 'bundle')
    for (const path of bundle.graphPaths ?? []) {
      for (const step of path.steps) {
        upsertNode({
          id: step.entity.id,
          label: step.entity.label,
          kind: inferKind(step.entity.type),
          summary: step.entity.description,
          confidence: step.entity.confidence,
          freshness: 'fresh',
          source: step.entity.source,
        })
        if (step.viaRelation) ingestRelation(step.viaRelation, `path:${path.pathId}`)
      }
    }
  }

  // Query hits
  if (query) {
    for (const hit of query.hits) {
      upsertNode({
        id: hit.entity.id,
        label: hit.entity.label,
        kind: inferKind(hit.entity.type),
        summary: hit.entity.description,
        confidence: hit.entity.confidence,
        freshness: 'fresh',
        importance: hit.score.total,
        source: hit.entity.source,
      })
      for (const relation of hit.relations) ingestRelation(relation, 'query-hit')
      for (const evidence of hit.evidence) {
        upsertNode({
          id: evidence.id,
          label: evidence.label,
          kind: inferKind(evidence.type),
          summary: evidence.description,
          confidence: evidence.confidence,
          freshness: 'fresh',
          source: evidence.source,
        })
      }
      for (const contradiction of hit.contradictoryEvidence) {
        upsertNode({
          id: contradiction.id,
          label: contradiction.label,
          kind: 'contradiction',
          summary: contradiction.description,
          confidence: contradiction.confidence,
          freshness: 'fresh',
          isContradicted: true,
        })
      }
    }
  }

  // De-dupe + filter dangling links
  const nodes = Array.from(nodeMap.values())
  const validIds = new Set(nodes.map(n => n.id))
  const seenLinks = new Set<string>()
  const links = linkBag.filter(link => {
    if (!validIds.has(link.source) || !validIds.has(link.target)) return false
    const key = `${link.source}::${link.kind}::${link.target}`
    if (seenLinks.has(key)) return false
    seenLinks.add(key)
    return true
  })

  const degraded = bundle?.degraded || query?.degraded || stats?.degraded || false
  const realCount = nodes.length

  // Explicit preview opt-in: merge real (untagged) with example (tagged).
  if (preview) {
    const example = withExampleTag(buildAdvisorDemoGraph())
    const mergedNodes = [...nodes, ...example.nodes]
    const mergedLinks = [...links, ...example.links]
    return {
      nodes: mergedNodes,
      links: mergedLinks,
      meta: {
        origin: 'mixed',
        summary:
          realCount > 0
            ? `Aperçu enrichi — ${realCount} nœud(s) réels combinés à ${example.nodes.length} exemples curés. Les exemples sont marqués « exemple ».`
            : `Aperçu enrichi — uniquement des exemples curés (mémoire réelle vide). Aucun nœud réel n'est affiché.`,
        nodeCount: mergedNodes.length,
        linkCount: mergedLinks.length,
        realNodeCount: realCount,
        exampleNodeCount: example.nodes.length,
        degraded,
      },
    }
  }

  // Sparse real memory: do NOT auto-merge. Surface an empty/sparse origin
  // so the UI can prompt the user. This is the trust-default path.
  if (realCount < minRealNodes) {
    return {
      nodes,
      links,
      meta: {
        origin: 'empty',
        summary:
          realCount === 0
            ? 'Ta mémoire réelle ne contient encore aucune entité visualisable. Lance une mission Advisor ou enrichis la mémoire pour générer plus de relations.'
            : `Ta mémoire réelle contient encore peu de relations visualisables (${realCount} nœud(s), ${links.length} relation(s)). Lance une mission Advisor ou prévisualise avec une démo enrichie pour la suite.`,
        nodeCount: realCount,
        linkCount: links.length,
        realNodeCount: realCount,
        exampleNodeCount: 0,
        degraded,
      },
    }
  }

  // Healthy real graph.
  return {
    nodes,
    links,
    meta: {
      origin: 'real',
      summary: `Mémoire Advisor réelle — ${realCount} nœuds, ${links.length} relations dérivées du bundle et des hits.`,
      nodeCount: realCount,
      linkCount: links.length,
      realNodeCount: realCount,
      exampleNodeCount: 0,
      degraded,
    },
  }
}

// ─── traversal helpers (frontend, undirected over visible links) ──────────

/**
 * Stable key for a graph link, useful as a Set element when highlighting
 * a path or a hovered link. Direction is preserved.
 */
export const linkKey = (link: AdvisorGraphLink): string =>
  `${link.source}::${link.kind}::${link.target}`

/**
 * Build an adjacency map from links. Treats each link as undirected so
 * BFS can walk the graph in either direction (matches user mental model
 * for "what is connected to this concept").
 */
const buildAdjacency = (
  links: ReadonlyArray<AdvisorGraphLink>
): Map<string, Array<{ neighbor: string; link: AdvisorGraphLink }>> => {
  const adj = new Map<string, Array<{ neighbor: string; link: AdvisorGraphLink }>>()
  for (const link of links) {
    if (!adj.has(link.source)) adj.set(link.source, [])
    if (!adj.has(link.target)) adj.set(link.target, [])
    adj.get(link.source)?.push({ neighbor: link.target, link })
    adj.get(link.target)?.push({ neighbor: link.source, link })
  }
  return adj
}

export interface AdvisorGraphPath {
  nodes: AdvisorGraphNode[]
  links: AdvisorGraphLink[]
  /** Pre-computed link keys for quick membership tests in the renderer. */
  linkKeys: Set<string>
  /** Pre-computed node ids for quick membership tests in the renderer. */
  nodeIds: Set<string>
}

/**
 * BFS shortest path between two node ids over the visible links. Returns
 * null when no path exists. Frontend-only — meant for graph sizes shown
 * in the cockpit (a few hundred nodes max).
 */
export function findShortestPath(
  graph: AdvisorGraph,
  fromId: string,
  toId: string
): AdvisorGraphPath | null {
  if (fromId === toId) return null
  const byId = new Map(graph.nodes.map(n => [n.id, n] as const))
  if (!byId.has(fromId) || !byId.has(toId)) return null
  const adj = buildAdjacency(graph.links)
  const cameFrom = new Map<string, { from: string; link: AdvisorGraphLink }>()
  const queue: string[] = [fromId]
  const visited = new Set<string>([fromId])
  while (queue.length > 0) {
    const current = queue.shift() as string
    if (current === toId) break
    const neighbors = adj.get(current) ?? []
    for (const { neighbor, link } of neighbors) {
      if (visited.has(neighbor)) continue
      visited.add(neighbor)
      cameFrom.set(neighbor, { from: current, link })
      queue.push(neighbor)
    }
  }
  if (!cameFrom.has(toId)) return null
  // Walk back to reconstruct the path.
  const pathNodes: AdvisorGraphNode[] = []
  const pathLinks: AdvisorGraphLink[] = []
  let cursor = toId
  while (cursor !== fromId) {
    const node = byId.get(cursor)
    if (node) pathNodes.unshift(node)
    const step = cameFrom.get(cursor)
    if (!step) return null
    pathLinks.unshift(step.link)
    cursor = step.from
  }
  const startNode = byId.get(fromId)
  if (startNode) pathNodes.unshift(startNode)
  return {
    nodes: pathNodes,
    links: pathLinks,
    linkKeys: new Set(pathLinks.map(linkKey)),
    nodeIds: new Set(pathNodes.map(n => n.id)),
  }
}

/**
 * Set of node ids reachable within `depth` BFS steps from `seedId`,
 * inclusive. Used to "isolate this neighborhood" in the renderer.
 */
export function getNeighborhood(
  graph: AdvisorGraph,
  seedId: string,
  depth: number
): Set<string> {
  const adj = buildAdjacency(graph.links)
  const visited = new Set<string>([seedId])
  let frontier: string[] = [seedId]
  for (let i = 0; i < depth; i++) {
    const next: string[] = []
    for (const id of frontier) {
      for (const { neighbor } of adj.get(id) ?? []) {
        if (visited.has(neighbor)) continue
        visited.add(neighbor)
        next.push(neighbor)
      }
    }
    if (next.length === 0) break
    frontier = next
  }
  return visited
}
