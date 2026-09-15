"use server"

import { revalidatePath } from "next/cache"

import { sql } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"
import { calculateSplits } from "@/lib/splits"

export type LedgerRole = "driver" | "labor" | "house" | "team_pool"
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

/**
 * Generates the per-recipient settlement ledger for a shoot from calculateSplits().
 * Re-generating (e.g. after a price edit) replaces PENDING rows but leaves
 * anything already marked PAID untouched, so a completed payout is never overwritten.
 */
export async function generateLedgerForShoot(
  shootId: string,
  input: {
    basePrice: number
    travelFee: number
    assignedShooter: string | null
    assignedEditor: string | null
  },
): Promise<LedgerEntry[]> {
  await requireAdmin()

  const splits = calculateSplits({ basePrice: input.basePrice, travelFee: input.travelFee })

  await sql`DELETE FROM ledger_entries WHERE shoot_id = ${shootId} AND status = 'PENDING'`

  const laborRecipient =
    [input.assignedShooter, input.assignedEditor].filter(Boolean).join(" & ") || "Unassigned crew"

  const rowsToInsert: { recipient: string; role: LedgerRole; amount: number }[] = [
    { recipient: laborRecipient, role: "labor", amount: splits.laborPool },
    { recipient: "House fund", role: "house", amount: splits.houseFund },
    { recipient: "Team pool", role: "team_pool", amount: splits.teamPool },
  ]

  if (splits.driverReimbursement > 0) {
    rowsToInsert.push({ recipient: "Driver reimbursement", role: "driver", amount: splits.driverReimbursement })
  }

  for (const row of rowsToInsert) {
    await sql`
      INSERT INTO ledger_entries (shoot_id, recipient, role, amount)
      VALUES (${shootId}, ${row.recipient}, ${row.role}, ${row.amount})
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

export interface FinancialsSummary {
  grossRevenue: number
  houseFundHealth: number
  totalLaborPaid: number
  founderPool: number
}

/**
 * Gross revenue is every dollar ever settled (labor + house + founder pool +
 * driver reimbursement combined); house/founder pool are retained the moment
 * a shoot settles, while labor is only "paid" once marked PAID in the ledger.
 */
export async function getFinancialsSummary(): Promise<FinancialsSummary> {
  await requireAdmin()

  const { rows } = await sql<{
    gross_revenue: string
    house_fund_health: string
    total_labor_paid: string
    founder_pool: string
  }>`
    SELECT
      COALESCE(SUM(amount), 0) AS gross_revenue,
      COALESCE(SUM(amount) FILTER (WHERE role = 'house'), 0) AS house_fund_health,
      COALESCE(SUM(amount) FILTER (WHERE role = 'labor' AND status = 'PAID'), 0) AS total_labor_paid,
      COALESCE(SUM(amount) FILTER (WHERE role = 'team_pool'), 0) AS founder_pool
    FROM ledger_entries
  `

  const row = rows[0]

  return {
    grossRevenue: Number(row?.gross_revenue ?? 0),
    houseFundHealth: Number(row?.house_fund_health ?? 0),
    totalLaborPaid: Number(row?.total_labor_paid ?? 0),
    founderPool: Number(row?.founder_pool ?? 0),
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

export interface LedgerSummaryRow {
  shootId: string
  date: string
  clientName: string
  packageLabel: string
  totalInvoice: number
  laborCut: number
  houseCut: number
  founderCut: number
  status: LedgerStatus
  laborEntryId: string | null
}

/** One row per finalized shoot, aggregating its ledger entries by role. */
export async function listLedgerSummary(): Promise<LedgerSummaryRow[]> {
  await requireAdmin()

  const { rows } = await sql<{
    shoot_id: string
    created_at: string
    client_name: string
    shoot_type: string
    final_amount: string | null
    base_price: string
    travel_fee: string
    labor_amount: string | null
    house_amount: string | null
    team_pool_amount: string | null
    labor_status: string | null
    labor_entry_id: string | null
  }>`
    SELECT
      s.id AS shoot_id,
      s.created_at,
      s.client_name,
      s.shoot_type,
      s.final_amount,
      s.base_price,
      s.travel_fee,
      MAX(CASE WHEN le.role = 'labor' THEN le.amount END) AS labor_amount,
      MAX(CASE WHEN le.role = 'house' THEN le.amount END) AS house_amount,
      MAX(CASE WHEN le.role = 'team_pool' THEN le.amount END) AS team_pool_amount,
      MAX(CASE WHEN le.role = 'labor' THEN le.status END) AS labor_status,
      MAX(CASE WHEN le.role = 'labor' THEN le.id::text END) AS labor_entry_id
    FROM shoots s
    JOIN ledger_entries le ON le.shoot_id = s.id
    GROUP BY s.id, s.created_at, s.client_name, s.shoot_type, s.final_amount, s.base_price, s.travel_fee
    ORDER BY s.created_at DESC
  `

  return rows.map((r) => ({
    shootId: r.shoot_id,
    date: r.created_at,
    clientName: r.client_name,
    packageLabel: r.shoot_type,
    totalInvoice: Number(r.final_amount ?? Number(r.base_price) + Number(r.travel_fee)),
    laborCut: Number(r.labor_amount ?? 0),
    houseCut: Number(r.house_amount ?? 0),
    founderCut: Number(r.team_pool_amount ?? 0),
    status: (r.labor_status as LedgerStatus) ?? "PENDING",
    laborEntryId: r.labor_entry_id,
  }))
}
