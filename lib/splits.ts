export interface SplitInput {
  basePrice: number
  travelFee: number
}

export interface SplitBreakdown {
  grossTotal: number
  driverReimbursement: number
  laborPool: number
  houseFund: number
  teamPool: number
}

/**
 * Splits a shoot's revenue: travel fee is reimbursed 1:1 to the driver,
 * while the base price is divided 60/30/10 between labor, the house, and the team pool.
 */
export function calculateSplits({ basePrice, travelFee }: SplitInput): SplitBreakdown {
  const safeBasePrice = Number.isFinite(basePrice) && basePrice > 0 ? basePrice : 0
  const safeTravelFee = Number.isFinite(travelFee) && travelFee > 0 ? travelFee : 0

  return {
    grossTotal: safeBasePrice + safeTravelFee,
    driverReimbursement: safeTravelFee,
    laborPool: safeBasePrice * 0.6,
    houseFund: safeBasePrice * 0.3,
    teamPool: safeBasePrice * 0.1,
  }
}
