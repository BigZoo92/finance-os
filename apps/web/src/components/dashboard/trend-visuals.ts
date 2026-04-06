export type TrendDirection = 'up' | 'down' | 'neutral'

export const getTrendDirection = ({
  start,
  end,
  epsilon = 0.005,
}: {
  start: number | null
  end: number | null
  epsilon?: number
}): TrendDirection => {
  if (start === null || end === null) {
    return 'neutral'
  }

  const delta = end - start
  if (Math.abs(delta) <= epsilon) {
    return 'neutral'
  }

  return delta > 0 ? 'up' : 'down'
}

export const summarizeCashflowDirection = ({
  incomes,
  expenses,
}: {
  incomes: number
  expenses: number
}) => {
  const net = Number((incomes - expenses).toFixed(2))
  const total = Math.max(incomes + expenses, 0)

  return {
    net,
    direction: getTrendDirection({ start: 0, end: net }),
    incomeSharePercent: total === 0 ? 50 : (incomes / total) * 100,
    expenseSharePercent: total === 0 ? 50 : (expenses / total) * 100,
  }
}
