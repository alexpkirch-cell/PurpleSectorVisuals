import type { Shoot, ShootStatus } from "@/app/actions/shoots"

export type StageId = "new_inquiry" | "call_set" | "booked" | "shoot_complete" | "vault_delivered"

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
    id: "call_set",
    label: "Call Set",
    hint: "Quoted and awaiting retainer",
    statuses: ["quoted", "awaiting_retainer"],
    dropStatus: "quoted",
  },
  {
    id: "booked",
    label: "Booked & Retainer Paid",
    hint: "Locked on the calendar",
    statuses: ["booked_scheduled"],
    dropStatus: "booked_scheduled",
  },
  {
    id: "shoot_complete",
    label: "Shoot Complete",
    hint: "Editing and final balance",
    statuses: ["in_post_production", "vault_locked", "pending_balance"],
    dropStatus: "in_post_production",
  },
  {
    id: "vault_delivered",
    label: "Vault Delivered",
    hint: "Fulfilled and settled",
    statuses: ["fulfilled"],
    dropStatus: "fulfilled",
  },
]

export const STATUS_LABELS: Record<ShootStatus, string> = {
  new_inquiry: "New Inquiry",
  quoted: "Quoted",
  awaiting_retainer: "Awaiting Retainer",
  booked_scheduled: "Booked & Scheduled",
  in_post_production: "In Post-Production",
  vault_locked: "Vault Locked",
  pending_balance: "Pending Balance",
  fulfilled: "Fulfilled",
  declined: "Declined",
}

const CONFIRMED_STATUSES: readonly ShootStatus[] = [
  "booked_scheduled",
  "in_post_production",
  "vault_locked",
  "pending_balance",
  "fulfilled",
]

const LEAD_STATUSES: readonly ShootStatus[] = ["new_inquiry", "quoted", "awaiting_retainer"]

const CLOSED_STATUSES: readonly ShootStatus[] = ["fulfilled", "declined"]

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
    inPostProduction: shoots.filter((shoot) => shoot.status === "in_post_production").length,
    invoicedThisMonth: confirmedThisMonth.reduce((sum, shoot) => sum + shootValue(shoot), 0),
  }
}

/** Shoots dated today or later that are still open, soonest first. */
export function upcomingShoots(shoots: readonly Shoot[], todayKey: string): Shoot[] {
  return shoots
    .filter((shoot) => {
      const key = dayKey(shoot.shoot_date)
      return key !== null && key >= todayKey && !CLOSED_STATUSES.includes(shoot.status)
    })
    .sort((a, b) => (dayKey(a.shoot_date) ?? "").localeCompare(dayKey(b.shoot_date) ?? ""))
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
