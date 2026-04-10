import { MARKET_PROVIDER_LABELS, type MarketMacroSeriesDefinition } from './market-definitions'
import {
  computeChangePct,
  formatNumber,
  formatPercent,
  formatPercentNoSign,
  roundNumber,
} from './market-helpers'
import type {
  DashboardMarketMacroSeries,
  DashboardMarketProviderHealth,
  DashboardMarketQuote,
  DashboardMarketSignal,
  DashboardMarketsOverviewResponse,
  MarketContextBundle,
} from './markets-types'

type MacroObservationRow = {
  seriesId: string
  observationDate: string
  value: number
}

const findMacroSeriesValue = (
  series: DashboardMarketMacroSeries[],
  seriesId: string
): DashboardMarketMacroSeries | null => {
  return series.find(item => item.seriesId === seriesId) ?? null
}

const average = (values: number[]) => {
  if (values.length === 0) {
    return null
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length
}

const classifyDirection = (value: number | null, threshold = 0.01) => {
  if (value === null || Math.abs(value) <= threshold) {
    return 'flat' as const
  }

  return value > 0 ? ('up' as const) : ('down' as const)
}

const computeYoY = (observations: MacroObservationRow[], index: number) => {
  const current = observations[index]
  const lag = observations[index - 12]
  if (!current || !lag || lag.value === 0) {
    return null
  }

  return roundNumber(((current.value - lag.value) / lag.value) * 100, 4)
}

export const buildMacroSeriesSnapshots = ({
  definitions,
  observations,
}: {
  definitions: MarketMacroSeriesDefinition[]
  observations: MacroObservationRow[]
}): DashboardMarketMacroSeries[] => {
  return definitions.map(definition => {
    const seriesRows = observations
      .filter(row => row.seriesId === definition.id)
      .sort((left, right) => left.observationDate.localeCompare(right.observationDate))
    const history = seriesRows.slice(Math.max(seriesRows.length - 24, 0))
    const lastIndex = seriesRows.length - 1
    const latestRow = lastIndex >= 0 ? seriesRows[lastIndex] : null
    const previousRow = lastIndex > 0 ? seriesRows[lastIndex - 1] : null

    let latestValue: number | null = latestRow?.value ?? null
    let previousValue: number | null = previousRow?.value ?? null

    if (definition.transform === 'yoy') {
      latestValue = lastIndex >= 12 ? computeYoY(seriesRows, lastIndex) : null
      previousValue = lastIndex >= 13 ? computeYoY(seriesRows, lastIndex - 1) : null
    }

    const change = latestValue !== null && previousValue !== null ? latestValue - previousValue : null
    const changePct = computeChangePct(latestValue, previousValue)

    return {
      seriesId: definition.id,
      label: definition.label,
      shortLabel: definition.shortLabel,
      group: definition.group,
      unit: definition.unit,
      description: definition.description,
      latestValue,
      previousValue,
      change: change === null ? null : roundNumber(change, 4),
      changePct,
      changeDirection: classifyDirection(change),
      displayValue:
        definition.unit === 'percent' || definition.unit === 'spread'
          ? formatPercentNoSign(latestValue)
          : formatNumber(latestValue),
      comparisonLabel:
        definition.transform === 'yoy' ? 'Variation du régime' : 'Vs observation précédente',
      comparisonValue:
        change === null
          ? null
          : definition.unit === 'percent' || definition.unit === 'spread'
            ? formatPercent(change)
            : formatNumber(change),
      observationDate: latestRow?.observationDate ?? null,
      history: history.map(row => ({
        date: row.observationDate,
        value: row.value,
      })),
      source: {
        provider: 'fred',
        freshnessLabel: latestRow
          ? `Observation du ${latestRow.observationDate}`
          : 'Aucune observation',
        observationCount: history.length,
      },
    }
  })
}

export const buildMarketSignals = ({
  quotes,
  macroSeries,
}: {
  quotes: DashboardMarketQuote[]
  macroSeries: DashboardMarketMacroSeries[]
}): DashboardMarketSignal[] => {
  const signals: DashboardMarketSignal[] = []

  const fedFunds = findMacroSeriesValue(macroSeries, 'FEDFUNDS')
  if (fedFunds && (fedFunds.latestValue ?? 0) >= 4) {
    signals.push({
      id: 'rates-high',
      title: 'Les taux courts restent élevés',
      detail:
        "Le niveau des fed funds reste restrictif. Le coût du capital continue de peser sur les actifs longs et les dossiers sensibles au financement.",
      tone: 'risk',
      severity: 'high',
      evidence: [`Fed funds: ${fedFunds.displayValue}`],
      dataRefs: ['macro: FEDFUNDS'],
    })
  }

  const spread = findMacroSeriesValue(macroSeries, 'T10Y2Y')
  if (spread && (spread.latestValue ?? 0) < 0) {
    signals.push({
      id: 'curve-inverted',
      title: 'La courbe reste inversée',
      detail:
        "Le spread 10Y-2Y reste négatif. Cela signale un régime de prudence sur la croissance future, même si le timing de marché reste incertain.",
      tone: 'risk',
      severity: 'medium',
      evidence: [`Spread 10Y-2Y: ${spread.displayValue}`],
      dataRefs: ['macro: T10Y2Y'],
    })
  }

  const inflation = findMacroSeriesValue(macroSeries, 'CPIAUCSL')
  if ((inflation?.change ?? 0) < -0.1) {
    signals.push({
      id: 'inflation-cooling',
      title: "L'inflation ralentit",
      detail:
        "Le glissement annuel du CPI recule par rapport à l'observation précédente. Le signal est favorable aux actifs de duration si la désinflation tient.",
      tone: 'opportunity',
      severity: 'medium',
      evidence: [
        `Inflation CPI YoY: ${inflation?.displayValue ?? 'n/d'}`,
        `Changement: ${inflation?.comparisonValue ?? 'n/d'}`,
      ],
      dataRefs: ['macro: CPIAUCSL'],
    })
  } else if ((inflation?.change ?? 0) > 0.1) {
    signals.push({
      id: 'inflation-heating',
      title: "L'inflation réaccélère",
      detail:
        "Le CPI annuel remonte par rapport à l'observation précédente. Cela réduit la marge de détente monétaire implicite.",
      tone: 'risk',
      severity: 'medium',
      evidence: [
        `Inflation CPI YoY: ${inflation?.displayValue ?? 'n/d'}`,
        `Changement: ${inflation?.comparisonValue ?? 'n/d'}`,
      ],
      dataRefs: ['macro: CPIAUCSL'],
    })
  }

  const unemployment = findMacroSeriesValue(macroSeries, 'UNRATE')
  if ((unemployment?.change ?? 0) >= 0.2) {
    signals.push({
      id: 'labor-softening',
      title: "Le marché de l'emploi se détend",
      detail:
        "Le taux de chômage monte par rapport à l'observation précédente. Le message est ambigu: croissance moins ferme, mais pression inflationniste potentiellement plus faible.",
      tone: 'neutral',
      severity: 'medium',
      evidence: [
        `Chômage: ${unemployment?.displayValue ?? 'n/d'}`,
        `Changement: ${unemployment?.comparisonValue ?? 'n/d'}`,
      ],
      dataRefs: ['macro: UNRATE'],
    })
  }

  const usMonth = average(
    quotes
      .filter(quote => quote.region === 'us')
      .map(quote => quote.monthChangePct)
      .filter((value): value is number => value !== null)
  )
  const europeMonth = average(
    quotes
      .filter(quote => quote.region === 'europe')
      .map(quote => quote.monthChangePct)
      .filter((value): value is number => value !== null)
  )

  if (usMonth !== null && europeMonth !== null) {
    const delta = usMonth - europeMonth
    if (delta >= 2) {
      signals.push({
        id: 'us-outperformance',
        title: "Les actifs US surperforment l'Europe sur 30 jours",
        detail:
          "Le panier US garde une avance nette sur les lignes Europe de la watchlist. Le leadership reste concentré côté Etats-Unis.",
        tone: 'opportunity',
        severity: 'medium',
        evidence: [
          `US 30j moyen: ${formatPercent(usMonth)}`,
          `Europe 30j moyen: ${formatPercent(europeMonth)}`,
        ],
        dataRefs: ['watchlist:us', 'watchlist:europe'],
      })
    } else if (delta <= -2) {
      signals.push({
        id: 'europe-outperformance',
        title: "L'Europe reprend l'avantage sur 30 jours",
        detail:
          "Le panier Europe surperforme désormais le panier US. Cela peut refléter une détente taux/valorisation plus favorable côté européen.",
        tone: 'opportunity',
        severity: 'low',
        evidence: [
          `US 30j moyen: ${formatPercent(usMonth)}`,
          `Europe 30j moyen: ${formatPercent(europeMonth)}`,
        ],
        dataRefs: ['watchlist:us', 'watchlist:europe'],
      })
    }
  }

  const breadthPositive = quotes.filter(quote => (quote.dayChangePct ?? 0) > 0).length
  const breadthNegative = quotes.filter(quote => (quote.dayChangePct ?? 0) < 0).length
  if (breadthPositive >= breadthNegative + 3) {
    signals.push({
      id: 'breadth-positive',
      title: 'La breadth quotidienne reste constructive',
      detail: "La majorité de la watchlist termine en hausse sur la séance disponible.",
      tone: 'opportunity',
      severity: 'low',
      evidence: [`Hausse: ${breadthPositive}`, `Baisse: ${breadthNegative}`],
      dataRefs: ['watchlist:breadth'],
    })
  } else if (breadthNegative >= breadthPositive + 3) {
    signals.push({
      id: 'breadth-negative',
      title: 'La breadth quotidienne se dégrade',
      detail: "La majorité de la watchlist recule sur la séance disponible, ce qui fragilise la lecture directionnelle.",
      tone: 'risk',
      severity: 'medium',
      evidence: [`Hausse: ${breadthPositive}`, `Baisse: ${breadthNegative}`],
      dataRefs: ['watchlist:breadth'],
    })
  }

  return signals.slice(0, 6)
}

const computeStrongestRegion = (quotes: DashboardMarketQuote[]) => {
  const scores = new Map<string, number[]>()
  for (const quote of quotes) {
    if (quote.monthChangePct === null) {
      continue
    }

    const existing = scores.get(quote.region)
    if (existing) {
      existing.push(quote.monthChangePct)
    } else {
      scores.set(quote.region, [quote.monthChangePct])
    }
  }

  let bestRegion: string | null = null
  let bestScore = Number.NEGATIVE_INFINITY
  for (const [region, values] of scores.entries()) {
    const score = average(values)
    if (score !== null && score > bestScore) {
      bestScore = score
      bestRegion = region
    }
  }

  return bestRegion
}

const buildConfidence = ({
  quotes,
  providers,
  staleAfterMinutes,
}: {
  quotes: DashboardMarketQuote[]
  providers: DashboardMarketProviderHealth[]
  staleAfterMinutes: number
}) => {
  const staleCount = quotes.filter(
    quote => quote.source.freshnessMinutes !== null && quote.source.freshnessMinutes > staleAfterMinutes
  ).length
  const providerPenalty = providers.reduce((penalty, provider) => {
    if (provider.status === 'failing') return penalty + 20
    if (provider.status === 'degraded') return penalty + 10
    return penalty
  }, 0)
  const stalePenalty = staleCount * 4
  const score = Math.max(15, 100 - providerPenalty - stalePenalty)
  const caveats: string[] = []

  if (staleCount > 0) {
    caveats.push(`${staleCount} instrument(s) au-delà du seuil de fraîcheur nominal.`)
  }

  if (providers.some(provider => provider.status === 'failing')) {
    caveats.push('Au moins un provider est actuellement en échec.')
  }

  return {
    level: score >= 75 ? ('high' as const) : score >= 50 ? ('medium' as const) : ('low' as const),
    score,
    caveats,
  }
}

export const buildMarketContextBundle = ({
  generatedAt,
  quotes,
  macroSeries,
  signals,
  providers,
  staleAfterMinutes,
}: {
  generatedAt: string
  quotes: DashboardMarketQuote[]
  macroSeries: DashboardMarketMacroSeries[]
  signals: DashboardMarketSignal[]
  providers: DashboardMarketProviderHealth[]
  staleAfterMinutes: number
}): MarketContextBundle => {
  const sortedByDay = [...quotes]
    .filter(quote => quote.dayChangePct !== null)
    .sort((left, right) => (right.dayChangePct ?? -Infinity) - (left.dayChangePct ?? -Infinity))

  const gainers = sortedByDay.slice(0, 3).map(quote => ({
    instrumentId: quote.instrumentId,
    label: quote.shortLabel,
    dayChangePct: roundNumber(quote.dayChangePct ?? 0, 2),
  }))
  const losers = [...sortedByDay]
    .reverse()
    .slice(0, 3)
    .map(quote => ({
      instrumentId: quote.instrumentId,
      label: quote.shortLabel,
      dayChangePct: roundNumber(quote.dayChangePct ?? 0, 2),
    }))

  const positiveCount = quotes.filter(quote => (quote.dayChangePct ?? 0) > 0).length
  const negativeCount = quotes.filter(quote => (quote.dayChangePct ?? 0) < 0).length
  const flatCount = Math.max(0, quotes.length - positiveCount - negativeCount)
  const staleCount = quotes.filter(
    quote => quote.source.freshnessMinutes !== null && quote.source.freshnessMinutes > staleAfterMinutes
  ).length
  const intradayCount = quotes.filter(quote => quote.source.mode === 'intraday').length
  const delayedCount = quotes.filter(quote => quote.source.mode === 'delayed').length
  const eodCount = quotes.filter(quote => quote.source.mode === 'eod').length

  const fedFunds = findMacroSeriesValue(macroSeries, 'FEDFUNDS')?.latestValue ?? null
  const sofr = findMacroSeriesValue(macroSeries, 'SOFR')?.latestValue ?? null
  const ust2y = findMacroSeriesValue(macroSeries, 'DGS2')?.latestValue ?? null
  const ust10y = findMacroSeriesValue(macroSeries, 'DGS10')?.latestValue ?? null
  const spread10y2y = findMacroSeriesValue(macroSeries, 'T10Y2Y')?.latestValue ?? null
  const cpiYoY = findMacroSeriesValue(macroSeries, 'CPIAUCSL')?.latestValue ?? null
  const cpiChange = findMacroSeriesValue(macroSeries, 'CPIAUCSL')?.change ?? null
  const unemploymentRate = findMacroSeriesValue(macroSeries, 'UNRATE')?.latestValue ?? null
  const unemploymentChange = findMacroSeriesValue(macroSeries, 'UNRATE')?.change ?? null

  const confidence = buildConfidence({
    quotes,
    providers,
    staleAfterMinutes,
  })

  return {
    schemaVersion: '2026-04-10',
    generatedAt,
    coverageSummary: {
      instrumentCount: quotes.length,
      macroSeriesCount: macroSeries.length,
      providers: providers.map(provider => ({
        provider: provider.provider,
        role: provider.role,
        coverageCount:
          provider.role === 'macro'
            ? macroSeries.length
            : quotes.filter(
                quote =>
                  quote.source.provider === provider.provider ||
                  quote.source.baselineProvider === provider.provider ||
                  quote.source.overlayProvider === provider.provider
              ).length,
        freshnessLabel: provider.freshnessLabel,
      })),
    },
    quoteFreshness: {
      intradayCount,
      delayedCount,
      eodCount,
      staleCount,
    },
    keyMovers: {
      gainers,
      losers,
    },
    marketBreadth: {
      positiveCount,
      negativeCount,
      flatCount,
      strongestRegion: computeStrongestRegion(quotes),
    },
    marketRegimeHints: signals.slice(0, 4).map(signal => signal.title),
    macroRegime: {
      rates: [
        fedFunds !== null && fedFunds >= 4 ? 'Taux courts restrictifs' : 'Taux courts modérés',
        spread10y2y !== null && spread10y2y < 0 ? 'Courbe inversée' : 'Courbe positive',
      ],
      inflation: [
        cpiYoY !== null && cpiYoY > 3 ? 'Inflation au-dessus de 3%' : 'Inflation en zone plus calme',
        cpiChange !== null && cpiChange < 0 ? 'Désinflation en cours' : 'Pas de désinflation nette',
      ],
      labor: [
        unemploymentRate !== null && unemploymentRate < 4.5 ? "Marché de l'emploi encore tendu" : 'Emploi moins tendu',
        unemploymentChange !== null && unemploymentChange > 0 ? 'Chômage en hausse' : 'Chômage stable ou en baisse',
      ],
    },
    ratesSummary: {
      fedFunds,
      sofr,
      ust2y,
      ust10y,
      spread10y2y,
    },
    inflationSummary: {
      cpiYoY,
      direction:
        cpiChange === null ? 'unknown' : cpiChange < -0.1 ? 'cooling' : cpiChange > 0.1 ? 'heating' : 'stable',
    },
    laborSummary: {
      unemploymentRate,
      direction:
        unemploymentChange === null
          ? 'unknown'
          : unemploymentChange > 0.1
            ? 'softening'
            : unemploymentChange < -0.1
              ? 'tightening'
              : 'stable',
    },
    riskFlags: signals
      .filter(signal => signal.tone === 'risk')
      .map(signal => signal.title),
    anomalies: [
      ...quotes
        .filter(quote => quote.history.length < 10)
        .map(quote => `Historique court pour ${quote.shortLabel}.`),
    ],
    warnings: [
      ...providers
        .filter(provider => provider.status === 'degraded' || provider.status === 'failing')
        .map(provider => `${provider.label}: ${provider.status}.`),
    ],
    watchlistHighlights: [...gainers, ...losers].slice(0, 4).map(item => ({
      instrumentId: item.instrumentId,
      label: item.label,
      summary: `Variation jour ${formatPercent(item.dayChangePct)}.`,
    })),
    providerProvenance: providers.map(provider => ({
      provider: provider.provider,
      label: provider.label,
      role: provider.role,
      freshnessLabel: provider.freshnessLabel,
      note:
        provider.provider === 'eodhd'
          ? 'Source primaire EOD / différée sur la watchlist globale.'
          : provider.provider === 'fred'
            ? 'Source macro officielle.'
            : 'Overlay US optionnel lorsque plus frais.',
    })),
    confidence,
  }
}

export const buildMarketsOverviewResponse = ({
  requestId,
  generatedAt,
  quotes,
  panoramaIds,
  macroSeries,
  providerHealth,
  staleAfterMinutes,
  lastSuccessAt,
  source,
}: {
  requestId: string
  generatedAt: string
  quotes: DashboardMarketQuote[]
  panoramaIds: string[]
  macroSeries: DashboardMarketMacroSeries[]
  providerHealth: DashboardMarketProviderHealth[]
  staleAfterMinutes: number
  lastSuccessAt: string | null
  source: 'demo_fixture' | 'cache'
}): DashboardMarketsOverviewResponse => {
  const signals = buildMarketSignals({
    quotes,
    macroSeries,
  })

  const contextBundle = buildMarketContextBundle({
    generatedAt,
    quotes,
    macroSeries,
    signals,
    providers: providerHealth,
    staleAfterMinutes,
  })

  const openCount = quotes.filter(quote => quote.marketSession.isOpen).length
  const closedCount = Math.max(0, quotes.length - openCount)
  const positiveCount = quotes.filter(quote => (quote.dayChangePct ?? 0) > 0).length
  const negativeCount = quotes.filter(quote => (quote.dayChangePct ?? 0) < 0).length
  const highRiskSignals = signals.filter(signal => signal.tone === 'risk' && signal.severity === 'high').length
  const tone =
    highRiskSignals > 0
      ? ('risk' as const)
      : positiveCount >= negativeCount + 2
        ? ('opportunity' as const)
        : ('neutral' as const)
  const headline =
    tone === 'risk'
      ? 'Marché plus contraint, lecture macro prioritaire.'
      : tone === 'opportunity'
        ? 'Leadership encore constructif, mais sélectif.'
        : 'Marché mixte, signaux à lire dans la nuance.'
  const badge =
    providerHealth.some(provider => provider.provider === 'twelve_data' && provider.status === 'healthy')
      ? 'Overlay US actif'
      : 'Lecture snapshot-first'

  const staleAgeSeconds = lastSuccessAt
    ? Math.max(0, Math.round((Date.now() - new Date(lastSuccessAt).getTime()) / 1000))
    : null

  return {
    source,
    requestId,
    generatedAt,
    freshness: {
      lastSuccessAt,
      stale:
        staleAgeSeconds === null
          ? true
          : staleAgeSeconds > staleAfterMinutes * 60,
      staleAgeSeconds,
      staleAfterMinutes,
      degradedReason:
        staleAgeSeconds !== null && staleAgeSeconds > staleAfterMinutes * 60
          ? 'Cache marché au-delà du seuil nominal.'
          : null,
    },
    summary: {
      headline,
      tone,
      badge,
      openCount,
      closedCount,
      positiveCount,
      negativeCount,
      primarySourceLabel: providerHealth
        .filter(provider => provider.status !== 'idle' && provider.enabled)
        .map(provider => MARKET_PROVIDER_LABELS[provider.provider])
        .join(' + '),
    },
    panorama: {
      items: panoramaIds
        .map(id => quotes.find(quote => quote.instrumentId === id) ?? null)
        .filter((quote): quote is DashboardMarketQuote => quote !== null),
    },
    macro: {
      items: macroSeries,
    },
    watchlist: {
      items: quotes,
      groups: [],
    },
    signals: {
      items: signals,
    },
    contextBundle,
    providers: providerHealth,
  }
}
