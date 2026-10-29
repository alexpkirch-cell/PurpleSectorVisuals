export type ShooterRole = "lead" | "co_lead" | "second"

export interface AssignedShooter {
  name: string
  role: ShooterRole
}

export type SettlementRole =
  | "Lead Shooter"
  | "Co-Lead Shooter"
  | "Second Shooter"
  | "Editor"
  | "Admin"
  | "House"
  | "Driver Reimbursement"

export type SettlementStatus = "pending" | "paid" | "retained" | "comped"

export interface SettlementLine {
  recipient_name: string
  role: SettlementRole
  /** Share of Net Distributable Revenue, in percent. Driver reimbursement sits off the top, so it is 0. */
  pool_percentage: number
  amount: number
  status: SettlementStatus
}

export interface SettlementInput {
  totalCollected: number
  driverReimbursement: number
  shooters: readonly AssignedShooter[]
  editors: readonly string[]
  isComped?: boolean
}

export const SHOOTERS_POOL_PERCENT = 50
export const EDITORS_POOL_PERCENT = 15
export const ADMIN_POOL_PERCENT = 10
export const HOUSE_POOL_PERCENT = 25

/** Lead + Second default split of the 50% shooters pool. */
const LEAD_TIER_WITH_SECOND_PERCENT = 35
const SECOND_TIER_PERCENT = 15

const toCents = (value: number) => Math.round((Number.isFinite(value) && value > 0 ? value : 0) * 100)
const fromCents = (cents: number) => cents / 100
const round2 = (value: number) => Math.round(value * 100) / 100

/** Splits cents evenly across `count` people; any remainder goes to the first people so the total never drifts. */
function evenCents(totalCents: number, count: number) {
  const base = Math.floor(totalCents / count)
  const remainder = totalCents - base * count
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0))
}

/**
 * Company settlement formula:
 *   1. Driver / travel reimbursement comes off the top.
 *   2. Net = Total Collected - Driver Reimbursement.
 *   3. Shooters 50% (35/15 lead + second, evenly split between co-leads, solo takes it all),
 *      Editors 15%, Admin 10%, House 25% (absorbs rounding).
 * Comped / $0 shoots return every line at $0.00 with status "comped" and never divide by zero.
 */
export function computeSettlement(input: SettlementInput): SettlementLine[] {
  const comped = Boolean(input.isComped) || toCents(input.totalCollected) === 0

  const totalCents = comped ? 0 : toCents(input.totalCollected)
  const driverCents = comped ? 0 : Math.min(toCents(input.driverReimbursement), totalCents)
  const netCents = totalCents - driverCents

  const status = (fallback: SettlementStatus): SettlementStatus => (comped ? "comped" : fallback)

  const leadTier = input.shooters.filter((s) => s.role === "lead" || s.role === "co_lead")
  const seconds = input.shooters.filter((s) => s.role === "second")

  // Promote seconds to an even split when nobody is flagged lead, so the pool is never orphaned.
  const hasLeadTier = leadTier.length > 0
  const hasSeconds = seconds.length > 0

  const shooterPoolCents = Math.round((netCents * SHOOTERS_POOL_PERCENT) / 100)
  const leadTierPercent = hasSeconds && hasLeadTier ? LEAD_TIER_WITH_SECOND_PERCENT : SHOOTERS_POOL_PERCENT
  const leadTierCents = hasLeadTier
    ? hasSeconds
      ? Math.round((netCents * LEAD_TIER_WITH_SECOND_PERCENT) / 100)
      : shooterPoolCents
    : 0
  const secondTierPercent = hasLeadTier ? SECOND_TIER_PERCENT : SHOOTERS_POOL_PERCENT
  const secondTierCents = hasSeconds ? shooterPoolCents - leadTierCents : 0

  const lines: SettlementLine[] = []

  const driverName = leadTier[0]?.name ?? input.shooters[0]?.name ?? "Driver"
  if (driverCents > 0 || (!comped && toCents(input.driverReimbursement) > 0)) {
    lines.push({
      recipient_name: driverName,
      role: "Driver Reimbursement",
      pool_percentage: 0,
      amount: fromCents(driverCents),
      status: status("pending"),
    })
  }

  if (hasLeadTier) {
    const shares = evenCents(leadTierCents, leadTier.length)
    leadTier.forEach((shooter, index) => {
      lines.push({
        recipient_name: shooter.name,
        role: shooter.role === "lead" ? "Lead Shooter" : "Co-Lead Shooter",
        pool_percentage: round2(leadTierPercent / leadTier.length),
        amount: fromCents(shares[index]),
        status: status("pending"),
      })
    })
  }

  if (hasSeconds) {
    const shares = evenCents(secondTierCents, seconds.length)
    seconds.forEach((shooter, index) => {
      lines.push({
        recipient_name: shooter.name,
        role: "Second Shooter",
        pool_percentage: round2(secondTierPercent / seconds.length),
        amount: fromCents(shares[index]),
        status: status("pending"),
      })
    })
  }

  if (!hasLeadTier && !hasSeconds) {
    lines.push({
      recipient_name: "Unassigned Shooter",
      role: "Lead Shooter",
      pool_percentage: SHOOTERS_POOL_PERCENT,
      amount: fromCents(shooterPoolCents),
      status: status("pending"),
    })
  }

  const editorPoolCents = Math.round((netCents * EDITORS_POOL_PERCENT) / 100)
  const editors = input.editors.length > 0 ? input.editors : ["Unassigned Editor"]
  const editorShares = evenCents(editorPoolCents, editors.length)
  editors.forEach((name, index) => {
    lines.push({
      recipient_name: name,
      role: "Editor",
      pool_percentage: round2(EDITORS_POOL_PERCENT / editors.length),
      amount: fromCents(editorShares[index]),
      status: status("pending"),
    })
  })

  const adminCents = Math.round((netCents * ADMIN_POOL_PERCENT) / 100)
  lines.push({
    recipient_name: "Admin",
    role: "Admin",
    pool_percentage: ADMIN_POOL_PERCENT,
    amount: fromCents(adminCents),
    status: status("pending"),
  })

  const distributedCents = lines.reduce((sum, line) => sum + toCents(line.amount), 0) - driverCents
  lines.push({
    recipient_name: "House",
    role: "House",
    pool_percentage: HOUSE_POOL_PERCENT,
    amount: fromCents(Math.max(0, netCents - distributedCents)),
    status: status("retained"),
  })

  return lines
}

export interface SettlementSummary {
  totalCollected: number
  driverReimbursement: number
  netRevenue: number
}

export function summarizeSettlement(input: Pick<SettlementInput, "totalCollected" | "driverReimbursement" | "isComped">) {
  const comped = Boolean(input.isComped) || toCents(input.totalCollected) === 0
  const total = comped ? 0 : toCents(input.totalCollected)
  const driver = comped ? 0 : Math.min(toCents(input.driverReimbursement), total)
  return {
    totalCollected: fromCents(total),
    driverReimbursement: fromCents(driver),
    netRevenue: fromCents(total - driver),
  } satisfies SettlementSummary
}
