"use server"

import { revalidatePath } from "next/cache"

import { sql } from "@/lib/db"
import { requireAdmin } from "@/lib/require-admin"
import { recordBalancePayment } from "@/lib/vault-payments"

export type OfflineBalanceMethod = "cash" | "check" | "external_transfer"

const OFFLINE_METHODS: readonly OfflineBalanceMethod[] = ["cash", "check", "external_transfer"]
const MAX_NOTE_LENGTH = 500

export type MarkBalancePaidResult =
  | { success: true; paidAt: string; method: OfflineBalanceMethod }
  | { success: false; error: string }

/**
 * Records the second 50% as received outside Stripe. It does exactly what a cleared Stripe balance does: flags the vault
 * balance paid (unlocking the client's full-resolution gallery and print ordering), writes a payment log row and marks
 * the shoot paid, so the Financials views and the portal stay in step.
 */
export async function markShootBalancePaid(
  shootId: string,
  input: { method: OfflineBalanceMethod; note?: string },
): Promise<MarkBalancePaidResult> {
  let admin: Awaited<ReturnType<typeof requireAdmin>>
  try {
    admin = await requireAdmin()
  } catch {
    return { success: false, error: "Not authorized." }
  }

  if (!OFFLINE_METHODS.includes(input.method)) {
    return { success: false, error: "Choose Cash, Check, or External Transfer." }
  }
  const note = input.note?.trim().slice(0, MAX_NOTE_LENGTH) || null

  try {
    const { rows } = await sql<{ id: string; balance_paid: boolean | null; balance_amount: string | null }>`
      SELECT id, balance_paid, balance_amount FROM vaults WHERE shoot_id = ${shootId}
    `
    const vault = rows[0]
    if (!vault) return { success: false, error: "This shoot has no client vault yet." }
    if (vault.balance_paid) return { success: false, error: "The balance is already marked paid." }
    if (!(Number(vault.balance_amount ?? 0) > 0)) return { success: false, error: "There is no balance due on this vault." }

    await recordBalancePayment(vault.id, { method: input.method, note, recordedBy: admin.email ?? admin.id })

    revalidatePath("/admin")
    revalidatePath("/admin/operations")
    revalidatePath("/admin/clients")
    revalidatePath("/admin/financials")
    return { success: true, paidAt: new Date().toISOString(), method: input.method }
  } catch (error) {
    console.error("[v0] markShootBalancePaid failed:", error)
    return { success: false, error: "Could not record the payment. Please try again." }
  }
}
