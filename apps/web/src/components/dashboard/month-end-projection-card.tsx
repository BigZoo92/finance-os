import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@finance-os/ui/components'
import type { DashboardTransactionsResponse } from '@/features/dashboard-types'
import { MiniSparkline } from '@/components/ui/d3-sparkline'

type DashboardTransaction = DashboardTransactionsResponse['items'][number]

type MonthEndProjectionInput = {
  transactions: DashboardTransaction[]
  referenceDate?: Date
}

export type MonthEndProjectionResult = {
  monthLabel: string
  transactionsCount: number
  daysElapsed: number
  daysRemaining: number
  incomesToDate: number
  expensesToDate: number
  netToDate: number
  averageNetPerDay: number
  projectedNetAtMonthEnd: number
}

export type ProjectionTrendPoint = {
  day: number
  cumulativeNet: number
}

export type MonthlyRecurringOverview = {
  fixedChargesMonthlyTotal: number
  expectedIncomeMonthlyTotal: number
  expectedNetMonthlyAfterFixedCharges: number
  fixedCharges: Array<{ canonicalLabel: string; lastKnownAmount: number; occurrences: number }>
  expectedIncomes: Array<{ canonicalLabel: string; lastKnownAmount: number; occurrences: number }>
}

const asUtcDate = (value: string) => {
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const formatMoney = (value: number, currency = 'EUR') => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value)
}

const normalizeRecurringLabel = (value: string): string =>
  value
    .toLowerCase()
    .replace(/\d+/g, ' ')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\b(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const estimateMonthGap = (dates: string[]): number | null => {
  if (dates.length < 2) {
    return null
  }

  const sorted = [...dates].sort((left, right) => left.localeCompare(right))
  const diffs: number[] = []

  for (let index = 1; index < sorted.length; index += 1) {
    const previous = asUtcDate(sorted[index - 1] ?? '')
    const current = asUtcDate(sorted[index] ?? '')

    if (!previous || !current) {
      continue
    }

    const diff = (current.getTime() - previous.getTime()) / 86_400_000
    if (Number.isFinite(diff) && diff > 0) {
      diffs.push(diff)
    }
  }

  if (!diffs.length) {
    return null
  }

  return diffs.reduce((total, value) => total + value, 0) / diffs.length
}

const hasStableAmount = (amounts: number[]): boolean => {
  if (amounts.length < 2) {
    return false
  }

  const average = amounts.reduce((total, value) => total + value, 0) / amounts.length
  if (average === 0) {
    return false
  }

  return amounts.every(value => Math.abs(value - average) / average <= 0.2)
}

export const calculateMonthlyRecurringOverview = (
  transactions: DashboardTransaction[],
): MonthlyRecurringOverview | null => {
  const grouped = new Map<
    string,
    {
      kind: 'fixed_charge' | 'expected_income'
      canonicalLabel: string
      amounts: number[]
      bookingDates: string[]
    }
  >()

  for (const transaction of transactions) {
    if (transaction.amount === 0) {
      continue
    }

    const canonicalLabel = normalizeRecurringLabel(transaction.label)
    if (canonicalLabel.length < 3) {
      continue
    }

    const kind: 'fixed_charge' | 'expected_income' =
      transaction.direction === 'income' ? 'expected_income' : 'fixed_charge'
    const key = `${kind}|${transaction.currency}|${canonicalLabel}`
    const existing = grouped.get(key)
    const amount = Math.abs(transaction.amount)

    if (existing) {
      existing.amounts.push(amount)
      existing.bookingDates.push(transaction.bookingDate)
      continue
    }

    grouped.set(key, {
      kind,
      canonicalLabel,
      amounts: [amount],
      bookingDates: [transaction.bookingDate],
    })
  }

  const fixedCharges: MonthlyRecurringOverview['fixedCharges'] = []
  const expectedIncomes: MonthlyRecurringOverview['expectedIncomes'] = []

  for (const [, group] of grouped) {
    if (group.amounts.length < 2) {
      continue
    }

    const monthGap = estimateMonthGap(group.bookingDates)
    if (monthGap === null || monthGap < 25 || monthGap > 35) {
      continue
    }

    if (!hasStableAmount(group.amounts)) {
      continue
    }

    const target = {
      canonicalLabel: group.canonicalLabel,
      lastKnownAmount: group.amounts.at(-1) ?? 0,
      occurrences: group.amounts.length,
    }

    if (group.kind === 'expected_income') {
      expectedIncomes.push(target)
      continue
    }

    fixedCharges.push(target)
  }

  if (!fixedCharges.length && !expectedIncomes.length) {
    return null
  }

  const fixedChargesMonthlyTotal = fixedCharges.reduce((total, item) => total + item.lastKnownAmount, 0)
  const expectedIncomeMonthlyTotal = expectedIncomes.reduce((total, item) => total + item.lastKnownAmount, 0)

  return {
    fixedChargesMonthlyTotal,
    expectedIncomeMonthlyTotal,
    expectedNetMonthlyAfterFixedCharges: expectedIncomeMonthlyTotal - fixedChargesMonthlyTotal,
    fixedCharges: [...fixedCharges].sort((left, right) => right.lastKnownAmount - left.lastKnownAmount),
    expectedIncomes: [...expectedIncomes].sort((left, right) => right.lastKnownAmount - left.lastKnownAmount),
  }
}

export const calculateMonthEndProjection = ({
  transactions,
  referenceDate = new Date(),
}: MonthEndProjectionInput): MonthEndProjectionResult | null => {
  const year = referenceDate.getUTCFullYear()
  const month = referenceDate.getUTCMonth()

  const startOfMonth = Date.UTC(year, month, 1)
  const endOfMonth = Date.UTC(year, month + 1, 0)

  const monthTransactions = transactions.filter(transaction => {
    const bookingDate = asUtcDate(transaction.bookingDate)
    if (!bookingDate) {
      return false
    }

    const timestamp = bookingDate.getTime()
    return timestamp >= startOfMonth && timestamp <= endOfMonth
  })

  if (!monthTransactions.length) {
    return null
  }

  let incomesToDate = 0
  let expensesToDate = 0

  for (const transaction of monthTransactions) {
    if (transaction.direction === 'income') {
      incomesToDate += transaction.amount
      continue
    }

    expensesToDate += Math.abs(transaction.amount)
  }

  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const daysElapsed = Math.max(1, Math.min(referenceDate.getUTCDate(), daysInMonth))
  const daysRemaining = Math.max(0, daysInMonth - daysElapsed)
  const netToDate = incomesToDate - expensesToDate
  const averageNetPerDay = netToDate / daysElapsed
  const projectedNetAtMonthEnd = netToDate + averageNetPerDay * daysRemaining

  const monthLabel = referenceDate.toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })

  return {
    monthLabel,
    transactionsCount: monthTransactions.length,
    daysElapsed,
    daysRemaining,
    incomesToDate,
    expensesToDate,
    netToDate,
    averageNetPerDay,
    projectedNetAtMonthEnd,
  }
}

export const calculateProjectionTrend = (projection: MonthEndProjectionResult): ProjectionTrendPoint[] => {
  const trend: ProjectionTrendPoint[] = []

  for (let day = 1; day <= projection.daysElapsed; day += 1) {
    trend.push({
      day,
      cumulativeNet: projection.averageNetPerDay * day,
    })
  }

  for (let day = projection.daysElapsed + 1; day <= projection.daysElapsed + projection.daysRemaining; day += 1) {
    trend.push({
      day,
      cumulativeNet: projection.netToDate + projection.averageNetPerDay * (day - projection.daysElapsed),
    })
  }

  return trend
}

export const MonthEndProjectionCard = ({
  isAdmin,
  transactions,
}: {
  isAdmin: boolean
  transactions: DashboardTransaction[]
}) => {
  const projection = calculateMonthEndProjection({ transactions })
  const projectionTrend = projection ? calculateProjectionTrend(projection) : []
  const recurringOverview = calculateMonthlyRecurringOverview(transactions)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Projection fin de mois
          <Badge variant={isAdmin ? 'secondary' : 'outline'}>{isAdmin ? 'admin' : 'demo'}</Badge>
        </CardTitle>
        <CardDescription>
          Modele lineaire explicable: net courant + moyenne journaliere x jours restants.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {!isAdmin ? (
          <p className="text-muted-foreground">
            Demo: projection informative uniquement. Passe en mode admin pour piloter les actions.
          </p>
        ) : null}
        {!projection ? (
          <p className="text-muted-foreground">Aucune transaction exploitable sur le mois courant.</p>
        ) : (
          <>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-md border border-border/70 px-3 py-2">
                <p className="text-xs text-muted-foreground">Net constate ({projection.monthLabel})</p>
                <p className="font-medium">{formatMoney(projection.netToDate)}</p>
              </div>
              <div className="rounded-md border border-border/70 px-3 py-2">
                <p className="text-xs text-muted-foreground">Projection fin de mois</p>
                <p className="font-medium">{formatMoney(projection.projectedNetAtMonthEnd)}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {projection.daysElapsed} jour(s) observes sur {projection.daysElapsed + projection.daysRemaining}. Moyenne
              nette: {formatMoney(projection.averageNetPerDay)} / jour.
            </p>
            <p className="text-xs text-muted-foreground">
              Detail: revenus {formatMoney(projection.incomesToDate)} • depenses {formatMoney(projection.expensesToDate)} •
              {` ${projection.transactionsCount}`} transaction(s).
            </p>
            <div className="rounded-md border border-border/70 px-3 py-2">
              <p className="text-xs text-muted-foreground">Trajectoire du net mensuel (observé puis projeté)</p>
              <div className="mt-2 flex items-center gap-3">
                <MiniSparkline
                  data={projectionTrend.map(point => point.cumulativeNet)}
                  color="auto"
                  width={100}
                  height={28}
                  className="shrink-0"
                />
                <div className="space-y-0.5 text-xs text-muted-foreground">
                  <p>
                    J{projection.daysElapsed}: <span className="font-financial text-foreground">{formatMoney(projection.netToDate)}</span>
                  </p>
                  <p>
                    J{projection.daysElapsed + projection.daysRemaining}: {' '}
                    <span className="font-financial text-foreground">{formatMoney(projection.projectedNetAtMonthEnd)}</span>
                  </p>
                </div>
              </div>
            </div>
          </>
        )}

        {isAdmin ? (
          <div className="space-y-3 rounded-md border border-border/70 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Charges fixes & revenus attendus mensuels
            </p>
            {!recurringOverview ? (
              <p className="text-xs text-muted-foreground">
                Pas assez d&apos;historique mensuel pour estimer les charges fixes et revenus attendus.
              </p>
            ) : (
              <>
                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="rounded-md border border-border/70 px-3 py-2">
                    <p className="text-xs text-muted-foreground">Charges fixes estimees</p>
                    <p className="font-medium">{formatMoney(recurringOverview.fixedChargesMonthlyTotal)}</p>
                  </div>
                  <div className="rounded-md border border-border/70 px-3 py-2">
                    <p className="text-xs text-muted-foreground">Revenus attendus</p>
                    <p className="font-medium">{formatMoney(recurringOverview.expectedIncomeMonthlyTotal)}</p>
                  </div>
                  <div className="rounded-md border border-border/70 px-3 py-2">
                    <p className="text-xs text-muted-foreground">Marge theorique</p>
                    <p className="font-medium">
                      {formatMoney(recurringOverview.expectedNetMonthlyAfterFixedCharges)}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Estimation basee sur les operations repetitives detectees sur un rythme mensuel.
                </p>
              </>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
