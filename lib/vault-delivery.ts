import "server-only"

import { sql } from "@/lib/db"
import { isDeliveredStatus } from "@/lib/vault-progress"
import { hasVaultSession, isAdminViewer } from "@/lib/vault-session"

/**
 * Final photos are visible to admins at any stage, and to the vault's signed-in client only once
 * the Kanban card reaches Delivered & Settled. Vaults with no linked shoot that are already Active
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
