import type { Shoot, ShootStatus } from "@/app/actions/shoots"

export type StageId =
  | "new_inquiry"
  | "in_discussion"
  | "awaiting_signature"
  | "booked"
  | "post_production"
  | "delivered_settled"

export interface PipelineStage {
  id: StageId
  label: string
  hint: string
  /** Every shoot status that belongs in this column. */
  statuses: readonly ShootStatus[]
  /** The status a card receives when it is moved into this column. */
  dropStatus: ShootStatus
}

export const PIPELINE_STAGES: readonly PipelineStage[] = [
  {
    id: "new_inquiry",
    label: "New Inquiry",
    hint: "Fresh leads to qualify",
    statuses: ["new_inquiry"],
    dropStatus: "new_inquiry",
  },
  {
    id: "in_discussion",
    label: "Quote & Documents",
    hint: "Build the quote and create the vault",
    statuses: ["in_discussion"],
    dropStatus: "in_discussion",
  },
  {
    id: "awaiting_signature",
    label: "Awaiting Signature & Retainer",
    hint: "Vault sent, pending signature and retainer",
    statuses: ["awaiting_signature"],
    dropStatus: "awaiting_signature",
  },
  {
    id: "booked",
    label: "Booked & Paid",
    hint: "Signed, paid, and on the calendar",
    statuses: ["booked_paid"],
    dropStatus: "booked_paid",
  },
  {
    id: "post_production",
    label: "Post-Production / Editing",
    hint: "Culling and color grading",
    statuses: ["post_production"],
    dropStatus: "post_production",
  },
  {
    id: "delivered_settled",
    label: "Delivered & Settled",
    hint: "Gallery released, payouts recorded",
    statuses: ["delivered_settled"],
    dropStatus: "delivered_settled",
  },
]

export const STATUS_LABELS: Record<ShootStatus, string> = {
  new_inquiry: "New Inquiry",
  in_discussion: "Quote & Documents",
  awaiting_signature: "Awaiting Signature & Retainer",
  booked_paid: "Booked & Paid",
  post_production: "Post-Production / Editing",
  delivered_settled: "Delivered & Settled",
  declined: "Declined",
}

const CONFIRMED_STATUSES: readonly ShootStatus[] = ["booked_paid", "post_production", "delivered_settled"]

const LEAD_STATUSES: readonly ShootStatus[] = ["new_inquiry", "in_discussion", "awaiting_signature"]

const CLOSED_STATUSES: readonly ShootStatus[] = ["delivered_settled", "declined"]

export function stageForStatus(status: ShootStatus): PipelineStage | null {
  return PIPELINE_STAGES.find((stage) => stage.statuses.includes(status)) ?? null
}

// pg returns timestamptz columns as Date objects even though the Shoot type says string.
function toDate(value: string | Date | null): Date | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function dayKey(value: string | Date | null) {
  return toDate(value)?.toISOString().slice(0, 10) ?? null
}

export function monthKeyOf(value: string | Date | null) {
  return toDate(value)?.toISOString().slice(0, 7) ?? null
}

export interface OperationsKpis {
  activeLeads: number
  confirmedThisMonth: number
  inPostProduction: number
  invoicedThisMonth: number
}

function shootValue(shoot: Shoot) {
  if (shoot.final_amount !== null) return Number(shoot.final_amount) || 0
  return (Number(shoot.base_price) || 0) + (Number(shoot.travel_fee) || 0)
}

export function computeKpis(shoots: readonly Shoot[], monthKey: string): OperationsKpis {
  const confirmedThisMonth = shoots.filter(
    (shoot) => CONFIRMED_STATUSES.includes(shoot.status) && monthKeyOf(shoot.shoot_date) === monthKey,
  )

  return {
    activeLeads: shoots.filter((shoot) => LEAD_STATUSES.includes(shoot.status)).length,
    confirmedThisMonth: confirmedThisMonth.length,
    inPostProduction: shoots.filter((shoot) => shoot.status === "post_production").length,
    invoicedThisMonth: confirmedThisMonth.reduce((sum, shoot) => sum + shootValue(shoot), 0),
  }
}

export type CalendarStatus = "tentative" | "confirmed" | "completed"

export const CALENDAR_STATUS_META: Record<CalendarStatus, { label: string; chipClass: string; dotClass: string }> = {
  tentative: {
    label: "Tentative",
    chipClass: "bg-calendar-tentative text-calendar-foreground",
    dotClass: "bg-calendar-tentative",
  },
  confirmed: {
    label: "Confirmed",
    chipClass: "bg-calendar-confirmed text-calendar-foreground",
    dotClass: "bg-calendar-confirmed",
  },
  completed: {
    label: "Completed",
    chipClass: "bg-calendar-completed text-calendar-foreground ring-1 ring-border",
    dotClass: "bg-calendar-completed ring-1 ring-border",
  },
}

/**
 * Past shoots are completed. Upcoming shoots are confirmed only once the client has signed
 * and the deposit is in (a comped shoot has no deposit to wait for); everything else is tentative.
 */
export function calendarStatusOf(shoot: Shoot, todayKey: string): CalendarStatus {
  const key = dayKey(shoot.shoot_date)
  if (key !== null && key < todayKey) return "completed"
  const depositCleared = Boolean(shoot.vault_deposit_paid) || Boolean(shoot.is_comped)
  return shoot.vault_contract_signed && depositCleared ? "confirmed" : "tentative"
}

/** Shoots keyed by their UTC calendar day, so the grid can look up a cell in O(1). */
export function groupShootsByDay(shoots: readonly Shoot[]): Map<string, Shoot[]> {
  const byDay = new Map<string, Shoot[]>()
  for (const shoot of shoots) {
    const key = dayKey(shoot.shoot_date)
    if (key === null) continue
    byDay.set(key, [...(byDay.get(key) ?? []), shoot])
  }
  return byDay
}

export function formatShootDate(value: string | Date | null, withWeekday = false) {
  const date = toDate(value)
  if (!date) return null
  return date.toLocaleDateString("en-US", {
    ...(withWeekday ? { weekday: "short" } : {}),
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount)
}

export function leadShooterOf(shoot: Shoot) {
  return shoot.assigned_shooter || shoot.preferred_shooter || null
}

export function packageOf(shoot: Shoot) {
  return shoot.package_tier || shoot.shoot_type
}
