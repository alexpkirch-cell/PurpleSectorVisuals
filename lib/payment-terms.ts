/** Retainer share of the contract total, collected at booking. The rest is charged on delivery. */
export const DEPOSIT_RATE = 0.5

export const DEPOSIT_PERCENT_LABEL = `${Math.round(DEPOSIT_RATE * 100)}%`
export const BALANCE_PERCENT_LABEL = `${Math.round((1 - DEPOSIT_RATE) * 100)}%`

/** Splits a total into deposit + balance; balance is the remainder so cents never drift. */
export function splitTotal(total: number) {
  const deposit = Math.round(total * DEPOSIT_RATE * 100) / 100
  const balance = Math.round((total - deposit) * 100) / 100
  return { deposit, balance }
}
