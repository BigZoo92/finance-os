const round = (value: number, digits = 4) => {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

export const calculateSharpeRatio = ({
  expectedReturnPct,
  riskFreeRatePct,
  volatilityPct,
}: {
  expectedReturnPct: number
  riskFreeRatePct: number
  volatilityPct: number
}) => {
  if (volatilityPct <= 0) {
    return null
  }

  return round((expectedReturnPct - riskFreeRatePct) / volatilityPct)
}

export const calculateSortinoRatio = ({
  expectedReturnPct,
  riskFreeRatePct,
  downsideDeviationPct,
}: {
  expectedReturnPct: number
  riskFreeRatePct: number
  downsideDeviationPct: number
}) => {
  if (downsideDeviationPct <= 0) {
    return null
  }

  return round((expectedReturnPct - riskFreeRatePct) / downsideDeviationPct)
}

export const calculateMaxDrawdownPct = (
  series: Array<{
    balance: number
  }>
) => {
  if (series.length < 2) {
    return null
  }

  let peak = series[0]?.balance ?? 0
  let maxDrawdown = 0

  for (const point of series) {
    peak = Math.max(peak, point.balance)
    if (peak <= 0) {
      continue
    }

    maxDrawdown = Math.max(maxDrawdown, (peak - point.balance) / peak)
  }

  return round(maxDrawdown * 100, 2)
}
