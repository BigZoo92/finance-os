export const NEWS_PROVIDER_IDS = [
  'hn_algolia',
  'gdelt_doc',
  'ecb_rss',
  'ecb_data',
  'fed_rss',
  'sec_edgar',
  'fred',
  'alpha_vantage',
] as const

export type NewsProviderId = (typeof NEWS_PROVIDER_IDS)[number]

export const NEWS_SOURCE_TYPES = [
  'media',
  'regulator',
  'central_bank',
  'filing',
  'macro_data',
  'company',
  'gov',
  'industry',
  'blog',
  'tech_forum',
] as const

export type NewsSourceType = (typeof NEWS_SOURCE_TYPES)[number]

export const NEWS_DOMAIN_IDS = [
  'finance',
  'markets',
  'macroeconomy',
  'central_banks',
  'monetary_policy',
  'regulation',
  'legislation',
  'public_policy',
  'geopolitics',
  'conflict',
  'sanctions',
  'diplomacy',
  'supply_chain',
  'logistics',
  'energy',
  'commodities',
  'technology',
  'ai',
  'cybersecurity',
  'product_launches',
  'model_releases',
  'cyber_incidents',
  'earnings',
  'guidance',
  'filings',
  'mna',
  'capital_markets',
  'credit',
  'real_estate',
  'public_health',
  'climate',
  'labor',
  'general_impact',
  'emerging_themes',
] as const

export type NewsDomainId = (typeof NEWS_DOMAIN_IDS)[number]

export const NEWS_EVENT_TYPES = [
  'policy_decision',
  'policy_speech',
  'macro_release',
  'regulatory_action',
  'legislation_update',
  'filing_8k',
  'filing_10q',
  'filing_10k',
  'filing_20f',
  'filing_6k',
  'earnings_result',
  'guidance_update',
  'rating_action',
  'mna_announcement',
  'product_launch',
  'model_release',
  'cyber_incident',
  'supply_disruption',
  'commodity_shock',
  'geopolitical_escalation',
  'sanctions_update',
  'labor_action',
  'public_health_alert',
  'climate_event',
  'market_commentary',
  'general_update',
] as const

export type NewsEventType = (typeof NEWS_EVENT_TYPES)[number]

export const NEWS_RISK_FLAGS = [
  'inflation_risk',
  'rate_risk',
  'growth_risk',
  'liquidity_risk',
  'policy_risk',
  'regulatory_risk',
  'geopolitical_risk',
  'cyber_risk',
  'supply_chain_risk',
  'commodity_price_risk',
  'credit_risk',
  'execution_risk',
  'reputation_risk',
  'labor_risk',
  'public_health_risk',
] as const

export type NewsRiskFlag = (typeof NEWS_RISK_FLAGS)[number]

export const NEWS_OPPORTUNITY_FLAGS = [
  'disinflation_tailwind',
  'rate_relief',
  'policy_support',
  'productivity_upside',
  'innovation_upside',
  'market_share_gain',
  'margin_upside',
  'supply_normalization',
  'capital_markets_opening',
  'credit_improvement',
] as const

export type NewsOpportunityFlag = (typeof NEWS_OPPORTUNITY_FLAGS)[number]

export const NEWS_SCORE_LABELS = ['low', 'medium', 'high', 'critical'] as const

export type NewsScoreLabel = (typeof NEWS_SCORE_LABELS)[number]

export const NEWS_CONTEXT_BUNDLE_RANGES = ['24h', '7d', '30d'] as const

export type NewsContextBundleRange = (typeof NEWS_CONTEXT_BUNDLE_RANGES)[number]

export const NEWS_PROVIDER_LABELS: Record<NewsProviderId, string> = {
  hn_algolia: 'Hacker News Algolia',
  gdelt_doc: 'GDELT DOC 2.0',
  ecb_rss: 'ECB RSS',
  ecb_data: 'ECB Data Portal',
  fed_rss: 'Federal Reserve RSS',
  sec_edgar: 'SEC EDGAR',
  fred: 'FRED',
  alpha_vantage: 'Alpha Vantage',
}

export const NEWS_SOURCE_TYPE_BY_PROVIDER: Record<NewsProviderId, NewsSourceType> = {
  hn_algolia: 'tech_forum',
  gdelt_doc: 'media',
  ecb_rss: 'central_bank',
  ecb_data: 'macro_data',
  fed_rss: 'central_bank',
  sec_edgar: 'filing',
  fred: 'macro_data',
  alpha_vantage: 'macro_data',
}
