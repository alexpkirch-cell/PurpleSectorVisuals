"use server"

import { cookies } from "next/headers"
import { Pool } from "pg"

import { vaultCookieName } from "@/lib/vault"

const GALLERY_LIFESPAN_DAYS = 180

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
  clientName: string
  category: string | null
  packageTitle: string | null
  isMinor: boolean
  portfolioConsent: boolean
  balanceAmount: number | null
  balancePaid: boolean
  finalQuotedFee: number | null
  deliveredAt: string | null
  expiresAt: string | null
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
      await pool.query(`UPDATE vaults SET status = 'Active' WHERE id = $1`, [vaultId])
      return { activated: true }
    }
    return { activated: row.status === "Active" }
  } finally {
    await pool.end()
  }
}

/**
 * Establishes a lightweight session cookie for gallery-scoped actions
 * (favorites, print orders) once a PIN vault has been verified and is
 * rendering its Active gallery. The PIN itself is re-validated against the
 * vault/gallery pair so the cookie can't be forged from an arbitrary gallery
 * id, but no further credential is required since the caller only reaches
 * this point after the server already rendered the authenticated gallery.
 */
export async function establishVaultSession(pin: string, galleryId: string) {
  const pool = getPool()
  try {
    const result = await pool.query(
      `SELECT id FROM vaults WHERE pin_code = $1 AND gallery_id = $2 AND status = 'Active'`,
      [pin, galleryId]
    )
    if (result.rowCount === 0) return { established: false }

    const cookieStore = await cookies()
    cookieStore.set(vaultCookieName(galleryId), pin, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24,
      path: "/",
    })
    return { established: true }
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
        v.contract_signed, v.deposit_paid, v.deposit_amount, v.shoot_date,
        v.is_minor, v.portfolio_consent, v.balance_amount, v.balance_paid, v.final_quoted_fee,
        b.first_name, b.last_name, b.subject,
        p.title as package_title,
        (SELECT MIN(gp.created_at) FROM gallery_photos gp WHERE gp.gallery_id = v.gallery_id) as delivered_at
       FROM vaults v
       LEFT JOIN booking_requests b ON b.id = v.booking_id
       LEFT JOIN packages p ON p.id = b.package_id
       WHERE v.pin_code = $1
       LIMIT 1`,
      [trimmed]
    )

    if (result.rowCount === 0) return { found: false }

    const row = result.rows[0]

    const deliveredAt: Date | null = row.delivered_at ? new Date(row.delivered_at) : null
    const computedExpiresAt = deliveredAt
      ? new Date(deliveredAt.getTime() + GALLERY_LIFESPAN_DAYS * 24 * 60 * 60 * 1000)
      : null

    let status: VaultRecord["status"] = row.status
    if (status === "Active" && computedExpiresAt && computedExpiresAt < new Date()) {
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
        clientName: [row.first_name, row.last_name].filter(Boolean).join(" ") || "Client",
        category: row.subject ?? null,
        packageTitle: row.package_title ?? null,
        isMinor: row.is_minor ?? false,
        portfolioConsent: row.portfolio_consent ?? true,
        balanceAmount: row.balance_amount ? Number(row.balance_amount) : null,
        balancePaid: row.balance_paid ?? false,
        finalQuotedFee: row.final_quoted_fee ? Number(row.final_quoted_fee) : null,
        deliveredAt: deliveredAt ? deliveredAt.toISOString() : null,
        expiresAt: computedExpiresAt ? computedExpiresAt.toISOString() : null,
      },
    }
  } finally {
    await pool.end()
  }
}
