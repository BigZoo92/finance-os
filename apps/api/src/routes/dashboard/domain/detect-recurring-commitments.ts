export type RecurringCommitmentKind = 'fixed_charge' | 'subscription'
export type RecurringCommitmentValidationStatus = 'suggested' | 'validated' | 'rejected'
export type RecurringCommitmentPeriodicity = 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'unknown'

export interface RecurringDetectionTransactionInput {
  bookingDate: string
  amount: number
  currency: string
  label: string
}

export interface RecurringCommitmentManualValidationInput {
  kind: RecurringCommitmentKind
  canonicalLabel: string
  currency: string
  validationStatus: RecurringCommitmentValidationStatus
}

export interface RecurringCommitmentSuggestion {
  kind: RecurringCommitmentKind
  canonicalLabel: string
  currency: string
  estimatedPeriodicity: RecurringCommitmentPeriodicity
  validationStatus: Exclude<RecurringCommitmentValidationStatus, 'rejected'>
  occurrenceCount: number
  linkedTransactionDates: string[]
  lastKnownAmount: number
}

interface TransactionPoint {
  bookingDate: string
  amount: number
}

interface GroupedCommitment {
  kind: RecurringCommitmentKind
  canonicalLabel: string
  currency: string
  transactions: TransactionPoint[]
}

const normalizeLabel = (value: string): string =>
  value
    .toLowerCase()
    .replace(/\d+/g, ' ')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\b(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const getPeriodicityFromAverageGap = (averageGapDays: number): RecurringCommitmentPeriodicity => {
  if (averageGapDays >= 6 && averageGapDays <= 8) {
    return 'weekly'
  }
  if (averageGapDays >= 25 && averageGapDays <= 35) {
    return 'monthly'
  }
  if (averageGapDays >= 80 && averageGapDays <= 100) {
    return 'quarterly'
  }
  if (averageGapDays >= 350 && averageGapDays <= 380) {
    return 'yearly'
  }

  return 'unknown'
}

const toEpochDay = (date: string): number => {
  const timestamp = Date.parse(date)
  if (Number.isNaN(timestamp)) {
    return Number.NaN
  }

  return Math.floor(timestamp / 86_400_000)
}

const hasStableAmount = (amounts: number[]): boolean => {
  if (amounts.length < 2) {
    return false
  }

  const absoluteValues = amounts.map(value => Math.abs(value))
  const average = absoluteValues.reduce((total, value) => total + value, 0) / absoluteValues.length
  if (average === 0) {
    return false
  }

  return absoluteValues.every(value => Math.abs(value - average) / average <= 0.2)
}

const groupByRecurringSignal = (
  transactions: RecurringDetectionTransactionInput[],
): Map<string, GroupedCommitment> => {
  const grouped = new Map<string, GroupedCommitment>()

  for (const transaction of transactions) {
    if (transaction.amount === 0) {
      continue
    }

    const canonicalLabel = normalizeLabel(transaction.label)
    if (canonicalLabel.length < 3) {
      continue
    }

    const kind: RecurringCommitmentKind = transaction.amount > 0 ? 'fixed_charge' : 'subscription'
    const key = `${kind}|${canonicalLabel}|${transaction.currency}`
    const existing = grouped.get(key)

    if (existing) {
      existing.transactions.push({ bookingDate: transaction.bookingDate, amount: transaction.amount })
      continue
    }

    grouped.set(key, {
      kind,
      canonicalLabel,
      currency: transaction.currency,
      transactions: [{ bookingDate: transaction.bookingDate, amount: transaction.amount }],
    })
  }

  return grouped
}

export const detectRecurringCommitmentSuggestions = (input: {
  transactions: RecurringDetectionTransactionInput[]
  manualValidations: RecurringCommitmentManualValidationInput[]
}): RecurringCommitmentSuggestion[] => {
  const validationByKey = new Map(
    input.manualValidations.map(item => [`${item.kind}|${item.canonicalLabel}|${item.currency}`, item.validationStatus]),
  )

  const grouped = groupByRecurringSignal(input.transactions)
  const suggestions: RecurringCommitmentSuggestion[] = []

  for (const [, group] of grouped) {
    if (group.transactions.length < 2) {
      continue
    }

    const sortedTransactions = [...group.transactions].sort((left, right) => left.bookingDate.localeCompare(right.bookingDate))
    const dayDiffs: number[] = []

    for (let index = 1; index < sortedTransactions.length; index += 1) {
      const previousDay = toEpochDay(sortedTransactions[index - 1]!.bookingDate)
      const currentDay = toEpochDay(sortedTransactions[index]!.bookingDate)
      const diff = currentDay - previousDay

      if (Number.isFinite(diff) && diff > 0) {
        dayDiffs.push(diff)
      }
    }

    if (dayDiffs.length === 0) {
      continue
    }

    const periodicity = getPeriodicityFromAverageGap(dayDiffs.reduce((total, value) => total + value, 0) / dayDiffs.length)

    if (periodicity === 'unknown') {
      continue
    }

    const amounts = sortedTransactions.map(item => item.amount)
    if (!hasStableAmount(amounts)) {
      continue
    }

    const validationKey = `${group.kind}|${group.canonicalLabel}|${group.currency}`
    const manualValidation = validationByKey.get(validationKey)

    if (manualValidation === 'rejected') {
      continue
    }

    suggestions.push({
      kind: group.kind,
      canonicalLabel: group.canonicalLabel,
      currency: group.currency,
      estimatedPeriodicity: periodicity,
      validationStatus: manualValidation === 'validated' ? 'validated' : 'suggested',
      occurrenceCount: sortedTransactions.length,
      linkedTransactionDates: sortedTransactions.map(item => item.bookingDate),
      lastKnownAmount: Math.abs(sortedTransactions.at(-1)?.amount ?? 0),
    })
  }

  return suggestions.sort((left, right) => {
    if (left.validationStatus !== right.validationStatus) {
      return left.validationStatus === 'validated' ? -1 : 1
    }

    return right.lastKnownAmount - left.lastKnownAmount
  })
}
