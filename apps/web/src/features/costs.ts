export type CostBasis = 'actual' | 'estimated' | 'mixed'

export type CostBasisDescriptor = {
  /** Readable FR label for the cost basis. */
  label: string
  /** True when any part of the displayed amount is an estimate (not billed). */
  isEstimate: boolean
}

/**
 * Describe the cost basis so the UI never presents an estimate as a real billed
 * amount. `estimated` and `mixed` are flagged as estimates; only fully `actual`
 * is presented as real.
 */
export const describeCostBasis = (basis: CostBasis): CostBasisDescriptor => {
  switch (basis) {
    case 'actual':
      return { label: 'réel (facturé)', isEstimate: false }
    case 'mixed':
      return { label: 'réel + estimé', isEstimate: true }
    default:
      return { label: 'estimé', isEstimate: true }
  }
}
