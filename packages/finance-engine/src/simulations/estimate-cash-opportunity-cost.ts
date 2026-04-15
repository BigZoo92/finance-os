export const estimateCashOpportunityCost = ({
  idleCashAmount,
  annualCashRatePct,
  annualPortfolioReturnPct,
}: {
  idleCashAmount: number
  annualCashRatePct: number
  annualPortfolioReturnPct: number
}) => {
  const gapPct = Math.max(annualPortfolioReturnPct - annualCashRatePct, 0)
  const annualOpportunityCost = Math.max(idleCashAmount, 0) * (gapPct / 100)

  return {
    gapPct: Math.round(gapPct * 1000) / 1000,
    annualOpportunityCost: Math.round(annualOpportunityCost * 100) / 100,
  }
}
