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
