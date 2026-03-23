import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@finance-os/ui/components'
import type { DashboardRange, DashboardSummaryResponse } from '@/features/dashboard-types'

const RANGE_LABEL: Record<DashboardRange, string> = {
  '7d': '7 jours',
  '30d': '30 jours',
  '90d': '90 jours',
}

const SVG_WIDTH = 320
const SVG_HEIGHT = 112
const SVG_PADDING = 12

const formatMoney = (value: number) => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value)
}

const formatCompactMoney = (value: number) => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    notation: Math.abs(value) >= 10_000 ? 'compact' : 'standard',
    maximumFractionDigits: Math.abs(value) >= 10_000 ? 1 : 0,
  }).format(value)
}

const formatDay = (value: string) => {
  const parsed = new Date(`${value}T00:00:00.000Z`)

  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return parsed.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
  })
}

export const summarizeWealthHistory = (
  snapshots: DashboardSummaryResponse['dailyWealthSnapshots']
) => {
  if (snapshots.length === 0) {
    return {
      change: 0,
      low: null,
      high: null,
      latest: null,
      start: null,
    }
  }

  const latest = snapshots.at(-1) ?? null
  const start = snapshots[0] ?? null
  const low = snapshots.reduce<DashboardSummaryResponse['dailyWealthSnapshots'][number] | null>(
    (acc, snapshot) => {
      return !acc || snapshot.balance < acc.balance ? snapshot : acc
    },
    null
  )
  const high = snapshots.reduce<DashboardSummaryResponse['dailyWealthSnapshots'][number] | null>(
    (acc, snapshot) => {
      return !acc || snapshot.balance > acc.balance ? snapshot : acc
    },
    null
  )

  return {
    change: latest && start ? Number((latest.balance - start.balance).toFixed(2)) : 0,
    low,
    high,
    latest,
    start,
  }
}

export const buildSparklinePath = (
  snapshots: DashboardSummaryResponse['dailyWealthSnapshots'],
  width = SVG_WIDTH,
  height = SVG_HEIGHT,
  padding = SVG_PADDING
) => {
  if (snapshots.length === 0) {
    return ''
  }

  if (snapshots.length === 1) {
    const y = height / 2
    return `M ${padding} ${y} L ${width - padding} ${y}`
  }

  const balances = snapshots.map(snapshot => snapshot.balance)
  const min = Math.min(...balances)
  const max = Math.max(...balances)
  const xStep = (width - padding * 2) / (snapshots.length - 1)
  const yScale = max === min ? 0 : (height - padding * 2) / (max - min)

  return snapshots
    .map((snapshot, index) => {
      const x = padding + index * xStep
      const y =
        max === min ? height / 2 : height - padding - (snapshot.balance - min) * yScale
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(' ')
}

export function WealthHistory({
  range,
  snapshots,
  demo,
}: {
  range: DashboardRange
  snapshots: DashboardSummaryResponse['dailyWealthSnapshots']
  demo: boolean
}) {
  const summary = summarizeWealthHistory(snapshots)
  const path = buildSparklinePath(snapshots)
  const changeTone =
    summary.change >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'

  return (
    <Card className="xl:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Snapshot quotidien du patrimoine
          {demo ? <Badge variant="outline">DEMO</Badge> : null}
        </CardTitle>
        <CardDescription>
          Reconstruction journaliere du patrimoine total a partir du dernier etat des assets et des
          flux de transactions.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {snapshots.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucun snapshot disponible pour {RANGE_LABEL[range].toLowerCase()}.
          </p>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
              <div className="space-y-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Cloture du jour
                  </p>
                  <p className="text-3xl font-semibold">
                    {formatMoney(summary.latest?.balance ?? 0)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className={changeTone}>
                    {summary.change >= 0 ? '+' : ''}
                    {formatMoney(summary.change)} sur {RANGE_LABEL[range].toLowerCase()}
                  </span>
                  <span className="text-muted-foreground">
                    {formatDay(summary.start?.date ?? '')} → {formatDay(summary.latest?.date ?? '')}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-md border border-border/70 px-3 py-2">
                  <p className="text-xs text-muted-foreground">Point bas</p>
                  <p className="font-medium">{formatCompactMoney(summary.low?.balance ?? 0)}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDay(summary.low?.date ?? '')}
                  </p>
                </div>
                <div className="rounded-md border border-border/70 px-3 py-2">
                  <p className="text-xs text-muted-foreground">Point haut</p>
                  <p className="font-medium">{formatCompactMoney(summary.high?.balance ?? 0)}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDay(summary.high?.date ?? '')}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
              <svg
                viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
                role="img"
                aria-label={`Evolution du patrimoine sur ${RANGE_LABEL[range].toLowerCase()}`}
                className="h-28 w-full"
                preserveAspectRatio="none"
              >
                <path
                  d={path}
                  fill="none"
                  stroke="var(--color-chart-2)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>{formatDay(summary.start?.date ?? '')}</span>
                <span>{RANGE_LABEL[range]}</span>
                <span>{formatDay(summary.latest?.date ?? '')}</span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
