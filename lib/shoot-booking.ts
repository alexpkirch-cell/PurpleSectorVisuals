import "server-only"

import { revalidatePath } from "next/cache"

import { sql } from "@/lib/db"
import { syncShootToGoogleCalendar } from "@/lib/google-calendar"

/** Side effects of a shoot becoming a confirmed booking: the studio calendar block and the Google event. */
export async function finalizeBookedShoot(shootId: string) {
  const { rows } = await sql<{ client_name: string; shoot_date: string | Date | null }>`
    SELECT client_name, shoot_date FROM shoots WHERE id = ${shootId}
  `
  const shoot = rows[0]
  if (shoot?.shoot_date) {
    const day = new Date(shoot.shoot_date).toISOString().slice(0, 10)
    await sql`
      INSERT INTO calendar_blocks (start_date, end_date, type, label)
      SELECT ${day}, ${day}, 'booking', ${shoot.client_name}
      WHERE NOT EXISTS (
        SELECT 1 FROM calendar_blocks WHERE start_date = ${day} AND type = 'booking' AND label = ${shoot.client_name}
      )
    `
  }

  await syncShootToGoogleCalendar(shootId)
}

/**
 * Moves a pre-booking shoot to "Booked & Retainer Paid". The status guard makes this a single atomic
 * transition, so the signing and payment paths can both call it and only the first one acts.
 */
export async function advanceShootToBooked(shootId: string) {
  const { rows } = await sql<{ id: string }>`
    UPDATE shoots SET
      status = 'booked_retainer_paid',
      client_signed_at = COALESCE(client_signed_at, now())
    WHERE id = ${shootId}
      AND status IN ('new_inquiry', 'call_scheduled', 'awaiting_signature')
    RETURNING id
  `
  if (rows.length === 0) return false

  await finalizeBookedShoot(shootId)

  revalidatePath("/admin")
  revalidatePath("/admin/operations")
  return true
}

/**
 * Books the shoot behind a vault once the client has signed and the retainer is settled
 * (paid, or nothing to pay because the shoot is comped or $0).
 */
export async function advanceShootForVault(vaultId: string) {
  const { rows } = await sql<{ shoot_id: string | null; ready: boolean }>`
    SELECT
      v.shoot_id,
      (
        v.contract_signed = true
        AND (
          v.deposit_paid = true
          OR COALESCE(s.is_comped, false)
          OR COALESCE(v.deposit_amount, 0) = 0
        )
      ) AS ready
    FROM vaults v
    LEFT JOIN shoots s ON s.id = v.shoot_id
    WHERE v.id = ${vaultId}
  `
  const vault = rows[0]
  if (!vault?.shoot_id || !vault.ready) return false

  return advanceShootToBooked(vault.shoot_id)
}
