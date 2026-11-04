"use server"

import { Pool } from "pg"

import { getConditionsFor, type ShootConditions } from "@/lib/shoot-conditions"
import { hasVaultSession, isAdminViewer } from "@/lib/vault-session"

const MAX_FIELD_LENGTH = 2000

function getPool() {
  const url = new URL(process.env.POSTGRES_URL as string)
  url.searchParams.delete("sslmode")
  return new Pool({ connectionString: url.toString(), ssl: { rejectUnauthorized: false } })
}

async function canAccessVault(vaultId: string) {
  return (await hasVaultSession(vaultId)) || (await isAdminViewer())
}

export interface VaultProgress {
  shootStatus: string | null
  photoCount: number
  contractSigned: boolean
  depositPaid: boolean
  countersignature: string | null
  countersignedAt: string | null
}

/** Live status for the portal tracker; polled so it follows the admin dragging the Kanban card. */
export async function getVaultProgress(vaultId: string): Promise<VaultProgress | null> {
  if (!(await canAccessVault(vaultId))) return null

  const pool = getPool()
  try {
    const result = await pool.query(
      `SELECT COALESCE(s.status, CASE WHEN v.status = 'Active' THEN 'delivered_settled' END) AS shoot_status,
              v.contract_signed, v.deposit_paid, v.countersignature, v.countersigned_at,
              (SELECT COUNT(*)::int FROM vault_photos vp WHERE vp.vault_id = v.id) AS photo_count
         FROM vaults v
         LEFT JOIN shoots s ON s.id = v.shoot_id
        WHERE v.id = $1`,
      [vaultId]
    )
    if (result.rowCount === 0) return null

    const row = result.rows[0]
    return {
      shootStatus: row.shoot_status ?? null,
      photoCount: Number(row.photo_count) || 0,
      contractSigned: Boolean(row.contract_signed),
      depositPaid: Boolean(row.deposit_paid),
      countersignature: row.countersignature ?? null,
      countersignedAt: row.countersigned_at ? new Date(row.countersigned_at).toISOString() : null,
    }
  } finally {
    await pool.end()
  }
}

/** Weather, golden hour and sunset for the shoot's saved location and date. */
export async function getShootConditions(vaultId: string): Promise<ShootConditions | null> {
  if (!(await canAccessVault(vaultId))) return null

  const pool = getPool()
  let location: string | null = null
  let isoDate: string | null = null
  try {
    const result = await pool.query(
      `SELECT s.location, COALESCE(v.shoot_date, s.shoot_date)::date::text AS shoot_date
         FROM vaults v
         LEFT JOIN shoots s ON s.id = v.shoot_id
        WHERE v.id = $1`,
      [vaultId]
    )
    if (result.rowCount === 0) return null
    location = result.rows[0].location ?? null
    isoDate = result.rows[0].shoot_date ?? null
  } finally {
    await pool.end()
  }

  return getConditionsFor(location, isoDate)
}

export async function submitPrepNotes(
  vaultId: string,
  input: { mustHaveShots: string; moodBoardLinks: string }
): Promise<{ success: boolean; error?: string }> {
  if (!(await canAccessVault(vaultId))) return { success: false, error: "Your session has expired. Please sign in again." }

  const mustHaveShots = input.mustHaveShots.trim()
  const moodBoardLinks = input.moodBoardLinks.trim()

  if (!mustHaveShots && !moodBoardLinks) {
    return { success: false, error: "Add at least one must-have shot or mood board link." }
  }
  if (mustHaveShots.length > MAX_FIELD_LENGTH || moodBoardLinks.length > MAX_FIELD_LENGTH) {
    return { success: false, error: `Please keep each field under ${MAX_FIELD_LENGTH} characters.` }
  }

  const pool = getPool()
  try {
    const result = await pool.query(
      `UPDATE vaults
          SET must_have_shots = $2, mood_board_links = $3, prep_submitted_at = now()
        WHERE id = $1`,
      [vaultId, mustHaveShots || null, moodBoardLinks || null]
    )
    return result.rowCount === 0 ? { success: false, error: "Vault not found." } : { success: true }
  } finally {
    await pool.end()
  }
}
