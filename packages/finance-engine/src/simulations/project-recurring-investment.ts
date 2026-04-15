import { calculateFutureValue, calculateRealReturn } from '../formulas/time-value'

export interface RecurringInvestmentProjection {
  years: number
  nominalFutureValue: number
  realFutureValue: number
}

export const projectRecurringInvestment = ({
  monthlyContribution,
  annualReturnPct,
  inflationPct,
  horizonsYears,
}: {
  monthlyContribution: number
  annualReturnPct: number
  inflationPct: number
  horizonsYears: number[]
}): RecurringInvestmentProjection[] => {
  const realReturnPct = calculateRealReturn({
    nominalReturnPct: annualReturnPct,
    inflationPct,
  })
  const effectiveRealReturnPct = realReturnPct ?? annualReturnPct - inflationPct

  return horizonsYears.map(years => ({
    years,
    nominalFutureValue: calculateFutureValue({
      annualRatePct: annualReturnPct,
      periodicContribution: monthlyContribution,
      years,
      periodsPerYear: 12,
    }),
    realFutureValue: calculateFutureValue({
      annualRatePct: effectiveRealReturnPct,
      periodicContribution: monthlyContribution,
      years,
      periodsPerYear: 12,
    }),
  }))
}
