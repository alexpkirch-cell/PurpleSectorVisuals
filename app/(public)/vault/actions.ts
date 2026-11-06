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
export async function authenticateVaultWithEmailPin(
  _prevState: VaultAuthState,
  formData: FormData,
): Promise<VaultAuthState> {
  const email = String(formData.get("email") ?? "").trim().slice(0, 254)
  const pin = String(formData.get("pin") ?? "").replace(/\s/g, "")

  if (!email || !email.includes("@")) {
    return { error: "Enter the email address on your booking." }
  }
  if (!/^\d{6}$/.test(pin)) {
    return { error: "Your access code is 6 digits." }
  }

  const ip = getClientIp(await headers())

  if (await isVaultLoginBlocked(email, ip)) {
    return { error: VAULT_LOCKOUT_MESSAGE }
  }

  const { rows } = await sql<{ id: string }>`
    SELECT v.id
    FROM vaults v
    LEFT JOIN shoots s ON s.id = v.shoot_id
    LEFT JOIN booking_requests b ON b.id = v.booking_request_id
    WHERE v.pin_code = ${pin}
      AND (lower(s.client_email) = lower(${email}) OR lower(b.email) = lower(${email}))
    LIMIT 1
  `

  const vault = rows[0]
  await recordVaultLoginAttempt(email, ip, Boolean(vault))

  if (!vault) {
    return { error: "That email and access code don't match a vault. Double-check and try again." }
  }

  await grantVaultSession(vault.id)
  redirect(`/vault/${pin}`)
}
