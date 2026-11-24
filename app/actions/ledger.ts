"use server"

import { revalidatePath } from "next/cache"

import { sql } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"
import { computeSettlement, type AssignedShooter, type SettlementRole } from "@/lib/settlement"

export type LedgerRole = "driver" | "shooter" | "editor" | "admin" | "house" | "team_pool" | "labor"
export type LedgerStatus = "PENDING" | "PAID"

export interface LedgerEntry {
  id: string
  shoot_id: string
  recipient: string
  role: LedgerRole
  amount: string
  status: LedgerStatus
  paid_at: string | null
  created_at: string
}

export interface LedgerEntryWithShoot extends LedgerEntry {
  client_name: string
  shoot_type: string
}

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("Not authenticated")
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

  if (profile?.role !== "admin") {
    throw new Error("Not authorized")
  }
}

export async function listLedgerEntries(shootId: string): Promise<LedgerEntry[]> {
  await requireAdmin()

  const { rows } = await sql<LedgerEntry>`
    SELECT * FROM ledger_entries WHERE shoot_id = ${shootId} ORDER BY created_at ASC
  `

  return rows
}

export async function listAllLedgerEntries(): Promise<LedgerEntryWithShoot[]> {
  await requireAdmin()

  const { rows } = await sql<LedgerEntryWithShoot>`
    SELECT le.*, s.client_name, s.shoot_type
    FROM ledger_entries le
    JOIN shoots s ON s.id = le.shoot_id
    ORDER BY le.created_at DESC
  `

  return rows
}

/** Replaces pending settlement rows with the same 50/15/10/25 allocations shown in the final-settlement preview. */
export async function generateLedgerForShoot(
  shootId: string,
  input: {
    basePrice: number
    travelFee: number
    assignedShooters?: AssignedShooter[]
    assignedEditors?: string[]
    assignedShooter?: string | null
    assignedEditor?: string | null
  },
): Promise<LedgerEntry[]> {
  await requireAdmin()

  const shooters = input.assignedShooters ?? (input.assignedShooter ? [{ name: input.assignedShooter, role: "lead" as const }] : [])
  const editors = input.assignedEditors ?? (input.assignedEditor ? [input.assignedEditor] : [])
  const lines = computeSettlement({
    totalCollected: (Number(input.basePrice) || 0) + (Number(input.travelFee) || 0),
    driverReimbursement: Number(input.travelFee) || 0,
    shooters,
    editors,
  })

  const ledgerRole = (role: SettlementRole): LedgerRole => {
    switch (role) {
      case "Driver Reimbursement": return "driver"
      case "Lead Shooter":
      case "Co-Lead Shooter":
      case "Second Shooter": return "shooter"
      case "Editor": return "editor"
      case "Admin": return "admin"
      case "House": return "house"
    }
  }

  await sql`DELETE FROM ledger_entries WHERE shoot_id = ${shootId} AND status = 'PENDING'`

  for (const line of lines) {
    await sql`
      INSERT INTO ledger_entries (shoot_id, recipient, role, amount)
      VALUES (${shootId}, ${line.recipient_name}, ${ledgerRole(line.role)}, ${line.amount})
    `
  }

  revalidatePath("/admin")
  revalidatePath("/admin/financials")

  return listLedgerEntries(shootId)
}

export async function markLedgerEntryPaid(id: string, paid: boolean) {
  await requireAdmin()

  await sql`
    UPDATE ledger_entries
    SET status = ${paid ? "PAID" : "PENDING"}, paid_at = ${paid ? new Date().toISOString() : null}
    WHERE id = ${id}
  `

  revalidatePath("/admin")
  revalidatePath("/admin/financials")
}

export async function markShootCreatorPayoutsPaid(shootId: string, paid: boolean) {
  await requireAdmin()
  await sql`
    UPDATE ledger_entries
    SET status = ${paid ? "PAID" : "PENDING"}, paid_at = ${paid ? new Date().toISOString() : null}
    WHERE shoot_id = ${shootId} AND role IN ('shooter', 'editor', 'labor')
  `
  revalidatePath("/admin")
  revalidatePath("/admin/financials")
}

export interface FinancialsSummary {
  grossRevenue: number
  houseFundHealth: number
  totalCreatorPayoutsPaid: number
  adminPool: number
  legacyTeamPool: number
}

/** Retained buckets count when settled; shooter and editor payouts count once marked PAID. */
export async function getFinancialsSummary(): Promise<FinancialsSummary> {
  await requireAdmin()

  const { rows } = await sql<{
    gross_revenue: string
    house_fund_health: string
    creator_payouts_paid: string
    admin_pool: string
    legacy_team_pool: string
  }>`
    SELECT
      COALESCE(SUM(amount), 0) AS gross_revenue,
      COALESCE(SUM(amount) FILTER (WHERE role = 'house'), 0) AS house_fund_health,
      COALESCE(SUM(amount) FILTER (WHERE role IN ('shooter','editor','labor') AND status = 'PAID'), 0) AS creator_payouts_paid,
      COALESCE(SUM(amount) FILTER (WHERE role = 'admin'), 0) AS admin_pool,
      COALESCE(SUM(amount) FILTER (WHERE role = 'team_pool'), 0) AS legacy_team_pool
    FROM ledger_entries
  `

  const row = rows[0]

  return {
    grossRevenue: Number(row?.gross_revenue ?? 0),
    houseFundHealth: Number(row?.house_fund_health ?? 0),
    totalCreatorPayoutsPaid: Number(row?.creator_payouts_paid ?? 0),
    adminPool: Number(row?.admin_pool ?? 0),
    legacyTeamPool: Number(row?.legacy_team_pool ?? 0),
  }
}

export interface RevenueByPackage {
  package: string
  revenue: number
}

export async function getRevenueByPackage(): Promise<RevenueByPackage[]> {
  await requireAdmin()

  const { rows } = await sql<{ shoot_type: string; revenue: string }>`
    SELECT shoot_type, COALESCE(SUM(final_amount), 0) AS revenue
    FROM shoots
    WHERE final_amount IS NOT NULL
    GROUP BY shoot_type
    ORDER BY revenue DESC
  `

  return rows.map((r) => ({ package: r.shoot_type, revenue: Number(r.revenue) }))
}

export type ExpenseCategory = "payout" | "admin" | "marketing" | "opex"

export interface Expense {
  id: string
  expense_date: string
  description: string
  amount: string
  category: ExpenseCategory
  receipt_url: string | null
  created_at: string
}

/** Every logged expense, newest first, for the Financial Ledger's expense log. */
export async function listExpenses(): Promise<Expense[]> {
  await requireAdmin()

  const { rows } = await sql<Expense>`
    SELECT * FROM expenses ORDER BY expense_date DESC, created_at DESC
  `

  return rows
}

export async function createExpense(input: {
  expenseDate: string
  description: string
  amount: number
  category: ExpenseCategory
  receiptUrl: string | null
}): Promise<void> {
  await requireAdmin()

  await sql`
    INSERT INTO expenses (expense_date, description, amount, category, receipt_url)
    VALUES (${input.expenseDate}, ${input.description}, ${input.amount}, ${input.category}, ${input.receiptUrl})
  `

  revalidatePath("/admin/financials")
}

export async function deleteExpense(id: string): Promise<void> {
  await requireAdmin()

  await sql`DELETE FROM expenses WHERE id = ${id}`

  revalidatePath("/admin/financials")
}

export interface FundBucket {
  label: string
  allocated: number
  spent: number
  available: number
}

/** Spendable reporting buckets for the current 50/15/10/25 ledger plus retained legacy allocations. */
export async function getFundBuckets(): Promise<{
  creatorPayouts: FundBucket
  admin: FundBucket
  opex: FundBucket
  marketing: FundBucket
}> {
  await requireAdmin()

  const [{ rows: allocatedRows }, { rows: spentRows }] = await Promise.all([
    sql<{ role: LedgerRole; total: string }>`
      SELECT role, COALESCE(SUM(amount), 0) AS total FROM ledger_entries GROUP BY role
    `,
    sql<{ category: ExpenseCategory; total: string }>`
      SELECT category, COALESCE(SUM(amount), 0) AS total FROM expenses GROUP BY category
    `,
  ])

  const allocated: Record<string, number> = {}
  for (const row of allocatedRows) allocated[row.role] = Number(row.total)

  const spent: Record<string, number> = {}
  for (const row of spentRows) spent[row.category] = Number(row.total)

  function bucket(label: string, roles: LedgerRole[], category: ExpenseCategory): FundBucket {
    const total = roles.reduce((sum, role) => sum + (allocated[role] ?? 0), 0)
    const used = spent[category] ?? 0
    return { label, allocated: total, spent: used, available: total - used }
  }

  return {
    creatorPayouts: bucket("Shooter & Editor Payouts", ["shooter", "editor", "labor"], "payout"),
    admin: bucket("Admin Allocation (10%)", ["admin"], "admin"),
    opex: bucket("House Reserve (25%)", ["house"], "opex"),
    marketing: bucket("Legacy Team Pool", ["team_pool"], "marketing"),
  }
}

export interface LedgerSummaryRow {
  shootId: string
  date: string
  clientName: string
  packageLabel: string
  totalInvoice: number
  shooterCut: number
  editorCut: number
  adminCut: number
  houseCut: number
  legacyLaborCut: number
  legacyTeamPool: number
  status: LedgerStatus
  hasCreatorPayouts: boolean
}

/** One row per finalized shoot, with current split roles separated and legacy rows preserved. */
export async function listLedgerSummary(): Promise<LedgerSummaryRow[]> {
  await requireAdmin()

  const { rows } = await sql<{
    shoot_id: string
    created_at: string
    client_name: string
    shoot_type: string
    final_amount: string | null
    total_price: string | null
    shooter_amount: string
    editor_amount: string
    admin_amount: string
    house_amount: string
    legacy_labor_amount: string
    legacy_team_pool_amount: string
    creator_payout_count: number
    creator_payouts_paid: boolean | null
  }>`
    SELECT
      s.id AS shoot_id,
      s.created_at,
      s.client_name,
      s.shoot_type,
      s.final_amount,
      s.total_price,
      COALESCE(SUM(le.amount) FILTER (WHERE le.role = 'shooter'), 0) AS shooter_amount,
      COALESCE(SUM(le.amount) FILTER (WHERE le.role = 'editor'), 0) AS editor_amount,
      COALESCE(SUM(le.amount) FILTER (WHERE le.role = 'admin'), 0) AS admin_amount,
      COALESCE(SUM(le.amount) FILTER (WHERE le.role = 'house'), 0) AS house_amount,
      COALESCE(SUM(le.amount) FILTER (WHERE le.role = 'labor'), 0) AS legacy_labor_amount,
      COALESCE(SUM(le.amount) FILTER (WHERE le.role = 'team_pool'), 0) AS legacy_team_pool_amount,
      COUNT(*) FILTER (WHERE le.role IN ('shooter','editor','labor'))::int AS creator_payout_count,
      BOOL_AND(le.status = 'PAID') FILTER (WHERE le.role IN ('shooter','editor','labor')) AS creator_payouts_paid
    FROM shoots s
    JOIN ledger_entries le ON le.shoot_id = s.id
    GROUP BY s.id, s.created_at, s.client_name, s.shoot_type, s.final_amount, s.total_price
    ORDER BY s.created_at DESC
  `

  return rows.map((r) => ({
    shootId: r.shoot_id,
    date: r.created_at,
    clientName: r.client_name,
    packageLabel: r.shoot_type,
    totalInvoice: Number(r.final_amount ?? r.total_price ?? 0),
    shooterCut: Number(r.shooter_amount ?? 0),
    editorCut: Number(r.editor_amount ?? 0),
    adminCut: Number(r.admin_amount ?? 0),
    houseCut: Number(r.house_amount ?? 0),
    legacyLaborCut: Number(r.legacy_labor_amount ?? 0),
    legacyTeamPool: Number(r.legacy_team_pool_amount ?? 0),
    status: r.creator_payouts_paid && r.creator_payout_count > 0 ? "PAID" : "PENDING",
    hasCreatorPayouts: r.creator_payout_count > 0,
  }))
}
