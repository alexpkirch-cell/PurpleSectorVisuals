import { splitTotal } from "@/lib/payment-terms"

export type DiscountType = "percent" | "fixed"

export interface QuoteLineItem {
  label: string
  amount: number
}

export interface QuoteInput {
  basePrice: number
  addons: readonly QuoteLineItem[]
  discountType: DiscountType
  discountValue: number
}

export interface Quote {
  basePrice: number
  addonsTotal: number
  subtotal: number
  discountAmount: number
  total: number
  /** True when the discount wipes out the whole quote (100% off, or a fixed discount >= the subtotal). */
  isComped: boolean
  deposit: number
  balance: number
}

const round2 = (value: number) => Math.round(value * 100) / 100

const safeAmount = (value: number) => (Number.isFinite(value) && value > 0 ? value : 0)

/**
 * Base package + add-ons, minus a percentage or fixed discount. A discount that
 * covers the whole subtotal comps the shoot: total $0.00 and no deposit/balance.
 */
export function computeQuote({ basePrice, addons, discountType, discountValue }: QuoteInput): Quote {
  const base = round2(safeAmount(basePrice))
  const addonsTotal = round2(addons.reduce((sum, item) => sum + safeAmount(item.amount), 0))
  const subtotal = round2(base + addonsTotal)

  const rawDiscount =
    discountType === "percent"
      ? (subtotal * Math.min(safeAmount(discountValue), 100)) / 100
      : Math.min(safeAmount(discountValue), subtotal)
  const discountAmount = round2(rawDiscount)

  const total = round2(Math.max(0, subtotal - discountAmount))
  const isComped = total === 0
  const { deposit, balance } = isComped ? { deposit: 0, balance: 0 } : splitTotal(total)

  return { basePrice: base, addonsTotal, subtotal, discountAmount, total, isComped, deposit, balance }
}
