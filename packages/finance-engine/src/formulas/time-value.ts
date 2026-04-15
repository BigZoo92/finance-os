const round = (value: number, digits = 2) => {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

const toRate = (annualRatePct: number, periodsPerYear: number) =>
  periodsPerYear > 0 ? annualRatePct / 100 / periodsPerYear : 0

export const calculateFutureValue = ({
  presentValue = 0,
  periodicContribution = 0,
  annualRatePct,
  years,
  periodsPerYear = 12,
}: {
  presentValue?: number
  periodicContribution?: number
  annualRatePct: number
  years: number
  periodsPerYear?: number
}) => {
  const periods = Math.max(Math.round(years * periodsPerYear), 0)
  const rate = toRate(annualRatePct, periodsPerYear)

  if (periods === 0) {
    return round(presentValue)
  }

  if (rate === 0) {
    return round(presentValue + periodicContribution * periods)
  }

  const compoundedPresentValue = presentValue * (1 + rate) ** periods
  const compoundedContributions =
    periodicContribution * (((1 + rate) ** periods - 1) / rate)

  return round(compoundedPresentValue + compoundedContributions)
}

export const calculatePresentValue = ({
  futureValue,
  annualRatePct,
  years,
}: {
  futureValue: number
  annualRatePct: number
  years: number
}) => {
  if (years <= 0) {
    return round(futureValue)
  }

  return round(futureValue / (1 + annualRatePct / 100) ** years)
}

export const calculateCagr = ({
  beginningValue,
  endingValue,
  years,
}: {
  beginningValue: number
  endingValue: number
  years: number
}) => {
  if (beginningValue <= 0 || endingValue <= 0 || years <= 0) {
    return null
  }

  return round((((endingValue / beginningValue) ** (1 / years)) - 1) * 100, 4)
}

export const calculateRealReturn = ({
  nominalReturnPct,
  inflationPct,
}: {
  nominalReturnPct: number
  inflationPct: number
}) => {
  const nominal = nominalReturnPct / 100
  const inflation = inflationPct / 100
  return round((((1 + nominal) / (1 + inflation)) - 1) * 100, 4)
}
