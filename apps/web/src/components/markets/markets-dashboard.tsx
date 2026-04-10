import { Badge, Card, CardContent, CardHeader, CardTitle } from '@finance-os/ui/components'
import { D3Sparkline, MiniSparkline } from '@/components/ui/d3-sparkline'
import { formatDate, formatMoney, formatRelativeDateTime } from '@/lib/format'
import type { DashboardMarketsOverviewResponse } from '@/features/markets/types'
import { RelativePerformanceRibbon } from './relative-performance-ribbon'

const formatSignedPercent = (value: number | null) => {
  if (value === null) return 'n/d'
  return `${value >= 0 ? '+' : ''}${value.toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} %`
}

const formatSourceLabel = (item: DashboardMarketsOverviewResponse['watchlist']['items'][number]) => {
  if (item.source.provider === 'twelve_data') {
    return 'Overlay US'
  }
  if (item.source.mode === 'eod') {
    return 'EOD'
  }
  return item.source.delayLabel
}

const toToneClasses = (tone: DashboardMarketsOverviewResponse['summary']['tone']) => {
  switch (tone) {
    case 'risk':
      return 'border-negative/40 bg-negative/10 text-negative'
    case 'opportunity':
      return 'border-positive/40 bg-positive/10 text-positive'
    default:
      return 'border-primary/30 bg-primary/10 text-primary'
  }
}

const toSignalClasses = (tone: 'risk' | 'opportunity' | 'neutral') => {
  switch (tone) {
    case 'risk':
      return 'border-negative/30 bg-negative/10'
    case 'opportunity':
      return 'border-positive/30 bg-positive/10'
    default:
      return 'border-border/60 bg-surface-1'
  }
}

const toProviderStatusClasses = (status: DashboardMarketsOverviewResponse['providers'][number]['status']) => {
  switch (status) {
    case 'healthy':
      return 'text-positive'
    case 'degraded':
      return 'text-warning'
    case 'failing':
      return 'text-negative'
    default:
      return 'text-muted-foreground'
  }
}

const sectionLinkClass =
  'rounded-full border border-border/60 bg-background/70 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground'

const signalOrder = { high: 3, medium: 2, low: 1 } as const

export function MarketsDashboard({
  overview,
  isAdmin,
  refreshPending,
  onRefresh,
}: {
  overview: DashboardMarketsOverviewResponse
  isAdmin: boolean
  refreshPending: boolean
  onRefresh: () => void
}) {
  const watchlistItems =
    overview.watchlist.items.length > 0 ? overview.watchlist.items : overview.panorama.items
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false
  const degradedProviders = overview.providers.filter(
    provider => provider.status === 'degraded' || provider.status === 'failing'
  )
  const lastUpdatedLabel = formatRelativeDateTime(overview.freshness.lastSuccessAt)

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[32px] border border-border/60 bg-[radial-gradient(circle_at_top_left,_oklch(from_var(--primary)_l_c_h/22%),_transparent_28%),radial-gradient(circle_at_top_right,_oklch(from_var(--chart-3)_l_c_h/18%),_transparent_30%),linear-gradient(180deg,_oklch(from_var(--surface-1)_l_c_h/92%),_var(--surface-0))] p-6 shadow-[var(--shadow-lg)] lg:p-8">
        <div className="absolute inset-y-0 right-0 hidden w-1/3 bg-[linear-gradient(90deg,transparent,oklch(from_var(--primary)_l_c_h/10%))] lg:block" />
        <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.9fr)]">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={toToneClasses(overview.summary.tone)}>
                {overview.summary.badge}
              </Badge>
              {overview.dataset?.isDemoData && (
                <Badge variant="outline">Mode démo</Badge>
              )}
              {overview.freshness.stale && (
                <Badge className="border-warning/40 bg-warning/10 text-warning">
                  Snapshot à surveiller
                </Badge>
              )}
              {offline && <Badge className="border-border/60 bg-surface-1">Hors ligne</Badge>}
            </div>

            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-primary/70">
                Marchés & macro
              </p>
              <h2 className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight lg:text-4xl">
                {overview.summary.headline}
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
                Lecture snapshot-first, provenance visible, signaux déterministes. Les vues US peuvent
                bénéficier d'une surcouche plus fraîche, la macro reste officielle via FRED.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <a href="#panorama" className={sectionLinkClass}>Panorama</a>
              <a href="#macro" className={sectionLinkClass}>Macro</a>
              <a href="#watchlist" className={sectionLinkClass}>Watchlist</a>
              <a href="#signals" className={sectionLinkClass}>Signals</a>
              <a href="#bundle" className={sectionLinkClass}>Bundle IA</a>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatPill
                label="Breadth"
                value={`${overview.summary.positiveCount}/${overview.summary.positiveCount + overview.summary.negativeCount}`}
                detail="lignes en hausse"
              />
              <StatPill
                label="Marchés"
                value={`${overview.summary.openCount}`}
                detail="ouverts en ce moment"
              />
              <StatPill
                label="Providers"
                value={`${overview.providers.filter(provider => provider.status === 'healthy').length}/${overview.providers.length}`}
                detail="sains"
              />
              <StatPill
                label="Bundle"
                value={`${overview.contextBundle.confidence.score}/100`}
                detail={`confiance ${overview.contextBundle.confidence.level}`}
              />
            </div>
          </div>

          <div className="grid gap-3">
            <Card className="border-border/60 bg-background/65 backdrop-blur-sm">
              <CardContent className="space-y-4 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.24em] text-primary/70">
                      Fraîcheur & provenance
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {lastUpdatedLabel ? `Dernier snapshot ${lastUpdatedLabel}.` : 'Aucune date de snapshot.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onRefresh}
                    disabled={!isAdmin || refreshPending}
                    className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/15 disabled:cursor-not-allowed disabled:border-border/60 disabled:bg-surface-1 disabled:text-muted-foreground"
                  >
                    {refreshPending ? 'Refresh...' : isAdmin ? 'Refresh live' : 'Admin requis'}
                  </button>
                </div>

                <div className="space-y-2">
                  {overview.providers.map(provider => (
                    <div
                      key={provider.provider}
                      className="flex items-center justify-between rounded-2xl border border-border/50 bg-surface-1 px-3 py-2"
                    >
                      <div>
                        <p className="text-sm font-medium">{provider.label}</p>
                        <p className="text-xs text-muted-foreground">{provider.role}</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-xs font-medium ${toProviderStatusClasses(provider.status)}`}>
                          {provider.status}
                        </p>
                        <p className="text-[11px] text-muted-foreground">{provider.freshnessLabel}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {!isAdmin && (
                  <p className="text-xs leading-5 text-muted-foreground">
                    En démo, aucun accès provider ni DB. Le refresh live reste volontairement bloqué.
                  </p>
                )}
              </CardContent>
            </Card>

            {(overview.freshness.degradedReason || degradedProviders.length > 0 || offline) && (
              <Card className="border-warning/30 bg-warning/10">
                <CardContent className="space-y-2 p-4 text-sm">
                  {offline && <p>Navigation hors ligne: lecture en cache/local uniquement.</p>}
                  {overview.freshness.degradedReason && <p>{overview.freshness.degradedReason}</p>}
                  {degradedProviders.map(provider => (
                    <p key={provider.provider}>
                      {provider.label}: {provider.lastErrorMessage ?? provider.status}
                    </p>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </section>

      <section id="panorama" className="space-y-4">
        <SectionHeading
          eyebrow="Panorama marché"
          title="Heat strip premium"
          description="Indices et proxies clés, variations multi-horizon, source et fraîcheur explicites."
        />

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)]">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {overview.panorama.items.map(item => (
              <article
                key={item.instrumentId}
                className="group rounded-[26px] border border-border/60 bg-[linear-gradient(180deg,var(--surface-1),var(--surface-0))] p-4 shadow-[var(--shadow-md)] transition-transform duration-200 hover:-translate-y-0.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-primary/65">{item.symbol}</p>
                    <h3 className="mt-1 text-base font-semibold">{item.shortLabel}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.exchange} · {formatSourceLabel(item)}
                    </p>
                  </div>
                  <Badge variant="outline">{item.marketSession.label}</Badge>
                </div>

                <div className="mt-4 flex items-end justify-between gap-4">
                  <div>
                    <p className="font-financial text-2xl font-semibold">
                      {formatMoney(item.price, item.currency)}
                    </p>
                    <p className={`mt-1 text-sm font-medium ${item.dayChangePct !== null && item.dayChangePct >= 0 ? 'text-positive' : 'text-negative'}`}>
                      {formatSignedPercent(item.dayChangePct)}
                    </p>
                  </div>
                  <MiniSparkline
                    data={item.history.map(point => point.value)}
                    width={88}
                    height={28}
                    color="auto"
                  />
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                  <MetricChip label="7j" value={formatSignedPercent(item.weekChangePct)} />
                  <MetricChip label="30j" value={formatSignedPercent(item.monthChangePct)} />
                  <MetricChip label="YTD" value={formatSignedPercent(item.ytdChangePct)} />
                </div>
              </article>
            ))}
          </div>

          <RelativePerformanceRibbon items={overview.panorama.items} />
        </div>
      </section>

      <section id="macro" className="space-y-4">
        <SectionHeading
          eyebrow="Macro pulse"
          title="Séries FRED lisibles"
          description="Taux, inflation et emploi avec mini-traces, comparaison immédiate et lecture humaine courte."
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {overview.macro.items.map(item => (
            <Card
              key={item.seriesId}
              className="overflow-hidden border-border/60 bg-[linear-gradient(180deg,var(--surface-1),var(--surface-0))]"
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-primary/65">{item.group}</p>
                    <CardTitle className="mt-1 text-base">{item.shortLabel}</CardTitle>
                  </div>
                  <Badge variant="outline">{item.source.provider.toUpperCase()}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="font-financial text-3xl font-semibold">{item.displayValue}</p>
                    <p className={`mt-1 text-sm font-medium ${item.changeDirection === 'up' ? 'text-warning' : item.changeDirection === 'down' ? 'text-positive' : 'text-muted-foreground'}`}>
                      {item.comparisonLabel}: {item.comparisonValue ?? 'n/d'}
                    </p>
                  </div>
                  <div className="min-w-[120px] flex-1">
                    <D3Sparkline
                      data={item.history.map(point => ({ date: point.date, value: point.value }))}
                      height={84}
                      showTooltip={false}
                      showArea={true}
                      color={
                        item.changeDirection === 'up'
                          ? 'var(--warning)'
                          : item.changeDirection === 'down'
                            ? 'var(--positive)'
                            : 'var(--primary)'
                      }
                      gradientFrom="var(--primary)"
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-border/50 bg-background/55 p-3 text-sm text-muted-foreground">
                  <p>{item.description}</p>
                  <p className="mt-2 text-xs">{item.source.freshnessLabel}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="watchlist" className="space-y-4">
        <SectionHeading
          eyebrow="Watchlist mondiale"
          title="Univers codé, provenance explicite"
          description="Lecture dense mais stable: prix, devise, variations, source, retard et fraîcheur par ligne."
        />

        <Card className="border-border/60 bg-[linear-gradient(180deg,var(--surface-1),var(--surface-0))]">
          <CardContent className="p-0">
            <div className="hidden overflow-x-auto lg:block">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-left text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    <th className="px-4 py-3">Actif</th>
                    <th className="px-4 py-3">Prix</th>
                    <th className="px-4 py-3">Jour</th>
                    <th className="px-4 py-3">30j</th>
                    <th className="px-4 py-3">YTD</th>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3">Fraîcheur</th>
                  </tr>
                </thead>
                <tbody>
                  {watchlistItems.map(item => (
                    <tr key={item.instrumentId} className="border-b border-border/40 last:border-b-0">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <MiniSparkline
                            data={item.history.map(point => point.value)}
                            width={72}
                            height={24}
                            color="auto"
                          />
                          <div>
                            <p className="font-medium">{item.shortLabel}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.symbol} · {item.exchange} · {item.currency}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-financial">{formatMoney(item.price, item.currency)}</td>
                      <td className={`px-4 py-3 font-medium ${item.dayChangePct !== null && item.dayChangePct >= 0 ? 'text-positive' : 'text-negative'}`}>
                        {formatSignedPercent(item.dayChangePct)}
                      </td>
                      <td className={`px-4 py-3 ${item.monthChangePct !== null && item.monthChangePct >= 0 ? 'text-positive' : 'text-negative'}`}>
                        {formatSignedPercent(item.monthChangePct)}
                      </td>
                      <td className={`px-4 py-3 ${item.ytdChangePct !== null && item.ytdChangePct >= 0 ? 'text-positive' : 'text-negative'}`}>
                        {formatSignedPercent(item.ytdChangePct)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{item.source.provider}</Badge>
                          {item.proxyLabel && <Badge variant="outline">{item.proxyLabel}</Badge>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        <p>{item.source.delayLabel}</p>
                        <p>{formatDate(item.source.quoteDate)}</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-3 p-4 lg:hidden">
              {watchlistItems.map(item => (
                <article key={item.instrumentId} className="rounded-2xl border border-border/50 bg-background/60 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{item.shortLabel}</p>
                      <p className="text-xs text-muted-foreground">{item.symbol} · {item.currency}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-financial text-lg font-semibold">{formatMoney(item.price, item.currency)}</p>
                      <p className={`text-sm ${item.dayChangePct !== null && item.dayChangePct >= 0 ? 'text-positive' : 'text-negative'}`}>
                        {formatSignedPercent(item.dayChangePct)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <MiniSparkline data={item.history.map(point => point.value)} width={90} height={28} color="auto" />
                    <div className="text-right text-xs text-muted-foreground">
                      <p>{formatSourceLabel(item)}</p>
                      <p>{formatDate(item.source.quoteDate)}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <section id="signals" className="space-y-4">
        <SectionHeading
          eyebrow="Signals"
          title="Lecture rapide, zéro fake AI"
          description="Chaque bloc provient de règles locales basées sur le snapshot marché/macro, avec évidence et refs."
        />

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.85fr)]">
          <div className="grid gap-3">
            {[...overview.signals.items]
              .sort((left, right) => signalOrder[right.severity] - signalOrder[left.severity])
              .map(signal => (
                <article
                  key={signal.id}
                  className={`rounded-[26px] border p-4 shadow-[var(--shadow-sm)] ${toSignalClasses(signal.tone)}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                        {signal.severity}
                      </p>
                      <h3 className="mt-1 text-lg font-semibold">{signal.title}</h3>
                    </div>
                    <Badge variant="outline">{signal.tone}</Badge>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{signal.detail}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {signal.evidence.map(item => (
                      <span
                        key={`${signal.id}-${item}`}
                        className="rounded-full border border-border/50 bg-background/70 px-2.5 py-1 text-xs text-muted-foreground"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
          </div>

          <Card className="border-border/60 bg-[linear-gradient(180deg,var(--surface-1),var(--surface-0))]">
            <CardHeader>
              <CardTitle className="text-base">Legend & freshness</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <LegendRow label="EOD" detail="Clôture du provider primaire, pas de promesse intraday." />
              <LegendRow label="Overlay US" detail="Twelve Data utilisé seulement sur quelques lignes US éligibles." />
              <LegendRow label="FRED" detail="Macro officielle, fréquences hétérogènes selon la série." />
              <LegendRow
                label="Confiance bundle"
                detail={`${overview.contextBundle.confidence.score}/100 · ${overview.contextBundle.confidence.level}`}
              />
            </CardContent>
          </Card>
        </div>
      </section>

      <section id="bundle" className="space-y-4">
        <SectionHeading
          eyebrow="Bundle IA futur"
          title="Objet stable, sérialisable et traçable"
          description="Pas de LLM ici. Le but est de préparer un contexte marché/macro propre, réutilisable plus tard par un advisor."
        />

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
          <Card className="border-border/60 bg-[linear-gradient(180deg,var(--surface-1),var(--surface-0))]">
            <CardContent className="space-y-5 p-5">
              <div className="grid gap-3 md:grid-cols-2">
                <BundleMetric
                  label="Coverage"
                  value={`${overview.contextBundle.coverageSummary.instrumentCount} actifs`}
                  detail={`${overview.contextBundle.coverageSummary.macroSeriesCount} séries macro`}
                />
                <BundleMetric
                  label="Key movers"
                  value={`${overview.contextBundle.keyMovers.gainers.length + overview.contextBundle.keyMovers.losers.length}`}
                  detail="mouvements saillants"
                />
                <BundleMetric
                  label="Breadth"
                  value={`${overview.contextBundle.marketBreadth.positiveCount}/${overview.contextBundle.coverageSummary.instrumentCount}`}
                  detail="ligne(s) positives"
                />
                <BundleMetric
                  label="Confidence"
                  value={`${overview.contextBundle.confidence.score}/100`}
                  detail={overview.contextBundle.confidence.level}
                />
              </div>

              <div className="rounded-[24px] border border-border/50 bg-background/60 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-primary/65">Champs clefs</p>
                <div className="mt-3 grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
                  {[
                    'marketRegimeHints',
                    'quoteFreshness',
                    'keyMovers',
                    'macroRegime',
                    'ratesSummary',
                    'inflationSummary',
                    'laborSummary',
                    'riskFlags',
                    'watchlistHighlights',
                    'providerProvenance',
                  ].map(field => (
                    <div key={field} className="rounded-2xl border border-border/40 bg-surface-1 px-3 py-2 font-mono text-xs">
                      {field}
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <Card className="border-border/50 bg-background/55">
                  <CardContent className="space-y-2 p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-primary/65">Warnings</p>
                    {overview.contextBundle.warnings.length > 0 ? (
                      overview.contextBundle.warnings.map(item => (
                        <p key={item} className="text-sm text-muted-foreground">{item}</p>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">Aucun warning bloquant dans le bundle courant.</p>
                    )}
                  </CardContent>
                </Card>
                <Card className="border-border/50 bg-background/55">
                  <CardContent className="space-y-2 p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-primary/65">Caveats</p>
                    {overview.contextBundle.confidence.caveats.length > 0 ? (
                      overview.contextBundle.confidence.caveats.map(item => (
                        <p key={item} className="text-sm text-muted-foreground">{item}</p>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">Confiance élevée sans caveat majeur exposé.</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-[linear-gradient(180deg,var(--surface-1),var(--surface-0))]">
            <CardHeader>
              <CardTitle className="text-base">Provider provenance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {overview.contextBundle.providerProvenance.map(item => (
                <div key={`${item.provider}-${item.role}`} className="rounded-2xl border border-border/50 bg-background/55 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{item.label}</p>
                    <Badge variant="outline">{item.role}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{item.note}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{item.freshnessLabel}</p>
                </div>
              ))}

              <div className="rounded-2xl border border-border/50 bg-background/55 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-primary/65">Bundle timestamp</p>
                <p className="mt-2 text-sm text-muted-foreground">{overview.contextBundle.generatedAt}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  schéma {overview.contextBundle.schemaVersion}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string
  title: string
  description: string
}) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.28em] text-primary/70">{eyebrow}</p>
      <h2 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  )
}

function StatPill({
  label,
  value,
  detail,
}: {
  label: string
  value: string
  detail: string
}) {
  return (
    <div className="rounded-2xl border border-border/50 bg-background/60 px-4 py-3">
      <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
      <p className="mt-2 font-financial text-xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  )
}

function MetricChip({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-border/50 bg-background/55 px-2.5 py-2 text-center">
      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="mt-1 font-financial text-xs font-medium">{value}</p>
    </div>
  )
}

function LegendRow({
  label,
  detail,
}: {
  label: string
  detail: string
}) {
  return (
    <div className="rounded-2xl border border-border/50 bg-background/55 px-3 py-3">
      <p className="text-xs uppercase tracking-[0.2em] text-primary/65">{label}</p>
      <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
    </div>
  )
}

function BundleMetric({
  label,
  value,
  detail,
}: {
  label: string
  value: string
  detail: string
}) {
  return (
    <div className="rounded-2xl border border-border/50 bg-background/55 px-4 py-3">
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="mt-1 font-financial text-lg font-semibold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  )
}
