"use server"

import { revalidatePath } from "next/cache"
import { sql } from "@/lib/db"
import { computeSettlement, summarizeSettlement, type SettlementStatus } from "@/lib/settlement"
import { contractTotalOf, editorsOf, shootersOf } from "@/lib/shoot-team"
import { createClient } from "@/lib/supabase/server"
import type { Shoot } from "@/app/actions/shoots"

async function requireAdminSession() {
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

export interface SettlementRow {
  id: string
  shoot_id: string
  recipient_name: string
  role: string
  pool_percentage: number
  amount: number
  status: SettlementStatus
  paid_at: string | null
}

export interface ShootSettlement {
  rows: SettlementRow[]
  totalCollected: number
  driverReimbursement: number
  netRevenue: number
  isComped: boolean
}

interface RawSettlementRow extends Omit<SettlementRow, "pool_percentage" | "amount"> {
  pool_percentage: string | number
  amount: string | number
}

const normalize = (row: RawSettlementRow): SettlementRow => ({
  ...row,
  pool_percentage: Number(row.pool_percentage),
  amount: Number(row.amount),
})

/**
 * Recomputes the company settlement for a shoot from its current team, price and
 * driver reimbursement, and reconciles it with shoot_settlements. Lines already
 * marked paid keep their status and paid_at stamp.
 */
export async function getShootSettlement(shootId: string): Promise<ShootSettlement> {
  await requireAdminSession()

  const { rows: shootRows } = await sql<Shoot>`SELECT * FROM shoots WHERE id = ${shootId}`
  const shoot = shootRows[0]
  if (!shoot) throw new Error("Shoot not found")

  const isComped = Boolean(shoot.is_comped)
  const totalCollected = contractTotalOf(shoot)
  const driverReimbursement = Number(shoot.driver_reimbursement) || 0

  const computed = computeSettlement({
    totalCollected,
    driverReimbursement,
    shooters: shootersOf(shoot),
    editors: editorsOf(shoot),
    isComped,
  })

  const { rows: existing } = await sql<RawSettlementRow>`
    SELECT id, shoot_id, recipient_name, role, pool_percentage, amount, status, paid_at
    FROM shoot_settlements WHERE shoot_id = ${shootId}
  `
  const existingByKey = new Map(existing.map((row) => [`${row.recipient_name}::${row.role}`, row]))
  const keep = new Set<string>()

  for (const line of computed) {
    const key = `${line.recipient_name}::${line.role}`
    const match = existingByKey.get(key)
    if (match) {
      keep.add(match.id)
      const status = match.status === "paid" && line.status !== "comped" ? "paid" : line.status
      await sql`
        UPDATE shoot_settlements SET
          pool_percentage = ${line.pool_percentage},
          amount = ${line.amount},
          status = ${status},
          paid_at = ${status === "paid" ? match.paid_at : null}
        WHERE id = ${match.id}
      `
    } else {
      const { rows } = await sql<{ id: string }>`
        INSERT INTO shoot_settlements (shoot_id, recipient_name, role, pool_percentage, amount, status)
        VALUES (${shootId}, ${line.recipient_name}, ${line.role}, ${line.pool_percentage}, ${line.amount}, ${line.status})
        RETURNING id
      `
      keep.add(rows[0].id)
    }
  }

  const stale = existing.filter((row) => !keep.has(row.id)).map((row) => row.id)
  if (stale.length > 0) {
    await sql`DELETE FROM shoot_settlements WHERE id = ANY(${stale}::uuid[])`
  }

  const { rows } = await sql<RawSettlementRow>`
    SELECT id, shoot_id, recipient_name, role, pool_percentage, amount, status, paid_at
    FROM shoot_settlements WHERE shoot_id = ${shootId}
    ORDER BY created_at, role
  `

  const summary = summarizeSettlement({ totalCollected, driverReimbursement, isComped })
  return { rows: rows.map(normalize), isComped: isComped || summary.totalCollected === 0, ...summary }
}

export async function markSettlementPaid(id: string): Promise<SettlementRow> {
  await requireAdminSession()

  const { rows } = await sql<RawSettlementRow>`
    UPDATE shoot_settlements
    SET status = 'paid', paid_at = now()
    WHERE id = ${id} AND status = 'pending'
    RETURNING id, shoot_id, recipient_name, role, pool_percentage, amount, status, paid_at
  `
  if (rows.length === 0) throw new Error("Only pending settlement lines can be marked paid")

  revalidatePath("/admin/operations")
  return normalize(rows[0])
}
