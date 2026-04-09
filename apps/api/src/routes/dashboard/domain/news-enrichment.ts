import {
  NEWS_SOURCE_TYPE_BY_PROVIDER,
  type NewsDomainId,
  type NewsEventType,
  type NewsOpportunityFlag,
  type NewsRiskFlag,
} from './news-taxonomy'
import type {
  NewsAffectedEntity,
  NewsLinkRef,
  NewsProviderRawItem,
  NewsSourceReferenceDraft,
  NewsTransmissionHypothesis,
  NormalizedNewsSignalDraft,
} from './news-types'
import {
  canonicalizeUrl,
  clampScore,
  extractHostname,
  normalizeNewsTitle,
  normalizeWhitespace,
  scoreRecency,
  toStableHash,
  trimToLength,
  uniqueStrings,
} from './news-helpers'

type KeywordRule<T extends string> = {
  id: T
  keywords: RegExp[]
}

type EntityRule = {
  name: string
  aliases: RegExp[]
  type: NewsAffectedEntity['type']
  tickers?: string[]
  sectors?: string[]
  themes?: string[]
}

const DOMAIN_RULES: Array<
  KeywordRule<NewsDomainId> & {
    categories: string[]
    subcategories: string[]
  }
> = [
  {
    id: 'finance',
    keywords: [/finance/i, /asset management/i, /wealth/i, /portfolio/i],
    categories: ['finance'],
    subcategories: ['personal-finance'],
  },
  {
    id: 'markets',
    keywords: [/stocks?/i, /equit/i, /market/i, /index/i, /bond/i, /volatility/i],
    categories: ['markets'],
    subcategories: ['market-structure'],
  },
  {
    id: 'macroeconomy',
    keywords: [/inflation/i, /gdp/i, /cpi/i, /ppi/i, /pmi/i, /jobs report/i, /unemployment/i],
    categories: ['macro'],
    subcategories: ['macro-release'],
  },
  {
    id: 'central_banks',
    keywords: [/ecb/i, /\bfed\b/i, /federal reserve/i, /central bank/i, /bank of england/i],
    categories: ['macro'],
    subcategories: ['central-bank'],
  },
  {
    id: 'monetary_policy',
    keywords: [/rate cut/i, /rate hike/i, /policy rate/i, /hawkish/i, /dovish/i],
    categories: ['macro'],
    subcategories: ['monetary-policy'],
  },
  {
    id: 'regulation',
    keywords: [/regulat/i, /supervis/i, /\bsec\b/i, /\becb\b/i, /antitrust/i],
    categories: ['policy'],
    subcategories: ['regulation'],
  },
  {
    id: 'legislation',
    keywords: [/bill/i, /lawmakers/i, /parliament/i, /congress/i, /legislation/i],
    categories: ['policy'],
    subcategories: ['legislation'],
  },
  {
    id: 'public_policy',
    keywords: [/industrial policy/i, /subsid/i, /public policy/i, /government spending/i],
    categories: ['policy'],
    subcategories: ['public-policy'],
  },
  {
    id: 'geopolitics',
    keywords: [/geopolit/i, /border/i, /foreign policy/i, /security/i],
    categories: ['geopolitics'],
    subcategories: ['geopolitics'],
  },
  {
    id: 'conflict',
    keywords: [/conflict/i, /war/i, /military/i, /attack/i],
    categories: ['geopolitics'],
    subcategories: ['conflict'],
  },
  {
    id: 'sanctions',
    keywords: [/sanction/i, /export control/i, /blacklist/i],
    categories: ['geopolitics'],
    subcategories: ['sanctions'],
  },
  {
    id: 'diplomacy',
    keywords: [/summit/i, /trade talks/i, /diplom/i, /ceasefire/i],
    categories: ['geopolitics'],
    subcategories: ['diplomacy'],
  },
  {
    id: 'supply_chain',
    keywords: [/supply chain/i, /factory shutdown/i, /semiconductor shortage/i, /reshor/i],
    categories: ['real-economy'],
    subcategories: ['supply-chain'],
  },
  {
    id: 'logistics',
    keywords: [/shipping/i, /freight/i, /port/i, /logistics/i, /cargo/i],
    categories: ['real-economy'],
    subcategories: ['logistics'],
  },
  {
    id: 'energy',
    keywords: [/oil/i, /gas/i, /lng/i, /electricity/i, /nuclear/i, /renewable/i],
    categories: ['commodities'],
    subcategories: ['energy'],
  },
  {
    id: 'commodities',
    keywords: [/commodity/i, /copper/i, /wheat/i, /gold/i, /iron ore/i],
    categories: ['commodities'],
    subcategories: ['commodities'],
  },
  {
    id: 'technology',
    keywords: [/software/i, /semiconductor/i, /cloud/i, /developer/i, /startup/i],
    categories: ['technology'],
    subcategories: ['technology'],
  },
  {
    id: 'ai',
    keywords: [/artificial intelligence/i, /\bai\b/i, /\bllm\b/i, /foundation model/i, /agentic/i],
    categories: ['technology'],
    subcategories: ['ai'],
  },
  {
    id: 'cybersecurity',
    keywords: [/cyber/i, /ransomware/i, /malware/i, /breach/i, /security incident/i],
    categories: ['technology'],
    subcategories: ['cybersecurity'],
  },
  {
    id: 'product_launches',
    keywords: [/launch/i, /unveil/i, /rollout/i, /introduce/i],
    categories: ['corporate'],
    subcategories: ['product-launch'],
  },
  {
    id: 'model_releases',
    keywords: [/model release/i, /new model/i, /gpt/i, /claude/i, /gemini/i],
    categories: ['technology'],
    subcategories: ['model-release'],
  },
  {
    id: 'cyber_incidents',
    keywords: [/breach/i, /outage/i, /ddos/i, /intrusion/i, /data leak/i],
    categories: ['technology'],
    subcategories: ['cyber-incident'],
  },
  {
    id: 'earnings',
    keywords: [/earnings/i, /quarterly results/i, /revenue/i, /ebitda/i],
    categories: ['corporate'],
    subcategories: ['earnings'],
  },
  {
    id: 'guidance',
    keywords: [/guidance/i, /outlook/i, /forecast/i],
    categories: ['corporate'],
    subcategories: ['guidance'],
  },
  {
    id: 'filings',
    keywords: [/\b8-k\b/i, /\b10-k\b/i, /\b10-q\b/i, /\b20-f\b/i, /\b6-k\b/i, /filing/i],
    categories: ['corporate'],
    subcategories: ['filings'],
  },
  {
    id: 'mna',
    keywords: [/acqui/i, /merger/i, /\bm&a\b/i, /takeover/i],
    categories: ['corporate'],
    subcategories: ['m-and-a'],
  },
  {
    id: 'capital_markets',
    keywords: [/ipo/i, /secondary offering/i, /bond sale/i, /capital raise/i],
    categories: ['corporate'],
    subcategories: ['capital-markets'],
  },
  {
    id: 'credit',
    keywords: [/default/i, /downgrade/i, /upgrade/i, /credit/i, /solvency/i, /spread/i],
    categories: ['finance'],
    subcategories: ['credit'],
  },
  {
    id: 'real_estate',
    keywords: [/housing/i, /mortgage/i, /property/i, /real estate/i, /commercial real estate/i],
    categories: ['real-economy'],
    subcategories: ['real-estate'],
  },
  {
    id: 'public_health',
    keywords: [/pandemic/i, /outbreak/i, /health emergency/i, /public health/i],
    categories: ['society'],
    subcategories: ['public-health'],
  },
  {
    id: 'climate',
    keywords: [/wildfire/i, /flood/i, /storm/i, /hurricane/i, /earthquake/i, /heatwave/i],
    categories: ['society'],
    subcategories: ['climate'],
  },
  {
    id: 'labor',
    keywords: [/strike/i, /union/i, /labor/i, /walkout/i],
    categories: ['society'],
    subcategories: ['labor'],
  },
  {
    id: 'general_impact',
    keywords: [/consumer/i, /spending/i, /demand/i, /sentiment/i],
    categories: ['cross-domain'],
    subcategories: ['general-impact'],
  },
  {
    id: 'emerging_themes',
    keywords: [/robotaxi/i, /tokenization/i, /stablecoin/i, /quantum/i],
    categories: ['cross-domain'],
    subcategories: ['emerging'],
  },
]

const EVENT_RULES: Array<KeywordRule<NewsEventType>> = [
  { id: 'policy_decision', keywords: [/rate decision/i, /policy decision/i, /cuts? rates?/i, /raises? rates?/i] },
  { id: 'policy_speech', keywords: [/speech/i, /remarks/i, /testimony/i, /minutes/i] },
  { id: 'macro_release', keywords: [/cpi/i, /ppi/i, /gdp/i, /jobs report/i, /unemployment/i, /pmi/i] },
  { id: 'regulatory_action', keywords: [/investigation/i, /settlement/i, /fine/i, /rulemaking/i, /supervisory/i] },
  { id: 'legislation_update', keywords: [/bill/i, /senate/i, /congress/i, /parliament/i, /lawmakers/i] },
  { id: 'filing_8k', keywords: [/\b8-k\b/i] },
  { id: 'filing_10q', keywords: [/\b10-q\b/i] },
  { id: 'filing_10k', keywords: [/\b10-k\b/i] },
  { id: 'filing_20f', keywords: [/\b20-f\b/i] },
  { id: 'filing_6k', keywords: [/\b6-k\b/i] },
  { id: 'earnings_result', keywords: [/earnings/i, /quarterly results/i, /beats estimates/i, /misses estimates/i] },
  { id: 'guidance_update', keywords: [/guidance/i, /outlook/i, /forecast/i] },
  { id: 'rating_action', keywords: [/downgrade/i, /upgrade/i, /credit watch/i] },
  { id: 'mna_announcement', keywords: [/acquire/i, /acquisition/i, /merger/i, /takeover/i] },
  { id: 'product_launch', keywords: [/launch/i, /unveil/i, /release new product/i] },
  { id: 'model_release', keywords: [/model/i, /\bllm\b/i, /claude/i, /gpt/i, /gemini/i] },
  { id: 'cyber_incident', keywords: [/ransomware/i, /breach/i, /leak/i, /outage/i, /cyberattack/i] },
  { id: 'supply_disruption', keywords: [/disruption/i, /shortage/i, /factory shutdown/i, /port closure/i] },
  { id: 'commodity_shock', keywords: [/oil spike/i, /gas spike/i, /commodity shock/i] },
  { id: 'geopolitical_escalation', keywords: [/escalat/i, /military/i, /attack/i, /missile/i] },
  { id: 'sanctions_update', keywords: [/sanction/i, /export control/i, /tariff/i] },
  { id: 'labor_action', keywords: [/strike/i, /walkout/i, /union action/i] },
  { id: 'public_health_alert', keywords: [/outbreak/i, /public health/i, /pandemic/i] },
  { id: 'climate_event', keywords: [/wildfire/i, /flood/i, /storm/i, /hurricane/i] },
  { id: 'market_commentary', keywords: [/market wrap/i, /analysts say/i, /strategy note/i] },
]

const RISK_RULES: Array<KeywordRule<NewsRiskFlag>> = [
  { id: 'inflation_risk', keywords: [/inflation/i, /price pressure/i] },
  { id: 'rate_risk', keywords: [/rate hike/i, /higher for longer/i, /yield spike/i] },
  { id: 'growth_risk', keywords: [/recession/i, /slowdown/i, /contraction/i] },
  { id: 'liquidity_risk', keywords: [/liquidity/i, /funding stress/i, /bank run/i] },
  { id: 'policy_risk', keywords: [/policy uncertainty/i, /policy risk/i, /hawkish/i] },
  { id: 'regulatory_risk', keywords: [/regulator/i, /investigation/i, /antitrust/i, /compliance/i] },
  { id: 'geopolitical_risk', keywords: [/war/i, /sanction/i, /geopolit/i] },
  { id: 'cyber_risk', keywords: [/cyber/i, /breach/i, /ransomware/i] },
  { id: 'supply_chain_risk', keywords: [/supply chain/i, /port closure/i, /shortage/i] },
  { id: 'commodity_price_risk', keywords: [/oil/i, /gas/i, /commodity/i] },
  { id: 'credit_risk', keywords: [/default/i, /downgrade/i, /insolvency/i] },
  { id: 'execution_risk', keywords: [/delay/i, /recall/i, /missed target/i] },
  { id: 'reputation_risk', keywords: [/backlash/i, /boycott/i, /controversy/i] },
  { id: 'labor_risk', keywords: [/strike/i, /labor action/i] },
  { id: 'public_health_risk', keywords: [/outbreak/i, /pandemic/i, /health emergency/i] },
]

const OPPORTUNITY_RULES: Array<KeywordRule<NewsOpportunityFlag>> = [
  { id: 'disinflation_tailwind', keywords: [/cooling inflation/i, /disinflation/i] },
  { id: 'rate_relief', keywords: [/rate cut/i, /dovish/i, /lower yields/i] },
  { id: 'policy_support', keywords: [/stimulus/i, /subsid/i, /policy support/i] },
  { id: 'productivity_upside', keywords: [/automation/i, /productivity/i, /efficiency/i] },
  { id: 'innovation_upside', keywords: [/breakthrough/i, /new model/i, /new platform/i] },
  { id: 'market_share_gain', keywords: [/market share/i, /customer wins/i, /share gain/i] },
  { id: 'margin_upside', keywords: [/margin expansion/i, /cost savings/i, /pricing power/i] },
  { id: 'supply_normalization', keywords: [/normalizing supply/i, /bottleneck easing/i] },
  { id: 'capital_markets_opening', keywords: [/ipo window/i, /bond issuance/i, /capital markets reopen/i] },
  { id: 'credit_improvement', keywords: [/upgrade/i, /spreads tighten/i, /credit improvement/i] },
]

const ENTITY_RULES: EntityRule[] = [
  {
    name: 'Federal Reserve',
    aliases: [/\bfed\b/i, /federal reserve/i],
    type: 'institution',
    themes: ['rates', 'usd-liquidity'],
  },
  {
    name: 'European Central Bank',
    aliases: [/\becb\b/i, /european central bank/i],
    type: 'institution',
    themes: ['euro-area', 'rates'],
  },
  {
    name: 'SEC',
    aliases: [/\bsec\b/i, /securities and exchange commission/i],
    type: 'regulator',
    themes: ['regulation'],
  },
  {
    name: 'Anthropic',
    aliases: [/anthropic/i, /claude/i],
    type: 'company',
    sectors: ['AI software'],
    themes: ['ai', 'model-platforms'],
  },
  {
    name: 'OpenAI',
    aliases: [/openai/i, /chatgpt/i, /\bgpt\b/i],
    type: 'company',
    sectors: ['AI software'],
    themes: ['ai', 'model-platforms'],
  },
  {
    name: 'Microsoft',
    aliases: [/microsoft/i, /\bmsft\b/i, /azure/i],
    type: 'company',
    tickers: ['MSFT'],
    sectors: ['Cloud software'],
    themes: ['cloud', 'ai'],
  },
  {
    name: 'Amazon',
    aliases: [/amazon/i, /\bamzn\b/i, /\baws\b/i],
    type: 'company',
    tickers: ['AMZN'],
    sectors: ['Cloud software', 'E-commerce'],
    themes: ['cloud', 'consumer'],
  },
  {
    name: 'Alphabet',
    aliases: [/alphabet/i, /google/i, /gemini/i],
    type: 'company',
    tickers: ['GOOGL'],
    sectors: ['Internet platforms'],
    themes: ['ai', 'search'],
  },
  {
    name: 'NVIDIA',
    aliases: [/nvidia/i, /\bnvda\b/i],
    type: 'company',
    tickers: ['NVDA'],
    sectors: ['Semiconductors'],
    themes: ['ai', 'chips'],
  },
  {
    name: 'Apple',
    aliases: [/apple/i, /\baapl\b/i],
    type: 'company',
    tickers: ['AAPL'],
    sectors: ['Consumer hardware'],
    themes: ['consumer-tech'],
  },
  {
    name: 'Tesla',
    aliases: [/tesla/i, /\btsla\b/i],
    type: 'company',
    tickers: ['TSLA'],
    sectors: ['Automotive'],
    themes: ['ev', 'automation'],
  },
  {
    name: 'Meta',
    aliases: [/\bmeta\b/i, /facebook/i],
    type: 'company',
    tickers: ['META'],
    sectors: ['Internet platforms'],
    themes: ['ai', 'ads'],
  },
  {
    name: 'Taiwan',
    aliases: [/taiwan/i],
    type: 'country',
    sectors: ['Semiconductors'],
    themes: ['geopolitics', 'supply-chain'],
  },
  {
    name: 'China',
    aliases: [/\bchina\b/i, /beijing/i],
    type: 'country',
    sectors: ['Industrial', 'Technology'],
    themes: ['geopolitics', 'trade'],
  },
  {
    name: 'United States',
    aliases: [/\bu\.?s\.?\b/i, /\bunited states\b/i, /\bwashington\b/i],
    type: 'country',
    themes: ['policy', 'macro'],
  },
  {
    name: 'European Union',
    aliases: [/\beu\b/i, /european union/i, /brussels/i],
    type: 'institution',
    themes: ['policy', 'regulation'],
  },
  {
    name: 'Oil',
    aliases: [/\boil\b/i, /\bbrent\b/i, /\bwti\b/i],
    type: 'commodity',
    sectors: ['Energy'],
    themes: ['energy'],
  },
  {
    name: 'Natural Gas',
    aliases: [/natural gas/i, /\blng\b/i, /\bgas\b/i],
    type: 'commodity',
    sectors: ['Energy'],
    themes: ['energy'],
  },
]

const SECTOR_RULES = [
  { sector: 'Financials', patterns: [/bank/i, /asset manager/i, /insurer/i] },
  { sector: 'Energy', patterns: [/oil/i, /gas/i, /energy/i, /lng/i] },
  { sector: 'Semiconductors', patterns: [/chip/i, /semiconductor/i, /gpu/i] },
  { sector: 'Cloud software', patterns: [/cloud/i, /saas/i, /data center/i] },
  { sector: 'AI software', patterns: [/\bai\b/i, /model/i, /agentic/i, /copilot/i] },
  { sector: 'Cybersecurity', patterns: [/cyber/i, /breach/i, /security/i] },
  { sector: 'Industrials', patterns: [/manufactur/i, /factory/i, /industrial/i] },
  { sector: 'Real estate', patterns: [/real estate/i, /property/i, /housing/i, /mortgage/i] },
  { sector: 'Utilities', patterns: [/electricity/i, /grid/i, /utility/i] },
  { sector: 'Healthcare', patterns: [/health/i, /pharma/i, /biotech/i] },
  { sector: 'Transportation', patterns: [/shipping/i, /freight/i, /port/i, /airline/i] },
]

const THEME_RULES = [
  { theme: 'inflation', patterns: [/inflation/i, /\bcpi\b/i, /\bppi\b/i] },
  { theme: 'rates', patterns: [/rate/i, /yield/i, /hawkish/i, /dovish/i] },
  { theme: 'geopolitics', patterns: [/geopolit/i, /war/i, /sanction/i] },
  { theme: 'ai', patterns: [/\bai\b/i, /claude/i, /gpt/i, /gemini/i] },
  { theme: 'cyber', patterns: [/cyber/i, /ransomware/i, /breach/i] },
  { theme: 'supply-chain', patterns: [/supply chain/i, /port/i, /shortage/i] },
  { theme: 'consumer', patterns: [/consumer/i, /retail/i, /spending/i] },
  { theme: 'credit', patterns: [/credit/i, /default/i, /downgrade/i] },
]

const REGIONAL_RULES = [
  { country: 'US', region: 'north_america', patterns: [/\bu\.?s\.?\b/i, /\bunited states\b/i, /washington/i] },
  { country: 'EU', region: 'europe', patterns: [/\beu\b/i, /europe/i, /brussels/i] },
  { country: 'CN', region: 'asia', patterns: [/\bchina\b/i, /beijing/i] },
  { country: 'TW', region: 'asia', patterns: [/taiwan/i] },
  { country: 'JP', region: 'asia', patterns: [/japan/i, /tokyo/i] },
  { country: 'UK', region: 'europe', patterns: [/\buk\b/i, /britain/i, /london/i] },
]

const matchesAny = (text: string, patterns: RegExp[]) => {
  return patterns.some(pattern => pattern.test(text))
}

const addUnique = <T>(target: T[], value: T) => {
  if (!target.includes(value)) {
    target.push(value)
  }
}

const collectRules = <T extends string>(text: string, rules: Array<KeywordRule<T>>) => {
  return rules.filter(rule => matchesAny(text, rule.keywords)).map(rule => rule.id)
}

const inferDomains = (text: string) => {
  const domains: NewsDomainId[] = []
  const categories: string[] = []
  const subcategories: string[] = []

  for (const rule of DOMAIN_RULES) {
    if (!matchesAny(text, rule.keywords)) {
      continue
    }

    addUnique(domains, rule.id)
    for (const category of rule.categories) {
      addUnique(categories, category)
    }
    for (const subcategory of rule.subcategories) {
      addUnique(subcategories, subcategory)
    }
  }

  if (domains.length === 0) {
    domains.push('general_impact')
    categories.push('cross-domain')
    subcategories.push('general-impact')
  }

  return { domains, categories, subcategories }
}

const inferEventType = (text: string): NewsEventType => {
  for (const rule of EVENT_RULES) {
    if (matchesAny(text, rule.keywords)) {
      return rule.id
    }
  }

  return 'general_update'
}

const inferEntities = (text: string) => {
  const entities: NewsAffectedEntity[] = []
  const tickers: string[] = []
  const sectors: string[] = []
  const themes: string[] = []

  for (const rule of ENTITY_RULES) {
    if (!matchesAny(text, rule.aliases)) {
      continue
    }

    entities.push({
      name: rule.name,
      type: rule.type,
      role: entities.length === 0 ? 'primary' : 'affected',
      confidence: rule.type === 'company' || rule.type === 'institution' ? 85 : 72,
    })

    for (const ticker of rule.tickers ?? []) {
      addUnique(tickers, ticker)
    }

    for (const sector of rule.sectors ?? []) {
      addUnique(sectors, sector)
    }

    for (const theme of rule.themes ?? []) {
      addUnique(themes, theme)
    }
  }

  return { entities, tickers, sectors, themes }
}

const inferSectors = (text: string) => {
  const sectors: string[] = []

  for (const rule of SECTOR_RULES) {
    if (matchesAny(text, rule.patterns)) {
      addUnique(sectors, rule.sector)
    }
  }

  return sectors
}

const inferThemes = (text: string) => {
  const themes: string[] = []

  for (const rule of THEME_RULES) {
    if (matchesAny(text, rule.patterns)) {
      addUnique(themes, rule.theme)
    }
  }

  return themes
}

const inferRiskFlags = (text: string) => {
  return collectRules(text, RISK_RULES)
}

const inferOpportunityFlags = (text: string) => {
  return collectRules(text, OPPORTUNITY_RULES)
}

const inferRegion = (text: string) => {
  for (const rule of REGIONAL_RULES) {
    if (matchesAny(text, rule.patterns)) {
      return {
        country: rule.country,
        region: rule.region,
      }
    }
  }

  return {
    country: null,
    region: null,
  }
}

const buildMacroLinks = (params: {
  eventType: NewsEventType
  domains: NewsDomainId[]
  url: string | null
}) => {
  const links: NewsLinkRef[] = []

  if (
    params.url &&
    (params.domains.includes('macroeconomy') ||
      params.domains.includes('central_banks') ||
      params.eventType === 'macro_release')
  ) {
    links.push({
      label: 'primary-source',
      url: params.url,
    })
  }

  return links
}

const buildPolicyLinks = (params: {
  sourceType: string
  eventType: NewsEventType
  url: string | null
}) => {
  if (
    !params.url ||
    !(
      params.sourceType === 'regulator' ||
      params.sourceType === 'central_bank' ||
      params.eventType === 'policy_decision' ||
      params.eventType === 'regulatory_action'
    )
  ) {
    return []
  }

  return [
    {
      label: 'policy-source',
      url: params.url,
    },
  ]
}

const buildFilingLinks = (params: {
  eventType: NewsEventType
  sourceType: string
  url: string | null
}) => {
  if (!params.url || !(params.sourceType === 'filing' || params.eventType.startsWith('filing_'))) {
    return []
  }

  return [
    {
      label: 'filing-source',
      url: params.url,
    },
  ]
}

const buildTransmissionHypotheses = (params: {
  domains: NewsDomainId[]
  eventType: NewsEventType
  riskFlags: NewsRiskFlag[]
  opportunityFlags: NewsOpportunityFlag[]
  sectors: string[]
}) => {
  const hypotheses: NewsTransmissionHypothesis[] = []

  if (params.domains.includes('monetary_policy') || params.domains.includes('central_banks')) {
    hypotheses.push({
      id: 'rates-repricing',
      label: 'Rate path repricing can move duration, FX and growth expectations.',
      direction: params.opportunityFlags.includes('rate_relief') ? 'opportunity' : 'risk',
      confidence: 82,
    })
  }

  if (params.domains.includes('energy') || params.domains.includes('commodities')) {
    hypotheses.push({
      id: 'input-cost-pass-through',
      label: 'Commodity shocks can pass through to margins, inflation and discretionary spending.',
      direction: 'risk',
      confidence: 78,
    })
  }

  if (params.eventType === 'model_release' || params.eventType === 'product_launch') {
    hypotheses.push({
      id: 'competitive-repricing',
      label: 'New product capabilities can shift pricing power and market-share assumptions.',
      direction: params.opportunityFlags.length > 0 ? 'opportunity' : 'mixed',
      confidence: 74,
    })
  }

  if (params.eventType === 'cyber_incident') {
    hypotheses.push({
      id: 'operational-downtime',
      label: 'Cyber incidents can create downtime, remediation costs and regulatory follow-through.',
      direction: 'risk',
      confidence: 86,
    })
  }

  if (params.sectors.includes('Semiconductors') && params.domains.includes('geopolitics')) {
    hypotheses.push({
      id: 'hardware-supply-fragility',
      label: 'Geopolitical tension around semiconductor supply can spill into cloud, AI and industrial capex.',
      direction: 'risk',
      confidence: 80,
    })
  }

  return hypotheses
}

const buildWhyItMatters = (params: {
  sourceType: string
  eventType: NewsEventType
  domains: NewsDomainId[]
  sectors: string[]
  tickers: string[]
  riskFlags: NewsRiskFlag[]
  opportunityFlags: NewsOpportunityFlag[]
}) => {
  const reasons: string[] = []

  if (params.sourceType === 'central_bank') {
    reasons.push('Central-bank communication can move rates, FX and duration-sensitive assets quickly.')
  }

  if (params.sourceType === 'filing') {
    reasons.push('Primary filings often carry higher signal quality than secondary commentary.')
  }

  if (params.eventType === 'earnings_result' || params.eventType === 'guidance_update') {
    reasons.push('Corporate prints and guidance can reset sector narratives and forward estimates.')
  }

  if (params.domains.includes('geopolitics') || params.domains.includes('sanctions')) {
    reasons.push('Geopolitical shifts can transmit through energy, supply chains and risk appetite.')
  }

  if (params.riskFlags.includes('cyber_risk')) {
    reasons.push('Cyber events can combine operational disruption, liability and reputational damage.')
  }

  if (params.opportunityFlags.includes('innovation_upside')) {
    reasons.push('Innovation catalysts can pull forward productivity and market-share assumptions.')
  }

  if (params.sectors.length > 0) {
    reasons.push(`Likely spillover sectors: ${params.sectors.slice(0, 3).join(', ')}.`)
  }

  if (params.tickers.length > 0) {
    reasons.push(`Directly named or inferred listed exposure: ${params.tickers.slice(0, 4).join(', ')}.`)
  }

  return reasons.slice(0, 4)
}

const scoreSignal = (params: {
  sourceType: string
  eventType: NewsEventType
  domains: NewsDomainId[]
  riskFlags: NewsRiskFlag[]
  opportunityFlags: NewsOpportunityFlag[]
  entities: NewsAffectedEntity[]
  tickers: string[]
  sectors: string[]
  recencyScore: number
}) => {
  const reasons: string[] = []
  let severity = 12
  let confidence =
    params.sourceType === 'central_bank' || params.sourceType === 'regulator' || params.sourceType === 'filing'
      ? 88
      : params.sourceType === 'macro_data'
        ? 84
        : params.sourceType === 'tech_forum'
          ? 58
          : 70
  let novelty = 42
  let marketImpactScore = 18
  let relevanceScore = 20 + params.recencyScore

  if (
    params.eventType === 'policy_decision' ||
    params.eventType === 'macro_release' ||
    params.eventType === 'geopolitical_escalation'
  ) {
    severity += 28
    marketImpactScore += 32
    reasons.push('high-sensitivity event type')
  }

  if (params.eventType === 'cyber_incident' || params.eventType === 'sanctions_update') {
    severity += 24
    marketImpactScore += 22
    reasons.push('cross-domain operational risk')
  }

  if (params.eventType.startsWith('filing_') || params.eventType === 'earnings_result') {
    marketImpactScore += 18
    confidence += 6
    reasons.push('primary-source corporate disclosure')
  }

  if (params.domains.includes('central_banks') || params.domains.includes('monetary_policy')) {
    marketImpactScore += 24
    relevanceScore += 20
    reasons.push('macro policy relevance')
  }

  if (params.domains.includes('geopolitics') || params.domains.includes('supply_chain')) {
    marketImpactScore += 16
    relevanceScore += 12
    reasons.push('second-order transmission risk')
  }

  if (params.domains.includes('ai') || params.domains.includes('cybersecurity')) {
    novelty += 12
    relevanceScore += 10
    reasons.push('technology regime shift relevance')
  }

  if (params.entities.length > 0) {
    severity += 8
    relevanceScore += 8
  }

  if (params.tickers.length > 0) {
    marketImpactScore += 10
    relevanceScore += 10
  }

  if (params.sectors.length >= 2) {
    marketImpactScore += 8
    reasons.push('multi-sector spillover')
  }

  if (params.riskFlags.length > 0) {
    severity += Math.min(18, params.riskFlags.length * 6)
    relevanceScore += Math.min(16, params.riskFlags.length * 4)
  }

  if (params.opportunityFlags.length > 0) {
    novelty += Math.min(14, params.opportunityFlags.length * 4)
    relevanceScore += Math.min(12, params.opportunityFlags.length * 3)
  }

  novelty += Math.min(18, params.recencyScore / 2)
  relevanceScore += params.recencyScore
  marketImpactScore += Math.round(params.recencyScore * 0.7)

  return {
    severity: clampScore(severity),
    confidence: clampScore(confidence),
    novelty: clampScore(novelty),
    marketImpactScore: clampScore(marketImpactScore),
    relevanceScore: clampScore(relevanceScore),
    reasons: uniqueStrings(reasons),
  }
}

const resolveTopic = (domains: NewsDomainId[], eventType: NewsEventType) => {
  if (eventType.startsWith('filing_')) {
    return 'filings'
  }

  return domains[0] ?? 'general_impact'
}

export const createNormalizedNewsSignal = (
  raw: NewsProviderRawItem,
  now = new Date()
): NormalizedNewsSignalDraft => {
  const canonicalUrl = canonicalizeUrl(raw.canonicalUrl ?? raw.providerUrl)
  const sourceDomain =
    raw.sourceDomain ?? extractHostname(canonicalUrl) ?? extractHostname(raw.providerUrl) ?? 'unknown'
  const normalizedTitle = normalizeNewsTitle(raw.title)
  const textBlob = normalizeWhitespace(
    [
      raw.title,
      raw.summary ?? '',
      raw.contentSnippet ?? '',
      sourceDomain,
      raw.sourceName,
      raw.metadata ? JSON.stringify(raw.metadata) : '',
    ].join(' ')
  )
  const domainsResult = inferDomains(textBlob)
  const eventType = inferEventType(textBlob)
  const entitiesResult = inferEntities(textBlob)
  const sectors = uniqueStrings([...entitiesResult.sectors, ...inferSectors(textBlob)])
  const themes = uniqueStrings([...entitiesResult.themes, ...inferThemes(textBlob)])
  const riskFlags = inferRiskFlags(textBlob)
  const opportunityFlags = inferOpportunityFlags(textBlob)
  const regionResult = inferRegion(textBlob)
  const recencyScore = scoreRecency(raw.publishedAt, now)
  const transmissionHypotheses = buildTransmissionHypotheses({
    domains: domainsResult.domains,
    eventType,
    riskFlags,
    opportunityFlags,
    sectors,
  })
  const scored = scoreSignal({
    sourceType: raw.sourceType,
    eventType,
    domains: domainsResult.domains,
    riskFlags,
    opportunityFlags,
    entities: entitiesResult.entities,
    tickers: entitiesResult.tickers,
    sectors,
    recencyScore,
  })
  const canonicalFingerprint = canonicalUrl ? toStableHash(canonicalUrl, 24) : null
  const titleFingerprint = toStableHash(normalizedTitle, 24)
  const eventClusterId = toStableHash(
    [
      eventType,
      domainsResult.domains[0] ?? 'general_impact',
      entitiesResult.entities[0]?.name ?? sourceDomain,
      raw.publishedAt.toISOString().slice(0, 10),
    ].join('|'),
    20
  )

  return {
    provider: raw.provider,
    providerArticleId: raw.providerArticleId,
    providerUrl: raw.providerUrl,
    canonicalUrl,
    sourceName: raw.sourceName,
    sourceDomain,
    sourceType: raw.sourceType ?? NEWS_SOURCE_TYPE_BY_PROVIDER[raw.provider],
    title: trimToLength(raw.title, 240),
    normalizedTitle,
    summary: raw.summary ? trimToLength(raw.summary, 420) : null,
    contentSnippet: raw.contentSnippet ? trimToLength(raw.contentSnippet, 500) : null,
    topic: resolveTopic(domainsResult.domains, eventType),
    language: raw.language || 'en',
    country: raw.country ?? regionResult.country,
    region: raw.region ?? regionResult.region,
    geoScope: raw.geoScope,
    domains: domainsResult.domains,
    categories: domainsResult.categories,
    subcategories: domainsResult.subcategories,
    eventType,
    severity: scored.severity,
    confidence: scored.confidence,
    novelty: scored.novelty,
    marketImpactScore: scored.marketImpactScore,
    relevanceScore: scored.relevanceScore,
    riskFlags,
    opportunityFlags,
    affectedEntities: entitiesResult.entities,
    affectedTickers: entitiesResult.tickers,
    affectedSectors: sectors,
    affectedThemes: themes,
    transmissionHypotheses,
    macroLinks: buildMacroLinks({
      eventType,
      domains: domainsResult.domains,
      url: canonicalUrl ?? raw.providerUrl,
    }),
    policyLinks: buildPolicyLinks({
      sourceType: raw.sourceType,
      eventType,
      url: canonicalUrl ?? raw.providerUrl,
    }),
    filingLinks: buildFilingLinks({
      eventType,
      sourceType: raw.sourceType,
      url: canonicalUrl ?? raw.providerUrl,
    }),
    whyItMatters: buildWhyItMatters({
      sourceType: raw.sourceType,
      eventType,
      domains: domainsResult.domains,
      sectors,
      tickers: entitiesResult.tickers,
      riskFlags,
      opportunityFlags,
    }),
    scoringReasons: [
      ...scored.reasons,
      ...(canonicalUrl ? ['canonical-url-detected'] : []),
      ...(raw.summary ? ['provider-summary-available'] : []),
    ],
    dedupeKey: toStableHash(
      [canonicalFingerprint ?? titleFingerprint, eventType, raw.publishedAt.toISOString().slice(0, 10)].join('|')
    ),
    clusteringKey: toStableHash([eventType, canonicalFingerprint ?? titleFingerprint, sourceDomain].join('|')),
    eventClusterId,
    canonicalUrlFingerprint: canonicalFingerprint,
    publishedAt: raw.publishedAt,
    metadata: raw.metadata,
    rawProviderPayload: raw.rawPayload,
  }
}

export const createSourceReferenceFromSignal = (
  signal: NormalizedNewsSignalDraft,
  dedupeEvidence: Record<string, unknown> | null
): NewsSourceReferenceDraft => {
  return {
    provider: signal.provider,
    providerArticleId: signal.providerArticleId,
    providerUrl: signal.providerUrl,
    canonicalUrl: signal.canonicalUrl,
    sourceName: signal.sourceName,
    sourceDomain: signal.sourceDomain,
    sourceType: signal.sourceType,
    title: signal.title,
    normalizedTitle: signal.normalizedTitle,
    language: signal.language,
    publishedAt: signal.publishedAt,
    metadata: signal.metadata,
    rawProviderPayload: signal.rawProviderPayload,
    dedupeEvidence,
  }
}
