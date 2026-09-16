"use server"

import { Pool } from "pg"

function getPool() {
  const url = new URL(process.env.POSTGRES_URL as string)
  url.searchParams.delete("sslmode")
  return new Pool({ connectionString: url.toString(), ssl: { rejectUnauthorized: false } })
}

export type VaultRecord = {
  id: string
  bookingId: string | null
  shootId: string | null
  galleryId: string | null
  status: "Onboarding" | "Active" | "Expired"
  contractSigned: boolean
  depositPaid: boolean
  depositAmount: number | null
  shootDate: string | null
  expiresAt: string | null
  clientName: string
  category: string | null
  packageTitle: string | null
}

export async function activateVaultIfReady(vaultId: string) {
  const pool = getPool()
  try {
    const result = await pool.query(
      `SELECT contract_signed, deposit_paid, status FROM vaults WHERE id = $1`,
      [vaultId]
    )
    if (result.rowCount === 0) return { activated: false }

    const row = result.rows[0]
    if (row.contract_signed && row.deposit_paid && row.status === "Onboarding") {
      await pool.query(
        `UPDATE vaults SET status = 'Active', expires_at = now() + interval '90 days' WHERE id = $1`,
        [vaultId]
      )
      return { activated: true }
    }
    return { activated: row.status === "Active" }
  } finally {
    await pool.end()
  }
}

export async function lookupVaultByPin(
  pin: string
): Promise<{ found: false } | { found: true; secret: true } | { found: true; secret: false; vault: VaultRecord }> {
  const trimmed = pin.trim()
  if (!/^\d{4,6}$/.test(trimmed)) return { found: false }

  if (trimmed === "000000") {
    return { found: true, secret: true }
  }

  const pool = getPool()
  try {
    const result = await pool.query(
      `SELECT
        v.id, v.booking_id, v.shoot_id, v.gallery_id, v.status,
        v.contract_signed, v.deposit_paid, v.deposit_amount, v.shoot_date, v.expires_at,
        b.first_name, b.last_name, b.subject,
        p.title as package_title
       FROM vaults v
       LEFT JOIN booking_requests b ON b.id = v.booking_id
       LEFT JOIN packages p ON p.id = b.package_id
       WHERE v.pin_code = $1
       LIMIT 1`,
      [trimmed]
    )

    if (result.rowCount === 0) return { found: false }

    const row = result.rows[0]
    let status: VaultRecord["status"] = row.status
    if (status === "Active" && row.expires_at && new Date(row.expires_at) < new Date()) {
      status = "Expired"
      await pool.query(`UPDATE vaults SET status = 'Expired' WHERE id = $1`, [row.id])
    }

    return {
      found: true,
      secret: false,
      vault: {
        id: row.id,
        bookingId: row.booking_id,
        shootId: row.shoot_id,
        galleryId: row.gallery_id,
        status,
        contractSigned: row.contract_signed,
        depositPaid: row.deposit_paid,
        depositAmount: row.deposit_amount ? Number(row.deposit_amount) : null,
        shootDate: row.shoot_date,
        expiresAt: row.expires_at,
        clientName: [row.first_name, row.last_name].filter(Boolean).join(" ") || "Client",
        category: row.subject ?? null,
        packageTitle: row.package_title ?? null,
      },
    }
  } finally {
    await pool.end()
  }
}
