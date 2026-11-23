import "server-only"

import { sql } from "@/lib/db"
import { isDeliveredStatus } from "@/lib/vault-progress"
import { hasVaultSession, isAdminViewer } from "@/lib/vault-session"

/**
 * Final photos are visible to admins at any stage, and to the vault's signed-in client once the shoot is Ready for
 * Delivery or Delivered & Settled. The remaining balance still gates watermarks and original-file downloads. Vaults
 * with no linked shoot that are already Active
 * count as delivered, matching the portal's tab gating.
 */
export async function canViewDelivery(vaultId: string): Promise<boolean> {
  if (await isAdminViewer()) return true
  if (!(await hasVaultSession(vaultId))) return false

  const { rows } = await sql<{ shoot_status: string | null }>`
    SELECT COALESCE(s.status, CASE WHEN v.status = 'Active' THEN 'delivered_settled' END) AS shoot_status
    FROM vaults v
    LEFT JOIN shoots s ON s.id = v.shoot_id
    WHERE v.id = ${vaultId}
  `
  return isDeliveredStatus(rows[0]?.shoot_status ?? null)
}

export interface DeliveryBalanceState {
  /** True while the client's second 50% payment is outstanding: previews are watermarked and downloads are blocked. */
  locked: boolean
  /** Dollars still owed; 0 once unlocked. */
  balanceDue: number
}

// Stripe checkout for the balance requires at least $1 (see startBalanceCheckout), so smaller leftovers never lock.
const MIN_LOCKING_BALANCE = 1

/**
 * Full-resolution files follow the second 50% payment. Admins always see originals, comped shoots owe nothing, and
 * vaults without a balance on file behave as before.
 */
export async function getDeliveryBalanceState(vaultId: string): Promise<DeliveryBalanceState> {
  if (await isAdminViewer()) return { locked: false, balanceDue: 0 }

  const { rows } = await sql<{ balance_amount: string | null; balance_paid: boolean | null; is_comped: boolean }>`
    SELECT v.balance_amount, v.balance_paid, COALESCE(s.is_comped, false) AS is_comped
    FROM vaults v
    LEFT JOIN shoots s ON s.id = v.shoot_id
    WHERE v.id = ${vaultId}
  `
  const row = rows[0]
  if (!row) return { locked: false, balanceDue: 0 }

  const due = Number(row.balance_amount ?? 0)
  const locked = !row.is_comped && !row.balance_paid && due >= MIN_LOCKING_BALANCE
  return { locked, balanceDue: locked ? due : 0 }
}

/** Originals (zip, single downloads, print fulfilment) are only released once delivery is visible and the balance is clear. */
export async function canDownloadDelivery(vaultId: string): Promise<boolean> {
  if (!(await canViewDelivery(vaultId))) return false
  return !(await getDeliveryBalanceState(vaultId)).locked
}
