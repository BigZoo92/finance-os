const DAY_MS = 24 * 60 * 60 * 1000

export type TransactionGap = {
  accountId: string
  startDate: string
  endDate: string
  gapDays: number
}

const toDayValue = (value: string) => {
  const parsed = new Date(`${value}T00:00:00.000Z`).getTime()
  return Number.isFinite(parsed) ? Math.floor(parsed / DAY_MS) : null
}

export const detectTransactionGaps = ({
  accountId,
  bookingDates,
  thresholdDays,
}: {
  accountId: string
  bookingDates: string[]
  thresholdDays: number
}): TransactionGap[] => {
  const normalized = [...new Set(bookingDates)]
    .map(value => ({ value, dayValue: toDayValue(value) }))
    .filter(
      (entry): entry is { value: string; dayValue: number } => entry.dayValue !== null
    )
    .sort((left, right) => left.dayValue - right.dayValue) as Array<{
    value: string
    dayValue: number
  }>

  if (normalized.length < 2) {
    return []
  }

  const gaps: TransactionGap[] = []
  for (let index = 1; index < normalized.length; index += 1) {
    const previous = normalized[index - 1]!
    const current = normalized[index]!
    const diffDays = current.dayValue - previous.dayValue
    if (diffDays <= thresholdDays) {
      continue
    }

    gaps.push({
      accountId,
      startDate: previous.value,
      endDate: current.value,
      gapDays: diffDays,
    })
  }

  return gaps
}
