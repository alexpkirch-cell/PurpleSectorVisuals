"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { sql } from "@/lib/db"
import { getClientIp } from "@/lib/request-ip"
import { isVaultLoginBlocked, recordVaultLoginAttempt, VAULT_LOCKOUT_MESSAGE } from "@/lib/vault-throttle"
import { grantVaultSession } from "@/lib/vault-session"

export type VaultAuthState = { error?: string }

/**
 * Client vault login: the booking email and the 6-digit access code must both match the
 * same vault. On success a signed session cookie is set and the client lands in
 * their vault. Repeated misses lock the email (and the IP) out for a few minutes.
 */
export async function authenticateVaultWithNamePin(
  _prevState: VaultAuthState,
  formData: FormData,
): Promise<VaultAuthState> {
  const username = String(formData.get("username") ?? "").trim().replace(/\s+/g, " ").slice(0, 254)
  const pin = String(formData.get("pin") ?? "").replace(/\s/g, "")

  if (!username) {
    return { error: "Enter the name or email address on your booking." }
  }
  if (!/^\d{6}$/.test(pin)) {
    return { error: "Your access code is 6 digits." }
  }

  const ip = getClientIp(await headers())

  if (await isVaultLoginBlocked(username, ip)) {
    return { error: VAULT_LOCKOUT_MESSAGE }
  }

  const { rows } = await sql<{ id: string }>`
    SELECT v.id
    FROM vaults v
    LEFT JOIN shoots s ON s.id = v.shoot_id
    LEFT JOIN booking_requests b ON b.id = v.booking_request_id
    WHERE v.pin_code = ${pin}
      AND (
        lower(regexp_replace(COALESCE(NULLIF(BTRIM(s.client_name), ''), NULLIF(BTRIM(v.client_name), ''), ''), '\\s+', ' ', 'g')) = lower(${username})
        OR lower(BTRIM(COALESCE(s.client_email, ''))) = lower(${username})
        OR lower(BTRIM(COALESCE(b.email, ''))) = lower(${username})
        OR lower(regexp_replace(trim(concat_ws(' ', b.first_name, b.last_name)), '\\s+', ' ', 'g')) = lower(${username})
      )
    LIMIT 1
  `

  const vault = rows[0]
  await recordVaultLoginAttempt(username, ip, Boolean(vault))

  if (!vault) {
    return { error: "That email and access code don't match a vault. Double-check and try again." }
  }

  await grantVaultSession(vault.id)
  redirect("/vault")
}
