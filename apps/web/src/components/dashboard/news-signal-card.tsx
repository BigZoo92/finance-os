import { useState } from 'react'
import { Badge, Separator } from '@finance-os/ui/components'
import type { DashboardNewsSignalCard as DashboardNewsSignalCardModel } from '@/features/dashboard-types'

const formatDateTime = (value: string | null) => {
  if (!value) {
    return 'n/a'
  }

  return new Date(value).toLocaleString()
}

const getPrimaryImageUrl = (
  metadataCard: DashboardNewsSignalCardModel['metadataCard']
) => {
  return metadataCard?.imageUrl ?? metadataCard?.imageCandidates[0] ?? null
}

const getPrimaryFaviconUrl = (
  metadataCard: DashboardNewsSignalCardModel['metadataCard']
) => {
  return metadataCard?.faviconUrl ?? metadataCard?.faviconCandidates[0] ?? null
}

const getSourceInitial = (item: DashboardNewsSignalCardModel) => {
  const sourceLabel = item.metadataCard?.siteName ?? item.sourceName
  return sourceLabel.slice(0, 1).toUpperCase()
}

export function NewsSignalCard({
  item,
  score,
  reasons,
}: {
  item: DashboardNewsSignalCardModel
  score: number
  reasons: string[]
}) {
  const metadataCard = item.metadataCard
  const primaryImageUrl = getPrimaryImageUrl(metadataCard)
  const primaryFaviconUrl = getPrimaryFaviconUrl(metadataCard)
  const extraImageCount = Math.max((metadataCard?.imageCandidates.length ?? 0) - 1, 0)
  const [imageFailed, setImageFailed] = useState(false)
  const [faviconFailed, setFaviconFailed] = useState(false)
  const showImage = Boolean(primaryImageUrl) && !imageFailed
  const showFavicon = Boolean(primaryFaviconUrl) && !faviconFailed
  const previewTitle = metadataCard?.title ?? item.title
  const previewDescription =
    metadataCard?.description ??
    item.summary ??
    item.contentSnippet ??
    'Card visuelle construite depuis la provenance source et les meta tags disponibles.'
  const supportingSources = item.sources.slice(0, 3).map(sourceEntry => sourceEntry.sourceName).join(' / ')

  return (
    <article className="group overflow-hidden rounded-[28px] border border-border/60 bg-[linear-gradient(180deg,color-mix(in_oklch,var(--surface-1)_92%,white)_0%,color-mix(in_oklch,var(--background)_96%,var(--primary))_100%)] shadow-sm transition-transform duration-[var(--duration-normal)] hover:-translate-y-0.5 hover:shadow-md">
      <div className="grid gap-0 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.95fr)]">
        <div className="space-y-4 p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{item.eventType}</Badge>
            <Badge variant="outline">{item.sourceType}</Badge>
            <Badge variant="outline">impact {item.marketImpactScore}</Badge>
            <Badge variant="outline">confidence {item.confidence}</Badge>
            <Badge variant="outline">novelty {item.novelty}</Badge>
          </div>

          <div className="space-y-2">
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="text-lg font-semibold leading-snug tracking-tight transition-colors hover:text-primary"
            >
              {item.title}
            </a>
            <p className="text-xs text-muted-foreground">
              {item.sourceName}
              {item.sourceDomain ? ` / ${item.sourceDomain}` : ''}
              {' / '}
              {formatDateTime(item.publishedAt)}
            </p>
            <p className="max-w-3xl text-sm text-foreground/90">{item.summary ?? item.contentSnippet ?? 'Aucun resume provider disponible.'}</p>
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
            <div className="rounded-[24px] border border-border/50 bg-background/80 p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Why it matters</p>
              <ul className="mt-3 space-y-2 text-sm text-foreground/90">
                {item.whyItMatters.slice(0, 3).map(reason => (
                  <li key={reason}>- {reason}</li>
                ))}
              </ul>
              <div className="mt-4 flex flex-wrap gap-2">
                {item.domains.slice(0, 4).map(domainEntry => (
                  <Badge key={`${item.id}-${domainEntry}`} variant="ghost">
                    {domainEntry}
                  </Badge>
                ))}
                {item.affectedSectors.slice(0, 3).map(sectorEntry => (
                  <Badge key={`${item.id}-${sectorEntry}`} variant="outline">
                    {sectorEntry}
                  </Badge>
                ))}
                {item.affectedTickers.slice(0, 3).map(tickerEntry => (
                  <Badge key={`${item.id}-${tickerEntry}`} variant="outline">
                    {tickerEntry}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="rounded-[24px] border border-border/50 bg-surface-1 p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">UI rank</p>
              <p className="mt-3 text-3xl font-semibold tracking-tight">{score}</p>
              <p className="mt-3 text-xs text-muted-foreground">Raisons: {reasons.join(', ')}</p>
            </div>
          </div>

          <Separator />

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-[24px] border border-border/50 bg-surface-1 p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Provenance</p>
              <p className="mt-3 text-sm font-medium">
                {item.provenance.sourceCount} source{item.provenance.sourceCount > 1 ? 's' : ''} / {item.provenance.providerCount} provider{item.provenance.providerCount > 1 ? 's' : ''}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {supportingSources || 'Provenance disponible dans le cluster courant.'}
              </p>
            </div>

            <div className="rounded-[24px] border border-border/50 bg-surface-1 p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Transmission</p>
              <p className="mt-3 text-sm text-foreground/90">
                {item.transmissionHypotheses[0]?.label ??
                  'Aucune hypothese de transmission explicite pour ce signal.'}
              </p>
            </div>
          </div>
        </div>

        <div className="border-t border-border/60 xl:border-l xl:border-t-0">
          <div className="relative flex h-full min-h-[270px] flex-col justify-between overflow-hidden bg-[linear-gradient(180deg,color-mix(in_oklch,var(--surface-1)_80%,var(--primary))_0%,color-mix(in_oklch,var(--background)_90%,black)_100%)] p-5 text-white">
            {showImage ? (
              <img
                src={primaryImageUrl ?? undefined}
                alt=""
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                onError={() => setImageFailed(true)}
              />
            ) : null}
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,8,13,0.18)_0%,rgba(6,8,13,0.58)_45%,rgba(6,8,13,0.92)_100%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(246,185,59,0.26),transparent_46%)]" />

            <div className="relative flex items-start justify-between gap-3">
              <div className="inline-flex items-center gap-3 rounded-full border border-white/18 bg-black/25 px-3 py-2 backdrop-blur-sm">
                {showFavicon ? (
                  <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-white/90">
                    <img
                      src={primaryFaviconUrl ?? undefined}
                      alt=""
                      className="h-5 w-5 object-contain"
                      onError={() => setFaviconFailed(true)}
                    />
                  </span>
                ) : (
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/10 text-sm font-semibold">
                    {getSourceInitial(item)}
                  </span>
                )}
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-white/65">Source card</p>
                  <p className="text-sm font-medium text-white">
                    {metadataCard?.siteName ?? item.sourceName}
                  </p>
                </div>
              </div>

              {extraImageCount > 0 ? (
                <Badge variant="secondary">+{extraImageCount} visuels</Badge>
              ) : null}
            </div>

            <div className="relative space-y-3">
              <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/12 bg-black/20 px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-white/72 backdrop-blur-sm">
                <span>{metadataCard?.displayUrl ?? item.sourceDomain ?? item.sourceName}</span>
                {metadataCard?.author ? <span>author {metadataCard.author}</span> : null}
              </div>

              <div className="rounded-[24px] border border-white/14 bg-black/28 p-4 backdrop-blur-md">
                <p className="text-base font-semibold leading-snug text-white">
                  {previewTitle}
                </p>
                <p className="mt-3 text-sm leading-6 text-white/78">{previewDescription}</p>
                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-white/70">
                  <span>{formatDateTime(metadataCard?.publishedAt ?? item.publishedAt)}</span>
                  {metadataCard?.articleType ? (
                    <Badge variant="outline">{metadataCard.articleType}</Badge>
                  ) : null}
                  {metadataCard?.faviconCandidates.length ? (
                    <span>{metadataCard.faviconCandidates.length} icon source{metadataCard.faviconCandidates.length > 1 ? 's' : ''}</span>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}
