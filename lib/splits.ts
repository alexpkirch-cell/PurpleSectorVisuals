import { computeSettlement } from "@/lib/settlement"

export interface SplitInput {
  basePrice: number
  travelFee: number
}

export interface SplitBreakdown {
  grossTotal: number
  driverReimbursement: number
  shooterPool: number
  editorPool: number
  adminPool: number
  houseReserve: number
}

/** Applies travel reimbursement off the top, then the 50/15/10/25 settlement pools. */
export function calculateSplits({ basePrice, travelFee }: SplitInput): SplitBreakdown {
  const safeBasePrice = Number.isFinite(basePrice) && basePrice > 0 ? basePrice : 0
  const safeTravelFee = Number.isFinite(travelFee) && travelFee > 0 ? travelFee : 0
  const lines = computeSettlement({
    totalCollected: safeBasePrice + safeTravelFee,
    driverReimbursement: safeTravelFee,
    shooters: [],
    editors: [],
  })
  const sum = (roles: string[]) => lines.filter((line) => roles.includes(line.role)).reduce((total, line) => total + line.amount, 0)

  return {
    grossTotal: safeBasePrice + safeTravelFee,
    driverReimbursement: sum(["Driver Reimbursement"]),
    shooterPool: sum(["Lead Shooter", "Co-Lead Shooter", "Second Shooter"]),
    editorPool: sum(["Editor"]),
    adminPool: sum(["Admin"]),
    houseReserve: sum(["House"]),
  }
}
