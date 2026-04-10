export type MarketProviderId = 'eodhd' | 'fred' | 'twelve_data'

export type MarketAssetClass = 'etf' | 'equity' | 'bond' | 'commodity'

export type MarketRegion = 'us' | 'europe' | 'world' | 'asia' | 'emerging' | 'africa'

export interface MarketInstrumentDefinition {
  id: string
  label: string
  shortLabel: string
  symbol: string
  eodhdSymbol: string
  twelveDataSymbol?: string
  assetClass: MarketAssetClass
  region: MarketRegion
  exchange: string
  currency: string
  sessionTimeZone: string
  sessionHours: {
    opensAt: string
    closesAt: string
  }
  proxyLabel: string | null
  tags: string[]
}

export interface MarketMacroSeriesDefinition {
  id: string
  label: string
  shortLabel: string
  group: 'rates' | 'inflation' | 'labor'
  unit: 'percent' | 'spread' | 'index'
  transform: 'level' | 'yoy' | 'delta'
  description: string
}

export const MARKET_PROVIDER_LABELS: Record<MarketProviderId, string> = {
  eodhd: 'EODHD',
  fred: 'FRED',
  twelve_data: 'Twelve Data',
}

export const MARKET_INSTRUMENTS: MarketInstrumentDefinition[] = [
  {
    id: 'spy-us',
    label: 'S&P 500 (SPY)',
    shortLabel: 'S&P 500',
    symbol: 'SPY',
    eodhdSymbol: 'SPY.US',
    twelveDataSymbol: 'SPY',
    assetClass: 'etf',
    region: 'us',
    exchange: 'NYSE Arca',
    currency: 'USD',
    sessionTimeZone: 'America/New_York',
    sessionHours: { opensAt: '09:30', closesAt: '16:00' },
    proxyLabel: 'ETF proxy',
    tags: ['panorama', 'us', 'equities'],
  },
  {
    id: 'qqq-us',
    label: 'Nasdaq 100 (QQQ)',
    shortLabel: 'Nasdaq 100',
    symbol: 'QQQ',
    eodhdSymbol: 'QQQ.US',
    twelveDataSymbol: 'QQQ',
    assetClass: 'etf',
    region: 'us',
    exchange: 'NASDAQ',
    currency: 'USD',
    sessionTimeZone: 'America/New_York',
    sessionHours: { opensAt: '09:30', closesAt: '16:00' },
    proxyLabel: 'ETF proxy',
    tags: ['panorama', 'us', 'growth'],
  },
  {
    id: 'vgk-us',
    label: 'Europe large caps (VGK)',
    shortLabel: 'Europe',
    symbol: 'VGK',
    eodhdSymbol: 'VGK.US',
    assetClass: 'etf',
    region: 'europe',
    exchange: 'NYSE Arca',
    currency: 'USD',
    sessionTimeZone: 'America/New_York',
    sessionHours: { opensAt: '09:30', closesAt: '16:00' },
    proxyLabel: 'ETF proxy',
    tags: ['panorama', 'europe'],
  },
  {
    id: 'ewj-us',
    label: 'Japon actions (EWJ)',
    shortLabel: 'Japon',
    symbol: 'EWJ',
    eodhdSymbol: 'EWJ.US',
    assetClass: 'etf',
    region: 'asia',
    exchange: 'NYSE Arca',
    currency: 'USD',
    sessionTimeZone: 'America/New_York',
    sessionHours: { opensAt: '09:30', closesAt: '16:00' },
    proxyLabel: 'ETF proxy',
    tags: ['panorama', 'asia'],
  },
  {
    id: 'iemg-us',
    label: 'Emergents (IEMG)',
    shortLabel: 'Emergents',
    symbol: 'IEMG',
    eodhdSymbol: 'IEMG.US',
    assetClass: 'etf',
    region: 'emerging',
    exchange: 'NYSE Arca',
    currency: 'USD',
    sessionTimeZone: 'America/New_York',
    sessionHours: { opensAt: '09:30', closesAt: '16:00' },
    proxyLabel: 'ETF proxy',
    tags: ['panorama', 'emerging'],
  },
  {
    id: 'cw8-pa',
    label: 'MSCI World PEA (CW8)',
    shortLabel: 'MSCI World',
    symbol: 'CW8',
    eodhdSymbol: 'CW8.PA',
    assetClass: 'etf',
    region: 'world',
    exchange: 'Euronext Paris',
    currency: 'EUR',
    sessionTimeZone: 'Europe/Paris',
    sessionHours: { opensAt: '09:00', closesAt: '17:30' },
    proxyLabel: 'ETF monde',
    tags: ['panorama', 'pea', 'world'],
  },
  {
    id: 'meud-pa',
    label: 'MSCI Europe PEA (MEUD)',
    shortLabel: 'Europe PEA',
    symbol: 'MEUD',
    eodhdSymbol: 'MEUD.PA',
    assetClass: 'etf',
    region: 'europe',
    exchange: 'Euronext Paris',
    currency: 'EUR',
    sessionTimeZone: 'Europe/Paris',
    sessionHours: { opensAt: '09:00', closesAt: '17:30' },
    proxyLabel: 'ETF Europe',
    tags: ['watchlist', 'pea', 'europe'],
  },
  {
    id: 'aeem-pa',
    label: 'Emergents PEA (AEEM)',
    shortLabel: 'Emergents PEA',
    symbol: 'AEEM',
    eodhdSymbol: 'AEEM.PA',
    assetClass: 'etf',
    region: 'emerging',
    exchange: 'Euronext Paris',
    currency: 'EUR',
    sessionTimeZone: 'Europe/Paris',
    sessionHours: { opensAt: '09:00', closesAt: '17:30' },
    proxyLabel: 'ETF émergents',
    tags: ['watchlist', 'pea', 'emerging'],
  },
  {
    id: 'mjp-pa',
    label: 'Japon PEA (MJP)',
    shortLabel: 'Japon PEA',
    symbol: 'MJP',
    eodhdSymbol: 'MJP.PA',
    assetClass: 'etf',
    region: 'asia',
    exchange: 'Euronext Paris',
    currency: 'EUR',
    sessionTimeZone: 'Europe/Paris',
    sessionHours: { opensAt: '09:00', closesAt: '17:30' },
    proxyLabel: 'ETF Japon',
    tags: ['watchlist', 'pea', 'asia'],
  },
  {
    id: 'air-pa',
    label: 'Airbus',
    shortLabel: 'Airbus',
    symbol: 'AIR',
    eodhdSymbol: 'AIR.PA',
    assetClass: 'equity',
    region: 'europe',
    exchange: 'Euronext Paris',
    currency: 'EUR',
    sessionTimeZone: 'Europe/Paris',
    sessionHours: { opensAt: '09:00', closesAt: '17:30' },
    proxyLabel: null,
    tags: ['watchlist', 'europe', 'equity'],
  },
  {
    id: 'mc-pa',
    label: 'LVMH',
    shortLabel: 'LVMH',
    symbol: 'MC',
    eodhdSymbol: 'MC.PA',
    assetClass: 'equity',
    region: 'europe',
    exchange: 'Euronext Paris',
    currency: 'EUR',
    sessionTimeZone: 'Europe/Paris',
    sessionHours: { opensAt: '09:00', closesAt: '17:30' },
    proxyLabel: null,
    tags: ['watchlist', 'europe', 'equity'],
  },
  {
    id: 'ief-us',
    label: 'US Treasuries 7-10Y (IEF)',
    shortLabel: 'Treasuries 7-10Y',
    symbol: 'IEF',
    eodhdSymbol: 'IEF.US',
    assetClass: 'bond',
    region: 'us',
    exchange: 'NASDAQ',
    currency: 'USD',
    sessionTimeZone: 'America/New_York',
    sessionHours: { opensAt: '09:30', closesAt: '16:00' },
    proxyLabel: 'ETF obligataire',
    tags: ['watchlist', 'rates', 'bond'],
  },
  {
    id: 'gld-us',
    label: 'Or (GLD)',
    shortLabel: 'Or',
    symbol: 'GLD',
    eodhdSymbol: 'GLD.US',
    assetClass: 'commodity',
    region: 'world',
    exchange: 'NYSE Arca',
    currency: 'USD',
    sessionTimeZone: 'America/New_York',
    sessionHours: { opensAt: '09:30', closesAt: '16:00' },
    proxyLabel: 'ETF matière première',
    tags: ['watchlist', 'commodity'],
  },
  {
    id: 'eza-us',
    label: 'Afrique du Sud (EZA)',
    shortLabel: 'Afrique du Sud',
    symbol: 'EZA',
    eodhdSymbol: 'EZA.US',
    assetClass: 'etf',
    region: 'africa',
    exchange: 'NYSE Arca',
    currency: 'USD',
    sessionTimeZone: 'America/New_York',
    sessionHours: { opensAt: '09:30', closesAt: '16:00' },
    proxyLabel: 'ETF proxy',
    tags: ['watchlist', 'africa'],
  },
]

export const DEFAULT_MARKET_WATCHLIST_IDS = MARKET_INSTRUMENTS.map(instrument => instrument.id)

export const PANORAMA_MARKET_IDS = [
  'spy-us',
  'qqq-us',
  'vgk-us',
  'ewj-us',
  'iemg-us',
  'cw8-pa',
] as const

export const MARKET_WATCHLIST_GROUPS: Array<{
  id: string
  label: string
  instrumentIds: string[]
}> = [
  {
    id: 'global',
    label: 'Panorama global',
    instrumentIds: ['spy-us', 'qqq-us', 'vgk-us', 'ewj-us', 'iemg-us', 'cw8-pa'],
  },
  {
    id: 'pea',
    label: 'PEA / Euronext',
    instrumentIds: ['cw8-pa', 'meud-pa', 'aeem-pa', 'mjp-pa', 'air-pa', 'mc-pa'],
  },
  {
    id: 'cross-asset',
    label: 'Cross-asset',
    instrumentIds: ['ief-us', 'gld-us', 'eza-us'],
  },
]

export const MARKET_MACRO_SERIES: MarketMacroSeriesDefinition[] = [
  {
    id: 'FEDFUNDS',
    label: 'Fed funds',
    shortLabel: 'Fed funds',
    group: 'rates',
    unit: 'percent',
    transform: 'level',
    description: 'Taux directeur effectif de la Fed.',
  },
  {
    id: 'SOFR',
    label: 'SOFR',
    shortLabel: 'SOFR',
    group: 'rates',
    unit: 'percent',
    transform: 'level',
    description: 'Taux overnight sécurisé USD.',
  },
  {
    id: 'DGS2',
    label: 'Treasury 2 ans',
    shortLabel: 'UST 2Y',
    group: 'rates',
    unit: 'percent',
    transform: 'level',
    description: 'Rendement du Treasury US 2 ans.',
  },
  {
    id: 'DGS10',
    label: 'Treasury 10 ans',
    shortLabel: 'UST 10Y',
    group: 'rates',
    unit: 'percent',
    transform: 'level',
    description: 'Rendement du Treasury US 10 ans.',
  },
  {
    id: 'T10Y2Y',
    label: 'Spread 10Y-2Y',
    shortLabel: '10Y-2Y',
    group: 'rates',
    unit: 'spread',
    transform: 'level',
    description: 'Pente 10 ans moins 2 ans.',
  },
  {
    id: 'CPIAUCSL',
    label: 'Inflation US CPI',
    shortLabel: 'Inflation CPI',
    group: 'inflation',
    unit: 'percent',
    transform: 'yoy',
    description: 'Indice CPI urbain, transformé en glissement annuel.',
  },
  {
    id: 'UNRATE',
    label: 'Chômage US',
    shortLabel: 'Chômage',
    group: 'labor',
    unit: 'percent',
    transform: 'level',
    description: 'Taux de chômage civil US.',
  },
]

export const DEFAULT_MARKET_MACRO_SERIES_IDS = MARKET_MACRO_SERIES.map(series => series.id)

export const getMarketInstrumentDefinition = (instrumentId: string) => {
  return MARKET_INSTRUMENTS.find(instrument => instrument.id === instrumentId) ?? null
}

export const getMarketMacroSeriesDefinition = (seriesId: string) => {
  return MARKET_MACRO_SERIES.find(series => series.id === seriesId) ?? null
}
